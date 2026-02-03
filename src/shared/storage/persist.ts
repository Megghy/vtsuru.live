import type { RemovableRef, StorageLikeAsync, UseStorageAsyncOptions } from '@vueuse/core'
import { useStorageAsync } from '@vueuse/core'
import { createStore, del, get, set } from 'idb-keyval'
import { computed, ref, toValue, watch, type Ref } from 'vue'
import { PERSIST_LEGACY_KEY_MAP } from '@/shared/storage/persistKeys'

type PersistBackend = 'idb' | 'local'

const PERSIST_DB_NAME = 'vtsuru.live'
const PERSIST_STORE_NAME = 'kv'
const IDB_STORE = createStore(PERSIST_DB_NAME, PERSIST_STORE_NAME)

const MIGRATION_FLAG_KEY = 'vtsuru:meta:storage:migrated-localstorage-to-idb'
const LOCAL_CANONICAL_MIGRATION_FLAG_KEY = 'vtsuru:meta:storage:migrated-localstorage-to-canonical'
const BACKEND_TEST_KEY = 'vtsuru:meta:storage:backend-test'

let resolvedBackend: PersistBackend | null = null
let resolveBackendPromise: Promise<PersistBackend> | null = null
let migrationDone = false
let migrationPromise: Promise<void> | null = null

const LEGACY_TO_CANONICAL = new Map<string, string>(Object.entries(PERSIST_LEGACY_KEY_MAP))

export function canonicalizePersistKey(key: string): string {
  const raw = key.trim()
  if (!raw) throw new Error('[persist] key 不能为空')

  if (raw.startsWith('vtsuru:')) return raw

  const mapped = LEGACY_TO_CANONICAL.get(raw)
  if (mapped) return mapped

  throw new Error(`[persist] 未注册的 key: ${raw}`)
}

async function resolvePersistBackend(): Promise<PersistBackend> {
  if (resolvedBackend) return resolvedBackend
  if (!resolveBackendPromise) {
    resolveBackendPromise = (async () => {
      if (typeof window === 'undefined') {
        throw new TypeError('[persist] window 未定义，无法使用持久化存储')
      }

      if (typeof indexedDB === 'undefined') return 'local'

      try {
        await set(BACKEND_TEST_KEY, '1', IDB_STORE)
        const v = await get<string>(BACKEND_TEST_KEY, IDB_STORE)
        await del(BACKEND_TEST_KEY, IDB_STORE)
        if (v === '1') return 'idb'
      } catch (e) {
        console.error('[persist] IndexedDB 不可用，降级为 localStorage', e)
      }

      return 'local'
    })()
  }

  resolvedBackend = await resolveBackendPromise
  return resolvedBackend
}

async function ensureMigratedFromLocalStorage(): Promise<void> {
  if (migrationDone) return
  if (!migrationPromise) {
    migrationPromise = (async () => {
      const backend = await resolvePersistBackend()
      if (backend !== 'idb') {
        if (localStorage.getItem(LOCAL_CANONICAL_MIGRATION_FLAG_KEY) === '1') {
          migrationDone = true
          return
        }

        for (const [legacyKey, canonicalKey] of LEGACY_TO_CANONICAL.entries()) {
          const rawValue = localStorage.getItem(legacyKey)
          if (rawValue == null) continue

          if (localStorage.getItem(canonicalKey) == null) {
            localStorage.setItem(canonicalKey, rawValue)
          }
          localStorage.removeItem(legacyKey)
        }

        localStorage.setItem(LOCAL_CANONICAL_MIGRATION_FLAG_KEY, '1')
        migrationDone = true
        return
      }

      const migrated = await get<string>(MIGRATION_FLAG_KEY, IDB_STORE)
      if (migrated === '1') {
        migrationDone = true
        return
      }

      for (const [legacyKey, canonicalKey] of LEGACY_TO_CANONICAL.entries()) {
        const rawValue = localStorage.getItem(legacyKey) ?? localStorage.getItem(canonicalKey)
        if (rawValue != null) {
          const existing = await get<string>(canonicalKey, IDB_STORE)
          if (existing == null) {
            await set(canonicalKey, rawValue, IDB_STORE)
          }
        }

        // IndexedDB 作为主存储：迁移完成后彻底清理旧 localStorage 数据
        localStorage.removeItem(legacyKey)
        localStorage.removeItem(canonicalKey)
      }

      await set(MIGRATION_FLAG_KEY, '1', IDB_STORE)
      migrationDone = true
    })()
  }

  await migrationPromise
}

