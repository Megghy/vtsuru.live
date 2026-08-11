<script setup lang="ts">
import { Sparkle24Filled } from '@vicons/fluent'
import { NIcon } from 'naive-ui'
import { computed, ref } from 'vue'

import type { UploadFileResponse } from '@/api/api-models'
import type { ScheduleConfigTypeWithConfig } from '@/shared/types/TemplateTypes'
import type { DecorativeImageProperties, RGBAColor } from '@/shared/types/VTsuruConfigTypes'
import { defineTemplateConfig, rgbaToString } from '@/shared/types/VTsuruConfigTypes'

import { resolveScheduleCategory, type ScheduleCategoryKey } from './scheduleCategories'
import { ensureGoogleFont } from './scheduleFonts'
import { useScheduleWeek } from './scheduleTemplateUtils'
import ScheduleWeekToolbar from './ScheduleWeekToolbar.vue'
import { useScheduleTemplateAssets } from './useScheduleTemplateAssets'

import './scheduleTemplateTheme.css'

interface KawaiiConfig {
  backgroundFile: UploadFileResponse[]
  portraitFile: UploadFileResponse[]
  portraitPosition: string
  heading: string
  accentColor: RGBAColor
  sheetColor: RGBAColor
  showAvatar: boolean
  decorativeFile: DecorativeImageProperties[]
}

const props = defineProps<ScheduleConfigTypeWithConfig<KawaiiConfig>>()

ensureGoogleFont('Baloo+2:wght@600;800')

const Config = defineTemplateConfig([
  {
    name: '背景图片',
    type: 'file',
    key: 'backgroundFile',
    fileLimit: 1,
    onUploaded: (files: UploadFileResponse[], config: KawaiiConfig) => (config.backgroundFile = files),
  },
  {
    name: '角色贴纸',
    type: 'file',
    key: 'portraitFile',
    fileLimit: 1,
    onUploaded: (files: UploadFileResponse[], config: KawaiiConfig) => (config.portraitFile = files),
  },
  {
    name: '贴纸位置',
    type: 'select',
    key: 'portraitPosition',
    default: 'right',
    options: [
      { label: '右侧', value: 'right' },
      { label: '左侧', value: 'left' },
    ],
  },
  { name: '手帐标题', type: 'string', key: 'heading', default: 'WEEKLY LIVE NOTE' },
  {
    name: '主色',
    type: 'color',
    key: 'accentColor',
    default: { r: 238, g: 119, b: 158, a: 1 } as RGBAColor,
    showAlpha: false,
  },
  {
    name: '纸张底色',
    type: 'color',
    key: 'sheetColor',
    default: { r: 255, g: 249, b: 250, a: 0.9 } as RGBAColor,
    showAlpha: true,
  },
  { name: '显示主播头像', type: 'boolean', key: 'showAvatar', default: true },
  { name: '自由装饰', type: 'decorativeImages', key: 'decorativeFile' },
])

const DefaultConfig: KawaiiConfig = {
  backgroundFile: [],
  portraitFile: [],
  portraitPosition: 'right',
  heading: 'WEEKLY LIVE NOTE',
  accentColor: { r: 238, g: 119, b: 158, a: 1 },
  sheetColor: { r: 255, g: 249, b: 250, a: 0.9 },
  showAvatar: true,
  decorativeFile: [],
}

const boardRef = ref<HTMLElement>()
const effectiveConfig = computed(() => ({ ...DefaultConfig, ...props.config }))
const { selectedWeek, weekDirection, days, weekLabel, eventCount } = useScheduleWeek(() => props.data)
const { portraitUrl, backgroundUrl, backgroundImageStyle } = useScheduleTemplateAssets(props, effectiveConfig)
const activeDayCount = computed(() => days.value.filter((day) => day.items.length).length)
const categoryColors: Record<ScheduleCategoryKey, string> = {
  talk: '#b68d9d',
  music: '#c6aa70',
  radio: '#86a8a0',
  game: '#929dc0',
  project: '#ad8ba8',
}
const weeklyTags = computed(() =>
  [...new Set(days.value.flatMap((day) => day.items.map((item) => item.tag).filter(Boolean)))].slice(0, 4),
)

function resolveEventColor(tag?: string | null) {
  const category = resolveScheduleCategory(tag)
  return category ? categoryColors[category.key] : '#b29ca5'
}

const boardStyle = computed(() => ({
  '--kawaii-accent': rgbaToString(effectiveConfig.value.accentColor),
  '--kawaii-sheet': rgbaToString(effectiveConfig.value.sheetColor),
  '--week-dir': weekDirection.value || 1,
  ...backgroundImageStyle.value,
}))

