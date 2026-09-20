<script setup lang="ts">
import {
  NAlert,
  NButton,
  NCard,
  NFlex,
  NForm,
  NFormItem,
  NInput,
  NProgress,
  NSelect,
  NSwitch,
  NTag,
  NText,
} from 'naive-ui'
import { computed, onMounted } from 'vue'
import { RouterLink } from 'vue-router'

import ClientPageHeader from '../components/ClientPageHeader.vue'
import { useOBSStore } from '../store/useOBSStore'
import { usePngtuberDriver } from '../store/usePngtuberDriver'
const driver = usePngtuberDriver()
const obs = useOBSStore()
const locked = computed(() => driver.running || driver.starting)
const deviceOptions = computed(() => [
  { label: '系统默认麦克风', value: 'default' },
  ...driver.devices
    .filter((device) => device.deviceId !== 'default')
    .map((device) => ({ label: device.label, value: device.deviceId })),
])
const inputOptions = computed(() => obs.obsInputs.map((name) => ({ label: name, value: name })))
const expressions = computed(() =>
  driver.config.expressions.map((expression) => ({
    label: `${expression.name} · ${expression.id}`,
    value: expression.id,
  })),
)
const settingsLink = computed(() => ({
  name: 'obs-store-pngtuber-manage',
  query: { channel: driver.channel || 'default' },
}))
async function refreshInputs() {
  try {
    await obs.fetchObsInputs()
  } catch (cause) {
    window.$message?.error(String(cause))
  }
}
async function control(patch: { expressionId?: string; muted?: boolean; away?: boolean }) {
  try {
    await driver.control(patch)
  } catch (cause) {
    window.$message?.error(String(cause))
  }
}
onMounted(() => {
  void driver.refreshDevices()
  void refreshInputs()
})
</script>

<template>
  <NFlex
    vertical
    :size="16"
  >
    <ClientPageHeader
      title="PNGtuber"
      description="在客户端持续驱动立绘，切换页面后继续运行。"
    >
      <template #actions>
        <RouterLink :to="settingsLink"><NButton>完整模型设置</NButton></RouterLink>
      </template>
    </ClientPageHeader>
    <NAlert
      v-if="driver.statusError"
      type="error"
      title="驱动提示"
      >{{ driver.statusError }}</NAlert
    >
    <NCard
      size="small"
      title="音频驱动"
    >
      <template #header-extra>
        <NTag
          :bordered="false"
          :type="driver.running && driver.connected ? 'success' : 'default'"
        >
          {{ driver.starting ? '正在启动' : driver.running ? (driver.connected ? '运行中' : '等待连接') : '已停止' }}
        </NTag>
      </template>
      <NForm
        label-placement="top"
        :disabled="locked"
      >
        <div class="input-grid">
          <NFormItem label="频道"
            ><NInput
              v-model:value="driver.channel"
              placeholder="default"
          /></NFormItem>
          <NFormItem label="音频来源"
            ><NSelect
              v-model:value="driver.audioMode"
              :options="[
                { label: '客户端麦克风', value: 'microphone' },
                { label: 'OBS 输入源', value: 'obs' },
              ]"
          /></NFormItem>
          <NFormItem
            v-if="driver.audioMode === 'microphone'"
            label="麦克风设备"
            ><NSelect
              v-model:value="driver.deviceId"
              :options="deviceOptions"
          /></NFormItem>
          <NFormItem
            v-else
            label="OBS 输入源"
            ><NSelect
              v-model:value="driver.obsInput"
              :options="inputOptions"
              filterable
              placeholder="选择音频输入源"
          /></NFormItem>
        </div>
      </NForm>
      <NFlex align="center">
        <NButton
          v-if="!locked"
          type="primary"
          @click="driver.start"
          >启动驱动</NButton
        >
        <NButton
          v-else
          @click="driver.stop"
          >停止驱动</NButton
        >
        <NButton
          :disabled="locked"
          @click="driver.audioMode === 'microphone' ? driver.refreshDevices() : refreshInputs()"
          >刷新设备</NButton
        >
        <RouterLink
          v-if="driver.audioMode === 'obs'"
          :to="{ name: 'client-live-manage' }"
          >{{ obs.obsConnected ? 'OBS 已连接' : '前往连接 OBS' }}</RouterLink
        >
      </NFlex>
      <NText
        depth="3"
        class="hint"
        >启动时申请音频权限。更换频道或音频来源前请停止驱动。展示页输入模式请选择客户端或 OBS。</NText
      >
    </NCard>
    <NCard
      size="small"
      title="实时状态"
    >
      <NFlex
        vertical
        :size="16"
      >
        <NFlex align="center">
          <NTag :type="driver.speaking ? 'success' : 'default'">{{ driver.speaking ? '说话中' : '静默' }}</NTag>
          <NText depth="3">{{ driver.inputMuted ? 'OBS 输入已静音' : `音量 ${Math.round(driver.volume)}` }}</NText>
          <NText depth="3">{{ driver.connected ? '控制连接正常' : '控制未连接' }}</NText>
        </NFlex>
        <NProgress
          type="line"
          :percentage="Math.round(driver.volume)"
          :show-indicator="false"
        />
        <NForm
          label-placement="left"
          :label-width="80"
          :disabled="!driver.running || !driver.connected"
        >
          <NFormItem label="表情"
            ><NSelect
              :value="driver.runtime.expressionId || driver.config.defaultExpressionId"
              :options="expressions"
              @update:value="(value) => control({ expressionId: value })"
          /></NFormItem>
          <NFormItem label="静音"
            ><NSwitch
              :value="driver.runtime.muted"
              @update:value="(value) => control({ muted: value })"
          /></NFormItem>
          <NFormItem label="暂离"
            ><NSwitch
              :value="driver.runtime.away"
              @update:value="(value) => control({ away: value })"
          /></NFormItem>
        </NForm>
        <NFlex>
          <RouterLink :to="settingsLink"><NButton>表情、快捷键与完整设置</NButton></RouterLink>
          <RouterLink :to="{ name: 'client-auto-action-manage' }"><NButton>配置自动操作</NButton></RouterLink>
        </NFlex>
      </NFlex>
    </NCard>
  </NFlex>
</template>

<style scoped>
.input-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 0 16px;
}
.hint {
  display: block;
  margin-top: 12px;
  font-size: 12px;
}
</style>
