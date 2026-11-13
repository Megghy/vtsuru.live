import Sparkle24Regular from '@vicons/fluent/es/Sparkle24Regular'

import type { ObsComponentDefinition } from '../types'

export const wheelComponent: ObsComponentDefinition = {
  id: 'wheel',
  name: '直播大转盘',
  shortDescription: '物理阻尼 Canvas 大转盘，支持权重配置、预设切换与跨端同步开奖动效',
  description:
    '为直播惩罚、歌回盲抽、粉丝福利打造的物理阻尼大转盘。无需新建后端表，直接通过平台同步通道将控制台开奖结果与阻尼动画实时同步至 OBS 浏览器源。',
  category: 'interactive',
  status: 'ready',
  tags: ['大转盘', '互动惩罚', '盲抽', '概率权重', '实时同步'],
  icon: Sparkle24Regular,
  obsPath: '/obs-store/wheel',
  requiresAccount: true,
  managePath: '/manage/obs-store?component=wheel',
  defaultResolution: { width: 480, height: 540, label: '标准方形 (480×540 px)' },
  supportedResolutions: [
    { width: 480, height: 540, label: '标准尺寸 (480×540 px)' },
    { width: 600, height: 660, label: '高清大图 (600×660 px)' },
    { width: 360, height: 420, label: '紧凑悬浮 (360×420 px)' },
  ],
  features: [
    '高精度 HiDPI Canvas 绘制，支持按概率权重比例或等分绘制扇区',
    '四次方物理阻尼缓动曲线与过界震颤指针 + Web Audio 合成拨片音效',
    '控制台先抽取结果再广播目标角度，确保控制台与 OBS 画面 100% 停在同一选项',
    '内置惩罚大转盘、歌回盲抽、舰长福利三种预设，支持自由增删选项与配色',
  ],
  version: '1.0.0',
  manageComponent: async () => import('@/apps/obs-store/components/wheel/WheelViewer.vue'),
}
