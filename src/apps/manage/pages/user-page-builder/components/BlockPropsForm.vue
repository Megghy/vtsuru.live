<script setup lang="ts">
import type { Component } from 'vue'
import { computed, ref, watch } from 'vue'

import { isBlockPropertyAvailable } from '@/apps/user-page/block/propertyCapabilities'
import type { BlockNode, BlockType, BlockVisibility } from '@/apps/user-page/block/schema'

import BasicContentPropsEditor from './block-props-editors/BasicContentPropsEditor.vue'
import ButtonsPropsEditor from './block-props-editors/ButtonsPropsEditor.vue'
import CardListPropsEditor from './block-props-editors/CardListPropsEditor.vue'
import CheckInRankingPropsEditor from './block-props-editors/CheckInRankingPropsEditor.vue'
import CollectionPropsEditor from './block-props-editors/CollectionPropsEditor.vue'
import CustomHtmlPropsEditor from './block-props-editors/CustomHtmlPropsEditor.vue'
import FeaturedGoodsPropsEditor from './block-props-editors/FeaturedGoodsPropsEditor.vue'
import FeatureNavPropsEditor from './block-props-editors/FeatureNavPropsEditor.vue'
import LayoutPropsEditor from './block-props-editors/LayoutPropsEditor.vue'
import MediaDecorationPropsEditor from './block-props-editors/MediaDecorationPropsEditor.vue'
import NavigationPropsEditor from './block-props-editors/NavigationPropsEditor.vue'
import NowPlayingPropsEditor from './block-props-editors/NowPlayingPropsEditor.vue'
import QrCodePropsEditor from './block-props-editors/QrCodePropsEditor.vue'
import RemoteContentPropsEditor from './block-props-editors/RemoteContentPropsEditor.vue'
import SectionNavPropsEditor from './block-props-editors/SectionNavPropsEditor.vue'
import SongListPropsEditor from './block-props-editors/SongListPropsEditor.vue'
import { useBlockPropsEditor } from './block-props-editors/useBlockPropsEditor'
import VideoCollectPropsEditor from './block-props-editors/VideoCollectPropsEditor.vue'
import ImageGalleryPropsEditor from './ImageGalleryPropsEditor.vue'
import PropsGrid from './PropsGrid.vue'
import UnixDateTimeRangeInput from './UnixDateTimeRangeInput.vue'

const props = defineProps<{ block: BlockNode }>()
const { editor, blockProps } = useBlockPropsEditor(() => props.block)

const editorByType: Partial<Record<BlockType, Component>> = {
  layout: LayoutPropsEditor,
  profile: BasicContentPropsEditor,
  heading: BasicContentPropsEditor,
  text: BasicContentPropsEditor,
  richText: BasicContentPropsEditor,
  customHtml: CustomHtmlPropsEditor,
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
  qrcode: QrCodePropsEditor,
  featureNav: FeatureNavPropsEditor,
  songList: SongListPropsEditor,
  cardList: CardListPropsEditor,
  checkInRanking: CheckInRankingPropsEditor,
  featuredGoods: FeaturedGoodsPropsEditor,
  videoCollect: VideoCollectPropsEditor,
  sectionNav: SectionNavPropsEditor,
  nowPlaying: NowPlayingPropsEditor,
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
  'customHtml',
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
    get: () =>
      typeof blockProps.value[key] === 'boolean' ? blockProps.value[key] : !unframedTypes.has(props.block.type),
    set(value: boolean) {
      const defaultValue = !unframedTypes.has(props.block.type)
      if (value === defaultValue) delete blockProps.value[key]
      else blockProps.value[key] = value
    },
  })
}

const blockFramedModel = chromeModel('framed')
const blockBackgroundedModel = chromeModel('backgrounded')
const liveStateModel = visibilityModel('liveState')
const deviceModel = visibilityModel('device')
const dateRangeModel = computed<[number, number] | null>({
  get: () =>
    props.block.visibility?.startsAt !== undefined && props.block.visibility.endsAt !== undefined
      ? ([props.block.visibility.startsAt * 1000, props.block.visibility.endsAt * 1000] as [number, number])
      : null,
  set(value) {
    updateVisibility({
      startsAt: value ? Math.floor(value[0] / 1000) : undefined,
      endsAt: value ? Math.floor(value[1] / 1000) : undefined,
    })
  },
})
const selectedEditor = computed(() => editorByType[props.block.type])
const expandedCommonSections = ref<Array<string | number>>([])
const validationIssues = computed(() =>
  editor.liveValidationIssues.value.filter(
    (issue) => issue.scope === 'block' && issue.pageKey === editor.currentKey.value && issue.blockId === props.block.id,
  ),
)

