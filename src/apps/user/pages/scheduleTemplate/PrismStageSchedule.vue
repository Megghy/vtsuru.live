<script setup lang="ts">
import { computed, ref } from 'vue'

import type { UploadFileResponse } from '@/api/api-models'
import type { ScheduleConfigTypeWithConfig } from '@/shared/types/TemplateTypes'
import type { RGBAColor } from '@/shared/types/VTsuruConfigTypes'
import { defineTemplateConfig, rgbaToString } from '@/shared/types/VTsuruConfigTypes'

import { resolveScheduleCategory } from './scheduleCategories'
import { ensureGoogleFont } from './scheduleFonts'
import { useScheduleWeek } from './scheduleTemplateUtils'
import ScheduleWeekToolbar from './ScheduleWeekToolbar.vue'

import './scheduleTemplateTheme.css'

interface PrismStageConfig {
  backgroundFile: UploadFileResponse[]
  heading: string
  goldColor: RGBAColor
  sealColor: RGBAColor
}

const props = defineProps<ScheduleConfigTypeWithConfig<PrismStageConfig>>()

ensureGoogleFont('Marcellus')
ensureGoogleFont('Noto+Serif+SC:wght@500;600;700;900')

const Config = defineTemplateConfig([
  {
    name: '和纸背景',
    type: 'file',
    key: 'backgroundFile',
    fileLimit: 1,
    onUploaded: (files: UploadFileResponse[], config: PrismStageConfig) => (config.backgroundFile = files),
  },
  { name: '历笺标题', type: 'string', key: 'heading', default: '七曜物候' },
  {
    name: '金箔色',
    type: 'color',
    key: 'goldColor',
    default: { r: 213, g: 169, b: 76, a: 1 } as RGBAColor,
    showAlpha: false,
  },
  {
    name: '朱印色',
    type: 'color',
    key: 'sealColor',
    default: { r: 190, g: 67, b: 55, a: 1 } as RGBAColor,
    showAlpha: false,
  },
])

const DefaultConfig: PrismStageConfig = {
  backgroundFile: [],
  heading: '七曜物候',
  goldColor: { r: 213, g: 169, b: 76, a: 1 },
  sealColor: { r: 190, g: 67, b: 55, a: 1 },
}

const scheduleRef = ref<HTMLElement>()
const effectiveConfig = computed(() => ({ ...DefaultConfig, ...props.config }))
const { selectedWeek, currentWeek, days, weekLabel, eventCount } = useScheduleWeek(() => props.data)
const streamerName = computed(() => props.userInfo?.name || 'VTUBER')
const scheduleStyle = computed(() => ({
  '--prism-gold': rgbaToString(effectiveConfig.value.goldColor),
  '--prism-seal': rgbaToString(effectiveConfig.value.sealColor),
  backgroundImage: effectiveConfig.value.backgroundFile[0]?.path
    ? `url(${effectiveConfig.value.backgroundFile[0].path})`
    : undefined,
}))
const eventType = (tag?: string | null) => resolveScheduleCategory(tag)?.key ?? 'other'

defineExpose({ Config, DefaultConfig })
</script>

<template>
  <section class="schedule-template-surface prism-stage-template">
    <ScheduleWeekToolbar
      v-model="selectedWeek"
      :weeks="props.data ?? []"
      :capture-target="scheduleRef"
      :file-name="`七曜物候_${selectedWeek || '本周'}_${streamerName}`"
    />

    <div
      ref="scheduleRef"
      class="prism-stage"
      :class="{ 'has-background': effectiveConfig.backgroundFile[0]?.path }"
      :style="scheduleStyle"
    >
      <div
        class="paper-grain"
        aria-hidden="true"
      />
      <header class="stage-head">
        <div class="stage-title">
          <p class="stage-eyebrow">七曜和纸 · 物候历</p>
          <h2 class="stage-title__kanji">{{ effectiveConfig.heading }}</h2>
          <p class="stage-title__meta">{{ streamerName }} · {{ weekLabel }}</p>
        </div>
        <div class="stage-index">
          <div
            class="stage-seal"
            aria-hidden="true"
          >
            暦
          </div>
          <div class="stage-count">
            <strong>{{ String(eventCount).padStart(2, '0') }}</strong
            ><span>场 · W{{ String(currentWeek?.week || '--').padStart(2, '0') }}</span>
          </div>
        </div>
      </header>

      <div
        class="lunar-rail"
        aria-hidden="true"
      >
        <svg
          viewBox="0 0 1000 54"
          preserveAspectRatio="none"
        >
          <path d="M 0 40 Q 500 4 1000 40 Q 500 8 0 40 Z" />
        </svg>
        <span class="lunar-moon lunar-moon--new" /><span class="lunar-moon lunar-moon--half" /><span
          class="lunar-moon lunar-moon--full"
        />
      </div>

      <ol class="stage-days">
        <li
          v-for="(day, dayIndex) in days"
          :key="day.english"
          class="stage-day"
          :class="{ 'is-today': day.isToday, 'is-rest': !day.items.length }"
        >
          <div class="stage-day__marker">
            <span>{{ day.shortLabel }}</span
            ><b>{{ String(dayIndex + 1).padStart(2, '0') }}</b>
          </div>
          <div class="stage-day__identity">
            <strong>{{ day.label }}</strong
            ><time>{{ day.date }} · {{ day.english }}</time>
          </div>
          <div
            v-if="day.items.length"
            class="stage-day__events"
          >
            <article
              v-for="(item, itemIndex) in day.items"
              :key="item.id || itemIndex"
              class="stage-event"
              :data-type="eventType(item.tag)"
            >
              <time>{{ item.time || '待定' }}</time>
              <div class="stage-event__copy">
                <strong>{{ item.title || '未命名直播' }}</strong
                ><span v-if="item.tag">{{ item.tag }}</span>
              </div>
            </article>
          </div>
          <span
            v-else
            class="stage-day__rest"
            >留白 · 无排期</span
          >
          <span
            v-if="day.isToday"
            class="stage-day__live"
            >今日</span
          >
        </li>
      </ol>

      <footer class="stage-foot">
        <span>七曜 · {{ streamerName }}</span
        ><span>愿每一次相逢，都有好天气</span>
      </footer>
    </div>
  </section>
</template>

<style scoped src="./prismStageSchedule.css"></style>
