<script setup lang="ts">
import type { LiveControl } from '@/apps/client/composables/useLiveControl'

const props = defineProps<{ control: LiveControl }>()
const c = props.control
</script>

<template>
  <UModal
    v-model:open="c.showFaceAuthModal.value"
    preset="card"
    title="人脸认证"
    style="width: 400px"
    :closable="true"
    @close="c.closeFaceAuthModal"
  >
    <div
      vertical
      align="center"
      :size="16"
    >
      <span> 请使用B站APP扫描下方二维码进行人脸认证 </span>

      <div
        v-if="c.faceAuthQrCode.value"
        style="
          padding: 16px;
          background: var(--vtsuru-bg-surface);
          border: 1px solid var(--vtsuru-border);
          border-radius: var(--vtsuru-radius);
        "
      >
        <img
          :src="c.faceAuthQrCode.value"
          alt="人脸认证二维码"
          style="width: 200px; height: 200px"
        />
      </div>

      <span depth="3"> 认证完成后，请关闭此窗口并重新点击"开始直播" </span>

      <UButton
        color="primary"
        @click="c.closeFaceAuthModal"
      >
        关闭
      </UButton>
    </div>
  </UModal>
</template>
