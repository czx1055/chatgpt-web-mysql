import mysql from 'mysql2/promise'
import jwt from 'jsonwebtoken'
const pool = mysql.createPool({
  host: process.env.MYSQL_HOST,
  port: parseInt(process.env.MYSQL_PORT || '3306', 10),
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE,
  connectionLimit: parseInt(process.env.MYSQL_CONNECTION_LIMIT || '10', 10),
  multipleStatements: true,
})
const auth = async (req, res, next) => {
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
    const [rows] = await pool.query('SELECT usage_count, usage_limit, apikey FROM users WHERE id = ?', [userId])
    const usageCount = rows[0].usage_count
    // const usageLimit = rows[0].usage_limit || 10
    const userapikey = rows[0].apikey

    // 判断用户apikey是否等于1，如果等于1就增加使用次数，否则不增加
    // if (userapikey === '1' || '') {
    //   if (usageCount >= usageLimit)
    //     throw new Error('你已经超过了最大使用次数，请及时充值次数哦！')
    //   // await pool.query('UPDATE users SET usage_count = usage_count + 1 WHERE id = ?', [userId])
    // }

    // 将增加的使用次数传递给下一个中间件或者路由处理程序
    req.usageCount = userapikey === 1 ? usageCount + 1 : usageCount

    next()
  }
  catch (error) {
    res.send({ status: 'Unauthorized', message: error.message ?? 'Please authenticate.', data: null })
  }
}

export { auth, pool }
