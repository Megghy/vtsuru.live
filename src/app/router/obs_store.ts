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
  ],
}
