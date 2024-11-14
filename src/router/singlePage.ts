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
  }
]
