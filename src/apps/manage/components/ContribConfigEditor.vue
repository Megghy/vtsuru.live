<script setup lang="ts">
import type { UploadFileResponse, UserFileTypes } from '@/api/api-models'
import { UserFileLocation, UserFileTypes as UserFileTypesEnum } from '@/api/api-models'
import type { ConfigItemDefinition, RGBAColor, TemplateConfigFileItem } from '@/shared/types/VTsuruConfigTypes'
import { isValidRGBAColor, rgbaToString } from '@/shared/types/VTsuruConfigTypes'
import { NAlert, NButton, NColorPicker, NForm, NFormItem, NInput, NInputNumber, NSelect, NFlex, NSwitch, NText, useMessage } from 'naive-ui';
import { computed, ref } from 'vue'
import { uploadFiles } from '@/shared/services/fileUpload'

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

  const limit = props.config.find((x): x is TemplateConfigFileItem<any> => x.key === key && x.type === 'file')?.fileLimit
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
    const type: UserFileTypes | undefined = undefined
    const results = await uploadFiles(files, type ?? UserFileTypesEnum.Other, UserFileLocation.Local)
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
  <NAlert type="info" :show-icon="true">
    此处仅编辑 `contrib.config`（跟随“保存草稿/发布”写入 user-pages），不会单独提交到其他配置接口。
  </NAlert>
  <NForm label-placement="top" style="margin-top: 12px">
    <template v-for="item in visibleItems" :key="item.key">
      <NFormItem :label="item.name.toString()">
        <template v-if="item.type === 'string'">
          <NInput
            v-model:value="configData[item.key]"
            :placeholder="item.placeholder"
            :type="item.inputType"
          />
        </template>
        <template v-else-if="item.type === 'number'">
          <NInputNumber
            v-model:value="configData[item.key]"
            :min="item.min"
            :max="item.max"
            style="width: 100%"
          />
        </template>
        <template v-else-if="item.type === 'sliderNumber'">
          <NInputNumber
            v-model:value="configData[item.key]"
            :min="item.min"
            :max="item.max"
            style="width: 100%"
          />
        </template>
        <template v-else-if="item.type === 'boolean'">
          <NSwitch v-model:value="configData[item.key]" />
        </template>
        <template v-else-if="item.type === 'select'">
          <NSelect
            v-model:value="configData[item.key]"
            :options="typeof item.options === 'function' ? item.options(configData) : item.options"
            :placeholder="item.placeholder"
            :clearable="item.clearable"
          />
        </template>
        <template v-else-if="item.type === 'color'">
          <NColorPicker
            :value="safeRgbaString(configData[item.key])"
            :show-alpha="item.showAlpha ?? false"
            @update:value="configData[item.key] = toRgba($event)"
          />
        </template>
        <template v-else-if="item.type === 'file'">
          <NFlex vertical style="width: 100%">
            <NFlex>
              <NButton size="small" @click="triggerUpload(item.key)">
                上传
              </NButton>
              <NText depth="3">
                {{ (typeof item.fileLimit === 'number' && item.fileLimit > 0) ? `限制 ${item.fileLimit} 个` : '' }}
              </NText>
            </NFlex>
            <div v-if="ensureArrayValue(item.key).length === 0">
              <NText depth="3">
                暂无文件
              </NText>
            </div>
            <div
              v-for="(f, idx) in ensureArrayValue(item.key)"
              :key="`${f.id}-${idx}`"
              style="display:flex; gap: 8px; align-items: center"
            >
              <NText>
                #{{ f.id }}
              </NText>
              <NText depth="3" style="flex: 1">
                {{ f.path }}
              </NText>
              <NButton size="tiny" type="error" @click="removeUploadedFile(item.key, idx)">
                删除
              </NButton>
            </div>
          </NFlex>
        </template>
        <template v-else>
          <NText depth="3">
            不支持的配置项类型：{{ item.type }}
          </NText>
        </template>
      </NFormItem>
    </template>
    <input
      ref="uploadInput"
      type="file"
      style="display:none"
      multiple
      @change="onUploadChange"
    >
  </NForm>
</template>
