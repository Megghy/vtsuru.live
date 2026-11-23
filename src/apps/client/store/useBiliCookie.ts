import { debug, error, info, warn } from '@tauri-apps/plugin-log'
import { acceptHMRUpdate, defineStore } from 'pinia'
import { computed, ref, shallowRef, watch } from 'vue'

import { usePersistedStorage, whenPersistedReady } from '@/shared/storage/persist'

import type { BiliUserProfile } from '../data/models'
import { refreshBiliCookieAsync } from '../data/cookieRefresh'
import { QueryBiliAPI } from '../data/utils'
import type { CookieCloudConfig, CookieCloudCookie, CookieCloudExportData } from '../utils/cookieCloud'
import { fetchBiliCookieFromCloud } from '../utils/cookieCloud'
import { useBiliAccountManager } from './useBiliAccountManager'
import { useTauriStore } from './useTauriStore'

export type { CookieCloudConfig, CookieCloudCookie, CookieCloudExportData }

export const BILI_COOKIE_KEY = 'user.bilibili.cookie'
export const COOKIE_CLOUD_KEY = 'user.bilibili.cookie_cloud'
export const USER_INFO_CACHE_KEY = 'cache.bilibili.userInfo'

const CLOUD_SYNC_INTERVAL = 10 * 60 * 1000 // 每 10 分钟同步一次 CookieCloud
const USER_INFO_CACHE_DURATION = 5 * 60 * 1000

interface BiliCookieStoreData {
  cookie: string
  refreshToken?: string
  lastRefresh?: Date
}

interface UserInfoCache {
  userInfo: BiliUserProfile
  accessedAt: number
}

type CookieCloudState = 'unset' | 'valid' | 'invalid' | 'syncing'

/**
 * 主账号 B站 Cookie 适配层：
 * - 与 useBiliAccountManager.mainAccount 保持单一真源联动
 * - 不再单独跑 60s 有效性轮询（由 useBiliAccountManager 统一执行）
 * - 负责主账号 CookieCloud 定时同步与向下兼容历史接口
 */
