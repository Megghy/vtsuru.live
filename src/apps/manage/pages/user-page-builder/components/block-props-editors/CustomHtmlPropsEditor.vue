<script setup lang="ts">
import {
  CUSTOM_HTML_MAX_HEIGHT,
  CUSTOM_HTML_MIN_AUTO_HEIGHT,
  CUSTOM_HTML_MIN_HEIGHT,
  normalizeCustomHtmlProps,
  utf8ByteLength,
} from '@/apps/user-page/block/customHtmlContract'
import { CodeSlashOutline } from '@vicons/ionicons5'
import { NButton, NFlex, NFormItem, NIcon, NInputNumber, NRadioButton, NRadioGroup, NText } from 'naive-ui'
import { computed, defineAsyncComponent, ref } from 'vue'
import PropsGrid from '../PropsGrid.vue'
import { useBlockPropsEditor } from './useBlockPropsEditor'
import type { BlockNode } from '@/apps/user-page/block/schema'

const props = defineProps<{ block: BlockNode }>()
const { blockProps } = useBlockPropsEditor(() => props.block)
const editorOpen = ref(false)
const CustomHtmlEditorModal = defineAsyncComponent(() => import('../CustomHtmlEditorModal.vue'))
const config = computed(() => normalizeCustomHtmlProps(blockProps.value))
const codeBytes = computed(() => utf8ByteLength(config.value.html) + utf8ByteLength(config.value.css))

const heightMode = computed({
  get: () => config.value.heightMode,
  set: (value: 'auto' | 'fixed') => { blockProps.value.heightMode = value },
})
const fixedHeight = computed({
  get: () => config.value.height,
  set: (value: number | null) => { if (value !== null) blockProps.value.height = value },
})
const maxHeight = computed({
  get: () => config.value.maxHeight,
  set: (value: number | null) => { if (value !== null) blockProps.value.maxHeight = value },
})
</script>

<template>
  <NFlex vertical size="small">
    <NButton type="primary" secondary block @click="editorOpen = true">
      <template #icon>
        <NIcon><CodeSlashOutline /></NIcon>
      </template>
      打开代码编辑器
    </NButton>
    <NText depth="3" style="font-size: 12px">
      HTML + CSS {{ codeBytes }} bytes · {{ config.assets.length }} 个资源
    </NText>

    <PropsGrid :row-gap="0">
      <NFormItem label="高度方式">
        <NRadioGroup v-model:value="heightMode" size="small">
          <NRadioButton value="auto">
            自动
          </NRadioButton>
          <NRadioButton value="fixed">
            固定
          </NRadioButton>
        </NRadioGroup>
      </NFormItem>
      <NFormItem v-if="heightMode === 'fixed'" label="固定高度">
        <NInputNumber v-model:value="fixedHeight" :min="CUSTOM_HTML_MIN_HEIGHT" :max="CUSTOM_HTML_MAX_HEIGHT" :step="20">
          <template #suffix>
            px
          </template>
        </NInputNumber>
      </NFormItem>
      <NFormItem v-else label="最大高度">
        <NInputNumber v-model:value="maxHeight" :min="CUSTOM_HTML_MIN_AUTO_HEIGHT" :max="CUSTOM_HTML_MAX_HEIGHT" :step="20">
          <template #suffix>
            px
          </template>
        </NInputNumber>
      </NFormItem>
    </PropsGrid>

    <CustomHtmlEditorModal v-if="editorOpen" v-model:show="editorOpen" :block="props.block" />
  </NFlex>
</template>
