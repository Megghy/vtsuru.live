<script setup lang="ts">
import { computed, defineAsyncComponent, ref } from 'vue'

import {
  CUSTOM_HTML_MAX_HEIGHT,
  CUSTOM_HTML_MIN_AUTO_HEIGHT,
  CUSTOM_HTML_MIN_HEIGHT,
  normalizeCustomHtmlProps,
  utf8ByteLength,
} from '@/apps/user-page/block/customHtmlContract'
import type { BlockNode } from '@/apps/user-page/block/schema'

import PropsGrid from '../PropsGrid.vue'
import { useBlockPropsEditor } from './useBlockPropsEditor'

const props = defineProps<{ block: BlockNode }>()
const { blockProps } = useBlockPropsEditor(() => props.block)
const editorOpen = ref(false)
const CustomHtmlEditorModal = defineAsyncComponent(() => import('../CustomHtmlEditorModal.vue'))
const config = computed(() => normalizeCustomHtmlProps(blockProps.value))
const codeBytes = computed(() => utf8ByteLength(config.value.html) + utf8ByteLength(config.value.css))

const heightMode = computed({
  get: () => config.value.heightMode,
  set: (value: 'auto' | 'fixed') => {
    blockProps.value.heightMode = value
  },
})
const fixedHeight = computed({
  get: () => config.value.height,
  set: (value: number | null) => {
    if (value !== null) blockProps.value.height = value
  },
})
const maxHeight = computed({
  get: () => config.value.maxHeight,
  set: (value: number | null) => {
    if (value !== null) blockProps.value.maxHeight = value
  },
})
</script>

<template>
  <div class="builder-stack">
    <UButton
      color="primary"
      variant="soft"
      block
      @click="editorOpen = true"
    >
      <template #icon>
        <UIcon name="i-lucide-code-xml" />
      </template>
      打开代码编辑器
    </UButton>
    <span
      class="builder-text"
      style="font-size: 12px"
    >
      HTML + CSS {{ codeBytes }} bytes · {{ config.assets.length }} 个资源
    </span>

    <PropsGrid :row-gap="0">
      <UFormField label="高度方式">
        <URadioGroup
          v-model="heightMode"
          :items="[
            { label: '自动', value: 'auto' },
            { label: '固定', value: 'fixed' },
          ]"
          orientation="horizontal"
        />
      </UFormField>
      <UFormField
        v-if="heightMode === 'fixed'"
        label="固定高度"
      >
        <div class="builder-row">
          <UInputNumber
            v-model="fixedHeight"
            :min="CUSTOM_HTML_MIN_HEIGHT"
            :max="CUSTOM_HTML_MAX_HEIGHT"
            :step="20"
          /><span>px</span>
        </div>
      </UFormField>
      <UFormField
        v-else
        label="最大高度"
      >
        <div class="builder-row">
          <UInputNumber
            v-model="maxHeight"
            :min="CUSTOM_HTML_MIN_AUTO_HEIGHT"
            :max="CUSTOM_HTML_MAX_HEIGHT"
            :step="20"
          /><span>px</span>
        </div>
      </UFormField>
    </PropsGrid>

    <CustomHtmlEditorModal
      v-if="editorOpen"
      v-model:show="editorOpen"
      :block="props.block"
    />
  </div>
</template>