export const useBiliCookie = defineStore('biliCookie', () => {
  const accountManager = useBiliAccountManager()
  const biliCookieStore = usePersistedStorage<BiliCookieStoreData>(BILI_COOKIE_KEY, {
    cookie: '',
    refreshToken: undefined,
    lastRefresh: new Date(0),
  })
  const cookieCloudStore = useTauriStore().getTarget<CookieCloudConfig>(COOKIE_CLOUD_KEY)
  const userInfoCacheStore = useTauriStore().getTarget<UserInfoCache>(USER_INFO_CACHE_KEY)

  const _cachedUserInfo = shallowRef<UserInfoCache | undefined>()
  const _fallbackHasCookie = ref(false)
  const _fallbackValid = ref(false)
  const cookieCloudState = ref<CookieCloudState>('unset')

  let _isInitialized = false
  let _cloudSyncIntervalId: ReturnType<typeof setInterval> | null = null

  const activeMainAccount = computed(() => accountManager.mainAccount)

  const cookie = computed(() => activeMainAccount.value?.cookie || biliCookieStore.value?.cookie || undefined)
  const hasBiliCookie = computed(() => Boolean(activeMainAccount.value?.cookie || _fallbackHasCookie.value))
  const isCookieValid = computed(() => {
    if (activeMainAccount.value) {
      return activeMainAccount.value.isValid
    }
    return _fallbackValid.value
  })
  const uId = computed(() => activeMainAccount.value?.mid ?? _cachedUserInfo.value?.userInfo.mid)
  const userInfo = computed<BiliUserProfile | undefined>(() => {
    if (_cachedUserInfo.value?.userInfo) {
      return _cachedUserInfo.value.userInfo
    }
    const acc = activeMainAccount.value
    if (!acc) return undefined
    return {
      mid: acc.mid,
      name: acc.name,
      face: acc.face,
    } as BiliUserProfile
  })

  // 当账号池切换或刷新主账号时，保持 legacy cookie 存储一致
  watch(activeMainAccount, (acc) => {
    if (acc?.cookie && biliCookieStore.value?.cookie !== acc.cookie) {
      biliCookieStore.value = {
        cookie: acc.cookie,
        ...(acc.refreshToken ? { refreshToken: acc.refreshToken } : {}),
        lastRefresh: new Date(),
      }
      _fallbackHasCookie.value = true
      _fallbackValid.value = acc.isValid
    }
  })

  const _updateUserInfoCache = async (data: BiliUserProfile): Promise<void> => {
    const cacheData: UserInfoCache = { userInfo: data, accessedAt: Date.now() }
    _cachedUserInfo.value = cacheData
    try {
      await userInfoCacheStore.set(cacheData)
    } catch (err) {
      error(`[BiliCookie] 持久化用户信息缓存失败: ${String(err)}`)
    }
  }

  const _clearUserInfoCache = async (): Promise<void> => {
    _cachedUserInfo.value = undefined
    try {
      await userInfoCacheStore.delete()
    } catch (err) {
      error(`[BiliCookie] 清除持久化用户信息缓存失败: ${String(err)}`)
    }
  }

  const _checkCookieValidity = async (rawCookie: string): Promise<{ valid: boolean; data?: BiliUserProfile }> => {
    if (!rawCookie) return { valid: false }
    try {
      const resp = await QueryBiliAPI('https://api.bilibili.com/x/space/myinfo', 'GET', rawCookie)
      const json = await resp.json()
      if (json.code === 0 && json.data) {
        await _updateUserInfoCache(json.data)
        return { valid: true, data: json.data }
      }
      warn(`[BiliCookie] Cookie 验证失败: ${json.message || `code: ${json.code}`}`)
      return { valid: false }
    } catch (err) {
      error(`[BiliCookie] 验证 Cookie 请求出错: ${String(err)}`)
      return { valid: false }
    }
  }

  const _syncFromCookieCloud = async (): Promise<boolean> => {
    const config = await cookieCloudStore.get()
    if (!config?.key || !config?.password) {
      if (cookieCloudState.value !== 'unset') {
        cookieCloudState.value = 'invalid'
      }
      return false
    }

    cookieCloudState.value = 'syncing'
    try {
      const cookieString = await fetchBiliCookieFromCloud(config)
      const validation = await _checkCookieValidity(cookieString)
      if (!validation.valid) {
        warn('[BiliCookie] 从 CookieCloud 获取的 Cookie 无效')
        cookieCloudState.value = 'invalid'
        _fallbackValid.value = false
        return false
      }
      await setBiliCookie(cookieString)
      cookieCloudState.value = 'valid'
      info('[BiliCookie] 从 CookieCloud 同步并验证 Cookie 成功')
      return true
    } catch (err) {
      error(`[BiliCookie] CookieCloud 同步失败: ${String(err)}`)
      cookieCloudState.value = 'invalid'
      return false
    }
  }

  const init = async (): Promise<void> => {
    if (_isInitialized) {
      debug('[BiliCookie] Store 已初始化，跳过')
      return
    }
    _isInitialized = true
    info('[BiliCookie] Store 初始化开始...')

    await Promise.all([whenPersistedReady(biliCookieStore), accountManager.init()])
    const [storedCloudConfig, storedUserInfo] = await Promise.all([cookieCloudStore.get(), userInfoCacheStore.get()])

    cookieCloudState.value = storedCloudConfig?.key && storedCloudConfig?.password ? 'valid' : 'unset'

    if (storedUserInfo && Date.now() - storedUserInfo.accessedAt < USER_INFO_CACHE_DURATION) {
      _cachedUserInfo.value = storedUserInfo
    } else if (storedUserInfo) {
      await _clearUserInfoCache()
    }

    const legacyCookie = biliCookieStore.value?.cookie
    _fallbackHasCookie.value = Boolean(legacyCookie)

    // 兼容迁移：旧版本只有 biliCookieStore 且账号池为空时，自动导入为主账号
    if (legacyCookie && accountManager.accounts.length === 0) {
      try {
        const added = await accountManager.addOrUpdateAccount(
          legacyCookie,
          biliCookieStore.value?.refreshToken,
          '主播大号',
        )
        await accountManager.setMainAccount(added.id)
        _fallbackValid.value = true
      } catch {
        _fallbackValid.value = false
      }
    } else if (activeMainAccount.value) {
      _fallbackValid.value = activeMainAccount.value.isValid
    }

    if (_cloudSyncIntervalId) clearInterval(_cloudSyncIntervalId)
    _cloudSyncIntervalId = setInterval(() => {
      if (cookieCloudState.value !== 'unset' && cookieCloudState.value !== 'syncing') {
        void _syncFromCookieCloud()
      }
    }, CLOUD_SYNC_INTERVAL)

    // 首次初始化时若配置了 CookieCloud 则同步一次
    if (cookieCloudState.value === 'valid') {
      await _syncFromCookieCloud()
    }

    info('[BiliCookie] Store 初始化完成')
  }

  const check = async (forceCheckCloud: boolean = false): Promise<void> => {
    if (forceCheckCloud && cookieCloudState.value !== 'unset' && cookieCloudState.value !== 'syncing') {
      const synced = await _syncFromCookieCloud()
      if (synced) return
    }

    if (activeMainAccount.value) {
      const valid = await accountManager.checkAccount(activeMainAccount.value.id)
      _fallbackValid.value = valid
      if (valid) {
        await _checkCookieValidity(activeMainAccount.value.cookie)
      }
      return
    }

    const storedCookie = biliCookieStore.value?.cookie
    if (storedCookie) {
      const { valid } = await _checkCookieValidity(storedCookie)
      _fallbackHasCookie.value = true
      _fallbackValid.value = valid
    } else {
      _fallbackHasCookie.value = false
      _fallbackValid.value = false
    }
  }

  const setBiliCookie = async (rawCookie: string, refreshToken?: string): Promise<void> => {
    info('[BiliCookie] 正在设置新的 Bilibili Cookie...')
    const { valid } = await _checkCookieValidity(rawCookie)
    if (!valid) {
      _fallbackValid.value = false
      warn('[BiliCookie] 尝试设置的 Bilibili Cookie 无效，未保存')
      throw new Error('该 Cookie 无法通过 B 站 API 验证，请检查后重试')
    }

    biliCookieStore.value = {
      cookie: rawCookie,
      ...(refreshToken ? { refreshToken } : {}),
      lastRefresh: new Date(),
    }
    _fallbackHasCookie.value = true
    _fallbackValid.value = true

    const added = await accountManager.addOrUpdateAccount(rawCookie, refreshToken, '主播大号')
    await accountManager.setMainAccount(added.id)
    info('[BiliCookie] 新 Bilibili Cookie 已验证并同步到主账号')
  }

  const getBiliCookie = async (): Promise<string | undefined> => {
    return cookie.value
  }

  const logout = async (): Promise<void> => {
    info('[BiliCookie] 用户请求退出登录...')
    if (_cloudSyncIntervalId) {
      clearInterval(_cloudSyncIntervalId)
      _cloudSyncIntervalId = null
    }
    const mainId = activeMainAccount.value?.id
    if (mainId) {
      await accountManager.removeAccount(mainId)
    }
    biliCookieStore.value = undefined
    await _clearUserInfoCache()
    _fallbackHasCookie.value = false
    _fallbackValid.value = false
    _isInitialized = false
    info('[BiliCookie] 退出登录完成，主账号与缓存已同步清理')
  }

  const setCookieCloudConfig = async (config: CookieCloudConfig): Promise<void> => {
    info('[BiliCookie] 正在设置新的 CookieCloud 配置...')
    cookieCloudState.value = 'syncing'
    try {
      const cookieString = await fetchBiliCookieFromCloud(config)
      const validation = await _checkCookieValidity(cookieString)
      if (!validation.valid || !validation.data) {
        cookieCloudState.value = 'invalid'
        throw new Error('CookieCloud 配置无效：获取到的 Bilibili Cookie 无法通过验证')
      }
      await cookieCloudStore.set(config)
      cookieCloudState.value = 'valid'
      await setBiliCookie(cookieString)
      info(`[BiliCookie] CookieCloud 配置已保存并同步. 用户:${validation.data.name}`)
    } catch (err) {
      error(`[BiliCookie] 设置 CookieCloud 配置失败: ${String(err)}`)
      cookieCloudState.value = 'invalid'
      throw err
    }
  }

  async function clearCookieCloudConfig() {
    info('[BiliCookie] 清除 CookieCloud 配置...')
    cookieCloudState.value = 'unset'
    await cookieCloudStore.delete().catch((err) => {
      error(`[BiliCookie] 清除 CookieCloud 配置失败: ${String(err)}`)
    })
  }

  return {
    hasBiliCookie,
    isCookieValid,
    cookieCloudState: computed(() => cookieCloudState.value),
    uId,
    userInfo,
    cookie,

    init,
    check,
    setBiliCookie,
    getBiliCookie,
    refreshCookieIfNeeded: async (force = false): Promise<boolean> => {
      if (activeMainAccount.value) {
        return accountManager.refreshAccountIfNeeded(activeMainAccount.value.id, force)
      }
      const storedCookie = biliCookieStore.value?.cookie
      const storedRefreshToken = biliCookieStore.value?.refreshToken
      if (!storedCookie || !storedRefreshToken) return false
      const res = await refreshBiliCookieAsync(storedCookie, storedRefreshToken, force)
      if (res.success && res.refreshed && res.newCookie && res.newRefreshToken) {
        await setBiliCookie(res.newCookie, res.newRefreshToken)
        return true
      }
      return false
    },
    logout,
    setCookieCloudConfig,
    clearCookieCloudConfig,
  }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useBiliCookie, import.meta.hot))
}
