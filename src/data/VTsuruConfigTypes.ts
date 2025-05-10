import { UploadFileResponse } from '@/api/api-models';
import { SelectOption } from 'naive-ui';
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
  /**
   * 可选的条件显示属性
   * 根据一个函数决定当前配置项是否可见
   * @param config 整个配置对象
   * @returns 是否显示此配置项
   */
  visibleWhen?: (config: any) => boolean;
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

// 添加辅助函数，用于从配置对象中安全获取数据
export function getConfigValue<T, K extends keyof T>(config: T, key: K): T[K] {
  return config[key];
}

// 添加辅助函数，用于设置配置对象的数据
export function setConfigValue<T, K extends keyof T>(config: T, key: K, value: T[K]): void {
  config[key] = value;
}

// 创建一个默认的RGBA颜色对象
export function createDefaultRGBA(r = 0, g = 0, b = 0, a = 1): RGBAColor {
  return { r, g, b, a };
}

// 添加类型守卫函数，用于检查上传文件信息
export function isUploadFileInfo(obj: any): obj is UploadFileResponse {
  return (
    obj &&
    typeof obj === 'object' &&
    'id' in obj &&
    typeof obj.id === 'number' &&
    'path' in obj &&
    typeof obj.path === 'string' &&
    'name' in obj &&
    typeof obj.name === 'string' &&
    'hash' in obj &&
    typeof obj.hash === 'string'
  );
}

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


export type TemplateConfigSelectItem<T = unknown> = TemplateConfigItemWithType<T, string> & {
  type: 'select';
  options: SelectOption[] | ((config: T) => SelectOption[]); // 选项列表或者返回选项列表的函数
  placeholder?: string; // 可选的占位符
  clearable?: boolean;  // 是否可清空
};

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

// RGBA颜色对象接口
export interface RGBAColor {
  r: number;
  g: number;
  b: number;
  a: number;
}

// 修改 TemplateConfigColorItem 以使用 RGBAColor 接口
export type TemplateConfigColorItem<T = unknown> = TemplateConfigItemWithType<T, RGBAColor> & {
  type: 'color';
  showAlpha?: boolean; // 控制是否显示透明度调整
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
export type TemplateConfigBooleanItem<T = unknown> = TemplateConfigItemWithType<T, boolean> & {
  type: 'boolean';
  description?: string; // 可选的描述
};

// 将文件类型统一为数组，不再根据fileLimit区分
export type TemplateConfigFileItem<T = unknown> =
  TemplateConfigItemWithType<T, UploadFileResponse[]> & {
    type: 'file';
    fileLimit?: number; // 变为可选参数，仅用于UI限制，不影响类型
    fileType?: string[];
    onUploaded?: (data: UploadFileResponse[], config: T) => void;
  };

// --- 新增：装饰性图片配置 ---

/**
 * @description 单个装饰图片的属性接口
 */
export interface DecorativeImageProperties extends UploadFileResponse {
  x: number;         // X 坐标 (%)
  y: number;         // Y 坐标 (%)
  width: number;     // 宽度 (%)
  // height: number; // 高度通常由宽度和图片比例决定，或设为 auto
  rotation: number;  // 旋转角度 (deg)
  opacity: number;   // 透明度 (0-1)
  zIndex: number;    // 层叠顺序
}

/**
 * @description 用于管理装饰性图片数组的渲染配置项。
 * 由于 UI 复杂性，使用 TemplateConfigRenderItem。
 * @template T - 完整配置对象的类型 (默认为 unknown)。
 */
export interface TemplateConfigDecorativeImagesItem<T = unknown> extends TemplateConfigBase {
  type: 'decorativeImages'; // 新类型标识符
  default?: DecorativeImageProperties[]; // 默认值是图片属性数组

  /**
   * @description 渲染此项的自定义 VNode (配置 UI)。
   * @param config 整个配置对象 (类型为 T, 默认为 unknown)。
   * @returns 表示配置 UI 的 VNode。
   */
  render?(config: T): VNode;

  /**
   * @description 当装饰图片数组更新时调用的回调。
   * @param data 更新后的 DecorativeImageProperties 数组。
   * @param config 整个配置对象。
   */
  onUploaded?(data: DecorativeImageProperties[], config: T): void; // data 类型是数组

  // 继承 TemplateConfigBase 的 default?: any
}

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
 * 使用 `<any>` 作为完整配置类型 T 的占位符。
 */
export type ConfigItemDefinition =
  | TemplateConfigStringItem<any>
  | TemplateConfigNumberItem<any>
  | TemplateConfigStringArrayItem<any>
  | TemplateConfigNumberArrayItem<any>
  | TemplateConfigFileItem<any>
  | TemplateConfigRenderItem<any>
  | TemplateConfigDecorativeImagesItem<any>
  | TemplateConfigSliderNumberItem<any>
  | TemplateConfigBooleanItem<any>
  | TemplateConfigColorItem<any>
  | TemplateConfigSelectItem<any>;

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
    : ItemWithKeyK extends { type: 'string' | 'select'; } ? string
    : ItemWithKeyK extends { type: 'stringArray'; } ? string[]
    : ItemWithKeyK extends { type: 'number' | 'sliderNumber' ; } ? number
    : ItemWithKeyK extends { type: 'numberArray'; } ? number[]
    // 文件类型统一处理为数组
    : ItemWithKeyK extends { type: 'file'; } ? UploadFileResponse[]
    : ItemWithKeyK extends { type: 'boolean'; } ? boolean
    : ItemWithKeyK extends { type: 'color'; } ? RGBAColor
    : ItemWithKeyK extends { type: 'decorativeImages'; } ? DecorativeImageProperties[]
    // *** 优化应用：无 default 的 render 类型回退到 'unknown' ***
    : ItemWithKeyK extends { type: 'render'; } ? unknown
    // 其他意外情况的回退类型
    : unknown
    : never // 如果 K 正确派生，则不应发生
  };


