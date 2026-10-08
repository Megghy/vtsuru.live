import { fetch as tauriFetch } from '@tauri-apps/plugin-http'
import { debug, error, info } from '@tauri-apps/plugin-log'
import { AES, enc, MD5 } from 'crypto-js'
import { acceptHMRUpdate, defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { usePersistedStorage } from '@/shared/storage/persist'

import type { BiliUserProfile } from '../data/models'
import { QueryBiliAPI } from '../data/utils'
import type { CookieCloudConfig, CookieCloudExportData } from './useBiliCookie'
import { useTauriStore } from './useTauriStore'

// --- 类型定义 ---

export interface BiliAccountItem {
  id: string // 唯一标识，通常为字符串 UID: `${mid}`
  mid: number // B 站 UID
  name: string // 昵称
  face: string // 头像 URL
  cookie: string // 完整 Cookie 字符串
  refreshToken?: string
  isValid: boolean // Cookie 是否有效
  alias?: string // 用户自定义备注（如 "房管机器人", "主播大号"）
  lastCheckedAt: number // 上次检查时间戳
  addedAt: number // 添加时间戳
}

export interface AccountRoutingConfig {
  mainAccountId: string // 用于直播管理/房管的主账号 ID
  danmakuAccountId: string // 用于自动操作发弹幕/私信的账号 ID ('main' 表示跟随主账号，或指定具体 accountId)
  fallbackToMain: boolean // 当指定的发弹幕账号失效时，是否自动回退到主账号
}

// 持久化存储 Key
export const BILI_ACCOUNTS_POOL_KEY = 'user.bilibili.accounts_pool'
export const BILI_ACCOUNT_ROUTING_KEY = 'user.bilibili.account_routing'
export const BILI_MULTI_COOKIE_CLOUD_KEY = 'user.bilibili.multi_cookie_cloud'

const REGULAR_CHECK_INTERVAL = 60 * 1000 // 每分钟轮询一次各账号有效性

export const useBiliAccountManager = defineStore('biliAccountManager', () => {
  // 1. 持久化存储
  const accountsStore = usePersistedStorage<BiliAccountItem[]>(BILI_ACCOUNTS_POOL_KEY, [])
  const routingStore = usePersistedStorage<AccountRoutingConfig>(BILI_ACCOUNT_ROUTING_KEY, {
    mainAccountId: '',
    danmakuAccountId: 'main',
    fallbackToMain: true,
  })
  const cookieCloudStore = useTauriStore().getTarget<CookieCloudConfig>(BILI_MULTI_COOKIE_CLOUD_KEY, {
    host: 'https://cookie.vtsuru.live',
    key: '',
    password: '',
  })

  // 2. 状态
  const accounts = ref<BiliAccountItem[]>([])
  const routing = ref<AccountRoutingConfig>({
    mainAccountId: '',
    danmakuAccountId: 'main',
    fallbackToMain: true,
  })

  let _isInitialized = false
  let _checkIntervalId: ReturnType<typeof setInterval> | null = null

  // 3. 计算属性

  // 主账号（直播管理/房管）
  const mainAccount = computed<BiliAccountItem | undefined>(() => {
    if (!routing.value.mainAccountId && accounts.value.length > 0) {
      return accounts.value[0]
    }
    return accounts.value.find((acc) => acc.id === routing.value.mainAccountId) || accounts.value[0]
  })

  // 自动发弹幕专用账号
  const danmakuAccount = computed<BiliAccountItem | undefined>(() => {
    if (routing.value.danmakuAccountId === 'main' || !routing.value.danmakuAccountId) {
      return mainAccount.value
    }
    const target = accounts.value.find((acc) => acc.id === routing.value.danmakuAccountId)
    if (target && target.isValid) {
      return target
    }
    // 若指定小号失效且允许回退，则回退主账号
    if (routing.value.fallbackToMain) {
      return mainAccount.value
    }
    return target || mainAccount.value
  })

  // 当前实际用于发弹幕的有效凭证
  const activeDanmakuCookie = computed(() => danmakuAccount.value?.cookie || '')
  const activeDanmakuUid = computed(() => danmakuAccount.value?.mid || 0)
  const activeDanmakuCsrf = computed(() => {
    const c = activeDanmakuCookie.value
    if (!c) return null
    const match = c.match(/bili_jct=([^;]+)/)
    return match ? match[1] : null
  })

  // 4. 工具方法与 API 校验

  const checkCookieValidity = async (cookie: string): Promise<{ valid: boolean; data?: BiliUserProfile }> => {
    if (!cookie) return { valid: false }
    try {
      const resp = await QueryBiliAPI('https://api.bilibili.com/x/space/myinfo', 'GET', cookie)
      const json = await resp.json()
      if (json.code === 0 && json.data) {
        return { valid: true, data: json.data }
      }
      return { valid: false }
    } catch (err) {
      error(`[AccountManager] 检查 Cookie 失败: ${String(err)}`)
      return { valid: false }
    }
  }

  // 5. 账号管理操作

  /**
   * 添加或更新账号
   */
  const addOrUpdateAccount = async (
    cookie: string,
    refreshToken?: string,
    alias?: string,
  ): Promise<BiliAccountItem> => {
    info('[AccountManager] 正在验证并添加新账号...')
    const { valid, data } = await checkCookieValidity(cookie)
    if (!valid || !data) {
      throw new Error('该 Cookie 无法通过 B 站 API 验证')
    }

    const accountId = `${data.mid}`
    const existingIndex = accounts.value.findIndex((acc) => acc.id === accountId)

    const accountItem: BiliAccountItem = {
      id: accountId,
      mid: data.mid,
      name: data.name,
      face: data.face,
      cookie,
      refreshToken: refreshToken || (existingIndex >= 0 ? accounts.value[existingIndex].refreshToken : undefined),
      isValid: true,
      alias: alias || (existingIndex >= 0 ? accounts.value[existingIndex].alias : undefined),
      lastCheckedAt: Date.now(),
      addedAt: existingIndex >= 0 ? accounts.value[existingIndex].addedAt : Date.now(),
    }

    if (existingIndex >= 0) {
      accounts.value[existingIndex] = accountItem
    } else {
      accounts.value.push(accountItem)
      // 如果是第一个添加的账号，自动设为主账号
      if (accounts.value.length === 1) {
        routing.value.mainAccountId = accountId
      }
    }

    await saveState()
    info(`[AccountManager] 账号 [${data.name}] (${accountId}) 保存成功`)
    return accountItem
  }

  /**
   * 删除账号
   */
  const removeAccount = async (id: string): Promise<void> => {
    accounts.value = accounts.value.filter((acc) => acc.id !== id)
    if (routing.value.mainAccountId === id) {
      routing.value.mainAccountId = accounts.value[0]?.id || ''
    }
    if (routing.value.danmakuAccountId === id) {
      routing.value.danmakuAccountId = 'main'
    }
    await saveState()
    info(`[AccountManager] 账号 ${id} 已移除`)
  }

  /**
   * 修改备注别名
   */
  const updateAccountAlias = async (id: string, alias: string): Promise<void> => {
    const acc = accounts.value.find((a) => a.id === id)
    if (acc) {
      acc.alias = alias
      await saveState()
    }
  }

  /**
   * 设置主账号（主管直播）
   */
  const setMainAccount = async (id: string): Promise<void> => {
    if (accounts.value.some((a) => a.id === id)) {
      routing.value.mainAccountId = id
      await saveState()
      info(`[AccountManager] 已将主账号切换为: ${id}`)
    }
  }

  /**
   * 设置自动发弹幕账号（'main' 或指定具体 accountId）
   */
  const setDanmakuAccount = async (id: string): Promise<void> => {
    if (id === 'main' || accounts.value.some((a) => a.id === id)) {
      routing.value.danmakuAccountId = id
      await saveState()
      info(`[AccountManager] 已将发弹幕账号切换为: ${id}`)
    }
  }

  /**
   * 设置回退策略
   */
  const setFallbackToMain = async (fallback: boolean): Promise<void> => {
    routing.value.fallbackToMain = fallback
    await saveState()
  }

  /**
   * 检查单个账号有效性
   */
  const checkAccount = async (id: string): Promise<boolean> => {
    const acc = accounts.value.find((a) => a.id === id)
    if (!acc) return false
    const { valid, data } = await checkCookieValidity(acc.cookie)
    acc.isValid = valid
    acc.lastCheckedAt = Date.now()
    if (valid && data) {
      acc.name = data.name
      acc.face = data.face
    }
    await saveState()
    return valid
  }

  /**
   * 检查所有账号有效性
   */
  const checkAllAccounts = async (): Promise<void> => {
    debug('[AccountManager] 批量检查账号有效性...')
    for (const acc of accounts.value) {
      const { valid, data } = await checkCookieValidity(acc.cookie)
      acc.isValid = valid
      acc.lastCheckedAt = Date.now()
      if (valid && data) {
        acc.name = data.name
        acc.face = data.face
      }
    }
    await saveState()
  }

  /**
   * 保存持久化状态
   */
  const saveState = async (): Promise<void> => {
    accountsStore.value = accounts.value
    routingStore.value = routing.value
  }

  // 6. CookieCloud 批量导入支持

  const importFromCookieCloud = async (config?: CookieCloudConfig): Promise<BiliAccountItem[]> => {
    const cloudConfig = config ?? (await cookieCloudStore.get())
    if (!cloudConfig?.key || !cloudConfig?.password) {
      throw new Error('CookieCloud 配置不完整')
    }

    const host = cloudConfig.host || 'https://cookie.vtsuru.live'
    const url = new URL(host)
    url.pathname = `/get/${cloudConfig.key}`

    info(`[AccountManager] 正在从 CookieCloud (${url.hostname}) 获取数据...`)

    const response = await tauriFetch(url.toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    })

    if (!response.ok) {
      throw new Error(`CookieCloud 请求失败: ${response.status}`)
    }

    const json = await response.json()
    let cookieString = ''

    if (json.encrypted) {
      const key = MD5(cloudConfig.key + '-' + cloudConfig.password)
        .toString()
        .substring(0, 16)
      const decrypted = AES.decrypt(json.cookie_data, enc.Utf8.parse(key), {
        iv: enc.Utf8.parse(key),
      }).toString(enc.Utf8)

      if (!decrypted) throw new Error('CookieCloud 解密失败，可能密码错误')
      const data: CookieCloudExportData = JSON.parse(decrypted)
      const biliCookies = data.cookie_data['bilibili.com'] || []
      cookieString = biliCookies.map((item: { name: string; value: string }) => `${item.name}=${item.value}`).join('; ')
    } else if (json.cookie_data) {
      const data = json as CookieCloudExportData
      const biliCookies = data.cookie_data['bilibili.com'] || []
      cookieString = biliCookies.map((item: { name: string; value: string }) => `${item.name}=${item.value}`).join('; ')
    }

    if (!cookieString) {
      throw new Error('未在 CookieCloud 中找到有效的 bilibili.com Cookie')
    }

    const item = await addOrUpdateAccount(cookieString)
    await cookieCloudStore.set(cloudConfig)
    return [item]
  }

  // 7. 初始化与定时检查

  const init = async (): Promise<void> => {
    if (_isInitialized) return
    _isInitialized = true
    info('[AccountManager] 初始化开始...')

    // 从存储加载账号列表与路由规则
    accounts.value = accountsStore.value || []
    routing.value = routingStore.value || {
      mainAccountId: '',
      danmakuAccountId: 'main',
      fallbackToMain: true,
    }

    // 容错校正
    if (accounts.value.length > 0 && !routing.value.mainAccountId) {
      routing.value.mainAccountId = accounts.value[0].id
    }

    // 首次启动时异步检查所有账号
    void checkAllAccounts()

    if (_checkIntervalId) clearInterval(_checkIntervalId)
    _checkIntervalId = setInterval(checkAllAccounts, REGULAR_CHECK_INTERVAL)

    info(`[AccountManager] 初始化完成，已加载 ${accounts.value.length} 个账号`)
  }

  return {
    accounts: computed(() => accounts.value),
    routing: computed(() => routing.value),
    mainAccount,
    danmakuAccount,
    activeDanmakuCookie,
    activeDanmakuUid,
    activeDanmakuCsrf,

    init,
    addOrUpdateAccount,
    removeAccount,
    updateAccountAlias,
    setMainAccount,
    setDanmakuAccount,
    setFallbackToMain,
    checkAccount,
    checkAllAccounts,
    importFromCookieCloud,
  }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useBiliAccountManager, import.meta.hot))
}
