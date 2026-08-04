<script setup lang="ts">
import { Live24Filled } from '@vicons/fluent'
import { NIcon } from 'naive-ui'
import { computed, ref } from 'vue'

import type { UploadFileResponse } from '@/api/api-models'
import type { ScheduleConfigTypeWithConfig } from '@/shared/types/TemplateTypes'
import type { RGBAColor } from '@/shared/types/VTsuruConfigTypes'
import { defineTemplateConfig, rgbaToString } from '@/shared/types/VTsuruConfigTypes'

import { resolveScheduleCategory, SCHEDULE_CATEGORIES, type ScheduleCategoryKey } from './scheduleCategories'
import { ensureGoogleFont } from './scheduleFonts'
import { useScheduleWeek } from './scheduleTemplateUtils'
import ScheduleWeekToolbar from './ScheduleWeekToolbar.vue'
import { useScheduleTemplateAssets } from './useScheduleTemplateAssets'

import './scheduleTemplateTheme.css'

interface LivePosterConfig {
  backgroundFile: UploadFileResponse[]
  portraitFile: UploadFileResponse[]
  heading: string
  subheading: string
  accentColor: RGBAColor
  accentColor2: RGBAColor
  showAvatar: boolean
  halftone: boolean
}

const props = defineProps<ScheduleConfigTypeWithConfig<LivePosterConfig>>()

ensureGoogleFont('Anton')

const Config = defineTemplateConfig([
  {
    name: '纸张底图',
    type: 'file',
    key: 'backgroundFile',
    fileLimit: 1,
    onUploaded: (files: UploadFileResponse[], config: LivePosterConfig) => (config.backgroundFile = files),
  },
  {
    name: '主视觉立绘',
    type: 'file',
    key: 'portraitFile',
    fileLimit: 1,
    onUploaded: (files: UploadFileResponse[], config: LivePosterConfig) => (config.portraitFile = files),
  },
  { name: '海报标题', type: 'string', key: 'heading', default: 'LIVE' },
  { name: '海报副标题', type: 'string', key: 'subheading', default: 'WEEKLY TOUR' },
  {
    name: '套印主色',
    type: 'color',
    key: 'accentColor',
    default: { r: 205, g: 43, b: 45, a: 1 } as RGBAColor,
    showAlpha: false,
  },
  {
    name: '纸张强调色',
    type: 'color',
    key: 'accentColor2',
    default: { r: 246, g: 221, b: 157, a: 1 } as RGBAColor,
    showAlpha: false,
  },
  { name: '无立绘时显示头像', type: 'boolean', key: 'showAvatar', default: false },
  {
    name: '立绘单色印刷感',
    type: 'boolean',
    key: 'halftone',
    default: true,
    description: '对彩色立绘做去色套印处理, 关闭则保留原图色彩',
  },
])

const DefaultConfig: LivePosterConfig = {
  backgroundFile: [],
  portraitFile: [],
  heading: 'LIVE',
  subheading: 'WEEKLY TOUR',
  accentColor: { r: 205, g: 43, b: 45, a: 1 },
  accentColor2: { r: 246, g: 221, b: 157, a: 1 },
  showAvatar: false,
  halftone: true,
}

const posterRef = ref<HTMLElement>()
const effectiveConfig = computed(() => ({ ...DefaultConfig, ...props.config }))
const { selectedWeek, days, weekLabel, eventCount } = useScheduleWeek(() => props.data)
const { portraitUrl, backgroundUrl, backgroundImageStyle } = useScheduleTemplateAssets(props, effectiveConfig)
const streamerName = computed(() => props.userInfo?.name || 'VTUBER')
const categoryColors: Record<ScheduleCategoryKey, string> = {
  talk: '#d64b4f',
  music: '#e0a552',
  radio: '#53789a',
  game: '#8062a5',
  project: '#8f374a',
}

function resolveTagColor(tag?: string | null, color?: string | null) {
  const category = resolveScheduleCategory(tag)
  return color || (category ? categoryColors[category.key] : 'var(--poster-red)')
}

const legendItems = computed(() => {
  const items = new Map<string, { name: string; color: string }>()
  for (const day of days.value) {
    for (const item of day.items) {
      if (!item.tag) continue
      const category = resolveScheduleCategory(item.tag)
      const key = category?.key ?? item.tag.trim().toLowerCase()
      if (!items.has(key)) {
        items.set(key, {
          name: category?.name ?? item.tag.trim().toUpperCase(),
          color: resolveTagColor(item.tag, item.tagColor),
        })
      }
    }
  }
  return items.size
    ? [...items.values()]
    : SCHEDULE_CATEGORIES.map(({ key, name }) => ({ name, color: categoryColors[key] }))
})

