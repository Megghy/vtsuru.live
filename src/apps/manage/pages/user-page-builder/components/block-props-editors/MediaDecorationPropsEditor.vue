<script setup lang="ts">
import { Image as ImageIcon } from 'lucide-vue-next'
import { computed, onMounted, ref } from 'vue'

import { getApiQaGetTags } from '@/api/generated/qa/qa'
import type { BlockNode } from '@/apps/user-page/block/schema'
import { Button } from '@/shared/ui/button'
import { FormField } from '@/shared/ui/form-field'
import { ImagePreview } from '@/shared/ui/image-preview'
import { Input } from '@/shared/ui/input'
import { NumberField } from '@/shared/ui/number-field'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { SettingRow } from '@/shared/ui/setting-row'
import { Switch } from '@/shared/ui/switch'
import { Textarea } from '@/shared/ui/textarea'

import PropsGrid from '../PropsGrid.vue'
import TextAppearanceFields from './TextAppearanceFields.vue'
import { useBlockPropsEditor } from './useBlockPropsEditor'

const props = defineProps<{ block: BlockNode }>()
const { editor, blockProps, propertyAvailable } = useBlockPropsEditor(() => props.block)

const feedbackTags = ref<string[]>([])

async function loadFeedbackTags() {
  const userId = editor.account.value?.id
  if (!userId) return
  try {
    const response = await getApiQaGetTags({ id: String(userId) })
    if (response.code !== 200) throw new Error(response.message)
    feedbackTags.value = response.data
      .map((value) => (typeof value === 'string' ? value : value.name))
      .filter((value): value is string => typeof value === 'string')
  } catch {
    feedbackTags.value = []
  }
}

onMounted(loadFeedbackTags)

const countdownTarget = computed<string>({
  get() {
    if (typeof blockProps.value.target !== 'string' || !blockProps.value.target) return ''
    const d = new Date(blockProps.value.target)
    if (isNaN(d.getTime())) return ''
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  },
  set(val) {
    if (!val) {
      blockProps.value.target = ''
      return
    }
    const d = new Date(val)
    blockProps.value.target = isNaN(d.getTime()) ? '' : d.toISOString()
  },
})

function enableFeedbackEmbed(enabled: boolean) {
  if (enabled && !['questionBox', 'iframe'].includes(blockProps.value.embedMode)) {
    blockProps.value.embedMode = 'questionBox'
  }
}
</script>

