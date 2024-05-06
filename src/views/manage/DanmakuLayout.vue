<script setup lang="ts">
import { useAccount } from '@/api/account'
import DanmakuClient from '@/data/DanmakuClient'
import { NAlert, NSpin, useMessage } from 'naive-ui'
import { VNode, onMounted, onUnmounted, ref } from 'vue'

const props = defineProps<{
  component: VNode
}>()

const accountInfo = useAccount()
const message = useMessage()

const client = new DanmakuClient(null)
const isClientLoading = ref(true)
let bc: BroadcastChannel

onMounted(async () => {
  if (window.BroadcastChannel) {
    bc = new BroadcastChannel('vtsuru.danmaku')
    let isCreated = false
    bc.onmessage = (event) => {
      switch (event.data) {
        case 'ping':
          bc.postMessage('pong')
          break
        case 'pong': //已存在其他客户端
          if (!isCreated) {
            isCreated = true
          }
          break
        case 'danmaku':
          props.component.props?.onDanmaku?.(event.type)
          break
      }
    }
    bc.postMessage('ping')
    setTimeout(() => {
      
    }, 50);
  }
  const result = await client.Start()
  if (!result.success) {
    message.error('无法启动弹幕客户端: ' + result.message)
  }
  isClientLoading.value = false
})
onUnmounted(() => {
  client.Stop()
})
</script>

<template>
  <NAlert v-if="accountInfo?.isBiliVerified != true" type="info"> 尚未进行Bilibili认证 </NAlert>
  <NSpin v-else-if="isClientLoading" show />
  <KeepAlive v-else>
    <component
      :is="component"
      :client="client"
      :room-info="client.roomAuthInfo?.value"
      :code="accountInfo?.biliAuthCode"
    />
  </KeepAlive>
</template>
