import fs from 'fs'
import path from 'path'
import express from 'express'
import jwt from 'jsonwebtoken'
import nodemailer from 'nodemailer'
import type { OkPacket, RowDataPacket } from 'mysql2'
import type { RequestProps } from './types'
import type { ChatMessage } from './chatgpt'
import { chatConfig, chatReplyProcess, currentModel, setApiKey } from './chatgpt'
import { auth, pool } from './middleware/auth'
import { limiter } from './middleware/limiter'
import { isNotEmptyString } from './utils/is'

const app = express()
const router = express.Router()
app.use(express.static('public'))
app.use(express.json())

app.all('*', (_, res, next) => {
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Headers', 'authorization, Content-Type')
  res.header('Access-Control-Allow-Methods', '*')
  next()
})

router.post('/chat-process', [auth, limiter], async (req, res) => {
  res.setHeader('Content-type', 'application/octet-stream')
  const filePath = path.join(__dirname, './bad-words.json')

  const buffer = fs.readFileSync(filePath)
  const jsonString = buffer.toString()
  const badWords = JSON.parse(jsonString)

  const checkForBadWords = (message) => {
  // 遍历关键词数组，检测消息中是否包含这些关键词
    for (const badWord of badWords) {
      if (new RegExp(badWord, 'g').test(message))
        return '拒绝回复此消息' // '拒绝回复此消息' // 如果消息中包含关键词，直接返回 "拒绝回复此消息"
    }
    return message
  }

  try {
    const { prompt, options = {}, systemMessage, temperature, top_p, email } = req.body as RequestProps

    // 查询用户信息
    const [rows] = await pool.execute(
      'SELECT id, usage_count, usage_limit,apikey FROM users WHERE email = ?',
      [email],
    )
    const user = rows[0]
    const usageCount = user.usage_count
    const usageLimit = user.usage_limit || 10
    const userapikey = user.apikey

    // 判断用户apikey是否等于1，如果等于1就增加使用次数，否则不增加
    if (userapikey === '1' || userapikey === '' || userapikey === undefined) {
      const zuserapikey = process.env.OPENAI_API_KEY
      await setApiKey(zuserapikey)
      if (usageCount >= usageLimit)
        res.send({ status: 'Fail', message: '次数用完了及时充值' })
      else
        await pool.query('UPDATE users SET usage_count = usage_count + 1 WHERE email = ?', [email])
    }
    else {
      await setApiKey(userapikey)
    }

    // 将增加的使用次数传递给下一个中间件或者路由处理程序

    const DEFAULT_USAGE_LIMIT = process.env.USAGE_LIMIT
    const remainingUsage = Math.min((user.usage_limit || DEFAULT_USAGE_LIMIT))

    let firstChunk = true

    await chatReplyProcess({
      message: prompt,
      lastContext: options,
      process: (chat: ChatMessage) => {
        // 检测每一条聊天消息是否包含关键词
        chat.text = checkForBadWords(chat.text)

        // 如果检测到关键词，直接返回一个包含 "拒绝回复此消息" 的回复消息
        if (chat.text === '拒绝回复此消息') {
          // res.write(JSON.stringify({ message: '拒绝回复此消息' }))
          if (firstChunk) {
            // 创建包含用户信息的新对象
            const responseObj = {
              role: chat.role,
              parentMessageId: chat.parentMessageId,
              id: chat.id,
              text: '拒绝回复此消息',
              usage_count: user.usage_count,
              usage_limit: remainingUsage,
            }
            res.write(JSON.stringify(responseObj))
            firstChunk = true
          }
        }

        // 添加用户信息到响应体中
        if (firstChunk) {
          // 创建包含用户信息的新对象
          const responseObj = {
            ...chat,
            usage_count: user.usage_count,
            usage_limit: remainingUsage,
          }
          res.write(JSON.stringify(responseObj))
          firstChunk = false
        }
        else {
          res.write(`\n${JSON.stringify(chat)}`)
        }
      },
      systemMessage,
      temperature,
      top_p,

    })
  }
  catch (error) {
    res.write(JSON.stringify(error))
  }
  finally {
    res.end()
  }
})

router.post('/config', auth, async (req, res) => {
  try {
    const authHeader = req.headers.authorization
    if (!authHeader)
      throw new Error('Please authenticate.')

    const token = authHeader.split(' ')[1]
    if (!token)
      throw new Error('Invalid token')

    const decoded = await jwt.verify(token, process.env.AUTH_SECRET_KEY)
    const userId = decoded.userId

    // 检查用户使用次数是否超限
    const [key] = await pool.query('SELECT apikey FROM users WHERE id = ?', [userId])

    const response = await chatConfig(key[0].apikey)
    res.send(response)
  }
  catch (error) {
    res.send(error)
  }
})

