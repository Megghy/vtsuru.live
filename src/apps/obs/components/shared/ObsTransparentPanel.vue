<script setup lang="ts">
import { computed, toRef } from 'vue'

import { Empty } from '@/shared/ui/empty'

import type { ObsDisplayCurrent, ObsDisplayFooterTag, ObsDisplayItem } from './obsDisplay'
import { useObsListAnimation } from './useObsListAnimation'

const props = withDefaults(
  defineProps<{
    title: string
    countText: string
    current: ObsDisplayCurrent
    items: ObsDisplayItem[]
    footerTags?: ObsDisplayFooterTag[]
    speedMultiplier?: number
    emptyText: string
  }>(),
  {
    footerTags: () => [],
    speedMultiplier: 1,
  },
)

const { listContainerRef, listInnerRef, isMoreThanContainer, animationTranslateYCss, animationDurationCss } =
  useObsListAnimation(toRef(props, 'items'), toRef(props, 'speedMultiplier'))

const topSubtitle = computed(() => {
  if (props.current.active) {
    return props.current.subtitle
  }
  return props.countText
})
</script>

<template>
  <div
    class="size-full flex flex-col bg-transparent p-3 box-border text-white overflow-hidden tabular-nums [text-shadow:0_1px_3px_rgba(0,0,0,0.95),0_0_8px_rgba(0,0,0,0.75)]"
  >
    <!-- 顶部标题与计数 -->
    <div class="flex-between gap-2 pb-1.5 shrink-0">
      <div class="flex items-center gap-2 min-w-0">
        <span
          class="size-2 rounded-full shrink-0 transition-all"
          :class="
            current.active
              ? 'bg-emerald-400 shadow-[0_0_8px_#22c55e] animate-pulse'
              : 'bg-slate-300/90 shadow-[0_0_6px_rgba(0,0,0,0.8)]'
          "
        />
        <span class="text-base font-extrabold tracking-wide text-white truncate">{{ title }}</span>
      </div>
      <span
        v-if="countText"
        class="text-xs font-bold text-white/85 shrink-0"
      >
        {{ countText }}
      </span>
    </div>

    <!-- 头部当前处理中提示 -->
    <div class="pb-2 mb-1.5 border-b border-white/20 shrink-0">
      <div class="flex items-center gap-1.5 min-w-0">
        <span class="text-[11px] font-black text-cyan-300 tracking-wide shrink-0">
          {{ current.active ? 'NOW' : 'IDLE' }}
        </span>
        <span
          class="text-sm font-bold truncate"
          :class="current.active ? 'text-white' : 'text-white/80'"
        >
          {{ current.active ? current.title : current.emptyText }}
        </span>
      </div>
      <div
        v-if="topSubtitle && current.active"
        class="text-xs text-yellow-200 mt-0.5 truncate"
      >
        {{ topSubtitle }}
      </div>
      <div
        v-if="current.active && current.members && current.members.length > 1"
        class="flex flex-wrap gap-x-2.5 gap-y-0.5 mt-1 text-xs"
      >
        <span
          v-for="member in current.members"
          :key="member.id"
          class="inline-flex items-baseline gap-1 min-w-0"
        >
          <span class="font-bold text-emerald-300 truncate">{{ member.name }}</span>
          <span
            v-if="member.subtitle"
            class="text-[11px] text-white/80 truncate"
          >
            ({{ member.subtitle }})
          </span>
        </span>
      </div>
    </div>

    <!-- 列表容器 -->
    <div
      ref="listContainerRef"
      class="flex-1 relative overflow-hidden min-h-0"
    >
      <template v-if="items.length > 0">
        <div
          ref="listInnerRef"
          class="flex flex-col gap-1.5 pointer-events-none"
          :class="{ animating: isMoreThanContainer }"
        >
          <TransitionGroup
            name="obs-trans-item-anim"
            tag="div"
            class="flex flex-col gap-1.5"
          >
            <div
              v-for="(item, index) in items"
              :key="item.id"
              class="flex items-center gap-2 py-0.5"
            >
              <span
                class="text-xs font-extrabold w-6 shrink-0"
                :class="index === 0 ? 'text-amber-300' : 'text-slate-300'"
              >
                #{{ index + 1 }}
              </span>
              <div class="flex-1 min-w-0 flex items-baseline gap-1.5">
                <span class="text-[15px] font-bold text-white truncate">{{ item.primary }}</span>
                <span
                  v-if="item.secondary"
                  class="text-xs text-slate-200 truncate"
                >
                  {{ item.secondary }}
                </span>
              </div>
              <div
                v-if="(item.badges?.length ?? 0) > 0"
                class="flex gap-1.5 shrink-0"
              >
                <span
                  v-for="(badge, bIdx) in item.badges ?? []"
                  :key="`${item.id}-${bIdx}-${badge.text}`"
                  class="text-[11px] font-bold text-cyan-200"
                >
                  {{ badge.text }}
                </span>
              </div>
            </div>
          </TransitionGroup>
        </div>
      </template>
      <Empty
        v-else
        class="size-full flex-center !text-white/90 [&_svg]:!text-white/70 [&_svg]:drop-shadow-[0_2px_6px_rgba(0,0,0,0.85)]"
        :description="emptyText"
      />
    </div>

    <!-- 底部条件标签（纯文字透明风） -->
    <div
      v-if="footerTags.length > 0"
      class="mt-2 pt-1.5 border-t border-white/15 shrink-0 flex flex-wrap gap-x-3 gap-y-1 text-xs"
    >
      <div
        v-for="tag in footerTags"
        :key="tag.type"
        class="inline-flex items-baseline gap-1 min-w-0"
      >
        <span class="text-[10px] text-white/75 shrink-0">{{ tag.label }}</span>
        <span class="font-bold text-white truncate">{{ tag.value }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.animating {
  animation-name: obs-trans-scroll;
  animation-duration: v-bind(animationDurationCss);
  animation-timing-function: ease-in-out;
  animation-iteration-count: infinite;
  animation-direction: alternate;
  pointer-events: auto;
}

.animating:hover {
  animation-play-state: paused;
}

@keyframes obs-trans-scroll {
  0% {
    transform: translateY(0);
  }
  100% {
    transform: translateY(v-bind(animationTranslateYCss));
  }
}
</style>
