import type { RemovableRef, StorageLikeAsync, UseStorageAsyncOptions } from '@vueuse/core'
import { useStorageAsync } from '@vueuse/core'
import { createStore, del, entries as idbEntries, get, set } from 'idb-keyval'
import { computed, ref, toValue, watch, type Ref } from 'vue'

import { PERSIST_LEGACY_KEY_MAP } from '@/shared/storage/persistKeys'

type PersistBackend = 'tauri' | 'idb' | 'local'

const PERSIST_DB_NAME = 'vtsuru.live'
const PERSIST_STORE_NAME = 'kv'
const IDB_STORE = createStore(PERSIST_DB_NAME, PERSIST_STORE_NAME)
const AUTO_ACTION_STORE = createStore('keyval-store', 'keyval')
const AUTO_ACTION_USER_DATA_STORE = createStore('AutoActionUserDataDB', 'userData')

const MIGRATION_FLAG_KEY = 'vtsuru:meta:storage:migrated-localstorage-to-idb'
const LOCAL_CANONICAL_MIGRATION_FLAG_KEY = 'vtsuru:meta:storage:migrated-localstorage-to-canonical'
const UNIFIED_FLAG_KEY = 'vtsuru:meta:storage:unified-v1'
const BACKEND_TEST_KEY = 'vtsuru:meta:storage:backend-test'

export const AUTO_ACTION_USER_DATA_PREFIX = 'autoAction.userData.'

const LEGACY_TO_CANONICAL = new Map<string, string>(Object.entries(PERSIST_LEGACY_KEY_MAP))

let resolvedBackend: PersistBackend | null = null
let resolveBackendPromise: Promise<PersistBackend> | null = null
let migrationDone = false
let migrationPromise: Promise<void> | null = null
let tauriStorePromise: Promise<TauriStoreAdapter> | null = null

interface TauriStoreAdapter {
  get: <T>(key: string) => Promise<T | undefined>
  set: (key: string, value: unknown) => Promise<void>
  delete: (key: string) => Promise<void>
  keys: () => Promise<string[]>
  entries: () => Promise<[string, unknown][]>
  clear: () => Promise<void>
  save: () => Promise<void>
}

export function canonicalizePersistKey(key: string): string {
  const raw = key.trim()
  if (!raw) throw new Error('[persist] key 不能为空')
  return LEGACY_TO_CANONICAL.get(raw) ?? raw
}

function isTauriRuntime(): boolean {
  return typeof window !== 'undefined' && ('__TAURI__' in window || '__TAURI_INTERNAL__' in window || '__TAURI_INTERNALS__' in window)
}

function decodeStoredValue(value: unknown): unknown {
  if (typeof value !== 'string') return value
  try {
    return JSON.parse(value)
  } catch {
    return value
  }
}

function encodeForVueUse(value: unknown): string {
  return typeof value === 'string' ? value : JSON.stringify(value)
}

async function getTauriStore(): Promise<TauriStoreAdapter> {
  if (!tauriStorePromise) {
    tauriStorePromise = (async () => {
      const { LazyStore } = await import('@tauri-apps/plugin-store')
      return new LazyStore('vtsuru.data.json', {
        autoSave: true,
        defaults: {},
      }) as unknown as TauriStoreAdapter
    })()
  }
  return tauriStorePromise
}

