import { ref } from 'vue'
import { usePersistedStorage } from '@/shared/storage/persist'

const debugAPI: string
  = import.meta.env.VITE_API == 'dev'
    ? (import.meta.env.VITE_DEBUG_DEV_API as string)
    : (import.meta.env.VITE_DEBUG_RELEASE_API as string)
const releaseAPI = `https://api.vtsuru.suki.club/`
const failoverAPI = `https://failover-api.vtsuru.suki.club/`

export const apiFail = ref(false)
export const isDev = import.meta.env.MODE === 'development'

// @ts-ignore
export const isTauri = () => window.__TAURI__ !== undefined || window.__TAURI_INTERNAL__ !== undefined || '__TAURI__' in window

export interface APIConfig {
  name: string
  url: string
  key: string
}

export const availableAPIs: APIConfig[] = [
  { name: '主API (国内)', url: releaseAPI, key: 'main' },
  { name: '备用API (国外)', url: failoverAPI, key: 'failover' },
]

export const selectedAPIKey = usePersistedStorage<string>('Settings.SelectedAPI', 'main')

export function getCurrentAPIUrl(): string {
  if (import.meta.env.NODE_ENV === 'development') {
    return debugAPI
  }
  if (apiFail.value) return failoverAPI
  const selected = availableAPIs.find(api => api.key === selectedAPIKey.value)
  return selected?.url || releaseAPI
}

export function mapToCurrentAPI(url: string): string {
  if (import.meta.env.NODE_ENV === 'development') {
    return url
  }
  const currentAPI = getCurrentAPIUrl()
  return url
    .replace(releaseAPI, currentAPI)
    .replace(failoverAPI, currentAPI)
}

export const BASE_URL
  = import.meta.env.NODE_ENV === 'development'
    ? debugAPI
    : apiFail.value
      ? failoverAPI
      : releaseAPI

export const BASE_API_URL = `${BASE_URL}api/`
export const BASE_HUB_URL = `${BASE_URL}hub/`
