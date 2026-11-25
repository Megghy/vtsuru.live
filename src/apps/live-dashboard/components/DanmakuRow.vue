<script setup lang="ts">
import { Cake, History, Star } from 'lucide-vue-next'
import { computed } from 'vue'

import { EventDataTypes } from '@/api/generated/model'
import { useFanPrivacy } from '@/shared/composables/useFanPrivacy'
import { Button } from '@/shared/ui/button'
import { SimpleTooltip } from '@/shared/ui/tooltip'

import { avatarUrl, formatClock } from '../core/format'
import { userKeyOf } from '../core/types'
import { useDashboardUi } from '../store/ui'
import type { DanmakuDisplayEvent } from '../store/useLiveDashboard'
import { useLiveDashboard } from '../store/useLiveDashboard'
import EventBadges from './EventBadges.vue'
import EventMessage from './EventMessage.vue'

const props = defineProps<{ event: DanmakuDisplayEvent; compact?: boolean; ignoreRead?: boolean }>()
const dashboard = useLiveDashboard()
const ui = useDashboardUi()
const { privacyMode } = useFanPrivacy()
const settings = computed(() => dashboard.settings)

const read = computed(() => !props.ignoreRead && dashboard.readKeys.has(props.event.key))
const fanMeta = computed(() => dashboard.fans.getInlineMeta(props.event))
const hasNote = computed(() => fanMeta.value.hasProfile || dashboard.notes.map.has(userKeyOf(props.event)))

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
        <SimpleTooltip
          v-if="fanMeta.isStarred"
          content="重点粉丝"
        >
          <Star class="size-3 fill-amber-400 text-amber-500 shrink-0" />
        </SimpleTooltip>
        <SimpleTooltip :content="fanMeta.pronunciation ? `读音：${fanMeta.pronunciation}` : undefined">
          <Button
            variant="link"
            size="xs"
            class="dm-name h-auto p-0 font-semibold text-inherit"
            :class="{ '!text-[var(--brand)]': hasNote }"
            data-user-trigger
            @click.stop="ui.openUserMenu(event, $event)"
          >
            <template v-if="fanMeta.nickname">
              <span>{{ fanMeta.nickname }}</span>
              <span
                v-if="event.uname && event.uname !== fanMeta.nickname"
                class="ml-1 font-normal opacity-65 text-[0.85em]"
                >({{ event.uname }})</span
              >
            </template>
            <template v-else>{{ event.uname || '匿名用户' }}</template>
          </Button>
        </SimpleTooltip>
        <SimpleTooltip
          v-if="fanMeta.isBirthdayToday && !privacyMode"
          content="今天过生日"
        >
          <span class="inline-flex items-center gap-0.5 rounded px-1 py-0.2 bg-amber-500/15 text-amber-600 dark:text-amber-400 text-[0.75em] font-medium">
            <Cake class="size-3" />
            生日
          </span>
        </SimpleTooltip>
        <SimpleTooltip
          v-if="fanMeta.dormantDays !== null"
          :content="`老粉久别重逢，距上次出现已 ${fanMeta.dormantDays} 天`"
        >
          <span class="inline-flex items-center gap-0.5 rounded px-1 py-0.2 bg-brand-soft text-brand text-[0.75em] font-medium tabular-nums">
            <History class="size-3" />
            {{ fanMeta.dormantDays }}天未见
          </span>
        </SimpleTooltip>
        <SimpleTooltip
          v-if="fanMeta.renamedFrom"
          :content="`此前昵称：${fanMeta.renamedFrom}`"
        >
          <span class="rounded px-1 py-0.2 bg-muted text-muted-foreground text-[0.75em]">
            曾:{{ fanMeta.renamedFrom }}
          </span>
        </SimpleTooltip>
        <span
          v-for="tag in fanMeta.tags"
          :key="tag"
          class="rounded px-1 py-0.2 bg-muted text-muted-foreground text-[0.75em] leading-tight"
        >
          {{ tag }}
        </span>
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
        <SimpleTooltip
          v-if="(event.repeatCount ?? 1) > 1"
          content="连续重复次数"
        >
          <span class="ml-1.5 inline-flex items-center px-1.5 py-0.2 rounded-full bg-muted text-[11px] font-semibold text-muted-foreground tabular-nums">
            ×{{ event.repeatCount }}
          </span>
        </SimpleTooltip>
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