watch(
  () => editor.validationFocusRequest.value?.requestId,
  () => {
    const request = editor.validationFocusRequest.value
    if (request?.scope !== 'block' || request.blockId !== props.block.id) return
    const section = request.fieldPath?.startsWith('visibility.') ? 'visibility' : 'defaults'
    if (!expandedCommonSections.value.includes(section)) expandedCommonSections.value.push(section)
  },
  { immediate: true },
)

function propertyAvailable(property: string) {
  return isBlockPropertyAvailable(props.block.type, blockProps.value, property)
}

function updateVisibility(patch: Partial<BlockVisibility>) {
  const next = { ...props.block.visibility, ...patch }
  Object.keys(next).forEach((key) => {
    if (next[key as keyof BlockVisibility] === undefined) delete next[key as keyof BlockVisibility]
  })
  if (Object.keys(next).length) props.block.visibility = next
  else delete props.block.visibility
}

function visibilityModel<Key extends 'liveState' | 'device'>(key: Key) {
  return computed({
    get: () => props.block.visibility?.[key] ?? 'always',
    set: (value: BlockVisibility[Key] | 'always') =>
      updateVisibility({ [key]: value === 'always' ? undefined : value }),
  })
}
</script>

<template>
  <div>
    <ImageGalleryPropsEditor
      v-if="props.block.type === 'imageGallery'"
      :block="props.block"
      :editor="editor"
    />
    <component
      :is="selectedEditor"
      v-else-if="selectedEditor"
      :key="props.block.id"
      :block="props.block"
    />
    <span
      class="builder-text"
      v-else
    >
      未知区块类型：{{ props.block.type }}
    </span>

    <div class="block-common-sections">
      <details>
        <summary>默认属性</summary>
        <PropsGrid :row-gap="0">
          <UFormField
            label="区块名称"
            style="justify-self: start; width: min(260px, 100%)"
            data-validation-field="name"
          >
            <UInput
              v-model="blockNameModel"
              maxlength="50"
              show-count
              placeholder="例如：直播信息 · 紧凑"
            />
          </UFormField>
          <UFormField
            v-if="propertyAvailable('framed')"
            label="显示边框"
            style="justify-self: start; width: min(180px, 100%)"
          >
            <USwitch
              v-model="blockFramedModel"
              size="small"
            />
          </UFormField>
          <UFormField
            v-if="propertyAvailable('backgrounded')"
            label="显示背景"
            style="justify-self: start; width: min(180px, 100%)"
          >
            <USwitch
              v-model="blockBackgroundedModel"
              size="small"
            />
          </UFormField>
        </PropsGrid>
      </details>

      <details>
        <summary>显示条件</summary>
        <PropsGrid :row-gap="0">
          <UFormField
            label="直播状态"
            data-validation-field="visibility.liveState"
          >
            <USelect
              v-model="liveStateModel"
              :items="[
                { label: '始终显示', value: 'always' },
                { label: '仅直播中', value: 'live' },
                { label: '仅未开播', value: 'offline' },
              ]"
            />
          </UFormField>
          <UFormField
            label="设备"
            data-validation-field="visibility.device"
          >
            <USelect
              v-model="deviceModel"
              :items="[
                { label: '所有设备', value: 'always' },
                { label: '仅桌面端', value: 'desktop' },
                { label: '仅移动端', value: 'mobile' },
              ]"
            />
          </UFormField>
          <UFormField
            class="span-full"
            label="显示时间范围"
            data-validation-field="visibility.startsAt"
          >
            <UnixDateTimeRangeInput v-model="dateRangeModel" />
          </UFormField>
        </PropsGrid>
      </details>
    </div>

    <div
      v-if="validationIssues.length"
      class="validation-issues"
      role="status"
      aria-live="polite"
    >
      <UAlert
        v-for="(issue, index) in validationIssues"
        :key="`${issue.fieldPath}:${index}`"
        type="error"
        :show-icon="true"
        :data-validation-field="issue.fieldPath || undefined"
      >
        <strong v-if="issue.fieldPath">{{ issue.fieldPath }}</strong>
        {{ issue.message }}
      </UAlert>
    </div>
  </div>
</template>

<style scoped>
.block-common-sections {
  width: auto;
  margin-top: 8px;
  padding-inline: 10px;
  box-sizing: border-box;
  border: 1px solid var(--vtsuru-border);
  border-radius: 6px;
  background: var(--vtsuru-bg-muted);
}

.block-common-sections summary {
  min-height: 20px;
  padding: 10px 0 !important;
  line-height: 20px;
}

.block-common-sections summary > * {
  align-items: center;
  min-height: 20px;
}

.validation-issues {
  display: grid;
  gap: 6px;
  margin-top: 8px;
}
</style>
