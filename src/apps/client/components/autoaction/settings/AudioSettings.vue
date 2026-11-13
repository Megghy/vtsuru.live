<script setup lang="ts">
import FolderOpen16Regular from '@vicons/fluent/es/FolderOpen16Regular'
import MusicNote224Regular from '@vicons/fluent/es/MusicNote224Regular'
import Play16Regular from '@vicons/fluent/es/Play16Regular'
import { computed, ref } from 'vue'
import { toast } from 'vue-sonner'

import type { AutoActionItem } from '@/apps/client/store/autoAction/types'
import { executePlayAudio } from '@/apps/client/store/autoAction/modules/audioPlayer'
import { isTauri } from '@/shared/config'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { FormField } from '@/shared/ui/form-field'
import { Input } from '@/shared/ui/input'
import { NumberField } from '@/shared/ui/number-field'
import { SettingRow } from '@/shared/ui/setting-row'

const props = defineProps<{
  action: AutoActionItem
}>()

const playing = ref(false)
const volumePercent = computed({
  get: () => Math.round((props.action.actionConfig.audioVolume ?? 0.8) * 100),
  set: (v: number | undefined) => {
    const clamped = Math.min(100, Math.max(0, Number(v ?? 80)))
    props.action.actionConfig.audioVolume = Number((clamped / 100).toFixed(2))
  },
})

async function pickLocalAudio() {
  if (!isTauri()) {
    toast.info('网页端请直接填写音频 URL，本地文件选择仅在客户端可用')
    return
  }
  try {
    const { open } = await import('@tauri-apps/plugin-dialog')
    const selected = await open({
      multiple: false,
      title: '选择音效文件',
      filters: [
        {
          name: '音频文件',
          extensions: ['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a', 'webm'],
        },
      ],
    })
    if (typeof selected === 'string' && selected.trim()) {
      props.action.actionConfig.audioSource = selected
    }
  } catch (err) {
    toast.error(`选择文件失败: ${err instanceof Error ? err.message : String(err)}`)
  }
}

async function testPlayAudio() {
  if (playing.value) return
  playing.value = true
  try {
    await executePlayAudio(props.action)
    toast.success('试听完成')
  } catch (err) {
    toast.error(err instanceof Error ? err.message : String(err))
  } finally {
    playing.value = false
  }
}
</script>

<template>
  <Card>
    <CardHeader class="p-3 border-b flex-between flex-row">
      <div class="flex items-center gap-2">
        <MusicNote224Regular class="size-4 text-primary" />
        <CardTitle>播放音效（无需连接 VTS）</CardTitle>
      </div>
      <Button
        variant="secondary"
        size="xs"
        class="gap-1"
        :disabled="playing || !action.actionConfig.audioSource?.trim()"
        @click="testPlayAudio"
      >
        <Play16Regular class="size-3.5" />
        试听
      </Button>
    </CardHeader>
    <CardContent class="p-3 space-y-3">
      <FormField label="音频路径或 URL">
        <div class="flex items-center gap-2">
          <Input
            v-model="action.actionConfig.audioSource"
            placeholder="输入音频 https:// URL 或本地文件路径"
            class="flex-1"
          />
          <Button
            v-if="isTauri()"
            variant="outline"
            class="gap-1 shrink-0"
            @click="pickLocalAudio"
          >
            <FolderOpen16Regular class="size-4" />
            选择文件
          </Button>
        </div>
      </FormField>

      <SettingRow
        variant="compact"
        title="音量 (%)"
        hint="0 - 100，默认 80%"
      >
        <NumberField
          v-model="volumePercent"
          :min="0"
          :max="100"
          :step="5"
          class="w-28"
        />
      </SettingRow>

      <SettingRow
        type="switch"
        variant="compact"
        title="等待播放完毕"
        hint="开启后在记录完成状态前等待音频播放结束"
        v-model="action.actionConfig.audioWaitForEnd"
      />
    </CardContent>
  </Card>
</template>