const persistedAsyncStorage: StorageLikeAsync = {
  async getItem(key) {
    const backend = await resolvePersistBackend()
    if (backend === 'idb') {
      await ensureMigratedFromLocalStorage()
      const v = await get<string>(key, IDB_STORE)
      return v ?? null
    }
    return localStorage.getItem(key)
  },
  async setItem(key, value) {
    const backend = await resolvePersistBackend()
    if (backend === 'idb') {
      await ensureMigratedFromLocalStorage()
      await set(key, value, IDB_STORE)
      return
    }
    localStorage.setItem(key, value)
  },
  async removeItem(key) {
    const backend = await resolvePersistBackend()
    if (backend === 'idb') {
      await ensureMigratedFromLocalStorage()
      await del(key, IDB_STORE)
      return
    }
    localStorage.removeItem(key)
  },
}

type PersistKey = string | Ref<string> | (() => string)

const sharedRefCache = new Map<string, RemovableRef<any>>()

export function usePersistedStorage<T>(
  key: PersistKey,
  initialValue: T,
  options?: UseStorageAsyncOptions<T>,
): RemovableRef<T> {
  const keyValue = toValue(key)
  const isStaticKey = typeof key === 'string'

  if (isStaticKey) {
    const canonicalKey = canonicalizePersistKey(keyValue)
    const cached = sharedRefCache.get(canonicalKey)
    if (cached) {
      // console.log('[persist] cache hit:', canonicalKey)
      return cached as RemovableRef<T>
    }
    // console.log('[persist] cache miss:', canonicalKey)
  }

  const canonicalKey = computed(() => canonicalizePersistKey(toValue(key)))

  const state = ref<T>(initialValue) as RemovableRef<T>
  let active: any = null
  let stopFromStorage: (() => void) | null = null
  let stopToStorage: (() => void) | null = null
  let syncing = false

  function bind(nextCanonicalKey: string) {
    stopFromStorage?.()
    stopToStorage?.()
    stopFromStorage = null
    stopToStorage = null

    const storageRef = useStorageAsync<T>(
      nextCanonicalKey,
      initialValue,
      persistedAsyncStorage,
      options,
    ) as any

    active = storageRef

    stopFromStorage = watch(
      () => storageRef.value as T,
      (v) => {
        syncing = true
        state.value = v
        syncing = false
      },
      { deep: true, immediate: true },
    )

    stopToStorage = watch(
      state,
      (v) => {
        if (syncing) return
        if (active !== storageRef) return
        storageRef.value = v
      },
      { deep: true },
    )
  }

  watch(canonicalKey, (k) => {
    bind(k)
  }, { immediate: true })

  ;(state as any).remove = () => {
    const storageRef = active
    if (storageRef?.remove) return storageRef.remove()
    return persistedAsyncStorage.removeItem(canonicalKey.value)
  }

  if (isStaticKey) {
    sharedRefCache.set(canonicalizePersistKey(keyValue), state)
  }

  return state
}

export async function persistedGetItemRaw(key: string): Promise<string | null> {
  return persistedAsyncStorage.getItem(canonicalizePersistKey(key))
}

export async function persistedSetItemRaw(key: string, value: string): Promise<void> {
  await persistedAsyncStorage.setItem(canonicalizePersistKey(key), value)
}

export async function persistedRemoveItem(key: string): Promise<void> {
  await persistedAsyncStorage.removeItem(canonicalizePersistKey(key))
}

export async function initPersistedStorage(): Promise<void> {
  await resolvePersistBackend()
  await ensureMigratedFromLocalStorage()
}
