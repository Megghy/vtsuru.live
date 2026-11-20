<script setup lang="ts">
import Delete24Filled from '@vicons/fluent/es/Delete24Filled'
import DocumentLock24Regular from '@vicons/fluent/es/DocumentLock24Regular'
import { computed, ref } from 'vue'

import type { UploadPointGoodsModel } from '@/api/client-types'
import { GoodsTypes, type VirtualAttachmentModel, VirtualKeySelectionMode } from '@/api/generated/model'
import { FileStore, uploadFiles } from '@/shared/services/fileUpload'
import { Button } from '@/shared/ui/button'
import { Checkbox } from '@/shared/ui/checkbox'
import { FormField } from '@/shared/ui/form-field'
import { Tag } from '@/shared/ui/tag'
import { Textarea } from '@/shared/ui/textarea'
import { ToggleGroup, ToggleGroupItem } from '@/shared/ui/toggle-group'
import { toast } from '@/shared/utils'

import ServiceGoodsConfig from '../ServiceGoodsConfig.vue'

const goods = defineModel<UploadPointGoodsModel>('goods', { required: true })
const privateAttachments = defineModel<VirtualAttachmentModel[]>('privateAttachments', { required: true })
const isAllowedPrivacyPolicy = defineModel<boolean>('isAllowedPrivacyPolicy', { required: true })

const keySelectionModeOptions = [
  { label: '不使用密钥', value: VirtualKeySelectionMode.None },
  { label: '随机分配', value: VirtualKeySelectionMode.Random },
  { label: '顺序分配', value: VirtualKeySelectionMode.Sequential },
]

const virtualKeyInput = ref('')
const uploadingPrivateFile = ref(false)
const privateFileInputRef = ref<HTMLInputElement>()

const isDirectCollect = computed(() => goods.value.collectUrl == null)

function addVirtualKeys() {
  const parts = virtualKeyInput.value
    .split(/\r?\n/)
    .map((k) => k.trim())
    .filter(Boolean)
  if (!parts.length) return
  const merged = [...(goods.value.virtualKeys ?? [])]
  for (const key of parts) {
    if (!merged.includes(key)) merged.push(key)
  }
  goods.value.virtualKeys = merged
  virtualKeyInput.value = ''
}

function removeVirtualKey(key: string) {
  goods.value.virtualKeys = (goods.value.virtualKeys ?? []).filter((k) => k !== key)
}

function toggleCollectMode(mode: string | undefined) {
  if (!mode) return
  if (mode === 'direct') {
    goods.value.collectUrl = undefined
    goods.value.embedCollectUrl = false
  } else {
    goods.value.collectUrl ??= ''
  }
}

async function handlePrivateFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  const files = input.files ? Array.from(input.files) : []
  input.value = ''
  if (!files.length) return
  uploadingPrivateFile.value = true
  try {
    const uploaded = await uploadFiles(files, FileStore.GoodsPrivate)
    for (const file of uploaded) {
      if (!privateAttachments.value.some((existing) => existing.id === file.id)) {
        privateAttachments.value.push({
          id: file.id,
          name: file.name || `附件_${file.id}`,
          size: file.size ?? 0,
        })
      }
    }
    toast.success(`已上传 ${uploaded.length} 个私有附件`)
  } catch (err) {
    toast.error(err instanceof Error ? err.message : '私有附件上传失败')
  } finally {
    uploadingPrivateFile.value = false
  }
}

function removePrivateAttachment(fileId: number) {
  privateAttachments.value = privateAttachments.value.filter((f) => f.id !== fileId)
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}
</script>

