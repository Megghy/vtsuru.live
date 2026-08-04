<script setup lang="ts">
import { Sparkle24Filled } from '@vicons/fluent'
import { NIcon } from 'naive-ui'
import { computed, ref } from 'vue'

import type { UploadFileResponse } from '@/api/api-models'
import type { ScheduleConfigTypeWithConfig } from '@/shared/types/TemplateTypes'
import type { DecorativeImageProperties, RGBAColor } from '@/shared/types/VTsuruConfigTypes'
import { defineTemplateConfig, rgbaToString } from '@/shared/types/VTsuruConfigTypes'

import { useScheduleWeek } from './scheduleTemplateUtils'
import ScheduleWeekToolbar from './ScheduleWeekToolbar.vue'

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
  {
    name: '立绘位置',
    type: 'select',
    key: 'portraitPosition',
    default: 'right',
    options: [
      { label: '右侧', value: 'right' },
      { label: '左侧', value: 'left' },
    ],
  },
  { name: '标题', type: 'string', key: 'heading', default: 'WEEKLY LIVE NOTE' },
  {
    name: '强调色',
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
const { selectedWeek, days, weekLabel, eventCount } = useScheduleWeek(() => props.data)
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
  '--kawaii-accent': rgbaToString(effectiveConfig.value.accentColor),
  '--kawaii-sheet': rgbaToString(effectiveConfig.value.sheetColor),
  backgroundImage: backgroundUrl.value ? `url(${backgroundUrl.value})` : undefined,
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

    <div
      ref="boardRef"
      class="kawaii-board"
      :class="[
        `art-${effectiveConfig.portraitPosition}`,
        { 'has-artwork': portraitUrl, 'has-background': backgroundUrl },
      ]"
      :style="boardStyle"
    >
      <div class="paper-grid" />

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
        <div class="head-mark">
          <NIcon size="18"><Sparkle24Filled /></NIcon>
          LIVE PLAN
        </div>
        <h2>{{ effectiveConfig.heading }}</h2>
        <div class="week-meta">
          <span>{{ weekLabel }}</span>
          <span>{{ eventCount }} STREAMS</span>
        </div>
      </header>

      <figure
        v-if="portraitUrl"
        class="character-art"
      >
        <img
          :src="portraitUrl"
          :alt="`${props.userInfo?.name || '主播'}的形象`"
        />
        <figcaption>@{{ props.userInfo?.name || 'VTUBER' }}</figcaption>
      </figure>

      <div class="day-grid">
        <article
          v-for="day in days"
          :key="day.english"
          class="day-note"
          :class="{ 'is-today': day.isToday }"
        >
          <header class="day-head">
            <span class="day-number">{{ day.shortLabel }}</span>
            <span>
              <strong>{{ day.label }}</strong>
              <small>{{ day.english }} · {{ day.date }}</small>
            </span>
            <span
              v-if="day.isToday"
              class="today-mark"
            >
              TODAY
            </span>
          </header>

          <div
            v-if="day.items.length"
            class="event-list"
          >
            <div
              v-for="(item, itemIndex) in day.items"
              :key="item.id || itemIndex"
              class="event-row"
              :style="item.tagColor ? { '--event-tag-color': item.tagColor } : undefined"
            >
              <time>{{ item.time || '待定' }}</time>
              <div class="event-copy">
                <strong>{{ item.title || '未命名直播' }}</strong>
                <span v-if="item.tag"># {{ item.tag }}</span>
              </div>
            </div>
          </div>
          <p
            v-else
            class="schedule-empty-copy rest-note"
          >
            OFF DAY · 好好休息
          </p>
        </article>
      </div>
    </div>
  </section>
</template>

<style scoped src="./kawaiiSchedule.css"></style>
