import { RouterView } from 'vue-router'

export default {
  path: '/open-live',
  name: 'open-live',
  component: RouterView,
  children: [
    {
      path: '',
      name: 'open-live-index',
      component: async () => import('@/views/open_live/OpenLiveIndex.vue'),
      meta: {
        title: '开放平台',
      },
    },
    {
      path: 'lottery',
      name: 'open-live-lottery',
      component: async () => import('@/views/open_live/OpenLottery.vue'),
      meta: {
        title: '直播抽奖',
      },
    },
    {
      path: 'live-request',
      name: 'open-live-live-request',
      component: async () => import('@/views/open_live/LiveRequest.vue'),
      meta: {
        title: '点歌',
      },
    },
    {
      path: 'queue',
      name: 'open-live-queue',
      component: async () => import('@/views/open_live/OpenQueue.vue'),
      meta: {
        title: '排队',
      },
    },
    {
      path: 'speech',
      name: 'open-live-speech',
      component: async () => import('@/views/open_live/ReadDanmaku.vue'),
      meta: {
        title: '读弹幕',
      },
    },
  ],
}
