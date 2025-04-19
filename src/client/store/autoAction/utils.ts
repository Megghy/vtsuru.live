import { nanoid } from 'nanoid';
import {
  AutoActionItem,
  TriggerType,
  ActionType,
  Priority,
  RuntimeState,
  ExecutionContext
} from './types';

/**
 * 创建默认的运行时状态
 */
export function createDefaultRuntimeState(): RuntimeState {
  return {
    lastExecutionTime: {},
    scheduledTimers: {},
    sentGuardPms: new Set(),
    aggregatedEvents: {}
  };
}

/**
 * 创建默认的自动操作项
 * @param triggerType 触发类型
 */
export function createDefaultAutoAction(triggerType: TriggerType): AutoActionItem {
  const id = `auto-action-${nanoid(8)}`;

  // 根据不同触发类型设置默认模板
  const defaultTemplates: Record<TriggerType, string[]> = {
    [TriggerType.DANMAKU]: ['收到 @{user.name} 的弹幕: {event.msg}'],
    [TriggerType.GIFT]: ['感谢 @{user.name} 赠送的 {gift.summary}'],
    [TriggerType.GUARD]: ['感谢 @{user.name} 开通了{guard.levelName}！'],
    [TriggerType.FOLLOW]: ['感谢 @{user.name} 的关注！'],
    [TriggerType.ENTER]: ['欢迎 @{user.name} 进入直播间'],
    [TriggerType.SCHEDULED]: ['这是一条定时消息，当前时间: {date.formatted}'],
    [TriggerType.SUPER_CHAT]: ['感谢 @{user.name} 的SC: {sc.message}'],
  };

  // 根据不同触发类型设置默认名称
  const defaultNames: Record<TriggerType, string> = {
    [TriggerType.DANMAKU]: '弹幕回复',
    [TriggerType.GIFT]: '礼物感谢',
    [TriggerType.GUARD]: '舰长感谢',
    [TriggerType.FOLLOW]: '关注感谢',
    [TriggerType.ENTER]: '入场欢迎',
    [TriggerType.SCHEDULED]: '定时消息',
    [TriggerType.SUPER_CHAT]: 'SC感谢',
  };

  return {
    id,
    name: defaultNames[triggerType] || '新建自动操作',
    enabled: true,
    triggerType,
    actionType: triggerType === TriggerType.GUARD ? ActionType.SEND_PRIVATE_MSG : ActionType.SEND_DANMAKU,
    priority: Priority.NORMAL,
    templates: defaultTemplates[triggerType] || ['默认模板'],
    logicalExpression: '',
    executeCommand: '',
    ignoreCooldown: false,
    triggerConfig: {
      onlyDuringLive: true,
      ignoreTianXuan: true,
      userFilterEnabled: false,
      requireMedal: false,
      requireCaptain: false,
      preventRepeat: triggerType === TriggerType.GUARD,
      intervalSeconds: triggerType === TriggerType.SCHEDULED ? 300 : undefined,
    },
    actionConfig: {
      delaySeconds: 0,
      cooldownSeconds: 5,
      maxUsersPerMsg: 5,
      maxItemsPerUser: 3
    }
  };
}

/**
 * 从模板数组中随机选择一个
 * @param templates 模板数组
 */
export function getRandomTemplate(templates: string[]): string | null {
  if (!templates || templates.length === 0) return null;
  const index = Math.floor(Math.random() * templates.length);
  return templates[index];
}

/**
 * 格式化模板，替换变量
 * @param template 模板字符串
 * @param context 执行上下文
 */
export function formatTemplate(template: string, context: ExecutionContext): string {
  if (!template) return '';

  // 简单的模板替换
  return template.replace(/{([^}]+)}/g, (match, path) => {
    try {
      // 解析路径
      const parts = path.trim().split('.');
      let value: any = context;

      // 特殊处理函数类型
      if (parts[0] === 'timeOfDay' && typeof context.variables.timeOfDay === 'function') {
        return context.variables.timeOfDay();
      }

      // 特殊处理event直接访问
      if (parts[0] === 'event') {
        value = context.event;
        parts.shift();
      } else {
        // 否则从variables中获取
        value = context.variables;
      }

      // 递归获取嵌套属性
      for (const part of parts) {
        if (value === undefined || value === null) return match;
        value = value[part];
        if (typeof value === 'function') value = value();
      }

      return value !== undefined && value !== null ? String(value) : match;
    } catch (error) {
      console.error('模板格式化错误:', error);
      return match; // 出错时返回原始匹配项
    }
  });
}

/**
 * 计算逻辑表达式
 * @param expression 表达式字符串
 * @param context 执行上下文
 */
