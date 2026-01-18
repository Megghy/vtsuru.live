<script setup lang="ts">
import type { QAInfo } from '@/api/api-models'
import { NButton, NCard, NFlex, NSwitch } from 'naive-ui';
import { onReceivedQuestion } from '@/apps/client/data/notification'
import { useSettings } from '@/apps/client/store/useSettings'
import ClientPageHeader from '@/apps/client/components/ClientPageHeader.vue'
import LabelItem from '@/apps/client/components/LabelItem.vue'

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
  <NFlex vertical :size="12">
    <NCard size="small" bordered>
      <ClientPageHeader
        title="测试"
        description="开发与调试入口（仅用于内部测试）"
      />
    </NCard>

    <NCard size="small" bordered>
      <NFlex :wrap="true" :size="12" align="center">
        <NButton type="primary" size="small" @click="testNotification">
          测试通知
        </NButton>
        <NButton
          type="primary"
          size="small"
          @click="$router.push({ name: 'client-danmaku-window-manage' })"
        >
          弹幕机
        </NButton>
        <LabelItem label="关闭弹幕客户端">
          <NSwitch
            v-model:value="setting.settings.dev_disableDanmakuClient"
            size="small"
            @update:value="setting.save()"
          />
        </LabelItem>
      </NFlex>
    </NCard>
  </NFlex>
</template>
