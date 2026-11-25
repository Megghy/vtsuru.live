<script setup lang="ts">
import { Cake, Check } from 'lucide-vue-next'
import { computed } from 'vue'

import { EventDataTypes } from '@/api/generated/model'
import { Button } from '@/shared/ui/button'
import { SimpleTooltip } from '@/shared/ui/tooltip'
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

const read = computed(() => !props.ignoreRead && dashboard.readKeys.has(props.event.key))
const fanMeta = computed(() => dashboard.fans.getInlineMeta(props.event))
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
  void dashboard.minuteNow
  return dashboard.settings.absoluteTime ? formatClock(props.event.time) : formatRelative(props.event.time)
})
</script>

<template>
  <div
    class="my-1 mx-1.5 rounded-md overflow-hidden select-text transition-opacity duration-150"
    :class="[
      colors ? 'text-white bg-[var(--paid-body)]' : 'text-foreground bg-popover border border-border',
      { 'opacity-55': read },
    ]"
    :style="colors ? { '--paid-header': colors.header, '--paid-body': colors.body } : undefined"
    :data-key="event.key"
    @dblclick="dashboard.toggleRead(event)"
    @contextmenu="ui.openContextMenu(event, $event)"
  >
    <div
      class="flex gap-2 py-1.5 px-2.5 items-center"
      :class="colors ? 'bg-[var(--paid-header)]' : 'bg-transparent'"
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
            <template v-if="fanMeta.nickname">
              <span>{{ fanMeta.nickname }}</span>
              <span
                v-if="event.uname && event.uname !== fanMeta.nickname"
                class="ml-1 font-normal opacity-75 text-[0.85em]"
                >({{ event.uname }})</span
              >
            </template>
            <template v-else>{{ event.uname || '匿名用户' }}</template>
          </Button>
          <SimpleTooltip
            v-if="fanMeta.isBirthdayToday"
            content="今天过生日"
          >
            <span class="inline-flex items-center gap-0.5 rounded px-1 py-0.2 bg-amber-500/20 text-amber-200 text-[0.75em] font-medium">
              <Cake class="size-3" />
              生日
            </span>
          </SimpleTooltip>
          <span
            v-for="tag in fanMeta.tags"
            :key="tag"
            class="rounded px-1 py-0.2 text-[0.75em]"
            :class="colors ? 'bg-black/20 text-white/90' : 'bg-muted text-muted-foreground'"
          >
            {{ tag }}
          </span>
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
          <SimpleTooltip
            v-if="mysteryBoxProfit !== null"
            :content="`盲盒 ${event.mysteryBoxName || ''} 投入 ${formatPrice(event.price)} → 爆出 ${formatPrice(event.mysteryBoxPrice ?? 0)}`"
          >
            <span
              class="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[0.78em] font-medium tabular-nums"
              :class="mysteryBoxProfit >= 0 ? 'bg-emerald-500/15 text-emerald-500' : 'bg-rose-500/15 text-rose-500'"
            >
              {{ event.mysteryBoxName ? `${event.mysteryBoxName} · ` : '' }}爆出{{
                formatPrice(event.mysteryBoxPrice ?? 0)
              }}
              ({{ mysteryBoxProfit >= 0 ? '+' : '-' }}{{ formatPrice(Math.abs(mysteryBoxProfit)) }})
            </span>
          </SimpleTooltip>
          <span class="ml-auto inline-flex items-center gap-1.5">
            <SimpleTooltip
              v-if="read"
              content="已读（点击标为未读）"
            >
              <Button
                variant="ghost"
                size="xs"
                class="h-auto gap-0.5 px-1.5 py-0.5 rounded-full text-[0.75em] leading-none border"
                :class="
                  colors
                    ? 'bg-black/25 text-white border-white/25 hover:bg-black/40 hover:text-white'
                    : 'bg-muted text-muted-foreground border-border hover:bg-muted/80'
                "
                @click.stop="dashboard.toggleRead(event)"
              >
                <Check class="size-3" />
                已读
              </Button>
            </SimpleTooltip>
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
