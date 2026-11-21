<script setup lang="ts">
import { ArrowUpRight } from 'lucide-vue-next'
import { computed, nextTick, ref, useTemplateRef, watch } from 'vue'
import { useRouter } from 'vue-router'

import { ToggleGroup, ToggleGroupItem } from '@/shared/ui/toggle-group'

import {
  FEATURE_CATEGORY_TABS,
  FEATURE_GROUPS,
  INDEX_FEATURES,
  type FeatureCategory,
  type FeatureGroupMeta,
  type IndexFeatureItem,
} from './indexData'
import { clamp, easeOutCubic, lerp, useElementScrollProgress, useMultiElementScrollProgress } from './useIndexMotion'

const props = defineProps<{
  isDesktop: boolean
  isReduced: boolean
}>()

const router = useRouter()
const headerEl = useTemplateRef<HTMLElement>('headerEl')
const headerScroll = useElementScrollProgress(headerEl, {
  enterStartRatio: 0.96,
  enterEndRatio: 0.56,
})

const {
  setEl: setGroupEl,
  states: groupStates,
  measureAll,
} = useMultiElementScrollProgress(FEATURE_GROUPS.length, {
  enterStartRatio: 0.98,
  enterEndRatio: 0.44,
})

const groupIndexMap: Record<Exclude<FeatureCategory, 'all'>, number> = {
  live: 0,
  page: 1,
  data: 2,
  efficiency: 3,
}

const activeCategory = ref<FeatureCategory>('all')

const visibleGroups = computed(() => {
  const groups =
    activeCategory.value === 'all'
      ? FEATURE_GROUPS
      : FEATURE_GROUPS.filter((g) => g.key === activeCategory.value)

  return groups.map((group) => ({
    ...group,
    slotIndex: groupIndexMap[group.key],
    items: INDEX_FEATURES.filter((item) => item.category === group.key),
  }))
})

// 切换分类后立刻重新采样新排布元素的视口进度
watch(activeCategory, async () => {
  await nextTick()
  measureAll()
})

const headerStyle = computed(() => {
  if (props.isReduced) return undefined
  const t = headerScroll.easedEnter
  return {
    transform: `translate3d(0, ${lerp(22, 0, t).toFixed(1)}px, 0)`,
    opacity: lerp(0.15, 1, t).toFixed(3),
  }
})

/** 分组标题分割线随滚入由左向右展开 */
function dividerStyle(slotIndex: number) {
  if (props.isReduced) return undefined
  const st = groupStates.value[slotIndex]
  const t = easeOutCubic(clamp(st.enter * 1.25, 0, 1))
  return {
    transform: `scaleX(${t.toFixed(3)})`,
  }
}

/** 3 列按列序号轻微波浪落位，到达视口中段时完全齐平无高低差 */
function cardWaveStyle(slotIndex: number, cardIdx: number) {
  if (props.isReduced) return undefined
  const st = groupStates.value[slotIndex]
  const col = props.isDesktop ? cardIdx % 3 : 0
  const row = Math.floor(cardIdx / (props.isDesktop ? 3 : 2))
  const delay = col * 0.08 + Math.min(row, 2) * 0.06
  const localT = easeOutCubic(clamp((st.enter - delay) / Math.max(0.35, 1 - delay), 0, 1))
  const y = lerp(30, 0, localT)
  const scale = lerp(0.96, 1, localT)
  return {
    transform: `translate3d(0, ${y.toFixed(1)}px, 0) scale(${scale.toFixed(3)})`,
    opacity: lerp(0.22, 1, localT).toFixed(3),
  }
}

function handleCardPointerMove(event: PointerEvent) {
  if (event.pointerType !== 'mouse') return
  const target = event.currentTarget as HTMLElement | null
  if (!target) return
  const rect = target.getBoundingClientRect()
  target.style.setProperty('--mx', `${event.clientX - rect.left}px`)
  target.style.setProperty('--my', `${event.clientY - rect.top}px`)
}

function openFeature(item: IndexFeatureItem) {
  void router.push({ name: item.route })
}

const groupDotMap: Record<FeatureGroupMeta['accent'], string> = {
  brand: 'bg-brand',
  sakura: 'bg-pink-500',
  amber: 'bg-amber-500',
  emerald: 'bg-emerald-500',
}

const accentIconMap: Record<IndexFeatureItem['accent'], string> = {
  brand: 'text-brand bg-brand/12 ring-brand/20',
  sakura: 'text-pink-500 bg-pink-500/12 ring-pink-500/20',
  amber: 'text-amber-600 dark:text-amber-400 bg-amber-500/12 ring-amber-500/20',
  emerald: 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/12 ring-emerald-500/20',
}

const accentTagMap: Record<IndexFeatureItem['accent'], string> = {
  brand: 'bg-brand/12 text-brand',
  sakura: 'bg-pink-500/12 text-pink-600 dark:text-pink-400',
  amber: 'bg-amber-500/12 text-amber-700 dark:text-amber-300',
  emerald: 'bg-emerald-500/12 text-emerald-600 dark:text-emerald-400',
}
</script>

