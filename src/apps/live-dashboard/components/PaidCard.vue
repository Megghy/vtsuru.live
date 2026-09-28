<script setup lang="ts">
import { useNow } from '@vueuse/core'
import { computed } from 'vue'

import { EventDataTypes } from '@/api/api-models'
import { getGuardColor } from '@/shared/utils/queue'

import { avatarUrl, formatClock, formatPrice, formatRelative, paidSummary, superChatTier } from '../core/format'
import type { DashboardEvent } from '../core/types'
import { useDashboardUi } from '../store/ui'
import { useLiveDashboard } from '../store/useLiveDashboard'
import EventBadges from './EventBadges.vue'
import EventMessage from './EventMessage.vue'

const props = defineProps<{ event: DashboardEvent; ignoreRead?: boolean }>()
const dashboard = useLiveDashboard()
const ui = useDashboardUi()
const now = useNow({ interval: 30_000 })

const read = computed(() => !props.ignoreRead && dashboard.readKeys.has(props.event.key))
const isSc = computed(() => props.event.type === EventDataTypes.SC)
const colors = computed(() => {
  if (isSc.value) return superChatTier(props.event.price)
  if (props.event.type === EventDataTypes.Guard) {
    const c = getGuardColor(props.event.guardLevel)
    return { header: c, body: c }
  }
  return undefined
})
const timeText = computed(() => {
  void now.value
  return dashboard.settings.absoluteTime ? formatClock(props.event.time) : formatRelative(props.event.time)
})
</script>

<template>
  <div
    class="paid"
    :class="{ 'paid--read': read, 'paid--plain': !colors }"
    :style="colors ? { '--paid-header': colors.header, '--paid-body': colors.body } : undefined"
    :data-key="event.key"
    @dblclick="dashboard.toggleRead(event)"
    @contextmenu="ui.openContextMenu(event, $event)"
  >
    <div class="paid__head">
      <img
        v-if="dashboard.settings.showAvatar && event.uface"
        class="paid__avatar"
        :src="avatarUrl(event.uface, 64)"
        referrerpolicy="no-referrer"
        loading="lazy"
      >
      <div class="paid__who">
        <div class="paid__line">
          <EventBadges
            :event="event"
            :show-medal="dashboard.settings.showMedal"
          />
          <button
            class="paid__name"
            data-user-trigger
            type="button"
            @click.stop="ui.openUserMenu(event, $event)"
          >
            {{ event.uname || '匿名用户' }}
          </button>
        </div>
        <div class="paid__line paid__meta">
          <span class="paid__price">{{ event.price > 0 ? formatPrice(event.price) : '免费' }}</span>
          <span
            v-if="!isSc"
            class="paid__summary"
          >
            <img
              v-if="event.giftIcon"
              class="paid__gift-icon"
              :src="event.giftIcon"
              referrerpolicy="no-referrer"
            >
            {{ paidSummary(event) }}
          </span>
          <span class="paid__time">{{ timeText }}</span>
        </div>
      </div>
    </div>
    <div
      v-if="isSc"
      class="paid__body"
    >
      <EventMessage :msg="event.msg" />
      <div
        v-if="ui.translations.has(event.key)"
        class="paid__translation"
      >
        {{ ui.translations.get(event.key) }}
      </div>
    </div>
  </div>
</template>

<style scoped>
.paid {
  margin: 4px 6px;
  border-radius: 6px;
  overflow: hidden;
  color: #fff;
  background: var(--paid-body);
  user-select: text;
}

.paid--plain {
  color: var(--vtsuru-fg);
  background: var(--vtsuru-bg-elevated);
  border: 1px solid var(--vtsuru-border);
}

.paid--read {
  opacity: 0.4;
}

.paid__head {
  display: flex;
  gap: 8px;
  padding: 6px 10px;
  align-items: center;
  background: var(--paid-header);
}

.paid--plain .paid__head {
  background: transparent;
}

.paid__avatar {
  width: 2.4em;
  height: 2.4em;
  border-radius: 50%;
  flex-shrink: 0;
  object-fit: cover;
}

.paid__who {
  min-width: 0;
  flex: 1;
}

.paid__line {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
}

.paid__name {
  all: unset;
  font-weight: 600;
  cursor: pointer;
  overflow-wrap: anywhere;
}

.paid__name:hover {
  text-decoration: underline;
}

.paid__meta {
  gap: 8px;
}

.paid__price {
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.paid__summary {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  opacity: 0.9;
}

.paid__gift-icon {
  height: 1.4em;
}

.paid__time {
  margin-left: auto;
  font-size: 0.8em;
  opacity: 0.75;
}

.paid__body {
  padding: 6px 10px 8px;
  font-size: 1.05em;
  overflow-wrap: anywhere;
}

.paid__translation {
  margin-top: 4px;
  font-size: 0.9em;
  opacity: 0.8;
}
</style>
