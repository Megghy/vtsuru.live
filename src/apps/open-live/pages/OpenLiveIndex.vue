<script setup lang="ts">
import { useAccount } from '@/api/account'
import type { OpenLiveInfo } from '@/api/api-models'
import OpenLivePageHeader from '@/apps/open-live/components/OpenLivePageHeader.vue'
import { Alert, AlertDescription, AlertTitle } from '@/shared/ui/alert'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/shared/ui/card'

defineProps<{
  roomInfo?: OpenLiveInfo
  code?: string | undefined
}>()

const accountInfo = useAccount()
</script>

<template>
  <div class="flex flex-col gap-3">
    <Card class="p-3">
      <OpenLivePageHeader
        title="开放平台"
        description="直播互动、弹幕姬与创作工具"
      />
    </Card>

    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      <Card class="flex flex-col justify-between hover:shadow-sm transition-shadow">
        <div>
          <CardHeader class="p-4 pb-2">
            <CardTitle class="text-sm font-semibold">弹幕抽奖</CardTitle>
          </CardHeader>
          <CardContent class="p-4 pt-0 text-xs text-muted-foreground">
            通过弹幕或礼物收集用户并抽取，支持多种条件与动画效果。
          </CardContent>
        </div>
        <CardFooter class="p-4 pt-0">
          <Button
            size="sm"
            class="w-full"
            @click="$router.push({ name: 'open-live-lottery', query: $route.query })"
          >
            前往使用
          </Button>
        </CardFooter>
      </Card>

      <Card class="flex flex-col justify-between hover:shadow-sm transition-shadow">
        <div>
          <CardHeader class="p-4 pb-2">
            <CardTitle class="text-sm font-semibold">弹幕点播</CardTitle>
          </CardHeader>
          <CardContent class="p-4 pt-0 text-xs text-muted-foreground">
            通过弹幕或 SC 点歌/点播，登录后可保存配置并支持 OBS 展示。
          </CardContent>
        </div>
        <CardFooter class="p-4 pt-0">
          <Button
            size="sm"
            class="w-full"
            @click="$router.push({ name: 'open-live-live-request', query: $route.query })"
          >
            前往使用
          </Button>
        </CardFooter>
      </Card>

      <Card class="flex flex-col justify-between hover:shadow-sm transition-shadow">
        <div>
          <CardHeader class="p-4 pb-2">
            <CardTitle class="text-sm font-semibold">弹幕排队</CardTitle>
          </CardHeader>
          <CardContent class="p-4 pt-0 text-xs text-muted-foreground">
            通过弹幕或礼物加入队列，支持过滤条件、排序策略与冷却控制。
          </CardContent>
        </div>
        <CardFooter class="p-4 pt-0">
          <Button
            size="sm"
            class="w-full"
            @click="$router.push({ name: 'open-live-queue', query: $route.query })"
          >
            前往使用
          </Button>
        </CardFooter>
      </Card>

      <Card class="flex flex-col justify-between hover:shadow-sm transition-shadow">
        <div>
          <CardHeader class="p-4 pb-2">
            <CardTitle class="text-sm font-semibold">读弹幕</CardTitle>
          </CardHeader>
          <CardContent class="p-4 pt-0 text-xs text-muted-foreground">
            使用浏览器 TTS 朗读弹幕（推荐 Chrome/Edge 等现代浏览器）。
          </CardContent>
        </div>
        <CardFooter class="p-4 pt-0">
          <Button
            size="sm"
            class="w-full"
            @click="$router.push({ name: 'open-live-speech', query: $route.query })"
          >
            前往使用
          </Button>
        </CardFooter>
      </Card>

      <Card class="flex flex-col justify-between hover:shadow-sm transition-shadow">
        <div>
          <CardHeader class="p-4 pb-2">
            <CardTitle class="text-sm font-semibold">弹幕姬</CardTitle>
          </CardHeader>
          <CardContent class="p-4 pt-0 text-xs text-muted-foreground">
            实时展示弹幕、礼物、舰长与醒目留言，可直接调整样式和过滤规则。
          </CardContent>
        </div>
        <CardFooter class="p-4 pt-0">
          <Button
            size="sm"
            class="w-full"
            @click="$router.push({ name: 'open-live-danmuji', query: $route.query })"
          >
            前往使用
          </Button>
        </CardFooter>
      </Card>

      <Card class="flex flex-col justify-between hover:shadow-sm transition-shadow">
        <div>
          <CardHeader class="p-4 pb-2">
            <CardTitle class="text-sm font-semibold">直播工具箱</CardTitle>
          </CardHeader>
          <CardContent class="p-4 pt-0 text-xs text-muted-foreground">
            图片、音视频、封面、二维码、OCR 等工具，无需登录即可在浏览器中使用。
          </CardContent>
        </div>
        <CardFooter class="p-4 pt-0">
          <Button
            size="sm"
            class="w-full"
            @click="$router.push({ name: 'open-live-tools', query: $route.query })"
          >
            前往使用
          </Button>
        </CardFooter>
      </Card>
    </div>

    <Alert
      v-if="accountInfo?.eventFetcherState?.online !== true"
      class="border-amber-500/30 bg-amber-50/50 dark:bg-amber-950/20 text-xs"
    >
      <AlertTitle class="text-xs font-semibold text-amber-800 dark:text-amber-300">可用性提醒</AlertTitle>
      <AlertDescription class="text-xs text-amber-700 dark:text-amber-400 mt-1">
        当浏览器在后台运行时，计时器和 WebSocket 连接会受到严格限制，可能导致弹幕接收不稳定（详见
        <a
          href="https://developer.chrome.com/blog/background_tabs/"
          target="_blank"
          class="text-primary hover:underline underline-offset-2"
        >
          此文章
        </a>）。建议注册并部署
        <a
          href="https://www.wolai.com/fje5wLtcrDoZcb9rk2zrFs"
          target="_blank"
          class="text-primary font-medium hover:underline underline-offset-2"
        >
          VtsuruEventFetcher
        </a>。
      </AlertDescription>
    </Alert>

    <Card class="p-3">
      <OpenLivePageHeader title="还有更多">
        <template #description>
          <span class="text-xs text-muted-foreground"> 舰长积分、动态抽奖、视频征集、歌单、棉花糖、日程表... </span>
        </template>
        <template #actions>
          <Button
            as="a"
            href="/"
            target="_blank"
            variant="ghost"
            size="sm"
            class="text-primary"
          >
            VTsuru.live
          </Button>
          <Button
            as="a"
            href="/about"
            target="_blank"
            variant="ghost"
            size="sm"
            class="text-muted-foreground"
          >
            关于本站
          </Button>
        </template>
      </OpenLivePageHeader>
    </Card>
  </div>
</template>
