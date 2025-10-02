export default // 管理页面
{
  path: '/manage',
  name: 'manage',
  children: [
    {
      path: '',
      name: 'manage-index',
      component: async () => import('@/views/manage/DashboardView.vue'),
      meta: {
        title: '面板',
      },
    },
    {
      path: 'song-list',
      name: 'manage-songList',
      component: async () => import('@/views/manage/SongListManageView.vue'),
      meta: {
        title: '歌单',
        keepAlive: true,
      },
    },
    {
      path: 'question-box',
      name: 'manage-questionBox',
      component: async () => import('@/views/manage/QuestionBoxManageView.vue'),
      meta: {
        title: '提问箱',
        keepAlive: true,
      },
    },
    {
      path: 'lottery',
      name: 'manage-lottery',
      component: async () => import('@/views/manage/LotteryView.vue'),
      meta: {
        title: '动态抽奖',
        keepAlive: true,
      },
    },
    {
      path: 'history',
      name: 'manage-history',
      component: async () => import('@/views/manage/HistoryView.vue'),
      meta: {
        title: '数据跟踪',
        keepAlive: true,
      },
    },
    {
      path: 'schedule',
      name: 'manage-schedule',
      component: async () => import('@/views/manage/ScheduleManageView.vue'),
      meta: {
        title: '日程',
        keepAlive: true,
      },
    },
    {
      path: 'event',
      name: 'manage-event',
      component: async () => import('@/views/manage/EventView.vue'),
      meta: {
        title: '事件记录',
        keepAlive: true,
      },
    },
    {
      path: 'video-collect',
      name: 'manage-videoCollect',
      component: async () => import('@/views/manage/VideoCollectManageView.vue'),
      meta: {
        title: '视频征集',
        keepAlive: true,
      },
    },
    {
      path: 'video-collect/:id',
      name: 'manage-videoCollect-Detail',
      component: async () => import('@/views/manage/VideoCollectDetailView.vue'),
      meta: {
        title: '详情 · 视频征集',
        parent: 'manage-videoCollect',
      },
    },
    {
      path: 'live-lottery',
      name: 'manage-liveLottery',
      component: async () => import('@/views/open_live/OpenLottery.vue'),
      meta: {
        title: '直播抽奖',
        keepAlive: true,
        danmaku: true,
      },
    },
    {
      path: 'obs-store',
      name: 'manage-obsStore',
      component: async () => import('@/views/obs_store/OBSComponentStoreView.vue'),
      meta: {
        title: 'OBS组件库',
        keepAlive: true,
        danmaku: true,
      },
    },
    {
      path: 'queue',
      name: 'manage-liveQueue',
      component: async () => import('@/views/open_live/OpenQueue.vue'),
      meta: {
        title: '排队',
        keepAlive: true,
        danmaku: true,
      },
    },
    {
      path: 'speech',
      name: 'manage-speech',
      component: async () => import('@/views/open_live/ReadDanmaku.vue'),
      meta: {
        title: '读弹幕',
        keepAlive: true,
        danmaku: true,
      },
    },
    {
      path: 'live-request',
      name: 'manage-liveRequest',
      component: async () => import('@/views/open_live/LiveRequest.vue'),
      meta: {
        title: '点播',
        keepAlive: true,
        danmaku: true,
      },
    },
    {
      path: 'music-request',
      name: 'manage-musicRequest',
      component: async () => import('@/views/open_live/MusicRequest.vue'),
      meta: {
        title: '点歌',
        keepAlive: true,
        danmaku: true,
      },
    },
    {
      path: 'danmuji',
      name: 'manage-danmuji',
      component: async () => import('@/views/manage/DanmujiManageView.vue'),
      meta: {
        title: '弹幕姬',
        keepAlive: true,
        danmaku: true,
        isNew: true,
      },
    },
    {
      path: 'vote',
      name: 'manage-danmakuVote',
      component: async () => import('@/views/open_live/DanmakuVote.vue'),
      meta: {
        title: '弹幕投票',
        keepAlive: true,
        danmaku: true,
      },
    },
    {
      path: 'live',
      name: 'manage-live',
      component: async () => import('@/views/manage/LiveManager.vue'),
      meta: {
        title: '直播记录',
        keepAlive: true,
      },
    },
    {
      path: 'live/:id',
      name: 'manage-liveDetail',
      component: async () => import('@/views/manage/LiveDetailManage.vue'),
      meta: {
        title: '直播详情',
      },
    },
    {
      path: 'feedback',
      name: 'manage-feedback',
      component: async () => import('@/views/FeedbackManage.vue'),
      meta: {
        title: '反馈',
      },
    },
    {
      path: 'point',
      name: 'manage-point',
      component: async () => import('@/views/manage/point/PointManage.vue'),
      meta: {
        title: '积分',
      },
    },
    {
      path: 'forum',
      name: 'manage-forum',
      component: async () => import('@/views/manage/ForumManage.vue'),
      meta: {
        title: '粉丝讨论区',
      },
    },
    {
      path: 'analyze',
      name: 'manage-analyze',
      component: async () => import('@/views/manage/AnalyzeView.vue'),
      meta: {
        title: '数据分析',
      },
    },
    {
      path: 'tools',
      name: 'manage-tools-dashboard',
      component: async () => import('@/views/manage/ToolsDashboardView.vue'),
      meta: {
        title: '直播工具箱',
        keepAlive: true,
      },
    },
    {
      path: 'tools/dynamic-nine-grid',
      name: 'ManageToolDynamicNineGrid',
      component: async () => import('@/views/manage/tools/ToolDynamicNineGrid.vue'),
      meta: {
        title: '动态九图生成器',
        parent: 'manage-tools-dashboard', // 指向工具箱仪表盘
      },
    },
  ],
}
