import { RouterView } from 'vue-router'

export default {
  path: '/client',
  name: 'client',
  component: RouterView,
  children: [
    {
      path: '',
      name: 'client-index',
      component: async () => import('@/client/ClientIndex.vue'),
      meta: {
        title: '首页',
        forceReload: true,
      },
    },
    {
      path: 'fetcher',
      name: 'client-fetcher',
      component: async () => import('@/client/ClientFetcher.vue'),
      meta: {
        title: 'EventFetcher',
        forceReload: true,
      },
    },
    {
      path: 'settings',
      name: 'client-settings',
      component: async () => import('@/client/ClientSettings.vue'),
      meta: {
        title: '设置',
        forceReload: true,
      },
    },
    {
      path: 'danmaku-window-manage',
      name: 'client-danmaku-window-manage',
      component: async () => import('@/client/DanmakuWindowManager.vue'),
      meta: {
        title: '弹幕窗口管理',
        forceReload: true,
      },
    },
    {
      path: 'auto-action',
      name: 'client-auto-action-manage',
      component: async () => import('@/client/ClientAutoAction.vue'),
      meta: {
        title: '自动操作管理',
        forceReload: true,
      },
    },
    {
      path: 'read-danmaku',
      name: 'client-read-danmaku',
      component: async () => import('@/client/ClientReadDanmaku.vue'),
      meta: {
        title: '读弹幕',
        forceReload: true,
      },
    },
    {
      path: 'live-manage',
      name: 'client-live-manage',
      component: async () => import('@/client/ClientLiveManage.vue'),
      meta: {
        title: '直播管理',
        forceReload: true,
      },
    },
    {
      path: 'danmaku-window',
      name: 'client-danmaku-window-redirect',
      redirect: {
        name: 'client-danmaku-window',
      },
    },
    {
      path: 'test',
      name: 'client-test',
      component: async () => import('@/client/ClientTest.vue'),
      meta: {
        title: '测试',
        forceReload: true,
      },
    },
  ],
}
