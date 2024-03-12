import DefaultIndexTemplateVue from '@/views/view/indexTemplate/DefaultIndexTemplate.vue'
import { defineAsyncComponent, ref } from 'vue'

const debugAPI = import.meta.env.VITE_DEBUG_API
const releseAPI = `https://vtsuru.suki.club/`
const failoverAPI = `https://failover-api.vtsuru.suki.club/`

export const isBackendUsable = ref(true)

export const AVATAR_URL = 'https://workers.vrp.moe/api/bilibili/avatar/'
export const FILE_BASE_URL = 'https://files.vtsuru.live'
export const IMGUR_URL = FILE_BASE_URL + '/imgur/'
export const THINGS_URL = FILE_BASE_URL + '/things/'
export const apiFail = ref(false)

export const BASE_API = {
  toString: () =>
    (process.env.NODE_ENV === 'development' ? debugAPI : apiFail.value ? failoverAPI : releseAPI) + 'api/',
}
export const FETCH_API = 'https://fetch.vtsuru.live/'
export const BASE_HUB_URL = {
  toString: () =>
    (process.env.NODE_ENV === 'development' ? debugAPI : apiFail.value ? failoverAPI : releseAPI) + 'hub/',
}

export const TURNSTILE_KEY = '0x4AAAAAAAETUSAKbds019h0'

export const USER_API_URL = { toString: () => `${BASE_API}user/` }
export const ACCOUNT_API_URL = { toString: () => `${BASE_API}account/` }
export const BILI_API_URL = { toString: () => `${BASE_API}bili/` }
export const SONG_API_URL = { toString: () => `${BASE_API}song-list/` }
export const NOTIFACTION_API_URL = { toString: () => `${BASE_API}notifaction/` }
export const QUESTION_API_URL = { toString: () => `${BASE_API}qa/` }
export const LOTTERY_API_URL = { toString: () => `${BASE_API}lottery/` }
export const HISTORY_API_URL = { toString: () => `${BASE_API}history/` }
export const SCHEDULE_API_URL = { toString: () => `${BASE_API}schedule/` }
export const VIDEO_COLLECT_API_URL = { toString: () => `${BASE_API}video-collect/` }
export const OPEN_LIVE_API_URL = { toString: () => `${BASE_API}open-live/` }
export const SONG_REQUEST_API_URL = { toString: () => `${BASE_API}live-request/` }
export const QUEUE_API_URL = { toString: () => `${BASE_API}queue/` }
export const EVENT_API_URL = { toString: () => `${BASE_API}event/` }
export const LIVE_API_URL = { toString: () => `${BASE_API}live/` }
export const FEEDBACK_API_URL = { toString: () => `${BASE_API}feedback/` }
export const MUSIC_REQUEST_API_URL = { toString: () => `${BASE_API}music-request/` }
export const VTSURU_API_URL = { toString: () => `${BASE_API}vtsuru/` }
export const POINT_API_URL = { toString: () => `${BASE_API}point/` }
export const BILI_AUTH_API_URL = { toString: () => `${BASE_API}bili-auth/` }

export const ScheduleTemplateMap = {
  '': {
    name: '默认',
    compoent: defineAsyncComponent(() => import('@/views/view/scheduleTemplate/DefaultScheduleTemplate.vue')),
  },
  pinky: {
    name: '粉粉',
    compoent: defineAsyncComponent(() => import('@/views/view/scheduleTemplate/PinkySchedule.vue')),
  },
} as { [key: string]: { name: string; compoent: any } }
export const SongListTemplateMap = {
  '': {
    name: '默认',
    compoent: defineAsyncComponent(() => import('@/views/view/songListTemplate/DefaultSongListTemplate.vue')),
  },
  simple: {
    name: '简单',
    compoent: defineAsyncComponent(() => import('@/views/view/songListTemplate/SimpleSongListTemplate.vue')),
  },
} as { [key: string]: { name: string; compoent: any } }
export const IndexTemplateMap = {
  '': { name: '默认', compoent: DefaultIndexTemplateVue },
} as { [key: string]: { name: string; compoent: any } }
