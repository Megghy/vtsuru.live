<script setup lang="ts">
import { NButton, NInput, NInputGroup, NPopconfirm, NText, useMessage } from 'naive-ui'
import { onScopeDispose, ref, watch } from 'vue'

import { uploadPngtuberAsset } from '@/api/pngtuber-assets'
const props = defineProps<{ value: string; label: string; disabled?: boolean }>()
const emit = defineEmits<{ change: [value: string] }>()
const message = useMessage()
const url = ref(props.value),
  busy = ref(false),
  dragging = ref(false)
const input = ref<HTMLInputElement>()
let disposed = false
onScopeDispose(() => {
  disposed = true
})
watch(
  () => props.value,
  (value) => {
    url.value = value
  },
)
async function upload(file?: File) {
  if (!file || props.disabled || busy.value) return
  busy.value = true
  try {
    const asset = await uploadPngtuberAsset(file)
    if (!disposed && !props.disabled) emit('change', asset.url)
  } catch (error) {
    message.error(error instanceof Error ? error.message : String(error))
  } finally {
    busy.value = false
  }
}
function choose(event: Event) {
  const target = event.target as HTMLInputElement
  void upload(target.files?.[0])
  target.value = ''
}
function drop(event: DragEvent) {
  dragging.value = false
  void upload(event.dataTransfer?.files[0])
}
function apply() {
  if (props.disabled) return
  try {
    const next = new URL(url.value.trim())
    if (!['https:', 'http:'].includes(next.protocol)) throw new Error()
    emit('change', next.href)
  } catch {
    message.error('请输入有效的 HTTP(S) 图片地址')
  }
}
</script>
<template>
  <div
    class="image-slot"
    :class="{ dragging: dragging && !disabled }"
    @dragover.prevent="dragging = true"
    @dragleave="dragging = false"
    @drop.prevent="drop"
  >
    <div class="slot-heading">
      <span>{{ label }}</span
      ><NPopconfirm
        v-if="value"
        :disabled="disabled || busy"
        @positive-click="emit('change', '')"
        ><template #trigger
          ><NButton
            text
            size="tiny"
            type="error"
            :disabled="disabled || busy"
            >清除</NButton
          ></template
        >清除此图片引用？</NPopconfirm
      >
    </div>
    <button
      class="image-preview"
      :disabled="disabled || busy"
      :aria-label="`上传${label}`"
      @click="input?.click()"
    >
      <img
        v-if="value"
        :src="value"
        :alt="label"
      /><span v-else>拖放或选择图片</span>
    </button>
    <input
      ref="input"
      hidden
      type="file"
      accept="image/png,image/apng,image/gif,image/webp"
      :disabled="disabled || busy"
      @change="choose"
    />
    <NButton
      block
      size="tiny"
      :loading="busy"
      :disabled="disabled"
      @click="input?.click()"
      >{{ value ? '更换图片' : '上传图片' }}</NButton
    >
    <NInputGroup
      ><NInput
        v-model:value="url"
        size="tiny"
        placeholder="HTTP(S) 图片外链"
        :disabled="disabled || busy"
        @keyup.enter="apply"
      /><NButton
        size="tiny"
        :disabled="disabled || busy || !url.trim()"
        @click="apply"
        >应用</NButton
      ></NInputGroup
    >
    <NText
      depth="3"
      style="font-size: 11px"
      >PNG / APNG / GIF / WebP，最多 16 MB</NText
    >
  </div>
</template>
<style scoped>
.image-slot {
  display: grid;
  gap: 8px;
  padding: 10px;
  border: 1px solid var(--vtsuru-border);
  border-radius: 8px;
  min-width: 0;
}
.dragging {
  background: var(--vtsuru-brand-soft);
}
.slot-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.image-preview {
  border: 0;
  border-radius: 4px;
  background: var(--vtsuru-bg-muted);
  color: var(--vtsuru-fg-muted);
  height: 100px;
  cursor: pointer;
}
.image-preview img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
</style>
