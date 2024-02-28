import { QueryGetAPI, QueryPostAPI } from '@/api/query'
import { ACCOUNT_API_URL, VTSURU_API_URL } from '@/data/constants'
import { useLocalStorage } from '@vueuse/core'
import { isSameDay } from 'date-fns'
import { createDiscreteApi } from 'naive-ui'
import { ref } from 'vue'
import { APIRoot, AccountInfo, FunctionTypes } from './api-models'
import { useRoute } from 'vue-router'

export const ACCOUNT = ref<AccountInfo>({} as AccountInfo)
export const isLoadingAccount = ref(true)
const route = useRoute()

const { message } = createDiscreteApi(['message'])
const cookie = useLocalStorage('JWT_Token', '')
const cookieRefreshDate = useLocalStorage('JWT_Token_Last_Refresh', Date.now())

export async function GetSelfAccount() {
  if (cookie.value) {
    const result = await Self()
    if (result.code == 200) {
      ACCOUNT.value = result.data
      isLoadingAccount.value = false
      //console.log('[vtsuru] 已获取账户信息')
      if (!isSameDay(new Date(), cookieRefreshDate.value)) {
        refreshCookie()
      }
      return result.data
    } else if (result.code == 401) {
      localStorage.removeItem('JWT_Token')
      console.warn('[vtsuru] Cookie 已失效, 需要重新登陆')
      message.error('Cookie 已失效, 需要重新登陆')
      setTimeout(() => {
        location.reload()
      }, 1500)
    } else {
      console.warn('[vtsuru] ' + result.message)
      message.error(result.message)
    }
  }
  isLoadingAccount.value = false
}
export function UpdateAccountLoop() {
  setInterval(() => {
    if (ACCOUNT.value && route?.name != 'question-display') {
      // 防止在问题详情页刷新
      GetSelfAccount()
    }
  }, 60 * 1000)
}
function refreshCookie() {
  QueryPostAPI<string>(`${ACCOUNT_API_URL}refresh-token`).then((data) => {
    if (data.code == 200) {
      cookie.value = data.data
      cookieRefreshDate.value = Date.now()
      console.log('[vtsuru] 已刷新Cookie')
    }
  })
}
export async function SaveAccountSettings() {
  return await QueryPostAPI(ACCOUNT_API_URL + 'update-setting', ACCOUNT.value?.settings)
}
export async function SaveEnableFunctions(functions: FunctionTypes[]) {
  return await QueryPostAPI(ACCOUNT_API_URL + 'update-enable-functions', functions)
}
export function useAccount() {
  return ACCOUNT
}

export async function Register(name: string, email: string, password: string, token: string): Promise<APIRoot<string>> {
  return QueryPostAPI<string>(`${ACCOUNT_API_URL}register`, {
    name,
    email,
    password,
    token,
  })
}

export async function Login(nameOrEmail: string, password: string): Promise<APIRoot<string>> {
  return QueryPostAPI<string>(`${ACCOUNT_API_URL}login`, {
    nameOrEmail,
    password,
  })
}
export async function Self(): Promise<APIRoot<AccountInfo>> {
  return QueryPostAPI<AccountInfo>(`${ACCOUNT_API_URL}self`)
}
export async function AddBiliBlackList(id: number, name: string): Promise<APIRoot<unknown>> {
  return QueryGetAPI<AccountInfo>(`${ACCOUNT_API_URL}black-list/add-bili`, {
    id: id,
    name: name,
  })
}
export async function DelBiliBlackList(id: number): Promise<APIRoot<unknown>> {
  return QueryGetAPI<AccountInfo>(`${ACCOUNT_API_URL}black-list/del-bili`, {
    id: id,
  })
}
export function downloadConfigDirect(name: string) {
  return QueryGetAPI<string>(VTSURU_API_URL + 'get-config', {
    name: name,
  })
}
export async function DownloadConfig<T>(name: string) {
  try {
    const resp = await QueryGetAPI<string>(VTSURU_API_URL + 'get-config', {
      name: name,
    })
    if (resp.code == 200) {
      console.log('已获取配置文件: ' + name)
      return {
        msg: undefined,
        data: JSON.parse(resp.data) as T,
      }
    } else if (resp.code == 404) {
      console.error(`未找到名为 ${name} 的配置文件`)
      return {
        msg: `未找到名为 ${name} 的配置文件, 需要先上传`,
        data: undefined,
      }
    } else {
      console.error(`无法获取配置文件 [${name}]: ` + resp.message)
      return {
        msg: `无法获取配置文件 [${name}]: ` + resp.message,
        data: undefined,
      }
    }
  } catch (err) {
    console.error(`无法获取配置文件 [${name}]: ` + err)
    return {
      msg: `无法获取配置文件 [${name}]: ` + err,
      data: undefined,
    }
  }
}
export async function UploadConfig(name: string, data: unknown) {
  try {
    const resp = await QueryPostAPI(VTSURU_API_URL + 'set-config', {
      name: name,
      json: JSON.stringify(data),
    })
    if (resp.code == 200) {
      console.log('已保存配置文件至服务器:' + name)
      return true
    } else {
      console.error('保存失败: ' + resp.message)
    }
  } catch (err) {
    console.error(`保存配置文件失败: ` + err)
  }
  return false
}
export async function EnableFunction(func: FunctionTypes) {
  if (ACCOUNT.value) {
    if (ACCOUNT.value.settings.enableFunctions.includes(func)) {
      return true
    } else {
      ACCOUNT.value.settings.enableFunctions.push(func)
      if (await updateFunctionEnable()) {
        return true
      } else {
        ACCOUNT.value.settings.enableFunctions.splice(ACCOUNT.value.settings.enableFunctions.indexOf(func), 1)
        return false
      }
    }
  }
  return false
}
export async function DisableFunction(func: FunctionTypes) {
  if (ACCOUNT.value) {
    if (!ACCOUNT.value.settings.enableFunctions.includes(func)) {
      return true
    } else {
      ACCOUNT.value.settings.enableFunctions.splice(ACCOUNT.value.settings.enableFunctions.indexOf(func), 1)
      if (await updateFunctionEnable()) {
        return true
      } else {
        ACCOUNT.value.settings.enableFunctions.push(func)
        return false
      }
    }
  }
  return false
}
async function updateFunctionEnable() {
  if (ACCOUNT.value) {
    try {
      const data = await SaveEnableFunctions(ACCOUNT.value.settings.enableFunctions)
      if (data.code == 200) {
        return true
      } else {
        return false
      }
    } catch (err) {
      console.log(err)
      return false
    }
  }
}