<template>
  <div class="space-y-4">
    <!-- 虚拟商品 -->
    <template v-if="goods.type === GoodsTypes.Virtual">
      <div id="goods-virtual-content">
        <FormField
          label="交付内容"
          required
          hint="支持使用 {key} 占位符，启用密钥自动发放时将自动替换为分配的密钥"
        >
          <Textarea
            :model-value="goods.content ?? ''"
            placeholder="兑换后向用户展示的虚拟内容（如网盘链接、兑换码模板 {key} 等）"
            :maxlength="500"
            rows="3"
            @update:model-value="goods.content = String($event)"
          />
        </FormField>
      </div>

      <FormField label="卡密 / 密钥自动发放">
        <ToggleGroup
          type="single"
          :model-value="String(goods.keySelectionMode)"
          @update:model-value="
            (val) => val !== undefined && (goods.keySelectionMode = Number(val) as VirtualKeySelectionMode)
          "
        >
          <ToggleGroupItem
            v-for="opt in keySelectionModeOptions"
            :key="opt.value"
            :value="String(opt.value)"
          >
            {{ opt.label }}
          </ToggleGroupItem>
        </ToggleGroup>
      </FormField>

      <FormField
        v-if="goods.keySelectionMode !== VirtualKeySelectionMode.None"
        label="卡密库"
        :extra="`已添加 ${goods.virtualKeys?.length ?? 0} 个密钥，兑换时将自动分配并消耗`"
      >
        <div class="space-y-2">
          <div class="flex items-start gap-2">
            <Textarea
              v-model="virtualKeyInput"
              placeholder="输入卡密或密钥（支持每行一个批量粘贴）"
              rows="2"
              class="flex-1"
            />
            <Button
              type="button"
              variant="outline"
              :disabled="!virtualKeyInput.trim()"
              @click="addVirtualKeys"
            >
              添加
            </Button>
          </div>
          <div
            v-if="goods.virtualKeys?.length"
            class="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto scrollbar-thin p-1"
          >
            <Tag
              v-for="key in goods.virtualKeys"
              :key="key"
              type="info"
              closable
              @close="removeVirtualKey(key)"
            >
              {{ key }}
            </Tag>
          </div>
        </div>
      </FormField>

      <FormField
        label="私有附件文件"
        extra="支持图片、音视频、文档及 zip/7z/rar 压缩包；仅对已兑换用户签发 15 分钟临期下载链接"
      >
        <div class="space-y-2">
          <div class="flex items-center gap-2">
            <input
              ref="privateFileInputRef"
              type="file"
              multiple
              class="hidden"
              @change="handlePrivateFileChange"
            />
            <Button
              type="button"
              variant="outline"
              :loading="uploadingPrivateFile"
              @click="privateFileInputRef?.click()"
            >
              <DocumentLock24Regular class="size-3.5 mr-1" />
              上传私有附件 (≤10MB)
            </Button>
          </div>
          <div
            v-if="privateAttachments.length"
            class="space-y-1"
          >
            <div
              v-for="file in privateAttachments"
              :key="file.id"
              class="flex-between px-2.5 py-1.5 rounded border border-border bg-muted/30 text-xs"
            >
              <span class="truncate font-medium">{{ file.name }}</span>
              <div class="flex items-center gap-2 shrink-0">
                <span class="text-muted-foreground tabular-nums">{{ formatFileSize(file.size) }}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  @click="removePrivateAttachment(file.id)"
                >
                  <Delete24Filled class="size-3.5 text-destructive" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </FormField>
    </template>

    <!-- 实体商品 -->
    <template v-else-if="goods.type === GoodsTypes.Physical">
      <FormField label="收货地址收集方式">
        <ToggleGroup
          type="single"
          :model-value="isDirectCollect ? 'direct' : 'external'"
          @update:model-value="toggleCollectMode"
        >
          <ToggleGroupItem value="direct">通过本站直接收集</ToggleGroupItem>
          <ToggleGroupItem value="external">使用站外链接收集</ToggleGroupItem>
        </ToggleGroup>
      </FormField>

      <div
        v-if="isDirectCollect"
        class="flex items-center gap-2 rounded-md border bg-muted/30 p-3"
      >
        <Checkbox
          id="goods-privacy-policy"
          :checked="isAllowedPrivacyPolicy"
          @update:checked="(v) => (isAllowedPrivacyPolicy = Boolean(v))"
        />
        <label
          for="goods-privacy-policy"
          class="text-xs cursor-pointer"
        >
          我已阅读并同意本站收货信息收集与隐私保护协议，并承诺仅用于礼物寄送
        </label>
      </div>

      <div
        v-else
        id="goods-collect-url"
        class="space-y-3"
      >
        <FormField
          label="站外收集链接"
          required
          v-model="goods.collectUrl"
          placeholder="请输入收集表单链接（如腾讯文档、问卷星、表单链接等）"
          :maxlength="300"
        />
        <div class="flex items-center gap-2">
          <Checkbox
            id="goods-embed-collect"
            :checked="Boolean(goods.embedCollectUrl)"
            @update:checked="(v) => (goods.embedCollectUrl = Boolean(v))"
          />
          <label
            for="goods-embed-collect"
            class="text-xs cursor-pointer"
          >
            尝试将外部收集表单直接内嵌到网页中展示
          </label>
        </div>
      </div>
    </template>

    <!-- 服务商品 -->
    <template v-else-if="goods.type === GoodsTypes.Service">
      <ServiceGoodsConfig v-model="goods.serviceConfig" />
    </template>
  </div>
</template>
