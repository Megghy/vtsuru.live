import { VNode, h } from 'vue'; // 导入 Vue 的 VNode 类型和 h 函数（用于示例）

// --- 基础和通用类型 ---

interface TemplateConfigBase {
  name: string | VNode; // 名称，可以是字符串或 VNode
  key: string;         // 唯一标识符，用于数据对象的键
  /**
   * 可选的默认值。
   * 其具体类型在更具体的项类型中被细化。
   * TemplateConfigRenderItem 会使用其是否存在来进行类型推断。
   */
  default?: any;
}

// 大多数项类型共享的通用属性 (暂时排除 RenderItem)
// 我们使用 'unknown' 作为 T 的默认值，表示在定义单个项时
// 完整的配置对象类型是未知的。
type CommonProps<T = unknown> = TemplateConfigBase & {
  // 注意：T 代表 *整个* 配置对象的数据类型。
  // 由于类型推断的方式（T 依赖于完整的 items 数组），
  // 在单个项定义内部的回调函数/访问器中的 'config' 参数
  // 通常会是 'unknown' 类型。如果在实现中需要访问
  // 完整配置对象的特定属性，你可能需要进行类型断言
  // (例如：config as MyConfigType)。
};

// 数据访问器类型
type DataAccessor<T, V> = {
  get: (config: T) => V;
  set: (config: T, value: V) => void;
};

/**
 * @description 带有特定值类型 'V' 的配置项的基础类型。
 * @template T - 完整配置对象的类型 (默认为 unknown)。
 * @template V - 此特定配置项的值的类型。
 */
export type TemplateConfigItemWithType<T = unknown, V = unknown> = CommonProps<T> & {
  type: string; // 类型判别属性
  data?: DataAccessor<T, V>; // 可选的数据访问器
  /**
   * @description 可选的上传/更新回调函数。
   * @param data - 当前项更新的数据，类型为 V。
   * @param config - 整个配置数据对象，类型为 T (通常是 unknown)。
   */
  onUploaded?: (data: V, config: T) => void;
  /**
   * 可选的默认值，约束为类型 V。
   * 覆盖了 TemplateConfigBase 中的 'any' 类型。
   */
  default?: V;
};

// --- Widen 工具类型 (保持不变) ---
// 递归地将类型拓宽为其基础类型。
type Widen<T> =
  T extends string ? string :
  T extends number ? number :
  T extends boolean ? boolean :
  T extends bigint ? bigint :
  T extends symbol ? symbol :
  T extends undefined ? undefined :
  T extends null ? null :
  T extends Function ? T :
  T extends Date ? Date :
  T extends readonly (infer U)[] ? Widen<U>[] :
  T extends object ? { -readonly [K in keyof T]: Widen<T[K]> } :
  T;

// --- 具体配置项类型定义 ---
// T 在所有具体类型中默认为 unknown

export type TemplateConfigStringItem<T = unknown> = TemplateConfigItemWithType<T, string> & {
  type: 'string';
  placeholder?: string; // 可选的占位符
  inputType?: 'text' | 'password' | 'textarea'; // 可选的输入类型
};

export type TemplateConfigStringArrayItem<T = unknown> = TemplateConfigItemWithType<T, string[]> & {
  type: 'stringArray';
};

export type TemplateConfigNumberItem<T = unknown> = TemplateConfigItemWithType<T, number> & {
  type: 'number';
  min?: number;
  max?: number;

};

export type TemplateConfigColorItem<T = unknown> = TemplateConfigItemWithType<T, number> & {
  type: 'color';
  showAlpha?: boolean;
};

export type TemplateConfigSliderNumberItem<T = unknown> = TemplateConfigItemWithType<T, number> & {
  type: 'sliderNumber';
  step?: number;
  min?: number;
  max?: number;
};

export type TemplateConfigNumberArrayItem<T = unknown> = TemplateConfigItemWithType<T, number[]> & {
  type: 'numberArray';
};

export type TemplateConfigImageItem<T = unknown> = TemplateConfigItemWithType<T, string[]> & {
  type: 'image';
  imageLimit: number; // 图片数量限制
};

/**
 * @description 自定义渲染项的配置。使用 'this' 类型实现动态参数类型。
 * @template T - 完整配置对象的类型 (默认为 unknown)。
 */
export interface TemplateConfigRenderItem<T = unknown> extends TemplateConfigBase { // 继承基础接口以获取 key, name, default 检查
  type: 'render';

