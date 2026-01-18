<script setup lang="ts">
import { saveAs } from 'file-saver'
import { NButton, NCard, NFlex, NModal, NText, useMessage } from 'naive-ui';
import { computed, ref } from 'vue'
import { useVtsStore } from '@/apps/client/store/useVtsStore'

const vts = useVtsStore()
const message = useMessage()
const importing = ref(false)
const showPreview = ref(false)
const pending = ref<{ kind: 'minimal', payload: unknown } | { kind: 'full', payload: unknown } | null>(null)

async function exportMinimal() {
  const json = JSON.stringify(vts.exportMinimalConfig(), null, 2)
  saveAs(new Blob([json], { type: 'application/json;charset=utf-8' }), 'vtsuru_vts_config_min.json')
  try {
    await navigator.clipboard.writeText(json)
    message.success('已导出最小配置，并复制到剪贴板')
  } catch {
    message.success('已导出最小配置（剪贴板复制失败）')
  }
}

async function exportFull() {
  const json = JSON.stringify(vts.exportFullConfig(), null, 2)
  saveAs(new Blob([json], { type: 'application/json;charset=utf-8' }), 'vtsuru_vts_config_full.json')
  try {
    await navigator.clipboard.writeText(json)
    message.success('已导出全量配置，并复制到剪贴板')
  } catch {
    message.success('已导出全量配置（剪贴板复制失败）')
  }
}

async function onImportFileChange(ev: Event) {
  const input = ev.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return

  try {
    const text = await file.text()
    const parsed = JSON.parse(text) as unknown
    if (parsed && typeof parsed === 'object' && (parsed as any).version === 2) {
      pending.value = { kind: 'full', payload: parsed }
    } else {
      pending.value = { kind: 'minimal', payload: parsed }
    }
    showPreview.value = true
  } catch (err) {
    message.error(err instanceof Error ? err.message : String(err))
  }
}

const previewLines = computed(() => {
  if (!pending.value) return []
  if (pending.value.kind === 'minimal') {
    const p = pending.value.payload as any
    return [
      '将覆盖：wsUrl、authenticationToken',
      `wsUrl: ${String(p?.wsUrl ?? '')}`,
      `token: ${p?.authToken ? '有' : '无/空'}`,
    ]
  }
  const p = pending.value.payload as any
  return [
    '将覆盖：wsUrl、authenticationToken、Hotkey 自定义、机位预设、Macros、参数槽、Panic、OBS 联动、道具配置',
    `wsUrl: ${String(p?.wsUrl ?? '')}`,
    `token: ${p?.authToken ? '有' : '无/空'}`,
    `hotkeyCustomizations: ${Array.isArray(p?.hotkeyCustomizations) ? p.hotkeyCustomizations.length : '-'}`,
    `presets: ${Array.isArray(p?.presets) ? p.presets.length : '-'}`,
    `macros: ${Array.isArray(p?.macros) ? p.macros.length : '-'}`,
    `paramSlots: ${Array.isArray(p?.paramSlots) ? p.paramSlots.length : '-'}`,
    `accessories: ${Array.isArray(p?.accessories) ? p.accessories.length : '-'}`,
    `pranks: ${Array.isArray(p?.pranks) ? p.pranks.length : '-'}`,
  ]
})

async function confirmImport() {
  if (!pending.value) return
  importing.value = true
  try {
    if (pending.value.kind === 'full') {
      await vts.importFullConfig(pending.value.payload)
    } else {
      await vts.importMinimalConfig(pending.value.payload)
    }
    message.success('导入成功')
    showPreview.value = false
    pending.value = null
  } catch (err) {
    message.error(err instanceof Error ? err.message : String(err))
  } finally {
    importing.value = false
  }
}

function cancelImport() {
  showPreview.value = false
  pending.value = null
}
</script>

<template>
  <NCard size="small" title="导入 / 导出">
    <NFlex align="center" :wrap="true" :size="8">
      <NButton size="small" @click="exportMinimal">
        导出最小版（wsUrl + token）
      </NButton>
      <NButton size="small" @click="exportFull">
        导出全量版
      </NButton>
      <NButton size="small" :loading="importing" tag="label">
        导入（json）
        <input
          type="file"
          accept="application/json"
          style="display: none"
          @change="onImportFileChange"
        >
      </NButton>
      <NText depth="3">
        wsUrl：{{ vts.wsUrl }}
      </NText>
      <NText depth="3">
        token：{{ vts.authToken ? '已保存' : '未保存' }}
      </NText>
    </NFlex>
  </NCard>

  <NModal v-model:show="showPreview" preset="card" title="导入预览（将覆盖现有配置）" style="width: 640px">
    <NCard size="small" :bordered="false">
      <NFlex vertical :size="10">
        <NText depth="3" v-for="line in previewLines" :key="line">
          {{ line }}
        </NText>
        <NFlex justify="end" :size="8">
          <NButton :disabled="importing" @click="cancelImport">
            取消
          </NButton>
          <NButton type="primary" :loading="importing" @click="confirmImport">
            确认导入
          </NButton>
        </NFlex>
      </NFlex>
    </NCard>
  </NModal>
</template>
