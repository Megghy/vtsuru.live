<script setup lang="ts">
import { Live24Regular } from '@vicons/fluent'
import { NIcon } from 'naive-ui'
import { computed, ref } from 'vue'

import type { UploadFileResponse } from '@/api/api-models'
import type { ScheduleConfigTypeWithConfig } from '@/shared/types/TemplateTypes'
import type { RGBAColor } from '@/shared/types/VTsuruConfigTypes'
import { defineTemplateConfig, rgbaToString } from '@/shared/types/VTsuruConfigTypes'

import { resolveScheduleCategory } from './scheduleCategories'
import { ensureGoogleFont } from './scheduleFonts'
import { useScheduleWeek } from './scheduleTemplateUtils'
import ScheduleWeekToolbar from './ScheduleWeekToolbar.vue'
import { useScheduleTemplateAssets } from './useScheduleTemplateAssets'

import './scheduleTemplateTheme.css'

interface NeonStageConfig {
  backgroundFile: UploadFileResponse[]
  portraitFile: UploadFileResponse[]
  heading: string
  signalColor: RGBAColor
  showAvatar: boolean
}

const props = defineProps<ScheduleConfigTypeWithConfig<NeonStageConfig>>()

ensureGoogleFont('IBM+Plex+Mono:wght@400;500;600;700')

const Config = defineTemplateConfig([
  {
    name: '控制台表面',
    type: 'file',
    key: 'backgroundFile',
    fileLimit: 1,
    onUploaded: (files: UploadFileResponse[], config: NeonStageConfig) => (config.backgroundFile = files),
  },
  {
    name: '频道识别图',
    type: 'file',
    key: 'portraitFile',
    fileLimit: 1,
    onUploaded: (files: UploadFileResponse[], config: NeonStageConfig) => (config.portraitFile = files),
  },
  { name: '主标题', type: 'string', key: 'heading', default: 'BROADCAST CONTROL' },
  {
    name: '信号强调色',
    type: 'color',
    key: 'signalColor',
    default: { r: 180, g: 255, b: 62, a: 1 } as RGBAColor,
    showAlpha: false,
  },
  { name: '未上传识别图时显示头像', type: 'boolean', key: 'showAvatar', default: false },
])

const DefaultConfig: NeonStageConfig = {
  backgroundFile: [],
  portraitFile: [],
  heading: 'BROADCAST CONTROL',
  signalColor: { r: 180, g: 255, b: 62, a: 1 },
  showAvatar: false,
}

const boardRef = ref<HTMLElement>()
const effectiveConfig = computed(() => ({ ...DefaultConfig, ...props.config }))
const { selectedWeek, weekDirection, currentWeek, days, weekLabel, eventCount } = useScheduleWeek(() => props.data)
const { portraitUrl, backgroundUrl, backgroundImageStyle } = useScheduleTemplateAssets(props, effectiveConfig)
const activeDayCount = computed(() => days.value.filter((day) => day.items.length > 0).length)
const peakLoad = computed(() => Math.max(1, ...days.value.map((day) => day.items.length)))
const tagSummary = computed(() => {
  const counts = new Map<string, number>()
  for (const day of days.value) {
    for (const item of day.items) {
      if (item.tag) counts.set(item.tag, (counts.get(item.tag) ?? 0) + 1)
    }
  }
  return [...counts.entries()]
    .toSorted((left, right) => right[1] - left[1])
    .slice(0, 4)
    .map(([name, count]) => ({ name, count }))
})
const boardStyle = computed(() => ({
  '--neon-signal': rgbaToString(effectiveConfig.value.signalColor),
  '--week-dir': weekDirection.value || 1,
  ...backgroundImageStyle.value,
}))
const loadStyle = (count: number) => ({ '--day-load': `${(count / peakLoad.value) * 100}%` })
const eventType = (tag?: string | null) => resolveScheduleCategory(tag)?.key ?? 'other'

defineExpose({ Config, DefaultConfig })
</script>

