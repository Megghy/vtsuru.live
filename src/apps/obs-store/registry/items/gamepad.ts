import { GameControllerOutline } from '@vicons/ionicons5'

import type { ObsComponentDefinition } from '../types'

export const gamepadComponent: ObsComponentDefinition = {
  id: 'gamepad',
  name: '手柄操作投屏 (Gamepad)',
  shortDescription: '捕获 Xbox、PlayStation、Switch 等手柄输入，高帧率矢量渲染按键、双摇杆与线性扳机',
  description:
    '基于浏览器 Gamepad API 的纯前端手柄投屏挂件。支持 Xbox Series/One、PS5 DualSense、PS4 DualShock、Switch Pro 等主流手柄。直接修改底壳 SVG 图层实现高保真矢量渲染，支持自定义按键发光色、摇杆灵敏度微调与中心死区过滤，零网络依赖与毫秒级即时响应。',
  category: 'input',
  status: 'ready',
  tags: ['Gamepad', 'Xbox', 'PS5', 'Switch', 'SVG矢量', '60+ FPS', '零延迟'],
  icon: GameControllerOutline,
  obsPath: '/obs-store/gamepad',
  managePath: '/obs-store/gamepad-manage',
  defaultResolution: { width: 800, height: 500, label: '标准比例 (800×500 px)' },
  supportedResolutions: [
    { width: 800, height: 500, label: '标准尺寸 (800×500 px)' },
    { width: 640, height: 400, label: '紧凑尺寸 (640×400 px)' },
    { width: 1000, height: 625, label: '超清大图 (1000×625 px)' },
  ],
  features: [
    '支持主流手柄协议 (Xbox, PlayStation, Nintendo Switch Pro)',
    '原生 SVG 矢量图层改色与形变，任意缩放无锯齿',
    '高帧率 RAF 采样，实时渲染双摇杆位移与线性扳机下压行程',
    '内置设备连接检测与自动仿真测试演示',
    '参数全通过 URL query 驱动，纯本地浏览器源即开即用',
  ],
  version: '2.0.0',
  manageComponent: () => import('@/apps/obs-store/components/gamepads/GamepadViewer.vue'),
}
