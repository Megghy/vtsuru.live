<script setup lang="ts">
import { KeyRound, Plug, Unplug } from 'lucide-vue-next'
import { computed, ref, watch } from 'vue'

import { useVtsStore } from '@/apps/client/store/useVtsStore'
import { DEFAULT_WS_URL } from '@/apps/client/store/vts/config'
import { Alert, AlertDescription } from '@/shared/ui/alert'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { FormField } from '@/shared/ui/form-field'
import { Input } from '@/shared/ui/input'

import { useVtsAction } from './useVtsAction'

const vts = useVtsStore()
const { run } = useVtsAction()
const wsUrlInput = ref(vts.wsUrl)

watch(
  () => vts.wsUrl,
  (next) => {
    wsUrlInput.value = next
  },
)

const faceBadge = computed(() => {
  if (vts.faceFound == null) return null
  return vts.faceFound
    ? { variant: 'success' as const, text: '面部已识别' }
    : { variant: 'warning' as const, text: '面部丢失' }
})

const handText = computed(() => {
  if (vts.leftHandFound == null && vts.rightHandFound == null) return null
  return `手部 ${vts.leftHandFound ? '左' : '-'}/${vts.rightHandFound ? '右' : '-'}`
})

function handleConnect() {
  run(async () => {
    await vts.setWsUrl(wsUrlInput.value || DEFAULT_WS_URL)
    await vts.connect()
  })
}
</script>

<template>
  <Card>
    <CardHeader class="p-3 border-b flex flex-row items-center justify-between gap-2">
      <CardTitle>VTS 连接</CardTitle>
      <div class="flex items-center gap-1.5 flex-wrap">
        <Badge
          v-if="vts.connected"
          variant="success"
          size="xs"
        >
          已连接
        </Badge>
        <Badge
          v-else-if="vts.connecting"
          variant="secondary"
          size="xs"
        >
          {{ vts.wsRetryCount > 0 ? `重连中 (${vts.wsRetryCount})` : '等待 VTS / 授权中' }}
        </Badge>
        <Badge
          v-else
          variant="destructive"
          size="xs"
        >
          未连接
        </Badge>
        <span
          v-if="vts.apiVersion"
          class="text-[11px] text-muted-foreground tabular-nums"
        >
          v{{ vts.apiVersion }}
        </span>
      </div>
    </CardHeader>

    <CardContent class="p-3 space-y-3">
      <FormField
        label="WebSocket 地址"
        description="在 VTube Studio 设置中开启「启动 API」（默认端口 8001）。首次连接需在 VTS 弹窗中点击「允许」，之后自动保存授权。"
      >
        <div class="flex items-center gap-2 flex-wrap">
          <Input
            v-model="wsUrlInput"
            class="min-w-[220px] flex-1"
            :placeholder="DEFAULT_WS_URL"
          />
          <Button
            v-if="!vts.connected && !vts.connecting"
            class="gap-1.5"
            @click="handleConnect"
          >
            <Plug class="size-3.5" />
            连接
          </Button>
          <Button
            v-else
            variant="outline"
            class="gap-1.5"
            @click="run(() => vts.disconnect())"
          >
            <Unplug class="size-3.5" />
            {{ vts.connecting ? '取消' : '断开' }}
          </Button>
          <Button
            variant="outline"
            class="gap-1.5"
            :disabled="!vts.authToken"
            @click="run(() => vts.reauthorize())"
          >
            <KeyRound class="size-3.5" />
            重新授权
          </Button>
        </div>
      </FormField>

      <div
        v-if="faceBadge || handText"
        class="flex items-center gap-2 flex-wrap"
      >
        <Badge
          v-if="faceBadge"
          :variant="faceBadge.variant"
          size="xs"
        >
          {{ faceBadge.text }}
        </Badge>
        <span
          v-if="handText"
          class="text-[11px] text-muted-foreground"
        >
          {{ handText }}
        </span>
      </div>

      <Alert
        v-if="vts.monitorLastError"
        size="sm"
        variant="destructive"
      >
        <AlertDescription class="m-0">状态监控异常: {{ vts.monitorLastError }}</AlertDescription>
      </Alert>
    </CardContent>
  </Card>
</template>
