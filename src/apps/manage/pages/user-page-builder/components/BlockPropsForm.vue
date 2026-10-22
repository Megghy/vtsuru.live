<script setup lang="ts">
import type { Component } from 'vue'
import { computed, ref, watch } from 'vue'

import { isBlockPropertyAvailable } from '@/apps/user-page/block/propertyCapabilities'
import type { BlockNode, BlockType, BlockVisibility } from '@/apps/user-page/block/schema'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/shared/ui/accordion'
import { Alert, AlertDescription } from '@/shared/ui/alert'
import { Badge } from '@/shared/ui/badge'
import { Input } from '@/shared/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/ui/select'
import { Switch } from '@/shared/ui/switch'

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

const visibilityTags = computed(() => {
  const tags: string[] = []
  if (liveStateModel.value === 'live') tags.push('仅直播中')
  else if (liveStateModel.value === 'offline') tags.push('仅未开播')
  if (deviceModel.value === 'desktop') tags.push('仅桌面端')
  else if (deviceModel.value === 'mobile') tags.push('仅移动端')
  return tags
})

const selectedEditor = computed(() => editorByType[props.block.type])
const expandedCommonSections = ref<string[]>([])
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
  <div class="flex flex-col gap-3">
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
    <div
      v-else
      class="text-xs text-muted-foreground"
    >
      未知区块类型：{{ props.block.type }}
    </div>

    <Accordion
      v-model="expandedCommonSections"
      type="multiple"
      class="block-common-sections border rounded-lg bg-card mt-2 p-2"
    >
      <AccordionItem
        value="defaults"
        class="border-b-0"
      >
        <AccordionTrigger class="text-xs font-semibold py-2">
          卡片外观与命名
        </AccordionTrigger>
        <AccordionContent class="pt-2 pb-1">
          <PropsGrid :row-gap="0">
            <div
              class="flex flex-col gap-1 w-full"
              data-validation-field="name"
            >
              <label class="text-xs text-muted-foreground">区块备注名称</label>
              <Input v-model="blockNameModel" maxlength="50" placeholder="例如：直播信息 · 紧凑" />
            </div>

            <div
              v-if="propertyAvailable('framed')"
              class="flex items-center justify-between pt-4"
            >
              <label class="text-xs text-muted-foreground">显示边框</label>
              <Switch :checked="blockFramedModel" @update:checked="blockFramedModel = $event" />
            </div>

            <div
              v-if="propertyAvailable('backgrounded')"
              class="flex items-center justify-between pt-4"
            >
              <label class="text-xs text-muted-foreground">显示背景</label>
              <Switch :checked="blockBackgroundedModel" @update:checked="blockBackgroundedModel = $event" />
            </div>
          </PropsGrid>
        </AccordionContent>
      </AccordionItem>

      <AccordionItem
        value="visibility"
        class="border-b-0"
      >
        <AccordionTrigger class="text-xs font-semibold py-2">
          <div class="flex items-center justify-between w-full pr-2">
            <span>显示条件</span>
            <div class="flex items-center gap-1">
              <Badge
                v-for="tag in visibilityTags"
                :key="tag"
                variant="outline"
                class="text-[10px] h-4.5 px-1.5"
              >
                {{ tag }}
              </Badge>
            </div>
          </div>
        </AccordionTrigger>
        <AccordionContent class="pt-2 pb-1">
          <PropsGrid :row-gap="0">
            <div
              class="flex flex-col gap-1"
              data-validation-field="visibility.liveState"
            >
              <label class="text-xs text-muted-foreground">直播状态</label>
              <Select v-model="liveStateModel">
                <SelectTrigger>
                  <SelectValue placeholder="直播状态" />
                </SelectTrigger>
                <SelectContent class="text-xs">
                  <SelectItem value="always">始终显示</SelectItem>
                  <SelectItem value="live">仅直播中</SelectItem>
                  <SelectItem value="offline">仅未开播</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div
              class="flex flex-col gap-1"
              data-validation-field="visibility.device"
            >
              <label class="text-xs text-muted-foreground">设备</label>
              <Select v-model="deviceModel">
                <SelectTrigger>
                  <SelectValue placeholder="设备" />
                </SelectTrigger>
                <SelectContent class="text-xs">
                  <SelectItem value="always">所有设备</SelectItem>
                  <SelectItem value="desktop">仅桌面端</SelectItem>
                  <SelectItem value="mobile">仅移动端</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </PropsGrid>
        </AccordionContent>
      </AccordionItem>
    </Accordion>

    <div
      v-if="validationIssues.length"
      class="validation-issues flex flex-col gap-1.5 mt-2"
      role="status"
      aria-live="polite"
    >
      <Alert
        v-for="(issue, index) in validationIssues"
        :key="`${issue.fieldPath}:${index}`"
        variant="destructive"
        class="py-2 text-xs"
        :data-validation-field="issue.fieldPath || undefined"
      >
        <AlertDescription>
          <strong v-if="issue.fieldPath">{{ issue.fieldPath }}: </strong>
          {{ issue.message }}
        </AlertDescription>
      </Alert>
    </div>
  </div>
</template>

<style scoped>
.block-common-sections {
  width: auto;
  box-sizing: border-box;
}
</style>