export function evaluateExpression(expression: string, context: ExecutionContext): boolean {
  if (!expression || expression.trim() === '') return true; // 空表达式默认为true

  try {
    // 预定义函数和变量
    const utils = {
      // 事件相关
      inDanmaku: (keyword: string) => {
        if (!context.event?.msg) return false;
        return context.event.msg.includes(keyword);
      },

      // 礼物相关
      giftValue: () => {
        if (!context.event) return 0;
        return (context.event.price || 0) * (context.event.num || 1) / 1000;
      },

      giftName: () => context.event?.msg || '',
      giftCount: () => context.event?.num || 0,

      // 用户相关
      hasMedal: () => context.event?.fans_medal_wearing_status || false,
      medalLevel: () => context.event?.fans_medal_level || 0,
      isCaptain: () => (context.event?.guard_level || 0) > 0,

      // 时间相关
      time: {
        hour: new Date().getHours(),
        minute: new Date().getMinutes()
      },

      // 字符串处理
      str: {
        includes: (str: string, search: string) => str.includes(search),
        startsWith: (str: string, search: string) => str.startsWith(search),
        endsWith: (str: string, search: string) => str.endsWith(search)
      }
    };

    // 创建安全的eval环境
    const evalFunc = new Function(
      'context',
      'event',
      'utils',
      `try {
        with(utils) {
          return (${expression});
        }
      } catch(e) {
        console.error('表达式评估错误:', e);
        return false;
      }`
    );

    // 执行表达式
    return Boolean(evalFunc(context, context.event, utils));
  } catch (error) {
    console.error('表达式评估错误:', error);
    return false; // 出错时返回false
  }
}

/**
 * 格式化消息模板，替换变量
 * @param template 模板字符串
 * @param params 参数对象
 */
export function formatMessage(template: string, params: Record<string, any>): string {
  if (!template) return '';

  // 简单的模板替换
  return template.replace(/{{([^}]+)}}/g, (match, path) => {
    try {
      // 解析路径
      const parts = path.trim().split('.');
      let value: any = params;

      // 递归获取嵌套属性
      for (const part of parts) {
        if (value === undefined || value === null) return match;
        value = value[part];
        if (typeof value === 'function') value = value();
      }

      return value !== undefined && value !== null ? String(value) : match;
    } catch (error) {
      console.error('模板格式化错误:', error);
      return match; // 出错时返回原始匹配项
    }
  });
}

/**
 * 检查是否应该处理自动操作
 * @param config 配置对象，需要包含enabled和onlyDuringLive属性
 * @param isLive 当前是否为直播状态
 */
export function shouldProcess(config: { enabled: boolean; onlyDuringLive: boolean }, isLive: boolean): boolean {
  if (!config.enabled) return false;
  if (config.onlyDuringLive && !isLive) return false;
  return true;
}

/**
 * 检查用户是否符合过滤条件
 * @param config 配置对象，需要包含userFilterEnabled、requireMedal和requireCaptain属性
 * @param event 事件对象
 */
export function checkUserFilter(config: { userFilterEnabled: boolean; requireMedal: boolean; requireCaptain: boolean }, event: { fans_medal_wearing_status?: boolean; guard_level?: number }): boolean {
  if (!config.userFilterEnabled) return true;
  if (config.requireMedal && !event.fans_medal_wearing_status) return false;
  if (config.requireCaptain && (!event.guard_level || event.guard_level === 0)) return false;
  return true;
}

/**
 * 构建执行上下文对象
 * @param event 事件对象
 * @param roomId 房间ID
 * @param triggerType 触发类型
 * @returns 标准化的执行上下文
 */
export function buildExecutionContext(
  event: any,
  roomId: number | undefined,
  triggerType?: TriggerType
): ExecutionContext {
  const now = Date.now();
  const dateObj = new Date(now);

  // 基础上下文
  const context: ExecutionContext = {
    event,
    roomId,
    timestamp: now,
    variables: {
      // 日期相关变量
      date: {
        formatted: dateObj.toLocaleString('zh-CN'),
        year: dateObj.getFullYear(),
        month: dateObj.getMonth() + 1,
        day: dateObj.getDate(),
        hour: dateObj.getHours(),
        minute: dateObj.getMinutes(),
        second: dateObj.getSeconds()
      },
      // 时段函数
      timeOfDay: () => {
        const hour = dateObj.getHours();
        if (hour < 6) return '凌晨';
        if (hour < 9) return '早上';
        if (hour < 12) return '上午';
        if (hour < 14) return '中午';
        if (hour < 18) return '下午';
        if (hour < 22) return '晚上';
        return '深夜';
      }
    }
  };

  // 如果有事件对象，添加用户信息
  if (event) {
    context.variables.user = {
      name: event.uname,
      uid: event.uid,
      guardLevel: event.guard_level,
      hasMedal: event.fans_medal_wearing_status,
      medalLevel: event.fans_medal_level,
      medalName: event.fans_medal_name
    };

    context.variables.message = event.msg;

    // 根据不同触发类型添加特定变量
    if (triggerType === TriggerType.GIFT) {
      context.variables.gift = {
        name: event.msg, // 礼物名称通常存在msg字段
        count: event.num,
        price: (event.price || 0) / 1000, // B站价格单位通常是 1/1000 元
        totalPrice: ((event.price || 0) / 1000) * (event.num || 1),
        summary: `${event.num || 1}个${event.msg || '礼物'}`
      };
    } else if (triggerType === TriggerType.GUARD) {
      const guardLevelMap: Record<number, string> = {
        1: '总督',
        2: '提督',
        3: '舰长',
        0: '无舰长'
      };
      context.variables.guard = {
        level: event.guard_level || 0,
        levelName: guardLevelMap[event.guard_level || 0] || '未知舰长等级',
        giftCode: ''
      };
    } else if (triggerType === TriggerType.SUPER_CHAT) {
      context.variables.sc = {
        message: event.msg,
        price: (event.price || 0) / 1000
      };
    }
  }

  return context;
}
