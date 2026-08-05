import { computed, ref } from 'vue'

import { persistedGetItemRaw, persistedSetItemRaw, usePersistedStorage } from '@/shared/storage/persist'

const debugAPI: string =
  import.meta.env.VITE_API == 'dev'
    ? (import.meta.env.VITE_DEBUG_DEV_API as string)
    : (import.meta.env.VITE_DEBUG_RELEASE_API as string)
const releaseAPI = `https://api.vtsuru.suki.club/`
const failoverAPI = `https://failover-api.vtsuru.suki.club/`

export const apiFail = ref(false)
export const isDev = import.meta.env.MODE === 'development'

const API_MANUAL_SELECTION_KEY = 'vtsuru:settings:api-selection-manual'
const API_FAILOVER_SESSION_KEY = 'vtsuru:runtime:api-failover'

export const isTauri = () => '__TAURI__' in window || '__TAURI_INTERNAL__' in window

export interface APIConfig {
  name: string
  url: string
  key: string
}

export type APIKey = 'main' | 'failover'

export const availableAPIs: APIConfig[] = [
  { name: '主API (国内)', url: releaseAPI, key: 'main' },
  { name: '备用API (国外)', url: failoverAPI, key: 'failover' },
]

export const selectedAPIKey = usePersistedStorage<APIKey>('Settings.SelectedAPI', 'main')
export const isManualAPISelection = ref(false)
export const currentAPIKey = computed<APIKey>(() => (apiFail.value ? 'failover' : selectedAPIKey.value))
export const isAutomaticAPIFailover = computed(() => apiFail.value && !isManualAPISelection.value)

function hasSessionFailover() {
  return typeof window !== 'undefined' && sessionStorage.getItem(API_FAILOVER_SESSION_KEY) === '1'
}

export async function initializeAPISelection() {
  if (isDev) return

  const hasManualSelection = (await persistedGetItemRaw(API_MANUAL_SELECTION_KEY)) === '1'
  const savedSelection = await persistedGetItemRaw('Settings.SelectedAPI')

  if (hasManualSelection) {
    isManualAPISelection.value = true
    if (savedSelection === 'main' || savedSelection === 'failover') {
      selectedAPIKey.value = savedSelection
    }
    apiFail.value = false
    sessionStorage.removeItem(API_FAILOVER_SESSION_KEY)
    return
  }

  // Ignore legacy node preferences until a new manual choice is recorded.
  isManualAPISelection.value = false
  selectedAPIKey.value = 'main'
  await persistedSetItemRaw('Settings.SelectedAPI', 'main')
  apiFail.value = hasSessionFailover()
}

export async function setSelectedAPIKey(key: APIKey) {
  selectedAPIKey.value = key
  isManualAPISelection.value = true
  apiFail.value = false
  sessionStorage.removeItem(API_FAILOVER_SESSION_KEY)
  await persistedSetItemRaw('Settings.SelectedAPI', key)
  await persistedSetItemRaw(API_MANUAL_SELECTION_KEY, '1')
}

export function markAPIFailover() {
  if (isDev || selectedAPIKey.value !== 'main' || apiFail.value) return false
  apiFail.value = true
  sessionStorage.setItem(API_FAILOVER_SESSION_KEY, '1')
  return true
}

export function getAPIUrl(key: APIKey): string {
  return availableAPIs.find((api) => api.key === key)?.url || releaseAPI
}

export function isManagedAPIUrl(url: string): boolean {
  return url.startsWith(releaseAPI) || url.startsWith(failoverAPI)
}

export function clearAPIFailover() {
  apiFail.value = false
  sessionStorage.removeItem(API_FAILOVER_SESSION_KEY)
}

export function getCurrentAPIUrl(): string {
  if (import.meta.env.NODE_ENV === 'development') {
    return debugAPI
  }
  return getAPIUrl(currentAPIKey.value)
}

export function mapToCurrentAPI(url: string): string {
  if (import.meta.env.NODE_ENV === 'development') {
    return url
  }
  const currentAPI = getCurrentAPIUrl()
  return url.replace(releaseAPI, currentAPI).replace(failoverAPI, currentAPI)
}

export const BASE_URL = import.meta.env.NODE_ENV === 'development' ? debugAPI : apiFail.value ? failoverAPI : releaseAPI

export const BASE_API_URL = `${BASE_URL}api/`
export const BASE_HUB_URL = `${BASE_URL}hub/`
