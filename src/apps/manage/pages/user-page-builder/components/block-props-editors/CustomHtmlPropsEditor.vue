<script setup lang="ts">
import { Code2 } from 'lucide-vue-next'
import { computed, defineAsyncComponent, ref } from 'vue'

import {
  CUSTOM_HTML_MAX_HEIGHT,
  CUSTOM_HTML_MIN_AUTO_HEIGHT,
  CUSTOM_HTML_MIN_HEIGHT,
  normalizeCustomHtmlProps,
  utf8ByteLength,
} from '@/apps/user-page/block/customHtmlContract'
import type { BlockNode } from '@/apps/user-page/block/schema'
import { Button } from '@/shared/ui/button'
import { NumberField } from '@/shared/ui/number-field'

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
  <div class="flex flex-col gap-2">
    <Button
      variant="outline"
      class="w-full"
      @click="editorOpen = true"
    >
      <Code2 class="mr-1.5 size-4" />
      打开代码编辑器
    </Button>
    <span class="text-xs text-muted-foreground">
      HTML + CSS {{ codeBytes }} bytes · {{ config.assets.length }} 个资源
    </span>

    <PropsGrid :row-gap="0">
      <div class="space-y-1">
        <label class="text-xs text-muted-foreground">高度方式</label>
        <div class="inline-flex rounded-md border border-input p-0.5 bg-muted/40">
          <Button
            size="xs"
            :variant="heightMode === 'auto' ? 'secondary' : 'ghost'"
            class="px-3"
            @click="heightMode = 'auto'"
          >
            自动
          </Button>
          <Button
            size="xs"
            :variant="heightMode === 'fixed' ? 'secondary' : 'ghost'"
            class="px-3"
            @click="heightMode = 'fixed'"
          >
            固定
          </Button>
        </div>
      </div>
      <div
        v-if="heightMode === 'fixed'"
        class="space-y-1"
      >
        <label class="text-xs text-muted-foreground">固定高度</label>
        <NumberField
          v-model="fixedHeight"
          :min="CUSTOM_HTML_MIN_HEIGHT"
          :max="CUSTOM_HTML_MAX_HEIGHT"
          :step="20"
          class="w-full"
        />
      </div>
      <div
        v-else
        class="space-y-1"
      >
        <label class="text-xs text-muted-foreground">最大高度</label>
        <NumberField
          v-model="maxHeight"
          :min="CUSTOM_HTML_MIN_AUTO_HEIGHT"
          :max="CUSTOM_HTML_MAX_HEIGHT"
          :step="20"
          class="w-full"
        />
      </div>
    </PropsGrid>

    <CustomHtmlEditorModal
      v-if="editorOpen"
      v-model:show="editorOpen"
      :block="props.block"
    />
  </div>
</template>
