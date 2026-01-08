import type { RouteRecordRaw } from 'vue-router'

export default [
  {
    path: '',
    name: 'user-index',
    component: async () => import('@/apps/user/pages/UserPageEntryView.vue'),
    meta: {
      title: '主页',
      keepAlive: true,
    },
  },
  {
    path: 'song-list',
    name: 'user-songList',
    component: async () => import('@/apps/user/pages/SongListView.vue'),
    meta: {
      title: '歌单',
      keepAlive: true,
    },
  },
  {
    path: 'question-box',
    name: 'user-questionBox',
    component: async () => import('@/apps/user/pages/QuestionBoxView.vue'),
    meta: {
      title: '提问箱',
      keepAlive: true,
    },
  },
  {
    path: 'schedule',
    name: 'user-schedule',
    component: async () => import('@/apps/user/pages/ScheduleView.vue'),
    meta: {
      title: '日程',
      keepAlive: true,
    },
    children: [
      {
        path: 'ics',
        name: 'user-schedule-ics',
        component: async () => import('@/apps/user/pages/ScheduleView.vue'),
        beforeEnter(to: any) {
          // 直接重定向到外部 URL
          window.location.href = `https://vtsuru.live/api/schedule/get-ics?id=${to.query.id}`
        },
      },
    ],
  },
  {
    path: 'goods',
    name: 'user-goods',
    alias: 'point',
    component: async () => import('@/apps/account/pages/point/PointGoodsView.vue'),
    meta: {
      title: '积分兑换',
      keepAlive: true,
    },
  },
  {
    path: 'check-in',
    name: 'user-checkin',
    component: async () => import('@/apps/user/pages/CheckInRankingView.vue'),
    meta: {
      title: '签到排行',
      keepAlive: true,
    },
  },
  {
    path: 'video-collect',
    name: 'user-video-collect',
    component: async () => import('@/apps/user/pages/VideoCollectView.vue'),
    meta: {
      title: '视频征集',
      keepAlive: true,
    },
  },
  {
    path: 'forum/topic/:topicId',
    name: 'user-forum-topic-detail',
    component: async () => import('@/apps/user/pages/forumViews/ForumTopicDetail.vue'),
    meta: {
      title: '帖子详情',
      keepAlive: true,
    },
  },
  {
    path: 'forum',
    name: 'user-forum',
    component: async () => import('@/apps/user/pages/forumViews/ForumView.vue'),
    meta: {
      title: '讨论区',
      keepAlive: true,
    },
  },
  {
    path: ':pageSlug',
    name: 'user-page',
    component: async () => import('@/apps/user/pages/UserPageEntryView.vue'),
    meta: {
      title: '页面',
      keepAlive: true,
    },
  },
] satisfies RouteRecordRaw[]
