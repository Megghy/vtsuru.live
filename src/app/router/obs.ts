import { RouterView } from 'vue-router'

export default {
  path: '/obs',
  name: 'obs',
  component: RouterView,
  children: [
    {
      path: 'live-lottery',
      name: 'obs-live-lottery',
      component: async () => import('@/apps/obs/pages/LiveLotteryOBS.vue'),
      meta: {
        title: '直播抽奖',
        forceReload: true,
      },
    },
    {
      path: 'live-request',
      name: 'obs-live-request',
      alias: 'song-request',
      component: async () => import('@/apps/obs/pages/request/LiveRequestOBS.vue'),
      meta: {
        title: '弹幕点播',
        forceReload: true,
      },
    },
    {
      path: 'live-request-today',
      name: 'obs-live-request-today',
      component: async () => import('@/apps/obs/pages/request/LiveRequestProcessedOBS.vue'),
      meta: {
        title: '弹幕点播-今日',
        forceReload: true,
      },
    },
    {
      path: 'queue',
      name: 'obs-queue',
      component: async () => import('@/apps/obs/pages/QueueOBS.vue'),
      meta: {
        title: '弹幕排队',
        forceReload: true,
      },
    },
    {
      path: 'music-request',
      name: 'obs-music-request',
      component: async () => import('@/apps/obs/pages/request/MusicRequestOBS.vue'),
      meta: {
        title: '弹幕排队 (播放列表)',
        forceReload: true,
      },
    },
    {
      path: 'question-display',
      name: 'obs-question-display',
      component: async () => import('@/apps/obs/pages/QuestionDisplayOBS.vue'),
      meta: {
        title: '棉花糖展示',
        forceReload: true,
      },
    },
    {
      path: 'web-fetcher',
      name: 'obs-web-fetcher',
      component: async () => import('@/apps/obs/pages/WebFetcherOBS.vue'),
      meta: {
        title: '弹幕收集器 (OBS版)',
        forceReload: true,
      },
    },
    {
      path: 'danmuji',
      name: 'obs-danmuji',
      component: async () => import('@/apps/obs/pages/DanmujiOBS.vue'),
      meta: {
        title: '弹幕姬',
        forceReload: true,
      },
    },
    {
      path: 'danmaku-vote',
      name: 'obs-danmaku-vote',
      component: async () => import('@/apps/obs/pages/DanmakuVoteOBS.vue'),
      meta: {
        title: '弹幕投票',
        forceReload: true,
      },
    },
  ],
}
