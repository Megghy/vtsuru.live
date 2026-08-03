<script setup lang="ts">
import type { LiveControl } from '@/apps/client/composables/useLiveControl'
import { roomInfo } from '@/apps/client/data/info'

const props = defineProps<{ control: LiveControl }>()
const c = props.control

function selectCover(event: Event) {
  c.handleCoverFileChange((event.target as HTMLInputElement).files?.[0])
}
</script>

<template>
  <div>
    <span strong> 直播封面： </span>
    <div
      :size="16"
      style="margin-top: 8px"
    >
      <!-- 现有封面显示 -->
      <div style="flex-shrink: 0">
        <span
          depth="3"
          style="display: block; margin-bottom: 8px"
        >
          当前封面
        </span>
        <div
          style="
            width: 160px;
            height: 90px;
            border-radius: var(--vtsuru-radius);
            overflow: hidden;
            background: var(--vtsuru-bg-inset);
            border: 1px solid var(--vtsuru-border);
            display: flex;
            align-items: center;
            justify-content: center;
          "
        >
          <img
            v-if="roomInfo?.user_cover || roomInfo?.keyframe"
            :src="roomInfo?.user_cover || roomInfo?.keyframe"
            alt="当前直播封面"
            style="width: 100%; height: 100%; object-fit: cover"
          />
          <span
            v-else
            depth="3"
            style="font-size: 12px"
          >
            暂无封面
          </span>
        </div>
      </div>

      <!-- 新封面上传和预览 -->
      <div style="flex: 1">
        <span
          depth="3"
          style="display: block; margin-bottom: 8px"
        >
          上传新封面
        </span>
        <div
          vertical
          :size="8"
        >
          <div :size="8">
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              @change="selectCover"
            />
            <UButton
              color="primary"
              :loading="c.isUploadingCover.value"
              :disabled="!c.coverFile.value"
              @click="c.handleUploadCover"
            >
              上传并应用
            </UButton>
          </div>

          <!-- 新封面预览 -->
          <div
            v-if="c.coverPreviewUrl.value"
            style="
              width: 160px;
              height: 90px;
              border-radius: var(--vtsuru-radius);
              overflow: hidden;
              border: 2px solid var(--vtsuru-border);
            "
          >
            <img
              :src="c.coverPreviewUrl.value"
              alt="新封面预览"
              style="width: 100%; height: 100%; object-fit: cover"
            />
          </div>
          <span
            depth="3"
            style="font-size: 12px"
          >
            支持 JPG / PNG / WEBP，大小不超过 5MB
          </span>
        </div>
      </div>
    </div>
  </div>
</template>
