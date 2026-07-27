<script setup lang="ts">
import type { Component } from 'vue'
import type { BlockNode, BlockType } from '@/apps/user-page/block/schema'
import { NDivider, NFormItem, NInput, NSwitch, NText } from 'naive-ui'
import { computed } from 'vue'
import ImageGalleryPropsEditor from './ImageGalleryPropsEditor.vue'
import PropsGrid from './PropsGrid.vue'
import BasicContentPropsEditor from './block-props-editors/BasicContentPropsEditor.vue'
import ButtonsPropsEditor from './block-props-editors/ButtonsPropsEditor.vue'
import CollectionPropsEditor from './block-props-editors/CollectionPropsEditor.vue'
import LayoutPropsEditor from './block-props-editors/LayoutPropsEditor.vue'
import MediaDecorationPropsEditor from './block-props-editors/MediaDecorationPropsEditor.vue'
import NavigationPropsEditor from './block-props-editors/NavigationPropsEditor.vue'
import RemoteContentPropsEditor from './block-props-editors/RemoteContentPropsEditor.vue'
import { useBlockPropsEditor } from './block-props-editors/useBlockPropsEditor'

const props = defineProps<{ block: BlockNode }>()
const { editor, blockProps } = useBlockPropsEditor(() => props.block)

const editorByType: Partial<Record<BlockType, Component>> = {
  layout: LayoutPropsEditor,
  profile: BasicContentPropsEditor,
  heading: BasicContentPropsEditor,
  text: BasicContentPropsEditor,
  richText: BasicContentPropsEditor,
  alert: BasicContentPropsEditor,
  liveStatus: RemoteContentPropsEditor,
  streamSchedule: RemoteContentPropsEditor,
  biliInfo: RemoteContentPropsEditor,
  videoList: RemoteContentPropsEditor,
  musicPlayer: RemoteContentPropsEditor,
  links: NavigationPropsEditor,
  buttons: ButtonsPropsEditor,
  button: NavigationPropsEditor,
  socialLinks: NavigationPropsEditor,
  tags: CollectionPropsEditor,
  milestone: CollectionPropsEditor,
  faq: CollectionPropsEditor,
  supporter: CollectionPropsEditor,
  quote: MediaDecorationPropsEditor,
  marquee: MediaDecorationPropsEditor,
  countdown: MediaDecorationPropsEditor,
  feedback: MediaDecorationPropsEditor,
  image: MediaDecorationPropsEditor,
  embed: MediaDecorationPropsEditor,
  divider: MediaDecorationPropsEditor,
  spacer: MediaDecorationPropsEditor,
  footer: MediaDecorationPropsEditor,
}

const unframedTypes = new Set<BlockType>([
  'layout',
  'spacer',
  'footer',
  'buttons',
  'button',
  'tags',
  'countdown',
  'imageGallery',
  'richText',
  'marquee',
])

const blockNameModel = computed({
  get: () => props.block.name ?? '',
  set(value: string) {
    const name = value.trim().slice(0, 50)
    if (name) props.block.name = name
    else delete props.block.name
  },
})

function chromeModel(key: 'framed' | 'backgrounded') {
  return computed({
    get: () => typeof blockProps.value[key] === 'boolean'
      ? blockProps.value[key]
      : !unframedTypes.has(props.block.type),
    set(value: boolean) {
      const defaultValue = !unframedTypes.has(props.block.type)
      if (value === defaultValue) delete blockProps.value[key]
      else blockProps.value[key] = value
    },
  })
}

const blockFramedModel = chromeModel('framed')
const blockBackgroundedModel = chromeModel('backgrounded')
const selectedEditor = computed(() => editorByType[props.block.type])
</script>

<template>
  <div>
    <NDivider style="margin: 0 0 10px" title-placement="left">
      默认属性
    </NDivider>
    <PropsGrid :row-gap="0">
      <NFormItem label="区块名称" style="justify-self: start; width: min(260px, 100%)">
        <NInput v-model:value="blockNameModel" maxlength="50" show-count placeholder="例如：直播信息 · 紧凑" />
      </NFormItem>
      <NFormItem label="显示边框" style="justify-self: start; width: min(180px, 100%)">
        <NSwitch v-model:value="blockFramedModel" size="small" />
      </NFormItem>
      <NFormItem label="显示背景" style="justify-self: start; width: min(180px, 100%)">
        <NSwitch v-model:value="blockBackgroundedModel" size="small" />
      </NFormItem>
    </PropsGrid>

    <ImageGalleryPropsEditor
      v-if="props.block.type === 'imageGallery'"
      :block="props.block"
      :editor="editor"
    />
    <component :is="selectedEditor" v-else-if="selectedEditor" :key="props.block.id" :block="props.block" />
    <NText v-else depth="3">
      未知区块类型：{{ props.block.type }}
    </NText>
  </div>
</template>