router.post('/session', async (req, res) => {
  try {
    const AUTH_SECRET_KEY = process.env.AUTH_SECRET_KEY
    const hasAuth = isNotEmptyString(AUTH_SECRET_KEY)
    res.send({ status: 'Success', message: '', data: { auth: hasAuth, model: currentModel() } })
  }
  catch (error) {
    res.send({ status: 'Fail', message: error.message, data: null })
  }
})

router.post('/verify', async (req, res) => {
  try {
    const { token } = req.body as { token: string }
    if (!token)
      throw new Error('Secret key is empty')

    if (process.env.AUTH_SECRET_KEY !== token)
      throw new Error('密钥无效 | Secret key is invalid')

    res.send({ status: 'Success', message: 'Verify successfully', data: null })
  }
  catch (error) {
    res.send({ status: 'Fail', message: error.message, data: null })
  }
})
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body

    // 查询数据库中是否存在与之匹配的用户记录
    const [rows] = await pool.execute(
      'SELECT id, email,usage_count,usage_limit,apikey FROM users WHERE email = ? AND password = ?',
      [email, password],
    )
    const user = rows[0]

    if (!user)
      throw new Error('用户名不存在或密码错误')

    // 将用户 ID 存储到会话中
    const token = jwt.sign({ userId: user.id }, process.env.AUTH_SECRET_KEY)
    const usage_limit = user.usage_limit
    const key = user.apikey

    res.send({ status: 'Success', message: '登录成功', token, email: user.email, usage_count: user.usage_count, usage_limit: usage_limit || process.env.USAGE_LIMIT, key })
  }
  catch (error) {
    res.send({ status: 'Fail', message: error.message, data: null })
  }
})

function generateVerifyCode() {
  const code = Math.floor(Math.random() * 1000000).toString().padStart(6, '0')
  return code
}

// 发送验证码邮件
async function sendVerifyCodeEmail(email, verifyCode) {
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP || 'smtp.qq.com',
    port: 465,
    secure: true,
    auth: {
      user: process.env.EMAIL_USERNAME,
      pass: process.env.EMAIL_PASSWORD,
    },
  })

  await transporter.sendMail({
    from: `${process.env.EMAIL_FROM_NAME} <${process.env.EMAIL_USERNAME}>`,
    to: email,
    subject: '验证码',
    text: `您的验证码是 ${verifyCode}，请在 10 分钟内输入该验证码完成邮箱验证。`,
    html: `<p>您的验证码是 <strong>${verifyCode}</strong>，请在 10 分钟内输入该验证码完成邮箱验证。</p>`,
  })
}

router.post('/register', async (req, res) => {
  try {
    const { email, password, verifyCode } = req.body

    // 验证验证码是否正确
    const savedVerifyCode = await pool.execute(
      'SELECT * FROM verify_codes WHERE email = ? AND verify_code = ? AND created_at >= DATE_SUB(NOW(), INTERVAL 10 MINUTE)',
      [email, verifyCode],
    )

    if ((savedVerifyCode[0] as RowDataPacket[]).length === 0)
      throw new Error('验证码不正确或已过期')

    // 先查询数据库中是否有相同的邮箱记录
    const [rows] = await pool.execute(
      'SELECT * FROM users WHERE email = ?',
      [email],
    )

    if ((rows as RowDataPacket[]).length > 0)
      throw new Error('该邮箱已被注册')

    // 向数据库中插入一条新用户记录
    const [result] = await pool.execute(
      'INSERT INTO users (email, password) VALUES (?, ?)',
      [email, password],
    )

    const userId = (result as OkPacket).insertId

    // 为新注册的用户生成 JWT 令牌
    const token = jwt.sign({ userId }, process.env.AUTH_SECRET_KEY)

    // 删除验证码
    await pool.execute(
      'DELETE FROM verify_codes WHERE email = ?',
      [email],
    )

    res.send({ status: 'Success', message: '注册成功', token, email, usage_count: '0', usage_limit: process.env.USAGE_LIMIT, key: '1' })
  }
  catch (error) {
    res.send({ status: 'Fail', message: error.message, data: null })
  }
})

router.post('/send-verify-code', async (req, res) => {
  try {
    const { email } = req.body
    const [emailrows] = await pool.execute(
      'SELECT * FROM users WHERE email = ?',
      [email],
    )

    if ((emailrows as RowDataPacket[]).length > 0)
      throw new Error('该邮箱已被注册')

    // 生成验证码
    const verifyCode = generateVerifyCode()

    // 保存验证码到数据库中

    await pool.execute(
      'INSERT INTO verify_codes (email, verify_code, created_at) VALUES (?, ?, NOW())',
      [email, verifyCode],
    )

    // 发送邮件
    await sendVerifyCodeEmail(email, verifyCode)

    res.send({ status: 'Success', message: '验证码已发送' })
  }
  catch (error) {
    res.send({ status: 'Fail', message: error.message, data: null })
  }
})

