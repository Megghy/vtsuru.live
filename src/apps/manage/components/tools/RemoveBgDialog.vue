<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import { useRemoveBg } from '@/composables/useRemoveBg'

const props = defineProps<{ show: boolean; sourceUrl: string | null }>()
const emit = defineEmits<{ confirm: [blob: Blob]; cancel: [] }>()

const { options, webgpuSupported, progress, processRemoveBg } = useRemoveBg()

const processing = ref(false)
const resultUrl = ref<string | null>(null)
const resultBlob = ref<Blob | null>(null)
const toast = useToast()
const open = computed({
  get: () => props.show,
  set: (value) => {
    if (!value) cancel()
  },
})

const modeOptions = [
  { label: '去背景', value: 'remove-bg' },
  { label: '去前景', value: 'remove-fg' },
  { label: '生成蒙版', value: 'mask' },
]
const modelOptions = [
  { label: 'quint8 · 最快 (~40MB)', value: 'isnet_quint8' },
  { label: 'fp16 · 均衡 (~80MB)', value: 'isnet_fp16' },
  { label: 'isnet · 最精细 (~170MB)', value: 'isnet' },
]
const deviceOptions = computed(() => [
  { label: 'CPU', value: 'cpu' },
  { label: 'GPU (WebGPU)', value: 'gpu', disabled: !webgpuSupported.value },
])

const progressPercent = computed(() => {
  if (!progress.value?.total) return 0
  return Math.round((progress.value.current / progress.value.total) * 100)
})

watch(
  () => props.show,
  (v) => {
    if (!v) {
      cleanup()
    }
  },
)

function cleanup() {
  if (resultUrl.value) URL.revokeObjectURL(resultUrl.value)
  resultUrl.value = null
  resultBlob.value = null
  processing.value = false
}

async function process() {
  if (!props.sourceUrl) return
  cleanup()
  processing.value = true
  try {
    const resp = await fetch(props.sourceUrl)
    const blob = await resp.blob()
    const result = await processRemoveBg(blob)
    resultBlob.value = result
    resultUrl.value = URL.createObjectURL(result)
  } catch (e: any) {
    toast.add({ title: `处理失败: ${e?.message ?? e}`, color: 'error' })
  } finally {
    processing.value = false
  }
}

function confirm() {
  if (!resultBlob.value) return
  emit('confirm', resultBlob.value)
  cleanup()
}

function cancel() {
  cleanup()
  emit('cancel')
}
</script>

<template>
  <UModal
    v-model:open="open"
    title="AI 去背景"
    :ui="{ content: 'max-w-[95vw] sm:max-w-2xl' }"
  >
    <template #body>
      <div class="settings-row">
        <div class="s-item">
          <span class="s-label">模式</span>
          <USelect
            v-model="options.mode"
            :items="modeOptions"
            size="sm"
          />
        </div>
        <div class="s-item">
          <span class="s-label">模型</span>
          <USelect
            v-model="options.model"
            :items="modelOptions"
            size="sm"
          />
        </div>
        <div class="s-item">
          <span class="s-label">设备</span>
          <USelect
            v-model="options.device"
            :items="deviceOptions"
            size="sm"
          />
        </div>
        <div class="s-item">
          <span class="s-label">Worker</span>
          <USwitch v-model="options.proxyToWorker" />
        </div>
      </div>
      <div
        v-if="progress && progress.total"
        class="remove-bg-dialog__progress"
      >
        <UProgress :model-value="progressPercent" />
        <span>{{ progress.key }} {{ progressPercent }}%</span>
      </div>
      <div class="preview-area">
        <div class="preview-col">
          <span class="s-label">原图</span>
          <img
            v-if="sourceUrl"
            :src="sourceUrl"
            class="preview-img"
          />
        </div>
        <div class="preview-col">
          <span class="s-label">结果</span>
          <img
            v-if="resultUrl"
            :src="resultUrl"
            class="preview-img manage-checkerboard"
          />
          <div
            v-else
            class="preview-placeholder"
          >
            <span>{{ processing ? '处理中...' : '点击下方按钮开始' }}</span>
          </div>
        </div>
      </div>
    </template>
    <template #footer>
      <div class="remove-bg-dialog__footer">
        <UButton
          size="sm"
          :loading="processing"
          :disabled="processing || !sourceUrl"
          @click="process"
        >
          {{ resultUrl ? '重新处理' : '开始处理' }}
        </UButton>
        <div class="remove-bg-dialog__footer-actions">
          <UButton
            size="sm"
            color="neutral"
            variant="outline"
            label="取消"
            @click="cancel"
          />
          <UButton
            size="sm"
            color="primary"
            label="应用替换"
            :disabled="!resultBlob"
            @click="confirm"
          />
        </div>
      </div>
    </template>
  </UModal>
</template>

<style scoped>
.settings-row {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 10px;
  margin-bottom: 12px;
}
.s-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.s-label,
.remove-bg-dialog__progress,
.preview-placeholder {
  color: var(--vtsuru-fg-muted);
  font-size: 12px;
}
.remove-bg-dialog__progress {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin: 8px 0;
}
.preview-area {
  display: flex;
  gap: 12px;
  min-height: 200px;
}
.preview-col {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}
.preview-img {
  max-width: 100%;
  max-height: 280px;
  object-fit: contain;
  border-radius: 6px;
  border: 1px solid var(--vtsuru-border);
}
.preview-placeholder {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px dashed var(--vtsuru-border);
  border-radius: 6px;
  min-height: 120px;
}
.remove-bg-dialog__footer,
.remove-bg-dialog__footer-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}
.remove-bg-dialog__footer {
  justify-content: space-between;
}
</style>
