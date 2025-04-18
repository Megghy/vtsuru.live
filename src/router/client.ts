export default {
  path: '/client',
  name: 'client',
  children: [
    {
      path: '',
      name: 'client-index',
      component: () => import('@/client/ClientIndex.vue'),
      meta: {
        title: '首页',
      }
    },
    {
      path: 'fetcher',
      name: 'client-fetcher',
      component: () => import('@/client/ClientFetcher.vue'),
      meta: {
        title: 'EventFetcher',
      }
    },
    {
      path: 'settings',
      name: 'client-settings',
      component: () => import('@/client/ClientSettings.vue'),
      meta: {
        title: '设置',
      }
    },
    {
      path: 'danmaku-window-manage',
      name: 'client-danmaku-window-manage',
      component: () => import('@/client/DanmakuWindowManager.vue'),
      meta: {
        title: '弹幕窗口管理',
      }
    },
    {
      path: 'auto-action',
      name: 'client-auto-action-manage',
      component: () => import('@/client/ClientAutoAction.vue'),
      meta: {
        title: '自动操作管理',
      }
    },
    {
      path: 'danmaku-window',
      name: 'client-danmaku-window-redirect',
      redirect: {
        name: 'client-danmaku-window'
      }
    },
    {
      path: 'test',
      name: 'client-test',
      component: () => import('@/client/ClientTest.vue'),
      meta: {
        title: '测试',
      }
    },
  ]
}
