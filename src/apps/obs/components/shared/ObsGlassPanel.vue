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
  <div class="size-full flex flex-col bg-slate-900/85 backdrop-blur-[20px] border border-white/15 rounded-2xl p-3.5 shadow-2xl text-white overflow-hidden tabular-nums box-border">
    <!-- 顶栏状态与标题 -->
    <div class="flex flex-col gap-2 mb-2.5">
      <div class="flex items-center gap-2">
        <span
          class="size-2 rounded-full transition-all"
          :class="
            current.active
              ? 'bg-emerald-500 shadow-[0_0_10px_#22c55e] animate-pulse'
              : 'bg-slate-400'
          "
        />
        <span class="text-[15px] font-extrabold text-slate-50 tracking-wide">{{ title }}</span>
        <span
          v-if="countText"
          class="text-[11px] px-1.5 py-0.5 rounded-[10px] bg-blue-500/20 text-blue-400 border border-blue-500/30 ml-auto"
        >{{ countText }}</span>
      </div>

      <!-- 当前进行中内容 -->
      <div
        class="p-2.5 rounded-[10px] border transition-all"
        :class="
          current.active
            ? 'bg-gradient-to-br from-emerald-500/15 to-blue-500/15 border-emerald-500/30'
            : 'bg-white/5 border-white/8'
        "
      >
        <div class="text-[10px] font-bold text-slate-400 uppercase">
          {{ current.active ? '当前处理' : '当前空闲' }}
        </div>
        <div class="text-sm font-bold text-slate-50 mt-0.5">
          {{ current.active ? current.title : current.emptyText }}
        </div>
        <div
          v-if="topSubtitle && current.active"
          class="text-[11px] text-slate-300 mt-0.5"
        >
          {{ topSubtitle }}
        </div>
      </div>
    </div>

    <!-- 滚动列表容器 -->
    <div
      ref="listContainerRef"
      class="flex-1 relative overflow-hidden min-h-0"
    >
      <template v-if="items.length > 0">
        <div
          ref="listInnerRef"
          class="flex flex-col gap-1.5"
          :class="{ animating: isMoreThanContainer }"
        >
          <TransitionGroup
            name="obs-glass-item-anim"
            tag="div"
            class="flex flex-col gap-1.5"
          >
            <div
              v-for="(item, index) in items"
              :key="item.id"
              class="flex items-center gap-2.5 px-2.5 py-2 rounded-lg bg-white/4 border border-white/6 transition-all duration-200"
            >
              <div
                class="size-5.5 rounded-md flex items-center justify-center text-[11px] font-extrabold shrink-0 transition-colors"
                :class="
                  index === 0
                    ? 'bg-amber-500 text-black shadow-[0_0_8px_rgba(245,158,11,0.5)]'
                    : index === 1
                      ? 'bg-slate-400 text-black'
                      : index === 2
                        ? 'bg-amber-700 text-white'
                        : 'bg-white/10 text-slate-300'
                "
              >
                {{ index + 1 }}
              </div>
              <div class="flex-1 min-w-0">
                <div
                  class="text-[13px] font-semibold text-slate-100 truncate drop-shadow-md"
                  :title="item.primary"
                >
                  {{ item.primary }}
                </div>
                <div
                  v-if="item.secondary"
                  class="text-[11px] text-slate-400 mt-px"
                >
                  {{ item.secondary }}
                </div>
                <div
                  v-if="(item.badges?.length ?? 0) > 0"
                  class="flex gap-1 mt-0.75"
                >
                  <span
                    v-for="(badge, bIdx) in item.badges ?? []"
                    :key="`${item.id}-${bIdx}-${badge.text}`"
                    class="text-[10px] px-1.25 py-px rounded bg-white/10 text-slate-300 data-[tone=highlight]:bg-amber-500/20 data-[tone=highlight]:text-amber-400 data-[tone=success]:bg-emerald-500/20 data-[tone=success]:text-emerald-400"
                    :data-tone="badge.tone ?? 'muted'"
                  >
                    {{ badge.text }}
                  </span>
                </div>
              </div>
            </div>
          </TransitionGroup>
        </div>
      </template>
      <Empty
        v-else
        class="mt-10"
        :description="emptyText"
      />
    </div>

    <!-- 底部标签 -->
    <div
      v-if="footerTags.length > 0"
      class="flex gap-2 mt-2 pt-2 border-t border-white/8"
    >
      <div
        v-for="tag in footerTags"
        :key="tag.type"
        class="text-[11px] flex gap-1"
      >
        <span class="text-slate-500">{{ tag.label }}</span>
        <span class="text-slate-300 font-semibold">{{ tag.value }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.animating {
  animation: obs-glass-scroll v-bind(animationDurationCss) linear infinite;
}

@keyframes obs-glass-scroll {
  0% {
    transform: translateY(0);
  }
  100% {
    transform: translateY(v-bind(animationTranslateYCss));
  }
}
</style>
