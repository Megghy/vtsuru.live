import {
  KeypadOutline,
  SparklesOutline,
} from '@vicons/ionicons5'

import type { ObsComponentDefinition } from '../types'

export const plannedComponents: ObsComponentDefinition[] = [
  {
    id: 'keycast',
    name: '键盘按键投屏 (Keycast)',
    shortDescription: '捕获键盘击键与组合快捷键，以连击动效或虚拟键帽实时投屏展示',
    description:
      '专为游戏操作、编程教学与打字展示设计的键盘可视化挂件。实时呈现单键与组合快捷键触发，支持 APM 敲击速率统计、多种键帽主题与淡出动画效果。',
    category: 'input',
    status: 'planned',
    tags: ['键盘', '按键显示', '快捷键', 'APM统计', '纯前端'],
    icon: KeypadOutline,
    defaultResolution: { width: 500, height: 200, label: '紧凑横条 (500×200 px)' },
    features: [
      '实时捕获键盘击键与组合键（如 Ctrl+Shift+Alt+Key）',
      '支持连击动效、停留时间与平滑淡出过渡',
      '提供极简气泡、机械键盘键帽等多种视觉风格',
      '纯本地渲染，保护隐私，无云端数据传输',
    ],
  },
  {
    id: 'wheel',
    name: '本地离线大转盘 (Local Wheel)',
    shortDescription: '离线自定义选项大转盘与随机抽签，主播本地一键控制，无需网络服务',
    description:
      '纯本地离线转盘互动挂件。支持自定义奖项、概率权重、物理拟真减速转动动效与中奖弹幕播报，完全在本地 OBS 浏览器源内运行。',
    category: 'interactive',
    status: 'planned',
    tags: ['大转盘', '抽签', '惩罚游戏', '离线随机'],
    icon: SparklesOutline,
    defaultResolution: { width: 600, height: 600, label: '正方形 (600×600 px)' },
    features: [
      'Canvas 拟真物理阻尼旋转动画与指针音效',
      '支持自定义任意条目、颜色与概率权重',
      '纯本地运行，免登录、免网络、零延迟',
      '支持通过配置台实时触发或配置预设',
    ],
  },
]
