<script setup lang="ts">
import { saveAs } from 'file-saver'
import { computed, ref } from 'vue'

import { useVtsStore } from '@/apps/client/store/useVtsStore'

import { useVtsAction } from './useVtsAction'

const vts = useVtsStore()
const { run } = useVtsAction()
const importing = ref(false)
const showPreview = ref(false)
const pending = ref<{ kind: 'minimal' | 'full'; payload: unknown } | null>(null)

function exportMinimal() {
  run(async () => {
    const json = JSON.stringify(vts.exportMinimalConfig(), null, 2)
    saveAs(new Blob([json], { type: 'application/json;charset=utf-8' }), 'vts_config_min.json')
    try {
      await navigator.clipboard.writeText(json)
    } catch {}
  }, '已导出最小配置')
}

function exportFull() {
  run(async () => {
    const json = JSON.stringify(vts.exportFullConfig(), null, 2)
    saveAs(new Blob([json], { type: 'application/json;charset=utf-8' }), 'vts_config_full.json')
    try {
      await navigator.clipboard.writeText(json)
    } catch {}
  }, '已导出全量配置')
}

async function onImportFileChange(ev: Event) {
  const input = ev.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  run(async () => {
    const parsed = JSON.parse(await file.text())
    pending.value = {
      kind: parsed && typeof parsed === 'object' && parsed.version === 2 ? 'full' : 'minimal',
      payload: parsed,
    }
    showPreview.value = true
  })
}

const previewLines = computed(() => {
  if (!pending.value) return []
  const p = pending.value.payload as any
  if (pending.value.kind === 'minimal') {
    return [`覆盖: wsUrl + token`, `wsUrl: ${p?.wsUrl ?? ''}`, `token: ${p?.authToken ? '有' : '无'}`]
  }
  return [
    '覆盖: 全部 VTS 配置',
    `wsUrl: ${p?.wsUrl ?? ''}`,
    `热键自定义: ${Array.isArray(p?.hotkeyCustomizations) ? p.hotkeyCustomizations.length : '-'}`,
    `预设: ${Array.isArray(p?.presets) ? p.presets.length : '-'}`,
    `宏: ${Array.isArray(p?.macros) ? p.macros.length : '-'}`,
    `参数槽: ${Array.isArray(p?.paramSlots) ? p.paramSlots.length : '-'}`,
  ]
})

async function confirmImport() {
  if (!pending.value) return
  importing.value = true
  await run(async () => {
    if (pending.value!.kind === 'full') {
      await vts.importFullConfig(pending.value!.payload)
    } else {
      await vts.importMinimalConfig(pending.value!.payload)
    }
    showPreview.value = false
    pending.value = null
  }, '导入成功')
  importing.value = false
}

function cancelImport() {
  showPreview.value = false
  pending.value = null
}
</script>

<template>
  <UCard
    size="small"
    bordered
    title="导入 / 导出"
  >
    <div
      align="center"
      :wrap="true"
      :size="8"
    >
      <UButton
        size="small"
        @click="exportMinimal"
      >
        导出连接信息
      </UButton>
      <UButton
        size="small"
        @click="exportFull"
      >
        导出全量配置
      </UButton>
      <UButton
        size="small"
        :loading="importing"
        tag="label"
      >
        导入
        <input
          type="file"
          accept="application/json"
          style="display: none"
          @change="onImportFileChange"
        />
      </UButton>
      <span depth="3"> wsUrl: {{ vts.wsUrl || '未设置' }} </span>
      <span depth="3"> Token: {{ vts.authToken ? '已保存' : '无' }} </span>
    </div>
  </UCard>

  <UModal
    v-model:open="showPreview"
    preset="card"
    title="导入预览"
    style="width: 560px"
  >
    <div
      vertical
      :size="12"
    >
      <span
        v-for="line in previewLines"
        :key="line"
        depth="3"
      >
        {{ line }}
      </span>
      <div
        justify="end"
        :size="8"
      >
        <UButton
          :disabled="importing"
          @click="cancelImport"
        >
          取消
        </UButton>
        <UButton
          color="primary"
          :loading="importing"
          @click="confirmImport"
        >
          确认导入
        </UButton>
      </div>
    </div>
  </UModal>
</template>
