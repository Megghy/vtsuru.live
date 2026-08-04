<script setup lang="ts">
import { Flash24Regular, MicSparkle24Regular } from '@vicons/fluent'
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

ensureGoogleFont('Monoton')

interface PrismStageConfig {
  backgroundFile: UploadFileResponse[]
  portraitFile: UploadFileResponse[]
  heading: string
  accentColor: RGBAColor
  beamColor: RGBAColor
  showAvatar: boolean
}

const props = defineProps<ScheduleConfigTypeWithConfig<PrismStageConfig>>()

const Config = defineTemplateConfig([
  {
    name: '舞台背景',
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
  { name: '主标题', type: 'string', key: 'heading', default: 'ON STAGE' },
  {
    name: '霓虹主色',
    type: 'color',
    key: 'accentColor',
    default: { r: 255, g: 47, b: 179, a: 1 } as RGBAColor,
    showAlpha: false,
  },
  {
    name: '光束颜色',
    type: 'color',
    key: 'beamColor',
    default: { r: 122, g: 92, b: 255, a: 1 } as RGBAColor,
    showAlpha: false,
  },
  { name: '未上传立绘时显示头像', type: 'boolean', key: 'showAvatar', default: true },
])

const DefaultConfig: PrismStageConfig = {
  backgroundFile: [],
  portraitFile: [],
  heading: 'ON STAGE',
  accentColor: { r: 255, g: 47, b: 179, a: 1 },
  beamColor: { r: 122, g: 92, b: 255, a: 1 },
  showAvatar: true,
}

const stageRef = ref<HTMLElement>()
const effectiveConfig = computed(() => ({ ...DefaultConfig, ...props.config }))
const { selectedWeek, currentWeek, days, weekLabel, eventCount } = useScheduleWeek(() => props.data)
const { portraitUrl, backgroundUrl } = useScheduleTemplateAssets(props, effectiveConfig)

const streamerName = computed(() => props.userInfo?.name || 'VTUBER')
const stageStyle = computed(() => ({
  '--prism-accent': rgbaToString(effectiveConfig.value.accentColor),
  '--prism-beam': rgbaToString(effectiveConfig.value.beamColor),
  backgroundImage: backgroundUrl.value ? `url(${backgroundUrl.value})` : undefined,
}))

defineExpose({ Config, DefaultConfig })
</script>

<template>
  <section class="schedule-template-surface prism-stage-template">
    <ScheduleWeekToolbar
      v-model="selectedWeek"
      :weeks="props.data ?? []"
      :capture-target="stageRef"
      :file-name="`霓虹舞台_${selectedWeek || '本周'}_${streamerName}`"
    />

    <div
      ref="stageRef"
      class="prism-stage"
      :class="{ 'has-background': backgroundUrl }"
      :style="stageStyle"
    >
      <div class="stage-rig">
        <span class="stage-beam beam-1" />
        <span class="stage-beam beam-2" />
        <span class="stage-beam beam-3" />
      </div>
      <div class="stage-laser" />
      <div class="stage-haze" />

      <header class="stage-head">
        <div class="stage-title">
          <span class="stage-eyebrow">
            <NIcon><MicSparkle24Regular /></NIcon>
            {{ streamerName }} LIVE HOUSE
          </span>
          <h2 class="stage-title__neon">{{ effectiveConfig.heading }}</h2>
          <p class="stage-title__meta">
            {{ weekLabel }} · {{ eventCount.toString().padStart(2, '0') }} SHOWS · W{{
              String(currentWeek?.week || '--').padStart(2, '0')
            }}
          </p>
        </div>

        <figure
          v-if="portraitUrl"
          class="stage-art"
        >
          <img
            :src="portraitUrl"
            :alt="`${streamerName}的形象`"
          />
        </figure>
      </header>

      <div class="stage-program">
        <div class="stage-program__head">
          <NIcon><Flash24Regular /></NIcon>
          <span>SET LIST · THIS WEEK</span>
        </div>

        <ol class="stage-days">
          <li
            v-for="(day, dayIndex) in days"
            :key="day.english"
            class="stage-day"
            :class="{ 'is-today': day.isToday, 'is-rest': !day.items.length }"
          >
            <span class="stage-day__num">{{ String(dayIndex + 1).padStart(2, '0') }}</span>
            <div class="stage-day__id">
              <strong>{{ day.english }}</strong>
              <time>{{ day.date }}</time>
            </div>

            <div
              v-if="day.items.length"
              class="stage-day__events"
            >
              <div
                v-for="(item, itemIndex) in day.items"
                :key="item.id || itemIndex"
                class="stage-event"
                :style="item.tagColor ? { '--event-tag-color': item.tagColor } : undefined"
              >
                <time>{{ item.time || 'TBA' }}</time>
                <div class="stage-event__copy">
                  <strong>{{ item.title || '未命名直播' }}</strong>
                  <span v-if="item.tag">{{ item.tag }}</span>
                </div>
              </div>
            </div>
            <span
              v-else
              class="stage-day__rest"
            >
              — INTERMISSION —
            </span>

            <span
              v-if="day.isToday"
              class="stage-day__live"
            >
              LIVE
            </span>
          </li>
        </ol>
      </div>

      <footer class="stage-foot">
        <span>VTSURU PRESENTS</span>
        <span class="stage-foot__marquee">GOOD SHOW · GOOD SHOW · GOOD SHOW · GOOD SHOW</span>
        <span>@{{ streamerName }}</span>
      </footer>
    </div>
  </section>
</template>

<style scoped src="./prismStageSchedule.css"></style>
