import { TriggerType } from '@/apps/client/store/autoAction/types'

export interface Placeholder {
  name: string
  description: string
}

// 所有模板通用的基础占位符
export const BASE_PLACEHOLDERS: Placeholder[] = [
  { name: '{{user.name}}', description: '用户名称' },
  { name: '{{user.uid}}', description: '用户ID' },
  { name: '{{user.guardLevel}}', description: '用户舰队等级 (0:无, 1:总督, 2:提督, 3:舰长)' },
  { name: '{{user.hasMedal}}', description: '用户是否佩戴粉丝勋章 (true/false)' },
  { name: '{{user.medalLevel}}', description: '用户佩戴的粉丝勋章等级' },
  { name: '{{user.medalName}}', description: '用户佩戴的粉丝勋章名称' },
  { name: '{{date.formatted}}', description: '当前日期时间 (格式化)' },
  { name: '{{date.year}}', description: '当前年份' },
  { name: '{{date.month}}', description: '当前月份' },
  { name: '{{date.day}}', description: '当前日期' },
  { name: '{{date.hour}}', description: '当前小时 (0-23)' },
  { name: '{{date.minute}}', description: '当前分钟' },
  { name: '{{date.second}}', description: '当前秒数' },
  { name: '{{timeOfDay}}', description: '当前时段 (凌晨/早上/上午/中午/下午/晚上/深夜)' },
  { name: '{{event}}', description: '原始事件对象 (高级用法)' },
]

// 各触发类型特有的占位符
export const TRIGGER_PLACEHOLDERS: Partial<Record<TriggerType, Placeholder[]>> = {
  [TriggerType.DANMAKU]: [
    { name: '{{message}}', description: '弹幕内容' },
    { name: '{{danmaku}}', description: '弹幕事件对象' },
  ],
  [TriggerType.GIFT]: [
    { name: '{{gift.name}}', description: '礼物名称' },
    { name: '{{gift.count}}', description: '礼物数量' },
    { name: '{{gift.price}}', description: '礼物单价(元)' },
    { name: '{{gift.totalPrice}}', description: '礼物总价值(元)' },
    { name: '{{gift.summary}}', description: '礼物概要 (例如: 5个小心心)' },
  ],
  [TriggerType.GUARD]: [
    { name: '{{guard.level}}', description: '开通的舰队等级 (1:总督, 2:提督, 3:舰长)' },
    { name: '{{guard.levelName}}', description: '开通的舰队等级名称' },
    { name: '{{guard.giftCode}}', description: '舰长礼物代码 (预留字段)' },
  ],
  [TriggerType.SUPER_CHAT]: [
    { name: '{{sc.message}}', description: 'SC留言内容' },
    { name: '{{sc.price}}', description: 'SC金额(元)' },
  ],
}

// 签到模板特有的占位符
export const CHECKIN_PLACEHOLDERS: Placeholder[] = [
  { name: '{{checkin.points}}', description: '获得的总积分' },
  { name: '{{checkin.consecutiveDays}}', description: '连续签到天数' },
  { name: '{{checkin.todayRank}}', description: '今日签到排名' },
  { name: '{{checkin.time}}', description: '签到时间对象' },
]

// 按触发类型合并基础与特有占位符 (特有的排在前面), 并去重
export function getMergedPlaceholders(triggerType: TriggerType): Placeholder[] {
  const specific = TRIGGER_PLACEHOLDERS[triggerType] ?? []
  const merged = [...specific, ...BASE_PLACEHOLDERS]
  return Array.from(new Map(merged.map(item => [item.name, item])).values())
}
