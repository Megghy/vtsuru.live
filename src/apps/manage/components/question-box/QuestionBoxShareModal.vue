<script setup lang="ts">
import { snapdom } from '@zumer/snapdom'
// @ts-ignore
import { saveAs } from 'file-saver'
import QrcodeVue from 'qrcode.vue'
import { computed, ref, useTemplateRef } from 'vue'

import { useAccount } from '@/api/account'
import { CURRENT_HOST } from '@/shared/config'
import { Button } from '@/shared/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { Input } from '@/shared/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Separator } from '@/shared/ui/separator'
import { copyToClipboard, downloadImage, useMessage } from '@/shared/utils'
import { useQuestionBox } from '@/store/useQuestionBox'

const show = defineModel<boolean>('show', { required: true })
const accountInfo = useAccount()
const useQB = useQuestionBox()
const message = useMessage()

const shareCardRef = useTemplateRef<HTMLElement>('shareCardRef')
const selectedShareTag = ref<string>('')

const modalShareUrl = computed(() => {
  const name = accountInfo.value?.name
  if (!name) return ''
  const baseHost = CURRENT_HOST.endsWith('/') ? CURRENT_HOST : `${CURRENT_HOST}/`
  const base = `${baseHost}@${encodeURIComponent(name)}/question-box`
  return selectedShareTag.value ? `${base}?tag=${encodeURIComponent(selectedShareTag.value)}` : base
})

function saveShareImage() {
  if (!shareCardRef.value || !accountInfo.value?.name) return
  snapdom
    .toBlob(shareCardRef.value, {
      backgroundColor: null,
      scale: 2,
      type: 'png',
    })
    .then((blob) => {
      saveAs(blob, `vtsuru-提问箱-${accountInfo.value?.name}.png`)
    })
    .catch((err) => {
      message.error(`生成分享卡片失败: ${err}`)
    })
}

function saveQRCode() {
  if (!modalShareUrl.value || !accountInfo.value?.name) return
  downloadImage(
    `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(modalShareUrl.value)}`,
    `vtsuru-提问箱二维码-${accountInfo.value.name}.png`,
  )
  message.success('二维码已开始下载')
}
</script>

<template>
  <Dialog v-model:open="show">
    <DialogContent class="max-w-xl max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle class="text-sm font-semibold">分享我的提问箱</DialogTitle>
      </DialogHeader>

      <div class="space-y-4 py-1">
        <!-- 分享卡片预览 -->
        <div
          ref="shareCardRef"
          class="relative h-48 w-full rounded-xl overflow-hidden shadow-sm"
        >
          <div class="absolute inset-0 bg-gradient-to-br from-indigo-500 to-sky-500 z-1" />
          <div class="relative z-2 flex justify-between items-stretch h-full p-5 text-white">
            <div class="flex flex-col justify-between flex-1 pr-4">
              <div>
                <div class="text-xl font-bold opacity-90">向我提问</div>
                <div class="text-3xl font-semibold leading-tight max-w-[280px] break-words line-clamp-2 mt-1">
                  {{ accountInfo?.name }}
                </div>
              </div>
              <div>
                <div class="h-px bg-white/30 my-2 w-4/5" />
                <div class="flex justify-between items-center text-xs opacity-80">
                  <span class="font-medium">提问箱</span>
                  <span>VTSURU.LIVE</span>
                </div>
              </div>
            </div>

            <div
              class="flex items-center justify-center shrink-0 bg-white/95 p-2 rounded-lg size-24 self-center shadow"
            >
              <QrcodeVue
                :value="modalShareUrl"
                level="Q"
                :size="80"
                background="#FFFFFF"
                foreground="#000000"
                :margin="0"
                render-as="svg"
              />
            </div>
          </div>
        </div>

        <!-- 选项设置 -->
        <div class="space-y-1.5">
          <label class="text-xs text-muted-foreground">附加话题 (可选)</label>
          <Select
            :model-value="selectedShareTag || '__none__'"
            @update:model-value="selectedShareTag = $event === '__none__' ? '' : String($event)"
          >
            <SelectTrigger>
              <SelectValue placeholder="不附加话题" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">不附加话题</SelectItem>
              <SelectItem
                v-for="t in useQB.tags.filter((t) => t.visiable)"
                :key="t.name"
                :value="t.name"
              >
                #{{ t.name }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <!-- 分享链接 -->
        <div class="space-y-1.5">
          <label class="text-xs text-muted-foreground">分享链接</label>
          <div class="flex items-center gap-2">
            <Input
              :model-value="modalShareUrl"
              readonly
              class="font-mono flex-1"
            />
            <Button
              variant="outline"
              :disabled="!modalShareUrl"
              @click="copyToClipboard(modalShareUrl)"
            >
              复制
            </Button>
          </div>
        </div>

        <Separator />

        <div class="flex items-center justify-center gap-3">
          <Button @click="saveShareImage"> 保存分享图 </Button>
          <Button
            variant="outline"
            @click="saveQRCode"
          >
            保存二维码
          </Button>
        </div>
      </div>
    </DialogContent>
  </Dialog>
</template>
