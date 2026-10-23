<script setup lang="ts">
import type { LiveControl } from '@/apps/client/composables/useLiveControl'
import { Button } from '@/shared/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog'

const props = defineProps<{ control: LiveControl }>()
const c = props.control
</script>

<template>
  <Dialog
    :open="c.showFaceAuthModal.value"
    @update:open="
      (open) => {
        if (!open) c.closeFaceAuthModal()
      }
    "
  >
    <DialogContent class="sm:max-w-[420px]">
      <DialogHeader>
        <DialogTitle class="text-base font-semibold">人脸认证</DialogTitle>
        <DialogDescription class="text-xs text-muted-foreground">
          请使用哔哩哔哩手机客户端扫描下方二维码进行人脸认证
        </DialogDescription>
      </DialogHeader>

      <div class="flex flex-col items-center justify-center py-4 space-y-3">
        <div
          v-if="c.faceAuthQrCode.value"
          class="p-3 bg-white rounded-lg border border-border shadow-sm"
        >
          <img
            :src="c.faceAuthQrCode.value"
            alt="人脸认证二维码"
            class="size-48 object-contain"
          />
        </div>
        <div
          v-else
          class="size-48 rounded-lg border border-dashed border-border flex items-center justify-center text-xs text-muted-foreground bg-muted/40"
        >
          暂无二维码
        </div>

        <p class="text-xs text-center text-muted-foreground">认证完成后，请关闭此窗口并重新点击“开始直播”</p>
      </div>

      <DialogFooter>
        <Button
          class="w-full"
          @click="c.closeFaceAuthModal"
        >
          关闭
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
