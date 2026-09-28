<script setup lang="ts">
import { NAlert, NButton, NCard, NFlex, NInput, NTag, NText } from 'naive-ui'
import { computed, ref } from 'vue'

import { DEFAULT_WS_URL } from '@/apps/client/store/vts/config'
import { useVtsStore } from '@/apps/client/store/useVtsStore'

import { useVtsAction } from './useVtsAction'

const vts = useVtsStore()
const { run } = useVtsAction()
const wsUrlInput = ref(vts.wsUrl)

const faceTag = computed(() => {
  if (vts.faceFound == null) return null
  return vts.faceFound ? { type: 'success' as const, text: '面部已识别' } : { type: 'warning' as const, text: '面部丢失' }
})

const handText = computed(() => {
  if (vts.leftHandFound == null && vts.rightHandFound == null) return null
  return `手部 ${vts.leftHandFound ? '左' : '-'}${vts.rightHandFound ? '右' : '-'}`
})

function handleConnect() {
  run(async () => {
    await vts.setWsUrl(wsUrlInput.value)
    await vts.connect()
  })
}
</script>

<template>
  <NCard
    size="small"
    bordered
    title="VTS 连接"
  >
    <NFlex
      vertical
      :size="12"
    >
      <NText depth="3">
        在 VTube Studio 设置中开启「启动 API」（默认端口 8001）。首次连接时需在 VTS 弹窗中点击「允许」，授权会自动保存，之后启动客户端时自动连接。
      </NText>

      <NFlex
        align="center"
        :size="8"
        :wrap="true"
      >
        <NTag v-if="vts.connected" type="success">已连接</NTag>
        <NTag v-else-if="vts.connecting" type="info">等待 VTS 响应 / 授权中</NTag>
        <NTag v-else type="error">未连接</NTag>
        <NText
          v-if="vts.apiVersion"
          depth="3"
        >
          VTS v{{ vts.apiVersion }}
        </NText>
        <NTag
          v-if="faceTag"
          :type="faceTag.type"
          size="small"
        >
          {{ faceTag.text }}
        </NTag>
        <NText
          v-if="handText"
          depth="3"
        >
          {{ handText }}
        </NText>
      </NFlex>

      <NFlex
        align="center"
        :wrap="true"
        :size="8"
      >
        <NInput
          v-model:value="wsUrlInput"
          style="min-width: 300px; flex: 1"
          :placeholder="DEFAULT_WS_URL"
        />
        <NButton
          v-if="!vts.connected && !vts.connecting"
          size="small"
          type="primary"
          @click="handleConnect"
        >
          连接
        </NButton>
        <NButton
          v-else
          size="small"
          @click="run(() => vts.disconnect())"
        >
          {{ vts.connecting ? '取消' : '断开' }}
        </NButton>
        <NButton
          size="small"
          :disabled="!vts.authToken"
          @click="run(() => vts.reauthorize())"
        >
          重新授权
        </NButton>
      </NFlex>

      <NAlert
        v-if="vts.monitorLastError"
        type="warning"
        :show-icon="false"
      >
        状态监控异常: {{ vts.monitorLastError }}
      </NAlert>
    </NFlex>
  </NCard>
</template>
