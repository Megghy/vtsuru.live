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
      path: 'test',
      name: 'client-test',
      component: () => import('@/client/ClientTest.vue'),
      meta: {
        title: '测试',
      }
    },
  ]
}
