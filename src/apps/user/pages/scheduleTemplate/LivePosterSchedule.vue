<script setup lang="ts">
import { Live24Filled } from '@vicons/fluent'
import { NIcon } from 'naive-ui'
import { computed, ref } from 'vue'

import type { UploadFileResponse } from '@/api/api-models'
import type { ScheduleConfigTypeWithConfig } from '@/shared/types/TemplateTypes'
import type { RGBAColor } from '@/shared/types/VTsuruConfigTypes'
import { defineTemplateConfig, rgbaToString } from '@/shared/types/VTsuruConfigTypes'

import { useScheduleWeek } from './scheduleTemplateUtils'
import { ensureGoogleFont } from './scheduleFonts'
import ScheduleWeekToolbar from './ScheduleWeekToolbar.vue'
import { useScheduleTemplateAssets } from './useScheduleTemplateAssets'

import './scheduleTemplateTheme.css'

ensureGoogleFont('Anton')

interface LivePosterConfig {
  backgroundFile: UploadFileResponse[]
  portraitFile: UploadFileResponse[]
  heading: string
  subheading: string
  accentColor: RGBAColor
  accentColor2: RGBAColor
  showAvatar: boolean
}

const props = defineProps<ScheduleConfigTypeWithConfig<LivePosterConfig>>()

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
  { name: '主标题', type: 'string', key: 'heading', default: 'LIVE' },
  { name: '副标题', type: 'string', key: 'subheading', default: 'WEEKLY STREAM' },
  {
    name: '主强调色',
    type: 'color',
    key: 'accentColor',
    default: { r: 255, g: 82, b: 150, a: 1 } as RGBAColor,
    showAlpha: false,
  },
  {
    name: '副强调色',
    type: 'color',
    key: 'accentColor2',
    default: { r: 92, g: 226, b: 255, a: 1 } as RGBAColor,
    showAlpha: false,
  },
  { name: '未上传立绘时显示头像', type: 'boolean', key: 'showAvatar', default: true },
])

const DefaultConfig: LivePosterConfig = {
  backgroundFile: [],
  portraitFile: [],
  heading: 'LIVE',
  subheading: 'WEEKLY STREAM',
  accentColor: { r: 255, g: 82, b: 150, a: 1 },
  accentColor2: { r: 92, g: 226, b: 255, a: 1 },
  showAvatar: true,
}

const posterRef = ref<HTMLElement>()
const effectiveConfig = computed(() => ({ ...DefaultConfig, ...props.config }))
const { selectedWeek, days, weekLabel, eventCount } = useScheduleWeek(() => props.data)
const { portraitUrl, backgroundUrl } = useScheduleTemplateAssets(props, effectiveConfig)

const streamerName = computed(() => props.userInfo?.name || 'VTUBER')
const posterStyle = computed(() => ({
  '--poster-accent': rgbaToString(effectiveConfig.value.accentColor),
  '--poster-accent-2': rgbaToString(effectiveConfig.value.accentColor2),
  backgroundImage: backgroundUrl.value ? `url(${backgroundUrl.value})` : undefined,
}))

defineExpose({ Config, DefaultConfig })
</script>

<template>
  <section class="schedule-template-surface live-poster-template">
    <ScheduleWeekToolbar
      v-model="selectedWeek"
      :weeks="props.data ?? []"
      :capture-target="posterRef"
      :file-name="`直播海报_${selectedWeek || '本周'}_${streamerName}`"
    />

    <article
      ref="posterRef"
      class="live-poster"
      :class="{ 'has-background': backgroundUrl, 'has-artwork': portraitUrl }"
      :style="posterStyle"
      aria-labelledby="live-poster-title"
    >
      <div class="poster-beams" />
      <div class="poster-glow" />

      <header class="poster-top">
        <div class="poster-live-badge">
          <span class="poster-live-dot" />
          ON AIR
        </div>
        <div class="poster-week">
          <span>{{ weekLabel }}</span>
          <strong>{{ eventCount.toString().padStart(2, '0') }} STREAMS</strong>
        </div>
      </header>

      <div class="poster-hero">
        <p class="poster-hero__presenter">{{ streamerName }} PRESENTS</p>
        <h2
          id="live-poster-title"
          class="poster-hero__title"
        >
          {{ effectiveConfig.heading }}
        </h2>
        <p class="poster-hero__sub">{{ effectiveConfig.subheading }}</p>
      </div>

      <figure
        v-if="portraitUrl"
        class="poster-art"
      >
        <img
          :src="portraitUrl"
          :alt="`${streamerName}的形象`"
        />
      </figure>

      <div class="poster-schedule">
        <div class="poster-schedule__head">
          <NIcon><Live24Filled /></NIcon>
          <span>THIS WEEK ON STREAM</span>
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
                :style="item.tagColor ? { '--event-tag-color': item.tagColor } : undefined"
              >
                <time>{{ item.time || 'TBA' }}</time>
                <strong>{{ item.title || '未命名直播' }}</strong>
                <span v-if="item.tag">{{ item.tag }}</span>
              </div>
            </div>
            <span
              v-else
              class="poster-day__rest"
            >
              OFF
            </span>
          </li>
        </ol>
      </div>

      <footer class="poster-foot">
        <strong>@{{ streamerName }}</strong>
        <span>LIVE · TALK · GAME · MUSIC</span>
      </footer>
    </article>
  </section>
</template>

<style scoped src="./livePosterSchedule.css"></style>
