import type { BiliUserProfile } from '../data/models'
import { fetch as tauriFetch } from '@tauri-apps/plugin-http'
import { debug, error, info, warn } from '@tauri-apps/plugin-log'
import { AES, enc, MD5 } from 'crypto-js'
import { acceptHMRUpdate, defineStore } from 'pinia'
import { computed, ref, shallowRef } from 'vue'
import { QueryBiliAPI } from '../data/utils'
import { useTauriStore } from './useTauriStore'

// --- 常量定义 ---
// Tauri Store 存储键名
export const BILI_COOKIE_KEY = 'user.bilibili.cookie'
export const COOKIE_CLOUD_KEY = 'user.bilibili.cookie_cloud'
export const USER_INFO_CACHE_KEY = 'cache.bilibili.userInfo'

// 检查周期 (毫秒)
const REGULAR_CHECK_INTERVAL = 60 * 1000 // 每分钟检查一次 Cookie 有效性
const CLOUD_SYNC_INTERVAL_CHECKS = 10 // 每 10 次常规检查后 (约 10 分钟) 同步一次 CookieCloud

// 用户信息缓存有效期 (毫秒)
const USER_INFO_CACHE_DURATION = 5 * 60 * 1000 // 缓存 5 分钟

// --- 类型定义 ---

// Bilibili Cookie 存储数据结构
interface BiliCookieStoreData {
  cookie: string
  refreshToken?: string // refreshToken 似乎未使用，设为可选
  lastRefresh?: Date // 上次刷新时间，似乎未使用，设为可选
}

// Cookie Cloud 配置数据结构
export interface CookieCloudConfig {
  key: string
  password: string
  host?: string // CookieCloud 服务地址，可选，有默认值
}

// CookieCloud 导出的 Cookie 单项结构
export interface CookieCloudCookie {
  domain: string
  expirationDate: number
  hostOnly: boolean
  httpOnly: boolean
  name: string
  path: string
  sameSite: string
  secure: boolean
  session: boolean
  storeId: string
  value: string
}

// CookieCloud 导出的完整数据结构
interface CookieCloudExportData {
  cookie_data: Record<string, CookieCloudCookie[]> // 按域名分组的 Cookie 数组
  local_storage_data?: Record<string, any> // 本地存储数据 (可选)
  update_time: string // 更新时间 ISO 8601 字符串
}

// 用户信息缓存结构
interface UserInfoCache {
  userInfo: BiliUserProfile
  accessedAt: number // 使用时间戳 (Date.now()) 以方便比较
}

// CookieCloud 状态类型
type CookieCloudState = 'unset' | 'valid' | 'invalid' | 'syncing'

// --- Store 定义 ---

