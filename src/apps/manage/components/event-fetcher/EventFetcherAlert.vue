<script setup lang="ts">
import { useRouter } from 'vue-router'
import { AlertCircle } from 'lucide-vue-next'

import { useAccount } from '@/api/account'
import { Alert, AlertDescription } from '@/shared/ui/alert'
import { Button } from '@/shared/ui/button'

const accountInfo = useAccount()
const router = useRouter()

function goBindBili() {
  void router.push({ name: 'manage-index', query: { tab: 'info' } })
}
</script>

<template>
  <Alert
    v-if="!accountInfo?.isBiliVerified"
    variant="default"
    class="border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400"
  >
    <AlertCircle class="size-4 shrink-0" />
    <AlertDescription class="text-xs flex items-center gap-1.5 flex-wrap">
      <span>使用此功能前你需要先</span>
      <Button
        variant="link"
        size="sm"
        class="h-auto p-0 text-xs text-blue-500 hover:underline"
        @click="goBindBili"
      >
        在面板绑定 Bilibili 账号
      </Button>
    </AlertDescription>
  </Alert>
  <Alert
    v-else-if="!accountInfo?.eventFetcherState.online"
    variant="default"
    class="border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400"
  >
    <AlertCircle class="size-4 shrink-0" />
    <AlertDescription class="text-xs flex items-center gap-2 flex-wrap">
      <span>
        使用此功能需要部署
        <a
          href="https://www.wolai.com/fje5wLtcrDoZcb9rk2zrFs"
          target="_blank"
          rel="noreferrer"
          class="font-medium underline hover:text-foreground"
        >
          VtsuruEventFetcher
        </a>
        来获取你的直播数据
      </span>
      <Button
        as="a"
        href="https://www.wolai.com/fje5wLtcrDoZcb9rk2zrFs"
        target="_blank"
        rel="noreferrer"
        variant="outline"
        size="xs"
        class="h-6 px-2 text-[11px]"
      >
        查看部署教程
      </Button>
    </AlertDescription>
  </Alert>
</template>
