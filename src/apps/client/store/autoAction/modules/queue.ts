import type { Ref } from 'vue'

import type { EventModel, ResponseQueueModel } from '@/api/client-types'
import { EventDataTypes, QueueFrom } from '@/api/generated/model'

import { executeActions, filterValidActions } from '../actionUtils'
import type { AutoActionItem, RuntimeState } from '../types'
import { TriggerType } from '../types'
import { buildExecutionContext } from '../utils'

export interface NormalizedQueueEvent {
  id: number
  userName: string
  uid: number
  openId: string
  content: string
  source: string
  names: string
  count: number
  waitingCount: number
  batchNo: number
  teamSize: number
  nextNames: string
  timestamp: number
}

function getQueueSourceLabel(from: QueueFrom | number | undefined): string {
  switch (from) {
    case QueueFrom.SC:
      return 'SC排队'
    case QueueFrom.Gift:
      return '礼物排队'
    case QueueFrom.Web:
      return '网页排队'
    case QueueFrom.Manual:
      return '主播添加'
    default:
      return '弹幕排队'
  }
}

export function normalizeQueueJoinEvent(
  item: ResponseQueueModel,
  waitingCount: number,
  teamSize: number,
): NormalizedQueueEvent {
  return {
    id: item.id,
    userName: item.user?.name || '观众',
    uid: item.user?.uid ?? 0,
    openId: item.user?.oid || '',
    content: item.content?.trim() || '',
    source: getQueueSourceLabel(item.from),
    names: item.user?.name || '观众',
    count: 1,
    waitingCount,
    batchNo: item.batchNo ?? 0,
    teamSize,
    nextNames: '',
    timestamp: Date.now(),
  }
}

export function normalizeQueueBatchEvent(
  started: ResponseQueueModel[],
  waiting: ResponseQueueModel[],
  teamSize: number,
): NormalizedQueueEvent {
  const first = started[0]
  const names = started.map((item) => item.user?.name || '观众').join('、')
  const nextNames = waiting
    .slice(0, teamSize)
    .map((item) => item.user?.name || '观众')
    .join('、')
  const batchNo = started.reduce((max, item) => Math.max(max, item.batchNo ?? 0), 0)
  return {
    id: first?.id ?? 0,
    userName: first?.user?.name || '观众',
    uid: first?.user?.uid ?? 0,
    openId: first?.user?.oid || '',
    content: started
      .map((item) => item.content?.trim())
      .filter(Boolean)
      .join(' / '),
    source: getQueueSourceLabel(first?.from),
    names,
    count: started.length,
    waitingCount: waiting.length,
    batchNo,
    teamSize,
    nextNames,
    timestamp: Date.now(),
  }
}

export function buildMockQueueEvent(overrides?: Partial<NormalizedQueueEvent>): NormalizedQueueEvent {
  return {
    id: 99999,
    userName: '测试观众A',
    uid: 10000,
    openId: 'test-open-id',
    content: '艾欧尼亚 #2333',
    source: '弹幕排队',
    names: '测试观众A、测试观众B、测试观众C、测试观众D',
    count: 4,
    waitingCount: 6,
    batchNo: 2,
    teamSize: 4,
    nextNames: '测试观众E、测试观众F',
    timestamp: Date.now(),
    ...overrides,
  }
}

export function useQueueAutoAction(
  isLive: Ref<boolean>,
  roomId: Ref<number | undefined>,
  isTianXuanActive: Ref<boolean>,
  sendDanmaku: (roomId: number, message: string) => Promise<boolean>,
  sendPrivateMessage: (userId: number, message: string) => Promise<boolean>,
) {
  function processQueueTrigger(
    triggerType: TriggerType.QUEUE_JOIN | TriggerType.QUEUE_NEXT_BATCH,
    queueEvent: NormalizedQueueEvent,
    allActions: AutoActionItem[],
    runtimeState: RuntimeState,
    isTest = false,
  ) {
    if (!roomId.value && !isTest) return

    const validActions = filterValidActions(allActions, triggerType, isLive, isTianXuanActive, {
      isTest,
    })
    if (validActions.length === 0) return

    const syntheticEvent: EventModel = {
      type: EventDataTypes.Message,
      uname: queueEvent.userName,
      uface: '',
      uid: queueEvent.uid,
      open_id: queueEvent.openId,
      ouid: queueEvent.openId || String(queueEvent.uid || ''),
      msg: queueEvent.content || queueEvent.names,
      time: Math.floor(queueEvent.timestamp / 1000),
      num: queueEvent.count,
      price: 0,
      guard_level: 0,
      fans_medal_level: 0,
      fans_medal_name: '',
      fans_medal_wearing_status: false,
    }

    executeActions(
      validActions,
      syntheticEvent,
      triggerType,
      roomId.value || 10000,
      runtimeState,
      {
        sendLiveDanmaku: sendDanmaku,
        sendPrivateMessage,
      },
      {
        isTest,
        skipUserFilters: triggerType === TriggerType.QUEUE_NEXT_BATCH || queueEvent.uid <= 0,
        customContextBuilder: (ev, rid, tt) =>
          buildExecutionContext(ev, rid, tt, {
            queue: queueEvent,
          }),
      },
    )
  }

  return {
    processQueueTrigger,
  }
}
