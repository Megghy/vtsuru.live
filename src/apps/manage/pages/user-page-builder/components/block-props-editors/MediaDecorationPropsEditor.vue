<script setup lang="ts">
import { ImageOutline } from '@vicons/ionicons5'
import {
  NAlert,
  NButton,
  NDatePicker,
  NFlex,
  NForm,
  NFormItem,
  NIcon,
  NInput,
  NInputNumber,
  NSelect,
  NSwitch,
  NText,
} from 'naive-ui'
import { computed, onMounted, ref } from 'vue'

import type { BlockNode } from '@/apps/user-page/block/schema'
import { QueryGetAPI } from '@/api/query'
import { QUESTION_API_URL } from '@/shared/config'

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
    const response = await QueryGetAPI<unknown[]>(`${QUESTION_API_URL}get-tags`, { id: userId })
    if (response.code !== 200) throw new Error(response.message)
    feedbackTags.value = response.data
      .map((value) => (typeof value === 'string' ? value : (value as Record<string, unknown> | null)?.name))
      .filter((value): value is string => typeof value === 'string')
  } catch {
    feedbackTags.value = []
  }
}

onMounted(loadFeedbackTags)

const countdownTarget = computed<number | null>({
  get() {
    if (typeof blockProps.value.target !== 'string') return null
    const timestamp = Date.parse(blockProps.value.target.replace(' ', 'T'))
    return Number.isFinite(timestamp) ? timestamp : null
  },
  set(timestamp) {
    blockProps.value.target = timestamp == null ? '' : new Date(timestamp).toISOString()
  },
})

function enableFeedbackEmbed(enabled: boolean) {
  if (enabled && !['questionBox', 'iframe'].includes(blockProps.value.embedMode)) {
    blockProps.value.embedMode = 'questionBox'
  }
}
</script>

