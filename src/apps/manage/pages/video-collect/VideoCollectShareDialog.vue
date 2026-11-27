<script setup lang="ts">
import { Copy, Download } from 'lucide-vue-next'
import { saveAs } from 'file-saver'
import Qrcode from 'qrcode.vue'
import { ref } from 'vue'

import { Button } from '@/shared/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { Input } from '@/shared/ui/input'
import { copyToClipboard, useMessage } from '@/shared/utils'

const props = defineProps<{
  open: boolean
  shareUrl: string
  tableName: string
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

const message = useMessage()
const qrCodeWrapper = ref<HTMLElement>()

function handleCopy() {
  copyToClipboard(props.shareUrl)
  message.success('链接已复制')
}

function saveQrCode() {
  const canvas = qrCodeWrapper.value?.querySelector('canvas')
  canvas?.toBlob((blob) => {
    if (!blob) return
    saveAs(blob, `${props.tableName || '视频征集'}-二维码.png`)
  })
}
</script>

<template>
  <Dialog
    :open="open"
    @update:open="emit('update:open', $event)"
  >
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>分享视频征集</DialogTitle>
        <DialogDescription>观众扫码或打开链接即可直接提交视频投稿</DialogDescription>
      </DialogHeader>

      <div class="flex flex-col items-center space-y-3 py-2">
        <div
          ref="qrCodeWrapper"
          class="p-3 bg-white rounded-lg border border-border"
        >
          <Qrcode
            :value="shareUrl"
            level="Q"
            :size="160"
            background="#ffffff"
            foreground="#000000"
            :margin="2"
          />
        </div>

        <div class="flex items-center gap-1.5 w-full">
          <Input
            :model-value="shareUrl"
            readonly
            class="font-mono flex-1"
          />
          <Button
            variant="brand"
            @click="handleCopy"
          >
            <Copy class="size-3.5 mr-1" />
            复制
          </Button>
        </div>

        <Button
          variant="outline"
          class="w-full"
          @click="saveQrCode"
        >
          <Download class="size-3.5 mr-1" />
          保存二维码图片
        </Button>
      </div>
    </DialogContent>
  </Dialog>
</template>
