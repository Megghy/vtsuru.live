import { AddCircleOutline } from '@vicons/ionicons5'

import type { ObsComponentDefinition } from '../types'

export const counterComponent: ObsComponentDefinition = {
  id: 'counter',
  name: '直播挑战计数器 (Live Counter)',
  shortDescription: '游戏受苦死亡数、通关重试计数与目标进度条，网页端即时修改并实时同步至 OBS 画面',
  description:
    '专为主播设计的轻量受苦计数与目标进度挂件。支持记录死亡次数（Deaths）、胜负场次（W/L）、挑战重试数。网页端与 OBS 画面通过本地广播通道实现毫秒级双向实时同步与数据持久化，支持 4 种视觉主题与自定义颜色。',
  category: 'utility',
  status: 'ready',
  tags: ['计数器', '受苦计数', '目标进度', '实时同步', '本地存储'],
  icon: AddCircleOutline,
  obsPath: '/obs-store/counter',
  managePath: '/obs-store/counter-manage',
  defaultResolution: { width: 360, height: 140, label: '标准挂件 (360×140 px)' },
  supportedResolutions: [
    { width: 360, height: 140, label: '标准尺寸 (360×140 px)' },
    { width: 480, height: 180, label: '大字号 (480×180 px)' },
    { width: 280, height: 100, label: '紧凑迷你 (280×100 px)' },
  ],
  features: [
    '网页控制台与 OBS 画面通过本地通道毫秒级双向同步',
    '支持悬浮卡片、极简透明、赛博霓虹、玻璃拟态 4 套精美主题',
    '支持单次 +1 / +5 / -1 快捷加减与数字跳动弹跳动效',
    '支持目标数值设定与平滑进度条百分比展示',
    '数据持久化保存于本地浏览器，场景切换或刷新不丢失',
  ],
  version: '1.0.0',
  manageComponent: () => import('@/apps/obs-store/components/counter/CounterViewer.vue'),
}
