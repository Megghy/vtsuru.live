import { RouterView } from 'vue-router'

export default {
  path: '/obs-store',
  name: 'obs-store',
  component: RouterView,
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
  ],
}
