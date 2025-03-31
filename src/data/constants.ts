import DefaultIndexTemplateVue from '@/views/view/indexTemplate/DefaultIndexTemplate.vue';
import { defineAsyncComponent, ref } from 'vue';

const debugAPI =
  import.meta.env.VITE_API == 'dev'
    ? import.meta.env.VITE_DEBUG_DEV_API
    : import.meta.env.VITE_DEBUG_RELEASE_API;
const releseAPI = `https://vtsuru.suki.club/`;
const failoverAPI = `https://failover-api.vtsuru.suki.club/`;

export const isBackendUsable = ref(true);
export const isDev = import.meta.env.MODE === 'development';

export const AVATAR_URL = 'https://workers.vrp.moe/api/bilibili/avatar/';
export const FILE_BASE_URL = 'https://files.vtsuru.live';
export const IMGUR_URL = FILE_BASE_URL + '/imgur/';
export const THINGS_URL = FILE_BASE_URL + '/things/';
export const apiFail = ref(false);

export const BASE_URL =
  process.env.NODE_ENV === 'development'
    ? debugAPI
    : apiFail.value
      ? failoverAPI
      : releseAPI;
export const BASE_API_URL = BASE_URL + 'api/';
export const FETCH_API = 'https://fetch.vtsuru.live/';
export const BASE_HUB_URL =
  (process.env.NODE_ENV === 'development'
    ? debugAPI
    : apiFail.value
      ? failoverAPI
      : releseAPI) + 'hub/';

export const TURNSTILE_KEY = '0x4AAAAAAAETUSAKbds019h0';

export const CURRENT_HOST = `${window.location.protocol}//${window.location.host}/`;
export const CN_HOST = 'https://vtsuru.suki.club/';

export const USER_API_URL = BASE_API_URL + 'user/';
export const ACCOUNT_API_URL = BASE_API_URL + 'account/';
export const BILI_API_URL = BASE_API_URL + 'bili/';
export const SONG_API_URL = BASE_API_URL + 'song-list/';
export const NOTIFACTION_API_URL = BASE_API_URL + 'notification/';
export const QUESTION_API_URL = BASE_API_URL + 'qa/';
export const LOTTERY_API_URL = BASE_API_URL + 'lottery/';
export const HISTORY_API_URL = BASE_API_URL + 'history/';
export const SCHEDULE_API_URL = BASE_API_URL + 'schedule/';
export const VIDEO_COLLECT_API_URL = BASE_API_URL + 'video-collect/';
export const OPEN_LIVE_API_URL = BASE_API_URL + 'open-live/';
export const SONG_REQUEST_API_URL = BASE_API_URL + 'live-request/';
export const QUEUE_API_URL = BASE_API_URL + 'queue/';
export const EVENT_API_URL = BASE_API_URL + 'event/';
export const LIVE_API_URL = BASE_API_URL + 'live/';
export const FEEDBACK_API_URL = BASE_API_URL + 'feedback/';
export const MUSIC_REQUEST_API_URL = BASE_API_URL + 'music-request/';
export const VTSURU_API_URL = BASE_API_URL + 'vtsuru/';
export const POINT_API_URL = BASE_API_URL + 'point/';
export const BILI_AUTH_API_URL = BASE_API_URL + 'bili-auth/';
export const FORUM_API_URL = BASE_API_URL + 'forum/';
export const USER_INDEX_API_URL = BASE_API_URL + 'user-index/';
export const ANALYZE_API_URL = BASE_API_URL + 'analyze/';

export type TemplateMapType = {
  [key: string]: {
    name: string;
    settingName?: string;
    component: any;
  };
};
export const ScheduleTemplateMap: TemplateMapType = {
  '': {
    name: '默认',
    //settingName: 'Template.Schedule.Default',
    component: defineAsyncComponent(
      () => import('@/views/view/scheduleTemplate/DefaultScheduleTemplate.vue')
    )
  },
  pinky: {
    name: '粉粉',
    //settingName: 'Template.Schedule.Pinky',
    component: defineAsyncComponent(
      () => import('@/views/view/scheduleTemplate/PinkySchedule.vue')
    )
  }
};
export const SongListTemplateMap: TemplateMapType = {
  '': {
    name: '默认',
    //settingName: 'Template.SongList.Default',
    component: defineAsyncComponent(
      () => import('@/views/view/songListTemplate/DefaultSongListTemplate.vue')
    )
  },
  simple: {
    name: '简单',
    //settingName: 'Template.SongList.Simple',
    component: defineAsyncComponent(
      () => import('@/views/view/songListTemplate/SimpleSongListTemplate.vue')
    )
  },
  traditional: {
    name: '列表',
    settingName: 'Template.SongList.Traditional',
    component: defineAsyncComponent(
      () =>
        import('@/views/view/songListTemplate/TraditionalSongListTemplate.vue')
    )
  }
};

export const IndexTemplateMap: TemplateMapType = {
  '': {
    name: '默认',
    //settingName: 'Template.Index.Default',
    component: DefaultIndexTemplateVue
  }
};
