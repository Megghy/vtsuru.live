<script setup lang="ts">
import { Live24Regular, VideoPerson24Regular } from '@vicons/fluent'
import { NIcon } from 'naive-ui'
import { computed, ref } from 'vue'

import type { UploadFileResponse } from '@/api/api-models'
import type { ScheduleConfigTypeWithConfig } from '@/shared/types/TemplateTypes'
import type { RGBAColor } from '@/shared/types/VTsuruConfigTypes'
import { defineTemplateConfig, rgbaToString } from '@/shared/types/VTsuruConfigTypes'

import { useScheduleWeek } from './scheduleTemplateUtils'
import ScheduleWeekToolbar from './ScheduleWeekToolbar.vue'

import './scheduleTemplateTheme.css'

interface NeonStageConfig {
  backgroundFile: UploadFileResponse[]
  portraitFile: UploadFileResponse[]
  heading: string
  signalColor: RGBAColor
  accentColor: RGBAColor
  showAvatar: boolean
}

const props = defineProps<ScheduleConfigTypeWithConfig<NeonStageConfig>>()

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
  { name: '主标题', type: 'string', key: 'heading', default: 'STREAM SIGNAL' },
  {
    name: '信号强调色',
    type: 'color',
    key: 'signalColor',
    default: { r: 255, g: 74, b: 109, a: 1 } as RGBAColor,
    showAlpha: false,
  },
  {
    name: '界面强调色',
    type: 'color',
    key: 'accentColor',
    default: { r: 48, g: 201, b: 214, a: 1 } as RGBAColor,
    showAlpha: false,
  },
  { name: '显示主播头像', type: 'boolean', key: 'showAvatar', default: true },
])

const DefaultConfig: NeonStageConfig = {
  backgroundFile: [],
  portraitFile: [],
  heading: 'STREAM SIGNAL',
  signalColor: { r: 255, g: 74, b: 109, a: 1 },
  accentColor: { r: 48, g: 201, b: 214, a: 1 },
  showAvatar: true,
}

const boardRef = ref<HTMLElement>()
const effectiveConfig = computed(() => ({ ...DefaultConfig, ...props.config }))
const { selectedWeek, currentWeek, days, weekLabel, eventCount } = useScheduleWeek(() => props.data)
const portraitUrl = computed(
  () =>
    effectiveConfig.value.portraitFile[0]?.path ||
    props.previewPortrait ||
    (effectiveConfig.value.showAvatar
      ? props.userInfo?.faceUrl || props.userInfo?.streamerInfo?.faceUrl || props.biliInfo?.face
      : ''),
)
const backgroundUrl = computed(() => effectiveConfig.value.backgroundFile[0]?.path)
const boardStyle = computed(() => ({
  '--neon-signal': rgbaToString(effectiveConfig.value.signalColor),
  '--neon-accent': rgbaToString(effectiveConfig.value.accentColor),
  backgroundImage: backgroundUrl.value ? `url(${backgroundUrl.value})` : undefined,
}))

defineExpose({ Config, DefaultConfig })
</script>

<template>
  <section class="schedule-template-surface neon-template">
    <ScheduleWeekToolbar
      v-model="selectedWeek"
      :weeks="props.data ?? []"
      :capture-target="boardRef"
      :file-name="`直播信号_${selectedWeek || '本周'}_${props.userInfo?.name || '主播'}`"
    />

    <div
      ref="boardRef"
      class="neon-board"
      :class="{ 'has-background': backgroundUrl }"
      :style="boardStyle"
    >
      <div class="scan-grid" />

      <header class="signal-head">
        <div class="on-air">
          <span class="signal-dot" />
          ON AIR
        </div>
        <div class="signal-title">
          <span>VTUBER BROADCAST CONTROL</span>
          <h2>{{ effectiveConfig.heading }}</h2>
        </div>
        <div class="week-code">
          <span>{{ currentWeek?.year || '----' }}</span>
          <strong>W{{ String(currentWeek?.week || '--').padStart(2, '0') }}</strong>
        </div>
      </header>

      <div class="stage-layout">
        <aside class="talent-panel">
          <div class="portrait-frame">
            <img
              v-if="portraitUrl"
              :src="portraitUrl"
              :alt="`${props.userInfo?.name || '主播'}的形象`"
            />
            <NIcon
              v-else
              size="72"
            >
              <VideoPerson24Regular />
            </NIcon>
            <span class="frame-corner corner-top" />
            <span class="frame-corner corner-bottom" />
          </div>
          <div class="talent-name">
            <small>CAST / CHANNEL</small>
            <strong>{{ props.userInfo?.name || 'VTUBER' }}</strong>
          </div>
          <dl class="signal-data">
            <div>
              <dt>DATE</dt>
              <dd>{{ weekLabel }}</dd>
            </div>
            <div>
              <dt>PROGRAMS</dt>
              <dd>{{ eventCount.toString().padStart(2, '0') }}</dd>
            </div>
          </dl>
        </aside>

        <main class="program-panel">
          <div class="program-head">
            <span>WEEKLY PROGRAM LOG</span>
            <NIcon><Live24Regular /></NIcon>
          </div>

          <div class="program-list">
            <article
              v-for="(day, dayIndex) in days"
              :key="day.english"
              class="program-day"
              :class="{ 'is-today': day.isToday }"
            >
              <div class="day-code">
                <span>{{ String(dayIndex + 1).padStart(2, '0') }}</span>
                <strong>{{ day.english }}</strong>
                <small>{{ day.date }}</small>
              </div>

              <div
                v-if="day.items.length"
                class="program-events"
              >
                <div
                  v-for="(item, itemIndex) in day.items"
                  :key="item.id || itemIndex"
                  class="program-event"
                  :style="item.tagColor ? { '--event-tag-color': item.tagColor } : undefined"
                >
                  <time>{{ item.time || 'TBA' }}</time>
                  <div>
                    <strong>{{ item.title || '未命名直播' }}</strong>
                    <span v-if="item.tag">{{ item.tag }}</span>
                  </div>
                </div>
              </div>
              <span
                v-else
                class="schedule-empty-copy offline-copy"
              >
                SIGNAL OFF / REST
              </span>
            </article>
          </div>
        </main>
      </div>

      <footer class="signal-foot">
        <span>VTSURU LIVE NETWORK</span>
        <span>READY · SYNC · BROADCAST</span>
      </footer>
    </div>
  </section>
</template>

<style scoped src="./neonStageSchedule.css"></style>
