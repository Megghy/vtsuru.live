<script setup lang="ts">
import { saveAs } from 'file-saver'
import { Download, Upload } from 'lucide-vue-next'
import { computed, ref } from 'vue'

import { useVtsStore } from '@/apps/client/store/useVtsStore'
import { useFilePicker } from '@/composables/useFilePicker'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { Checkbox } from '@/shared/ui/checkbox'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog'

import { useVtsAction } from './useVtsAction'

const vts = useVtsStore()
const { run } = useVtsAction()
const importing = ref(false)
const showPreview = ref(false)
const includeToken = ref(false)
const pending = ref<{ kind: 'minimal' | 'full'; payload: unknown } | null>(null)

function exportMinimal() {
  run(
    () => {
      const json = JSON.stringify(vts.exportMinimalConfig(includeToken.value), null, 2)
      saveAs(new Blob([json], { type: 'application/json;charset=utf-8' }), 'vts_config_min.json')
    },
    includeToken.value ? '已导出连接配置（含 Token）' : '已导出连接配置（已脱敏）',
  )
}

function exportFull() {
  run(
    () => {
      const json = JSON.stringify(vts.exportFullConfig(includeToken.value), null, 2)
      saveAs(new Blob([json], { type: 'application/json;charset=utf-8' }), 'vts_config_full.json')
    },
    includeToken.value ? '已导出全量配置（含 Token）' : '已导出全量配置（已脱敏）',
  )
}

const { open: openConfigImport } = useFilePicker({
  accept: 'application/json',
  onSelect: ([file]) => {
    run(async () => {
      const parsed = JSON.parse(await file.text())
      pending.value = {
        kind: parsed && typeof parsed === 'object' && parsed.version === 2 ? 'full' : 'minimal',
        payload: parsed,
      }
      showPreview.value = true
    })
  },
})

const previewLines = computed(() => {
  if (!pending.value) return []
  const p = pending.value.payload as Record<string, unknown>
  if (pending.value.kind === 'minimal') {
    return [
      '覆盖：连接地址（若含 Token 则一并覆盖）',
      `wsUrl：${String(p?.wsUrl ?? '')}`,
      `Token：${p?.authToken ? '包含' : '未包含（保留本机当前 Token）'}`,
    ]
  }
  return [
    '覆盖：全部 VTS 控制配置',
    `wsUrl：${String(p?.wsUrl ?? '')}`,
    `Token：${p?.authToken ? '包含' : '未包含（保留本机当前 Token）'}`,
    `操作台格子：${Array.isArray(p?.deck) ? p.deck.length : '-'}`,
    `热键自定义：${Array.isArray(p?.hotkeyCustomizations) ? p.hotkeyCustomizations.length : '-'}`,
    `预设：${Array.isArray(p?.presets) ? p.presets.length : '-'}`,
    `宏：${Array.isArray(p?.macros) ? p.macros.length : '-'}`,
    `参数槽：${Array.isArray(p?.paramSlots) ? p.paramSlots.length : '-'}`,
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
  }, '导入成功（若修改了连接地址，请重新连接 VTS）')
  importing.value = false
}

function cancelImport() {
  showPreview.value = false
  pending.value = null
}
</script>

<template>
  <Card>
    <CardHeader class="p-3 border-b flex flex-row items-center justify-between gap-2 flex-wrap">
      <CardTitle>全量导入 / 导出</CardTitle>
      <div class="flex items-center gap-2 text-[11px] text-muted-foreground">
        <span class="font-mono">{{ vts.wsUrl || '未设置' }}</span>
        <Badge
          :variant="vts.authToken ? 'success' : 'secondary'"
          size="xs"
        >
          {{ vts.authToken ? 'Token 已保存' : '无 Token' }}
        </Badge>
      </div>
    </CardHeader>

    <CardContent class="p-3 space-y-3">
      <div class="flex items-center gap-2 flex-wrap">
        <Button
          variant="outline"
          class="gap-1.5"
          @click="exportMinimal"
        >
          <Download class="size-3.5" />
          导出连接配置
        </Button>
        <Button
          variant="outline"
          class="gap-1.5"
          @click="exportFull"
        >
          <Download class="size-3.5" />
          导出全量配置
        </Button>
        <Button
          variant="secondary"
          class="gap-1.5"
          :disabled="importing"
          @click="openConfigImport()"
        >
          <Upload class="size-3.5" />
          导入配置
        </Button>
      </div>

      <label class="flex items-center gap-2 cursor-pointer select-none text-xs text-muted-foreground">
        <Checkbox v-model="includeToken" />
        <span>导出时包含 VTS 授权 Token（默认脱敏不导出；仅限个人换机备份，请勿分享含 Token 的文件）</span>
      </label>
    </CardContent>
  </Card>

  <Dialog
    :open="showPreview"
    @update:open="
      (val) => {
        if (!val) cancelImport()
      }
    "
  >
    <DialogContent class="max-w-md">
      <DialogHeader>
        <DialogTitle class="text-base">导入预览</DialogTitle>
      </DialogHeader>
      <div class="flex flex-col gap-1.5 py-2">
        <span
          v-for="line in previewLines"
          :key="line"
          class="text-xs text-muted-foreground"
        >
          {{ line }}
        </span>
      </div>
      <DialogFooter class="flex justify-end gap-2 pt-2">
        <Button
          variant="outline"
          :disabled="importing"
          @click="cancelImport"
        >
          取消
        </Button>
        <Button
          :disabled="importing"
          @click="confirmImport"
        >
          确认导入
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
