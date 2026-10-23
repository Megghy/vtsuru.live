<script setup lang="ts">
import { Info24Filled } from '@vicons/fluent'
import { ref } from 'vue'

import type { ResponseSongModel, SongRequestOption } from '@/api/generated/model'
import { SongPlatform } from '@/api/generated/model'
import { Button } from '@/shared/ui/button'
import { Checkbox } from '@/shared/ui/checkbox'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { Input } from '@/shared/ui/input'
import { NumberField } from '@/shared/ui/number-field'
import { Textarea } from '@/shared/ui/textarea'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/ui/tooltip'
import { toast } from '@/shared/utils'

interface OptionItem {
  label: string
  value: string
}

defineProps<{
  languageOptions: OptionItem[]
  tagOptions: OptionItem[]
  authorOptions: OptionItem[]
}>()

const emit = defineEmits<{
  (e: 'save', song: ResponseSongModel): void
}>()

const show = ref(false)
const model = ref<ResponseSongModel>({} as ResponseSongModel)
const loading = ref(false)
const authorText = ref('')
const languageText = ref('')
const tagText = ref('')

function open(song: ResponseSongModel) {
  model.value = JSON.parse(JSON.stringify(song))
  authorText.value = (model.value.author ?? []).join(', ')
  languageText.value = (model.value.language ?? []).join(', ')
  tagText.value = (model.value.tags ?? []).join(', ')
  show.value = true
}

function parseTags(text: string): string[] {
  return text
    .split(/[,，\s]+/)
    .map((s) => s.trim())
    .filter(Boolean)
}

function handleSave() {
  if (!model.value.name?.trim()) {
    toast.error('请输入歌曲名称')
    return
  }
  model.value.author = parseTags(authorText.value)
  model.value.language = parseTags(languageText.value)
  model.value.tags = parseTags(tagText.value)

  loading.value = true
  emit('save', model.value)
}

function close() {
  show.value = false
  loading.value = false
}

defineExpose({ open, close, loading })
</script>

<template>
  <TooltipProvider>
    <Dialog v-model:open="show">
      <DialogContent class="sm:max-w-xl max-h-[88vh] overflow-y-auto p-4 space-y-3">
        <DialogHeader class="pb-2 border-b border-border/60">
          <DialogTitle class="text-sm font-semibold">修改歌曲 - {{ model.name || '' }}</DialogTitle>
        </DialogHeader>

        <div class="space-y-3 text-xs">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div class="space-y-1">
              <label class="font-medium text-foreground">歌曲名称 *</label>
              <Input
                v-model="model.name"
                placeholder="请输入歌曲名称"
              />
            </div>

            <div class="space-y-1">
              <label class="font-medium text-foreground">翻译 / 别名</label>
              <Input
                v-model="model.translateName"
                placeholder="可选翻译或别名"
              />
            </div>

            <div class="space-y-1">
              <label class="font-medium text-foreground">作者 (多个用逗号隔开)</label>
              <Input
                v-model="authorText"
                placeholder="例如: 周杰伦, 方文山"
              />
            </div>

            <div class="space-y-1">
              <label class="font-medium text-foreground">语言 (多个用逗号隔开)</label>
              <Input
                v-model="languageText"
                placeholder="例如: 中文, 日语"
              />
            </div>

            <div class="space-y-1">
              <label class="font-medium text-foreground">标签 (多个用逗号隔开)</label>
              <Input
                v-model="tagText"
                placeholder="例如: 流行, 治愈"
              />
            </div>

            <div class="space-y-1">
              <label class="font-medium text-foreground">试听 / 伴奏链接</label>
              <Input
                v-model="model.url"
                placeholder="音频直链"
                :disabled="model.from !== SongPlatform.Custom"
              />
            </div>
          </div>

          <div class="space-y-1">
            <label class="font-medium text-foreground">备注说明</label>
            <Textarea
              v-model="model.description"
              rows="2"
              maxlength="250"
              placeholder="可选备注说明"
              class="text-xs resize-none"
            />
          </div>

          <!-- 独立点歌门槛 -->
          <div class="space-y-2 pt-1 border-t border-border/60">
            <div class="flex items-center gap-1.5">
              <label class="flex items-center gap-1.5 cursor-pointer font-medium text-foreground">
                <Checkbox
                  :checked="model.options != null"
                  @update:checked="
                    (v: boolean) =>
                      (model.options = v
                        ? ({ needJianzhang: false, needTidu: false, needZongdu: false } as SongRequestOption)
                        : undefined)
                  "
                />
                <span>为本首歌曲单独设置点歌门槛</span>
              </label>
              <Tooltip>
                <TooltipTrigger as-child>
                  <component
                    :is="Info24Filled"
                    class="size-3.5 text-muted-foreground cursor-help"
                  />
                </TooltipTrigger>
                <TooltipContent>启用后将覆盖全局点歌设置，用于单独设置歌曲要求</TooltipContent>
              </Tooltip>
            </div>

            <div
              v-if="model.options"
              class="p-2.5 rounded-lg bg-muted/40 border border-border/60 space-y-2.5"
            >
              <div class="flex items-center gap-4">
                <label class="flex items-center gap-1 cursor-pointer">
                  <Checkbox v-model:checked="model.options.needJianzhang" />
                  <span>舰长</span>
                </label>
                <label class="flex items-center gap-1 cursor-pointer">
                  <Checkbox v-model:checked="model.options.needTidu" />
                  <span>提督</span>
                </label>
                <label class="flex items-center gap-1 cursor-pointer">
                  <Checkbox v-model:checked="model.options.needZongdu" />
                  <span>总督</span>
                </label>
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div class="flex items-center gap-1.5">
                  <label class="flex items-center gap-1 cursor-pointer">
                    <Checkbox
                      :checked="model.options.scMinPrice != null"
                      @update:checked="(v: boolean) => (model.options!.scMinPrice = v ? 30 : undefined)"
                    />
                    <span>SC ≥</span>
                  </label>
                  <NumberField
                    v-if="model.options.scMinPrice != null"
                    v-model="model.options.scMinPrice"
                    :min="1"
                    class="w-20"
                  />
                  <span v-if="model.options.scMinPrice != null">元</span>
                </div>

                <div class="flex items-center gap-1.5">
                  <label class="flex items-center gap-1 cursor-pointer">
                    <Checkbox
                      :checked="model.options.fanMedalMinLevel != null"
                      @update:checked="(v: boolean) => (model.options!.fanMedalMinLevel = v ? 1 : undefined)"
                    />
                    <span>粉丝牌 ≥</span>
                  </label>
                  <NumberField
                    v-if="model.options.fanMedalMinLevel != null"
                    v-model="model.options.fanMedalMinLevel"
                    :min="1"
                    class="w-20"
                  />
                  <span v-if="model.options.fanMedalMinLevel != null">级</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter class="pt-2 border-t border-border/60 flex items-center justify-end gap-2">
          <Button
            variant="outline"
            @click="show = false"
          >
            取消
          </Button>
          <Button
            :disabled="loading"
            @click="handleSave"
          >
            确认保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </TooltipProvider>
</template>
