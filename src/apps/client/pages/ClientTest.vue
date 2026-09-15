<script setup lang="ts">
import { Alert24Filled, Chat24Filled, Code24Filled } from '@vicons/fluent'
import { NButton, NCard, NFlex, NIcon, NSwitch, NText } from 'naive-ui'

import type { QAInfo } from '@/api/api-models'
import ClientPageHeader from '@/apps/client/components/ClientPageHeader.vue'
import LabelItem from '@/apps/client/components/LabelItem.vue'
import { onReceivedQuestion } from '@/apps/client/data/notification'
import { useSettings } from '@/apps/client/store/useSettings'

const setting = useSettings()

async function testNotification() {
  onReceivedQuestion({
    id: 1,
    question: {
      message: '这是一条测试问题',
    },
    tag: '测试标签',
    sender: { name: '测试用户', id: 1, isBiliAuthed: false },
    isPublic: true,
  } as QAInfo)
}
</script>

<template>
  <div class="client-readable">
    <NFlex
      vertical
      :size="14"
    >
      <ClientPageHeader
        title="开发与测试工具"
        description="用于本地快速触发事件、调试系统通知与排查桌面客户端运行状态"
      />

      <NCard
        title="调试操作"
        size="small"
        bordered
      >
        <NFlex
          vertical
          :size="14"
        >
          <NFlex
            align="center"
            :size="10"
            wrap
          >
            <NButton
              type="primary"
              secondary
              size="small"
              @click="testNotification"
            >
              <template #icon>
                <NIcon :component="Alert24Filled" />
              </template>
              测试触发提问通知
            </NButton>

            <NButton
              secondary
              size="small"
              @click="$router.push({ name: 'client-danmaku-window-manage' })"
            >
              <template #icon>
                <NIcon :component="Chat24Filled" />
              </template>
              跳转弹幕机配置
            </NButton>
          </NFlex>

          <LabelItem
            label="禁用弹幕客户端 (开发调试)"
            description="开启后在开发环境下跳过本地弹幕 WebSocket 连接"
          >
            <NSwitch
              v-model:value="setting.settings.dev_disableDanmakuClient"
              size="small"
              @update:value="setting.save()"
            />
          </LabelItem>
        </NFlex>
      </NCard>
    </NFlex>
  </div>
</template>
