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
    path: '/user/:id',
    name: 'user',
    children: [
      {
        path: '',
        name: 'user-index',
        component: () => import('@/views/view/UserIndexView.vue'),
        meta: {
          title: '主页',
        },
      },
      {
        path: 'song-list',
        name: 'user-songList',
        component: () => import('@/views/view/SongListView.vue'),
        meta: {
          title: '歌单',
        },
      },
      {
        path: 'question-box',
        name: 'user-questionBox',
        component: () => import('@/views/view/QuestionBoxView.vue'),
        meta: {
          title: '棉花糖 (提问箱',
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
          title: '管理',
        },
      },
      {
        path: 'song-list',
        name: 'manage-songList',
        component: () => import('@/views/manage/SongListManageView.vue'),
      },
      {
        path: 'question-box',
        name: 'manage-questionBox',
        component: () => import('@/views/manage/QuestionBoxManageView.vue'),
      },
      {
        path: 'lottery',
        name: 'manage-lottery',
        component: () => import('@/views/manage/LotteryView.vue'),
      },
      {
        path: 'bili-verify',
        name: 'manage-biliVerify',
        component: () => import('@/views/manage/BiliVerifyView.vue'),
      },
      {
        path: 'history',
        name: 'manage-history',
        component: () => import('@/views/manage/HistoryView.vue'),
      },
      {
        path: 'schedule',
        name: 'manage-schedule',
        component: () => import('@/views/manage/ScheduleManageView.vue'),
      },
    ],
  },
]

const router = createRouter({
  history: createWebHistory(process.env.BASE_URL),
  routes,
})

export default router
