// 统一的自动操作类型定义

import { EventModel } from '@/api/api-models';

// 触发条件类型
export enum TriggerType {
  DANMAKU = 'danmaku',   // 弹幕
  GIFT = 'gift',         // 礼物
  GUARD = 'guard',       // 上舰
  FOLLOW = 'follow',     // 关注
  ENTER = 'enter',       // 进入直播间
  SCHEDULED = 'scheduled', // 定时触发
  SUPER_CHAT = 'super_chat', // SC
}

// 操作类型
export enum ActionType {
  SEND_DANMAKU = 'send_danmaku',       // 发送弹幕
  SEND_PRIVATE_MSG = 'send_private_msg', // 发送私信
  EXECUTE_COMMAND = 'execute_command',  // 执行命令
}

// 优先级
export enum Priority {
  HIGHEST = 0,
  HIGH = 1,
  NORMAL = 2,
  LOW = 3,
  LOWEST = 4,
}

// 统一的自动操作定义
export type AutoActionItem = {
  id: string;            // 唯一ID
  name: string;          // 操作名称
  enabled: boolean;      // 是否启用
  triggerType: TriggerType; // 触发类型
  actionType: ActionType;   // 操作类型
  templates: string[];      // 模板列表
  priority: Priority;       // 优先级

  // 高级配置
  logicalExpression: string; // 逻辑表达式，为真时才执行此操作
  ignoreCooldown: boolean;   // 是否忽略冷却时间
  executeCommand: string;    // 要执行的JS代码

  // 触发器特定配置
  triggerConfig: {
    // 通用
    userFilterEnabled?: boolean; // 是否启用用户过滤
    requireMedal?: boolean;      // 要求本房间勋章
    requireCaptain?: boolean;    // 要求任意舰长
    onlyDuringLive?: boolean;    // 仅直播中启用
    ignoreTianXuan?: boolean;    // 天选时刻忽略

    // 弹幕触发特定
    keywords?: string[];         // 触发关键词
    blockwords?: string[];       // 屏蔽词

    // 礼物触发特定
    filterMode?: 'none' | 'blacklist' | 'whitelist' | 'value' | 'free'; // 礼物过滤模式
    filterGiftNames?: string[];  // 礼物黑/白名单
    minValue?: number;           // 最低礼物价值
    includeQuantity?: boolean;   // 是否包含礼物数量

    // 定时触发特定
    intervalSeconds?: number;    // 间隔秒数
    schedulingMode?: 'random' | 'sequential'; // 定时模式

    // 上舰特定
    guardLevels?: number[];      // 舰长等级过滤
    preventRepeat?: boolean;     // 防止重复发送
    giftCodes?: {level: number, codes: string[]}[]; // 礼品码
  };

  // 动作特定配置
  actionConfig: {
    delaySeconds?: number;       // 延迟执行秒数
    maxUsersPerMsg?: number;     // 每条消息最大用户数
    maxItemsPerUser?: number;    // 每用户最大项目数 (礼物等)
    cooldownSeconds?: number;    // 冷却时间(秒)
  };
}

// 执行上下文，包含事件信息和可用变量
export interface ExecutionContext {
  event?: EventModel;            // 触发事件
  roomId?: number;               // 直播间ID
  variables: Record<string, any>; // 额外变量
  timestamp: number;             // 时间戳
}

// 运行状态接口
export interface RuntimeState {
  lastExecutionTime: Record<string, number>; // 上次执行时间
  aggregatedEvents: Record<string, any[]>;   // 聚合的事件
  scheduledTimers: Record<string, NodeJS.Timeout | null>; // 定时器
  sentGuardPms: Set<number>;                // 已发送的舰长私信
}