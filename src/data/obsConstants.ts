import { ConfigItemDefinition } from './VTsuruConfigTypes';
import type { Component, DefineComponent } from 'vue';

/**
 * OBS 组件定义接口
 */
export type OBSComponentDefinition = {
  id: string; // 唯一标识符
  name: string; // 显示名称
  description: string; // 组件描述
  component: DefineComponent<{}, {}, any> | Component; // Vue 组件本身 (异步或同步)
  settingName?: string; // 用于在数据库中存储配置的名称，可选
  icon?: string; // 组件图标的路径 (可选)
  version?: string; // 组件版本 (可选)
  props?: Record<string, any>; // 传递给组件的额外props (可选)
  // 子组件需要暴露 Config 和 DefaultConfig 才能使用 DynamicForm
  // Config?: ConfigItemDefinition[];
  // DefaultConfig?: any;
}

/**
 * OBS 组件映射表
 * key: 组件的唯一ID (如 'example')
 * value: OBSComponentDefinition 对象
 *
 * 父组件 OBSComponentStoreView.vue 会动态读取此对象来展示组件列表，
 * 并通过 component 字段动态加载组件。
 */
export const OBSComponentMap: Record<string, OBSComponentDefinition> = {
  // 示例组件的定义将在 OBSComponentStoreView.vue 中或者在此处初始化
  // 'example': {
  //   id: 'example',
  //   name: '示例 OBS 组件',
  //   description: '这是一个基础的OBS组件，用于演示和测试功能。',
  //   component: defineAsyncComponent(() => import('@/views/manage/obs_store/components/ExampleOBSComponent.vue')),
  //   settingName: 'obsExampleComponentSettings',
  //   version: '1.0.0',
  // },
};