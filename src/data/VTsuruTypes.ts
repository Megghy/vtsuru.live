import { VNode } from 'vue'

export type TemplateConfig<T> = {
  name: string
  items: (
    | TemplateConfigStringItem<T>
    | TemplateConfigNumberItem<T>
    | TemplateConfigStringArrayItem<T>
    | TemplateConfigNumberArrayItem<T>
    | TemplateConfigImageItem<T>
    | TemplateConfigRenderItem<T>
  )[]
  onConfirm?: (arg0: T) => void
}
interface TemplateConfigBase {
  name: string | VNode
  key: string //将被保存到指定key中
}

type CommonProps = TemplateConfigBase
type DataAccessor<T, V> = {
  get: (config: T) => V
  set: (config: T, value: V) => void
}

// 扩展 CommonProps 以包含额外的共有属性
export type TemplateConfigItemWithType<T, V> = CommonProps & { data?: DataAccessor<T, V> }

export type TemplateConfigStringItem<T> = TemplateConfigItemWithType<T, string> & {
  type: 'string'
}
export type TemplateConfigStringArrayItem<T> = TemplateConfigItemWithType<T, string[]> & {
  type: 'stringArray'
}
export type TemplateConfigNumberItem<T> = TemplateConfigItemWithType<T, number> & {
  type: 'number'
}
export type TemplateConfigNumberArrayItem<T> = TemplateConfigItemWithType<T, number[]> & {
  type: 'numberArray'
}

export type TemplateConfigRenderItem<T> = TemplateConfigBase & {
  type: 'render'
  render: (arg0: T) => VNode
}

/**
 *
 * @template T - The type of the associated data model.
 */
export type TemplateConfigImageItem<T> = TemplateConfigBase & {
  type: 'image' // Specifies the type of configuration item as 'image'.
  imageLimit: number // The maximum number of images allowed.
  /**
   * Callback function triggered upon image upload.
   * @param {string[]} uploadedImages - The uploaded image or array of images.
   * @param {T} config - The configuration data model.
   */
  onUploaded?: (uploadedImages: string[], config: T) => void
}
