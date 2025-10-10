import type { RouteRecordRaw } from 'vue-router'
import { createRouter, createWebHistory } from 'vue-router'
import { useLoadingBarStore } from '@/store/useLoadingBarStore'
import IndexView from '../views/IndexView.vue'
import client from './client'
import manage from './manage'
import obs from './obs'
import obs_store from './obs_store'
import open_live from './open_live'
import singlePage from './singlePage'
import user from './user'

const routes: Array<RouteRecordRaw> = [
  {
    path: '/',
    name: 'index',
    component: async () => import('@/views/IndexView.vue'),
    meta: {
      title: '你好',
    },
  },
  {
    path: '/verify',
    name: 'verify',
    component: async () => import('@/views/VerifyView.vue'),
    meta: {
      title: '认证',
    },
  },
  {
    path: '/about',
    name: 'about',
    component: async () => import('@/views/AboutView.vue'),
    meta: {
      title: '关于',
    },
  },
  {
    path: '/reset-password',
    name: 'resetPassword',
    component: async () => import('@/views/ChangePasswordView.vue'),
    meta: {
      title: '重置密码',
    },
  },
  {
    path: '/video-collect/:id',
    name: 'video-collect',
    component: async () => import('@/views/VideoCollectPublic.vue'),
    meta: {
      title: '推荐 · 视频征集',
      keepAlive: true,
    },
  },
  {
    path: '/video-collect/list/:id',
    name: 'video-collect-list',
    component: async () => import('@/views/VideoCollectListView.vue'),
    meta: {
      title: '结果 · 视频征集',
      keepAlive: true,
    },
  },
  {
    path: '/feedback',
    name: 'feedback',
    component: async () => import('@/views/ViewerFeedbackView.vue'),
    meta: {
      title: '反馈',
      keepAlive: true,
    },
  },
  {
    path: '/bili-auth',
    name: 'bili-auth',
    component: async () => import('@/views/BiliAuthView.vue'),
    meta: {
      title: 'Bilibili 账户认证',
      keepAlive: true,
    },
  },
  {
    path: '/bili-user',
    name: 'bili-user',
    component: async () => import('@/views/pointViews/PointUserLayout.vue'),
    meta: {
      title: 'Bilibili 账户',
      keepAlive: true,
    },
  },
  manage,
  obs,
  open_live,
  obs_store,
  client,
  {
    path: '/@:id',
    name: 'user',
    alias: '/user/:id',
    children: user,
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'notfound',
    component: async () => import('@/views/NotfoundView.vue'),
    meta: {
      title: '页面不存在',
    },
  },
  ...singlePage,
]

const router = createRouter({
  history: createWebHistory(process.env.BASE_URL),
  routes,
})
router.beforeEach((to, from, next) => {
  useLoadingBarStore().loadingBar?.start()
  
  // 保留 as 参数（如果存在）
  if (from.query.as && !to.query.as) {
    next({
      ...to,
      query: {
        ...to.query,
        as: from.query.as,
      },
    })
    return
  }
  
  next()
})
router.afterEach(() => {
  const loadingBar = useLoadingBarStore().loadingBar
  loadingBar?.finish()
})

export default router
