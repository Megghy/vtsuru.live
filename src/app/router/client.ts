export default {
  path: '/client',
  name: 'client',
  // 只做路径分组；页面由布局的 RouterView + KeepAlive 渲染。
  children: [
    {
      path: '',
      name: 'client-index',
      component: async () => import('@/apps/client/pages/ClientIndex.vue'),
      meta: {
        title: '首页',
        forceReload: true,
        pageWidth: 'xl',
      },
    },
    {
      path: 'fetcher',
      name: 'client-fetcher',
      component: async () => import('@/apps/client/pages/ClientFetcher.vue'),
      meta: {
        title: 'EventFetcher',
        forceReload: true,
        pageWidth: 'xl',
      },
    },
    {
      path: 'settings',
      name: 'client-settings',
      component: async () => import('@/apps/client/pages/ClientSettings.vue'),
      meta: {
        title: '设置',
        forceReload: true,
        pageWidth: 'xl',
      },
    },
    {
      path: 'danmaku-window-manage',
      name: 'client-danmaku-window-manage',
      component: async () => import('@/apps/client/pages/danmaku-window/DanmakuWindowManager.vue'),
      meta: {
        title: '弹幕窗口管理',
        forceReload: true,
        pageWidth: 'xl',
      },
    },
    {
      path: 'gift-window-manage',
      name: 'client-gift-window-manage',
      component: async () => import('@/apps/client/pages/gift-window/GiftWindowManager.vue'),
      meta: {
        title: '礼物与排行',
        forceReload: true,
        pageWidth: 'xl',
      },
    },
    {
      path: 'auto-action',
      name: 'client-auto-action-manage',
      component: async () => import('@/apps/client/pages/ClientAutoAction.vue'),
      meta: {
        title: '自动操作管理',
        forceReload: true,
        pageWidth: 'full',
      },
    },
    {
      path: 'pngtuber',
      name: 'client-pngtuber',
      component: async () => import('@/apps/client/pages/ClientPngtuber.vue'),
      meta: { title: 'PNGtuber', pageWidth: 'xl' },
    },
    {
      path: 'pngtuber/model',
      name: 'client-pngtuber-model',
      component: async () => import('@/apps/obs-store/components/pngtuber/PngtuberViewer.vue'),
      meta: { title: 'PNGtuber 模型', pageWidth: 'full' },
    },
    {
      path: 'vts',
      name: 'client-vts',
      component: async () => import('@/apps/client/pages/ClientVTS.vue'),
      meta: {
        title: 'VTS 控制',
        forceReload: true,
        pageWidth: 'xl',
      },
    },
    {
      path: 'transcription',
      name: 'client-transcription',
      component: async () => import('@/apps/client/pages/ClientTranscription.vue'),
      meta: {
        title: '语音转写',
        pageWidth: 'xl',
      },
    },
    {
      path: 'read-danmaku',
      name: 'client-read-danmaku',
      component: async () => import('@/apps/client/pages/ClientReadDanmaku.vue'),
      meta: {
        title: '读弹幕',
        forceReload: true,
        pageWidth: 'full',
        pageContainer: 'none',
      },
    },
    {
      path: 'live-manage',
      name: 'client-live-manage',
      component: async () => import('@/apps/client/pages/ClientLiveManage.vue'),
      meta: {
        title: '直播管理',
        forceReload: true,
        pageWidth: 'xl',
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
      path: 'gift-window',
      name: 'client-gift-window-redirect',
      redirect: {
        name: 'client-gift-window',
      },
    },
    {
      path: 'test',
      name: 'client-test',
      component: async () => import('@/apps/client/pages/ClientTest.vue'),
      meta: {
        title: '测试',
        forceReload: true,
        pageWidth: 'full',
      },
    },
  ],
}