<template>
  <NForm
    v-if="props.block.type === 'quote'"
    label-placement="top"
    size="small"
  >
    <PropsGrid>
      <NFormItem
        class="span-full"
        label="内容"
      >
        <NInput
          v-model:value="blockProps.text"
          type="textarea"
          :autosize="{ minRows: 3, maxRows: 8 }"
        />
      </NFormItem>
      <NFormItem label="作者">
        <NInput v-model:value="blockProps.author" />
      </NFormItem>
      <NFormItem label="对齐">
        <NSelect
          v-model:value="blockProps.align"
          :options="[
            { label: 'left', value: 'left' },
            { label: 'center', value: 'center' },
            { label: 'right', value: 'right' },
          ]"
        />
      </NFormItem>
      <TextAppearanceFields :block="props.block" />
    </PropsGrid>
  </NForm>

  <NForm
    v-else-if="props.block.type === 'marquee'"
    label-placement="top"
    size="small"
  >
    <PropsGrid>
      <NFormItem
        class="span-full"
        label="文本"
      >
        <NInput
          v-model:value="blockProps.text"
          type="textarea"
          :autosize="{ minRows: 2, maxRows: 6 }"
        />
      </NFormItem>
      <NFormItem label="方向">
        <NSelect
          v-model:value="blockProps.direction"
          :options="[
            { label: '向左', value: 'left' },
            { label: '向右', value: 'right' },
            { label: '向上', value: 'up' },
            { label: '向下', value: 'down' },
          ]"
        />
      </NFormItem>
      <NFormItem label="滚动时长 秒">
        <NInputNumber
          v-model:value="blockProps.durationSec"
          :min="4"
          :max="120"
          style="width: 100%"
        />
      </NFormItem>
      <NFormItem label="悬停暂停">
        <NFlex justify="end">
          <NSwitch
            v-model:value="blockProps.pauseOnHover"
            size="small"
          />
        </NFlex>
      </NFormItem>
    </PropsGrid>
  </NForm>

  <NForm
    v-else-if="props.block.type === 'countdown'"
    label-placement="top"
    size="small"
  >
    <PropsGrid>
      <NFormItem
        class="span-full"
        label="标题"
      >
        <NInput
          v-model:value="blockProps.title"
          placeholder="例如：生日倒计时"
        />
      </NFormItem>
      <NFormItem
        class="span-full"
        label="目标时间"
      >
        <NDatePicker
          v-model:value="countdownTarget"
          type="datetime"
          clearable
          placeholder="选择目标时间"
          style="width: 100%"
        />
      </NFormItem>
      <NFormItem label="展示样式">
        <NSelect
          v-model:value="blockProps.style"
          :options="[
            { label: 'cards', value: 'cards' },
            { label: 'inline', value: 'inline' },
          ]"
        />
      </NFormItem>
      <NFormItem label="显示秒">
        <NFlex justify="end">
          <NSwitch
            v-model:value="blockProps.showSeconds"
            size="small"
          />
        </NFlex>
      </NFormItem>
      <NFormItem
        class="span-full"
        label="到达后文案"
      >
        <NInput
          v-model:value="blockProps.doneText"
          placeholder="已到达"
        />
      </NFormItem>
    </PropsGrid>
  </NForm>

  <NForm
    v-else-if="props.block.type === 'feedback'"
    label-placement="top"
    size="small"
  >
    <PropsGrid>
      <NFormItem
        v-if="propertyAvailable('title')"
        label="标题"
      >
        <NInput v-model:value="blockProps.title" />
      </NFormItem>
      <NFormItem
        v-if="propertyAvailable('buttonText')"
        label="按钮文字"
      >
        <NInput v-model:value="blockProps.buttonText" />
      </NFormItem>
      <NFormItem
        v-if="propertyAvailable('description')"
        class="span-full"
        label="描述"
      >
        <NInput
          v-model:value="blockProps.description"
          type="textarea"
          :autosize="{ minRows: 2, maxRows: 6 }"
        />
      </NFormItem>
      <NFormItem
        v-if="propertyAvailable('url')"
        class="span-full"
        label="链接 (https)"
        :required="blockProps.embed && blockProps.embedMode === 'iframe'"
      >
        <NInput
          v-model:value="blockProps.url"
          placeholder="https://..."
        />
      </NFormItem>
      <NFormItem label="嵌入到页面">
        <NFlex justify="start">
          <NSwitch
            v-model:value="blockProps.embed"
            size="small"
            @update:value="enableFeedbackEmbed"
          />
          <NAlert
            type="info"
            :show-icon="false"
            style="font-size: 12px; padding: 6px 10px; border-radius: var(--vtsuru-page-radius)"
          >
            开启“嵌入到页面”后，可选择站内提问箱
          </NAlert>
        </NFlex>
      </NFormItem>
      <NFormItem
        v-if="propertyAvailable('embedMode')"
        class="span-full"
        label="嵌入内容"
      >
        <NSelect
          v-model:value="blockProps.embedMode"
          :options="[
            { label: '站内提问箱', value: 'questionBox' },
            { label: '站外 iframe', value: 'iframe' },
          ]"
        />
      </NFormItem>
      <NFormItem
        v-if="propertyAvailable('height')"
        label="内嵌高度"
      >
        <NInputNumber
          v-model:value="blockProps.height"
          :min="200"
          :max="1200"
          style="width: 100%"
        />
      </NFormItem>
      <NFormItem
        v-if="propertyAvailable('defaultTag')"
        label="默认话题"
      >
        <NSelect
          v-model:value="blockProps.defaultTag"
          :options="feedbackTags.map((tag) => ({ label: tag, value: tag }))"
          clearable
          filterable
          placeholder="不预设话题"
        />
      </NFormItem>
      <NFormItem
        v-if="propertyAvailable('showPublicQuestions')"
        label="显示公开问题"
      >
        <NFlex justify="end">
          <NSwitch
            v-model:value="blockProps.showPublicQuestions"
            size="small"
          />
        </NFlex>
      </NFormItem>
    </PropsGrid>
  </NForm>

  <NForm
    v-else-if="props.block.type === 'image'"
    label-placement="top"
    size="small"
  >
    <PropsGrid>
      <NFormItem label="最大宽度">
        <NInput
          v-model:value="blockProps.maxWidth"
          placeholder="例如 100% 或 480px"
        />
      </NFormItem>
      <NFormItem label="最大高度">
        <NInput
          v-model:value="blockProps.maxHeight"
          placeholder="例如 100% 或 320px"
        />
      </NFormItem>
      <NFormItem label="形状">
        <NSelect
          v-model:value="blockProps.shape"
          :options="[
            { label: '圆角 - Rounded', value: 'rounded' },
            { label: '直角 - Square', value: 'square' },
            { label: '圆形 - Circle', value: 'circle' },
          ]"
        />
      </NFormItem>
      <NFormItem label="图片描述 (Alt)">
        <NInput
          v-model:value="blockProps.alt"
          placeholder="图片加载失败时显示的文字"
        />
      </NFormItem>
      <NFormItem
        class="span-full"
        label="本地图片"
      >
        <NFlex align="center">
          <NButton
            size="small"
            :loading="editor.isUploading.value"
            @click="editor.triggerUpload(props.block, 'imageFile')"
          >
            <template #icon>
              <NIcon><ImageOutline /></NIcon>
            </template>
            上传图片
          </NButton>
          <NButton
            size="small"
            secondary
            :disabled="!blockProps.imageFile"
            @click="editor.clearUploadedFile(props.block, 'imageFile')"
          >
            清除
          </NButton>
          <img
            v-if="blockProps.imageFile?.path"
            :src="blockProps.imageFile.path"
            alt=""
            referrerpolicy="no-referrer"
            style="
              width: 36px;
              height: 36px;
              object-fit: cover;
              border-radius: 6px;
              border: 1px solid var(--vtsuru-border);
            "
          />
          <NText depth="3">
            {{ blockProps.imageFile?.name || blockProps.imageFile?.path || '' }}
          </NText>
        </NFlex>
      </NFormItem>
    </PropsGrid>
  </NForm>

  <NForm
    v-else-if="props.block.type === 'embed'"
    label-placement="top"
    size="small"
  >
    <PropsGrid>
      <NFormItem
        class="span-full"
        label="嵌入链接 (支持 Bilibili / YouTube)"
      >
        <NInput
          v-model:value="blockProps.url"
          placeholder="https://www.youtube.com/watch?v=..."
        />
      </NFormItem>
      <NFormItem label="标题">
        <NInput
          v-model:value="blockProps.title"
          placeholder="可选，用于无障碍访问"
        />
      </NFormItem>
    </PropsGrid>
  </NForm>

  <NForm
    v-else-if="props.block.type === 'divider'"
    label-placement="top"
    size="small"
  >
    <PropsGrid>
      <NFormItem label="文字">
        <NInput v-model:value="blockProps.text" />
      </NFormItem>
      <NFormItem
        v-if="propertyAvailable('titlePlacement')"
        label="文字位置"
      >
        <NSelect
          v-model:value="blockProps.titlePlacement"
          :options="[
            { label: '居左', value: 'left' },
            { label: '居中', value: 'center' },
            { label: '居右', value: 'right' },
          ]"
        />
      </NFormItem>
      <NFormItem label="上边距 px">
        <NInputNumber
          v-model:value="blockProps.marginTop"
          :min="0"
          :max="80"
          style="width: 100%"
        />
      </NFormItem>
      <NFormItem label="下边距 px">
        <NInputNumber
          v-model:value="blockProps.marginBottom"
          :min="0"
          :max="80"
          style="width: 100%"
        />
      </NFormItem>
    </PropsGrid>
  </NForm>

  <NForm
    v-else-if="props.block.type === 'spacer'"
    label-placement="top"
    size="small"
  >
    <NFormItem label="大小">
      <NSelect
        v-model:value="blockProps.size"
        :options="[
          { label: 'sm', value: 'sm' },
          { label: 'md', value: 'md' },
          { label: 'lg', value: 'lg' },
        ]"
      />
    </NFormItem>
  </NForm>

  <NForm
    v-else-if="props.block.type === 'footer'"
    label-placement="top"
    size="small"
  >
    <NFormItem label="文字">
      <NInput v-model:value="blockProps.text" />
    </NFormItem>
  </NForm>
</template>
