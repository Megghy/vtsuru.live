<script setup lang="ts">
import { NButton, NCard, NFlex, NSelect, NText } from 'naive-ui'
import { computed } from 'vue'
import { useVtsStore } from '@/apps/client/store/useVtsStore'
import { useVtsAction } from './useVtsAction'

const vts = useVtsStore()
const { run } = useVtsAction()

const hotkeyOptions = computed(() =>
  vts.hotkeys.map(hk => ({ label: hk.name || hk.hotkeyID, value: hk.hotkeyID })),
)

function setCalibrateHotkey(id: string) {
  run(() => vts.setPanicConfig({ ...vts.panicConfig, calibrateHotkeyId: id }), '已保存')
}

function setResetPhysicsHotkey(id: string) {
  run(() => vts.setPanicConfig({ ...vts.panicConfig, resetPhysicsHotkeyId: id }), '已保存')
}
</script>

<template>
  <NCard size="small" bordered title="应急控制">
    <NFlex vertical :size="12">
      <NText depth="3">
        选择 VTS 中已配置的热键来绑定应急操作
      </NText>

      <NFlex :wrap="true" :size="12" align="center">
        <NSelect
          style="width: 300px"
          :options="hotkeyOptions"
          :value="vts.panicConfig.calibrateHotkeyId"
          placeholder="绑定: 校准热键"
          @update:value="setCalibrateHotkey"
        />
        <NButton size="small" type="error" :disabled="!vts.canOperate" @click="run(() => vts.panicCalibrate(), '已校准')">
          一键校准
        </NButton>
      </NFlex>

      <NFlex :wrap="true" :size="12" align="center">
        <NSelect
          style="width: 300px"
          :options="hotkeyOptions"
          :value="vts.panicConfig.resetPhysicsHotkeyId"
          placeholder="绑定: 重置物理热键"
          @update:value="setResetPhysicsHotkey"
        />
        <NButton size="small" type="error" :disabled="!vts.canOperate" @click="run(() => vts.panicResetPhysics(), '已重置')">
          重置物理
        </NButton>
      </NFlex>
    </NFlex>
  </NCard>
</template>
