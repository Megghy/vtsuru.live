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
        component: () => import('@/views/view/IndexView.vue'),
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
        path: 'bili-verify',
        name: 'manage-biliVerify',
        component: () => import('@/views/manage/BiliVerifyView.vue'),
      },
    ],
  },
]

const router = createRouter({
  history: createWebHistory(process.env.BASE_URL),
  routes,
})

export default router
