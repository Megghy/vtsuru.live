export default {
  path: '/user/:id',
  name: 'user',
  children: [
    {
      path: '',
      name: 'user-index',
      component: () => import('@/views/view/UserIndexView.vue'),
      meta: {
        title: '主页',
        keepAlive: true,
      },
    },
    {
      path: 'song-list',
      name: 'user-songList',
      component: () => import('@/views/view/SongListView.vue'),
      meta: {
        title: '歌单',
        keepAlive: true,
      },
    },
    {
      path: 'question-box',
      name: 'user-questionBox',
      component: () => import('@/views/view/QuestionBoxView.vue'),
      meta: {
        title: '提问箱',
        keepAlive: true,
      },
    },
    {
      path: 'schedule',
      name: 'user-schedule',
      component: () => import('@/views/view/ScheduleView.vue'),
      meta: {
        title: '日程',
        keepAlive: true,
      },
    },
  ],
}
