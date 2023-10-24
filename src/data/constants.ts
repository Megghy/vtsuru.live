import { ref } from 'vue'

const debugAPI = import.meta.env.VITE_DEBUG_API
const releseAPI = `https://vtsuru.suki.club/api/`

export const isBackendUsable = ref(true)

export const AVATAR_URL = 'https://workers.vrp.moe/api/bilibili/avatar/'

export const BASE_API = process.env.NODE_ENV === 'development' ? debugAPI : releseAPI
export const FETCH_API = 'https://fetch.vtsuru.live/'

export const TURNSTILE_KEY = '0x4AAAAAAAETUSAKbds019h0'

export const USER_API_URL = `${BASE_API}user/`
export const ACCOUNT_API_URL = `${BASE_API}account/`
export const BILI_API_URL = `${BASE_API}bili/`
export const SONG_API_URL = `${BASE_API}song-list/`
export const NOTIFACTION_API_URL = `${BASE_API}notifaction/`
export const QUESTION_API_URL = `${BASE_API}qa/`
export const LOTTERY_API_URL = `${BASE_API}lottery/`
export const HISTORY_API_URL = `${BASE_API}history/`
export const SCHEDULE_API_URL = `${BASE_API}schedule/`
