import { createRouter, createWebHistory, RouteRecordRaw } from 'vue-router'
import IndexView from '../views/IndexView.vue'

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
      {
        path: 'live-lottery',
        name: 'manage-liveLottery',
        component: () => import('@/views/open_live/OpenLottery.vue'),
        meta: {
          title: '直播抽奖',
          keepAlive: true,
          danmaku: true,
        },
      },
      {
        path: 'queue',
        name: 'manage-liveQueue',
        component: () => import('@/views/open_live/OpenQueue.vue'),
        meta: {
          title: '排队',
          keepAlive: true,
          danmaku: true,
        },
      },
      {
        path: 'speech',
        name: 'manage-speech',
        component: () => import('@/views/open_live/ReadDanmaku.vue'),
        meta: {
          title: '读弹幕',
          keepAlive: true,
          danmaku: true,
        },
      },
      {
        path: 'song-request',
        name: 'manage-songRequest',
        component: () => import('@/views/open_live/SongRequest.vue'),
        meta: {
          title: '点歌 (歌势',
          keepAlive: true,
          danmaku: true,
        },
      },
      {
        path: 'music-request',
        name: 'manage-musicRequest',
        component: () => import('@/views/open_live/MusicRequest.vue'),
        meta: {
          title: '点歌 (放歌',
          keepAlive: true,
          danmaku: true,
        },
      },
      {
        path: 'live',
        name: 'manage-live',
        component: () => import('@/views/manage/LiveManager.vue'),
        meta: {
          title: '直播记录',
          keepAlive: true,
        },
      },
      {
        path: 'live/:id',
        name: 'manage-liveDetail',
        component: () => import('@/views/manage/LiveDetailManage.vue'),
        meta: {
          title: '直播详情',
        },
      },
      {
        path: 'feedback',
        name: 'manage-feedback',
        component: () => import('@/views/FeedbackManage.vue'),
        meta: {
          title: '反馈',
        },
      },
    ],
  },
  {
    path: '/open-live',
    name: 'open-live',
    children: [
      {
        path: '',
        name: 'open-live-index',
        component: () => import('@/views/open_live/OpenLiveIndex.vue'),
        meta: {
          title: '开放平台',
        },
      },
      {
        path: 'lottery',
        name: 'open-live-lottery',
        component: () => import('@/views/open_live/OpenLottery.vue'),
        meta: {
          title: '直播抽奖',
        },
      },
      {
        path: 'song-request',
        name: 'open-live-song-request',
        component: () => import('@/views/open_live/SongRequest.vue'),
        meta: {
          title: '点歌',
        },
      },
      {
        path: 'queue',
        name: 'open-live-queue',
        component: () => import('@/views/open_live/OpenQueue.vue'),
        meta: {
          title: '排队',
        },
      },
      {
        path: 'speech',
        name: 'open-live-speech',
        component: () => import('@/views/open_live/ReadDanmaku.vue'),
        meta: {
          title: '读弹幕',
        },
      },
    ],
  },
  {
    path: '/obs',
    name: 'obs',
    children: [
      {
        path: 'live-lottery',
        name: 'obs-live-lottery',
        component: () => import('@/views/obs/LiveLotteryOBS.vue'),
        meta: {
          title: '直播抽奖',
        },
      },
      {
        path: 'song-request',
        name: 'obs-song-request',
        component: () => import('@/views/obs/SongRequestOBS.vue'),
        meta: {
          title: '弹幕点歌 (歌势',
        },
      },
      {
        path: 'queue',
        name: 'obs-queue',
        component: () => import('@/views/obs/QueueOBS.vue'),
        meta: {
          title: '弹幕排队',
        },
      },
      {
        path: 'music-request',
        name: 'obs-music-request',
        component: () => import('@/views/obs/MusicRequestOBS.vue'),
        meta: {
          title: '弹幕排队 (播放',
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
