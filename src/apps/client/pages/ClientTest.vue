<script setup lang="ts">
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
  <div
    vertical
    :size="12"
  >
    <UCard
      size="small"
      bordered
    >
      <ClientPageHeader
        title="测试"
        description="开发与调试入口（仅用于内部测试）"
      />
    </UCard>

    <UCard
      size="small"
      bordered
    >
      <div
        :wrap="true"
        :size="12"
        align="center"
      >
        <UButton
          color="primary"
          size="small"
          @click="testNotification"
        >
          测试通知
        </UButton>
        <UButton
          color="primary"
          size="small"
          @click="$router.push({ name: 'client-danmaku-window-manage' })"
        >
          弹幕机
        </UButton>
        <LabelItem label="关闭弹幕客户端">
          <USwitch
            v-model="setting.settings.dev_disableDanmakuClient"
            size="small"
            @update:model-value="setting.save()"
          />
        </LabelItem>
      </div>
    </UCard>
  </div>
</template>
