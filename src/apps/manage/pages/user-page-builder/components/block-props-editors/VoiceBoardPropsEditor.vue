<script setup lang="ts">
import { Music } from 'lucide-vue-next'

import type { BlockNode } from '@/apps/user-page/block/schema'
import { Button } from '@/shared/ui/button'
import { ColorPicker } from '@/shared/ui/color-picker'
import { FormField } from '@/shared/ui/form-field'
import { Input } from '@/shared/ui/input'
import { NumberField } from '@/shared/ui/number-field'
import { SettingRow } from '@/shared/ui/setting-row'
import { Switch } from '@/shared/ui/switch'

import PropsGrid from '../PropsGrid.vue'
import RepeaterEditor from '../RepeaterEditor.vue'
import { useBlockPropsEditor } from './useBlockPropsEditor'

const props = defineProps<{ block: BlockNode }>()
const { editor, blockProps, arrayProp } = useBlockPropsEditor(() => props.block)
const voiceItems = arrayProp<Record<string, any>>('items')

const audioUrlPlaceholder = 'https://...'

function clearAudioFile(target: Record<string, any>) {
  delete target.audioFile
}

function uploadVoiceAudio(index: number) {
  editor.triggerUploadTargetAudio(() => voiceItems.value[index], 'audioFile')
}
</script>

<template>
  <PropsGrid>
    <FormField label="区块标题">
      <Input
        v-model="blockProps.title"
        maxlength="60"
        placeholder="语音按钮"
      />
    </FormField>
    <FormField label="每行列数">
      <NumberField
        :model-value="typeof blockProps.columns === 'number' ? blockProps.columns : 3"
        :min="1"
        :max="4"
        class="w-full"
        @update:model-value="blockProps.columns = $event"
      />
    </FormField>
    <FormField
      label="简介说明"
      class="span-full"
    >
      <Input
        v-model="blockProps.description"
        maxlength="200"
        placeholder="点击即可试听语音片段"
      />
    </FormField>
    <SettingRow
      title="允许同时叠加播放（鬼畜模式）"
      variant="none"
      class="span-full py-1"
    >
      <Switch
        :checked="blockProps.allowOverlap === true"
        @update:checked="blockProps.allowOverlap = $event"
      />
    </SettingRow>
    <FormField
      label="语音按钮列表（最多 24 个）"
      class="span-full"
    >
      <RepeaterEditor
        :items="voiceItems"
        :create-item="() => ({ label: '早安呀', subtitle: '', tag: '', audioUrl: '', color: '' })"
        add-text="添加语音"
      >
        <template #title="{ item, index }">
          {{ item.label || `语音 ${index + 1}` }}
        </template>
        <template #default="{ item, index }">
          <PropsGrid>
            <FormField label="按钮名称">
              <Input
                v-model="item.label"
                maxlength="40"
              />
            </FormField>
            <FormField label="小标签（可选）">
              <Input
                v-model="item.tag"
                maxlength="24"
                placeholder="如：招牌 / 撒娇"
              />
            </FormField>
            <FormField
              label="副标题（可选）"
              class="span-full"
            >
              <Input
                v-model="item.subtitle"
                maxlength="60"
                placeholder="台词预览..."
              />
            </FormField>
            <FormField
              label="上传音频（MP3/WAV/OGG/M4A ≤ 10MB）"
              class="span-full"
            >
              <div class="flex items-center gap-2">
                <Button
                  variant="outline"
                  class="gap-1.5"
                  :disabled="editor.isUploading.value"
                  @click="uploadVoiceAudio(index)"
                >
                  <Music class="size-3.5" />
                  上传音频
                </Button>
                <Button
                  variant="ghost"
                  :disabled="!item.audioFile"
                  @click="clearAudioFile(item)"
                >
                  清除
                </Button>
                <span class="text-xs text-muted-foreground truncate">
                  {{ item.audioFile?.name || '' }}
                </span>
              </div>
            </FormField>
            <FormField
              label="或外部音频链接 (HTTPS)"
              class="span-full"
            >
              <Input
                v-model="item.audioUrl"
                :placeholder="audioUrlPlaceholder"
              />
            </FormField>
            <FormField
              label="按钮点缀色（可选）"
              class="span-full"
            >
              <div class="flex items-center gap-2">
                <ColorPicker
                  v-model="item.color"
                  :show-alpha="false"
                />
                <Button
                  v-if="item.color"
                  variant="ghost"
                  size="xs"
                  @click="item.color = ''"
                >
                  清空
                </Button>
              </div>
            </FormField>
          </PropsGrid>
        </template>
      </RepeaterEditor>
    </FormField>
  </PropsGrid>
</template>
