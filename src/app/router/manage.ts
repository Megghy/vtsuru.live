import { RouterView } from 'vue-router'

export default // 管理页面
{
  path: '/manage',
  name: 'manage',
  component: RouterView,
  children: [
    {
      path: '',
      name: 'manage-index',
      component: async () => import('@/apps/manage/pages/DashboardView.vue'),
      meta: {
        title: '面板',
        pageWidth: 'md',
      },
    },
    {
      path: 'song-list',
      name: 'manage-songList',
      component: async () => import('@/apps/manage/pages/SongListManageView.vue'),
      meta: {
        title: '歌单',
        keepAlive: true,
        pageWidth: 'xl',
      },
    },
    {
      path: 'question-box',
      name: 'manage-questionBox',
      component: async () => import('@/apps/manage/pages/QuestionBoxManageView.vue'),
      meta: {
        title: '提问箱',
        keepAlive: true,
        pageWidth: 'xl',
      },
    },
    {
      path: 'lottery',
      name: 'manage-lottery',
      component: async () => import('@/apps/manage/pages/LotteryView.vue'),
      meta: {
        title: '动态抽奖',
        keepAlive: true,
        pageWidth: 'xl',
      },
    },
    {
      path: 'history',
      name: 'manage-history',
      component: async () => import('@/apps/manage/pages/HistoryView.vue'),
      meta: {
        title: '数据跟踪',
        keepAlive: true,
        pageWidth: 'xl',
      },
    },
    {
      path: 'schedule',
      name: 'manage-schedule',
      component: async () => import('@/apps/manage/pages/ScheduleManageView.vue'),
      meta: {
        title: '日程',
        keepAlive: true,
        pageWidth: 'xl',
      },
    },
    {
      path: 'event',
      name: 'manage-event',
      component: async () => import('@/apps/manage/pages/EventView.vue'),
      meta: {
        title: '事件记录',
        keepAlive: true,
        pageWidth: 'xl',
      },
    },
    {
      path: 'video-collect',
      name: 'manage-videoCollect',
      component: async () => import('@/apps/manage/pages/video-collect/VideoCollectManageView.vue'),
      meta: {
        title: '视频征集',
        keepAlive: true,
        pageWidth: 'xl',
      },
    },
    {
      path: 'video-collect/:id',
      name: 'manage-videoCollect-Detail',
      component: async () => import('@/apps/manage/pages/video-collect/VideoCollectDetailView.vue'),
      meta: {
        title: '详情 · 视频征集',
        parent: 'manage-videoCollect',
        pageWidth: 'xl',
      },
    },
    {
      path: 'live-lottery',
      name: 'manage-liveLottery',
      component: async () => import('@/apps/open-live/pages/OpenLottery.vue'),
      meta: {
        title: '直播抽奖',
        keepAlive: true,
        danmaku: true,
        pageWidth: 'xl',
      },
    },
    {
      path: 'obs-store',
      name: 'manage-obsStore',
      component: async () => import('@/apps/obs-store/pages/OBSComponentStoreView.vue'),
      meta: {
        title: 'OBS组件库',
        keepAlive: true,
        danmaku: true,
        pageWidth: 'xl',
      },
    },
    {
      path: 'queue',
      name: 'manage-liveQueue',
      component: async () => import('@/apps/open-live/pages/OpenQueue.vue'),
      meta: {
        title: '排队',
        keepAlive: true,
        danmaku: true,
        pageWidth: 'xl',
      },
    },
    {
      path: 'speech',
      name: 'manage-speech',
      component: async () => import('@/apps/open-live/pages/ReadDanmaku.vue'),
      meta: {
        title: '读弹幕',
        keepAlive: true,
        danmaku: true,
        pageWidth: 'xl',
      },
    },
    {
      path: 'live-request',
      name: 'manage-liveRequest',
      component: async () => import('@/apps/open-live/pages/request/LiveRequest.vue'),
      meta: {
        title: '点播',
        keepAlive: true,
        danmaku: true,
        pageWidth: 'xl',
      },
    },
    {
      path: 'music-request',
      name: 'manage-musicRequest',
      component: async () => import('@/apps/open-live/pages/request/MusicRequest.vue'),
      meta: {
        title: '点歌',
        keepAlive: true,
        danmaku: true,
        pageWidth: 'xl',
      },
    },
    {
      path: 'danmuji',
      name: 'manage-danmuji',
      component: async () => import('@/apps/manage/pages/DanmujiManageView.vue'),
      meta: {
        title: '弹幕姬',
        keepAlive: true,
        danmaku: true,
        isNew: true,
        pageWidth: 'full',
      },
    },
    {
      path: 'vote',
      name: 'manage-danmakuVote',
      component: async () => import('@/apps/open-live/pages/DanmakuVote.vue'),
      meta: {
        title: '弹幕投票',
        keepAlive: true,
        danmaku: true,
        pageWidth: 'xl',
      },
    },
    {
      path: 'live',
      name: 'manage-live',
      component: async () => import('@/apps/manage/pages/live/LiveManager.vue'),
      meta: {
        title: '直播记录',
        keepAlive: true,
        pageWidth: 'md',
      },
    },
    {
      path: 'live/:id',
      name: 'manage-liveDetail',
      component: async () => import('@/apps/manage/pages/live/LiveDetailManage.vue'),
      meta: {
        title: '直播详情',
        pageWidth: 'md',
      },
    },
    {
      path: 'feedback',
      name: 'manage-feedback',
      component: async () => import('@/shared/components/FeedbackManage.vue'),
      meta: {
        title: '反馈',
        pageWidth: 'xl',
      },
    },
    {
      path: 'point',
      name: 'manage-point',
      component: async () => import('@/apps/manage/pages/point/PointManage.vue'),
      meta: {
        title: '积分',
        pageWidth: 'xl',
      },
    },
    {
      path: 'forum',
      name: 'manage-forum',
      component: async () => import('@/apps/manage/pages/ForumManage.vue'),
      meta: {
        title: '粉丝讨论区',
        pageWidth: 'xl',
      },
    },
    {
      path: 'analyze',
      name: 'manage-analyze',
      component: async () => import('@/apps/manage/pages/AnalyzeView.vue'),
      meta: {
        title: '数据分析',
        pageWidth: 'xl',
      },
    },
    {
      path: 'tools',
      name: 'manage-tools-dashboard',
      component: async () => import('@/apps/manage/pages/tools/ToolsDashboardView.vue'),
      meta: {
        title: '直播工具箱',
        keepAlive: true,
        pageWidth: 'xl',
      },
    },
    {
      path: 'tools/dynamic-nine-grid',
      name: 'ManageToolDynamicNineGrid',
      component: async () => import('@/apps/manage/pages/tools/ToolDynamicNineGrid.vue'),
      meta: {
        title: '动态九图生成器',
        parent: 'manage-tools-dashboard', // 指向工具箱仪表盘
        pageWidth: 'xl',
      },
    },
    {
      path: 'user-page-builder',
      name: 'manage-userPageBuilder',
      component: async () => import('@/apps/manage/pages/UserPageBuilderView.vue'),
      meta: {
        title: '自定义页面',
        pageWidth: 'full',
      },
    },
  ],
}
