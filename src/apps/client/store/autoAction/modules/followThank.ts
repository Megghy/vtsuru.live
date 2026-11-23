import type { Ref } from 'vue'

import type { EventModel } from '@/api/client-types'

import { executeActions, filterValidActions } from '../actionUtils'
import type { AutoActionItem, RuntimeState } from '../types'
import { TriggerType } from '../types'

export function useFollowThank(
  isLive: Ref<boolean>,
  roomId: Ref<number | undefined>,
  isTianXuanActive: Ref<boolean>,
  sendLiveDanmaku: (roomId: number, message: string) => Promise<boolean>,
) {
  function processFollow(event: EventModel, actions: AutoActionItem[], runtimeState: RuntimeState, isTest = false) {
    if (!roomId.value) return

    const followActions = filterValidActions(actions, TriggerType.FOLLOW, isLive, isTianXuanActive, { isTest })
    if (followActions.length === 0) return

    executeActions(followActions, event, TriggerType.FOLLOW, roomId.value, runtimeState, { sendLiveDanmaku }, { isTest })
  }

  return { processFollow }
}
