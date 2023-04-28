<script setup lang='ts'>
import { computed, ref } from 'vue'
import { NButton, NModal, useMessage } from 'naive-ui'
import { fetchlogo, fetchregister, sendVerifyEmail } from '@/api'
import { useAuthStore, useUserStore } from '@/store'
import type { UserInfo } from '@/store/modules/user/helper'

interface Props {
  visible: boolean

}

defineProps<Props>()

const authStore = useAuthStore()

const ms = useMessage()

const loading = ref(false)

const email = ref('')
const password = ref('')
const confirmPassword = ref('')
const verifyCode = ref('')
const message = ref('')
const codeloading = computed(() => !email.value.trim() || !password.value.trim())

// const disabled = computed(() => !email.value.trim() || !password.value.trim() || (confirmPassword.value && password.value !== confirmPassword.value) || loading.value)

const showLogin = ref(true)
const codeLogin = ref(true)
function toggleComponent() {
  showLogin.value = !showLogin.value
  codeLogin.value = !codeLogin.value
  email.value = ''
  password.value = ''
  confirmPassword.value = ''
  verifyCode.value = ''
  message.value = ''
}
interface Response {
  response: string
  token: string
  email: string
  usage_limit: string
  usage_count: string
  verifyCode: string
  username: string
  key: string
}
let codeSent = false
const timer = ref(0)
const buttonText = ref('发送验证码')
async function handleSendVerifyCode() {
  const usernameValue = email.value.trim()

  // 判断邮箱地址是否为空
  if (!usernameValue) {
    ms.warning('请输入邮箱地址')
    return
  }

  try {
    loading.value = true
    const emailCode = { email: usernameValue }
    // 发送验证码请求
    await sendVerifyEmail(emailCode)
    timer.value = 60
    const intervalId = setInterval(() => {
      if (timer.value > 0) {
        timer.value--
        loading.value = true
        buttonText.value = `${timer.value}s 后重新发送`
      }
      else {
        clearInterval(intervalId)
        buttonText.value = '发送验证码'
        loading.value = false
      }
    }, 1000)
    codeSent = true // 设置 codeSent 为 true，表示验证码已成功发送
    // 显示发送成功的提示

    ms.success('验证码已发送，请注意查收')
    message.value = '验证码已发送，请注意查收'
    loading.value = true
  }
  catch (error: any) {
    // 显示发送失败的提示
    ms.error(error.message || '发送失败')
    message.value = error.message
  }
  finally {
    loading.value = false
  }
}

const userStore = useUserStore()
const userInfo = computed(() => userStore.userInfo)
function updateUserInfo(options: Partial<UserInfo>) {
  userStore.updateUserInfo(options)
}

async function handleSubmit(isLogin: boolean) {
  const usernameValue = email.value.trim()
  const passwordValue = password.value.trim()
  const verifyCodeValue = verifyCode.value.trim()

  if (!usernameValue || !passwordValue)
    return

  try {
    loading.value = true

    const data = { email: usernameValue, password: passwordValue }
    const Code = { email: usernameValue, password: passwordValue, verifyCode: verifyCodeValue }

    const response = isLogin ? await fetchlogo<Response>(data) : await fetchregister<Response>(Code)

    const token = response.token
    const email = response.email
    const usage_limit = response.usage_limit
    const usage_count = response.usage_count
    const key = response.key

    authStore.setkey(key)
    authStore.setToken(token)
    authStore.setUsername(email)
    authStore.setUserlimit(usage_limit)
    authStore.setUsercount(usage_count)

    ms.success(isLogin ? '登录成功!' : '注册成功!')

    // window.location.reload()
    const updateDescription = () => {
      // 将 usageCount 的值转换为字符串，并赋值给 userInfo.description
      userInfo.value.description = String(usage_count)
      userInfo.value.kcishu = String(usage_limit)
      userInfo.value.name = String(email)

      // 调用 updateUserInfo 方法，将新的用户信息传递进去
      // const usagelimi = (parseInt(userInfo.value.description, 10) - parseInt(userInfo.value.kcishu, 10)).toString()
      updateUserInfo({ name: userInfo.value.name })
      updateUserInfo({ description: userInfo.value.description })
      updateUserInfo({ kcishu: userInfo.value.kcishu })
    }
    updateDescription()
  }
  catch (error: any) {
    ms.error(error.message || (isLogin ? '登录失败!' : '注册失败!'))
    authStore.removeToken()
  }
  finally {
    loading.value = false

    password.value = ''
    confirmPassword.value = ''
  }
}
</script>

<template>
  <NModal :show="visible" style="width: 90%; max-width: 640px">
    <div class="p-10 bg-white rounded dark:bg-slate-800">
      <div class="space-y-4">
        <header class="flex items-center justify-between space-x-6">
          <h2 class="text-2xl font-bold text-center text-slate-800 dark:text-neutral-200">
            {{ showLogin ? '登录' : '注册' }}
          </h2>
          <NButton size="small" @click="toggleComponent">
            {{ showLogin ? '注册' : '登录' }}
          </NButton>
        </header>
        <div>
          <div class="mb-4">
            <label for="email" class="block text-gray-700 font-bold mb-2">邮箱</label>
            <input id="email" v-model="email" type="text" name="email" class="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline">
            <span v-if="message">{{ message }}</span>
          </div>
          <div v-if="!showLogin">
            <div class="mb-4">
              <label for="verifyCode" class="block text-gray-700 font-bold mb-2">验证码</label>
              <input id="verifyCode" v-model="verifyCode" type="text" name="verifyCode" class="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline">
            </div>
            <NButton
              size="small"
              :disabled="!email.trim() || loading"
              :code-sent="codeSent"
              @click="handleSendVerifyCode"
            >
              <div>
                {{ buttonText }}
              </div>
            </NButton>
          </div>
          <div class="mb-6">
            <label for="password" class="block text-gray-700 font-bold mb-2">密码</label>
            <input id="password" v-model="password" type="password" name="password" class="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline">
          </div>
          <div v-if="!showLogin" class="mb-6">
            <label for="confirmPassword" class="block text-gray-700 font-bold mb-2">确认密码</label>
            <input id="confirmPassword" v-model="confirmPassword" type="password" name="confirmPassword" class="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline">
          </div>
          <NButton
            block
            type="primary"
            :disabled="codeloading"
            :codeloading="codeloading"
            @click="handleSubmit(showLogin)"
          >
            {{ showLogin ? '登录' : '注册' }}
          </NButton>
        </div>
      </div>
    </div>
  </NModal>
</template>
