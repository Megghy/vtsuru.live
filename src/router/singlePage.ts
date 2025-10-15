import type { RouteRecordRaw } from 'vue-router'

export default [
  {
    path: '/question-display',
    name: 'question-display',
    component: async () => import('@/views/single/QuestionDisplay.vue'),
    meta: {
      title: '棉花糖展示页',
    },
  },
  {
    path: '/playground/test',
    name: 'test',
    component: async () => import('@/views/TestView.vue'),
    meta: {
      title: '测试页',
    },
  },
  {
    path: '/danmaku-window',
    name: 'client-danmaku-window',
    component: async () => import('@/client/ClientDanmakuWindow.vue'),
    meta: {
      title: '弹幕窗口',
      ignoreLogin: true,
      forceReload: true,
    },
  },
] satisfies RouteRecordRaw[]
