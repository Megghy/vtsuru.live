<script setup lang="ts">
import { NButton, NCard, NFlex, NSelect, NText, useMessage } from 'naive-ui';
import { computed } from 'vue'
import { useVtsStore } from '@/apps/client/store/useVtsStore'

const vts = useVtsStore()
const message = useMessage()

const hotkeyOptions = computed(() => {
  return vts.hotkeys.map(hk => ({
    label: hk.name || hk.hotkeyID,
    value: hk.hotkeyID,
  }))
})

async function updateCalibrateHotkey(id: string) {
  await vts.setPanicConfig({ ...vts.panicConfig, calibrateHotkeyId: id })
  message.success('已保存校准热键')
}

async function updateResetPhysicsHotkey(id: string) {
  await vts.setPanicConfig({ ...vts.panicConfig, resetPhysicsHotkeyId: id })
  message.success('已保存重置物理热键')
}

async function doCalibrate() {
  try {
    await vts.panicCalibrate()
    message.success('已触发校准')
  } catch (err) {
    message.error(err instanceof Error ? err.message : String(err))
  }
}

async function doResetPhysics() {
  try {
    await vts.panicResetPhysics()
    message.success('已触发重置物理')
  } catch (err) {
    message.error(err instanceof Error ? err.message : String(err))
  }
}
</script>

<template>
  <NCard size="small" title="应急（Panic）">
    <NFlex vertical :size="10">
      <NText depth="3">
        通过 VTS Hotkey 实现：请先在 VTS 内配置“校准 / 重置物理”热键，再在这里选择对应 hotkeyID。
      </NText>

      <NFlex :wrap="true" :size="10" align="center">
        <NSelect
          style="width: 320px"
          :options="hotkeyOptions"
          :value="vts.panicConfig.calibrateHotkeyId"
          placeholder="选择：校准热键"
          @update:value="(val) => updateCalibrateHotkey(val as string)"
        />
        <NButton size="small" type="error" :disabled="!vts.canOperate" @click="doCalibrate">
          一键校准
        </NButton>
      </NFlex>

      <NFlex :wrap="true" :size="10" align="center">
        <NSelect
          style="width: 320px"
          :options="hotkeyOptions"
          :value="vts.panicConfig.resetPhysicsHotkeyId"
          placeholder="选择：重置物理热键"
          @update:value="(val) => updateResetPhysicsHotkey(val as string)"
        />
        <NButton size="small" type="error" :disabled="!vts.canOperate" @click="doResetPhysics">
          物理重置
        </NButton>
      </NFlex>
    </NFlex>
  </NCard>
</template>