router.post('/redeem', async (req, res) => {
  try {
    // 从请求头中获取 JWT Token，并解码得到用户ID
    const authHeader = req.headers.authorization
    if (!authHeader)
      throw new Error('Please authenticate.')

    const token = authHeader.split(' ')[1]

    if (!token)
      throw new Error('Invalid token')

    const decoded = await jwt.verify(token, process.env.AUTH_SECRET_KEY)
    const userId = decoded.userId

    // 从请求体中获取优惠码
    const { couponCode } = req.body

    // 调用 redeemCoupon 函数来兑换优惠码
    const result = await redeemCoupon(userId, couponCode)

    // 返回成功响应
    res.send({
      status: 'Success',
      message: '优惠券兑换成功',
      remainingUsageCount: result.remainingUsageCount,
      newUsageLimit: result.newUsageLimit,
    })
  }
  catch (error) {
    res.send({ status: 'Fail', message: error.message, data: null })
  }
})
router.post('/userkey', async (req, res) => {
  const { userkeye } = req.body
  const authHeader = req.headers.authorization
  if (!authHeader)
    throw new Error('Please authenticate.')

  const token = authHeader.split(' ')[1]

  if (!token)
    throw new Error('Invalid token')

  const decoded = await jwt.verify(token, process.env.AUTH_SECRET_KEY)
  const userId = decoded.userId

  try {
    // 更新用户的 API Key
    await pool.query('UPDATE users SET apikey = ? WHERE id = ?', [userkeye, userId])

    // 返回更新结果
    res.send({ status: 'Success', message: 'apikey保存成功', data: userkeye })
  }
  catch (error) {
    // 返回错误信息
    res.send({ status: 'Fail', message: error.message, data: null })
  }
})
// router.post('/redeem', async (req, res) => {
//   try {
//     // 从请求头中获取 JWT Token，并解码得到用户ID
//     const authHeader = req.headers.authorization
//     if (!authHeader)
//       throw new Error('Please authenticate.')

//     const token = authHeader.split(' ')[1]
//     if (!token)
//       throw new Error('Invalid token')

//     const decoded = await jwt.verify(token, process.env.AUTH_SECRET_KEY)
//     const userId = decoded.userId

//     // 从请求体中获取优惠码
//     const { couponCode } = req.body

//     // 调用 redeemCoupon 函数来兑换优惠码
//     const result = await redeemCoupon(userId, couponCode)

//     // 返回成功响应
//     res.send({
//       message: '优惠券兑换成功',
//       remainingUsageCount: result.remainingUsageCount,
//       newUsageLimit: result.newUsageLimit,
//     })
//   }
//   catch (error) {
//     res.send({ status: 'Fail', message: error.message, data: null })
//   }
// })
async function redeemCoupon(userId, couponCode) {
  // 从数据库中查询优惠码
  const [rows] = await pool.execute(
    'SELECT * FROM coupon_codes WHERE coupon_code = ? AND is_used = 0',
    [couponCode],
  )
  const coupon = rows[0]
  if (!coupon)
    throw new Error('无效的优惠码')

  // 获取用户信息
  const [userRows] = await pool.execute(
    'SELECT usage_count, usage_limit FROM users WHERE id = ?',
    [userId],
  )
  const user = userRows[0]
  if (!user)
    throw new Error('未找到用户')

  // 计算当前使用次数和总使用次数
  const currentUsageCount = user.usage_count || 0
  const totalUsageCount = user.usage_limit || process.env.USAGE_LIMIT

  const remainingUsageCount = totalUsageCount - currentUsageCount

  // 根据优惠码的面值更新用户表中的 usage_limit 字段
  const newUsageLimit = parseInt(coupon.coupon_value, 10) + (user.usage_limit || 0)
  await pool.execute(
    'UPDATE users SET usage_limit = ? WHERE id = ?',
    [newUsageLimit, userId],
  )

  // 标记优惠码为已使用
  await pool.execute(
    'UPDATE coupon_codes SET is_used = 1 WHERE id = ?',
    [coupon.id],
  )

  // 增加用户的使用次数
  await pool.execute(
    'UPDATE users SET usage_count = ? WHERE id = ?',
    [currentUsageCount + 1, userId],
  )

  // 返回剩余使用次数和新的 usage_limit 值
  return {
    remainingUsageCount,
    newUsageLimit,
  }
}
app.use('', router)
app.use('/api', router)
app.set('trust proxy', 1)

app.listen(3002, () => globalThis.console.log('Server is running on port 3002'))
