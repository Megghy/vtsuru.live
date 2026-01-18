import type { RouteRecordRaw } from 'vue-router'

export default [
  {
    path: '/question-display',
    name: 'question-display',
    component: async () => import('@/apps/web/pages/QuestionDisplay.vue'),
    meta: {
      title: '棉花糖展示页',
    },
  },
  {
    path: '/playground/test',
    name: 'test',
    component: async () => import('@/apps/web/pages/TestView.vue'),
    meta: {
      title: '测试页',
    },
  },
  {
    path: '/danmaku-window',
    name: 'client-danmaku-window',
    component: async () => import('@/apps/client/pages/danmaku-window/ClientDanmakuWindow.vue'),
    meta: {
      title: '弹幕窗口',
      ignoreLogin: true,
      forceReload: true,
    },
  },
  {
    path: '/vts-float-window',
    name: 'client-vts-float-window',
    component: async () => import('@/apps/client/pages/vts-window/ClientVtsFloatWindow.vue'),
    meta: {
      title: 'VTS 悬浮小窗',
      ignoreLogin: true,
      forceReload: true,
    },
  },
] satisfies RouteRecordRaw[]
