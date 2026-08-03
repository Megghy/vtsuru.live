<script setup lang="ts">
// @ts-ignore
import { saveAs } from 'file-saver'
import html2canvas from 'html2canvas'
import QrcodeVue from 'qrcode.vue'
import { computed, ref, useTemplateRef } from 'vue'

import { useAccount } from '@/api/account'
import { CURRENT_HOST } from '@/shared/config'
import { copyToClipboard, downloadImage } from '@/shared/utils'
import { useQuestionBox } from '@/store/useQuestionBox'

const show = defineModel<boolean>('show', { required: true })
const accountInfo = useAccount()
const useQB = useQuestionBox()
const toast = useToast()

const shareCardRef = useTemplateRef<HTMLElement>('shareCardRef')
const selectedShareTag = ref<string | null>(null)

const shareCardStyleVars = computed(() => ({
  '--share-radius': 'var(--vtsuru-radius-control)',
  '--share-gradient-from': 'var(--vtsuru-brand)',
  '--share-gradient-to': 'var(--vtsuru-info)',
}))

const modalShareUrl = computed(() => {
  const base = `${CURRENT_HOST}@${accountInfo.value?.name}/question-box`
  return selectedShareTag.value ? `${base}?tag=${selectedShareTag.value}` : base
})

function saveShareImage() {
  if (!shareCardRef.value || !accountInfo.value?.name) return
  html2canvas(shareCardRef.value, {
    width: shareCardRef.value.clientWidth,
    height: shareCardRef.value.clientHeight,
    backgroundColor: null,
    scrollY: 0,
    scrollX: 0,
    useCORS: true,
    scale: window.devicePixelRatio * 2,
  })
    .then((canvas) => {
      canvas.toBlob(
        (blob) => {
          if (blob) saveAs(blob, `vtsuru-提问箱-${accountInfo.value?.name}.png`)
          else toast.add({ title: '无法生成图片', color: 'error' })
        },
        'image/png',
        1,
      )
    })
    .catch((err) => {
      toast.add({ title: `生成分享卡片失败: ${err}`, color: 'error' })
    })
}

function saveQRCode() {
  if (!modalShareUrl.value || !accountInfo.value?.name) return
  downloadImage(
    `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(modalShareUrl.value)}`,
    `vtsuru-提问箱二维码-${accountInfo.value.name}.png`,
  )
  toast.add({ title: '二维码已开始下载', color: 'success' })
}
</script>

<template>
  <UModal
    v-model:open="show"
    title="分享我的提问箱"
    :ui="{ content: 'max-w-[95vw] sm:max-w-xl' }"
  >
    <template #body>
      <div
        ref="shareCardRef"
        class="share-card-container"
        :style="shareCardStyleVars"
      >
        <div class="share-card-background" />
        <div class="share-card-content">
          <div class="share-card-main">
            <div class="share-card-text">
              <div class="share-card-title">向我提问</div>
              <div class="share-card-name">
                {{ accountInfo?.name }}
              </div>
            </div>
            <div class="share-card-divider" />
            <div class="share-card-meta">
              <div class="share-card-type">提问箱</div>
              <div class="share-card-site">VTSURU.LIVE</div>
            </div>
          </div>
          <div class="share-card-qr">
            <QrcodeVue
              :value="modalShareUrl"
              level="Q"
              :size="90"
              background="#FFFFFF"
              foreground="#000000"
              :margin="1"
              render-as="svg"
            />
          </div>
        </div>
      </div>
    </template>
    <template #footer>
      <div class="question-box-share-modal__footer">
        <USelectMenu
          v-model="selectedShareTag"
          class="question-box-share-modal__tag-select"
          placeholder="选择要附加到链接的话题"
          :items="useQB.tags.filter((tag) => tag.visiable).map((tag) => ({ label: tag.name, value: tag.name }))"
          value-key="value"
          searchable
          clearable
        />
        <UFieldGroup class="question-box-share-modal__url">
          <UInput
            :model-value="modalShareUrl"
            readonly
          />
          <UButton
            color="neutral"
            variant="soft"
            label="复制"
            @click="copyToClipboard(modalShareUrl)"
          />
        </UFieldGroup>
        <div class="question-box-share-modal__actions">
          <UButton
            color="primary"
            label="保存分享图"
            @click="saveShareImage"
          />
          <UButton
            color="primary"
            variant="soft"
            label="保存二维码"
            @click="saveQRCode"
          />
        </div>
      </div>
    </template>
  </UModal>
</template>

<style scoped>
.share-card-container {
  position: relative;
  height: 200px;
  width: 100%;
  border-radius: var(--share-radius);
  overflow: hidden;
}
.share-card-background {
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, var(--share-gradient-from) 0%, var(--share-gradient-to) 100%);
  z-index: 1;
}
.share-card-content {
  position: relative;
  z-index: 2;
  display: flex;
  justify-content: space-between;
  align-items: stretch;
  height: 100%;
  padding: 20px;
  color: white;
}
.share-card-main {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  flex-grow: 1;
  padding-right: 20px;
}
.share-card-title {
  font-size: 28px;
  font-weight: bold;
  line-height: 1.2;
  margin-bottom: 8px;
  opacity: 0.9;
}
.share-card-name {
  font-size: 42px;
  font-weight: 500;
  line-height: 1.1;
  max-width: 350px;
  word-wrap: break-word;
  overflow: hidden;
  text-overflow: ellipsis;
  max-height: 90px;
}
.share-card-divider {
  height: 1px;
  background-color: rgba(255, 255, 255, 0.3);
  margin: 10px 0;
  width: 80%;
}
.share-card-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.share-card-type {
  font-size: 16px;
  font-weight: 500;
  opacity: 0.8;
}
.share-card-site {
  font-size: 12px;
  font-weight: 500;
  opacity: 0.7;
}
.share-card-qr {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  background-color: rgba(255, 255, 255, 0.9);
  padding: 8px;
  border-radius: var(--share-radius);
  height: 108px;
  width: 108px;
  align-self: center;
}
.share-card-qr svg {
  display: block;
  width: 100%;
  height: 100%;
}

.question-box-share-modal__footer {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.question-box-share-modal__tag-select,
.question-box-share-modal__url {
  width: 100%;
}

.question-box-share-modal__actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

@media (max-width: 500px) {
  .share-card-content {
    flex-direction: column;
    align-items: center;
    text-align: center;
    padding: 15px;
  }
  .share-card-main {
    padding-right: 0;
    margin-bottom: 15px;
    align-items: center;
  }
  .share-card-qr {
    width: 100px;
    height: 100px;
  }
  .share-card-name {
    font-size: 36px;
  }
  .share-card-divider {
    width: 100%;
  }
  .share-card-meta {
    width: 100%;
  }
}
</style>
