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
    class="dm-row"
    :class="{ 'dm-row--read': read, 'dm-row--compact': compact }"
    :data-key="event.key"
    @dblclick="dashboard.toggleRead(event)"
    @contextmenu="ui.openContextMenu(event, $event)"
  >
    <img
      v-if="settings.showAvatar && event.uface"
      class="dm-avatar"
      :src="avatarUrl(event.uface)"
      referrerpolicy="no-referrer"
      loading="lazy"
    >
    <div
      v-else-if="settings.showAvatar"
      class="dm-avatar dm-avatar--empty"
    />
    <div class="dm-main">
      <div class="dm-head">
        <EventBadges
          :event="event"
          :show-medal="settings.showMedal"
        />
        <button
          class="dm-name"
          data-user-trigger
          :class="{ 'dm-name--note': hasNote }"
          type="button"
          @click.stop="ui.openUserMenu(event, $event)"
        >
          {{ event.uname || '匿名用户' }}
        </button>
        <span
          v-if="compact"
          class="dm-action"
        >{{ INTERACTION_TEXT[event.type] }}</span>
        <span
          v-if="settings.absoluteTime"
          class="dm-time"
        >{{ formatClock(event.time) }}</span>
      </div>
      <div
        v-if="!compact"
        class="dm-bubble"
      >
        <EventMessage
          :msg="event.msg"
          :emoji="event.emoji"
        />
        <div
          v-if="ui.translations.has(event.key)"
          class="dm-translation"
        >
          {{ ui.translations.get(event.key) }}
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.dm-row {
  display: flex;
  gap: 8px;
  padding: 4px 10px;
  align-items: flex-start;
  user-select: text;
}

.dm-row--compact {
  align-items: center;
  padding: 2px 10px;
}

.dm-row--read {
  opacity: 0.4;
}

.dm-avatar {
  width: 1.9em;
  height: 1.9em;
  border-radius: 50%;
  flex-shrink: 0;
  object-fit: cover;
}

.dm-row--compact .dm-avatar {
  width: 1.5em;
  height: 1.5em;
}

.dm-avatar--empty {
  background: var(--vtsuru-bg-muted);
}

.dm-main {
  min-width: 0;
  flex: 1;
}

.dm-head {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
  line-height: 1.9em;
}

.dm-name {
  all: unset;
  font-weight: 600;
  cursor: pointer;
  overflow-wrap: anywhere;
}

.dm-name:hover {
  text-decoration: underline;
}

.dm-name--note {
  color: var(--vtsuru-brand);
}

.dm-action {
  color: var(--vtsuru-fg-muted);
}

.dm-time {
  margin-left: auto;
  font-size: 0.8em;
  color: var(--vtsuru-fg-muted);
  font-variant-numeric: tabular-nums;
}

.dm-bubble {
  display: inline-block;
  margin-top: 2px;
  padding: 4px 12px;
  border-radius: 4px 14px 14px 14px;
  background: var(--vtsuru-bg-elevated);
  border: 1px solid var(--vtsuru-border);
  font-weight: 500;
  overflow-wrap: anywhere;
  max-width: 100%;
  box-sizing: border-box;
}

.dm-translation {
  margin-top: 2px;
  padding-top: 2px;
  border-top: 1px dashed var(--vtsuru-border);
  font-size: 0.9em;
  font-weight: 400;
  color: var(--vtsuru-fg-muted);
}
</style>
