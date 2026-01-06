/**
 * 表达式求值工具 - 用于在自动操作模板中支持简单的JavaScript表达式
 */

// 导入ExecutionContext类型
import type { ExecutionContext } from './types'

// 表达式模式匹配
// {{js: expression}} - 简单的JavaScript表达式 (隐式return)
// {{js+: code block}} - JavaScript代码块 (需要显式return)
// {{js-run: code block}} - JavaScript代码块 (需要显式return)
export const JS_EXPRESSION_REGEX = /\{\{\s*(js(?:\+|-run)?):([\s\S]*?)\}\}/g

/**
 * 处理模板中的表达式
 * @param template 包含表达式的模板字符串
 * @param context 执行上下文对象
 * @returns 处理后的字符串
 */
export function evaluateTemplateExpressions(template: string, context: ExecutionContext): string {
  // 增加严格的类型检查
  if (typeof template !== 'string') {
    console.error('[evaluateTemplateExpressions] Error: Expected template to be a string, but received:', typeof template, template)
    return '' // 或者抛出错误，或者返回一个默认值
  }

  if (!template) return ''

  // 获取基础变量和数据管理函数
  const variables = context.variables
  const dataFunctions = {
    getData: context.getData,
    setData: context.setData,
    containsData: context.containsData,
    removeData: context.removeData,
    getStorageData: context.getStorageData,
    setStorageData: context.setStorageData,
    hasStorageData: context.hasStorageData,
    removeStorageData: context.removeStorageData,
    clearStorageData: context.clearStorageData,
  }

  // 合并基础变量和数据管理函数的作用域
  const scopeVariables = { ...variables, ...dataFunctions }
  const scopeKeys = Object.keys(scopeVariables)
  const scopeValues = Object.values(scopeVariables)

  // 第一步：处理简单的文本替换 {{variable.path}}
  const result = template.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
    if (path.trim().startsWith('js:') || path.trim().startsWith('js+:') || path.trim().startsWith('js-run:')) {
      return match // 跳过所有JS变体，留给下一步
    }

    try {
      // 解析路径
      const parts = path.trim().split('.')
      let value: any = scopeVariables

      // 递归获取嵌套属性
      for (const part of parts) {
        if (value === undefined || value === null) return match
        if (Object.prototype.hasOwnProperty.call(dataFunctions, part) && parts.length === 1) {
          value = value[part] // 不要调用顶层函数
        } else if (typeof value[part] === 'function') {
          value = value[part]()
        } else {
          value = value[part]
        }
        if (typeof value === 'function' && !Object.prototype.hasOwnProperty.call(dataFunctions, part)) value = value()
      }

      return value !== undefined && value !== null ? String(value) : match
    } catch (error) {
      console.error('模板格式化错误:', error)
      return match // 出错时返回原始匹配项
    }
  })

  // 第二步：处理 JS 表达式和代码块 {{js: ...}}, {{js+: ...}}, {{js-run: ...}}
  return result.replace(JS_EXPRESSION_REGEX, (match, type, code) => {
    try {
      let functionBody: string

      if (type === 'js') {
        // 简单表达式: 隐式 return
        functionBody = `try { return (${code}); } catch (e) { console.error("表达式[js:]执行错误:", e, "代码:", ${JSON.stringify(code)}); return "[表达式错误: " + e.message + "]"; }`
      } else { // js+ 或 js-run
        // 代码块: 需要显式 return
        functionBody = `try { ${code} } catch (e) { console.error("代码块[js+/js-run:]执行错误:", e, "代码:", ${JSON.stringify(code)}); return "[代码块错误: " + e.message + "]"; }`
      }

      // eslint-disable-next-line ts/no-implied-eval, no-new-func
      const evalInContext = new Function(...scopeKeys, functionBody)

      const evalResult = evalInContext(...scopeValues)

      // 对结果进行处理，将 undefined/null 转换为空字符串，除非是错误消息
      return typeof evalResult === 'string' && (evalResult.startsWith('[表达式错误:') || evalResult.startsWith('[代码块错误:'))
        ? evalResult
        : String(evalResult ?? '')
    } catch (error) {
      // 捕获 Function 构造或顶层执行错误
      console.error('JS占位符处理错误:', error, '类型:', type, '代码:', code)
      return `[处理错误: ${(error as Error).message}]`
    }
  })
}

/**
 * 检查模板中是否包含JavaScript表达式
 * @param template 要检查的模板字符串
 * @returns 是否包含表达式
 */
export function containsJsExpression(template: string): boolean {
  return JS_EXPRESSION_REGEX.test(template)
}

/**
 * 转义字符串中的特殊字符，使其可以安全地在正则表达式中使用
 * @param string 要转义的字符串
 * @returns 转义后的字符串
 */
export function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * 将普通占位符格式转换为JS表达式格式
 * 例如: {{user.name}} 转换为 {{js: user.name}}
 * @param template 包含普通占位符的模板
 * @param placeholders 占位符列表
 * @returns 转换后的模板
 */
export function convertToJsExpressions(template: string, placeholders: { name: string, description: string }[]): string {
  let result = template

  placeholders.forEach((p) => {
    const placeholder = p.name
    const path = placeholder.replace(/\{\{|\}\}/g, '').trim()
    const regex = new RegExp(escapeRegExp(placeholder), 'g')
    result = result.replace(regex, `{{js: ${path}}}`)
  })

  return result
}

/**
 * 从模板字符串中提取所有 JS 表达式占位符。
 * 例如，从 'Hello {{js: user.name}}, time: {{js: Date.now()}}' 提取出
 * ['{{js: user.name}}', '{{js: Date.now()}}']
 * @param template 模板字符串
 * @returns 包含所有匹配的 JS 表达式字符串的数组
 */
export function extractJsExpressions(template: string): string[] {
  if (!template) {
    return []
  }
  // 使用全局匹配来查找所有出现
  const matches = template.match(JS_EXPRESSION_REGEX)
  return matches || [] // match 返回 null 或字符串数组
}

/**
 * 为礼物感谢模块创建上下文对象
 * @param user 用户信息
 * @param user.uid 用户 UID
 * @param user.name 用户名称
 * @param gift 礼物信息
 * @param gift.name 礼物名称
 * @param gift.count 礼物数量
 * @param gift.price 礼物单价
 * @returns 上下文对象
 */
export function createGiftThankContext(user: { uid: number, name: string }, gift: { name: string, count: number, price: number }): Record<string, any> {
  return {
    user: {
      uid: user.uid,
      name: user.name,
      // 额外方法和属性
      nameLength: user.name.length,
    },
    gift: {
      name: gift.name,
      count: gift.count,
      price: gift.price,
      totalPrice: gift.count * gift.price,
      // 工具方法
      summary: `${gift.count}个${gift.name}`,
      isExpensive: gift.price >= 50,
    },
    // 工具函数
    format: {
      currency: (value: number) => `¥${value.toFixed(2)}`,
      pluralize: (count: number, singular: string, plural: string) => count === 1 ? singular : plural,
    },
    // 日期时间
    date: {
      now: new Date(),
      timestamp: Date.now(),
      formatted: new Intl.DateTimeFormat('zh-CN').format(new Date()),
    },
  }
}
