<script setup lang="ts">
import Checkmark12Regular from '@vicons/fluent/es/Checkmark12Regular'
import { useNow } from '@vueuse/core'
import { computed } from 'vue'

import { EventDataTypes } from '@/api/generated/model'
import { Button } from '@/shared/ui/button'
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
const now = useNow({ scheduler: (cb) => useIntervalFn(cb, 30_000) })

const read = computed(() => !props.ignoreRead && dashboard.readKeys.has(props.event.key))
const isSc = computed(() => props.event.type === EventDataTypes.SC)
const mysteryBoxProfit = computed(() => {
  if (!props.event.mysteryBoxName && props.event.mysteryBoxPrice == null) return null
  return Math.round(((props.event.mysteryBoxPrice ?? 0) - props.event.price) * 100) / 100
})
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
    class="my-1 mx-1.5 rounded-md overflow-hidden text-white bg-[var(--paid-body)] select-text transition-opacity duration-150"
    :class="{ 'opacity-55': read, 'text-foreground bg-popover border border-border': !colors }"
    :style="colors ? { '--paid-header': colors.header, '--paid-body': colors.body } : undefined"
    :data-key="event.key"
    @dblclick="dashboard.toggleRead(event)"
    @contextmenu="ui.openContextMenu(event, $event)"
  >
    <div
      class="flex gap-2 py-1.5 px-2.5 items-center bg-[var(--paid-header)]"
      :class="{ 'bg-transparent': !colors }"
    >
      <img
        v-if="dashboard.settings.showAvatar && event.uface"
        class="paid__avatar size-[2.4em] rounded-full shrink-0 object-cover"
        :src="avatarUrl(event.uface, 64)"
        referrerpolicy="no-referrer"
        loading="lazy"
      />
      <div class="min-w-0 flex-1">
        <div class="flex items-center gap-1 flex-wrap">
          <EventBadges
            :event="event"
            :show-medal="dashboard.settings.showMedal"
          />
          <Button
            variant="link"
            size="xs"
            class="paid__name h-auto p-0 font-semibold text-inherit wrap-anywhere"
            data-user-trigger
            @click.stop="ui.openUserMenu(event, $event)"
          >
            {{ event.uname || '匿名用户' }}
          </Button>
        </div>
        <div class="flex items-center gap-2 flex-wrap">
          <span class="font-bold tabular-nums">{{ event.price > 0 ? formatPrice(event.price) : '免费' }}</span>
          <span
            v-if="!isSc"
            class="inline-flex items-center gap-1 opacity-90"
          >
            <img
              v-if="event.giftIcon"
              class="h-[1.4em]"
              :src="event.giftIcon"
              referrerpolicy="no-referrer"
            />
            {{ paidSummary(event) }}
          </span>
          <span
            v-if="mysteryBoxProfit !== null"
            class="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[0.78em] font-medium tabular-nums"
            :class="
              mysteryBoxProfit >= 0
                ? 'bg-emerald-500/15 text-emerald-500'
                : 'bg-rose-500/15 text-rose-500'
            "
            :title="`盲盒 ${event.mysteryBoxName || ''} 投入 ${formatPrice(event.price)} → 爆出 ${formatPrice(event.mysteryBoxPrice ?? 0)}`"
          >
            {{ event.mysteryBoxName ? `${event.mysteryBoxName} · ` : '' }}爆出{{
              formatPrice(event.mysteryBoxPrice ?? 0)
            }}
            ({{ mysteryBoxProfit >= 0 ? '+' : '-' }}{{ formatPrice(Math.abs(mysteryBoxProfit)) }})
          </span>
          <span class="ml-auto inline-flex items-center gap-1.5">
            <Button
              v-if="read"
              variant="ghost"
              size="xs"
              class="h-auto gap-0.5 px-1.5 py-0.5 rounded-full text-[0.75em] leading-none border"
              :class="
                colors
                  ? 'bg-black/25 text-white border-white/25 hover:bg-black/40 hover:text-white'
                  : 'bg-muted text-muted-foreground border-border hover:bg-muted/80'
              "
              title="已读（点击标为未读）"
              @click.stop="dashboard.toggleRead(event)"
            >
              <component
                :is="Checkmark12Regular"
                class="size-3"
              />
              已读
            </Button>
            <span class="text-[0.8em] opacity-75">{{ timeText }}</span>
          </span>
        </div>
      </div>
    </div>
    <div
      v-if="isSc"
      class="pt-1.5 px-2.5 pb-2 text-[1.05em] wrap-anywhere"
    >
      <EventMessage :msg="event.msg" />
      <div
        v-if="ui.translations.has(event.key)"
        class="mt-1 text-[0.9em] opacity-80"
      >
        {{ ui.translations.get(event.key) }}
      </div>
    </div>
  </div>
</template>
