<script setup lang="ts">
import { computed } from 'vue'

import { EventDataTypes } from '@/api/api-models'

import { avatarUrl, formatClock } from '../core/format'
import type { DashboardEvent } from '../core/types'
import { userKeyOf } from '../core/types'
import { useDashboardUi } from '../store/ui'
import { useLiveDashboard } from '../store/useLiveDashboard'
import EventBadges from './EventBadges.vue'
import EventMessage from './EventMessage.vue'

const props = defineProps<{ event: DashboardEvent; compact?: boolean; ignoreRead?: boolean }>()
const dashboard = useLiveDashboard()
const ui = useDashboardUi()
const settings = computed(() => dashboard.settings)

const read = computed(() => !props.ignoreRead && dashboard.readKeys.has(props.event.key))
const hasNote = computed(() => dashboard.notes.map.has(userKeyOf(props.event)))

const INTERACTION_TEXT: Partial<Record<EventDataTypes, string>> = {
  [EventDataTypes.Enter]: '进入直播间',
  [EventDataTypes.Follow]: '关注了直播间',
  [EventDataTypes.Like]: '点赞了',
}
</script>

<template>
  <div
    class="flex gap-2 py-1 px-2.5 items-start select-text"
    :class="{ 'opacity-40': read, 'items-center py-0.5 px-2.5': compact }"
    :data-key="event.key"
    @dblclick="dashboard.toggleRead(event)"
    @contextmenu="ui.openContextMenu(event, $event)"
  >
    <img
      v-if="settings.showAvatar && event.uface"
      class="dm-avatar rounded-full shrink-0 object-cover"
      :class="compact ? 'size-[1.5em]' : 'size-[1.9em]'"
      :src="avatarUrl(event.uface)"
      referrerpolicy="no-referrer"
      loading="lazy"
    />
    <div
      v-else-if="settings.showAvatar"
      class="dm-avatar rounded-full shrink-0 bg-muted"
      :class="compact ? 'size-[1.5em]' : 'size-[1.9em]'"
    />
    <div class="min-w-0 flex-1">
      <div class="flex items-center gap-1 flex-wrap leading-[1.9em]">
        <EventBadges
          :event="event"
          :show-medal="settings.showMedal"
        />
        <button
          class="dm-name appearance-none bg-transparent border-0 p-0 font-semibold cursor-pointer wrap-anywhere hover:underline"
          data-user-trigger
          :class="{ 'text-[var(--brand)]': hasNote }"
          type="button"
          @click.stop="ui.openUserMenu(event, $event)"
        >
          {{ event.uname || '匿名用户' }}
        </button>
        <span
          v-if="compact"
          class="text-muted-foreground"
          >{{ INTERACTION_TEXT[event.type] }}</span
        >
        <span
          v-if="settings.absoluteTime"
          class="ml-auto text-[0.8em] text-muted-foreground tabular-nums"
          >{{ formatClock(event.time) }}</span
        >
      </div>
      <div
        v-if="!compact"
        class="inline-block mt-0.5 py-1 px-3 rounded-[4px_14px_14px_14px] bg-popover border border-border font-medium wrap-anywhere max-w-full box-border"
      >
        <EventMessage
          :msg="event.msg"
          :emoji="event.emoji"
        />
        <div
          v-if="ui.translations.has(event.key)"
          class="mt-0.5 pt-0.5 border-t border-dashed border-border text-[0.9em] font-normal text-muted-foreground"
        >
          {{ ui.translations.get(event.key) }}
        </div>
      </div>
    </div>
  </div>
</template>

