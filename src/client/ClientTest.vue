<script setup lang="ts">
import { isPermissionGranted, onAction, sendNotification } from '@tauri-apps/plugin-notification';
  import { NSwitch } from 'naive-ui';
import { useSettings } from './store/useSettings';
import { onReceivedQuestion } from './data/notification';
import { QAInfo } from '@/api/api-models';

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
  } as QAInfo);
}
</script>

<template>
  <div>
    <NFlex>
      <NButton
        type="primary"
        @click="testNotification"
      >
        测试通知
      </NButton>
      <NButton
        type="primary"
        @click="$router.push({ name: 'client-danmaku-window-manage'})"
      >
      弹幕机
      </NButton>
      <LabelItem label="关闭弹幕客户端">
        <NSwitch
          v-model:value="setting.settings.dev_disableDanmakuClient"
          @update:value="setting.save()"
        />
      </LabelItem>
    </NFlex>
  </div>
</template>