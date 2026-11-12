<script setup lang="ts">
import HelpCircle from '@vicons/ionicons5/es/HelpCircle'
import { toast } from 'vue-sonner'

// Fix vue-tsc type inference issue in template inline functions
const showToast = toast

import { callStartDanmakuClient, resetDanmakuClientInitState } from '@/apps/client/data/initialize'
import { useBiliCookie } from '@/apps/client/store/useBiliCookie'
import { useSettings } from '@/apps/client/store/useSettings'
import { Alert, AlertDescription } from '@/shared/ui/alert'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { Popconfirm } from '@/shared/ui/popconfirm'
import { Separator } from '@/shared/ui/separator'
import { SettingRow } from '@/shared/ui/setting-row'
import { Switch } from '@/shared/ui/switch'
import { ToggleGroup, ToggleGroupItem } from '@/shared/ui/toggle-group'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/ui/tooltip'
import { useWebFetcher } from '@/store/useWebFetcher'

const webfetcher = useWebFetcher()
const biliCookie = useBiliCookie()
const settings = useSettings()

async function onSwitchDanmakuClientMode(type: 'openlive' | 'direct', force: boolean = false) {
  if (webfetcher.webfetcherType === type && !force) {
    showToast.info('当前已是该模式')
    return
  }
  const noticeId = 'webfetcher-switch'
  showToast.loading('WebEventFetcher', {
    id: noticeId,
    description: '正在关闭弹幕服务器...',
    duration: Infinity,
  })
  settings.settings.useDanmakuClientType = type
  settings.save()
  await webfetcher.Stop()
  showToast.loading('WebEventFetcher', {
    id: noticeId,
    description: '正在连接弹幕服务器...',
    duration: Infinity,
  })
  const result = await callStartDanmakuClient()
  showToast.dismiss(noticeId)
  if (result.success) {
    window.$notification?.success?.({
      title: 'WebEventFetcher',
      content: `${webfetcher.webfetcherType} 弹幕客户端连接成功`,
      closable: true,
      duration: 3000,
    })
    showToast.success(`${webfetcher.webfetcherType} 弹幕客户端连接成功`)
  } else {
    window.$notification?.error?.({
      title: 'WebEventFetcher',
      content: `弹幕服务器连接失败: ${result.message}`,
      closable: true,
    })
    showToast.error(`弹幕服务器连接失败: ${result.message}`)
  }
}

async function handleToggleEventFetcher(enabled: boolean) {
  await settings.save()
  if (enabled) {
    showToast.info('正在启动 EventFetcher...')
    const result = await callStartDanmakuClient()
    if (result.success) {
      showToast.success('EventFetcher 已启动')
    } else {
      showToast.error(`EventFetcher 启动失败: ${result.message}`)
    }
  } else {
    if (webfetcher.state !== 'disconnected') {
      await webfetcher.Stop()
      showToast.info('EventFetcher 已停止')
    }
    resetDanmakuClientInitState()
  }
}

async function handleForceRestartDanmaku() {
  await onSwitchDanmakuClientMode(settings.settings.useDanmakuClientType, true)
  showToast.success('已重启弹幕服务器')
}
</script>

<template>
  <Card class="w-full">
    <CardHeader class="p-3 border-b">
      <CardTitle>设置</CardTitle>
    </CardHeader>
    <CardContent class="p-3 space-y-4">
      <!-- EventFetcher 功能开关 -->
      <div class="space-y-2">
        <SettingRow
          variant="none"
          title="EventFetcher 功能"
        >
          <template #hint>
            <p class="mb-1">启用后，系统将会：</p>
            <ul class="pl-4 list-disc space-y-0.5">
              <li>连接到 SignalR 服务器</li>
              <li>启动弹幕客户端接收直播间消息</li>
              <li>收集并上传直播间事件数据</li>
              <li>显示实时统计信息</li>
            </ul>
            <p class="mt-1">关闭后，所有 EventFetcher 相关功能将停止工作。</p>
          </template>
          <span class="text-xs text-muted-foreground">
            {{ settings.settings.enableEventFetcher ? '已启用' : '已禁用' }}
          </span>
          <Switch
            :checked="settings.settings.enableEventFetcher"
            :disabled="webfetcher.state === 'connecting'"
            @update:checked="((settings.settings.enableEventFetcher = $event), handleToggleEventFetcher($event))"
          />
        </SettingRow>

        <Alert
          size="sm"
          variant="warning"
          v-if="!settings.settings.enableEventFetcher"
        >
          <AlertDescription class="m-0"> EventFetcher 功能已禁用，直播间事件数据将不会被收集和上传 </AlertDescription>
        </Alert>
      </div>

      <Separator />

      <!-- 弹幕客户端模式选择 -->
      <div class="space-y-2">
        <span class="text-xs font-semibold text-foreground block">弹幕客户端模式</span>
        <ToggleGroup
          type="single"
          :model-value="settings.settings.useDanmakuClientType"
          @update:model-value="
            (val) => {
              if (val) onSwitchDanmakuClientMode(val as any)
            }
          "
        >
          <ToggleGroupItem
            value="openlive"
            :disabled="webfetcher.state === 'connecting' || !settings.settings.enableEventFetcher"
          >
            开放平台
          </ToggleGroupItem>

          <TooltipProvider>
            <Tooltip v-if="!biliCookie.isCookieValid">
              <TooltipTrigger as-child>
                <span>
                  <ToggleGroupItem
                    value="direct"
                    disabled
                  >
                    直接连接
                  </ToggleGroupItem>
                </span>
              </TooltipTrigger>
              <TooltipContent> 请先登录 B 站账号以使用直接连接模式 </TooltipContent>
            </Tooltip>
            <ToggleGroupItem
              v-else
              value="direct"
              :disabled="webfetcher.state === 'connecting' || !settings.settings.enableEventFetcher"
            >
              直接连接
            </ToggleGroupItem>
          </TooltipProvider>
        </ToggleGroup>
      </div>

      <div>
        <Popconfirm
          title="强制重启"
          :disabled="webfetcher.state === 'connecting' || !settings.settings.enableEventFetcher"
          @positive-click="handleForceRestartDanmaku"
        >
          <template #trigger>
            <Button
              variant="outline"
              class="border-destructive/40 text-destructive hover:bg-destructive/10"
              :disabled="webfetcher.state === 'connecting' || !settings.settings.enableEventFetcher"
            >
              强制重启弹幕客户端
            </Button>
          </template>
          确定要强制重启弹幕服务器吗？
        </Popconfirm>
      </div>
    </CardContent>
  </Card>
</template>