  /**
   * @description 渲染此项的自定义 VNode。
   * @param this 当前的 TemplateConfigRenderItem 实例。
   * @param config 整个配置对象 (类型为 T, 默认为 unknown)。
   *               在实现内部可能需要类型断言 (例如 `config as MyConfig`)。
   * @param defaultData 从此项的 'default' 属性派生的数据。
   *               如果 `default` 存在，其类型为 `Widen<D>` (D 是 default 的类型)，否则为 `unknown`。
   * @returns 表示渲染输出的 VNode。
   *
   * @importantUsage 调用此方法时，如果项定义了 `default` 属性，
   *                 则 **必须** 将该项的默认值 (或与其 Widen 后的类型兼容的值)
   *                 作为第二个参数传递。如果不存在 `default`，则传递 `undefined` 或 `null`。
   *                 示例: `item.render(config, item.default)`
   */
  render(this: this, config: T): VNode;

  /**
   * @description 可选的回调函数，当自定义渲染的组件发出更新信号时调用。
   * @param this 当前的 TemplateConfigRenderItem 实例。
   * @param data 更新后的数据。如果 `default` 存在，其类型为 `Widen<D>`，否则为 `unknown`。
   * @param config 整个配置对象 (类型为 T, 默认为 unknown)。
   *               在实现内部可能需要类型断言 (例如 `config as MyConfig`)。
   */
  onUploaded?(this: this, data: this extends { default: infer D; } ? Widen<D> : unknown, config: T): void;

  // 继承自 TemplateConfigBase 的 'default?: any'，这对于
  // 'this extends { default: infer D }' 类型检查能正确工作至关重要。
}

// --- 联合类型和核心提取逻辑 ---

/**
 * @description 所有可能的配置项定义类型的联合类型。
 * 使用 `<unknown>` 作为完整配置类型 T 的占位符。
 */
export type ConfigItemDefinition =
  | TemplateConfigStringItem<any>
  | TemplateConfigNumberItem<any>
  | TemplateConfigStringArrayItem<any>
  | TemplateConfigNumberArrayItem<any>
  | TemplateConfigImageItem<any>
  | TemplateConfigRenderItem<any> // 包含优化后的 render/onUploaded 方法
  | TemplateConfigSliderNumberItem<any>
  | TemplateConfigColorItem<any>;

/**
 * @description 从只读的配置项数组中提取最终的数据结构类型。
 * @template Items - 通过 `defineItems([...])` 推断出的只读元组类型。
 */
export type ExtractConfigData<
  Items extends readonly ConfigItemDefinition[]
> = {
    // 遍历联合类型 Items[number] 中所有项的 'key' 属性
    [K in Extract<Items[number], { key: string; }>['key']]:
    // 找到与当前键 K 匹配的具体项定义
    Extract<Items[number], { key: K; }> extends infer ItemWithKeyK
    // 检查匹配到的项是否有 'default' 属性
    ? ItemWithKeyK extends { default: infer DefaultType; }
    // 如果有，使用 default 值的 Widen 处理后的类型
    ? Widen<DefaultType>
    // 如果没有 default，则根据 'type' 属性确定类型
    : ItemWithKeyK extends { type: 'string'; } ? string
    : ItemWithKeyK extends { type: 'stringArray'; } ? string[]
    : ItemWithKeyK extends { type: 'number' | 'sliderNumber' | 'color'; } ? number
    : ItemWithKeyK extends { type: 'numberArray'; } ? number[]
    : ItemWithKeyK extends { type: 'image'; } ? string[]
    // *** 优化应用：无 default 的 render 类型回退到 'unknown' ***
    : ItemWithKeyK extends { type: 'render'; } ? unknown
    // 其他意外情况的回退类型
    : unknown
    : never // 如果 K 正确派生，则不应发生
  };

/**
 * @description 定义并验证配置项数组。
 * 使用 `const Items` 可以在与 `as const` 结合使用时保留字面量类型和元组结构。
 * @param items 一个只读的配置项定义数组。
 * @returns 类型被保留的同一个只读数组。
 */
export function defineItems<
  const Items extends readonly ConfigItemDefinition[] // 使用 'const' 泛型进行推断
>(items: Items): Items {
  // 如果需要，可以在此处添加基本的运行时验证。
  // 类型检查主要由 TypeScript 根据约束完成。
  return items;
}