defineExpose({ Config, DefaultConfig })
</script>

<template>
  <section class="schedule-template-surface kawaii-template">
    <ScheduleWeekToolbar
      v-model="selectedWeek"
      :weeks="props.data ?? []"
      :capture-target="boardRef"
      :file-name="`直播手帐_${selectedWeek || '本周'}_${props.userInfo?.name || '主播'}`"
    />

    <Transition
      name="schedule-week-swap"
      mode="out-in"
    >
      <div
        :key="selectedWeek || 'empty'"
        ref="boardRef"
        class="kawaii-board"
        :class="[
          `art-${effectiveConfig.portraitPosition}`,
          { 'has-artwork': portraitUrl, 'has-background': backgroundUrl },
        ]"
        :style="boardStyle"
      >
      <div
        class="doodle-field"
        aria-hidden="true"
      >
        <span class="doodle-heart">♡</span>
        <span class="doodle-star">✦</span>
        <span class="doodle-line" />
      </div>

      <div
        v-for="image in effectiveConfig.decorativeFile"
        :key="image.id"
        class="free-decoration"
        :style="{
          left: `${image.x}%`,
          top: `${image.y}%`,
          width: `${image.width}%`,
          transform: `translate(-50%, -50%) rotate(${image.rotation}deg)`,
          opacity: image.opacity,
          zIndex: image.zIndex,
        }"
      >
        <img
          :src="image.path"
          alt=""
        />
      </div>

      <header class="kawaii-head">
        <span
          class="washi-tape tape-head"
          aria-hidden="true"
        />
        <div class="head-mark">
          <NIcon size="13"><Sparkle24Filled /></NIcon>
          <span>MY WEEKLY SCRAPBOOK</span>
        </div>
        <h2>{{ effectiveConfig.heading }}</h2>
        <div class="week-meta">
          <span>{{ weekLabel }}</span>
          <span>{{ eventCount }} 条记录</span>
        </div>
      </header>

      <figure
        v-if="portraitUrl"
        class="character-art"
      >
        <span
          class="washi-tape tape-art"
          aria-hidden="true"
        />
        <img
          :src="portraitUrl"
          :alt="`${props.userInfo?.name || '主播'}的贴纸形象`"
          referrerpolicy="no-referrer"
        />
        <figcaption>@{{ props.userInfo?.name || 'VTUBER' }}</figcaption>
      </figure>

      <div class="scrapbook-layout schedule-day-stagger">
        <article
          v-for="(day, dayIndex) in days"
          :key="day.english"
          class="day-note"
          :class="[`note-${dayIndex + 1}`, { 'is-today': day.isToday }]"
          :style="{ '--day-index': dayIndex }"
        >
          <span
            class="washi-tape"
            aria-hidden="true"
          />
          <header class="day-head">
            <span class="day-number">{{ day.shortLabel }}</span>
            <div>
              <strong>{{ day.label }}</strong>
              <small>{{ day.english }} · {{ day.date }}</small>
            </div>
            <span
              v-if="day.isToday"
              class="today-mark"
              >今天</span
            >
          </header>

          <div
            v-if="day.items.length"
            class="event-list"
          >
            <div
              v-for="(item, itemIndex) in day.items"
              :key="item.id || itemIndex"
              class="event-row"
              :style="{ '--event-tag-color': resolveEventColor(item.tag) }"
            >
              <time>{{ item.time || '待定' }}</time>
              <div class="event-copy">
                <strong>{{ item.title || item.tag || '未命名直播' }}</strong>
                <span v-if="item.tag"># {{ item.tag }}</span>
              </div>
            </div>
          </div>
          <p
            v-else
            class="schedule-empty-copy rest-note"
          >
            留白日 · 好好休息
          </p>
        </article>

        <aside class="week-note">
          <span
            class="washi-tape"
            aria-hidden="true"
          />
          <p>WEEK NOTES</p>
          <strong>{{ eventCount }} LIVE ENTRIES</strong>
          <dl>
            <div>
              <dt>ON AIR</dt>
              <dd>{{ activeDayCount }} DAYS</dd>
            </div>
            <div>
              <dt>OFF</dt>
              <dd>{{ days.length - activeDayCount }} DAYS</dd>
            </div>
          </dl>
          <div
            v-if="weeklyTags.length"
            class="week-note__tags"
          >
            <span
              v-for="tag in weeklyTags"
              :key="tag"
              ># {{ tag }}</span
            >
          </div>
        </aside>
      </div>

      <div
        class="rubber-stamp"
        aria-hidden="true"
      >
        LIVE<br />NOTES
      </div>
      </div>
    </Transition>
  </section>
</template>

<style scoped src="./kawaiiSchedule.css"></style>
