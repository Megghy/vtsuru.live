<script setup lang="ts">
import { Image as ImageIcon } from 'lucide-vue-next'

import type { BlockNode } from '@/apps/user-page/block/schema'
import { Button } from '@/shared/ui/button'
import { FormField } from '@/shared/ui/form-field'
import { ImagePreview } from '@/shared/ui/image-preview'
import { Input } from '@/shared/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { SettingRow } from '@/shared/ui/setting-row'
import { Switch } from '@/shared/ui/switch'
import { Textarea } from '@/shared/ui/textarea'

import PropsGrid from '../PropsGrid.vue'
import RepeaterEditor from '../RepeaterEditor.vue'
import { useBlockPropsEditor } from './useBlockPropsEditor'

const props = defineProps<{ block: BlockNode }>()
const { editor, blockProps, arrayProp } = useBlockPropsEditor(() => props.block)
const commissionItems = arrayProp<Record<string, any>>('items')

const platformUrlPlaceholder = 'https://www.mihuashi.com/...'
const DEFAULT_STATUS_TEXTS = new Set(['接稿中', '排单中', '暂已截稿'])

function handleStatusChange(val: unknown) {
  if (val !== 'open' && val !== 'waitlist' && val !== 'closed') return
  blockProps.value.status = val
  if (typeof blockProps.value.statusText === 'string' && DEFAULT_STATUS_TEXTS.has(blockProps.value.statusText.trim())) {
    blockProps.value.statusText = ''
  }
}

function tagsToString(tags: unknown): string {
  return Array.isArray(tags) ? tags.filter((t) => typeof t === 'string').join(', ') : ''
}

function updateItemTags(target: Record<string, any>, raw: string) {
  target.tags = raw
    .split(/[,，\n]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 6)
}

function clearImageFile(target: Record<string, any>) {
  delete target.imageFile
}

function uploadItemImage(index: number) {
  editor.triggerUploadTargetImage(() => commissionItems.value[index], 'imageFile')
}
</script>

<template>
  <PropsGrid>
    <FormField
      label="区块标题"
      class="span-full"
    >
      <Input
        v-model="blockProps.title"
        maxlength="60"
        placeholder="约稿 / 商务合作"
      />
    </FormField>
    <FormField label="接稿状态">
      <Select
        :model-value="blockProps.status || 'open'"
        @update:model-value="handleStatusChange"
      >
        <SelectTrigger class="w-full">
          <SelectValue placeholder="接稿状态" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="open">接稿中</SelectItem>
          <SelectItem value="waitlist">排单中</SelectItem>
          <SelectItem value="closed">暂已截稿</SelectItem>
        </SelectContent>
      </Select>
    </FormField>
    <FormField label="自定义状态文案">
      <Input
        v-model="blockProps.statusText"
        maxlength="40"
        placeholder="留空按状态自动显示"
      />
    </FormField>
    <FormField
      label="工期 / 档期说明"
      class="span-full"
    >
      <Input
        v-model="blockProps.turnaround"
        maxlength="60"
        placeholder="例如：排期至下月中 · 工期约 7-14 天"
      />
    </FormField>
    <FormField
      label="约稿须知"
      class="span-full"
    >
      <Textarea
        v-model="blockProps.notice"
        rows="3"
        maxlength="500"
        placeholder="说明商稿倍率、买断规则、不接类型等..."
      />
    </FormField>
    <FormField
      label="价目档位（最多 12 项）"
      class="span-full"
    >
      <RepeaterEditor
        :items="commissionItems"
        :create-item="() => ({ name: '头像 / 胸像', price: '¥200 起', description: '', tags: [], featured: false })"
        add-text="添加档位"
      >
        <template #title="{ item, index }">
          {{ item.name ? `${item.name}${item.price ? ` · ${item.price}` : ''}` : `档位 ${index + 1}` }}
        </template>
        <template #default="{ item, index }">
          <PropsGrid>
            <FormField label="档位名称">
              <Input
                v-model="item.name"
                maxlength="60"
              />
            </FormField>
            <FormField label="价格">
              <Input
                v-model="item.price"
                maxlength="40"
                placeholder="如：¥300 起"
              />
            </FormField>
            <FormField
              label="档位说明"
              class="span-full"
            >
              <Textarea
                v-model="item.description"
                rows="2"
                maxlength="300"
              />
            </FormField>
            <FormField
              label="标签（逗号分隔）"
              class="span-full"
            >
              <Input
                :model-value="tagsToString(item.tags)"
                placeholder="如：含透明底, 可商用"
                @update:model-value="updateItemTags(item, String($event ?? ''))"
              />
            </FormField>
            <SettingRow
              title="设为推荐高亮档位"
              variant="none"
              class="span-full py-1"
            >
              <Switch
                :checked="item.featured === true"
                @update:checked="item.featured = $event"
              />
            </SettingRow>
            <FormField
              label="例图（可选）"
              class="span-full"
            >
              <div class="flex items-center gap-2">
                <Button
                  variant="outline"
                  class="gap-1.5"
                  :disabled="editor.isUploading.value"
                  @click="uploadItemImage(index)"
                >
                  <ImageIcon class="size-3.5" />
                  上传例图
                </Button>
                <Button
                  variant="ghost"
                  :disabled="!item.imageFile"
                  @click="clearImageFile(item)"
                >
                  清除
                </Button>
                <ImagePreview
                  v-if="item.imageFile?.path"
                  :src="item.imageFile.path"
                  :alt="item.name || '例图'"
                  class="size-8 rounded border border-border shrink-0"
                />
              </div>
            </FormField>
          </PropsGrid>
        </template>
      </RepeaterEditor>
    </FormField>
    <FormField
      label="联系按钮文字"
      class="span-full"
    >
      <Input
        v-model="blockProps.contactLabel"
        maxlength="40"
        placeholder="例如：复制商务邮箱 / 联系约稿"
      />
    </FormField>
    <FormField
      label="一键复制联系方式（可选）"
      class="span-full"
    >
      <Input
        v-model="blockProps.contactCopyText"
        maxlength="300"
        placeholder="如 QQ 号 / 商务邮箱"
      />
    </FormField>
    <FormField
      label="约稿平台链接（可选 HTTPS）"
      class="span-full"
    >
      <Input
        v-model="blockProps.contactUrl"
        :placeholder="platformUrlPlaceholder"
      />
    </FormField>
  </PropsGrid>
</template>
