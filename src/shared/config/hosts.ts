import { isDev } from './api'

export const CURRENT_HOST = `${window.location.protocol}//${isDev ? window.location.host : 'vtsuru.live'}/`
export const CN_HOST = 'https://vtsuru.suki.club/'

