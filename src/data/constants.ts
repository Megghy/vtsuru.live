import DefaultIndexTemplateVue from '@/views/view/indexTemplate/DefaultIndexTemplate.vue';
import { defineAsyncComponent, ref, markRaw } from 'vue';

const debugAPI =
  import.meta.env.VITE_API == 'dev'
    ? import.meta.env.VITE_DEBUG_DEV_API
    : import.meta.env.VITE_DEBUG_RELEASE_API;
const releseAPI = `https://vtsuru.suki.club/`;
const failoverAPI = `https://failover-api.vtsuru.suki.club/`;

export const isBackendUsable = ref(true);
export const isDev = import.meta.env.MODE === 'development';
// @ts-ignore
export const isTauri = () => window.__TAURI__ !== undefined || window.__TAURI_INTERNAL__ !== undefined || '__TAURI__' in window;

export const AVATAR_URL = 'https://workers.vrp.moe/api/bilibili/avatar/';
export const FILE_BASE_URL = 'https://files.vtsuru.suki.club';
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

export const CURRENT_HOST = `${window.location.protocol}//${isDev ? window.location.host : 'vtsuru.live'}/`;
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
export const CHECKIN_API_URL = BASE_API_URL + 'checkin/';
export const USER_CONFIG_API_URL = BASE_API_URL + 'user-config/';
export const FILE_API_URL = BASE_API_URL + 'files/';
export const VOTE_API_URL = BASE_API_URL + 'vote/';

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
    component: markRaw(defineAsyncComponent(
      () => import('@/views/view/scheduleTemplate/DefaultScheduleTemplate.vue')
    ))
  },
  pinky: {
    name: '粉粉',
    //settingName: 'Template.Schedule.Pinky',
    component: markRaw(defineAsyncComponent(
      () => import('@/views/view/scheduleTemplate/PinkySchedule.vue')
    ))
  },
  kawaii: {
    name: '可爱手帐 (未完成',
    settingName: 'Template.Schedule.Kawaii',
    component: markRaw(defineAsyncComponent(
      () => import('@/views/view/scheduleTemplate/KawaiiSchedule.vue')
    ))
  }
};
export const SongListTemplateMap: TemplateMapType = {
  '': {
    name: '默认',
    //settingName: 'Template.SongList.Default',
    component: markRaw(defineAsyncComponent(
      () => import('@/views/view/songListTemplate/DefaultSongListTemplate.vue')
    ))
  },
  traditional: {
    name: '列表 (较推荐',
    settingName: 'Template.SongList.Traditional',
    component: markRaw(defineAsyncComponent(
      () =>
        import('@/views/view/songListTemplate/TraditionalSongListTemplate.vue')
    ))
  },
  simple: {
    name: '简单',
    //settingName: 'Template.SongList.Simple',
    component: markRaw(defineAsyncComponent(
      () => import('@/views/view/songListTemplate/SimpleSongListTemplate.vue')
    ))
  },
};

export const IndexTemplateMap: TemplateMapType = {
  '': {
    name: '默认',
    //settingName: 'Template.Index.Default',
    component: markRaw(DefaultIndexTemplateVue)
  }
};

