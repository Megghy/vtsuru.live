import { Cat } from 'lucide-vue-next'

import type { ObsComponentDefinition } from '../types'

export const typingCatComponent: ObsComponentDefinition = {
  id: 'typing-cat',
  name: '小猫打字 (Typing Cat)',
  shortDescription: '3D 桌面打字小猫 OBS 挂件，跟随键盘敲击与鼠标操作实时伸爪，支持 6 种花色、摸头互动与自动打字模式',
  description:
    '基于 Three.js 构建的透明背景 3D 小猫打字直播挂件。你敲哪个键它就用对应的爪子拍哪个键，点亮键帽并弹出按键标签；使用鼠标时也会伸爪握住鼠标晃动；支持 6 种经典猫咪花色、左手鼠标布局、隐私盲打模式、自动打盹呼噜、按住头部抚摸互动以及自主打字氛围模式，可直接接入 OBS 浏览器源或场景编辑器。',
  category: 'input',
  status: 'ready',
  tags: ['小猫打字', '桌宠', '键盘', '鼠标', '3D', 'Three.js', '透明背景'],
  icon: Cat,
  obsPath: '/obs-store/typing-cat',
  requiresAccount: true,
  managePath: '/manage/obs-store?component=typing-cat',
  defaultResolution: { width: 420, height: 360, label: '标准桌宠比例 (420×360 px)' },
  supportedResolutions: [
    { width: 420, height: 360, label: '标准桌宠比例 (420×360 px)' },
    { width: 520, height: 440, label: '高清大尺寸 (520×440 px)' },
    { width: 320, height: 280, label: '紧凑角落挂件 (320×280 px)' },
  ],
  features: [
    '透明 WebGL 3D 小猫与 5 行键盘、联动鼠标，精准左右手分区拍键、键帽高亮、按键浮标与实时 KPM 手速计数',
    '内置 6 种原生花色与 5 套键鼠配色主题，支持 16 项部位自由改色（含左右眼异瞳）、4 款 3D 穿戴配饰与 19 项体型比例微调',
    '支持隐私盲打、左手鼠标、视角偏航、水平镜像、配置文件一键导入导出与左右分栏吸顶实时调参',
    '支持打哈欠/舔爪/扑击/猫面包揣手待机、高速狂敲眯眼甩尾助阵、摸头互动、打盹呼噜以及直播间弹幕/礼物/舰长联动反应',
  ],
  version: '1.0.0',
  manageComponent: async () => import('@/apps/obs-store/components/typing-cat/TypingCatViewer.vue'),
}
