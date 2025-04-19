/**
 * 表达式求值工具 - 用于在自动操作模板中支持简单的JavaScript表达式
 */

// 表达式模式匹配
// {{js: expression}} - 完整的JavaScript表达式
const JS_EXPRESSION_REGEX = /\{\{\s*js:\s*(.*?)\s*\}\}/g;

/**
 * 处理模板中的表达式
 * @param template 包含表达式的模板字符串
 * @param context 上下文对象，包含可在表达式中访问的变量
 * @returns 处理后的字符串
 */
export function evaluateTemplateExpressions(template: string, context: Record<string, any>): string {
  if (!template) return "";

  return template.replace(JS_EXPRESSION_REGEX, (match, expression) => {
    try {
      // 创建一个安全的求值函数
      const evalInContext = new Function(...Object.keys(context), `
        try {
          return ${expression};
        } catch (e) {
          return "[表达式错误: " + e.message + "]";
        }
      `);

      // 执行表达式并返回结果
      const result = evalInContext(...Object.values(context));
      return result !== undefined ? String(result) : "";
    } catch (error) {
      console.error("表达式求值错误:", error);
      return `[表达式错误: ${(error as Error).message}]`;
    }
  });
}

/**
 * 检查模板中是否包含JavaScript表达式
 * @param template 要检查的模板字符串
 * @returns 是否包含表达式
 */
export function containsJsExpression(template: string): boolean {
  return JS_EXPRESSION_REGEX.test(template);
}

/**
 * 转义字符串中的特殊字符，使其可以安全地在正则表达式中使用
 * @param string 要转义的字符串
 * @returns 转义后的字符串
 */
export function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * 将普通占位符格式转换为JS表达式格式
 * 例如: {{user.name}} 转换为 {{js: user.name}}
 * @param template 包含普通占位符的模板
 * @param placeholders 占位符列表
 * @returns 转换后的模板
 */
export function convertToJsExpressions(template: string, placeholders: {name: string, description: string}[]): string {
  let result = template;

  placeholders.forEach(p => {
    const placeholder = p.name;
    const path = placeholder.replace(/\{\{|\}\}/g, '').trim();
    const regex = new RegExp(escapeRegExp(placeholder), 'g');
    result = result.replace(regex, `{{js: ${path}}}`);
  });

  return result;
}

/**
 * 为礼物感谢模块创建上下文对象
 * @param user 用户信息
 * @param gift 礼物信息
 * @returns 上下文对象
 */
export function createGiftThankContext(user: { uid: number; name: string },
                                     gift: { name: string; count: number; price: number }): Record<string, any> {
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
      isExpensive: gift.price >= 50
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
      formatted: new Intl.DateTimeFormat('zh-CN').format(new Date())
    }
  };
}

/**
 * 为入场欢迎模块创建上下文对象
 * @param user 用户信息
 * @returns 上下文对象
 */
export function createEntryWelcomeContext(user: { uid: number; name: string; medal?: { level: number; name: string } }): Record<string, any> {
  return {
    user: {
      uid: user.uid,
      name: user.name,
      nameLength: user.name.length,
      medal: user.medal || { level: 0, name: '' },
      hasMedal: !!user.medal
    },
    date: {
      now: new Date(),
      timestamp: Date.now(),
      formatted: new Intl.DateTimeFormat('zh-CN').format(new Date()),
      hour: new Date().getHours()
    },
    // 时间相关的便捷函数
    timeOfDay: () => {
      const hour = new Date().getHours();
      if (hour < 6) return '凌晨';
      if (hour < 12) return '上午';
      if (hour < 14) return '中午';
      if (hour < 18) return '下午';
      return '晚上';
    }
  };
}

/**
 * 为自动回复模块创建上下文对象
 * @param user 用户信息
 * @param message 消息内容
 * @returns 上下文对象
 */
export function createAutoReplyContext(user: { uid: number; name: string; medal?: { level: number; name: string } },
                                    message: string): Record<string, any> {
  return {
    user: {
      uid: user.uid,
      name: user.name,
      nameLength: user.name.length,
      medal: user.medal || { level: 0, name: '' },
      hasMedal: !!user.medal
    },
    message: {
      content: message,
      length: message.length,
      containsQuestion: message.includes('?') || message.includes('？'),
      words: message.split(/\s+/).filter(Boolean)
    },
    date: {
      now: new Date(),
      timestamp: Date.now(),
      formatted: new Intl.DateTimeFormat('zh-CN').format(new Date())
    }
  };
}