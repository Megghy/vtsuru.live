export default [
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
    children: [
      {
        path: 'ics',
        name: 'user-schedule-ics',
        component: () => import('@/views/view/ScheduleView.vue'),
        beforeEnter(to: any) {
          // 直接重定向到外部 URL
          window.location.href = 'https://vtsuru.live/api/schedule/get-ics?id=' + to.query.id
        },
      },
    ],
  },
  {
    path: 'goods',
    name: 'user-goods',
    component: () => import('@/views/pointViews/PointGoodsView.vue'),
    meta: {
      title: '积分兑换',
      keepAlive: true,
    },
  },
  {
    path: 'video-collect',
    name: 'user-video-collect',
    component: () => import('@/views/view/VideoCollectView.vue'),
    meta: {
      title: '视频征集',
      keepAlive: true,
    },
  },
  {
    path: 'forum/topic/:topicId',
    name: 'user-forum-topic-detail',
    component: () => import('@/views/view/forumViews/ForumTopicDetail.vue'),
    meta: {
      title: '帖子详情',
      keepAlive: true,
    },
  },
  {
    path: 'forum',
    name: 'user-forum',
    component: () => import('@/views/view/forumViews/ForumView.vue'),
    meta: {
      title: '讨论区',
      keepAlive: true,
    },
  },
]
