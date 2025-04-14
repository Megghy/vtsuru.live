export default [
  {
    path: '/question-display',
    name: 'question-display',
    component: () => import('@/views/single/QuestionDisplay.vue'),
    meta: {
      title: '棉花糖展示页'
    }
  },
  {
    path: '/playground/test',
    name: 'test',
    component: () => import('@/views/TestView.vue'),
    meta: {
      title: '测试页'
    }
  },
  {
    path: '/danmaku-window',
    name: 'client-danmaku-window',
    component: () => import('@/client/ClientDanmakuWindow.vue'),
    meta: {
      title: '弹幕窗口',
      ignoreLogin: true
    }
  }
]
