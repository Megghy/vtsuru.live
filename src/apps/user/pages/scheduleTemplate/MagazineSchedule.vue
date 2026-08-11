<script setup lang="ts">
import { computed, ref } from 'vue'

import type { UploadFileResponse } from '@/api/api-models'
import type { ScheduleConfigTypeWithConfig } from '@/shared/types/TemplateTypes'
import type { RGBAColor } from '@/shared/types/VTsuruConfigTypes'
import { defineTemplateConfig, rgbaToString } from '@/shared/types/VTsuruConfigTypes'

import { resolveScheduleCategory, type ScheduleCategoryKey } from './scheduleCategories'
import { ensureGoogleFont } from './scheduleFonts'
import { useScheduleWeek } from './scheduleTemplateUtils'
import ScheduleWeekToolbar from './ScheduleWeekToolbar.vue'
import { useScheduleTemplateAssets } from './useScheduleTemplateAssets'

import './scheduleTemplateTheme.css'

interface MagazineConfig {
  backgroundFile: UploadFileResponse[]
  portraitFile: UploadFileResponse[]
  heading: string
  accentColor: RGBAColor
  showAvatar: boolean
}

const props = defineProps<ScheduleConfigTypeWithConfig<MagazineConfig>>()

ensureGoogleFont('Noto+Serif+SC:wght@600;700;900')

const Config = defineTemplateConfig([
  {
    name: '背景图片',
    type: 'file',
    key: 'backgroundFile',
    fileLimit: 1,
    onUploaded: (files: UploadFileResponse[], config: MagazineConfig) => (config.backgroundFile = files),
  },
  {
    name: '封面照片',
    type: 'file',
    key: 'portraitFile',
    fileLimit: 1,
    onUploaded: (files: UploadFileResponse[], config: MagazineConfig) => (config.portraitFile = files),
  },
  { name: '刊头标题', type: 'string', key: 'heading', default: '本周放送特刊' },
  {
    name: '印刷强调色',
    type: 'color',
    key: 'accentColor',
    default: { r: 177, g: 47, b: 38, a: 1 } as RGBAColor,
    showAlpha: false,
  },
  { name: '未上传照片时使用头像', type: 'boolean', key: 'showAvatar', default: false },
])

const DefaultConfig: MagazineConfig = {
  backgroundFile: [],
  portraitFile: [],
  heading: '本周放送特刊',
  accentColor: { r: 177, g: 47, b: 38, a: 1 },
  showAvatar: false,
}

const posterRef = ref<HTMLElement>()
const effectiveConfig = computed(() => ({ ...DefaultConfig, ...props.config }))
const { selectedWeek, weekDirection, currentWeek, days, weekLabel, eventCount } = useScheduleWeek(() => props.data)
const { portraitUrl, backgroundUrl, backgroundImageStyle } = useScheduleTemplateAssets(props, effectiveConfig)

const streamerName = computed(() => props.userInfo?.name || 'VTUBER')
const issueNumber = computed(() => String(currentWeek.value?.week ?? 0).padStart(2, '0'))
const issueYear = computed(() => currentWeek.value?.year ?? new Date().getFullYear())
const leadDays = computed(() => days.value.slice(0, 3))
const remainingDays = computed(() => days.value.slice(3))
const categoryColors: Record<ScheduleCategoryKey, string> = {
  talk: '#627981',
  music: '#ad8237',
  radio: '#6e7d62',
  game: '#984d43',
  project: '#765866',
}

function resolveEventColor(tag?: string | null) {
  const category = resolveScheduleCategory(tag)
  return category ? categoryColors[category.key] : '#746d62'
}

const categoryLegend = computed(() => {
  const categories = new Map<string, { name: string; color: string }>()
  for (const day of days.value) {
    for (const item of day.items) {
      if (!item.tag) continue
      const category = resolveScheduleCategory(item.tag)
      const key = category?.key ?? item.tag.trim().toLowerCase()
      if (!categories.has(key)) {
        categories.set(key, {
          name: category?.name ?? item.tag.trim().toUpperCase(),
          color: resolveEventColor(item.tag),
        })
      }
    }
  }
  return [...categories.values()]
})

const posterStyle = computed(() => ({
  '--magazine-accent': rgbaToString(effectiveConfig.value.accentColor),
  '--week-dir': weekDirection.value || 1,
  ...backgroundImageStyle.value,
}))

defineExpose({ Config, DefaultConfig })
</script>

