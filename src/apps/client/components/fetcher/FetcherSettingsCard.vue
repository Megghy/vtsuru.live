<script setup lang="ts">
import { HelpCircle } from '@vicons/ionicons5'
import { toast } from 'vue-sonner'

import { callStartDanmakuClient, resetDanmakuClientInitState } from '@/apps/client/data/initialize'
import { useBiliCookie } from '@/apps/client/store/useBiliCookie'
import { useSettings } from '@/apps/client/store/useSettings'
import { useWebFetcher } from '@/store/useWebFetcher'
import { Alert, AlertDescription } from '@/shared/ui/alert'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { Popconfirm } from '@/shared/ui/popconfirm'
import { Switch } from '@/shared/ui/switch'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/ui/tooltip'

const webfetcher = useWebFetcher()
const biliCookie = useBiliCookie()
const settings = useSettings()

async function onSwitchDanmakuClientMode(type: 'openlive' | 'direct', force: boolean = false) {
  if (webfetcher.webfetcherType === type && !force) {
    toast.info('当前已是该模式')
    return
  }
  const noticeRef = window.$notification?.info?.({
    title: 'WebEventFetcher',
    content: '正在关闭弹幕服务器...',
    closable: false,
  })
  settings.settings.useDanmakuClientType = type
  settings.save()
  await webfetcher.Stop()
  if (noticeRef) noticeRef.content = '正在连接弹幕服务器...'
  const result = await callStartDanmakuClient()
  noticeRef?.destroy?.()
  if (result.success) {
    window.$notification?.success?.({
      title: 'WebEventFetcher',
      content: `${webfetcher.webfetcherType} 弹幕客户端连接成功`,
      closable: true,
      duration: 3000,
    })
    toast.success(`${webfetcher.webfetcherType} 弹幕客户端连接成功`)
  } else {
    window.$notification?.error?.({
      title: 'WebEventFetcher',
      content: `弹幕服务器连接失败: ${result.message}`,
      closable: true,
    })
    toast.error(`弹幕服务器连接失败: ${result.message}`)
  }
}

async function handleToggleEventFetcher(enabled: boolean) {
  await settings.save()
  if (enabled) {
    toast.info('正在启动 EventFetcher...')
    const result = await callStartDanmakuClient()
    if (result.success) {
      toast.success('EventFetcher 已启动')
    } else {
      toast.error(`EventFetcher 启动失败: ${result.message}`)
    }
  } else {
    if (webfetcher.state !== 'disconnected') {
      await webfetcher.Stop()
      toast.info('EventFetcher 已停止')
    }
    resetDanmakuClientInitState()
  }
}
</script>

<template>
  <Card class="border bg-card w-full">
    <CardHeader class="p-3 pb-2 border-b">
      <CardTitle class="text-sm font-semibold">设置</CardTitle>
    </CardHeader>
    <CardContent class="p-3 space-y-4">
      <!-- EventFetcher 功能开关 -->
      <div class="space-y-2">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-1">
            <span class="text-xs font-semibold text-foreground">EventFetcher 功能</span>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger as-child>
                  <HelpCircle class="size-4 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent class="max-w-[300px] text-xs">
                  <p class="mb-1">启用后，系统将会：</p>
                  <ul class="pl-4 list-disc space-y-0.5">
                    <li>连接到 SignalR 服务器</li>
                    <li>启动弹幕客户端接收直播间消息</li>
                    <li>收集并上传直播间事件数据</li>
                    <li>显示实时统计信息</li>
                  </ul>
                  <p class="mt-1">关闭后，所有 EventFetcher 相关功能将停止工作。</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <div class="flex items-center gap-2">
            <span class="text-xs text-muted-foreground">
              {{ settings.settings.enableEventFetcher ? '已启用' : '已禁用' }}
            </span>
            <Switch :checked="settings.settings.enableEventFetcher" :disabled="webfetcher.state === 'connecting'" @update:checked="settings.settings.enableEventFetcher = $event; handleToggleEventFetcher($event)" />
          </div>
        </div>

        <Alert
          v-if="!settings.settings.enableEventFetcher"
          class="py-2 px-2.5 border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400"
        >
          <AlertDescription class="text-xs m-0">
            EventFetcher 功能已禁用，直播间事件数据将不会被收集和上传
          </AlertDescription>
        </Alert>
      </div>

      <div class="h-px bg-border" />

      <!-- 弹幕客户端模式选择 -->
      <div class="space-y-2">
        <span class="text-xs font-semibold text-foreground block">弹幕客户端模式</span>
        <div class="inline-flex rounded-md border border-input p-0.5 bg-background text-muted-foreground">
          <button
            type="button"
            :disabled="webfetcher.state === 'connecting' || !settings.settings.enableEventFetcher"
            class="px-2.5 py-1 text-xs font-medium rounded-sm transition-all"
            :class="settings.settings.useDanmakuClientType === 'openlive' ? 'bg-primary text-primary-foreground shadow-sm' : 'hover:text-foreground'"
            @click="onSwitchDanmakuClientMode('openlive')"
          >
            开放平台
          </button>

          <TooltipProvider>
            <Tooltip v-if="!biliCookie.isCookieValid">
              <TooltipTrigger as-child>
                <button
                  type="button"
                  disabled
                  class="px-2.5 py-1 text-xs font-medium rounded-sm opacity-50 cursor-not-allowed"
                >
                  直接连接
                </button>
              </TooltipTrigger>
              <TooltipContent class="text-xs">
                请先登录 B 站账号以使用直接连接模式
              </TooltipContent>
            </Tooltip>
            <button
              v-else
              type="button"
              :disabled="webfetcher.state === 'connecting' || !settings.settings.enableEventFetcher"
              class="px-2.5 py-1 text-xs font-medium rounded-sm transition-all"
              :class="settings.settings.useDanmakuClientType === 'direct' ? 'bg-primary text-primary-foreground shadow-sm' : 'hover:text-foreground'"
              @click="onSwitchDanmakuClientMode('direct')"
            >
              直接连接
            </button>
          </TooltipProvider>
        </div>
      </div>

      <div>
        <Popconfirm
          title="强制重启"
          :disabled="webfetcher.state === 'connecting' || !settings.settings.enableEventFetcher"
          @positive-click="
            async () => {
              await onSwitchDanmakuClientMode(settings.settings.useDanmakuClientType, true)
              toast.success('已重启弹幕服务器')
            }
          "
        >
          <template #trigger>
            <Button variant="outline" class="border-destructive/40 text-destructive hover:bg-destructive/10" :disabled="webfetcher.state === 'connecting' || !settings.settings.enableEventFetcher">
              强制重启弹幕客户端
            </Button>
          </template>
          确定要强制重启弹幕服务器吗？
        </Popconfirm>
      </div>
    </CardContent>
  </Card>
</template>
