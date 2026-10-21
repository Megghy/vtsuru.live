<script setup lang="ts">
import { ImageOutline } from '@vicons/ionicons5'
import { computed, onMounted, ref } from 'vue'

import { getApiQaGetTags } from '@/api/generated/qa/qa'
import type { BlockNode } from '@/apps/user-page/block/schema'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import NInputNumber from '@/shared/ui/NInputNumber.vue'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
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
    const response = (await getApiQaGetTags({ id: String(userId) })) as unknown as {
      code: number
      message?: string
      data: unknown[]
    }
    if (response.code !== 200) throw new Error(response.message)
    feedbackTags.value = response.data
      .map((value) => (typeof value === 'string' ? value : (value as Record<string, unknown> | null)?.name))
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
      <div class="span-full space-y-1">
        <label class="text-xs text-muted-foreground">内容</label>
        <Textarea
          v-model="blockProps.text"
          class="text-xs min-h-[70px]"
        />
      </div>
      <div class="space-y-1">
        <label class="text-xs text-muted-foreground">作者</label>
        <Input
          v-model="blockProps.author"
          class="h-8 text-xs"
        />
      </div>
      <div class="space-y-1">
        <label class="text-xs text-muted-foreground">对齐</label>
        <Select v-model="blockProps.align">
          <SelectTrigger class="h-8 text-xs">
            <SelectValue placeholder="对齐" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="left">left</SelectItem>
            <SelectItem value="center">center</SelectItem>
            <SelectItem value="right">right</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <TextAppearanceFields :block="props.block" />
    </PropsGrid>
  </div>

  <div
    v-else-if="props.block.type === 'marquee'"
    class="space-y-3"
  >
    <PropsGrid>
      <div class="span-full space-y-1">
        <label class="text-xs text-muted-foreground">文本</label>
        <Textarea
          v-model="blockProps.text"
          class="text-xs min-h-[50px]"
        />
      </div>
      <div class="space-y-1">
        <label class="text-xs text-muted-foreground">方向</label>
        <Select v-model="blockProps.direction">
          <SelectTrigger class="h-8 text-xs">
            <SelectValue placeholder="方向" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="left">向左</SelectItem>
            <SelectItem value="right">向右</SelectItem>
            <SelectItem value="up">向上</SelectItem>
            <SelectItem value="down">向下</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div class="space-y-1">
        <label class="text-xs text-muted-foreground">滚动时长 秒</label>
        <NInputNumber
          v-model:value="blockProps.durationSec"
          :min="4"
          :max="120"
          class="w-full"
        />
      </div>
      <div class="flex items-center justify-between py-1">
        <label class="text-xs text-muted-foreground">悬停暂停</label>
        <Switch v-model:checked="blockProps.pauseOnHover" />
      </div>
    </PropsGrid>
  </div>

  <div
    v-else-if="props.block.type === 'countdown'"
    class="space-y-3"
  >
    <PropsGrid>
      <div class="span-full space-y-1">
        <label class="text-xs text-muted-foreground">标题</label>
        <Input
          v-model="blockProps.title"
          placeholder="例如：生日倒计时"
          class="h-8 text-xs"
        />
      </div>
      <div class="span-full space-y-1">
        <label class="text-xs text-muted-foreground">目标时间</label>
        <input
          v-model="countdownTarget"
          type="datetime-local"
          class="flex h-8 w-full rounded-md border border-input bg-background px-2.5 py-1 text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
      </div>
      <div class="space-y-1">
        <label class="text-xs text-muted-foreground">展示样式</label>
        <Select v-model="blockProps.style">
          <SelectTrigger class="h-8 text-xs">
            <SelectValue placeholder="展示样式" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="cards">cards</SelectItem>
            <SelectItem value="inline">inline</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div class="flex items-center justify-between py-1">
        <label class="text-xs text-muted-foreground">显示秒</label>
        <Switch v-model:checked="blockProps.showSeconds" />
      </div>
      <div class="span-full space-y-1">
        <label class="text-xs text-muted-foreground">到达后文案</label>
        <Input
          v-model="blockProps.doneText"
          placeholder="已到达"
          class="h-8 text-xs"
        />
      </div>
    </PropsGrid>
  </div>

  <div
    v-else-if="props.block.type === 'feedback'"
    class="space-y-3"
  >
    <PropsGrid>
      <div
        v-if="propertyAvailable('title')"
        class="space-y-1"
      >
        <label class="text-xs text-muted-foreground">标题</label>
        <Input
          v-model="blockProps.title"
          class="h-8 text-xs"
        />
      </div>
      <div
        v-if="propertyAvailable('buttonText')"
        class="space-y-1"
      >
        <label class="text-xs text-muted-foreground">按钮文字</label>
        <Input
          v-model="blockProps.buttonText"
          class="h-8 text-xs"
        />
      </div>
      <div
        v-if="propertyAvailable('description')"
        class="span-full space-y-1"
      >
        <label class="text-xs text-muted-foreground">描述</label>
        <Textarea
          v-model="blockProps.description"
          class="text-xs min-h-[50px]"
        />
      </div>
      <div
        v-if="propertyAvailable('url')"
        class="span-full space-y-1"
      >
        <label class="text-xs text-muted-foreground">
          链接 (https)
          <span
            v-if="blockProps.embed && blockProps.embedMode === 'iframe'"
            class="text-destructive"
          >*</span>
        </label>
        <Input
          v-model="blockProps.url"
          placeholder="https://..."
          class="h-8 text-xs"
        />
      </div>
      <div class="span-full space-y-1">
        <div class="flex items-center justify-between py-1">
          <label class="text-xs text-muted-foreground">嵌入到页面</label>
          <Switch
            :checked="blockProps.embed"
            @update:checked="(val) => { blockProps.embed = val; enableFeedbackEmbed(val); }"
          />
        </div>
        <div class="rounded p-2 text-xs text-muted-foreground bg-muted/40">
          开启“嵌入到页面”后，可选择站内提问箱
        </div>
      </div>
      <div
        v-if="propertyAvailable('embedMode')"
        class="span-full space-y-1"
      >
        <label class="text-xs text-muted-foreground">嵌入内容</label>
        <Select v-model="blockProps.embedMode">
          <SelectTrigger class="h-8 text-xs">
            <SelectValue placeholder="嵌入内容" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="questionBox">站内提问箱</SelectItem>
            <SelectItem value="iframe">站外 iframe</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div
        v-if="propertyAvailable('height')"
        class="space-y-1"
      >
        <label class="text-xs text-muted-foreground">内嵌高度</label>
        <NInputNumber
          v-model:value="blockProps.height"
          :min="200"
          :max="1200"
          class="w-full"
        />
      </div>
      <div
        v-if="propertyAvailable('defaultTag')"
        class="space-y-1"
      >
        <label class="text-xs text-muted-foreground">默认话题</label>
        <Select v-model="blockProps.defaultTag">
          <SelectTrigger class="h-8 text-xs">
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
      </div>
      <div
        v-if="propertyAvailable('showPublicQuestions')"
        class="flex items-center justify-between py-1"
      >
        <label class="text-xs text-muted-foreground">显示公开问题</label>
        <Switch v-model:checked="blockProps.showPublicQuestions" />
      </div>
    </PropsGrid>
  </div>

  <div
    v-else-if="props.block.type === 'image'"
    class="space-y-3"
  >
    <PropsGrid>
      <div class="space-y-1">
        <label class="text-xs text-muted-foreground">最大宽度</label>
        <Input
          v-model="blockProps.maxWidth"
          placeholder="例如 100% 或 480px"
          class="h-8 text-xs"
        />
      </div>
      <div class="space-y-1">
        <label class="text-xs text-muted-foreground">最大高度</label>
        <Input
          v-model="blockProps.maxHeight"
          placeholder="例如 100% 或 320px"
          class="h-8 text-xs"
        />
      </div>
      <div class="space-y-1">
        <label class="text-xs text-muted-foreground">形状</label>
        <Select v-model="blockProps.shape">
          <SelectTrigger class="h-8 text-xs">
            <SelectValue placeholder="形状" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="rounded">圆角 - Rounded</SelectItem>
            <SelectItem value="square">直角 - Square</SelectItem>
            <SelectItem value="circle">圆形 - Circle</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div class="space-y-1">
        <label class="text-xs text-muted-foreground">图片描述 (Alt)</label>
        <Input
          v-model="blockProps.alt"
          placeholder="图片加载失败时显示的文字"
          class="h-8 text-xs"
        />
      </div>
      <div class="span-full space-y-1">
        <label class="text-xs text-muted-foreground">本地图片</label>
        <div class="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            class="h-8 text-xs gap-1.5"
            :disabled="editor.isUploading.value"
            @click="editor.triggerUpload(props.block, 'imageFile')"
          >
            <ImageOutline class="size-4" />
            上传图片
          </Button>
          <Button
            size="sm"
            variant="ghost"
            class="h-8 text-xs"
            :disabled="!blockProps.imageFile"
            @click="editor.clearUploadedFile(props.block, 'imageFile')"
          >
            清除
          </Button>
          <img
            v-if="blockProps.imageFile?.path"
            :src="blockProps.imageFile.path"
            alt=""
            referrerpolicy="no-referrer"
            class="size-8 rounded object-cover border border-border"
          />
          <span class="text-xs text-muted-foreground truncate max-w-[200px]">
            {{ blockProps.imageFile?.name || blockProps.imageFile?.path || '' }}
          </span>
        </div>
      </div>
    </PropsGrid>
  </div>

  <div
    v-else-if="props.block.type === 'embed'"
    class="space-y-3"
  >
    <PropsGrid>
      <div class="span-full space-y-1">
        <label class="text-xs text-muted-foreground">嵌入链接 (支持 Bilibili / YouTube)</label>
        <Input
          v-model="blockProps.url"
          placeholder="https://www.youtube.com/watch?v=..."
          class="h-8 text-xs"
        />
      </div>
      <div class="space-y-1">
        <label class="text-xs text-muted-foreground">标题</label>
        <Input
          v-model="blockProps.title"
          placeholder="可选，用于无障碍访问"
          class="h-8 text-xs"
        />
      </div>
    </PropsGrid>
  </div>

  <div
    v-else-if="props.block.type === 'divider'"
    class="space-y-3"
  >
    <PropsGrid>
      <div class="space-y-1">
        <label class="text-xs text-muted-foreground">文字</label>
        <Input
          v-model="blockProps.text"
          class="h-8 text-xs"
        />
      </div>
      <div
        v-if="propertyAvailable('titlePlacement')"
        class="space-y-1"
      >
        <label class="text-xs text-muted-foreground">文字位置</label>
        <Select v-model="blockProps.titlePlacement">
          <SelectTrigger class="h-8 text-xs">
            <SelectValue placeholder="文字位置" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="left">居左</SelectItem>
            <SelectItem value="center">居中</SelectItem>
            <SelectItem value="right">居右</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div class="space-y-1">
        <label class="text-xs text-muted-foreground">上边距 px</label>
        <NInputNumber
          v-model:value="blockProps.marginTop"
          :min="0"
          :max="80"
          class="w-full"
        />
      </div>
      <div class="space-y-1">
        <label class="text-xs text-muted-foreground">下边距 px</label>
        <NInputNumber
          v-model:value="blockProps.marginBottom"
          :min="0"
          :max="80"
          class="w-full"
        />
      </div>
    </PropsGrid>
  </div>

  <div
    v-else-if="props.block.type === 'spacer'"
    class="space-y-3"
  >
    <div class="space-y-1">
      <label class="text-xs text-muted-foreground">大小</label>
      <Select v-model="blockProps.size">
        <SelectTrigger class="h-8 text-xs">
          <SelectValue placeholder="大小" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="sm">sm</SelectItem>
          <SelectItem value="md">md</SelectItem>
          <SelectItem value="lg">lg</SelectItem>
        </SelectContent>
      </Select>
    </div>
  </div>

  <div
    v-else-if="props.block.type === 'footer'"
    class="space-y-3"
  >
    <div class="space-y-1">
      <label class="text-xs text-muted-foreground">文字</label>
      <Input
        v-model="blockProps.text"
        class="h-8 text-xs"
      />
    </div>
  </div>
</template>
