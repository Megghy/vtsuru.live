<script setup lang="ts">
import { snapdom } from '@zumer/snapdom'
import { saveAs } from 'file-saver'
import { Copy, Download } from 'lucide-vue-next'
import { computed, ref, useTemplateRef } from 'vue'

import { useAccount } from '@/api/account'
import type { ResponseQAInfoToTarget } from '@/api/generated/model'
import { transformImageUrl } from '@/shared/services/imageTransform'
import { Button } from '@/shared/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { FormField } from '@/shared/ui/form-field'
import { SettingRow } from '@/shared/ui/setting-row'
import { ToggleGroup, ToggleGroupItem } from '@/shared/ui/toggle-group'
import { useMessage } from '@/shared/utils'

type CardTheme = 'light' | 'dark' | 'marshmallow' | 'sky'

const show = defineModel<boolean>('show', { required: true })
const props = defineProps<{ question?: ResponseQAInfoToTarget }>()

const accountInfo = useAccount()
const message = useMessage()

const cardRef = useTemplateRef<HTMLElement>('cardRef')
const theme = ref<CardTheme>('marshmallow')
const showSender = ref(true)
const showImages = ref(true)
const showBrand = ref(true)
const isExporting = ref(false)

const senderName = computed(() => {
  const q = props.question
  if (!q) return '匿名用户'
  return q.isAnonymous ? q.anonymousName || '匿名用户' : q.sender?.name || '观众'
})

const themeClasses = computed(() => {
  switch (theme.value) {
    case 'dark':
      return {
        outer: 'bg-slate-950 text-slate-100',
        inner: 'bg-slate-900 border-slate-800',
        answer: 'bg-slate-800/80 border-slate-700/80',
        muted: 'text-slate-400',
        tag: 'bg-slate-800 text-sky-300 border-slate-700',
      }
    case 'sky':
      return {
        outer: 'bg-gradient-to-br from-sky-500 to-indigo-600 text-slate-900',
        inner: 'bg-white/95 border-white/60',
        answer: 'bg-sky-50/90 border-sky-200/80',
        muted: 'text-slate-500',
        tag: 'bg-sky-100 text-sky-700 border-sky-200',
      }
    case 'light':
      return {
        outer: 'bg-slate-100 text-slate-900',
        inner: 'bg-white border-slate-200',
        answer: 'bg-slate-50 border-slate-200',
        muted: 'text-slate-500',
        tag: 'bg-slate-100 text-slate-700 border-slate-200',
      }
    case 'marshmallow':
    default:
      return {
        outer: 'bg-gradient-to-br from-rose-100 via-pink-50 to-amber-50 text-slate-800',
        inner: 'bg-white/95 border-rose-200/80',
        answer: 'bg-rose-50/70 border-rose-200/70',
        muted: 'text-slate-500',
        tag: 'bg-rose-100/80 text-rose-700 border-rose-200',
      }
  }
})

async function renderBlob(): Promise<Blob | null> {
  if (!cardRef.value) return null
  isExporting.value = true
  try {
    return await snapdom.toBlob(cardRef.value, {
      backgroundColor: null,
      scale: 2,
      type: 'png',
    })
  } catch (err) {
    message.error(`生成卡片失败: ${err instanceof Error ? err.message : String(err)}`)
    return null
  } finally {
    isExporting.value = false
  }
}

async function downloadCard() {
  const blob = await renderBlob()
  if (!blob) return
  saveAs(blob, `vtsuru-qa-${props.question?.id ?? 'card'}.png`)
  message.success('问答卡片已保存')
}

async function copyCard() {
  const blob = await renderBlob()
  if (!blob) return
  try {
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
    message.success('问答卡片已复制到剪贴板')
  } catch {
    saveAs(blob, `vtsuru-qa-${props.question?.id ?? 'card'}.png`)
    message.info('当前浏览器不支持直接复制图片，已转为保存 PNG')
  }
}
</script>

