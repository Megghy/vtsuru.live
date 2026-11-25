import type { Ref } from 'vue'

import type { EventModel, SongRequestInfo } from '@/api/client-types'
import { EventDataTypes, SongRequestFrom } from '@/api/generated/model'

import { executeActions, filterValidActions } from '../actionUtils'
import type { AutoActionItem, RuntimeState } from '../types'
import { TriggerType } from '../types'
import { buildExecutionContext } from '../utils'

export interface NormalizedSongRequestEvent {
  id: number
  name: string
  author: string
  requester: string
  requesterUid: number
  requesterOpenId: string
  source: string
  price: number
  isPriority: boolean
  keyShift: string
  queueCount: number
  timestamp: number
}

function getSourceLabel(from: SongRequestFrom | number | undefined): string {
  switch (from) {
    case SongRequestFrom.SC:
      return 'SC点歌'
    case SongRequestFrom.Gift:
      return '礼物点歌'
    case SongRequestFrom.Web:
      return '网页歌单'
    case SongRequestFrom.Manual:
      return '主播添加'
    default:
      return '弹幕点歌'
  }
}

export function normalizeSongRequestEvent(
  item: SongRequestInfo,
  queueCount = 0,
): NormalizedSongRequestEvent {
  return {
    id: item.id,
    name: item.songName || '',
    author: item.song?.author?.filter(Boolean).join(' / ') || '',
    requester: item.user?.name || '主播自选',
    requesterUid: item.user?.uid ?? 0,
    requesterOpenId: item.user?.oid || '',
    source: getSourceLabel(item.from),
    price: item.price ?? 0,
    isPriority: Boolean(item.priorityLevel && item.priorityLevel > 0),
    keyShift: item.song?.keyShift || '',
    queueCount,
    timestamp: Date.now(),
  }
}

export function buildMockSongRequestEvent(overrides?: Partial<NormalizedSongRequestEvent>): NormalizedSongRequestEvent {
  return {
    id: 99999,
    name: '测试曲目',
    author: '测试原唱',
    requester: '测试观众',
    requesterUid: 10000,
    requesterOpenId: 'test-open-id',
    source: '弹幕点歌',
    price: 0,
    isPriority: false,
    keyShift: '+2',
    queueCount: 3,
    timestamp: Date.now(),
    ...overrides,
  }
}

export function useSongRequestAutoAction(
  isLive: Ref<boolean>,
  roomId: Ref<number | undefined>,
  isTianXuanActive: Ref<boolean>,
  sendDanmaku: (roomId: number, message: string) => Promise<boolean>,
  sendPrivateMessage: (userId: number, message: string) => Promise<boolean>,
) {
  function processSongRequestTrigger(
    triggerType: TriggerType.SONG_REQUEST | TriggerType.SONG_START,
    songEvent: NormalizedSongRequestEvent,
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
      uname: songEvent.requester,
      uface: '',
      uid: songEvent.requesterUid,
      open_id: songEvent.requesterOpenId,
      ouid: songEvent.requesterOpenId || String(songEvent.requesterUid || ''),
      msg: songEvent.name,
      time: Math.floor(songEvent.timestamp / 1000),
      num: 1,
      price: songEvent.price,
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
        skipUserFilters: songEvent.requesterUid <= 0,
        customContextBuilder: (ev, rid, tt) =>
          buildExecutionContext(ev, rid, tt, {
            song: songEvent,
          }),
      },
    )
  }

  return {
    processSongRequestTrigger,
  }
}
