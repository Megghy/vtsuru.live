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
  <div class="size-full flex flex-col bg-transparent p-1 box-border text-white overflow-hidden tabular-nums [text-shadow:0_2px_4px_rgba(0,0,0,0.95),0_0_8px_rgba(0,0,0,0.8),-1px_-1px_0_#000,1px_-1px_0_#000,-1px_1px_0_#000,1px_1px_0_#000]">
    <!-- 头部当前处理中提示 -->
    <div class="mb-1.5">
      <div class="flex items-center gap-1.5">
        <span
          class="size-2 rounded-full transition-all"
          :class="
            current.active
              ? 'bg-emerald-500 shadow-[0_0_8px_#22c55e]'
              : 'bg-slate-400 shadow-[0_0_6px_rgba(0,0,0,0.8)]'
          "
        />
        <span class="text-[11px] font-black text-cyan-300 tracking-wide">{{ current.active ? 'NOW' : 'IDLE' }}</span>
        <span class="text-[15px] font-extrabold text-white truncate">{{ current.active ? current.title : current.emptyText }}</span>
      </div>
      <div
        v-if="topSubtitle && current.active"
        class="text-[11px] text-yellow-300 ml-3.5 mt-0.25"
      >
        {{ topSubtitle }}
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
          class="flex flex-col gap-1"
          :class="{ animating: isMoreThanContainer }"
        >
          <TransitionGroup
            name="obs-trans-item-anim"
            tag="div"
            class="flex flex-col gap-1"
          >
            <div
              v-for="(item, index) in items"
              :key="item.id"
              class="flex items-center gap-1.5 py-0.5"
            >
              <span
                class="text-xs font-extrabold w-6 shrink-0"
                :class="index === 0 ? 'text-amber-500' : 'text-slate-400'"
              >
                #{{ index + 1 }}
              </span>
              <div class="flex-1 min-w-0 flex items-baseline gap-1.5">
                <span class="text-sm font-bold text-white truncate">{{ item.primary }}</span>
                <span
                  v-if="item.secondary"
                  class="text-[11px] text-slate-300"
                >{{ item.secondary }}</span>
              </div>
              <div
                v-if="(item.badges?.length ?? 0) > 0"
                class="flex gap-1 shrink-0"
              >
                <span
                  v-for="(badge, bIdx) in item.badges ?? []"
                  :key="`${item.id}-${bIdx}-${badge.text}`"
                  class="text-[10px] font-bold text-cyan-300"
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
        class="mt-7.5"
        :description="emptyText"
      />
    </div>
  </div>
</template>

<style scoped>
.animating {
  animation: obs-trans-scroll v-bind(animationDurationCss) linear infinite;
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
