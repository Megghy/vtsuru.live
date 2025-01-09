export default {
  path: '/obs',
  name: 'obs',
  children: [
    {
      path: 'live-lottery',
      name: 'obs-live-lottery',
      component: () => import('@/views/obs/LiveLotteryOBS.vue'),
      meta: {
        title: '直播抽奖'
      }
    },
    {
      path: 'live-request',
      name: 'obs-live-request',
      alias: 'song-request',
      component: () => import('@/views/obs/LiveRequestOBS.vue'),
      meta: {
        title: '弹幕点播'
      }
    },
    {
      path: 'live-request-today',
      name: 'obs-live-request-today',
      component: () => import('@/views/obs/LiveRequestProcessedOBS.vue'),
      meta: {
        title: '弹幕点播-今日'
      }
    },
    {
      path: 'queue',
      name: 'obs-queue',
      component: () => import('@/views/obs/QueueOBS.vue'),
      meta: {
        title: '弹幕排队'
      }
    },
    {
      path: 'music-request',
      name: 'obs-music-request',
      component: () => import('@/views/obs/MusicRequestOBS.vue'),
      meta: {
        title: '弹幕排队 (播放'
      }
    },
    {
      path: 'question-display',
      name: 'obs-question-display',
      component: () => import('@/views/obs/QuestionDisplayOBS.vue'),
      meta: {
        title: '棉花糖展示'
      }
    },
    {
      path: 'web-fetcher',
      name: 'obs-web-fetcher',
      component: () => import('@/views/obs/WebFetcherOBS.vue'),
      meta: {
        title: '弹幕收集器 (OBS版'
      }
    },
    {
      path: 'danmuji',
      name: 'obs-danmuji',
      component: () => import('@/views/obs/DanmujiOBS.vue'),
      meta: {
        title: '弹幕机'
      }
    }
  ]
}
