import type { Component } from 'vue'

export type ObsCategory = 'all' | 'input' | 'widget' | 'utility' | 'interactive'

export type ObsComponentStatus = 'ready' | 'beta' | 'planned'

export interface ObsCategoryMeta {
  id: ObsCategory
  name: string
  description?: string
  icon?: Component
}

export interface ObsComponentResolution {
  width: number
  height: number
  label?: string
}

export interface ObsComponentDefinition {
  /** 唯一组件 ID，用作路由和参数标识，例如 'gamepad' */
  id: string
  /** 组件显示名称，例如 '游戏手柄投屏' */
  name: string
  /** 简明摘要，用于卡片与搜索结果列表 */
  shortDescription: string
  /** 完整描述与使用场景说明 */
  description: string
  /** 归属分类 */
  category: Exclude<ObsCategory, 'all'>
  /** 状态：已就绪 / 测试中 / 规划中 */
  status: ObsComponentStatus
  /** 特性标签 */
  tags: string[]
  /** 组件图标 */
  icon: Component
  /** OBS 浏览器源相对路径，例如 '/obs-store/gamepad' */
  obsPath?: string
  /** 独立配置管理页相对路径，例如 '/obs-store/gamepad-manage' */
  managePath?: string
  /** 推荐 OBS 尺寸 (宽 x 高) */
  defaultResolution?: ObsComponentResolution
  /** 备选/常用分辨率预设 */
  supportedResolutions?: ObsComponentResolution[]
  /** 核心特性亮点列表 */
  features: string[]
  /** 作者或来源 */
  author?: string
  /** 版本号 */
  version?: string
  /** 异步加载的配置面板组件（用于在 Store 内部嵌入渲染配置工作台） */
  manageComponent?: () => Promise<{ default: Component }>
}