<template>
  <section class="schedule-template-surface neon-template">
    <ScheduleWeekToolbar
      v-model="selectedWeek"
      :weeks="props.data ?? []"
      :capture-target="boardRef"
      :file-name="`播控日程_${selectedWeek || '本周'}_${props.userInfo?.name || '主播'}`"
    />

    <Transition
      name="schedule-week-swap"
      mode="out-in"
    >
      <div
        :key="selectedWeek || 'empty'"
        ref="boardRef"
        class="neon-board"
        :class="{ 'has-background': backgroundUrl }"
        :style="boardStyle"
      >
      <header class="signal-head">
        <div class="on-air"><span class="signal-dot" />CHANNEL READY</div>
        <div class="signal-title">
          <span>VTSURU / WEEKLY TRANSMISSION DESK</span>
          <h2>{{ effectiveConfig.heading }}</h2>
        </div>
        <div class="week-code">
          <span>{{ currentWeek?.year || '----' }}</span>
          <strong>W{{ String(currentWeek?.week || '--').padStart(2, '0') }}</strong>
        </div>
      </header>

      <div class="stage-layout">
        <aside class="control-console">
          <div class="channel-identity">
            <img
              v-if="portraitUrl"
              :src="portraitUrl"
              :alt="`${props.userInfo?.name || '主播'}的频道识别图`"
              referrerpolicy="no-referrer"
            />
            <span
              v-else
              class="channel-monogram"
              >{{ (props.userInfo?.name || 'V').slice(0, 1) }}</span
            >
            <div>
              <small>CHANNEL ID</small>
              <strong>{{ props.userInfo?.name || 'VTUBER' }}</strong>
            </div>
          </div>

          <dl class="console-readings">
            <div>
              <dt>PROGRAMS</dt>
              <dd>{{ eventCount.toString().padStart(2, '0') }}</dd>
            </div>
            <div>
              <dt>ACTIVE DAYS</dt>
              <dd>{{ activeDayCount }} / 7</dd>
            </div>
            <div class="reading-wide">
              <dt>TRANSMISSION WINDOW</dt>
              <dd>{{ weekLabel }}</dd>
            </div>
          </dl>

          <div class="load-monitor">
            <div class="console-label"><span>DAILY LOAD</span><span>CH 01—07</span></div>
            <div class="load-bars">
              <span
                v-for="day in days"
                :key="day.english"
                :class="{ 'is-active': day.items.length }"
                :style="loadStyle(day.items.length)"
                ><i
              /></span>
            </div>
          </div>

          <div class="tag-monitor">
            <div class="console-label">
              <span>CONTENT INDEX</span><span>{{ tagSummary.length || '—' }}</span>
            </div>
            <ul v-if="tagSummary.length">
              <li
                v-for="tag in tagSummary"
                :key="tag.name"
              >
                <span>{{ tag.name }}</span
                ><strong>{{ String(tag.count).padStart(2, '0') }}</strong>
              </li>
            </ul>
            <p v-else>NO TAG DATA</p>
          </div>
        </aside>

        <main class="program-panel">
          <div class="program-head">
            <span>PROGRAM QUEUE</span>
            <span
              ><NIcon><Live24Regular /></NIcon> LIVE LOG</span
            >
          </div>

          <div class="program-list">
            <article
              v-for="(day, dayIndex) in days"
              :key="day.english"
              class="program-day"
              :class="{ 'is-today': day.isToday }"
            >
              <span class="queue-index">{{ String(dayIndex + 1).padStart(2, '0') }}</span>
              <div class="day-code">
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
                  :data-type="eventType(item.tag)"
                >
                  <time>{{ item.time || 'TBA' }}</time>
                  <div class="event-copy">
                    <strong>{{ item.title || '未命名直播' }}</strong>
                    <span
                      v-if="item.tag"
                      class="event-type"
                      >[TYPE: {{ item.tag }}]</span
                    >
                  </div>
                </div>
              </div>
              <span
                v-else
                class="schedule-empty-copy offline-copy"
                >CHANNEL IDLE</span
              >
            </article>
          </div>
        </main>
      </div>

      <footer class="signal-foot">
        <span>MASTER OUTPUT / NOMINAL</span>
        <span>READY · SYNC · BROADCAST</span>
      </footer>
      </div>
    </Transition>
  </section>
</template>

<style scoped src="./neonStageSchedule.css"></style>
