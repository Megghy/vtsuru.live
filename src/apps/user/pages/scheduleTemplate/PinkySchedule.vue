<script setup lang="ts">
import { computed, ref } from 'vue'

import type { UploadFileResponse } from '@/api/api-models'
import type { ScheduleConfigTypeWithConfig } from '@/shared/types/TemplateTypes'
import type { RGBAColor } from '@/shared/types/VTsuruConfigTypes'
import { defineTemplateConfig } from '@/shared/types/VTsuruConfigTypes'

import { useScheduleWeek } from './scheduleTemplateUtils'
import { ensureGoogleFont } from './scheduleFonts'
import ScheduleWeekToolbar from './ScheduleWeekToolbar.vue'
import { useScheduleTemplateAssets } from './useScheduleTemplateAssets'

ensureGoogleFont('ZCOOL+KuaiLe')

interface PinkyConfig {
  backgroundFile: UploadFileResponse[]
  portraitFile: UploadFileResponse[]
  heading: string
  accentColor: RGBAColor
  showAvatar: boolean
}

const props = defineProps<ScheduleConfigTypeWithConfig<PinkyConfig>>()

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
  { name: '标题', type: 'string', key: 'heading', default: 'SCHEDULE' },
  {
    name: '强调色',
    type: 'color',
    key: 'accentColor',
    default: { r: 219, g: 162, b: 162, a: 1 } as RGBAColor,
    showAlpha: false,
  },
  { name: '未上传立绘时显示头像', type: 'boolean', key: 'showAvatar', default: true },
])

const DefaultConfig: PinkyConfig = {
  backgroundFile: [],
  portraitFile: [],
  heading: 'SCHEDULE',
  accentColor: { r: 219, g: 162, b: 162, a: 1 },
  showAvatar: true,
}

const boardRef = ref<HTMLElement>()
const effectiveConfig = computed(() => ({ ...DefaultConfig, ...props.config }))
const { selectedWeek, days, weekLabel, eventCount } = useScheduleWeek(() => props.data)
const { portraitUrl, backgroundUrl, accentColor } = useScheduleTemplateAssets(props, effectiveConfig)

const boardStyle = computed(() => ({
  '--pinky-accent': accentColor.value,
  backgroundImage: backgroundUrl.value ? `url(${backgroundUrl.value})` : undefined,
}))

defineExpose({ Config, DefaultConfig })
</script>

<template>
  <section class="pinky-template">
    <ScheduleWeekToolbar
      v-model="selectedWeek"
      :weeks="props.data ?? []"
      :capture-target="boardRef"
      :file-name="`粉粉周表_${selectedWeek || '本周'}_${props.userInfo?.name || '主播'}`"
    />

    <div
      ref="boardRef"
      class="pinky-board"
      :class="{ 'has-background': backgroundUrl, 'has-artwork': portraitUrl }"
      :style="boardStyle"
    >
      <header class="pinky-head">
        <h2 class="pinky-head__title">{{ effectiveConfig.heading }}</h2>
        <p class="pinky-head__meta">{{ weekLabel }} · {{ eventCount }} 场直播</p>
      </header>

      <figure
        v-if="portraitUrl"
        class="pinky-art"
      >
        <img
          :src="portraitUrl"
          :alt="`${props.userInfo?.name || '主播'}的形象`"
        />
      </figure>

      <ol class="pinky-days">
        <li
          v-for="day in days"
          :key="day.english"
          class="pinky-day"
          :class="{ 'is-today': day.isToday }"
        >
          <header class="pinky-day__head">
            <span class="pinky-day__week">{{ day.label }}</span>
            <span class="pinky-day__date">{{ day.english }} · {{ day.date }}</span>
            <span
              v-if="day.isToday"
              class="pinky-day__today"
            >
              ♥ 今天
            </span>
          </header>

          <div class="pinky-day__content">
            <div
              v-if="day.items.length"
              class="pinky-day__events"
            >
              <div
                v-for="(item, itemIndex) in day.items"
                :key="item.id || itemIndex"
                class="pinky-event"
                :style="item.tagColor ? { '--event-tag-color': item.tagColor } : undefined"
              >
                <time>{{ item.time || '待定' }}</time>
                <strong>{{ item.title || '未命名直播' }}</strong>
                <span
                  v-if="item.tag"
                  class="pinky-event__tag"
                >
                  {{ item.tag }}
                </span>
              </div>
            </div>
            <span
              v-else
              class="pinky-day__rest"
            >
              休息
            </span>
          </div>
        </li>
      </ol>
    </div>
  </section>
</template>

<style scoped src="./pinkySchedule.css"></style>
