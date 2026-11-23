import type { Ref } from 'vue'

import type { EventModel } from '@/api/client-types'

import { executeActions, filterValidActions } from '../actionUtils'
import type { AutoActionItem, RuntimeState } from '../types'
import { TriggerType } from '../types'

export function matchesEnterTrigger(action: AutoActionItem, event: EventModel): boolean {
  const { filterMode, filterGiftNames, enterMedalMinLevel } = action.triggerConfig
  switch (filterMode) {
    case 'blacklist':
      return !filterGiftNames?.includes(event.uname)
    case 'whitelist':
      return !!filterGiftNames?.includes(event.uname)
    case 'guard':
      return (event.guard_level || 0) > 0
    case 'medal':
      return event.fans_medal_wearing_status && (event.fans_medal_level || 0) >= (enterMedalMinLevel || 0)
    default:
      return true
  }
}

export function useEntryWelcome(
  isLive: Ref<boolean>,
  roomId: Ref<number | undefined>,
  isTianXuanActive: Ref<boolean>,
  sendLiveDanmaku: (roomId: number, message: string) => Promise<boolean>,
) {
  function processEnter(event: EventModel, actions: AutoActionItem[], runtimeState: RuntimeState, isTest = false) {
    if (!roomId.value) return

    const enterActions = filterValidActions(actions, TriggerType.ENTER, isLive, isTianXuanActive, { isTest })
    if (enterActions.length === 0) return

    executeActions(
      enterActions,
      event,
      TriggerType.ENTER,
      roomId.value,
      runtimeState,
      { sendLiveDanmaku },
      {
        isTest,
        customFilters: [(action) => matchesEnterTrigger(action, event)],
      },
    )
  }

  return { processEnter }
}
