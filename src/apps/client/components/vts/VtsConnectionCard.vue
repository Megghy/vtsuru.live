<script setup lang="ts">
import { NAlert, NButton, NCard, NFlex, NInput, NTag, NText } from 'naive-ui'
import { computed, ref } from 'vue'
import { useVtsStore } from '@/apps/client/store/useVtsStore'
import { useVtsAction } from './useVtsAction'

const vts = useVtsStore()
const { run } = useVtsAction()
const wsUrlInput = ref(vts.wsUrl)

const statusType = computed(() => {
  if (!vts.connected) return 'error'
  if (!vts.authenticated) return 'warning'
  return 'success'
})

const statusText = computed(() => {
  if (!vts.connected) return '未连接'
  if (!vts.authenticated) return '已连接 (未鉴权)'
  return '已连接'
})

const faceTag = computed(() => {
  if (vts.faceFound == null) return null
  return vts.faceFound
    ? { type: 'success' as const, text: 'Face OK' }
    : { type: 'warning' as const, text: 'Face Lost' }
})

const handTagText = computed(() => {
  if (vts.leftHandFound == null && vts.rightHandFound == null) return null
  const l = vts.leftHandFound ? 'L' : '-'
  const r = vts.rightHandFound ? 'R' : '-'
  return `Hand ${l}${r}`
})

function handleConnect() {
  run(async () => {
    await vts.setWsUrl(wsUrlInput.value)
    await vts.connect()
  }, '已连接')
}

function handleRequestToken() {
  run(async () => {
    await vts.requestAuthenticationToken()
    await vts.authenticate()
  }, '鉴权成功')
}
</script>

<template>
  <NCard size="small" bordered title="VTS 连接">
    <NFlex vertical :size="12">
      <NFlex align="center" :size="8" :wrap="true">
        <NTag :type="statusType">
          {{ statusText }}
        </NTag>
        <NText v-if="vts.apiVersion" depth="3">
          v{{ vts.apiVersion }}
        </NText>
        <NText v-if="vts.lastRttMs != null" depth="3">
          {{ vts.lastRttMs }}ms
        </NText>
        <NText v-if="vts.statistics?.framerate != null" depth="3">
          {{ vts.statistics.framerate }} FPS
        </NText>
        <NTag v-if="faceTag" :type="faceTag.type" size="small">
          {{ faceTag.text }}
        </NTag>
        <NText v-if="handTagText" depth="3">
          {{ handTagText }}
        </NText>
      </NFlex>

      <NFlex align="center" :wrap="true" :size="8">
        <NInput v-model:value="wsUrlInput" style="min-width: 300px" placeholder="ws://127.0.0.1:8001" />
        <NButton size="small" type="primary" :loading="vts.connecting" :disabled="vts.connected" @click="handleConnect">
          连接
        </NButton>
        <NButton size="small" :disabled="!vts.connected" @click="vts.disconnect">
          断开
        </NButton>
        <NButton size="small" :disabled="!vts.connected" @click="run(() => vts.refreshApiState())">
          刷新状态
        </NButton>
      </NFlex>

      <NFlex align="center" :wrap="true" :size="8">
        <NButton size="small" type="primary" :disabled="!vts.connected" @click="handleRequestToken">
          申请授权
        </NButton>
        <NButton size="small" :disabled="!vts.connected || !vts.authToken" @click="run(() => vts.authenticate(), '已鉴权')">
          使用已有 Token
        </NButton>
        <NButton size="small" :disabled="!vts.authToken" @click="vts.clearAuthToken">
          清除 Token
        </NButton>
        <NText v-if="vts.authToken" depth="3">
          Token 已保存
        </NText>
      </NFlex>

      <NAlert v-if="vts.lastError" type="error" :show-icon="false">
        {{ vts.lastError }}
      </NAlert>
      <NAlert v-if="vts.monitorLastError" type="warning" :show-icon="false">
        监控异常: {{ vts.monitorLastError }}
      </NAlert>
    </NFlex>
  </NCard>
</template>
