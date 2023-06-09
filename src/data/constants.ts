const debugAPI = import.meta.env.VITE_DEBUG_API
const releseAPI = `${document.location.protocol}//api.vtsuru.live/`
export const BASE_API = process.env.NODE_ENV === 'development' ? debugAPI : releseAPI
export const FETCH_API = 'https://fetch.vtsuru.live/'

export const TURNSTILE_KEY = '0x4AAAAAAAETUSAKbds019h0'

export const USER_API_URL = `${BASE_API}user/`
export const ACCOUNT_API_URL = `${BASE_API}account/`
export const BILI_API_URL = `${BASE_API}bili/`
export const SONG_API_URL = `${BASE_API}song-list/`
