<script setup lang="ts">
import type { LiveControl } from '@/apps/client/composables/useLiveControl'
import { roomInfo } from '@/apps/client/data/info'

const props = defineProps<{ control: LiveControl }>()
const c = props.control
</script>

<template>
  <div>
    <NText strong>
      直播封面：
    </NText>
    <NFlex
      gap="medium"
      style="margin-top: 0.5rem;"
    >
      <!-- 现有封面显示 -->
      <div style="flex-shrink: 0;">
        <NText
          depth="3"
          style="display: block; margin-bottom: 0.5rem;"
        >
          当前封面
        </NText>
        <div
          style="
            width: 160px;
            height: 90px;
            border-radius: var(--n-border-radius);
            overflow: hidden;
            background: var(--n-color-embedded);
            border: 1px solid var(--n-border-color);
            display: flex;
            align-items: center;
            justify-content: center;
          "
        >
          <img
            v-if="roomInfo?.user_cover || roomInfo?.keyframe"
            :src="roomInfo?.user_cover || roomInfo?.keyframe"
            alt="当前直播封面"
            style="width: 100%; height: 100%; object-fit: cover;"
          >
          <NText
            v-else
            depth="3"
            style="font-size: 12px;"
          >
            暂无封面
          </NText>
        </div>
      </div>

      <!-- 新封面上传和预览 -->
      <div style="flex: 1;">
        <NText
          depth="3"
          style="display: block; margin-bottom: 0.5rem;"
        >
          上传新封面
        </NText>
        <NFlex
          vertical
          gap="small"
        >
          <NFlex gap="small">
            <NUpload
              :max="1"
              accept="image/jpeg,image/png,image/webp"
              :file-list="c.coverFile.value ? [{
                id: 'cover',
                name: c.coverFile.value.name,
                status: 'finished',
                file: c.coverFile.value
              }] : []"
              @change="(options) => {
                const { file, fileList } = options
                if (fileList.length === 0) {
                  c.handleCoverRemove()
                } else if (file) {
                  c.handleCoverFileChange(file)
                }
              }"
              @before-upload="() => false"
            >
              <NButton>
                选择图片
              </NButton>
            </NUpload>
            <NButton
              type="primary"
              :loading="c.isUploadingCover.value"
              :disabled="!c.coverFile.value"
              @click="c.handleUploadCover"
            >
              上传并应用
            </NButton>
          </NFlex>

          <!-- 新封面预览 -->
          <div
            v-if="c.coverPreviewUrl.value"
            style="
              width: 160px;
              height: 90px;
              border-radius: var(--n-border-radius);
              overflow: hidden;
              border: 2px solid var(--n-border-color);
            "
          >
            <img
              :src="c.coverPreviewUrl.value"
              alt="新封面预览"
              style="width: 100%; height: 100%; object-fit: cover;"
            >
          </div>
          <NText
            depth="3"
            style="font-size: 12px;"
          >
            支持 JPG / PNG / WEBP，大小不超过 5MB
          </NText>
        </NFlex>
      </div>
    </NFlex>
  </div>
</template>
