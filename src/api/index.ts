import type { AxiosProgressEvent, GenericAbortSignal } from 'axios'

import { post } from '@/utils/request'
import { useAuthStore, useSettingStore } from '@/store'

export function fetchChatAPI<T = any>(
  prompt: string,
  options?: { conversationId?: string; parentMessageId?: string },
  signal?: GenericAbortSignal,
) {
  return post<T>({
    url: '/chat',
    data: { prompt, options },
    signal,
  })
}

export function fetchChatConfig<T = any>() {
  return post<T>({
    url: '/config',
  })
}
const email: string = localStorage.getItem('email')?.trim() ?? '123'
export function fetchChatAPIProcess<T = any>(
  params: {
    prompt: string
    options?: { conversationId?: string; parentMessageId?: string }
    signal?: GenericAbortSignal
    onDownloadProgress?: (progressEvent: AxiosProgressEvent) => void },
) {
  const settingStore = useSettingStore()
  const authStore = useAuthStore()

  let data: Record<string, any> = {
    prompt: params.prompt,
    options: params.options,
    email,
  }

  if (authStore.isChatGPTAPI) {
    data = {
      ...data,
      systemMessage: settingStore.systemMessage,
      temperature: settingStore.temperature,
      top_p: settingStore.top_p,
    }
  }

  return post<T>({
    url: '/chat-process',
    data,
    signal: params.signal,
    onDownloadProgress: params.onDownloadProgress,
  })
}

export function fetchSession<T>() {
  return post<T>({
    url: '/session',

  })
}

export function fetchVerify<T>(token: string) {
  return post<T>({
    url: '/verify',
    data: { token },
  })
}
interface LoginData {
  email: string
  password: string

}

interface RegisterData {
  verifyCode: string
  password: string
  email: string

}

export function fetchlogo<T = string >(data: LoginData) {
  return post<T>({
    url: '/login',

    data,
  })
}
export function fetchregister<T = string>(data: RegisterData) {
  return post<T>({
    url: '/register',

    data,
  })
}
interface SendVerifyEmailData {
  email: string

}
export function sendVerifyEmail<T>(data: SendVerifyEmailData) {
  return post<T>({
    url: '/send-verify-code',
    data,
  })
}
interface aredeemData {
  couponCode: string

}

export function aredeem<T = any>(data: aredeemData) {
  return post<T>({
    url: '/redeem',

    data,
  })
}
interface userkeyy {
  userkeye: string

}
export function userkey<T = any>(data: userkeyy) {
  return post<T>({
    url: '/userkey',

    data,
  })
}
