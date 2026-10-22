<script setup lang="ts">
import { computed, ref } from 'vue'

import type { UploadFileResponse } from '@/api/api-models'
import { FileStore, uploadFiles } from '@/shared/services/fileUpload'
import type { ConfigItemDefinition, RGBAColor, TemplateConfigFileItem } from '@/shared/types/VTsuruConfigTypes'
import { isValidRGBAColor, rgbaToString } from '@/shared/types/VTsuruConfigTypes'
import { Alert, AlertDescription } from '@/shared/ui/alert'
import { Button } from '@/shared/ui/button'
import { ColorPicker } from '@/shared/ui/color-picker'
import { Input } from '@/shared/ui/input'
import { NumberField } from '@/shared/ui/number-field'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Switch } from '@/shared/ui/switch'
import { useMessage } from '@/shared/utils'

const props = defineProps<{
  config: ConfigItemDefinition[]
  configData: Record<string, any>
}>()

const message = useMessage()

const uploadInput = ref<HTMLInputElement | null>(null)
const pendingUploadKey = ref<string | null>(null)

const visibleItems = computed(() => {
  return props.config.filter((item) => {
    if (!item.visibleWhen) return true
    try {
      return item.visibleWhen(props.configData)
    } catch (e) {
      console.error(e)
      return true
    }
  })
})

function ensureArrayValue(key: string): UploadFileResponse[] {
  const v = props.configData[key]
  if (Array.isArray(v)) return v
  props.configData[key] = []
  return props.configData[key]
}

function toRgba(color: string | null | undefined): RGBAColor {
  const fallback: RGBAColor = { r: 0, g: 0, b: 0, a: 1 }
  if (!color) return fallback

  const rgbaMatch = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/)
  if (rgbaMatch) {
    return {
      r: Number.parseInt(rgbaMatch[1], 10),
      g: Number.parseInt(rgbaMatch[2], 10),
      b: Number.parseInt(rgbaMatch[3], 10),
      a: rgbaMatch[4] !== undefined ? Number.parseFloat(rgbaMatch[4]) : 1,
    }
  }
  return fallback
}

function safeRgbaString(v: unknown): string {
  if (isValidRGBAColor(v)) return rgbaToString(v)
  if (typeof v === 'string') return v
  return rgbaToString({ r: 0, g: 0, b: 0, a: 0 })
}

function triggerUpload(key: string) {
  pendingUploadKey.value = key
  uploadInput.value?.click()
}

async function onUploadChange(e: Event) {
  const input = e.target as HTMLInputElement
  const files = input.files ? Array.from(input.files) : []
  input.value = ''
  const key = pendingUploadKey.value
  pendingUploadKey.value = null
  if (!key) return
  if (!files.length) return

  const limit = props.config.find(
    (x): x is TemplateConfigFileItem<any> => x.key === key && x.type === 'file',
  )?.fileLimit
  if (typeof limit === 'number' && limit > 0) {
    const existing = ensureArrayValue(key)
    const left = limit - existing.length
    if (left <= 0) {
      message.error(`最多只能上传 ${limit} 个文件`)
      return
    }
    if (files.length > left) {
      message.error(`最多还能上传 ${left} 个文件`)
      return
    }
  }

  try {
    const results = await uploadFiles(files, FileStore.Configs)
    const arr = ensureArrayValue(key)
    arr.push(...results)
    message.success('已上传')
  } catch (err) {
    message.error((err as Error).message || String(err))
  }
}

function removeUploadedFile(key: string, idx: number) {
  const arr = ensureArrayValue(key)
  arr.splice(idx, 1)
}
</script>

<template>
  <Alert class="text-xs">
    <AlertDescription>
      此处仅编辑 <code>contrib.config</code>（跟随“保存草稿/发布”写入 user-pages），不会单独提交到其他配置接口。
    </AlertDescription>
  </Alert>

  <div class="space-y-4 mt-3 text-xs">
    <div
      v-for="item in visibleItems"
      :key="item.key"
      class="space-y-1.5"
    >
      <label class="text-xs font-medium text-foreground block">{{ item.name }}</label>

      <template v-if="item.type === 'string'">
        <Input
          v-model="configData[item.key]"
          :placeholder="item.placeholder"
          :type="item.inputType || 'text'"
        />
      </template>

      <template v-else-if="item.type === 'number' || item.type === 'sliderNumber'">
        <NumberField
          v-model="configData[item.key]"
          :min="item.min"
          :max="item.max"
        />
      </template>

      <template v-else-if="item.type === 'boolean'">
        <Switch v-model:checked="configData[item.key]" />
      </template>

      <template v-else-if="item.type === 'select'">
        <Select v-model="configData[item.key]">
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem
              v-for="opt in typeof item.options === 'function' ? item.options(configData) : item.options"
              :key="opt.value"
              :value="opt.value"
            >
              {{ opt.label }}
            </SelectItem>
          </SelectContent>
        </Select>
      </template>

      <template v-else-if="item.type === 'color'">
        <ColorPicker
          :model-value="safeRgbaString(configData[item.key])"
          @update:model-value="configData[item.key] = toRgba($event)"
        />
      </template>

      <template v-else-if="item.type === 'file'">
        <div class="space-y-2">
          <div class="flex items-center gap-2">
            <Button
              variant="outline"
              @click="triggerUpload(item.key)"
            >
              上传
            </Button>
            <span class="text-xs text-muted-foreground">
              {{ typeof item.fileLimit === 'number' && item.fileLimit > 0 ? `限制 ${item.fileLimit} 个` : '' }}
            </span>
          </div>

          <div
            v-if="ensureArrayValue(item.key).length === 0"
            class="text-xs text-muted-foreground"
          >
            暂无文件
          </div>

          <div
            v-for="(f, idx) in ensureArrayValue(item.key)"
            :key="`${f.id}-${idx}`"
            class="flex items-center gap-2 p-1.5 rounded border border-border bg-card text-xs"
          >
            <span class="font-mono text-muted-foreground">#{{ f.id }}</span>
            <span class="flex-1 truncate text-foreground">{{ f.path }}</span>
            <Button
              size="xs"
              variant="destructive"
              @click="removeUploadedFile(item.key, idx)"
            >
              删除
            </Button>
          </div>
        </div>
      </template>

      <template v-else>
        <span class="text-xs text-muted-foreground">不支持的配置项类型：{{ item.type }}</span>
      </template>
    </div>

    <input
      ref="uploadInput"
      type="file"
      style="display: none"
      multiple
      @change="onUploadChange"
    />
  </div>
</template>
