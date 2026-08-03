<script setup lang="ts">
import { computed, ref } from 'vue'

import type { UploadFileResponse, UserFileTypes } from '@/api/api-models'
import { UserFileLocation, UserFileTypes as UserFileTypesEnum } from '@/api/api-models'
import { uploadFiles } from '@/shared/services/fileUpload'
import { showSuccessToast, showErrorToast } from '@/shared/services/toast'
import type { ConfigItemDefinition, RGBAColor, TemplateConfigFileItem } from '@/shared/types/VTsuruConfigTypes'
import { isValidRGBAColor, rgbaToString } from '@/shared/types/VTsuruConfigTypes'

const props = defineProps<{
  config: ConfigItemDefinition[]
  configData: Record<string, any>
}>()

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
      showErrorToast(`最多只能上传 ${limit} 个文件`)
      return
    }
    if (files.length > left) {
      showErrorToast(`最多还能上传 ${left} 个文件`)
      return
    }
  }

  try {
    const type: UserFileTypes | undefined = undefined
    const results = await uploadFiles(files, type ?? UserFileTypesEnum.Other, UserFileLocation.Local)
    const arr = ensureArrayValue(key)
    arr.push(...results)
    showSuccessToast('已上传')
  } catch (err) {
    showErrorToast((err as Error).message || String(err))
  }
}

function removeUploadedFile(key: string, idx: number) {
  const arr = ensureArrayValue(key)
  arr.splice(idx, 1)
}
</script>

<template>
  <UAlert
    color="info"
    icon="i-lucide-info"
    title="此处仅编辑 contrib.config"
    description="配置跟随保存草稿或发布写入 user-pages，不会单独提交到其他接口。"
  />
  <div class="contrib-form">
    <template
      v-for="item in visibleItems"
      :key="item.key"
    >
      <UFormField :label="item.name.toString()">
        <template v-if="item.type === 'string'">
          <UTextarea
            v-if="item.inputType === 'textarea'"
            v-model="configData[item.key]"
            :placeholder="item.placeholder"
          />
          <UInput
            v-else
            v-model="configData[item.key]"
            :placeholder="item.placeholder"
          />
        </template>
        <template v-else-if="item.type === 'number'">
          <UInputNumber
            v-model="configData[item.key]"
            :min="item.min"
            :max="item.max"
            style="width: 100%"
          />
        </template>
        <template v-else-if="item.type === 'sliderNumber'">
          <USlider
            v-model="configData[item.key]"
            :min="item.min"
            :max="item.max"
            style="width: 100%"
          />
        </template>
        <template v-else-if="item.type === 'boolean'">
          <USwitch v-model="configData[item.key]" />
        </template>
        <template v-else-if="item.type === 'select'">
          <USelect
            v-model="configData[item.key]"
            :items="typeof item.options === 'function' ? item.options(configData) : item.options"
            :placeholder="item.placeholder"
          />
        </template>
        <template v-else-if="item.type === 'color'">
          <UColorPicker
            :model-value="safeRgbaString(configData[item.key])"
            @update:model-value="configData[item.key] = toRgba($event)"
          />
        </template>
        <template v-else-if="item.type === 'file'">
          <div class="file-list">
            <div class="file-toolbar">
              <UButton
                size="small"
                @click="triggerUpload(item.key)"
              >
                上传
              </UButton>
              <span class="muted">
                {{ typeof item.fileLimit === 'number' && item.fileLimit > 0 ? `限制 ${item.fileLimit} 个` : '' }}
              </span>
            </div>
            <span
              v-if="ensureArrayValue(item.key).length === 0"
              class="muted"
              >暂无文件</span
            >
            <div
              v-for="(f, idx) in ensureArrayValue(item.key)"
              :key="`${f.id}-${idx}`"
              class="file-row"
            >
              <span>#{{ f.id }}</span>
              <span class="file-path">
                {{ f.path }}
              </span>
              <UButton
                size="xs"
                color="error"
                variant="soft"
                @click="removeUploadedFile(item.key, idx)"
              >
                删除
              </UButton>
            </div>
          </div>
        </template>
        <template v-else>
          <span class="muted">不支持的配置项类型：{{ item.type }}</span>
        </template>
      </UFormField>
    </template>
    <input
      ref="uploadInput"
      type="file"
      style="display: none"
      multiple
      @change="onUploadChange"
    />
  </div>
</template>

<style scoped>
.contrib-form,
.file-list {
  display: grid;
  gap: 12px;
  margin-top: 12px;
}
.file-toolbar,
.file-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.file-path {
  flex: 1;
  overflow-wrap: anywhere;
}
.muted {
  color: var(--vtsuru-fg-muted);
}
</style>
