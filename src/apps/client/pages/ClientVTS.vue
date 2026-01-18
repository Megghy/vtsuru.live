<script setup lang="ts">
import { NAlert, NFlex, useMessage } from 'naive-ui';
import { onMounted } from 'vue'
import { isTauri } from '@/shared/config'
import ClientPageHeader from '@/apps/client/components/ClientPageHeader.vue'
import VtsConnectionCard from '@/apps/client/components/vts/VtsConnectionCard.vue'
import VtsFloatWindowPanel from '@/apps/client/components/vts/VtsFloatWindowPanel.vue'
import VtsHotkeyBoard from '@/apps/client/components/vts/VtsHotkeyBoard.vue'
import VtsImportExportCard from '@/apps/client/components/vts/VtsImportExportCard.vue'
import VtsPresetPanel from '@/apps/client/components/vts/VtsPresetPanel.vue'
import VtsMacroPanel from '@/apps/client/components/vts/VtsMacroPanel.vue'
import VtsParameterPanel from '@/apps/client/components/vts/VtsParameterPanel.vue'
import VtsPanicPanel from '@/apps/client/components/vts/VtsPanicPanel.vue'
import VtsItemPanel from '@/apps/client/components/vts/VtsItemPanel.vue'
import VtsHistoryPanel from '@/apps/client/components/vts/VtsHistoryPanel.vue'
import VtsObsLinkPanel from '@/apps/client/components/vts/VtsObsLinkPanel.vue'
import VtsProfilePanel from '@/apps/client/components/vts/VtsProfilePanel.vue'
import { useVtsStore } from '@/apps/client/store/useVtsStore'

const vts = useVtsStore()
const message = useMessage()

onMounted(async () => {
  if (!isTauri()) return
  try {
    await vts.init()
  } catch (err) {
    message.error(err instanceof Error ? err.message : String(err))
  }
})

async function refreshHotkeys() {
  try {
    await vts.refreshHotkeys()
  } catch (err) {
    message.error(err instanceof Error ? err.message : String(err))
  }
}

async function triggerHotkey(hotkeyID: string) {
  try {
    await vts.triggerHotkey(hotkeyID)
  } catch (err) {
    message.error(err instanceof Error ? err.message : String(err))
  }
}
</script>

<template>
  <NFlex vertical :size="12">
    <ClientPageHeader
      title="VTube Studio 控制"
      description="仅支持 Tauri；通过 VTS Public API 控制 hotkeys / 机位 / 道具 / 参数 / 应急按钮。"
    />

    <NAlert v-if="isTauri()" type="warning">
      功能正在开发中，暂不完全可用；如遇问题请先导出配置备份。
    </NAlert>

    <NAlert v-if="!isTauri()" type="error">
      当前不是 Tauri 环境，无法使用 VTS 控制功能。
    </NAlert>

    <VtsImportExportCard />
    <VtsProfilePanel />
    <VtsConnectionCard />
    <VtsFloatWindowPanel />

    <VtsHotkeyBoard
      :hotkeys="vts.hotkeys"
      :model-name="vts.currentModelName"
      :disabled="!vts.canOperate"
      @refresh="refreshHotkeys"
      @trigger="triggerHotkey"
    />

    <VtsPresetPanel />
    <VtsObsLinkPanel />
    <VtsMacroPanel />
    <VtsItemPanel />
    <VtsParameterPanel />
    <VtsPanicPanel />
    <VtsHistoryPanel />
  </NFlex>
</template>
