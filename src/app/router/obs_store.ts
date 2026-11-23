export default {
  path: '/obs-store',
  name: 'obs-store',
  // 只做路径分组；页面由布局的 RouterView + KeepAlive 渲染。
  children: [
    {
      path: 'gamepad-manage',
      name: 'obs-store-gamepad-manage',
      component: async () => import('@/apps/obs-store/components/gamepads/GamepadViewer.vue'),
      meta: {
        title: '游戏手柄',
        forceReload: true,
      },
    },
    {
      path: 'gamepad',
      name: 'obs-store-gamepad-display',
      component: async () => import('@/apps/obs-store/components/gamepads/GamepadDisplay.vue'),
      meta: {
        title: '手柄显示',
        forceReload: true,
      },
    },
    {
      path: 'counter-manage',
      name: 'obs-store-counter-manage',
      component: async () => import('@/apps/obs-store/components/counter/CounterViewer.vue'),
      meta: {
        title: '挑战计数器控制台',
        forceReload: true,
      },
    },
    {
      path: 'counter',
      name: 'obs-store-counter-display',
      component: async () => import('@/apps/obs-store/components/counter/CounterDisplay.vue'),
      meta: {
        title: '挑战计数器',
        forceReload: true,
      },
    },
    {
      path: 'clock-manage',
      name: 'obs-store-clock-manage',
      component: async () => import('@/apps/obs-store/components/clock/ClockViewer.vue'),
      meta: {
        title: '时钟与倒计时控制台',
        forceReload: true,
      },
    },
    {
      path: 'clock',
      name: 'obs-store-clock-display',
      component: async () => import('@/apps/obs-store/components/clock/ClockDisplay.vue'),
      meta: {
        title: '时钟与倒计时',
        forceReload: true,
      },
    },
    {
      path: 'goal-manage',
      name: 'obs-store-goal-manage',
      component: async () => import('@/apps/obs-store/components/goal/GoalViewer.vue'),
      meta: {
        title: '目标进度与耐久加钟控制台',
        forceReload: true,
      },
    },
    {
      path: 'goal',
      name: 'obs-store-goal-display',
      component: async () => import('@/apps/obs-store/components/goal/GoalDisplay.vue'),
      meta: {
        title: '目标进度与耐久加钟',
        forceReload: true,
      },
    },
    {
      path: 'wheel-manage',
      name: 'obs-store-wheel-manage',
      component: async () => import('@/apps/obs-store/components/wheel/WheelViewer.vue'),
      meta: {
        title: '直播大转盘控制台',
        forceReload: true,
      },
    },
    {
      path: 'wheel',
      name: 'obs-store-wheel-display',
      component: async () => import('@/apps/obs-store/components/wheel/WheelDisplay.vue'),
      meta: {
        title: '直播大转盘',
        forceReload: true,
      },
    },
    {
      path: 'subtitle-manage',
      name: 'obs-store-subtitle-manage',
      component: async () => import('@/apps/obs-store/components/subtitle/SubtitleViewer.vue'),
      meta: {
        title: '实时字幕条控制台',
        forceReload: true,
      },
    },
    {
      path: 'subtitle',
      name: 'obs-store-subtitle-display',
      component: async () => import('@/apps/obs-store/components/subtitle/SubtitleDisplay.vue'),
      meta: {
        title: '实时语音字幕条',
        forceReload: true,
      },
    },
    {
      path: 'pngtuber-manage',
      name: 'obs-store-pngtuber-manage',
      component: async () => import('@/apps/obs-store/components/pngtuber/PngtuberViewer.vue'),
      meta: {
        title: 'PNGtuber 控制台',
        forceReload: true,
      },
    },
    {
      path: 'pngtuber',
      name: 'obs-store-pngtuber-display',
      component: async () => import('@/apps/obs-store/components/pngtuber/PngtuberObsPage.vue'),
      meta: {
        title: 'PNGtuber',
        forceReload: true,
      },
    },
    {
      path: 'pngtuber-collab',
      name: 'obs-store-pngtuber-collab',
      component: async () => import('@/apps/obs-store/components/pngtuber/PngtuberCollabPage.vue'),
      meta: {
        title: 'PNGtuber 联动',
        forceReload: true,
      },
    },
    {
      path: 'keycast-manage',
      name: 'obs-store-keycast-manage',
      component: async () => import('@/apps/obs-store/components/keycast/KeycastViewer.vue'),
      meta: {
        title: '键盘按键投屏控制台',
        forceReload: true,
      },
    },
    {
      path: 'keycast',
      name: 'obs-store-keycast-display',
      component: async () => import('@/apps/obs-store/components/keycast/KeycastDisplay.vue'),
      meta: {
        title: '键盘按键投屏',
        forceReload: true,
      },
    },
    {
      path: 'typing-cat-manage',
      name: 'obs-store-typing-cat-manage',
      component: async () => import('@/apps/obs-store/components/typing-cat/TypingCatViewer.vue'),
      meta: {
        title: '小猫打字控制台',
        forceReload: true,
      },
    },
    {
      path: 'typing-cat',
      name: 'obs-store-typing-cat-display',
      component: async () => import('@/apps/obs-store/components/typing-cat/TypingCatDisplay.vue'),
      meta: {
        title: '小猫打字',
        forceReload: true,
      },
    },
    {
      path: 'alert-box-manage',
      name: 'obs-store-alert-box-manage',
      component: async () => import('@/apps/obs-store/components/alert-box/AlertBoxViewer.vue'),
      meta: {
        title: '事件播报弹窗控制台',
        forceReload: true,
      },
    },
    {
      path: 'alert-box',
      name: 'obs-store-alert-box-display',
      component: async () => import('@/apps/obs-store/components/alert-box/AlertBoxDisplay.vue'),
      meta: {
        title: '事件播报弹窗',
        forceReload: true,
      },
    },
    {
      path: 'live-hud-manage',
      name: 'obs-store-live-hud-manage',
      component: async () => import('@/apps/obs-store/components/live-hud/LiveHudViewer.vue'),
      meta: {
        title: '直播间状态看板控制台',
        forceReload: true,
      },
    },
    {
      path: 'live-hud',
      name: 'obs-store-live-hud-display',
      component: async () => import('@/apps/obs-store/components/live-hud/LiveHudDisplay.vue'),
      meta: {
        title: '直播间状态看板',
        forceReload: true,
      },
    },
    {
      path: 'gift-board-manage',
      name: 'obs-store-gift-board-manage',
      component: async () => import('@/apps/obs-store/components/gift-board/GiftBoardViewer.vue'),
      meta: {
        title: '本场感谢榜与舰长墙控制台',
        forceReload: true,
      },
    },
    {
      path: 'gift-board',
      name: 'obs-store-gift-board-display',
      component: async () => import('@/apps/obs-store/components/gift-board/GiftBoardDisplay.vue'),
      meta: {
        title: '本场感谢榜与舰长墙',
        forceReload: true,
      },
    },
    {
      path: 'schedule-manage',
      name: 'obs-store-schedule-manage',
      component: async () => import('@/apps/obs-store/components/schedule/ScheduleViewer.vue'),
      meta: {
        title: '直播日程表挂件控制台',
        forceReload: true,
      },
    },
    {
      path: 'schedule',
      name: 'obs-store-schedule-display',
      component: async () => import('@/apps/obs-store/components/schedule/ScheduleDisplay.vue'),
      meta: {
        title: '直播日程表挂件',
        forceReload: true,
      },
    },
    {
      path: 'point-showcase-manage',
      name: 'obs-store-point-showcase-manage',
      component: async () => import('@/apps/obs-store/components/point-showcase/PointShowcaseViewer.vue'),
      meta: {
        title: '积分商城与签到榜控制台',
        forceReload: true,
      },
    },
    {
      path: 'point-showcase',
      name: 'obs-store-point-showcase-display',
      component: async () => import('@/apps/obs-store/components/point-showcase/PointShowcaseDisplay.vue'),
      meta: {
        title: '积分商城与签到榜',
        forceReload: true,
      },
    },
    {
      path: 'video-collect-manage',
      name: 'obs-store-video-collect-manage',
      component: async () => import('@/apps/obs-store/components/video-collect/VideoCollectViewer.vue'),
      meta: {
        title: '视频征集投稿角标控制台',
        forceReload: true,
      },
    },
    {
      path: 'video-collect',
      name: 'obs-store-video-collect-display',
      component: async () => import('@/apps/obs-store/components/video-collect/VideoCollectDisplay.vue'),
      meta: {
        title: '视频征集投稿角标',
        forceReload: true,
      },
    },
    {
      path: 'now-playing-manage',
      name: 'obs-store-now-playing-manage',
      component: async () => import('@/apps/obs-store/components/now-playing/NowPlayingViewer.vue'),
      meta: {
        title: '正在播放音乐与歌词条控制台',
        forceReload: true,
      },
    },
    {
      path: 'now-playing',
      name: 'obs-store-now-playing-display',
      component: async () => import('@/apps/obs-store/components/now-playing/NowPlayingDisplay.vue'),
      meta: {
        title: '正在播放音乐与歌词条',
        forceReload: true,
      },
    },
    {
      path: 'checklist-manage',
      name: 'obs-store-checklist-manage',
      component: async () => import('@/apps/obs-store/components/checklist/ChecklistViewer.vue'),
      meta: {
        title: '直播话题与待办清单控制台',
        forceReload: true,
      },
    },
    {
      path: 'checklist',
      name: 'obs-store-checklist-display',
      component: async () => import('@/apps/obs-store/components/checklist/ChecklistDisplay.vue'),
      meta: {
        title: '直播话题与待办清单',
        forceReload: true,
      },
    },
    {
      path: 'song-picker-manage',
      name: 'obs-store-song-picker-manage',
      component: async () => import('@/apps/obs-store/components/song-picker/SongPickerViewer.vue'),
      meta: {
        title: '曲库展示与盲抽翻牌控制台',
        forceReload: true,
      },
    },
    {
      path: 'song-picker',
      name: 'obs-store-song-picker-display',
      component: async () => import('@/apps/obs-store/components/song-picker/SongPickerDisplay.vue'),
      meta: {
        title: '曲库展示与盲抽翻牌',
        forceReload: true,
      },
    },
    {
      path: 'mystery-box-manage',
      name: 'obs-store-mystery-box-manage',
      component: async () => import('@/apps/obs-store/components/mystery-box/MysteryBoxViewer.vue'),
      meta: {
        title: '盲盒拆盒与盈亏统计控制台',
        forceReload: true,
      },
    },
    {
      path: 'mystery-box',
      name: 'obs-store-mystery-box-display',
      component: async () => import('@/apps/obs-store/components/mystery-box/MysteryBoxDisplay.vue'),
      meta: {
        title: '盲盒拆盒与盈亏统计',
        forceReload: true,
      },
    },
    {
      path: 'emote-hype-manage',
      name: 'obs-store-emote-hype-manage',
      component: async () => import('@/apps/obs-store/components/emote-hype/EmoteHypeViewer.vue'),
      meta: {
        title: '氛围热度槽与表情喷泉控制台',
        forceReload: true,
      },
    },
    {
      path: 'emote-hype',
      name: 'obs-store-emote-hype-display',
      component: async () => import('@/apps/obs-store/components/emote-hype/EmoteHypeDisplay.vue'),
      meta: {
        title: '氛围热度槽与表情喷泉',
        forceReload: true,
      },
    },
    {
      path: 'voice-avatars-manage',
      name: 'obs-store-voice-avatars-manage',
      component: async () => import('@/apps/obs-store/components/voice-avatars/VoiceAvatarsViewer.vue'),
      meta: {
        title: '极简连麦语音头像控制台',
        forceReload: true,
      },
    },
    {
      path: 'voice-avatars',
      name: 'obs-store-voice-avatars-display',
      component: async () => import('@/apps/obs-store/components/voice-avatars/VoiceAvatarsDisplay.vue'),
      meta: {
        title: '极简连麦语音头像',
        forceReload: true,
      },
    },
  ],
}