export const useBiliCookie = defineStore('biliCookie', () => {
  // --- 依赖和持久化存储实例 ---
  // 使用 useTauriStore 获取持久化存储目标
  const biliCookieStore = useStorage<BiliCookieStoreData>(BILI_COOKIE_KEY, {
    cookie: '',
    refreshToken: undefined, // 可选，未使用
    lastRefresh: new Date(0), // 默认值
  }) // 为保持响应性
  const cookieCloudStore = useTauriStore().getTarget<CookieCloudConfig>(COOKIE_CLOUD_KEY)
  const userInfoCacheStore = useTauriStore().getTarget<UserInfoCache>(USER_INFO_CACHE_KEY)

  // --- 核心状态 ---
  // 使用 shallowRef 存储用户信息对象，避免不必要的深度侦听，提高性能
  const _cachedUserInfo = shallowRef<UserInfoCache | undefined>()
  // 是否已从存储加载了 Cookie (不代表有效)
  const hasBiliCookie = ref(false)
  // 当前 Cookie 是否通过 Bilibili API 验证有效
  const isCookieValid = ref(false)
  // CookieCloud 配置及同步状态
  const cookieCloudState = ref<CookieCloudState>('unset')
  // Bilibili 用户 ID
  const uId = ref<number | undefined>()

  // --- 计算属性 ---
  // 公开的用户信息，只读
  const userInfo = computed(() => _cachedUserInfo.value?.userInfo)

  // --- 内部状态和变量 ---
  let _isInitialized = false // 初始化标志，防止重复执行
  let _checkIntervalId: ReturnType<typeof setInterval> | null = null // 定时检查器 ID
  let _checkCounter = 0 // 常规检查计数器，用于触发 CookieCloud 同步

  // --- 私有辅助函数 ---

  /**
   * @description 更新并持久化用户信息缓存
   * @param data Bilibili 用户信息
   */
  const _updateUserInfoCache = async (data: BiliUserProfile): Promise<void> => {
    const cacheData: UserInfoCache = { userInfo: data, accessedAt: Date.now() }
    _cachedUserInfo.value = cacheData // 更新内存缓存
    uId.value = data.mid // 更新 uId
    try {
      await userInfoCacheStore.set(cacheData) // 持久化缓存
      debug('[BiliCookie] 用户信息缓存已更新并持久化')
    } catch (err) {
      error(`[BiliCookie] 持久化用户信息缓存失败: ${String(err)}`)
    }
  }

  /**
   * @description 清除用户信息缓存 (内存和持久化)
   */
  const _clearUserInfoCache = async (): Promise<void> => {
    _cachedUserInfo.value = undefined // 清除内存缓存
    uId.value = undefined // 清除 uId
    try {
      await userInfoCacheStore.delete() // 删除持久化缓存
      debug('[BiliCookie] 用户信息缓存已清除')
    } catch (err) {
      error(`[BiliCookie] 清除持久化用户信息缓存失败: ${String(err)}`)
    }
  }

  /**
   * @description 更新 Cookie 存在状态和有效状态
   * @param hasCookie Cookie 是否存在
   * @param isValid Cookie 是否有效
   */
  const _updateCookieState = (hasCookie: boolean, isValid: boolean): void => {
    hasBiliCookie.value = hasCookie
    isCookieValid.value = isValid
    if (!hasCookie || !isValid) {
      // 如果 Cookie 不存在或无效，清除可能过时的用户信息缓存
      // 注意：这里采取了更严格的策略，无效则清除缓存，避免显示旧信息
      // _clearUserInfoCache(); // 考虑是否在无效时立即清除缓存
      debug(`[BiliCookie] Cookie 状态更新: hasCookie=${hasCookie}, isValid=${isValid}`)
    }
  }

  /**
   * @description 检查提供的 Bilibili Cookie 是否有效
   * @param cookie 要验证的 Cookie 字符串
   * @returns Promise<{ valid: boolean; data?: BiliUserProfile }> 验证结果和用户信息 (如果有效)
   */
  const _checkCookieValidity = async (cookie: string): Promise<{ valid: boolean, data?: BiliUserProfile }> => {
    if (!cookie) {
      return { valid: false }
    }
    try {
      // 使用传入的 cookie 调用 Bilibili API
      const resp = await QueryBiliAPI('https://api.bilibili.com/x/space/myinfo', 'GET', cookie)

      const json = await resp.json()
      if (json.code === 0 && json.data) {
        debug('[BiliCookie] Cookie 验证成功, 用户:', json.data.name)
        // 验证成功，更新用户信息缓存
        await _updateUserInfoCache(json.data)
        return { valid: true, data: json.data }
      } else {
        warn(`[BiliCookie] Cookie 验证失败 (API 返回): ${json.message || `code: ${json.code}`}`)
        return { valid: false }
      }
    } catch (err) {
      error(`[BiliCookie] 验证 Cookie 时请求 Bilibili API 出错: ${String(err)}`)
      return { valid: false }
    }
  }

  /**
   * @description 从 CookieCloud 服务获取并解密 Bilibili Cookie
   * @param config CookieCloud 配置 (如果提供，则使用此配置；否则使用已存储的配置)
   * @returns Promise<string> Bilibili Cookie 字符串
   * @throws 如果配置缺失、网络请求失败、解密失败或未找到 Bilibili Cookie，则抛出错误
   */
  const _fetchAndDecryptFromCloud = async (config?: CookieCloudConfig): Promise<string> => {
    const cloudConfig = config ?? await cookieCloudStore.get() // 获取配置

    if (!cloudConfig?.key || !cloudConfig?.password) {
      throw new Error('CookieCloud 配置不完整 (缺少 Key 或 Password)')
    }

    const host = cloudConfig.host || 'https://cookie.vtsuru.live' // 默认 Host
    const url = new URL(host)
    url.pathname = `/get/${cloudConfig.key}`

    info(`[BiliCookie] 正在从 CookieCloud (${url.hostname}) 获取 Cookie...`)

    try {
      // 注意: 浏览器环境通常无法直接设置 User-Agent
      // 使用 Tauri fetch 发送请求
      const response = await tauriFetch(url.toString(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json', // 根据 CookieCloud API 要求可能需要调整
        },
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`CookieCloud 请求失败: ${response.status} ${response.statusText}. ${errorText}`)
      }

      const json = await response.json() // 类型断言需要谨慎

      if (json.encrypted) {
        // 执行解密
        try {
          const keyMaterial = MD5(`${cloudConfig.key}-${cloudConfig.password}`).toString()
          const decryptionKey = keyMaterial.substring(0, 16) // 取前16位作为 AES 密钥
          const decrypted = AES.decrypt(json.encrypted, decryptionKey).toString(enc.Utf8)

          if (!decrypted) {
            throw new Error('解密结果为空，可能是密钥不匹配')
          }

          const cookieData = JSON.parse(decrypted) as CookieCloudExportData

          // 提取 bilibili.com 的 Cookie
          const biliCookies = cookieData.cookie_data?.['bilibili.com']
          if (!biliCookies || biliCookies.length === 0) {
            throw new Error('在 CookieCloud 数据中未找到 \'bilibili.com\' 的 Cookie')
          }

          // 拼接 Cookie 字符串
          const cookieString = biliCookies
            .map(c => `${c.name}=${c.value}`)
            .join('; ')

          info('[BiliCookie] CookieCloud Cookie 获取并解密成功')
          return cookieString
        } catch (decryptErr) {
          error(`[BiliCookie] CookieCloud Cookie 解密失败: ${String(decryptErr)}`)
          throw new Error(`Cookie 解密失败: ${decryptErr instanceof Error ? decryptErr.message : String(decryptErr)}`)
        }
      } else if (json.cookie_data) {
        // 处理未加密的情况 (如果 CookieCloud 支持)
        warn('[BiliCookie] 从 CookieCloud 收到未加密的 Cookie 数据')
        const biliCookies = (json as CookieCloudExportData).cookie_data?.['bilibili.com']
        if (!biliCookies || biliCookies.length === 0) {
          throw new Error('在 CookieCloud 数据中未找到 \'bilibili.com\' 的 Cookie')
        }
        const cookieString = biliCookies
          .map(c => `${c.name}=${c.value}`)
          .join('; ')
        return cookieString
      } else {
        // API 返回了非预期的数据结构
        throw new Error(json.message || '从 CookieCloud 获取 Cookie 失败，响应格式不正确')
      }
    } catch (networkErr) {
      error(`[BiliCookie] 请求 CookieCloud 时出错: ${String(networkErr)}`)
      throw new Error(`请求 CookieCloud 时出错: ${networkErr instanceof Error ? networkErr.message : String(networkErr)}`)
    }
  }

  /**
   * @description 从已配置的 CookieCloud 同步 Cookie，并更新本地状态
   * @returns Promise<boolean> 是否同步并验证成功
   */
  const _syncFromCookieCloud = async (): Promise<boolean> => {
    const config = await cookieCloudStore.get()
    if (!config?.key) {
      debug('[BiliCookie] 未配置 CookieCloud 或缺少 key，跳过同步')
      // 如果从未设置过，保持 unset；如果之前设置过但现在无效，标记为 invalid
      if (cookieCloudState.value !== 'unset') {
        cookieCloudState.value = 'invalid' // 假设配置被清空意味着无效
      }
      return false
    }

    cookieCloudState.value = 'syncing' // 标记为同步中
    try {
      const cookieString = await _fetchAndDecryptFromCloud(config)
      // 验证从 Cloud 获取的 Cookie
      const validationResult = await _checkCookieValidity(cookieString)

      if (validationResult.valid) {
        // 验证成功，保存 Cookie
        await setBiliCookie(cookieString) // setBiliCookie 内部会处理状态更新和持久化
        cookieCloudState.value = 'valid' // 标记为有效
        info('[BiliCookie] 从 CookieCloud 同步并验证 Cookie 成功')
        return true
      } else {
        // 从 Cloud 获取的 Cookie 无效
        warn('[BiliCookie] 从 CookieCloud 获取的 Cookie 无效')
        cookieCloudState.value = 'invalid' // 标记为无效
        // 不更新本地 Cookie，保留当前有效的或无效的状态
        _updateCookieState(hasBiliCookie.value, false) // 显式标记当前cookie状态可能因云端无效而变为无效
        return false
      }
    } catch (err) {
      error(`[BiliCookie] CookieCloud 同步失败: ${String(err)}`)
      cookieCloudState.value = 'invalid' // 同步出错，标记为无效
      // 同步失败不应影响当前的 isCookieValid 状态，除非需要强制失效
      // _updateCookieState(hasBiliCookie.value, false); // 可选：同步失败时强制本地cookie失效
      return false
    }
  }

  // --- 公开方法 ---

  /**
   * @description 初始化 BiliCookie Store
   * - 加载持久化数据 (Cookie, Cloud 配置, 用户信息缓存)
   * - 检查 CookieCloud 配置状态
   * - 进行首次 Cookie 有效性检查 (或使用缓存)
   * - 启动定时检查任务
   */
  const init = async (): Promise<void> => {
    if (_isInitialized) {
      debug('[BiliCookie] Store 已初始化，跳过')
      return
    }
    _isInitialized = true
    info('[BiliCookie] Store 初始化开始...')

    // 1. 加载持久化数据
    const [storedCookieData, storedCloudConfig, storedUserInfo] = await Promise.all([
      biliCookieStore.value,
      cookieCloudStore.get(),
      userInfoCacheStore.get(),
    ])

    // 2. 处理 CookieCloud 配置
    if (storedCloudConfig?.key && storedCloudConfig?.password) {
      // 这里仅设置初始状态，有效性将在后续检查或同步中确认
      cookieCloudState.value = 'valid' // 假设配置存在即可能有效，待验证
      info('[BiliCookie] 检测到已配置 CookieCloud')
    } else {
      cookieCloudState.value = 'unset'
      info('[BiliCookie] 未配置 CookieCloud')
    }

    // 3. 处理用户信息缓存
    if (storedUserInfo && (Date.now() - storedUserInfo.accessedAt < USER_INFO_CACHE_DURATION)) {
      _cachedUserInfo.value = storedUserInfo
      uId.value = storedUserInfo.userInfo.mid
      info(`[BiliCookie] 从缓存加载有效用户信息: UID=${uId.value}`)
      // 如果缓存有效，可以初步认为 Cookie 是有效的 (至少在缓存有效期内是)
      _updateCookieState(!!storedCookieData?.cookie, true)
    } else {
      info('[BiliCookie] 无有效用户信息缓存')
      _updateCookieState(!!storedCookieData?.cookie, false) // 默认无效，待检查
      if (storedUserInfo) {
        // 如果有缓存但已过期，清除它
        await _clearUserInfoCache()
      }
    }

    // 4. 处理 Bilibili Cookie
    if (storedCookieData?.cookie) {
      hasBiliCookie.value = true // 标记存在 Cookie
      info('[BiliCookie] 检测到已存储的 Bilibili Cookie')
      // 检查 Cookie 有效性，除非用户信息缓存有效且未过期
      if (!_cachedUserInfo.value) { // 只有在没有有效缓存时才立即检查
        info('[BiliCookie] 无有效缓存，立即检查 Cookie 有效性...')
        const { valid } = await _checkCookieValidity(storedCookieData.cookie)
        _updateCookieState(true, valid) // 更新状态
      }
    } else {
      _updateCookieState(false, false) // 没有 Cookie，自然无效
      info('[BiliCookie] 未找到存储的 Bilibili Cookie')
    }

    // 5. 启动定时检查器
    if (_checkIntervalId) {
      clearInterval(_checkIntervalId) // 清除旧的定时器 (理论上不应存在)
    }
    _checkIntervalId = setInterval(check, REGULAR_CHECK_INTERVAL)
    info(`[BiliCookie] 定时检查已启动，周期: ${REGULAR_CHECK_INTERVAL / 1000} 秒`)

    // 立即执行一次检查，强制尝试从 CookieCloud 同步
    await check(true)

    info('[BiliCookie] Store 初始化完成')
  }

  /**
   * @description 定期检查 Cookie 有效性，并按需从 CookieCloud 同步
   * @param forceCheckCloud 是否强制立即尝试从 CookieCloud 同步 (通常由 init 调用)
   */
  const check = async (forceCheckCloud: boolean = false): Promise<void> => {
    debug('[BiliCookie] 开始周期性检查...')
    _checkCounter++

    let cloudSyncAttempted = false
    let cloudSyncSuccess = false

    // 检查是否需要从 CookieCloud 同步
    const shouldSyncCloud = forceCheckCloud || (_checkCounter % CLOUD_SYNC_INTERVAL_CHECKS === 0)

    if (shouldSyncCloud && cookieCloudState.value !== 'unset' && cookieCloudState.value !== 'syncing') {
      info(`[BiliCookie] 触发 CookieCloud 同步 (计数: ${_checkCounter}, 强制: ${forceCheckCloud})`)
      cloudSyncAttempted = true
      cloudSyncSuccess = await _syncFromCookieCloud()
      // 同步后重置计数器，避免连续同步
      _checkCounter = 0
    }

    // 如果没有尝试云同步，或者云同步失败，则检查本地 Cookie
    if (!cloudSyncAttempted || !cloudSyncSuccess) {
      debug('[BiliCookie] 检查本地存储的 Cookie 有效性...')
      const storedCookie = biliCookieStore.value?.cookie
      if (storedCookie) {
        const { valid } = await _checkCookieValidity(storedCookie)
        // 只有在云同步未成功时才更新状态，避免覆盖云同步设置的状态
        if (!cloudSyncSuccess) {
          _updateCookieState(true, valid)
        }
      } else {
        // 本地没有 Cookie
        _updateCookieState(false, false)
        // 如果本地没 cookie 但 cookieCloud 配置存在且非 syncing, 尝试一次同步
        if (!cloudSyncAttempted && cookieCloudState.value !== 'unset' && cookieCloudState.value !== 'syncing') {
          info('[BiliCookie] 本地无 Cookie，尝试从 CookieCloud 获取...')
          await _syncFromCookieCloud() // 尝试获取一次
          _checkCounter = 0 // 同步后重置计数器
        }
      }
    }
    debug('[BiliCookie] 周期性检查结束')
  }

  /**
   * @description 设置新的 Bilibili Cookie
   * @param cookie Cookie 字符串
   * @param refreshToken (可选) Bilibili refresh token
   */
  const setBiliCookie = async (cookie: string, refreshToken?: string): Promise<void> => {
    info('[BiliCookie] 正在设置新的 Bilibili Cookie...')
    // 1. 验证新 Cookie 的有效性
    const { valid } = await _checkCookieValidity(cookie)

    if (valid) {
      // 2. 如果有效，则持久化存储
      const dataToStore: BiliCookieStoreData = {
        cookie,
        ...(refreshToken && { refreshToken }), // 仅在提供时添加 refreshToken
        lastRefresh: new Date(), // 更新刷新时间戳
      }
      try {
        biliCookieStore.value = dataToStore // 使用响应式存储
        info('[BiliCookie] 新 Bilibili Cookie 已验证并保存')
        _updateCookieState(true, true) // 更新状态为存在且有效
      } catch (err) {
        error(`[BiliCookie] 保存 Bilibili Cookie 失败: ${String(err)}`)
        // 保存失败，状态回滚或标记为错误？暂时保持验证结果
        _updateCookieState(true, false) // Cookie 存在但保存失败，标记无效可能更安全
        throw new Error('保存 Bilibili Cookie 失败') // 向上抛出错误
      }
    } else {
      // 新 Cookie 无效，不保存，并标记状态
      _updateCookieState(hasBiliCookie.value, false) // 保持 hasBiliCookie 原样或设为 false？取决于策略
      warn('[BiliCookie] 尝试设置的 Bilibili Cookie 无效，未保存')
      // 可以选择抛出错误，让调用者知道设置失败
      // throw new Error("设置的 Bilibili Cookie 无效");
    }
  }

  /**
   * @description 获取当前存储的 Bilibili Cookie (不保证有效性)
   * @returns Promise<string | undefined> Cookie 字符串或 undefined
   */
  const getBiliCookie = async (): Promise<string | undefined> => {
    const data = biliCookieStore.value
    return data?.cookie
  }

  /**
   * @description 退出登录，清除 Bilibili Cookie 及相关状态和缓存
   */
  const logout = async (): Promise<void> => {
    info('[BiliCookie] 用户请求退出登录...')
    // 停止定时检查器
    if (_checkIntervalId) {
      clearInterval(_checkIntervalId)
      _checkIntervalId = null
      debug('[BiliCookie] 定时检查已停止')
    }
    // 清除 Cookie 存储
    biliCookieStore.value = undefined // 清除持久化存储
    // 清除用户信息缓存
    await _clearUserInfoCache()
    // 重置状态变量
    _updateCookieState(false, false)
    // Cookie Cloud 状态是否重置？取决于产品逻辑，暂时保留
    // cookieCloudState.value = 'unset';
    // 重置初始化标志，允许重新 init
    _isInitialized = false
    _checkCounter = 0 // 重置计数器
    info('[BiliCookie] 退出登录完成，状态已重置')
  }

  /**
   * @description 设置并验证 CookieCloud 配置
   * @param config CookieCloud 配置数据
   * @throws 如果配置无效或从 CookieCloud 获取/验证 Cookie 失败
   */
  const setCookieCloudConfig = async (config: CookieCloudConfig): Promise<void> => {
    info('[BiliCookie] 正在设置新的 CookieCloud 配置...')
    cookieCloudState.value = 'syncing' // 标记为尝试同步/验证中

    try {
      // 1. 使用新配置尝试从 Cloud 获取 Cookie
      const cookieString = await _fetchAndDecryptFromCloud(config)
      // 2. 验证获取到的 Cookie
      const validationResult = await _checkCookieValidity(cookieString)

      if (validationResult.valid && validationResult.data) {
        // 3. 如果验证成功，保存 CookieCloud 配置
        await cookieCloudStore.set(config)
        info(`[BiliCookie] CookieCloud 配置验证成功并已保存. 用户:${validationResult.data.name}`)
        cookieCloudState.value = 'valid' // 标记为有效

        // 4. 使用从 Cloud 获取的有效 Cookie 更新本地 Cookie
        // 注意：这里直接调用 setBiliCookie 会再次进行验证，但确保状态一致性
        await setBiliCookie(cookieString)
        // 重置检查计数器，以便下次正常检查
        _checkCounter = 0
      } else {
        // 从 Cloud 获取的 Cookie 无效
        cookieCloudState.value = 'invalid'
        warn('[BiliCookie] 使用新 CookieCloud 配置获取的 Cookie 无效')
        throw new Error('CookieCloud 配置无效：获取到的 Bilibili Cookie 无法通过验证')
      }
    } catch (err) {
      error(`[BiliCookie] 设置 CookieCloud 配置失败: ${String(err)}`)
      cookieCloudState.value = 'invalid' // 出错则标记为无效
      // 向上抛出错误，通知调用者失败
      throw err // err 已经是 Error 类型或被包装过
    }
  }
  async function clearCookieCloudConfig() {
    info('[BiliCookie] 清除 CookieCloud 配置...')
    cookieCloudState.value = 'unset'
    // 清除持久化存储
    await cookieCloudStore.delete().catch((err) => {
      error(`[BiliCookie] 清除 CookieCloud 配置失败: ${String(err)}`)
    })
  }

  // --- 返回 Store 的公开接口 ---
  return {
    // 只读状态和计算属性
    hasBiliCookie: computed(() => hasBiliCookie.value), // 只读 ref
    isCookieValid: computed(() => isCookieValid.value), // 只读 ref
    cookieCloudState: computed(() => cookieCloudState.value), // 只读 ref
    uId: computed(() => uId.value), // 只读 ref
    userInfo, // computed 属性本身就是只读的

    cookie: computed(() => biliCookieStore.value?.cookie), // 只读 ref

    // 方法
    init,
    check, // 暴露 check 方法，允许手动触发检查 (例如，应用从后台恢复)
    setBiliCookie,
    getBiliCookie, // 获取原始 cookie 字符串的方法
    logout,
    setCookieCloudConfig,
    clearCookieCloudConfig,
    // 注意：不再直接暴露 fetchBiliCookieFromCloud，其逻辑已整合到内部同步和设置流程中
  }
})

// --- HMR 支持 ---
if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useBiliCookie, import.meta.hot))
}
