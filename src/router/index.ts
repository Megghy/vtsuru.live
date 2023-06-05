import { createRouter, createWebHistory, RouteRecordRaw } from 'vue-router'
import IndexView from '../views/IndexView.vue'

const routes: Array<RouteRecordRaw> = [
  {
    path: '/',
    name: 'index',
    component: IndexView,
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
        path: 'songlist',
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
        path: 'songlist',
        name: 'songList',
        component: () => import('@/views/view/SongListView.vue'),
      },
    ],
  },
]

const router = createRouter({
  history: createWebHistory(process.env.BASE_URL),
  routes,
})

export default router
