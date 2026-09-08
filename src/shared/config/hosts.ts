import { isDev } from './api'

const getHost = () => {
  if (typeof window === 'undefined') return 'https://vtsuru.live/'
  const host = isDev || window.location.host.includes('suki.club') ? window.location.host : 'vtsuru.live'
  return `${window.location.protocol}//${host}/`
}

export const CURRENT_HOST = getHost()
export const CN_HOST = 'https://vtsuru.suki.club/'