const posterStyle = computed(() => ({
  '--poster-red': rgbaToString(effectiveConfig.value.accentColor),
  '--poster-paper': rgbaToString(effectiveConfig.value.accentColor2),
  ...backgroundImageStyle.value,
}))

defineExpose({ Config, DefaultConfig })
</script>

<template>
  <section class="schedule-template-surface live-poster-template">
    <ScheduleWeekToolbar
      v-model="selectedWeek"
      :weeks="props.data ?? []"
      :capture-target="posterRef"
      :file-name="`巡演海报_${selectedWeek || '本周'}_${streamerName}`"
    />

    <article
      ref="posterRef"
      class="live-poster"
      :class="{ 'has-background': backgroundUrl, 'has-artwork': portraitUrl }"
      :style="posterStyle"
      aria-labelledby="live-poster-title"
    >
      <div
        class="poster-registration"
        aria-hidden="true"
      />

      <header class="poster-top">
        <div class="poster-edition">
          <span>VTSURU LIVE</span><strong>NO.{{ String(eventCount).padStart(2, '0') }}</strong>
        </div>
        <div class="poster-date">{{ weekLabel }}</div>
      </header>

      <div class="poster-hero">
        <div class="poster-copy">
          <p class="poster-kicker">{{ streamerName }} PRESENTS</p>
          <h2
            id="live-poster-title"
            class="poster-hero__title"
          >
            {{ effectiveConfig.heading }}
          </h2>
          <p class="poster-hero__sub">{{ effectiveConfig.subheading }}</p>
        </div>

        <div
          class="poster-mark"
          aria-hidden="true"
        >
          <span class="poster-mark__signal">ON AIR</span>
          <span class="poster-mark__tour">ON TOUR</span>
        </div>

        <figure
          v-if="portraitUrl"
          class="poster-art"
          :class="{ 'no-halftone': !effectiveConfig.halftone }"
        >
          <img
            :src="portraitUrl"
            :alt="`${streamerName}的主视觉立绘`"
            referrerpolicy="no-referrer"
          />
        </figure>
        <div
          v-else
          class="poster-no-art"
          aria-hidden="true"
        >
          SIGNAL
        </div>
        <div
          v-if="!portraitUrl"
          class="poster-archive"
          aria-hidden="true"
        >
          <span>ARCHIVE / {{ String(eventCount).padStart(2, '0') }}</span>
          <i class="poster-archive__barcode" />
          <strong>NO PORTRAIT<br />NO PROBLEM</strong>
        </div>
      </div>

      <div class="poster-schedule">
        <div class="poster-schedule__head">
          <NIcon><Live24Filled /></NIcon>
          <span>WEEKLY RUNSHEET</span>
          <span class="poster-schedule__range">MON — SUN</span>
        </div>

        <ol class="poster-days">
          <li
            v-for="day in days"
            :key="day.english"
            class="poster-day"
            :class="{ 'is-today': day.isToday, 'is-rest': !day.items.length }"
          >
            <div class="poster-day__head">
              <strong>{{ day.english }}</strong>
              <span>{{ day.label }}</span>
              <time>{{ day.date }}</time>
            </div>
            <div
              v-if="day.items.length"
              class="poster-day__events"
            >
              <div
                v-for="(item, itemIndex) in day.items"
                :key="item.id || itemIndex"
                class="poster-event"
                :style="{ '--event-tag-color': resolveTagColor(item.tag, item.tagColor) }"
              >
                <time>{{ item.time || 'TBA' }}</time>
                <strong>{{ item.title || '未命名直播' }}</strong>
                <span v-if="item.tag">{{ item.tag }}</span>
              </div>
            </div>
            <span
              v-else
              class="poster-day__rest"
              >OFF / REST</span
            >
          </li>
        </ol>
      </div>

      <footer class="poster-foot">
        <strong>@{{ streamerName }}</strong>
        <ul class="poster-legend">
          <li
            v-for="item in legendItems"
            :key="item.name"
          >
            <i
              class="poster-legend__swatch"
              :style="{ backgroundColor: item.color }"
            />
            <span>{{ item.name }}</span>
          </li>
        </ul>
      </footer>
    </article>
  </section>
</template>

<style scoped src="./livePosterSchedule.css"></style>