<template>
  <section class="schedule-template-surface magazine-template">
    <ScheduleWeekToolbar
      v-model="selectedWeek"
      :weeks="props.data ?? []"
      :capture-target="posterRef"
      :file-name="`直播特刊_${selectedWeek || '本周'}_${streamerName}`"
    />

    <Transition
      name="schedule-week-swap"
      mode="out-in"
    >
      <article
        :key="selectedWeek || 'empty'"
        ref="posterRef"
        class="magazine-poster"
        :class="{ 'has-background': backgroundUrl, 'has-cover': portraitUrl }"
        :style="posterStyle"
        aria-labelledby="magazine-poster-title"
      >
      <div
        class="paper-grain"
        aria-hidden="true"
      />

      <header class="poster-head">
        <div class="publication-mark">
          <span>VTB WEEKLY JOURNAL</span>
          <strong>{{ issueYear }}</strong>
        </div>

        <div class="masthead">
          <p>{{ streamerName }} · 编辑部发行</p>
          <h2 id="magazine-poster-title">{{ effectiveConfig.heading }}</h2>
          <div class="masthead-meta">
            <span>{{ weekLabel }}</span>
            <span>本期 {{ eventCount }} 场</span>
          </div>
        </div>

        <div class="issue-block">
          <span>ISSUE</span>
          <strong>{{ issueNumber }}</strong>
        </div>

        <figure
          v-if="portraitUrl"
          class="cover-photo"
        >
          <img
            :src="portraitUrl"
            :alt="`${streamerName}的本期封面`"
            referrerpolicy="no-referrer"
          />
          <figcaption>THIS WEEK'S COVER</figcaption>
        </figure>
      </header>

      <div class="edition-rule">
        <ul
          v-if="categoryLegend.length"
          class="edition-legend"
        >
          <li
            v-for="category in categoryLegend"
            :key="category.name"
          >
            <i :style="{ backgroundColor: category.color }" />
            <span>{{ category.name }}</span>
          </li>
        </ul>
        <span v-else>本期节目索引</span>
        <strong>节目索引 / MON–SUN</strong>
      </div>

      <div
        v-if="days.length"
        class="editorial-columns"
      >
        <ol class="program-column lead-column">
          <li
            v-for="(day, dayIndex) in leadDays"
            :key="day.english"
            class="program-day"
            :class="{ 'is-today': day.isToday, 'is-lead': dayIndex === 0 }"
          >
            <header class="day-identity">
              <span class="day-index">0{{ dayIndex + 1 }}</span>
              <div>
                <span>{{ day.english }} / {{ day.date }}</span>
                <h3>{{ day.label }}</h3>
              </div>
              <span
                v-if="day.isToday"
                class="today-stamp"
                >今日</span
              >
            </header>

            <div
              v-if="day.items.length"
              class="day-events"
            >
              <div
                v-for="(item, itemIndex) in day.items"
                :key="item.id || itemIndex"
                class="event-line"
                :style="{ '--event-accent': resolveEventColor(item.tag) }"
              >
                <time>{{ item.time || '待定' }}</time>
                <div class="event-copy">
                  <strong>{{ item.title || item.tag || '未命名直播' }}</strong>
                  <span v-if="item.tag">{{ item.tag }}</span>
                </div>
              </div>
            </div>
            <p
              v-else
              class="schedule-empty-copy rest-copy"
            >
              本日休刊 / OFF AIR
            </p>
          </li>
        </ol>

        <ol
          class="program-column side-column"
          start="4"
        >
          <li
            v-for="(day, dayIndex) in remainingDays"
            :key="day.english"
            class="program-day"
            :class="{ 'is-today': day.isToday }"
          >
            <header class="day-identity">
              <span class="day-index">0{{ dayIndex + 4 }}</span>
              <div>
                <span>{{ day.english }} / {{ day.date }}</span>
                <h3>{{ day.label }}</h3>
              </div>
              <span
                v-if="day.isToday"
                class="today-stamp"
                >今日</span
              >
            </header>

            <div
              v-if="day.items.length"
              class="day-events"
            >
              <div
                v-for="(item, itemIndex) in day.items"
                :key="item.id || itemIndex"
                class="event-line"
                :style="{ '--event-accent': resolveEventColor(item.tag) }"
              >
                <time>{{ item.time || '待定' }}</time>
                <div class="event-copy">
                  <strong>{{ item.title || item.tag || '未命名直播' }}</strong>
                  <span v-if="item.tag">{{ item.tag }}</span>
                </div>
              </div>
            </div>
            <p
              v-else
              class="schedule-empty-copy rest-copy"
            >
              本日休刊 / OFF AIR
            </p>
          </li>
        </ol>
      </div>

      <div
        v-else
        class="poster-empty"
      >
        <span>休刊</span>
        <p class="schedule-empty-copy">本周暂未排入节目</p>
      </div>

      <footer class="poster-foot">
        <strong>@{{ streamerName }}</strong>
        <span>每周发行 · 请以实际开播时间为准</span>
      </footer>
      </article>
    </Transition>
  </section>
</template>

<style scoped src="./magazineSchedule.css"></style>
