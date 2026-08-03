<script setup lang="ts">
import { callStartDanmakuClient, resetDanmakuClientInitState } from '@/apps/client/data/initialize'
import { useBiliCookie } from '@/apps/client/store/useBiliCookie'
import { useSettings } from '@/apps/client/store/useSettings'
import { useWebFetcher } from '@/store/useWebFetcher'

const webfetcher = useWebFetcher()
const biliCookie = useBiliCookie()
const settings = useSettings()
const toast = useToast()
const feedback = (color: 'success' | 'error' | 'warning' | 'info', title: string) => {
  toast.add({ title, color })
}

async function onSwitchDanmakuClientMode(type: 'openlive' | 'direct', force: boolean = false) {
  if (webfetcher.webfetcherType === type && !force) {
    feedback('info', '当前已是该模式')
    return
  }
  const noticeRef = toast.add({
    color: 'info',
    title: 'WebEventFetcher',
    description: '正在关闭弹幕服务器...',
    close: false,
  })
  settings.settings.useDanmakuClientType = type
  settings.save()
  await webfetcher.Stop()
  toast.update(noticeRef.id, { description: '正在连接弹幕服务器...' })
  const result = await callStartDanmakuClient()
  toast.remove(noticeRef.id)
  if (result.success) {
    toast.add({
      color: 'success',
      title: 'WebEventFetcher',
      description: `${webfetcher.webfetcherType} 弹幕客户端连接成功`,
      close: true,
      duration: 3000,
    })
  } else {
    toast.add({
      color: 'error',
      title: 'WebEventFetcher',
      description: `弹幕服务器连接失败: ${result.message}`,
      close: true,
    })
  }
}

async function handleToggleEventFetcher(enabled: boolean) {
  await settings.save()
  if (enabled) {
    feedback('info', '正在启动 EventFetcher...')
    const result = await callStartDanmakuClient()
    if (result.success) {
      feedback('success', 'EventFetcher 已启动')
    } else {
      feedback('error', `EventFetcher 启动失败: ${result.message}`)
    }
  } else {
    if (webfetcher.state !== 'disconnected') {
      await webfetcher.Stop()
      feedback('info', 'EventFetcher 已停止')
    }
    resetDanmakuClientInitState()
  }
}
</script>

<template>
  <UCard
    title="设置"
    size="small"
    bordered
    style="width: 100%"
  >
    <div
      vertical
      :size="16"
    >
      <!-- EventFetcher 功能开关 -->
      <div>
        <div
          align="center"
          justify="space-between"
          style="margin-bottom: 8px"
        >
          <div>
            <span strong> EventFetcher 功能 </span>
            <UTooltip>
              <UIcon
                name="i-lucide-circle"
                style="margin-left: 4px; cursor: help"
              />
              <template #content>
                <div style="max-width: 300px">
                  <p style="margin: 0 0 8px">启用后，系统将会：</p>
                  <ul style="padding-left: 18px; margin: 0">
                    <li>连接到 SignalR 服务器</li>
                    <li>启动弹幕客户端接收直播间消息</li>
                    <li>收集并上传直播间事件数据</li>
                    <li>显示实时统计信息</li>
                  </ul>
                  <p style="margin: 8px 0 0">关闭后，所有 EventFetcher 相关功能将停止工作。</p>
                </div>
              </template>
            </UTooltip>
          </div>
          <USwitch
            v-model="settings.settings.enableEventFetcher"
            :disabled="webfetcher.state === 'connecting'"
            @update:model-value="handleToggleEventFetcher"
          >
            <template v-if="false"> 已启用 </template>
            <template v-if="false"> 已禁用 </template>
          </USwitch>
        </div>
        <UAlert
          v-if="!settings.settings.enableEventFetcher"
          type="warning"
          :bordered="false"
          style="margin-top: 8px"
        >
          EventFetcher 功能已禁用，直播间事件数据将不会被收集和上传
        </UAlert>
      </div>

      <USeparator style="margin: 0" />

      <!-- 弹幕客户端模式选择 -->
      <div>
        <span
          strong
          style="display: block; margin-bottom: 8px"
        >
          弹幕客户端模式
        </span>
        <URadioGroup
          v-model="settings.settings.useDanmakuClientType"
          :disabled="webfetcher.state === 'connecting' || !settings.settings.enableEventFetcher"
          :items="[
            { label: '开放平台', value: 'openlive' },
            { label: '直接连接', value: 'direct', disabled: !biliCookie.isCookieValid },
          ]"
          orientation="horizontal"
          @update:model-value="onSwitchDanmakuClientMode"
        />
      </div>

      <UPopover>
        <UButton
          color="error"
          style="max-width: 180px"
          :disabled="webfetcher.state === 'connecting' || !settings.settings.enableEventFetcher"
        >
          强制重启弹幕客户端
        </UButton>
        <template #content="{ close }">
          <div class="space-y-3 p-3">
            <div>确定要强制重启弹幕服务器吗？</div>
            <div class="flex justify-end gap-2">
              <UButton
                size="xs"
                color="neutral"
                variant="ghost"
                @click="close"
                >取消</UButton
              >
              <UButton
                size="xs"
                color="info"
                @click="
                  async () => {
                    close()
                    await onSwitchDanmakuClientMode(settings.settings.useDanmakuClientType, true)
                    feedback('success', '已重启弹幕服务器')
                  }
                "
                >确认</UButton
              >
            </div>
          </div>
        </template>
      </UPopover>
    </div>
  </UCard>
</template>
