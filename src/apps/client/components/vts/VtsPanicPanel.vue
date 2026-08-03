<script setup lang="ts">
import { computed } from 'vue'

import { useVtsStore } from '@/apps/client/store/useVtsStore'

import { useVtsAction } from './useVtsAction'

const vts = useVtsStore()
const { run } = useVtsAction()

const hotkeyOptions = computed(() => vts.hotkeys.map((hk) => ({ label: hk.name || hk.hotkeyID, value: hk.hotkeyID })))

function setCalibrateHotkey(id: string) {
  run(() => vts.setPanicConfig({ ...vts.panicConfig, calibrateHotkeyId: id }), '已保存')
}

function setResetPhysicsHotkey(id: string) {
  run(() => vts.setPanicConfig({ ...vts.panicConfig, resetPhysicsHotkeyId: id }), '已保存')
}
</script>

<template>
  <UCard
    size="small"
    bordered
    title="应急控制"
  >
    <div
      vertical
      :size="12"
    >
      <span depth="3"> 选择 VTS 中已配置的热键来绑定应急操作 </span>

      <div
        :wrap="true"
        :size="12"
        align="center"
      >
        <USelectMenu
          style="width: 300px"
          :items="hotkeyOptions"
          :value="vts.panicConfig.calibrateHotkeyId"
          placeholder="绑定: 校准热键"
          @update:value="setCalibrateHotkey"
          value-key="value"
        />
        <UButton
          size="small"
          color="error"
          :disabled="!vts.canOperate"
          @click="run(() => vts.panicCalibrate(), '已校准')"
        >
          一键校准
        </UButton>
      </div>

      <div
        :wrap="true"
        :size="12"
        align="center"
      >
        <USelectMenu
          style="width: 300px"
          :items="hotkeyOptions"
          :value="vts.panicConfig.resetPhysicsHotkeyId"
          placeholder="绑定: 重置物理热键"
          @update:value="setResetPhysicsHotkey"
          value-key="value"
        />
        <UButton
          size="small"
          color="error"
          :disabled="!vts.canOperate"
          @click="run(() => vts.panicResetPhysics(), '已重置')"
        >
          重置物理
        </UButton>
      </div>
    </div>
  </UCard>
</template>
