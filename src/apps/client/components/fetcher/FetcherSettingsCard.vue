<script setup lang="ts">
import { HelpCircle } from '@vicons/ionicons5'
import { useMessage } from 'naive-ui'
import { useWebFetcher } from '@/store/useWebFetcher'
import { callStartDanmakuClient, resetDanmakuClientInitState } from '@/apps/client/data/initialize'
import { useBiliCookie } from '@/apps/client/store/useBiliCookie'
import { useSettings } from '@/apps/client/store/useSettings'

const webfetcher = useWebFetcher()
const biliCookie = useBiliCookie()
const settings = useSettings()
const message = useMessage()

async function onSwitchDanmakuClientMode(type: 'openlive' | 'direct', force: boolean = false) {
  if (webfetcher.webfetcherType === type && !force) {
    message.info('当前已是该模式')
    return
  }
  const noticeRef = window.$notification.info({
    title: 'WebEventFetcher',
    content: '正在关闭弹幕服务器...',
    closable: false,
  })
  settings.settings.useDanmakuClientType = type
  settings.save()
  await webfetcher.Stop()
  noticeRef.content = '正在连接弹幕服务器...'
  const result = await callStartDanmakuClient()
  noticeRef.destroy()
  if (result.success) {
    window.$notification.success({
      title: 'WebEventFetcher',
      content: `${webfetcher.webfetcherType} 弹幕客户端连接成功`,
      closable: true,
      duration: 3000,
    })
  } else {
    window.$notification.error({
      title: 'WebEventFetcher',
      content: `弹幕服务器连接失败: ${result.message}`,
      closable: true,
    })
  }
}

async function handleToggleEventFetcher(enabled: boolean) {
  await settings.save()
  if (enabled) {
    message.info('正在启动 EventFetcher...')
    const result = await callStartDanmakuClient()
    if (result.success) {
      message.success('EventFetcher 已启动')
    } else {
      message.error(`EventFetcher 启动失败: ${result.message}`)
    }
  } else {
    if (webfetcher.state !== 'disconnected') {
      await webfetcher.Stop()
      message.info('EventFetcher 已停止')
    }
    resetDanmakuClientInitState()
  }
}
</script>

<template>
  <NCard title="设置" size="small" bordered style="width: 100%;">
    <NFlex vertical gap="large">
      <!-- EventFetcher 功能开关 -->
      <div>
        <NFlex align="center" justify="space-between" style="margin-bottom: 0.5rem;">
          <div>
            <NText strong>
              EventFetcher 功能
            </NText>
            <NTooltip>
              <template #trigger>
                <NIcon :component="HelpCircle" style="margin-left: 0.25rem; cursor: help;" />
              </template>
              <div style="max-width: 300px;">
                <p style="margin: 0 0 8px;">
                  启用后，系统将会：
                </p>
                <ul style="padding-left: 18px; margin: 0;">
                  <li>连接到 SignalR 服务器</li>
                  <li>启动弹幕客户端接收直播间消息</li>
                  <li>收集并上传直播间事件数据</li>
                  <li>显示实时统计信息</li>
                </ul>
                <p style="margin: 8px 0 0;">
                  关闭后，所有 EventFetcher 相关功能将停止工作。
                </p>
              </div>
            </NTooltip>
          </div>
          <NSwitch
            v-model:value="settings.settings.enableEventFetcher"
            :disabled="webfetcher.state === 'connecting'"
            @update:value="handleToggleEventFetcher"
          >
            <template #checked>
              已启用
            </template>
            <template #unchecked>
              已禁用
            </template>
          </NSwitch>
        </NFlex>
        <NAlert
          v-if="!settings.settings.enableEventFetcher"
          type="warning"
          :bordered="false"
          style="margin-top: 0.5rem;"
        >
          EventFetcher 功能已禁用，直播间事件数据将不会被收集和上传
        </NAlert>
      </div>

      <NDivider style="margin: 0;" />

      <!-- 弹幕客户端模式选择 -->
      <div>
        <NText strong style="display: block; margin-bottom: 0.5rem;">
          弹幕客户端模式
        </NText>
        <NRadioGroup
          v-model:value="settings.settings.useDanmakuClientType"
          :disabled="webfetcher.state === 'connecting' || !settings.settings.enableEventFetcher"
          @update-value="v => onSwitchDanmakuClientMode(v)"
        >
          <NRadioButton value="openlive">
            开放平台
          </NRadioButton>
          <NRadioButton
            value="direct"
            :disabled="!biliCookie.isCookieValid || !settings.settings.enableEventFetcher"
          >
            <NTooltip v-if="!biliCookie.isCookieValid">
              <template #trigger>
                直接连接
              </template>
              请先登录 B 站账号以使用直接连接模式
            </NTooltip>
            <NText v-else>
              直接连接
            </NText>
          </NRadioButton>
        </NRadioGroup>
      </div>

      <NPopconfirm
        type="info"
        :disabled="webfetcher.state === 'connecting' || !settings.settings.enableEventFetcher"
        @positive-click="async () => {
          await onSwitchDanmakuClientMode(settings.settings.useDanmakuClientType, true);
          message.success('已重启弹幕服务器');
        }"
      >
        <template #trigger>
          <NButton
            type="error"
            style="max-width: 180px;"
            :disabled="webfetcher.state === 'connecting' || !settings.settings.enableEventFetcher"
          >
            强制重启弹幕客户端
          </NButton>
        </template>
        <template #default>
          确定要强制重启弹幕服务器吗？
        </template>
      </NPopconfirm>
    </NFlex>
  </NCard>
</template>
