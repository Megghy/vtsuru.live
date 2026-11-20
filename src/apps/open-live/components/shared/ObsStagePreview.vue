<script setup lang="ts">
import Color24Regular from '@vicons/fluent/es/Color24Regular'
import Copy24Regular from '@vicons/fluent/es/Copy24Regular'
import Eye24Regular from '@vicons/fluent/es/Eye24Regular'
import { computed, ref } from 'vue'

import { CURRENT_HOST } from '@/shared/config'
import { buildObsSourceUrl } from '@/shared/obs/obsUrl'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { Separator } from '@/shared/ui/separator'
import { SettingRow } from '@/shared/ui/setting-row'
import { ToggleGroup, ToggleGroupItem } from '@/shared/ui/toggle-group'
import { copyToClipboard, useMessage } from '@/shared/utils'

export type ObsStageStyleType = 'glass' | 'transparent' | 'classic' | 'fresh' | 'minimal'
export type ObsStagePreviewBg = 'checker' | 'dark' | 'light' | 'game'

const props = withDefaults(
  defineProps<{
    title?: string
    obsPath: string
    userId?: number
    credential?: 'public-id' | 'token' | 'none'
    token?: string
    recommendedSize?: string
    defaultStyle?: ObsStageStyleType
    copySuccessMessage?: string
  }>(),
  {
    title: 'OBS 画布实时预览 (1080P 比例视口)',
    credential: 'public-id',
    recommendedSize: '推荐 OBS 来源尺寸：宽 380px ~ 440px，高 540px ~ 680px。',
    defaultStyle: 'glass',
    copySuccessMessage: 'OBS 源链接已复制 (已携带当前样式参数)',
  },
)

const message = useMessage()

const obsStyleType = ref<ObsStageStyleType>(props.defaultStyle)
const obsScrollSpeed = ref(1.0)
const previewBg = ref<ObsStagePreviewBg>('checker')

const stylePresets: { key: ObsStageStyleType; label: string }[] = [
  { key: 'glass', label: '毛玻璃质感 (Modern Glass)' },
  { key: 'transparent', label: '纯透明无底壳 (Transparent)' },
  { key: 'minimal', label: '极简通透流 (Minimal Text)' },
  { key: 'classic', label: '经典卡片 (Classic Dark)' },
  { key: 'fresh', label: '清新自然 (Fresh Light)' },
]

const bgOptions: { key: ObsStagePreviewBg; label: string }[] = [
  { key: 'checker', label: '网格' },
  { key: 'dark', label: '纯黑' },
  { key: 'light', label: '浅色' },
  { key: 'game', label: '模拟游戏' },
]

const obsUrl = computed(() => {
  const params: Record<string, string> = {
    style: obsStyleType.value,
  }
  if (obsScrollSpeed.value !== 1.0) {
    params.speed = obsScrollSpeed.value.toString()
  }
  return buildObsSourceUrl({
    path: props.obsPath,
    host: CURRENT_HOST,
    credential: props.credential,
    userId: props.userId,
    token: props.token,
    params,
  })
})

async function copyObsLink() {
  if (!obsUrl.value) {
    message.warning('尚未登录或未生成有效链接')
    return
  }
  await copyToClipboard(obsUrl.value, props.copySuccessMessage)
}
</script>

<template>
  <div class="grid grid-cols-1 lg:grid-cols-12 gap-4">
    <!-- 舞台视口 (8 列) -->
    <Card class="lg:col-span-8 flex flex-col">
      <CardHeader class="p-3.5">
        <div class="flex-between gap-3 flex-wrap">
          <div class="flex items-center gap-2">
            <Eye24Regular class="size-4 text-muted-foreground" />
            <CardTitle class="text-sm">{{ title }}</CardTitle>
          </div>

          <div class="flex items-center gap-2 flex-wrap">
            <slot name="toolbar" />
            <ToggleGroup
              v-model="previewBg"
              type="single"
              size="xs"
            >
              <ToggleGroupItem
                v-for="bg in bgOptions"
                :key="bg.key"
                :value="bg.key"
              >
                {{ bg.label }}
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
        </div>
      </CardHeader>

      <CardContent class="p-4 flex-1 flex flex-col justify-between gap-4">
        <div
          class="rounded-lg border border-border p-6 flex-center min-h-[460px] transition-colors"
          :class="{
            'bg-[#121214]': previewBg === 'dark',
            'bg-[#f4f4f5]': previewBg === 'light',
            'bg-[#0b132b]': previewBg === 'game',
            'bg-[repeating-conic-gradient(#80808015_0%_25%,transparent_0%_50%)] bg-[length:16px_16px]':
              previewBg === 'checker',
          }"
        >
          <div class="w-[380px] max-w-full">
            <slot
              :style-type="obsStyleType"
              :speed-multiplier="obsScrollSpeed"
              :preview-bg="previewBg"
            />
          </div>
        </div>

        <div class="flex-between gap-3 flex-wrap pt-2 border-t border-border/60">
          <span class="text-xs text-muted-foreground">{{ recommendedSize }}</span>
          <Button
            variant="default"
            @click="copyObsLink"
          >
            <Copy24Regular class="size-4 mr-1" />
            复制当前样式 OBS 链接
          </Button>
        </div>
      </CardContent>
    </Card>

    <!-- 视觉预设与拓展控制 (4 列) -->
    <div class="lg:col-span-4 space-y-4">
      <Card>
        <CardHeader class="p-3.5">
          <div class="flex items-center gap-2">
            <Color24Regular class="size-4 text-muted-foreground" />
            <CardTitle class="text-sm">OBS 视觉预设</CardTitle>
          </div>
        </CardHeader>

        <CardContent class="space-y-3.5">
          <div class="grid grid-cols-1 gap-1.5">
            <Button
              v-for="preset in stylePresets"
              :key="preset.key"
              :variant="obsStyleType === preset.key ? 'default' : 'outline'"
              class="w-full justify-start font-normal"
              @click="obsStyleType = preset.key"
            >
              {{ preset.label }}
            </Button>
          </div>

          <Separator />

          <SettingRow
            v-model="obsScrollSpeed"
            type="number"
            variant="none"
            title="滚动轮播速度"
            :min="0.5"
            :max="3"
            :step="0.2"
            control-class="w-20 font-mono"
          />
        </CardContent>
      </Card>

      <slot name="extra" />
    </div>
  </div>
</template>
