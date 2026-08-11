<script setup lang="ts">
import { computed, ref } from 'vue'

import type { UploadFileResponse } from '@/api/api-models'
import type { ScheduleConfigTypeWithConfig } from '@/shared/types/TemplateTypes'
import type { RGBAColor } from '@/shared/types/VTsuruConfigTypes'
import { defineTemplateConfig, rgbaToString } from '@/shared/types/VTsuruConfigTypes'

import { ensureGoogleFont } from './scheduleFonts'
import { useScheduleWeek } from './scheduleTemplateUtils'
import ScheduleWeekToolbar from './ScheduleWeekToolbar.vue'

import './scheduleTemplateTheme.css'

interface KinariConfig {
  backgroundFile: UploadFileResponse[]
  heading: string
  accentColor: RGBAColor
  indigoColor: RGBAColor
}

const props = defineProps<ScheduleConfigTypeWithConfig<KinariConfig>>()

ensureGoogleFont('Zen+Maru+Gothic:wght@500;700;900')

const Config = defineTemplateConfig([
  {
    name: '背景图片',
    type: 'file',
    key: 'backgroundFile',
    fileLimit: 1,
    onUploaded: (files: UploadFileResponse[], config: KinariConfig) => (config.backgroundFile = files),
  },
  { name: '布告栏标题', type: 'string', key: 'heading', default: '日和町放送便り' },
  {
    name: '柿色',
    type: 'color',
    key: 'accentColor',
    default: { r: 224, g: 92, b: 57, a: 1 } as RGBAColor,
    showAlpha: false,
  },
  {
    name: '群青色',
    type: 'color',
    key: 'indigoColor',
    default: { r: 35, g: 67, b: 94, a: 1 } as RGBAColor,
    showAlpha: false,
  },
])

const DefaultConfig: KinariConfig = {
  backgroundFile: [],
  heading: '日和町放送便り',
  accentColor: { r: 224, g: 92, b: 57, a: 1 },
  indigoColor: { r: 35, g: 67, b: 94, a: 1 },
}

const boardRef = ref<HTMLElement>()
const effectiveConfig = computed(() => ({ ...DefaultConfig, ...props.config }))
const { selectedWeek, weekDirection, currentWeek, days, weekLabel, eventCount } = useScheduleWeek(() => props.data)

const streamerName = computed(() => props.userInfo?.name || 'VTUBER')
const boardStyle = computed(() => ({
  '--kinari-accent': rgbaToString(effectiveConfig.value.accentColor),
  '--kinari-indigo': rgbaToString(effectiveConfig.value.indigoColor),
  '--week-dir': weekDirection.value || 1,
  backgroundImage: effectiveConfig.value.backgroundFile[0]?.path
    ? `url(${effectiveConfig.value.backgroundFile[0].path})`
    : undefined,
}))

defineExpose({ Config, DefaultConfig })
</script>

<template>
  <section class="schedule-template-surface kinari-template">
    <ScheduleWeekToolbar
      v-model="selectedWeek"
      :weeks="props.data ?? []"
      :capture-target="boardRef"
      :file-name="`白和纸手帖_${selectedWeek || '本周'}_${streamerName}`"
    />

    <Transition
      name="schedule-week-swap"
      mode="out-in"
    >
      <div
        :key="selectedWeek || 'empty'"
        ref="boardRef"
        class="kinari-board"
        :class="{ 'has-background': effectiveConfig.backgroundFile[0]?.path }"
        :style="boardStyle"
      >
      <div
        class="kinari-trim"
        aria-hidden="true"
      />

      <header class="kinari-head">
        <div class="kinari-head__rail">
          <span>日和町</span>
          <b>WEEKLY</b>
        </div>
        <div class="kinari-head__copy">
          <p class="kinari-head__eyebrow">今週の放送案内 / PROGRAM BOARD</p>
          <h2>{{ effectiveConfig.heading }}</h2>
          <p class="kinari-head__sub">{{ streamerName }} · {{ weekLabel }}</p>
          <div class="kinari-head__rule"><span /> <span /> <span /></div>
        </div>
        <div class="kinari-head__date">
          <div class="kinari-head__date-copy">
            <strong>{{ String(currentWeek?.week || '--').padStart(2, '0') }}</strong>
            <span>WEEK</span>
            <small>{{ eventCount }} 场安排</small>
          </div>
          <div
            class="kinari-head__date-copy kinari-head__date-copy--sun"
            aria-hidden="true"
          >
            <strong>{{ String(currentWeek?.week || '--').padStart(2, '0') }}</strong>
            <span>WEEK</span>
            <small>{{ eventCount }} 场安排</small>
          </div>
        </div>
      </header>

      <div class="kinari-banner">
        <span>お知らせ</span>
        <strong>每一天都有值得期待的节目</strong>
        <span>MON — SUN</span>
      </div>

      <ol class="kinari-days schedule-day-stagger">
        <li
          v-for="(day, dayIndex) in days"
          :key="day.english"
          class="kinari-day"
          :class="{ 'is-today': day.isToday, 'is-rest': !day.items.length, 'is-featured': dayIndex === 6 }"
          :style="{ '--day-index': dayIndex }"
        >
          <div class="kinari-day__tab">
            <span>{{ day.shortLabel }}</span>
            <b>{{ day.date }}</b>
          </div>
          <div class="kinari-day__body">
            <header class="kinari-day__identity">
              <div>
                <span>{{ day.english }}</span>
                <strong>{{ day.label }}</strong>
              </div>
              <em v-if="day.isToday">今日</em>
            </header>
            <div
              v-if="day.items.length"
              class="kinari-day__events"
            >
              <article
                v-for="(item, itemIndex) in day.items"
                :key="item.id || itemIndex"
                class="kinari-event"
                :style="item.tagColor ? { '--event-tag-color': item.tagColor } : undefined"
              >
                <time>{{ item.time || '待定' }}</time>
                <div class="kinari-event__copy">
                  <strong>{{ item.title || '未命名直播' }}</strong>
                  <span v-if="item.tag">{{ item.tag }}</span>
                </div>
                <span
                  class="kinari-event__mark"
                  aria-hidden="true"
                  >↗</span
                >
              </article>
            </div>
            <span
              v-else
              class="kinari-day__rest"
              >本日休息 · また明日</span
            >
            <div
              v-if="dayIndex === 6"
              class="kinari-day__motif"
              aria-hidden="true"
            >
              <span>日和</span>
              <small>HIYORI TV · CH 07</small>
            </div>
          </div>
        </li>
      </ol>

      <footer class="kinari-foot">
        <span>{{ streamerName }}</span>
        <span>また来週、町角で</span>
      </footer>
      </div>
    </Transition>
  </section>
</template>

<style scoped src="./kinariSchedule.css"></style>