<template>
  <section
    id="features"
    class="py-16 sm:py-24"
  >
    <div class="mx-auto w-full max-w-[1320px] px-4 sm:px-6 lg:px-8">
      <div
        ref="headerEl"
        class="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between will-change-transform"
        :style="headerStyle"
      >
        <div class="max-w-2xl min-w-0">
          <h2 class="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            全站功能矩阵
          </h2>
          <p class="mt-2 text-sm text-muted-foreground sm:text-base">
            按直播全流程清晰归类，覆盖开播前筹备、直播中控场与下播后数据复盘，点击卡片直达对应工作台。
          </p>
        </div>

        <ToggleGroup
          type="single"
          :model-value="activeCategory"
          class="shrink-0 max-w-full flex-wrap sm:flex-nowrap overflow-x-auto no-scrollbar self-start xl:self-auto"
          @update:model-value="
            (val) => {
              if (val) activeCategory = val as FeatureCategory
            }
          "
        >
          <ToggleGroupItem
            v-for="tab in FEATURE_CATEGORY_TABS"
            :key="tab.value"
            :value="tab.value"
            class="whitespace-nowrap px-3"
          >
            {{ tab.label }}
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      <!-- 分场景规整 3 列等宽矩阵（随滚动齐步波浪归位，入屏完全齐平） -->
      <div class="mt-10 space-y-10">
        <div
          v-for="group in visibleGroups"
          :key="group.key"
          :ref="(el) => setGroupEl(group.slotIndex, el)"
        >
          <div class="relative mb-4 flex flex-wrap items-baseline justify-between gap-2 pb-2.5">
            <div class="flex items-center gap-2.5">
              <span
                class="size-2 rounded-full shrink-0"
                :class="groupDotMap[group.accent]"
              />
              <h3 class="text-sm font-bold text-foreground sm:text-base">
                {{ group.title }}
              </h3>
              <span class="rounded-full bg-muted/80 px-2 py-0.5 text-[11px] font-medium text-muted-foreground tabular-nums">
                {{ group.items.length }} 项
              </span>
            </div>
            <p class="text-xs text-muted-foreground">
              {{ group.subtitle }}
            </p>
            <!-- 随滚动展开的底部分割线 -->
            <span
              class="pointer-events-none absolute inset-x-0 bottom-0 h-px origin-left bg-border/80 will-change-transform"
              :style="dividerStyle(group.slotIndex)"
              aria-hidden="true"
            />
          </div>

          <div class="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
            <div
              v-for="(item, cardIdx) in group.items"
              :key="item.id"
              class="will-change-transform"
              :style="cardWaveStyle(group.slotIndex, cardIdx)"
            >
              <button
                type="button"
                class="bento-card group relative flex h-full w-full flex-col overflow-hidden rounded-xl border border-border/80 bg-card/80 p-4 sm:p-5 text-left backdrop-blur-md transition-all duration-200 hover:-translate-y-0.5 hover:border-brand/50 hover:bg-card/95 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                :class="{ 'bento-card--static': isReduced }"
                @pointermove="handleCardPointerMove"
                @click="openFeature(item)"
              >
                <!-- 指针微光层 -->
                <span
                  class="bento-spotlight pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
                  aria-hidden="true"
                />

                <div class="relative z-10 flex items-start justify-between gap-3">
                  <div class="flex items-center gap-3 min-w-0">
                    <span
                      class="flex size-9 shrink-0 items-center justify-center rounded-lg ring-1 transition-transform duration-200 group-hover:scale-105"
                      :class="accentIconMap[item.accent]"
                    >
                      <component
                        :is="item.icon"
                        class="size-4.5"
                      />
                    </span>

                    <div class="flex min-w-0 items-center gap-2">
                      <h4 class="truncate text-sm font-bold text-foreground">{{ item.name }}</h4>
                      <span
                        v-if="item.tag"
                        class="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold"
                        :class="accentTagMap[item.accent]"
                      >
                        {{ item.tag }}
                      </span>
                    </div>
                  </div>

                  <ArrowUpRight class="size-4 shrink-0 text-muted-foreground/60 transition-all duration-150 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-brand" />
                </div>

                <p class="relative z-10 mt-3 text-xs leading-relaxed text-muted-foreground sm:text-[13px]">
                  {{ item.desc }}
                </p>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.bento-spotlight {
  background: radial-gradient(
    260px circle at var(--mx, 50%) var(--my, 50%),
    rgba(35, 173, 229, 0.12),
    transparent 65%
  );
}

:global(.dark) .bento-spotlight {
  background: radial-gradient(
    260px circle at var(--mx, 50%) var(--my, 50%),
    rgba(95, 195, 227, 0.16),
    transparent 65%
  );
}

.bento-card--static .bento-spotlight {
  display: none;
}
</style>
