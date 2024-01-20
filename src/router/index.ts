import { useProviderStore } from '@/store/useProviderStore'
import { createRouter, createWebHistory, RouteRecordRaw } from 'vue-router'
import IndexView from '../views/IndexView.vue'
import manage from './manage'
import user from './user'
import obs from './obs'
import open_live from './open_live'

const routes: Array<RouteRecordRaw> = [
  {
    path: '/',
    name: 'index',
    component: IndexView,
    meta: {
      title: '你好',
    },
  },
  {
    path: '/verify',
    name: 'verify',
    component: () => import('@/views/VerifyView.vue'),
    meta: {
      title: '认证',
    },
  },
  {
    path: '/about',
    name: 'about',
    component: () => import('@/views/AboutView.vue'),
    meta: {
      title: '关于',
    },
  },
  {
    path: '/reset-password',
    name: 'resetPassword',
    component: () => import('@/views/ChangePasswordView.vue'),
    meta: {
      title: '重置密码',
    },
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
    path: '/feedback',
    name: 'feedback',
    component: () => import('@/views/ViewerFeedbackView.vue'),
    meta: {
      title: '反馈',
      keepAlive: true,
    },
  },
  {
    path: '/bili-auth',
    name: 'bili-auth',
    component: () => import('@/views/BiliAuthView.vue'),
    meta: {
      title: 'Bilibili 账户认证',
      keepAlive: true,
    },
  },
  manage,
  user,
  obs,
  open_live,
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
router.beforeEach((to, from, next) => {
  useProviderStore().loadingBar?.start()
  next()
})
router.afterEach((to, from) => {
  const loadingBar = useProviderStore().loadingBar
  loadingBar?.finish()
})

export default router