<template>
  <Dialog v-model:open="show">
    <DialogContent class="max-w-xl max-h-[90vh] overflow-y-auto scrollbar-thin">
      <DialogHeader>
        <DialogTitle class="text-sm">导出单条问答卡片</DialogTitle>
      </DialogHeader>

      <div
        v-if="question"
        class="space-y-4 py-1"
      >
        <div
          ref="cardRef"
          class="p-5 rounded-xl transition-colors"
          :class="themeClasses.outer"
        >
          <div
            class="rounded-xl border p-4 shadow-sm space-y-3"
            :class="themeClasses.inner"
          >
            <div class="flex-between gap-2 text-xs">
              <div class="flex items-center gap-2 min-w-0">
                <span
                  v-if="showSender"
                  class="font-semibold truncate"
                >
                  {{ senderName }}
                </span>
                <span
                  v-else
                  class="font-semibold"
                >
                  匿名提问
                </span>
                <span
                  v-if="question.tag"
                  class="px-1.5 py-0.5 rounded border text-[11px] leading-none"
                  :class="themeClasses.tag"
                >
                  #{{ question.tag }}
                </span>
              </div>
              <span
                class="text-[11px]"
                :class="themeClasses.muted"
              >
                Q &amp; A
              </span>
            </div>

            <div class="text-sm leading-relaxed whitespace-pre-wrap break-words font-medium">
              {{ question.question?.message }}
            </div>

            <div
              v-if="showImages && question.questionImages?.length"
              class="grid gap-2"
              :class="question.questionImages.length === 1 ? 'grid-cols-1' : 'grid-cols-2'"
            >
              <img
                v-for="(img, idx) in question.questionImages"
                :key="img.id || idx"
                :src="transformImageUrl(img.path, 'card')"
                alt=""
                crossorigin="anonymous"
                class="w-full max-h-56 object-contain rounded-lg border border-black/5 bg-black/5"
              />
            </div>

            <div
              v-if="question.answer?.message"
              class="rounded-lg border p-3 space-y-2"
              :class="themeClasses.answer"
            >
              <div
                class="text-[11px] font-semibold"
                :class="themeClasses.muted"
              >
                {{ accountInfo?.name || '主播' }} 回复：
              </div>
              <div class="text-xs leading-relaxed whitespace-pre-wrap break-words">
                {{ question.answer.message }}
              </div>
              <div
                v-if="showImages && question.answerImages?.length"
                class="grid gap-2"
                :class="question.answerImages.length === 1 ? 'grid-cols-1' : 'grid-cols-2'"
              >
                <img
                  v-for="(img, idx) in question.answerImages"
                  :key="img.id || idx"
                  :src="transformImageUrl(img.path, 'card')"
                  alt=""
                  crossorigin="anonymous"
                  class="w-full max-h-48 object-contain rounded-lg border border-black/5 bg-black/5"
                />
              </div>
            </div>

            <div
              v-if="showBrand"
              class="flex-between pt-1 text-[11px]"
              :class="themeClasses.muted"
            >
              <span>{{ accountInfo?.name }} 的提问箱</span>
              <span>vtsuru.live</span>
            </div>
          </div>
        </div>

        <FormField label="卡片风格">
          <ToggleGroup
            v-model="theme"
            type="single"
            class="w-full grid grid-cols-4"
          >
            <ToggleGroupItem value="marshmallow">棉花糖</ToggleGroupItem>
            <ToggleGroupItem value="light">简约白</ToggleGroupItem>
            <ToggleGroupItem value="dark">暗夜</ToggleGroupItem>
            <ToggleGroupItem value="sky">天青</ToggleGroupItem>
          </ToggleGroup>
        </FormField>

        <div class="space-y-1.5">
          <SettingRow
            v-model="showSender"
            type="switch"
            variant="compact"
            title="显示提问者署名"
          />
          <SettingRow
            v-model="showImages"
            type="switch"
            variant="compact"
            title="包含提问与回复附图"
          />
          <SettingRow
            v-model="showBrand"
            type="switch"
            variant="compact"
            title="显示底部提问箱水印"
          />
        </div>

        <div class="flex-center gap-2 pt-1">
          <Button
            :loading="isExporting"
            class="gap-1.5"
            @click="downloadCard"
          >
            <Download class="size-3.5" />
            保存 PNG
          </Button>
          <Button
            variant="outline"
            :loading="isExporting"
            class="gap-1.5"
            @click="copyCard"
          >
            <Copy class="size-3.5" />
            复制图片
          </Button>
        </div>
      </div>
    </DialogContent>
  </Dialog>
</template>
