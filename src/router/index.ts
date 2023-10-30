import { createRouter, createWebHistory, RouteRecordRaw } from 'vue-router'
import IndexView from '../views/IndexView.vue'

const routes: Array<RouteRecordRaw> = [
  {
    path: '/',
    name: 'index',
    component: IndexView,
  },
  {
    path: '/verify',
    name: 'verify',
    component: () => import('@/views/VerifyView.vue'),
  },
  {
    path: '/about',
    name: 'about',
    component: () => import('@/views/AboutView.vue'),
  },
  {
    path: '/reset-password',
    name: 'resetPassword',
    component: () => import('@/views/ChangePasswordView.vue'),
  },
  {
    path: '/video-collect/:id',
    name: 'video-collect',
    component: () => import('@/views/VideoCollectPublic.vue'),
    meta: {
      title: '推荐 · 视频征集',
      keepAlive: true,
    },
  },
  {
    path: '/video-collect/list/:id',
    name: 'video-collect-list',
    component: () => import('@/views/VideoCollectListView.vue'),
    meta: {
      title: '结果 · 视频征集',
      keepAlive: true,
    },
  },
  {
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
  },
  //管理页面
  {
    path: '/manage',
    name: 'manage',
    children: [
      {
        path: '',
        name: 'manage-index',
        component: () => import('@/views/manage/DashboardView.vue'),
        meta: {
          title: '面板',
        },
      },
      {
        path: 'song-list',
        name: 'manage-songList',
        component: () => import('@/views/manage/SongListManageView.vue'),
        meta: {
          title: '歌单',
          keepAlive: true,
        },
      },
      {
        path: 'question-box',
        name: 'manage-questionBox',
        component: () => import('@/views/manage/QuestionBoxManageView.vue'),
        meta: {
          title: '提问箱',
          keepAlive: true,
        },
      },
      {
        path: 'lottery',
        name: 'manage-lottery',
        component: () => import('@/views/manage/LotteryView.vue'),
        meta: {
          title: '动态抽奖',
          keepAlive: true,
        },
      },
      {
        path: 'bili-verify',
        name: 'manage-biliVerify',
        component: () => import('@/views/manage/BiliVerifyView.vue'),
        meta: {
          title: 'Bilibili认证',
        },
      },
      {
        path: 'history',
        name: 'manage-history',
        component: () => import('@/views/manage/HistoryView.vue'),
        meta: {
          title: '数据跟踪',
          keepAlive: true,
        },
      },
      {
        path: 'schedule',
        name: 'manage-schedule',
        component: () => import('@/views/manage/ScheduleManageView.vue'),
        meta: {
          title: '日程',
          keepAlive: true,
        },
      },
      {
        path: 'event',
        name: 'manage-event',
        component: () => import('@/views/manage/EventView.vue'),
        meta: {
          title: '事件记录',
          keepAlive: true,
        },
      },
      {
        path: 'video-collect',
        name: 'manage-videoCollect',
        component: () => import('@/views/manage/VideoCollectManageView.vue'),
        meta: {
          title: '视频征集',
          keepAlive: true,
        },
      },
      {
        path: 'video-collect/:id',
        name: 'manage-videoCollect-Detail',
        component: () => import('@/views/manage/VideoCollectDetailView.vue'),
        meta: {
          title: '详情 · 视频征集',
          keepAlive: true,
          parent: 'manage-videoCollect',
        },
      },
    ],
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'notfound',
    component: import('@/views/NotfoundView.vue'),
    meta: {
      title: '页面不存在',
    },
  },
]

const router = createRouter({
  history: createWebHistory(process.env.BASE_URL),
  routes,
})

export default router
