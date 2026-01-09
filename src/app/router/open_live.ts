import { RouterView } from 'vue-router'

export default {
  path: '/open-live',
  name: 'open-live',
  component: RouterView,
  children: [
    {
      path: '',
      name: 'open-live-index',
      component: async () => import('@/apps/open-live/pages/OpenLiveIndex.vue'),
      meta: {
        title: '开放平台',
        pageWidth: 'md',
      },
    },
    {
      path: 'lottery',
      name: 'open-live-lottery',
      component: async () => import('@/apps/open-live/pages/OpenLottery.vue'),
      meta: {
        title: '直播抽奖',
        pageWidth: 'xl',
      },
    },
    {
      path: 'live-request',
      name: 'open-live-live-request',
      component: async () => import('@/apps/open-live/pages/request/LiveRequest.vue'),
      meta: {
        title: '点歌',
        pageWidth: 'xl',
      },
    },
    {
      path: 'queue',
      name: 'open-live-queue',
      component: async () => import('@/apps/open-live/pages/OpenQueue.vue'),
      meta: {
        title: '排队',
        pageWidth: 'xl',
      },
    },
    {
      path: 'speech',
      name: 'open-live-speech',
      component: async () => import('@/apps/open-live/pages/ReadDanmaku.vue'),
      meta: {
        title: '读弹幕',
        pageWidth: 'md',
      },
    },
  ],
}
