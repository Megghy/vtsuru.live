<script setup lang="ts">
import { computed, ref } from 'vue'

import type { UploadFileResponse } from '@/api/api-models'
import type { ScheduleConfigTypeWithConfig } from '@/shared/types/TemplateTypes'
import type { RGBAColor } from '@/shared/types/VTsuruConfigTypes'
import { defineTemplateConfig, rgbaToString } from '@/shared/types/VTsuruConfigTypes'

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

const Config = defineTemplateConfig([
  {
    name: '背景图片',
    type: 'file',
    key: 'backgroundFile',
    fileLimit: 1,
    onUploaded: (files: UploadFileResponse[], config: any) => (config.backgroundFile = files),
  },
  {
    name: '角色立绘',
    type: 'file',
    key: 'portraitFile',
    fileLimit: 1,
    onUploaded: (files: UploadFileResponse[], config: any) => (config.portraitFile = files),
  },
  { name: '海报标题', type: 'string', key: 'heading', default: 'WEEKLY ON AIR' },
  {
    name: '强调色',
    type: 'color',
    key: 'accentColor',
    default: { r: 220, g: 102, b: 128, a: 1 } as RGBAColor,
    showAlpha: false,
  },
  { name: '未上传立绘时显示头像', type: 'boolean', key: 'showAvatar', default: true },
])

const DefaultConfig: MagazineConfig = {
  backgroundFile: [],
  portraitFile: [],
  heading: 'WEEKLY ON AIR',
  accentColor: { r: 220, g: 102, b: 128, a: 1 },
  showAvatar: true,
}

const posterRef = ref<HTMLElement>()
const effectiveConfig = computed(() => ({ ...DefaultConfig, ...props.config }))
const { selectedWeek, currentWeek, days, weekLabel, eventCount } = useScheduleWeek(() => props.data)
const { customPortraitUrl, portraitUrl, backgroundUrl } = useScheduleTemplateAssets(props, effectiveConfig)

const streamerName = computed(() => props.userInfo?.name || 'VTUBER')
const issueLabel = computed(() => {
  const week = currentWeek.value
  return week ? `${week.year} / WEEK ${String(week.week).padStart(2, '0')}` : 'NO SCHEDULE'
})
const posterStyle = computed(() => ({
  '--magazine-accent': props.config?.accentColor
    ? rgbaToString(effectiveConfig.value.accentColor)
    : 'var(--schedule-accent)',
  backgroundImage: backgroundUrl.value ? `url(${backgroundUrl.value})` : undefined,
}))

defineExpose({ Config, DefaultConfig })
</script>

<template>
  <section class="schedule-template-surface magazine-template">
    <ScheduleWeekToolbar
      v-model="selectedWeek"
      :weeks="props.data ?? []"
      :capture-target="posterRef"
      :file-name="`直播节目单_${selectedWeek || '本周'}_${streamerName}`"
    />

    <article
      ref="posterRef"
      class="magazine-poster"
      :class="{
        'has-background': backgroundUrl,
        'uses-avatar': portraitUrl && !customPortraitUrl && !props.previewPortrait,
      }"
      :style="posterStyle"
      aria-labelledby="magazine-poster-title"
    >
      <div
        class="print-grid"
        aria-hidden="true"
      />

      <header class="poster-head">
        <div class="issue-column">
          <span>VTB WEEKLY</span>
          <strong>{{ issueLabel }}</strong>
        </div>

        <div class="masthead">
          <p>{{ streamerName }} presents</p>
          <h2 id="magazine-poster-title">{{ effectiveConfig.heading }}</h2>
          <div class="masthead-meta">
            <span>{{ weekLabel }}</span>
            <span>{{ eventCount }} 场直播</span>
          </div>
        </div>

        <figure
          v-if="portraitUrl"
          class="portrait"
        >
          <img
            :src="portraitUrl"
            :alt="customPortraitUrl || props.previewPortrait ? `${streamerName}的角色形象` : `${streamerName}的头像`"
          />
        </figure>
      </header>

      <div class="section-rule">
        <span>PROGRAM INDEX</span>
        <span>MON - SUN</span>
      </div>

      <ol
        v-if="days.length"
        class="program-list"
      >
        <li
          v-for="(day, dayIndex) in days"
          :key="day.english"
          class="program-day"
          :class="{ 'is-today': day.isToday }"
        >
          <span class="day-index">{{ String(dayIndex + 1).padStart(2, '0') }}</span>

          <header class="day-identity">
            <span>{{ day.english }}</span>
            <h3>{{ day.label }}</h3>
            <time>{{ day.date }}</time>
          </header>

          <div
            v-if="day.items.length"
            class="day-events"
          >
            <div
              v-for="(item, itemIndex) in day.items"
              :key="item.id || itemIndex"
              class="event-line"
              :style="item.tagColor ? { '--event-accent': item.tagColor } : undefined"
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
            OFF AIR / 休息日
          </p>

          <span
            v-if="day.isToday"
            class="today-stamp"
          >
            TODAY
          </span>
        </li>
      </ol>

      <div
        v-else
        class="poster-empty"
      >
        <span>NO PROGRAM</span>
        <p class="schedule-empty-copy">本周还没有安排直播</p>
      </div>

      <footer class="poster-foot">
        <strong>@{{ streamerName }}</strong>
        <span>LIVE / TALK / GAME / MUSIC</span>
      </footer>
    </article>
  </section>
</template>

<style scoped src="./magazineSchedule.css"></style>
