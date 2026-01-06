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
  ],
}
