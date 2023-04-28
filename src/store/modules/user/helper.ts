import { ss } from '@/utils/storage'

const LOCAL_NAME = 'userStorage'

export interface UserInfo {
  avatar: string
  name: string
  description?: string
  kcishu: string
  userkeye: string

}
export interface UserInfoo {

  userkeye: string

}
export interface UserState {
  userInfo: UserInfo
}

export function defaultSetting(): UserState {
  const name: string = localStorage.getItem('email')?.trim() ?? '未登录'
  const cishu: string = localStorage.getItem('usage_count')?.trim() ?? '0'
  const kcishu: string = localStorage.getItem('usage_limit')?.trim() ?? '10'
  const userkeye: string = localStorage.getItem('userkeye')?.trim() ?? '1'
  const cck: number = parseInt(kcishu) - parseInt(cishu)
  return {
    userInfo: {
      avatar: '',
      name: `${name}`,
      description: `${cishu}`,
      kcishu: `${cck}`,
      userkeye: `${userkeye}`,
    },
  }
}
export function tuichudenglu(): UserState {
  return {
    userInfo: {
      avatar: '',
      name: '未登录',
      description: '0',
      kcishu: '0',
      userkeye: '',
    },
  }
}
export function getLocalState(): UserState {
  const localSetting: UserState | undefined = ss.get(LOCAL_NAME)
  return { ...tuichudenglu(), ...defaultSetting(), ...localSetting }
}

export function setLocalState(setting: UserState): void {
  ss.set(LOCAL_NAME, setting)
}