<template>
  <div
    v-if="props.block.type === 'quote'"
    class="space-y-3"
  >
    <PropsGrid>
      <FormField
        label="内容"
        class="span-full"
      >
        <Textarea
          v-model="blockProps.text"
          class="min-h-[70px]"
        />
      </FormField>
      <FormField label="作者">
        <Input v-model="blockProps.author" />
      </FormField>
      <FormField label="对齐">
        <Select v-model="blockProps.align">
          <SelectTrigger>
            <SelectValue placeholder="对齐" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="left">left</SelectItem>
            <SelectItem value="center">center</SelectItem>
            <SelectItem value="right">right</SelectItem>
          </SelectContent>
        </Select>
      </FormField>
      <TextAppearanceFields :block="props.block" />
    </PropsGrid>
  </div>

  <div
    v-else-if="props.block.type === 'marquee'"
    class="space-y-3"
  >
    <PropsGrid>
      <FormField
        label="文本"
        class="span-full"
      >
        <Textarea
          v-model="blockProps.text"
          class="min-h-[50px]"
        />
      </FormField>
      <FormField label="方向">
        <Select v-model="blockProps.direction">
          <SelectTrigger>
            <SelectValue placeholder="方向" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="left">向左</SelectItem>
            <SelectItem value="right">向右</SelectItem>
            <SelectItem value="up">向上</SelectItem>
            <SelectItem value="down">向下</SelectItem>
          </SelectContent>
        </Select>
      </FormField>
      <FormField label="滚动时长 秒">
        <NumberField
          v-model="blockProps.durationSec"
          :min="4"
          :max="120"
          class="w-full"
        />
      </FormField>
      <SettingRow
        title="悬停暂停"
        variant="none"
        class="py-1"
      >
        <Switch v-model:checked="blockProps.pauseOnHover" />
      </SettingRow>
    </PropsGrid>
  </div>

  <div
    v-else-if="props.block.type === 'countdown'"
    class="space-y-3"
  >
    <PropsGrid>
      <FormField
        label="标题"
        class="span-full"
      >
        <Input
          v-model="blockProps.title"
          placeholder="例如：生日倒计时"
        />
      </FormField>
      <FormField
        label="目标时间"
        class="span-full"
      >
        <Input
          v-model="countdownTarget"
          type="datetime-local"
        />
      </FormField>
      <FormField label="展示样式">
        <Select v-model="blockProps.style">
          <SelectTrigger>
            <SelectValue placeholder="展示样式" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="cards">cards</SelectItem>
            <SelectItem value="inline">inline</SelectItem>
          </SelectContent>
        </Select>
      </FormField>
      <SettingRow
        title="显示秒"
        variant="none"
        class="py-1"
      >
        <Switch v-model:checked="blockProps.showSeconds" />
      </SettingRow>
      <FormField
        label="到达后文案"
        class="span-full"
      >
        <Input
          v-model="blockProps.doneText"
          placeholder="已到达"
        />
      </FormField>
    </PropsGrid>
  </div>

  <div
    v-else-if="props.block.type === 'feedback'"
    class="space-y-3"
  >
    <PropsGrid>
      <FormField
        v-if="propertyAvailable('title')"
        label="标题"
      >
        <Input v-model="blockProps.title" />
      </FormField>
      <FormField
        v-if="propertyAvailable('buttonText')"
        label="按钮文字"
      >
        <Input v-model="blockProps.buttonText" />
      </FormField>
      <FormField
        v-if="propertyAvailable('description')"
        label="描述"
        class="span-full"
      >
        <Textarea
          v-model="blockProps.description"
          class="min-h-[50px]"
        />
      </FormField>
      <FormField
        v-if="propertyAvailable('url')"
        label="链接 (https)"
        :required="Boolean(blockProps.embed && blockProps.embedMode === 'iframe')"
        class="span-full"
      >
        <Input
          v-model="blockProps.url"
          placeholder="https://..."
        />
      </FormField>
      <div class="span-full space-y-1">
        <SettingRow
          title="嵌入到页面"
          variant="none"
          class="py-1"
        >
          <Switch
            :checked="blockProps.embed"
            @update:checked="
              (val) => {
                blockProps.embed = val
                enableFeedbackEmbed(val)
              }
            "
          />
        </SettingRow>
        <div class="rounded p-2 text-xs text-muted-foreground bg-muted/40">开启“嵌入到页面”后，可选择站内提问箱</div>
      </div>
      <FormField
        v-if="propertyAvailable('embedMode')"
        label="嵌入内容"
        class="span-full"
      >
        <Select v-model="blockProps.embedMode">
          <SelectTrigger>
            <SelectValue placeholder="嵌入内容" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="questionBox">站内提问箱</SelectItem>
            <SelectItem value="iframe">站外 iframe</SelectItem>
          </SelectContent>
        </Select>
      </FormField>
      <FormField
        v-if="propertyAvailable('height')"
        label="内嵌高度"
      >
        <NumberField
          v-model="blockProps.height"
          :min="200"
          :max="1200"
          class="w-full"
        />
      </FormField>
      <FormField
        v-if="propertyAvailable('defaultTag')"
        label="默认话题"
      >
        <Select v-model="blockProps.defaultTag">
          <SelectTrigger>
            <SelectValue placeholder="不预设话题" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem
              v-for="tag in feedbackTags"
              :key="tag"
              :value="tag"
            >
              {{ tag }}
            </SelectItem>
          </SelectContent>
        </Select>
      </FormField>
      <SettingRow
        v-if="propertyAvailable('showPublicQuestions')"
        title="显示公开问题"
        variant="none"
        class="py-1"
      >
        <Switch v-model:checked="blockProps.showPublicQuestions" />
      </SettingRow>
    </PropsGrid>
  </div>

  <div
    v-else-if="props.block.type === 'image'"
    class="space-y-3"
  >
    <PropsGrid>
      <FormField label="最大宽度">
        <Input
          v-model="blockProps.maxWidth"
          placeholder="例如 100% 或 480px"
        />
      </FormField>
      <FormField label="最大高度">
        <Input
          v-model="blockProps.maxHeight"
          placeholder="例如 100% 或 320px"
        />
      </FormField>
      <FormField label="形状">
        <Select v-model="blockProps.shape">
          <SelectTrigger>
            <SelectValue placeholder="形状" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="rounded">圆角 - Rounded</SelectItem>
            <SelectItem value="square">直角 - Square</SelectItem>
            <SelectItem value="circle">圆形 - Circle</SelectItem>
          </SelectContent>
        </Select>
      </FormField>
      <FormField label="图片描述 (Alt)">
        <Input
          v-model="blockProps.alt"
          placeholder="图片加载失败时显示的文字"
        />
      </FormField>
      <FormField
        label="本地图片"
        class="span-full"
        data-validation-field="imageFile"
      >
        <div class="flex items-center gap-2">
          <Button
            variant="outline"
            class="gap-1.5"
            :disabled="editor.isUploading.value"
            @click="editor.triggerUpload(props.block, 'imageFile')"
          >
            <ImageIcon class="size-3.5" />
            上传图片
          </Button>
          <Button
            variant="ghost"
            :disabled="!blockProps.imageFile"
            @click="editor.clearUploadedFile(props.block, 'imageFile')"
          >
            清除
          </Button>
          <ImagePreview
            v-if="blockProps.imageFile?.path"
            :src="blockProps.imageFile.path"
            :alt="blockProps.imageFile?.name || '图片预览'"
            class="size-8 rounded border-border shrink-0"
          />
          <span class="text-xs text-muted-foreground truncate max-w-[200px]">
            {{ blockProps.imageFile?.name || blockProps.imageFile?.path || '' }}
          </span>
        </div>
      </FormField>
      <FormField
        label="或外部图片链接 (HTTPS)"
        description="优先展示本地上传图片；未上传时自动使用此外链"
        class="span-full"
        data-validation-field="url"
      >
        <Input
          v-model="blockProps.url"
          placeholder="https://example.com/banner.png"
        />
      </FormField>
    </PropsGrid>
  </div>

  <div
    v-else-if="props.block.type === 'embed'"
    class="space-y-3"
  >
    <PropsGrid>
      <FormField
        label="嵌入链接 (支持 Bilibili / YouTube)"
        class="span-full"
      >
        <Input
          v-model="blockProps.url"
          placeholder="https://www.youtube.com/watch?v=..."
        />
      </FormField>
      <FormField label="标题">
        <Input
          v-model="blockProps.title"
          placeholder="可选，用于无障碍访问"
        />
      </FormField>
    </PropsGrid>
  </div>

  <div
    v-else-if="props.block.type === 'divider'"
    class="space-y-3"
  >
    <PropsGrid>
      <FormField label="文字">
        <Input v-model="blockProps.text" />
      </FormField>
      <FormField
        v-if="propertyAvailable('titlePlacement')"
        label="文字位置"
      >
        <Select v-model="blockProps.titlePlacement">
          <SelectTrigger>
            <SelectValue placeholder="文字位置" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="left">居左</SelectItem>
            <SelectItem value="center">居中</SelectItem>
            <SelectItem value="right">居右</SelectItem>
          </SelectContent>
        </Select>
      </FormField>
      <FormField label="上边距 px">
        <NumberField
          v-model="blockProps.marginTop"
          :min="0"
          :max="80"
          class="w-full"
        />
      </FormField>
      <FormField label="下边距 px">
        <NumberField
          v-model="blockProps.marginBottom"
          :min="0"
          :max="80"
          class="w-full"
        />
      </FormField>
    </PropsGrid>
  </div>

  <div
    v-else-if="props.block.type === 'spacer'"
    class="space-y-3"
  >
    <FormField label="大小">
      <Select v-model="blockProps.size">
        <SelectTrigger>
          <SelectValue placeholder="大小" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="sm">sm</SelectItem>
          <SelectItem value="md">md</SelectItem>
          <SelectItem value="lg">lg</SelectItem>
        </SelectContent>
      </Select>
    </FormField>
  </div>

  <div
    v-else-if="props.block.type === 'footer'"
    class="space-y-3"
  >
    <FormField label="文字">
      <Input v-model="blockProps.text" />
    </FormField>
  </div>
</template>
