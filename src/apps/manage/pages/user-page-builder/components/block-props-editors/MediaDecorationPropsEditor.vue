<script setup lang="ts">
import { computed } from 'vue'

import type { BlockNode } from '@/apps/user-page/block/schema'

import PropsGrid from '../PropsGrid.vue'
import UnixDateTimeInput from '../UnixDateTimeInput.vue'
import { useBlockPropsEditor } from './useBlockPropsEditor'

const props = defineProps<{ block: BlockNode }>()
const { editor, blockProps, propertyAvailable } = useBlockPropsEditor(() => props.block)

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
  <div
    class="builder-form"
    v-if="props.block.type === 'quote'"
  >
    <PropsGrid>
      <UFormField
        class="span-full"
        label="内容"
      >
        <UTextarea
          v-model="blockProps.text"
          :autosize="{ minRows: 3, maxRows: 8 }"
        />
      </UFormField>
      <UFormField label="作者">
        <UInput v-model="blockProps.author" />
      </UFormField>
      <UFormField label="对齐">
        <USelect
          v-model="blockProps.align"
          :items="[
            { label: 'left', value: 'left' },
            { label: 'center', value: 'center' },
            { label: 'right', value: 'right' },
          ]"
        />
      </UFormField>
    </PropsGrid>
  </div>

  <div
    class="builder-form"
    v-else-if="props.block.type === 'marquee'"
  >
    <PropsGrid>
      <UFormField
        class="span-full"
        label="文本"
      >
        <UTextarea
          v-model="blockProps.text"
          :autosize="{ minRows: 2, maxRows: 6 }"
        />
      </UFormField>
      <UFormField label="方向">
        <USelect
          v-model="blockProps.direction"
          :items="[
            { label: '向左', value: 'left' },
            { label: '向右', value: 'right' },
            { label: '向上', value: 'up' },
            { label: '向下', value: 'down' },
          ]"
        />
      </UFormField>
      <UFormField label="滚动时长 秒">
        <UInputNumber
          v-model="blockProps.durationSec"
          :min="4"
          :max="120"
          style="width: 100%"
        />
      </UFormField>
      <UFormField label="悬停暂停">
        <div class="builder-row">
          <USwitch
            v-model="blockProps.pauseOnHover"
            size="small"
          />
        </div>
      </UFormField>
    </PropsGrid>
  </div>

  <div
    class="builder-form"
    v-else-if="props.block.type === 'countdown'"
  >
    <PropsGrid>
      <UFormField
        class="span-full"
        label="标题"
      >
        <UInput
          v-model="blockProps.title"
          placeholder="例如：生日倒计时"
        />
      </UFormField>
      <UFormField
        class="span-full"
        label="目标时间"
      >
        <UnixDateTimeInput
          v-model="countdownTarget"
          placeholder="选择目标时间"
        />
      </UFormField>
      <UFormField label="展示样式">
        <USelect
          v-model="blockProps.style"
          :items="[
            { label: 'cards', value: 'cards' },
            { label: 'inline', value: 'inline' },
          ]"
        />
      </UFormField>
      <UFormField label="显示秒">
        <div class="builder-row">
          <USwitch
            v-model="blockProps.showSeconds"
            size="small"
          />
        </div>
      </UFormField>
      <UFormField
        class="span-full"
        label="到达后文案"
      >
        <UInput
          v-model="blockProps.doneText"
          placeholder="已到达"
        />
      </UFormField>
    </PropsGrid>
  </div>

  <div
    class="builder-form"
    v-else-if="props.block.type === 'feedback'"
  >
    <PropsGrid>
      <UFormField
        v-if="propertyAvailable('title')"
        label="标题"
      >
        <UInput v-model="blockProps.title" />
      </UFormField>
      <UFormField
        v-if="propertyAvailable('buttonText')"
        label="按钮文字"
      >
        <UInput v-model="blockProps.buttonText" />
      </UFormField>
      <UFormField
        v-if="propertyAvailable('description')"
        class="span-full"
        label="描述"
      >
        <UTextarea
          v-model="blockProps.description"
          :autosize="{ minRows: 2, maxRows: 6 }"
        />
      </UFormField>
      <UFormField
        v-if="propertyAvailable('url')"
        class="span-full"
        label="链接 (https)"
        :required="blockProps.embed && blockProps.embedMode === 'iframe'"
      >
        <UInput
          v-model="blockProps.url"
          placeholder="https://..."
        />
      </UFormField>
      <UFormField label="嵌入到页面">
        <div class="builder-row">
          <USwitch
            v-model="blockProps.embed"
            size="small"
            @update:model-value="enableFeedbackEmbed"
          />
          <UAlert
            type="info"
            :show-icon="false"
            style="font-size: 12px; padding: 6px 10px; border-radius: var(--vtsuru-page-radius)"
          >
            开启“嵌入到页面”后，可选择站内提问箱
          </UAlert>
        </div>
      </UFormField>
      <UFormField
        v-if="propertyAvailable('embedMode')"
        class="span-full"
        label="嵌入内容"
      >
        <USelect
          v-model="blockProps.embedMode"
          :items="[
            { label: '站内提问箱', value: 'questionBox' },
            { label: '站外 iframe', value: 'iframe' },
          ]"
        />
      </UFormField>
      <UFormField
        v-if="propertyAvailable('height')"
        label="内嵌高度"
      >
        <UInputNumber
          v-model="blockProps.height"
          :min="200"
          :max="1200"
          style="width: 100%"
        />
      </UFormField>
    </PropsGrid>
  </div>

  <div
    class="builder-form"
    v-else-if="props.block.type === 'image'"
  >
    <PropsGrid>
      <UFormField label="最大宽度">
        <UInput
          v-model="blockProps.maxWidth"
          placeholder="例如 100% 或 480px"
        />
      </UFormField>
      <UFormField label="最大高度">
        <UInput
          v-model="blockProps.maxHeight"
          placeholder="例如 100% 或 320px"
        />
      </UFormField>
      <UFormField label="形状">
        <USelect
          v-model="blockProps.shape"
          :items="[
            { label: '圆角 - Rounded', value: 'rounded' },
            { label: '直角 - Square', value: 'square' },
            { label: '圆形 - Circle', value: 'circle' },
          ]"
        />
      </UFormField>
      <UFormField label="图片描述 (Alt)">
        <UInput
          v-model="blockProps.alt"
          placeholder="图片加载失败时显示的文字"
        />
      </UFormField>
      <UFormField
        class="span-full"
        label="本地图片"
      >
        <div class="builder-row">
          <UButton
            size="sm"
            :loading="editor.isUploading.value"
            @click="editor.triggerUpload(props.block, 'imageFile')"
          >
            <template #icon>
              <UIcon name="i-lucide-image" />
            </template>
            上传图片
          </UButton>
          <UButton
            size="sm"
            variant="soft"
            :disabled="!blockProps.imageFile"
            @click="editor.clearUploadedFile(props.block, 'imageFile')"
          >
            清除
          </UButton>
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
          <span class="builder-text">
            {{ blockProps.imageFile?.name || blockProps.imageFile?.path || '' }}
          </span>
        </div>
      </UFormField>
    </PropsGrid>
  </div>

  <div
    class="builder-form"
    v-else-if="props.block.type === 'embed'"
  >
    <PropsGrid>
      <UFormField
        class="span-full"
        label="嵌入链接 (支持 Bilibili / YouTube)"
      >
        <UInput
          v-model="blockProps.url"
          placeholder="https://www.youtube.com/watch?v=..."
        />
      </UFormField>
      <UFormField label="标题">
        <UInput
          v-model="blockProps.title"
          placeholder="可选，用于无障碍访问"
        />
      </UFormField>
    </PropsGrid>
  </div>

  <div
    class="builder-form"
    v-else-if="props.block.type === 'divider'"
  >
    <PropsGrid>
      <UFormField label="文字">
        <UInput v-model="blockProps.text" />
      </UFormField>
      <UFormField
        v-if="propertyAvailable('titlePlacement')"
        label="文字位置"
      >
        <USelect
          v-model="blockProps.titlePlacement"
          :items="[
            { label: '居左', value: 'left' },
            { label: '居中', value: 'center' },
            { label: '居右', value: 'right' },
          ]"
        />
      </UFormField>
      <UFormField label="上边距 px">
        <UInputNumber
          v-model="blockProps.marginTop"
          :min="0"
          :max="80"
          style="width: 100%"
        />
      </UFormField>
      <UFormField label="下边距 px">
        <UInputNumber
          v-model="blockProps.marginBottom"
          :min="0"
          :max="80"
          style="width: 100%"
        />
      </UFormField>
    </PropsGrid>
  </div>

  <div
    class="builder-form"
    v-else-if="props.block.type === 'spacer'"
  >
    <UFormField label="大小">
      <USelect
        v-model="blockProps.size"
        :items="[
          { label: 'sm', value: 'sm' },
          { label: 'md', value: 'md' },
          { label: 'lg', value: 'lg' },
        ]"
      />
    </UFormField>
  </div>

  <div
    class="builder-form"
    v-else-if="props.block.type === 'footer'"
  >
    <UFormField label="文字">
      <UInput v-model="blockProps.text" />
    </UFormField>
  </div>
</template>
