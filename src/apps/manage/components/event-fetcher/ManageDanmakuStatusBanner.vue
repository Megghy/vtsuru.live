<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { AlertTriangle, ShieldAlert } from 'lucide-vue-next'

import { useAccount } from '@/api/account'
import { BiliAuthCodeStatusType } from '@/api/api-models'
import { useDanmakuClient } from '@/store/useDanmakuClient'
import { Alert, AlertDescription } from '@/shared/ui/alert'
import { Button } from '@/shared/ui/button'
import { Tag } from '@/shared/ui/tag'

const accountInfo = useAccount()
const router = useRouter()
const client = useDanmakuClient()

const authCodeLabel = computed(() => {
  switch (accountInfo.value?.biliAuthCodeStatus) {
    case BiliAuthCodeStatusType.Active:
      return '身份码有效'
    case BiliAuthCodeStatusType.Inactive:
      return '身份码需更新'
    case BiliAuthCodeStatusType.Notfound:
      return '身份码未绑定'
    default:
      return '身份码状态未知'
  }
})

const authCodeType = computed(() => {
  switch (accountInfo.value?.biliAuthCodeStatus) {
    case BiliAuthCodeStatusType.Active:
      return 'success' as const
    case BiliAuthCodeStatusType.Inactive:
      return 'error' as const
    default:
      return 'warning' as const
  }
})

const needsBind = computed(() => !accountInfo.value?.isBiliVerified)
const needsCodeUpdate = computed(
  () =>
    accountInfo.value?.isBiliVerified &&
    accountInfo.value?.biliAuthCodeStatus !== BiliAuthCodeStatusType.Active,
)

onMounted(() => {
  void client.ensureOpenlive().catch(() => undefined)
})

function goPanel() {
  void router.push({ name: 'manage-index', query: { tab: 'info' } })
}
</script>

<template>
  <div class="mb-2.5">
    <Alert
      v-if="needsBind"
      variant="default"
      class="flex items-center justify-between py-2 px-3 border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400"
    >
      <div class="flex items-center gap-2 text-xs">
        <AlertTriangle class="size-4 shrink-0" />
        <AlertDescription class="m-0 text-xs">弹幕相关功能需要先绑定 Bilibili 主播账号。</AlertDescription>
      </div>
      <Button
        size="xs"
        variant="outline"
        class="h-6 px-2 text-[11px] border-amber-500/30 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300"
        @click="goPanel"
      >
        前往面板绑定
      </Button>
    </Alert>

    <Alert
      v-else-if="needsCodeUpdate"
      variant="destructive"
      class="flex items-center justify-between py-2 px-3"
    >
      <div class="flex items-center gap-2 text-xs">
        <ShieldAlert class="size-4 shrink-0" />
        <AlertDescription class="m-0 text-xs">
          身份码状态异常（{{ authCodeLabel }}），实时弹幕可能无法正常工作。
        </AlertDescription>
      </div>
      <Button
        size="xs"
        variant="outline"
        class="h-6 px-2 text-[11px] border-destructive/30 hover:bg-destructive/20"
        @click="goPanel"
      >
        更新身份码
      </Button>
    </Alert>

    <div
      v-else
      class="flex items-center gap-2 flex-wrap py-2 px-3 rounded-lg border border-border bg-muted/40 text-xs text-muted-foreground"
    >
      <Tag size="small" :type="authCodeType" :bordered="false">
        {{ authCodeLabel }}
      </Tag>
      <Tag size="small" :type="client.connected ? 'success' : 'warning'" :bordered="false">
        {{ client.connectionStatus }}
      </Tag>
      <span v-if="client.reconnectCount > 0" class="text-[11px]">
        重连 {{ client.reconnectCount }} 次
      </span>
      <span class="text-[11px] text-muted-foreground/80">
        后台标签页会限制定时器与 WebSocket，建议保持页面前台或使用 EventFetcher。
      </span>
    </div>
  </div>
</template>
