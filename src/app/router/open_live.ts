import { createToolRoutes } from './toolRoutes'

export default {
  path: '/open-live',
  name: 'open-live',
  // 只做路径分组；页面由布局的 RouterView + KeepAlive 渲染。
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
      component: async () => import('@/apps/manage/pages/LotteryView.vue'),
      meta: {
        title: '直播抽奖',
        pageWidth: 'xl',
      },
    },
    {
      path: 'live-request',
      name: 'open-live-live-request',
      component: async () => import('@/apps/manage/pages/LiveRequestManageView.vue'),
      meta: {
        title: '点歌',
        pageWidth: 'xl',
      },
    },
    {
      path: 'queue',
      name: 'open-live-queue',
      component: async () => import('@/apps/manage/pages/QueueManageView.vue'),
      meta: {
        title: '排队',
        pageWidth: 'xl',
      },
    },
    {
      path: 'speech',
      name: 'open-live-speech',
      component: async () => import('@/apps/manage/pages/ReadDanmakuManageView.vue'),
      meta: {
        title: '读弹幕',
        pageWidth: 'md',
      },
    },
    {
      path: 'danmuji',
      name: 'open-live-danmuji',
      component: async () => import('@/apps/manage/pages/DanmujiManageView.vue'),
      meta: {
        title: '弹幕姬',
        pageWidth: 'full',
      },
    },
    {
      path: 'tools',
      name: 'open-live-tools',
      component: async () => import('@/apps/manage/pages/tools/ToolsDashboardView.vue'),
      meta: {
        title: '直播工具箱',
        pageWidth: 'xl',
        openLiveAuth: false,
      },
    },
    ...createToolRoutes('open-live'),
  ],
}
