<script setup lang="ts">
import { isPermissionGranted, onAction, sendNotification } from '@tauri-apps/plugin-notification';

async function testNotification() {
  let permissionGranted = await isPermissionGranted();
    if (permissionGranted) {
      sendNotification({
        title: "测试通知",
        body: "这是一个测试通知",
        silent: false,
        extra: { type: 'test' },
      });
      onAction((event) => {
        console.log('Notification clicked:', event);
      });
    }
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
    </NFlex>
  </div>
</template>