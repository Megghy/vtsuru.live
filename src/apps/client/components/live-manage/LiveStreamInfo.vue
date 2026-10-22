<script setup lang="ts">
import {
  Check,
  Copy,
  Eye,
  EyeOff,
  Info,
  RefreshCw,
} from 'lucide-vue-next'
import { ref } from 'vue'
import { toast } from 'vue-sonner'

import type { LiveControl } from '@/apps/client/composables/useLiveControl'
import { Alert, AlertDescription } from '@/shared/ui/alert'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { Input } from '@/shared/ui/input'

const props = defineProps<{ control: LiveControl }>()
const c = props.control
const obsStore = c.obsStore

const showStreamKey = ref(false)
const copiedServer = ref(false)
const copiedKey = ref(false)

async function handleCopyServer() {
  if (!c.rtmpServer.value) return
  await c.copyToClipboard(c.rtmpServer.value)
  toast.success('推流服务器地址已复制到剪贴板')
  copiedServer.value = true
  setTimeout(() => {
    copiedServer.value = false
  }, 1500)
}

async function handleCopyKey() {
  if (!c.rtmpCode.value) return
  await c.copyToClipboard(c.rtmpCode.value)
  toast.success('推流码已复制到剪贴板')
  copiedKey.value = true
  setTimeout(() => {
    copiedKey.value = false
  }, 1500)
}
</script>

<template>
  <Card class="border bg-card">
    <CardHeader class="p-3 pb-2 border-b">
      <CardTitle class="text-sm font-semibold">推流信息</CardTitle>
    </CardHeader>

    <CardContent class="p-3 space-y-3.5">
      <Alert
        v-if="!c.rtmpServer.value"
        class="py-2 px-2.5 border-primary/20 bg-primary/5 text-primary"
      >
        <div class="flex items-center gap-1.5">
          <Info class="size-4 shrink-0" />
          <AlertDescription class="text-xs m-0">
            开播后将自动获取推流地址与推流码，请在 OBS 中配置使用
          </AlertDescription>
        </div>
      </Alert>

      <!-- 推流服务器 -->
      <div class="space-y-1.5">
        <label class="text-xs font-semibold text-foreground block">推流服务器</label>
        <div class="flex items-center gap-2">
          <Input
            :model-value="c.rtmpServer.value"
            readonly
            placeholder="开播后自动获取推流服务器"
            class="font-mono text-xs select-all bg-muted/30"
          />
          <Button
            type="button"
            variant="outline"
            class="shrink-0 gap-1.5"
            :disabled="!c.rtmpServer.value"
            @click="handleCopyServer"
          >
            <Check
              v-if="copiedServer"
              class="size-3.5 text-emerald-500"
            />
            <Copy
              v-else
              class="size-3.5"
            />
            {{ copiedServer ? '已复制' : '复制' }}
          </Button>
        </div>
      </div>

      <!-- 推流码 -->
      <div class="space-y-1.5">
        <label class="text-xs font-semibold text-foreground block">推流码</label>
        <div class="flex items-center gap-2">
          <div class="relative flex-1">
            <Input
              :model-value="c.rtmpCode.value"
              :type="showStreamKey ? 'text' : 'password'"
              readonly
              placeholder="开播后自动获取推流码"
              class="font-mono text-xs select-all pr-8 bg-muted/30"
            />
            <button
              v-if="c.rtmpCode.value"
              type="button"
              class="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-0.5"
              title="切换明文显示"
              @click="showStreamKey = !showStreamKey"
            >
              <EyeOff
                v-if="showStreamKey"
                class="size-3.5"
              />
              <Eye
                v-else
                class="size-3.5"
              />
            </button>
          </div>

          <Button
            type="button"
            variant="outline"
            class="shrink-0 gap-1.5"
            :disabled="!c.rtmpCode.value"
            @click="handleCopyKey"
          >
            <Check
              v-if="copiedKey"
              class="size-3.5 text-emerald-500"
            />
            <Copy
              v-else
              class="size-3.5"
            />
            {{ copiedKey ? '已复制' : '复制' }}
          </Button>

          <Button
            v-if="obsStore.obsConnected"
            type="button"
            class="shrink-0 gap-1.5"
            :disabled="!c.rtmpServer.value || !c.rtmpCode.value"
            @click="c.handleSyncStreamKeyToObs"
          >
            <RefreshCw class="size-3.5" />
            同步到 OBS
          </Button>
        </div>
      </div>

      <p class="text-[11px] text-muted-foreground">
        请在 OBS 等推流软件的「设置 - 推流」中将服务类型设为自定义，服务器填入上方地址，串流密钥填入上方推流码。
      </p>
    </CardContent>
  </Card>
</template>
