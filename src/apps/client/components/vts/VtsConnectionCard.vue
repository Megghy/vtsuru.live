<script setup lang="ts">
import { NAlert, NButton, NCard, NFlex, NInput, NTag, NText, useMessage } from 'naive-ui'
import { computed, ref } from 'vue'
import { useVtsStore } from '@/apps/client/store/useVtsStore'

const vts = useVtsStore()
const message = useMessage()
const wsUrlInput = ref(vts.wsUrl)

const connectionTagType = computed(() => {
  if (!vts.connected) return 'error'
  if (!vts.authenticated) return 'warning'
  return 'success'
})

const connectionTagText = computed(() => {
  if (!vts.connected) return '未连接'
  if (!vts.authenticated) return '未鉴权'
  return '已连接'
})

const faceTag = computed(() => {
  if (vts.faceFound == null) return null
  return vts.faceFound ? { type: 'success' as const, text: 'Face OK' } : { type: 'warning' as const, text: 'Face Lost' }
})

const handTagText = computed(() => {
  if (vts.leftHandFound == null && vts.rightHandFound == null) return null
  const l = vts.leftHandFound ? 'L' : '-'
  const r = vts.rightHandFound ? 'R' : '-'
  return `Hand ${l}${r}`
})

async function applyWsUrl() {
  try {
    await vts.setWsUrl(wsUrlInput.value)
    message.success('已保存地址')
  } catch (err) {
    vts.lastError = err instanceof Error ? err.message : String(err)
    message.error(vts.lastError)
  }
}

async function handleConnect() {
  try {
    await vts.setWsUrl(wsUrlInput.value)
    await vts.connect()
    message.success('已连接')
  } catch (err) {
    vts.lastError = err instanceof Error ? err.message : String(err)
    message.error(vts.lastError)
  }
}

async function handleRequestToken() {
  try {
    await vts.requestAuthenticationToken()
    await vts.authenticate()
    message.success('已鉴权')
  } catch (err) {
    vts.lastError = err instanceof Error ? err.message : String(err)
    message.error(vts.lastError)
  }
}

async function refreshMonitor() {
  try {
    await vts.refreshStatistics()
    await vts.refreshFaceFound()
    message.success('已刷新监控')
  } catch (err) {
    message.error(err instanceof Error ? err.message : String(err))
  }
}
</script>

<template>
  <NCard size="small" title="VTS 连接与鉴权">
    <NFlex vertical :size="12">
      <NFlex align="center" :size="8" :wrap="true">
        <NTag :type="connectionTagType">
          {{ connectionTagText }}
        </NTag>
        <NText v-if="vts.apiVersion" depth="3">
          VTS {{ vts.apiVersion }}
        </NText>
        <NText v-if="vts.lastRttMs != null" depth="3">
          RTT {{ vts.lastRttMs }}ms
        </NText>
        <NText v-if="vts.statistics?.framerate != null" depth="3">
          FPS {{ vts.statistics.framerate }}
        </NText>
        <NTag v-if="faceTag" :type="faceTag.type" size="small">
          {{ faceTag.text }}
        </NTag>
        <NText v-if="handTagText" depth="3">
          {{ handTagText }}
        </NText>
      </NFlex>

      <NFlex align="center" :wrap="true" :size="8">
        <NInput v-model:value="wsUrlInput" style="min-width: 320px" placeholder="ws://127.0.0.1:8001" />
        <NButton size="small" @click="applyWsUrl">
          保存地址
        </NButton>
        <NButton size="small" type="primary" :loading="vts.connecting" :disabled="vts.connected" @click="handleConnect">
          连接
        </NButton>
        <NButton size="small" :disabled="!vts.connected" @click="vts.disconnect">
          断开
        </NButton>
        <NButton size="small" :disabled="!vts.connected" @click="vts.refreshApiState">
          刷新状态
        </NButton>
        <NButton size="small" :disabled="!vts.connected" @click="refreshMonitor">
          刷新监控
        </NButton>
      </NFlex>

      <NFlex align="center" :wrap="true" :size="8">
        <NButton size="small" type="primary" :disabled="!vts.connected" @click="handleRequestToken">
          申请授权并鉴权
        </NButton>
        <NButton size="small" :disabled="!vts.connected || !vts.authToken" @click="vts.authenticate">
          使用已保存 Token 鉴权
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
        监控异常：{{ vts.monitorLastError }}
      </NAlert>
    </NFlex>
  </NCard>
</template>