export const defaultDanmujiCss = `@import url("https://fonts.googleapis.com/css?family=Changa%20One");
@import url("https://fonts.googleapis.com/css?family=Imprima");

/* Transparent background */
yt-live-chat-renderer {
  background-color: transparent !important;
}

yt-live-chat-ticker-renderer {
  background-color: transparent !important;
  box-shadow: none !important;
}

yt-live-chat-author-chip #author-name {
  background-color: transparent !important;
}

yt-live-chat-item-list-renderer #item-scroller {
  overflow: hidden !important;
}

yt-live-chat-interact-message-renderer #content,
yt-live-chat-text-message-renderer #content,
yt-live-chat-membership-item-renderer #content {
  overflow: visible !important;
}

/* Hide header and input */
yt-live-chat-header-renderer,
yt-live-chat-message-input-renderer {
  display: none !important;
}

/* Hide unimportant messages */
yt-live-chat-interact-message-renderer[is-deleted],
yt-live-chat-text-message-renderer[is-deleted],
yt-live-chat-membership-item-renderer[is-deleted] {
  display: none !important;
}

yt-live-chat-mode-change-message-renderer,
yt-live-chat-viewer-engagement-message-renderer,
yt-live-chat-restricted-participation-renderer {
  display: none !important;
}

yt-live-chat-text-message-renderer a,
yt-live-chat-membership-item-renderer a {
  text-decoration: none !important;
}

/* Global Setting */
yt-live-chat-renderer {

}
#item-scroller {

}

/* Reduce side padding */
yt-live-chat-interact-message-renderer,
yt-live-chat-text-message-renderer {
  padding-left: 4px !important;
  padding-right: 4px !important;
}

/* Outlines */
yt-live-chat-renderer * {
  text-shadow: -2px -2px #000000, -2px -1px #000000, -2px 0px #000000, -2px 1px #000000, -2px 2px #000000, -1px -2px #000000, -1px -1px #000000, -1px 0px #000000, -1px 1px #000000, -1px 2px #000000, 0px -2px #000000, 0px -1px #000000, 0px 0px #000000, 0px 1px #000000, 0px 2px #000000, 1px -2px #000000, 1px -1px #000000, 1px 0px #000000, 1px 1px #000000, 1px 2px #000000, 2px -2px #000000, 2px -1px #000000, 2px 0px #000000, 2px 1px #000000, 2px 2px #000000;
  font-family: "Imprima", "Helvetica Neue", Helvetica, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "微软雅黑", SimHei, Arial, sans-serif;
  font-size: 18px !important;
  line-height: 20px !important;
}

/* Avatars */
yt-live-chat-interact-message-renderer #author-photo,
yt-live-chat-interact-message-renderer #author-photo img,
yt-live-chat-text-message-renderer #author-photo,
yt-live-chat-text-message-renderer #author-photo img,
yt-live-chat-paid-message-renderer #author-photo,
yt-live-chat-paid-message-renderer #author-photo img,
yt-live-chat-membership-item-renderer #author-photo,
yt-live-chat-membership-item-renderer #author-photo img {

  width: 24px !important;
  height: 24px !important;
  border-radius: 24px !important;
  margin-right: 6px !important;
}

/* Channel names */
yt-live-chat-interact-message-renderer #content #author-name,
yt-live-chat-text-message-renderer #content #author-name {

}
yt-live-chat-interact-message-renderer #author-name[type="owner"],
yt-live-chat-interact-message-renderer yt-live-chat-author-badge-renderer[type="owner"],
yt-live-chat-text-message-renderer #author-name[type="owner"],
yt-live-chat-text-message-renderer yt-live-chat-author-badge-renderer[type="owner"] {
  color: #ffd600 !important;
}
yt-live-chat-interact-message-renderer #author-name[type="moderator"],
yt-live-chat-interact-message-renderer yt-live-chat-author-badge-renderer[type="moderator"],
yt-live-chat-text-message-renderer #author-name[type="moderator"],
yt-live-chat-text-message-renderer yt-live-chat-author-badge-renderer[type="moderator"] {
  color: #5e84f1 !important;
}
yt-live-chat-interact-message-renderer #author-name[type="member"],
yt-live-chat-interact-message-renderer yt-live-chat-author-badge-renderer[type="member"],
yt-live-chat-text-message-renderer #author-name[type="member"],
yt-live-chat-text-message-renderer yt-live-chat-author-badge-renderer[type="member"] {
  color: #0f9d58 !important;
}

yt-live-chat-interact-message-renderer #author-name,
yt-live-chat-text-message-renderer #author-name {

  color: #cccccc !important;
  font-family: "Changa One", "Helvetica Neue", Helvetica, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "微软雅黑", SimHei, Arial, sans-serif;
  font-size: 20px !important;
  line-height: 20px !important;
}

/* Show colon */
yt-live-chat-text-message-renderer #author-name::after {
  content: ":";
  margin-left: 2px;
}

/* Hide badges */
yt-live-chat-interact-message-renderer #chat-badges,
yt-live-chat-text-message-renderer #chat-badges {

  vertical-align: text-top !important;
}
img.yt-live-chat-author-badge-renderer, yt-icon.yt-live-chat-author-badge-renderer {
  width: 20px;
  height: 20px;
}

/* Medal */
yt-live-chat-author-medal-renderer {
    display: none;

}
yt-live-chat-author-medal-renderer[is-fan-group] {
  display: flex;
}
#medal-name.yt-live-chat-author-medal-renderer {

  font-size: 14px !important;
  line-height: 14px !important;
}

#medal-level.yt-live-chat-author-medal-renderer {

  font-size: 14px !important;
  line-height: 14px !important;
}


/* Messages */
yt-live-chat-interact-message-renderer #message,
yt-live-chat-interact-message-renderer #message *,
yt-live-chat-text-message-renderer #message,
yt-live-chat-text-message-renderer #message * {
  color: #ffffff !important;
  font-family: "Imprima", "Helvetica Neue", Helvetica, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "微软雅黑", SimHei, Arial, sans-serif;
  font-size: 18px !important;
  line-height: 18px !important;
}

yt-live-chat-text-message-renderer #image-and-message {
  display: inline !important;
  overflow: visible !important;
}




yt-live-chat-text-message-renderer #message {
  display: inline !important;
  overflow: visible !important;
}

yt-live-chat-text-message-renderer #image-and-message .emoji {
  width: auto !important;
  height: 48px !important;
}

#image-and-message img[display="block"] {
  border-radius: 4px;
}

#image-and-message img[display="inline"] {
  position: relative;
  top: 3px;
  border-radius: 0px;
}

/* Timestamps */



/* Background colors */
body {
  overflow: hidden;
  background-color: rgba(0, 0, 0, 0);
}

yt-live-chat-text-message-renderer,
yt-live-chat-text-message-renderer[is-highlighted] {
  background-color: rgba(204, 204, 204, 0) !important;
}

yt-live-chat-text-message-renderer[author-type="owner"],
yt-live-chat-text-message-renderer[author-type="owner"][is-highlighted] {
  background-color: rgba(255, 214, 0, 0) !important;
}

yt-live-chat-text-message-renderer[author-type="moderator"],
yt-live-chat-text-message-renderer[author-type="moderator"][is-highlighted] {
  background-color: rgba(94, 132, 241, 0) !important;
}

yt-live-chat-text-message-renderer[author-type="member"],
yt-live-chat-text-message-renderer[author-type="member"][is-highlighted] {
  background-color: rgba(15, 157, 88, 0) !important;
}

/* SuperChat/Fan Funding Messages */
yt-live-chat-paid-message-renderer {
  margin: 4px 0 !important;
}

yt-live-chat-paid-message-renderer #author-name,
yt-live-chat-paid-message-renderer #author-name *,
yt-live-chat-membership-item-renderer #header-content-inner-column,
yt-live-chat-membership-item-renderer #header-content-inner-column * {
  color: #ffffff !important;
  font-family: "Changa One", "Helvetica Neue", Helvetica, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "微软雅黑", SimHei, Arial, sans-serif;
  font-size: 20px !important;
  line-height: 20px !important;
}

yt-live-chat-paid-message-renderer #purchase-amount,
yt-live-chat-paid-message-renderer #purchase-amount *,
yt-live-chat-membership-item-renderer #header-subtext,
yt-live-chat-membership-item-renderer #header-subtext * {
  color: #ffffff !important;
  font-family: "Imprima", "Helvetica Neue", Helvetica, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "微软雅黑", SimHei, Arial, sans-serif;
  font-size: 18px !important;
  line-height: 18px !important;
}

yt-live-chat-paid-message-renderer #content,
yt-live-chat-paid-message-renderer #content * {
  color: #ffffff !important;
  font-family: "Imprima", "Helvetica Neue", Helvetica, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "微软雅黑", SimHei, Arial, sans-serif;
  font-size: 18px !important;
  line-height: 18px !important;
}

yt-live-chat-membership-item-renderer #card,
yt-live-chat-membership-item-renderer #header {
  background-color: #0f9d58 !important;
  margin: 4px 0 !important;
}

yt-live-chat-ticker-renderer {
  display: none !important;
}

/* SuperChat Ticker */
yt-live-chat-ticker-paid-message-item-renderer,
yt-live-chat-ticker-paid-message-item-renderer *,
yt-live-chat-ticker-sponsor-item-renderer,
yt-live-chat-ticker-sponsor-item-renderer * {
  color: #ffffff !important;
  font-family: "Imprima", "Helvetica Neue", Helvetica, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "微软雅黑", SimHei, Arial, sans-serif;
}



/* Animation */
@keyframes anim {

}

yt-live-chat-interact-message-renderer,
yt-live-chat-text-message-renderer,
yt-live-chat-membership-item-renderer,
yt-live-chat-paid-message-renderer {
  animation: anim 0ms;
  animation-fill-mode: both;
}
`