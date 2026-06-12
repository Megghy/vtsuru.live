<script setup lang="ts">
import type { LiveControl } from '@/apps/client/composables/useLiveControl'

const props = defineProps<{ control: LiveControl }>()
const c = props.control
</script>

<template>
  <NModal
    v-model:show="c.showFaceAuthModal.value"
    preset="card"
    title="人脸认证"
    style="width: 400px;"
    :closable="true"
    @close="c.closeFaceAuthModal"
  >
    <NFlex
      vertical
      align="center"
      :size="16"
    >
      <NText>
        请使用B站APP扫描下方二维码进行人脸认证
      </NText>

      <div
        v-if="c.faceAuthQrCode.value"
        style="padding: 16px; background: var(--n-card-color); border: 1px solid var(--n-border-color); border-radius: var(--n-border-radius);"
      >
        <img
          :src="c.faceAuthQrCode.value"
          alt="人脸认证二维码"
          style="width: 200px; height: 200px;"
        >
      </div>

      <NText depth="3">
        认证完成后，请关闭此窗口并重新点击"开始直播"
      </NText>

      <NButton
        type="primary"
        @click="c.closeFaceAuthModal"
      >
        关闭
      </NButton>
    </NFlex>
  </NModal>
</template>
