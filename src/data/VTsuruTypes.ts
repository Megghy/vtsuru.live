import { VNode } from 'vue'

export type TemplateConfig<T> = {
  name: string
  items: (TemplateConfigItem<T> | TemplateConfigImageItem<T>)[]
  onConfirm?: (arg0: T) => void
}
interface TemplateConfigBase {
  name: string
}
export type TemplateConfigItem<T> = TemplateConfigBase & {
  type: 'default'
  render: (arg0: T) => VNode
}
export type TemplateConfigImageItem<T> = TemplateConfigBase & {
  type: 'image'
  imageLimit: number
  onUploaded: (arg0: string | string[], arg1: T) => void
}
