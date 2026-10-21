<script setup lang="ts">
import { computed, ref } from 'vue'

import { DEFAULT_WS_URL } from '@/apps/client/store/vts/config'
import { useVtsStore } from '@/apps/client/store/useVtsStore'
import { Alert, AlertDescription } from '@/shared/ui/alert'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { Input } from '@/shared/ui/input'
import { Tag } from '@/shared/ui/tag'

import { useVtsAction } from './useVtsAction'

const vts = useVtsStore()
const { run } = useVtsAction()
const wsUrlInput = ref(vts.wsUrl)

const faceTag = computed(() => {
  if (vts.faceFound == null) return null
  return vts.faceFound ? { variant: 'default' as const, text: '面部已识别' } : { variant: 'secondary' as const, text: '面部丢失' }
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
  <Card>
    <CardHeader class="py-3 px-4">
      <CardTitle class="text-sm font-semibold">VTS 连接</CardTitle>
    </CardHeader>
    <CardContent class="px-4 pb-4 pt-0 flex flex-col gap-3">
      <p class="text-xs text-[var(--muted-foreground)]">
        在 VTube Studio 设置中开启「启动 API」（默认端口 8001）。首次连接时需在 VTS 弹窗中点击「允许」，授权会自动保存，之后启动客户端时自动连接。
      </p>

      <div class="flex items-center gap-2 flex-wrap">
        <Tag v-if="vts.connected" variant="default">已连接</Tag>
        <Tag v-else-if="vts.connecting" variant="secondary">等待 VTS 响应 / 授权中</Tag>
        <Tag v-else variant="destructive">未连接</Tag>
        <span
          v-if="vts.apiVersion"
          class="text-xs text-[var(--muted-foreground)]"
        >
          VTS v{{ vts.apiVersion }}
        </span>
        <Tag
          v-if="faceTag"
          :variant="faceTag.variant"
        >
          {{ faceTag.text }}
        </Tag>
        <span
          v-if="handText"
          class="text-xs text-[var(--muted-foreground)]"
        >
          {{ handText }}
        </span>
      </div>

      <div class="flex items-center gap-2 flex-wrap">
        <Input
          v-model="wsUrlInput"
          class="min-w-[300px] flex-1 h-8 text-xs"
          :placeholder="DEFAULT_WS_URL"
        />
        <Button
          v-if="!vts.connected && !vts.connecting"
          size="sm"
          @click="handleConnect"
        >
          连接
        </Button>
        <Button
          v-else
          size="sm"
          variant="outline"
          @click="run(() => vts.disconnect())"
        >
          {{ vts.connecting ? '取消' : '断开' }}
        </Button>
        <Button
          size="sm"
          variant="outline"
          :disabled="!vts.authToken"
          @click="run(() => vts.reauthorize())"
        >
          重新授权
        </Button>
      </div>

      <Alert
        v-if="vts.monitorLastError"
        variant="destructive"
        class="py-2 px-3"
      >
        <AlertDescription class="text-xs">
          状态监控异常: {{ vts.monitorLastError }}
        </AlertDescription>
      </Alert>
    </CardContent>
  </Card>
</template>
