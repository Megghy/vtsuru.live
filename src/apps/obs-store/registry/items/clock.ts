import { TimerOutline } from '@vicons/ionicons5'

import type { ObsComponentDefinition } from '../types'

export const clockComponent: ObsComponentDefinition = {
  id: 'clock',
  name: '时钟与倒计时 (Clock & Timer)',
  shortDescription: '高精度本地时钟、开播倒计时与速通正计时，内置瑞士排版/赛博霓虹等 6 款精美预设',
  description:
    '功能完备且高颜值的直播时钟与倒计时挂件。支持实时系统时钟、开播倒计时、挑战正计时三种模式。内置瑞士现代极简、赛博霓虹、经典数码液晶、毛玻璃卡片、紧凑胶囊、透明纯字 6 套精美预设样式，支持 12/24 小时制、秒/毫秒级精度与自定义强调色，毫秒级双向同步至 OBS。',
  category: 'widget',
  status: 'ready',
  tags: ['时钟', '开播倒计时', '速通计时', '瑞士极简', '赛博霓虹', '毛玻璃', '毫秒同步'],
  icon: TimerOutline,
  obsPath: '/obs-store/clock',
  managePath: '/obs-store/clock-manage',
  defaultResolution: { width: 420, height: 160, label: '标准横条 (420×160 px)' },
  supportedResolutions: [
    { width: 420, height: 160, label: '标准尺寸 (420×160 px)' },
    { width: 360, height: 120, label: '紧凑尺寸 (360×120 px)' },
    { width: 500, height: 200, label: '超大横幅 (500×200 px)' },
  ],
  features: [
    '支持实时时钟、开播倒计时、速通正计时 3 种模式',
    '精选 6 套高品质预设（瑞士现代、赛博霓虹、点阵液晶、毛玻璃、胶囊、极简透明）',
    '高精度本地 RAF 驱动，倒计时不漂移、无卡顿',
    '支持 24/12h (AM/PM) 切换、秒/毫秒显示、日期与星期开关',
    '基于通用 Hash 同步通道，网页端操作秒级同步至 OBS 画面',
  ],
  version: '1.0.0',
  manageComponent: () => import('@/apps/obs-store/components/clock/ClockViewer.vue'),
}
