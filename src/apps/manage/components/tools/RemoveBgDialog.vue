<script setup lang="ts">
import { NButton, NFlex, NModal, NProgress, NSelect, NSwitch, NText } from 'naive-ui'
import { computed, ref, watch } from 'vue'
import { useRemoveBg } from '@/composables/useRemoveBg'

const props = defineProps<{ show: boolean; sourceUrl: string | null }>()
const emit = defineEmits<{ confirm: [blob: Blob]; cancel: [] }>()

const { options, webgpuSupported, progress, processRemoveBg } = useRemoveBg()

const processing = ref(false)
const resultUrl = ref<string | null>(null)
const resultBlob = ref<Blob | null>(null)

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

watch(() => props.show, (v) => {
  if (!v) { cleanup() }
})

function cleanup() {
  if (resultUrl.value) URL.revokeObjectURL(resultUrl.value)
  resultUrl.value = null
  resultBlob.value = null
  processing.value = false
}

async function process() {
  if (!props.sourceUrl) return
  processing.value = true
  cleanup()
  try {
    const resp = await fetch(props.sourceUrl)
    const blob = await resp.blob()
    const result = await processRemoveBg(blob)
    resultBlob.value = result
    resultUrl.value = URL.createObjectURL(result)
  } catch (e: any) {
    useMessage().error(`处理失败: ${e?.message ?? e}`)
  } finally {
    processing.value = false
  }
}

function confirm() {
  if (resultBlob.value) emit('confirm', resultBlob.value)
  resultBlob.value = null
  resultUrl.value = null
}

function cancel() {
  cleanup()
  emit('cancel')
}
</script>

<template>
  <NModal :show="show" preset="card" title="AI 去背景" style="width:680px; max-width:95vw" @close="cancel" @mask-click="cancel">
    <!-- Settings -->
    <div class="settings-row">
      <div class="s-item">
        <NText depth="3" style="font-size:11px">
          模式
        </NText>
        <NSelect v-model:value="options.mode" :options="modeOptions" size="small" />
      </div>
      <div class="s-item">
        <NText depth="3" style="font-size:11px">
          模型
        </NText>
        <NSelect v-model:value="options.model" :options="modelOptions" size="small" />
      </div>
      <div class="s-item">
        <NText depth="3" style="font-size:11px">
          设备
        </NText>
        <NSelect v-model:value="options.device" :options="deviceOptions" size="small" />
      </div>
      <div class="s-item">
        <NText depth="3" style="font-size:11px">
          Worker
        </NText>
        <NSwitch v-model:value="options.proxyToWorker" />
      </div>
    </div>

    <!-- Progress -->
    <NProgress v-if="progress && progress.total" :percentage="progressPercent" status="info" style="margin:8px 0">
      <NText style="font-size:11px">
        {{ progress.key }} {{ progressPercent }}%
      </NText>
    </NProgress>

    <!-- Preview -->
    <div class="preview-area">
      <div class="preview-col">
        <NText depth="3" style="font-size:11px">
          原图
        </NText>
        <img v-if="sourceUrl" :src="sourceUrl" class="preview-img">
      </div>
      <div class="preview-col">
        <NText depth="3" style="font-size:11px">
          结果
        </NText>
        <img v-if="resultUrl" :src="resultUrl" class="preview-img checkerboard">
        <div v-else class="preview-placeholder">
          <NText depth="3" style="font-size:12px">
            {{ processing ? '处理中...' : '点击下方按钮开始' }}
          </NText>
        </div>
      </div>
    </div>

    <!-- Actions -->
    <template #action>
      <NFlex justify="space-between" style="width:100%">
        <NButton size="small" :loading="processing" :disabled="processing || !sourceUrl" @click="process">
          {{ resultUrl ? '重新处理' : '开始处理' }}
        </NButton>
        <NFlex :size="8">
          <NButton size="small" @click="cancel">
            取消
          </NButton>
          <NButton size="small" type="primary" :disabled="!resultBlob" @click="confirm">
            应用替换
          </NButton>
        </NFlex>
      </NFlex>
    </template>
  </NModal>
</template>

<style scoped>
.settings-row {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 10px; margin-bottom: 12px;
}
.s-item { display: flex; flex-direction: column; gap: 4px; }
.preview-area { display: flex; gap: 12px; min-height: 200px; }
.preview-col { flex: 1; display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.preview-img {
  max-width: 100%; max-height: 280px; object-fit: contain;
  border-radius: 6px; border: 1px solid var(--n-border-color);
}
.preview-placeholder {
  flex: 1; display: flex; align-items: center; justify-content: center;
  border: 1px dashed var(--n-border-color); border-radius: 6px; min-height: 120px;
}
.checkerboard {
  background-color: #fafafa;
  background-image: linear-gradient(45deg, #f0f0f0 25%, transparent 25%),
    linear-gradient(-45deg, #f0f0f0 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #f0f0f0 75%),
    linear-gradient(-45deg, transparent 75%, #f0f0f0 75%);
  background-size: 16px 16px;
  background-position: 0 0, 0 8px, 8px -8px, -8px 0;
}
</style>