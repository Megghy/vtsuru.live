<script setup lang="ts">
import { Image, Upload, X } from 'lucide-vue-next'
import { ref } from 'vue'

import type { LiveControl } from '@/apps/client/composables/useLiveControl'
import { roomInfo } from '@/apps/client/data/info'
import { Button } from '@/shared/ui/button'

const props = defineProps<{ control: LiveControl }>()
const c = props.control

const fileInputRef = ref<HTMLInputElement | null>(null)

function triggerSelectFile() {
  fileInputRef.value?.click()
}

function onFileInputChange(event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (file) {
    c.handleCoverFileChange({
      id: 'cover',
      name: file.name,
      status: 'finished',
      file,
    } as any)
  }
}

function handleRemove() {
  c.handleCoverRemove()
  if (fileInputRef.value) {
    fileInputRef.value.value = ''
  }
}
</script>

<template>
  <div class="space-y-3">
    <div class="flex items-center justify-between">
      <span class="text-xs font-semibold text-foreground">直播封面</span>
      <span class="text-[11px] text-muted-foreground">支持 JPG / PNG / WEBP，大小不超过 5MB</span>
    </div>

    <!-- 隐藏的文件选择器 -->
    <input
      ref="fileInputRef"
      type="file"
      accept="image/jpeg,image/png,image/webp"
      class="hidden"
      @change="onFileInputChange"
    />

    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <!-- 当前封面 -->
      <div class="space-y-1.5">
        <span class="text-xs text-muted-foreground block">当前线上封面</span>
        <div
          class="aspect-video w-full max-w-[200px] rounded-md border border-border bg-muted/40 overflow-hidden flex items-center justify-center relative shadow-inner"
        >
          <img
            v-if="roomInfo?.user_cover || roomInfo?.keyframe"
            :src="roomInfo?.user_cover || roomInfo?.keyframe"
            alt="当前直播封面"
            class="size-full object-cover"
          />
          <div
            v-else
            class="flex flex-col items-center gap-1 text-muted-foreground"
          >
            <Image class="size-6 opacity-40" />
            <span class="text-xs">暂无封面</span>
          </div>
        </div>
      </div>

      <!-- 新封面上传与预览 -->
      <div class="space-y-2">
        <span class="text-xs text-muted-foreground block">上传新封面</span>

        <div class="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            class="gap-1.5"
            @click="triggerSelectFile"
          >
            <Image class="size-3.5" />
            {{ c.coverFile.value ? '重新选择' : '选择图片' }}
          </Button>

          <Button
            type="button"
            class="gap-1.5"
            :disabled="!c.coverFile.value || c.isUploadingCover.value"
            @click="c.handleUploadCover"
          >
            <Upload class="size-3.5" />
            {{ c.isUploadingCover.value ? '正在上传...' : '上传并应用' }}
          </Button>

          <Button
            v-if="c.coverFile.value"
            type="button"
            variant="ghost"
            class="size-8 p-0 text-muted-foreground hover:text-destructive"
            title="移除已选图片"
            @click="handleRemove"
          >
            <X class="size-4" />
          </Button>
        </div>

        <!-- 已选新封面预览 -->
        <div
          v-if="c.coverPreviewUrl.value"
          class="aspect-video w-full max-w-[200px] rounded-md border-2 border-primary/50 bg-muted/40 overflow-hidden relative shadow-sm"
        >
          <img
            :src="c.coverPreviewUrl.value"
            alt="新封面预览"
            class="size-full object-cover"
          />
          <div class="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-black/60 text-white text-[10px]">
            待应用预览
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
