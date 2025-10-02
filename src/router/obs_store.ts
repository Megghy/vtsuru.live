export default {
  path: '/obs-store',
  name: 'obs-store',
  children: [
    {
      path: 'gamepad-manage',
      name: 'obs-store-gamepad-manage',
      component: async () => import('@/views/obs_store/components/gamepads/GamepadViewer.vue'),
      meta: {
        title: '游戏手柄',
        forceReload: true,
      },
    },
    {
      path: 'gamepad',
      name: 'obs-store-gamepad-display',
      component: async () => import('@/views/obs_store/components/gamepads/GamepadDisplay.vue'),
      meta: {
        title: '手柄显示',
        forceReload: true,
      },
    },
  ],
}