// --- Key 约束辅助类型 ---
/**
 * @description 根据配置项的 'type' 约束其 'key' 属性。
 * - type: 'file'或'decorativeImages'等包含UploadFileInfo的类型的key必须以'File'结尾。
 * - 其他type的key禁止以'File'结尾。
 * @template Item - 待检查的配置项定义类型。
 */
type ConstrainedKeyItem<Item extends ConfigItemDefinition> =
    // 所有包含UploadFileInfo的类型必须以'File'结尾
    Item extends { type: 'file' } | { type: 'decorativeImages' }
        // 强制key以'File'结尾
        ? Omit<Item, 'key'> & { key: `${string}File` }
        : Item extends { key: infer K extends string }
            // 对于其它类型，检查key是否以'File'结尾
            ? K extends `${string}File`
                // 如果以'File'结尾，则类型无效(never)，导致TypeScript报错
                ? never
                // 如果不以'File'结尾，则类型有效
                : Item
            // 如果Item没有key属性(理论上不应发生)，保持原样
            : Item;

/**
 * @description 定义并验证配置项数组。
 * 使用 `const Items` 可以在与 `as const` 结合使用时保留字面量类型和元组结构。
 * 此函数现在会强制执行 key 的命名规则：'file' 类型 key 必须以 'File' 结尾，其他类型禁止。
 * @template Items - 一个只读的配置项定义数组，每个元素都必须满足 ConstrainedKeyItem 约束。
 * @param items 一个只读的配置项定义数组。
 * @returns 类型被保留且经过验证的同一个只读数组。
 */
export function defineTemplateConfig<
    // 应用 ConstrainedKeyItem 约束到数组的每个元素
    const Items extends readonly ConstrainedKeyItem<ConfigItemDefinition>[]
>(items: Items): Items {
    // 可选的运行时验证，用于在浏览器控制台提供更友好的错误提示
    items.forEach(item => {
      // 类型守卫确保 item 有 key 和 type 属性
      if ('key' in item && typeof item.key === 'string' && 'type' in item && typeof item.type === 'string') {
        // 检查是否是需要File后缀的类型
        const requiresFileSuffix = item.type === 'file' || item.type === 'decorativeImages';

        if (requiresFileSuffix) {
            if (!item.key.endsWith('File')) {
                console.error(`类型错误: 配置项 "${item.key}" 类型为 '${item.type}' 但 key 未以 'File' 结尾。`);
            }
        } else {
            if (item.key.endsWith('File')) {
                console.error(`类型错误: 配置项 "${item.key}" 类型为 '${item.type}' 但 key 以 'File' 结尾。`);
            }
        }
      }
    });
    return items;
}

// --- 增强型工具类型 ---

/**
 * 确保数值在指定范围内的工具类型
 */
export type NumericRange<Min extends number, Max extends number> =
  number extends Min ? number :
  number extends Max ? number :
  Min | Max | Exclude<number, Min | Max>;

/**
 * 非空数组工具类型
 */
export type NonEmptyArray<T> = [T, ...T[]];

// --- 改进 rgbaToString 函数，添加更严格的类型检查 ---
export function rgbaToString(color: RGBAColor | undefined | null): string {
  if (!color) return 'rgba(0,0,0,0)';

  // 额外的类型安全检查
  const r = Math.min(255, Math.max(0, Math.round(color.r)));
  const g = Math.min(255, Math.max(0, Math.round(color.g)));
  const b = Math.min(255, Math.max(0, Math.round(color.b)));
  const a = Math.min(1, Math.max(0, color.a));

  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

/**
 * 辅助函数：创建一个配置对象的模板工厂函数
 * @param items 配置项定义数组
 * @returns 创建配置对象的工厂函数
 */
export function createTemplateConfigFactory<const Items extends readonly ConstrainedKeyItem<ConfigItemDefinition>[]>(
  items: Items
) {
  // 返回一个工厂函数，用于创建初始化的配置对象
  return (): ExtractConfigData<Items> => {
    const config = {} as ExtractConfigData<Items>;

    // 使用项定义中的默认值初始化配置对象
    for (const item of items) {
      if ('default' in item && item.default !== undefined) {
        if (typeof config === 'object' && item.key) {
          // @ts-ignore - 动态赋值
          config[item.key] = item.default;
        }
      }
    }

    return config;
  };
}

/**
 * 模板配置校验函数类型
 */
export type TemplateConfigValidator<T> = (config: T) => { valid: boolean; message?: string };

/**
 * 创建配置验证器
 * @param validator 验证函数
 * @returns 验证器函数
 */
export function createConfigValidator<T>(validator: TemplateConfigValidator<T>) {
  return validator;
}

/**
 * 类型守卫：检查对象是否为有效的RGBA颜色
 */
export function isValidRGBAColor(obj: any): obj is RGBAColor {
  return (
    obj &&
    typeof obj === 'object' &&
    'r' in obj && typeof obj.r === 'number' &&
    'g' in obj && typeof obj.g === 'number' &&
    'b' in obj && typeof obj.b === 'number' &&
    'a' in obj && typeof obj.a === 'number'
  );
}