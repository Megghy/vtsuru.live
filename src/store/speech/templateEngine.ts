import type { EventModel } from '@/api/client-types'
import { EventDataTypes } from '@/api/generated/model'

import { templateConstants } from './settings'
import type { EventTemplateConfig, SpeechEventKey, SpeechSettings, TemplateCondition, TemplateRule } from './types'

const FANS_CLUB_GIFT_NAME = '粉丝团灯牌'

export function isJoinFansClubGift(data: EventModel, isOpenLiveSource: boolean): boolean {
  if (data.type !== EventDataTypes.Gift || data.msg !== FANS_CLUB_GIFT_NAME) return false
  const medalLevel = data.fans_medal_level ?? 0
  if (medalLevel === 0) return true
  return isOpenLiveSource && medalLevel === 1 && (data.num ?? 1) === 1
}

export function getEventKey(type: EventDataTypes): SpeechEventKey | null {
  switch (type) {
    case EventDataTypes.Message:
      return 'message'
    case EventDataTypes.Gift:
      return 'gift'
    case EventDataTypes.SC:
      return 'sc'
    case EventDataTypes.Guard:
      return 'guard'
    case EventDataTypes.Enter:
      return 'enter'
    case EventDataTypes.Follow:
      return 'follow'
    default:
      return null
  }
}

export function getGuardLevelName(guardLevel: number): string {
  switch (guardLevel) {
    case 1:
      return '总督'
    case 2:
      return '提督'
    case 3:
      return '舰长'
    default:
      return ''
  }
}

export function evaluateCondition(cond: TemplateCondition, data: EventModel): boolean {
  let fieldValue: number | string
  switch (cond.field) {
    case 'price':
      fieldValue = data.price ?? 0
      break
    case 'count':
      fieldValue = data.num ?? 0
      break
    case 'guard_level':
      fieldValue = data.guard_level ?? 0
      break
    case 'fans_medal_level':
      fieldValue = data.fans_medal_level ?? 0
      break
    case 'message_length':
      fieldValue = (data.msg ?? '').length
      break
    case 'message':
    case 'gift_name':
      fieldValue = data.msg ?? ''
      break
    default:
      return false
  }
  const numVal = typeof fieldValue === 'number' ? fieldValue : Number.parseFloat(fieldValue)
  const condNum = typeof cond.value === 'number' ? cond.value : Number.parseFloat(String(cond.value))
  switch (cond.op) {
    case '>=':
      return numVal >= condNum
    case '<=':
      return numVal <= condNum
    case '==':
      return numVal === condNum
    case 'contains':
      return String(fieldValue).includes(String(cond.value))
    case 'regex':
      try {
        return new RegExp(String(cond.value), 'i').test(String(fieldValue))
      } catch (err) {
        console.warn('[TTS] 无效条件正则表达式:', cond.value, err)
        return false
      }
    default:
      return false
  }
}

export function selectTemplate(config: EventTemplateConfig | undefined, data: EventModel): string | undefined {
  if (!config || config.rules.length === 0) return undefined
  const conditional: TemplateRule[] = []
  const unconditional: TemplateRule[] = []
  for (const rule of config.rules) {
    if (!rule.template) continue
    if (rule.conditions.length > 0) conditional.push(rule)
    else unconditional.push(rule)
  }
  for (const rule of conditional) {
    if (rule.conditions.every((c) => evaluateCondition(c, data))) return rule.template
  }
  if (unconditional.length > 0) {
    return unconditional[Math.floor(Math.random() * unconditional.length)].template
  }
  return undefined
}

export function renderSpeechTemplate(
  template: string,
  data: EventModel,
  settings: SpeechSettings,
): string {
  const isApiWithSplit = settings.provider === 'api' && Boolean(settings.providers.api?.splitText)

  let text = template
    .replace(templateConstants.name.regex, isApiWithSplit ? `'${data.uname || ''}'` : data.uname || '')
    .replace(templateConstants.count.regex, (data.num ?? 0).toString())
    .replace(templateConstants.price.regex, (data.price ?? 0).toString())
    .replace(templateConstants.message.regex, data.msg || '')
    .replace(templateConstants.guard_level.regex, getGuardLevelName(data.guard_level))
    .replace(templateConstants.fans_medal_level.regex, (data.fans_medal_level ?? 0).toString())
    .trim()

  if (data.type === EventDataTypes.Message) {
    text = text.replace(/\[.*?\]/g, ' ')
  } else if (data.type === EventDataTypes.Gift) {
    text = text.replace(templateConstants.gift_name.regex, data.msg || '')
  } else if (data.type === EventDataTypes.Guard) {
    text = text.replace(templateConstants.guard_num.regex, (data.num ?? 0).toString())
  }

  if (settings.textReplacements.length > 0) {
    for (const rule of settings.textReplacements) {
      if (!rule.pattern) continue
      try {
        if (rule.isRegex) {
          text = text.replace(new RegExp(rule.pattern, 'gi'), rule.replacement)
        } else {
          text = text.replaceAll(rule.pattern, rule.replacement)
        }
      } catch (err) {
        console.warn('[TTS] 无效文本替换正则:', rule.pattern, err)
      }
    }
  }

  if (settings.maxTextLength > 0 && text.length > settings.maxTextLength) {
    text = text.slice(0, settings.maxTextLength)
  }

  return text
}

export function insertSpaces(sentence: string): string {
  return sentence
    .replace(/\b[A-Z]{2,}\b/g, (match) => match.split('').join(' '))
    .replace(/\s+/g, ' ')
    .trim()
}