async function resolvePersistBackend(): Promise<PersistBackend> {
  if (resolvedBackend) return resolvedBackend
  if (!resolveBackendPromise) {
    resolveBackendPromise = (async () => {
      if (typeof window === 'undefined') {
        throw new TypeError('[persist] window 未定义，无法使用持久化存储')
      }
      if (isTauriRuntime()) return 'tauri'
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

async function copyIfAbsent(store: TauriStoreAdapter, key: string, value: unknown): Promise<void> {
  if (value === undefined) return
  const existing = await store.get(key)
  if (existing !== undefined) return
  await store.set(key, value)
}

async function migrateIdbStoreIntoTauri(
  store: TauriStoreAdapter,
  idbStore: ReturnType<typeof createStore>,
  keyMap?: (key: string) => string,
): Promise<void> {
  const rows = await idbEntries(idbStore)
  for (const [rawKey, rawValue] of rows) {
    const key = keyMap ? keyMap(String(rawKey)) : String(rawKey)
    if (!key || key === BACKEND_TEST_KEY) continue
    await copyIfAbsent(store, key, decodeStoredValue(rawValue))
  }
}

async function migrateLocalStorageCanonicalIntoTauri(store: TauriStoreAdapter): Promise<void> {
  for (const [legacyKey, canonicalKey] of LEGACY_TO_CANONICAL.entries()) {
    const rawValue = localStorage.getItem(legacyKey) ?? localStorage.getItem(canonicalKey)
    if (rawValue == null) continue
    await copyIfAbsent(store, canonicalKey, decodeStoredValue(rawValue))
  }
}

async function migrateIntoTauri(): Promise<void> {
  const store = await getTauriStore()
  const migrated = await store.get<string>(UNIFIED_FLAG_KEY)
  if (migrated === '1') return

  await migrateLocalStorageCanonicalIntoTauri(store)
  await migrateIdbStoreIntoTauri(store, IDB_STORE)
  await migrateIdbStoreIntoTauri(store, AUTO_ACTION_STORE)
  await migrateIdbStoreIntoTauri(store, AUTO_ACTION_USER_DATA_STORE, (key) =>
    key.startsWith(AUTO_ACTION_USER_DATA_PREFIX) ? key : `${AUTO_ACTION_USER_DATA_PREFIX}${key}`,
  )
  await store.set(UNIFIED_FLAG_KEY, '1')
  await store.save()
}

async function migrateLocalStorageToIdb(): Promise<void> {
  const migrated = await get<string>(MIGRATION_FLAG_KEY, IDB_STORE)
  if (migrated === '1') return

  for (const [legacyKey, canonicalKey] of LEGACY_TO_CANONICAL.entries()) {
    const rawValue = localStorage.getItem(legacyKey) ?? localStorage.getItem(canonicalKey)
    if (rawValue != null) {
      const existing = await get<string>(canonicalKey, IDB_STORE)
      if (existing == null) {
        await set(canonicalKey, rawValue, IDB_STORE)
      }
    }

    localStorage.removeItem(legacyKey)
    localStorage.removeItem(canonicalKey)
  }

  await set(MIGRATION_FLAG_KEY, '1', IDB_STORE)
}

async function migrateLocalStorageCanonical(): Promise<void> {
  if (localStorage.getItem(LOCAL_CANONICAL_MIGRATION_FLAG_KEY) === '1') return

  for (const [legacyKey, canonicalKey] of LEGACY_TO_CANONICAL.entries()) {
    const rawValue = localStorage.getItem(legacyKey)
    if (rawValue == null) continue
    if (localStorage.getItem(canonicalKey) == null) {
      localStorage.setItem(canonicalKey, rawValue)
    }
    localStorage.removeItem(legacyKey)
  }

  localStorage.setItem(LOCAL_CANONICAL_MIGRATION_FLAG_KEY, '1')
}

async function ensureMigrated(): Promise<void> {
  if (migrationDone) return
  if (!migrationPromise) {
    migrationPromise = (async () => {
      const backend = await resolvePersistBackend()
      if (backend === 'tauri') await migrateIntoTauri()
      else if (backend === 'idb') await migrateLocalStorageToIdb()
      else await migrateLocalStorageCanonical()
      migrationDone = true
    })()
  }
  await migrationPromise
}

async function persistGetJson<T>(key: string): Promise<T | undefined> {
  await ensureMigrated()
  const backend = await resolvePersistBackend()
  if (backend === 'tauri') {
    return await (await getTauriStore()).get<T>(key)
  }
  if (backend === 'idb') {
    const value = await get<unknown>(key, IDB_STORE)
    if (value == null) return undefined
    return decodeStoredValue(value) as T
  }
  const raw = localStorage.getItem(key)
  if (raw == null) return undefined
  return decodeStoredValue(raw) as T
}

async function persistSetJson(key: string, value: unknown): Promise<void> {
  await ensureMigrated()
  const backend = await resolvePersistBackend()
  if (backend === 'tauri') {
    await (await getTauriStore()).set(key, value)
    return
  }
  const raw = encodeForVueUse(value)
  if (backend === 'idb') {
    await set(key, raw, IDB_STORE)
    return
  }
  localStorage.setItem(key, raw)
}

const persistedAsyncStorage: StorageLikeAsync = {
  async getItem(key) {
    const value = await persistGetJson(key)
    if (value === undefined) return null
    return encodeForVueUse(value)
  },
  async setItem(key, value) {
    await persistSetJson(key, decodeStoredValue(value))
  },
  async removeItem(key) {
    await ensureMigrated()
    const backend = await resolvePersistBackend()
    if (backend === 'tauri') {
      await (await getTauriStore()).delete(key)
      return
    }
    if (backend === 'idb') {
      await del(key, IDB_STORE)
      return
    }
    localStorage.removeItem(key)
  },
}

type PersistKey = string | Ref<string> | (() => string)

const sharedRefCache = new Map<string, RemovableRef<any>>()
const sharedReadyCache = new Map<string, Promise<any>>()

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
      if (options?.onReady) {
        const readyPromise = sharedReadyCache.get(canonicalKey)
        if (readyPromise) {
          void readyPromise.then((val) => options.onReady?.(val))
        } else {
          options.onReady(cached.value)
        }
      }
      return cached as RemovableRef<T>
    }
  }

  const canonicalKey = computed(() => canonicalizePersistKey(toValue(key)))

  let resolveReady: (val: any) => void
  const readyPromise = new Promise<any>((resolve) => {
    resolveReady = resolve
  })
  if (isStaticKey) {
    sharedReadyCache.set(canonicalizePersistKey(keyValue), readyPromise)
  }

  const mergeDefaults =
    options?.mergeDefaults ??
    (initialValue !== null && typeof initialValue === 'object' && !Array.isArray(initialValue))

  const wrappedOptions: UseStorageAsyncOptions<T> = {
    ...options,
    mergeDefaults,
    onReady: (value: T) => {
      resolveReady(value)
      options?.onReady?.(value)
    },
  }

  const state = ref<T>(initialValue) as RemovableRef<T>
  ;(state as any).ready = readyPromise
  let active: any = null
  let stopFromStorage: (() => void) | null = null
  let stopToStorage: (() => void) | null = null
  let syncing = false

  function bind(nextCanonicalKey: string) {
    stopFromStorage?.()
    stopToStorage?.()
    stopFromStorage = null
    stopToStorage = null

    const storageRef = useStorageAsync<T>(nextCanonicalKey, initialValue, persistedAsyncStorage, wrappedOptions) as any

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

  watch(
    canonicalKey,
    (k) => {
      bind(k)
    },
    { immediate: true },
  )

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

export function whenPersistedReady<T>(storage: RemovableRef<T>): Promise<T> {
  const ready = (storage as RemovableRef<T> & { ready?: Promise<T> }).ready
  return ready ?? Promise.resolve(storage.value)
}

export function persistLoaded(storage: RemovableRef<unknown>) {
  const loaded = ref(false)
  void whenPersistedReady(storage).then(() => {
    loaded.value = true
  })
  return loaded
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

export async function persistedGetJson<T>(key: string): Promise<T | undefined> {
  return persistGetJson<T>(canonicalizePersistKey(key))
}

export async function persistedSetJson(key: string, value: unknown): Promise<void> {
  await persistSetJson(canonicalizePersistKey(key), value)
}

export async function persistedEntries(): Promise<[string, unknown][]> {
  await ensureMigrated()
  const backend = await resolvePersistBackend()
  if (backend === 'tauri') {
    return await (await getTauriStore()).entries()
  }
  if (backend === 'idb') {
    const rows = await idbEntries(IDB_STORE)
    return rows.map(([key, value]) => [String(key), decodeStoredValue(value)])
  }
  return Object.keys(localStorage).map((key) => [key, decodeStoredValue(localStorage.getItem(key))])
}

export async function persistedListKeys(prefix?: string): Promise<string[]> {
  const keys = (await persistedEntries()).map(([key]) => key)
  return prefix ? keys.filter((key) => key.startsWith(prefix)) : keys
}

export async function persistedFlush(): Promise<void> {
  await ensureMigrated()
  if ((await resolvePersistBackend()) === 'tauri') {
    await (await getTauriStore()).save()
  }
}

export async function persistedRemoveKeys(keys: string[]): Promise<void> {
  await Promise.all(keys.map((key) => persistedAsyncStorage.removeItem(key)))
}

export async function persistedSetMany(entries: Array<[string, unknown]>): Promise<void> {
  for (const [key, value] of entries) {
    await persistSetJson(key, value)
  }
}

export async function initPersistedStorage(): Promise<void> {
  await resolvePersistBackend()
  await ensureMigrated()
}
