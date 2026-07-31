import type { RouteRecordRaw } from 'vue-router'
import { createRouter, createWebHistory } from 'vue-router'

import { useLoadingBarStore } from '@/store/useLoadingBarStore'

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
    component: async () => import('@/apps/web/pages/IndexView.vue'),
    meta: {
      title: '你好',
    },
  },
  {
    path: '/verify',
    name: 'verify',
    component: async () => import('@/apps/web/pages/auth/VerifyView.vue'),
    meta: {
      title: '认证',
    },
  },
  {
    path: '/about',
    name: 'about',
    component: async () => import('@/apps/web/pages/AboutView.vue'),
    meta: {
      title: '关于',
    },
  },
  {
    path: '/reset-password',
    name: 'resetPassword',
    component: async () => import('@/apps/web/pages/auth/ChangePasswordView.vue'),
    meta: {
      title: '重置密码',
    },
  },
  {
    path: '/join',
    name: 'join',
    component: async () => import('@/apps/web/pages/JoinView.vue'),
    meta: {
      title: '加入',
    },
  },
  {
    path: '/org',
    name: 'org-index',
    component: async () => import('@/apps/org/pages/OrgIndexView.vue'),
    meta: {
      title: '组织',
    },
  },
  {
    path: '/org/:orgId',
    name: 'org-detail',
    component: async () => import('@/apps/org/pages/OrgDetailView.vue'),
    meta: {
      title: '组织',
    },
  },
  {
    path: '/video-collect/:id',
    name: 'video-collect',
    component: async () => import('@/apps/web/pages/video-collect/VideoCollectPublic.vue'),
    meta: {
      title: '推荐 · 视频征集',
      keepAlive: true,
    },
  },
  {
    path: '/video-collect/list/:id',
    name: 'video-collect-list',
    component: async () => import('@/apps/web/pages/video-collect/VideoCollectListView.vue'),
    meta: {
      title: '结果 · 视频征集',
      keepAlive: true,
    },
  },
  {
    path: '/feedback',
    name: 'feedback',
    component: async () => import('@/apps/web/pages/ViewerFeedbackView.vue'),
    meta: {
      title: '工单',
      keepAlive: true,
    },
  },
  {
    path: '/feedback/:id',
    name: 'feedback-detail',
    component: async () => import('@/apps/web/pages/ViewerFeedbackView.vue'),
    meta: {
      title: '工单详情',
    },
  },
  {
    path: '/bili-auth',
    name: 'bili-auth',
    component: async () => import('@/apps/web/pages/auth/BiliAuthView.vue'),
    meta: {
      title: 'Bilibili 账户认证',
      keepAlive: true,
    },
  },
  {
    path: '/bili-user',
    name: 'bili-user',
    component: async () => import('@/apps/layouts/PointUserLayout.vue'),
    redirect: { name: 'bili-user-points' },
    meta: {
      title: 'Bilibili 账户中心',
      keepAlive: true,
    },
    children: [
      {
        path: 'points',
        name: 'bili-user-points',
        component: async () => import('@/apps/account/pages/point/PointOverviewView.vue'),
        meta: { title: '我的积分 · Bilibili 账户中心' },
      },
      {
        path: 'orders',
        name: 'bili-user-orders',
        component: async () => import('@/apps/account/pages/point/PointOrderView.vue'),
        meta: { title: '我的订单 · Bilibili 账户中心' },
      },
      {
        path: 'history',
        name: 'bili-user-history',
        component: async () => import('@/apps/account/pages/point/PointUserHistoryView.vue'),
        meta: { title: '积分记录 · Bilibili 账户中心' },
      },
      {
        path: 'settings',
        name: 'bili-user-settings',
        component: async () => import('@/apps/account/pages/point/PointUserSettings.vue'),
        meta: { title: '账户设置 · Bilibili 账户中心' },
      },
    ],
  },
  manage,
  obs,
  open_live,
  obs_store,
  // @ts-expect-error
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
    component: async () => import('@/apps/web/pages/NotfoundView.vue'),
    meta: {
      title: '页面不存在',
    },
  },
  ...singlePage,
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
})
router.beforeEach((to, from) => {
  useLoadingBarStore().loadingBar?.start()

  // iOS Safari / QQ 等 WebView 会把路径里的 @ 百分号编码成 %40, 而 vue-router 用未解码的 pathname
  // 匹配字面量 @, 导致 /@:id 匹配失败落到 notfound. 这里规范化后重定向回 /@.
  if (to.path.startsWith('/%40')) {
    return to.fullPath.replace(/^\/%40/, '/@')
  }

  // 保留 as 参数（如果存在）
  if (from.query.as && !to.query.as) {
    return {
      ...to,
      query: {
        ...to.query,
        as: from.query.as,
      },
    }
  }
})
router.afterEach(() => {
  const loadingBar = useLoadingBarStore().loadingBar
  loadingBar?.finish()
})

export default router
