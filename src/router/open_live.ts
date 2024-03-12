export default {
  path: '/open-live',
  name: 'open-live',
  children: [
    {
      path: '',
      name: 'open-live-index',
      component: () => import('@/views/open_live/OpenLiveIndex.vue'),
      meta: {
        title: '开放平台',
      },
    },
    {
      path: 'lottery',
      name: 'open-live-lottery',
      component: () => import('@/views/open_live/OpenLottery.vue'),
      meta: {
        title: '直播抽奖',
      },
    },
    {
      path: 'live-request',
      name: 'open-live-live-request',
      component: () => import('@/views/open_live/LiveRequest.vue'),
      meta: {
        title: '点歌',
      },
    },
    {
      path: 'queue',
      name: 'open-live-queue',
      component: () => import('@/views/open_live/OpenQueue.vue'),
      meta: {
        title: '排队',
      },
    },
    {
      path: 'speech',
      name: 'open-live-speech',
      component: () => import('@/views/open_live/ReadDanmaku.vue'),
      meta: {
        title: '读弹幕',
      },
    },
  ],
}
