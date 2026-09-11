import { Apps24Regular } from '@vicons/fluent'
import {
  ConstructOutline,
  GameControllerOutline,
  LayersOutline,
  SparklesOutline,
} from '@vicons/ionicons5'

import type { ObsCategory, ObsCategoryMeta } from './types'

export const OBS_CATEGORIES: ObsCategoryMeta[] = [
  {
    id: 'all',
    name: '全部组件',
    description: '查看所有纯前端独立 OBS 浏览器源组件',
    icon: Apps24Regular,
  },
  {
    id: 'input',
    name: '外设输入',
    description: '手柄、按键、鼠标等物理设备输入捕获与高帧率投屏',
    icon: GameControllerOutline,
  },
  {
    id: 'widget',
    name: '画面挂件',
    description: '时钟、倒计时、通知条等纯本地直播视觉小部件',
    icon: LayersOutline,
  },
  {
    id: 'utility',
    name: '实用辅助',
    description: '计数器、秒表、番茄钟等辅助直播流程的纯前端工具',
    icon: ConstructOutline,
  },
  {
    id: 'interactive',
    name: '本地互动',
    description: '纯本地转盘、骰子、抽签等无需云端服务的互动挂件',
    icon: SparklesOutline,
  },
]

export function getCategoryMeta(categoryId: ObsCategory): ObsCategoryMeta | undefined {
  return OBS_CATEGORIES.find((c) => c.id === categoryId)
}
