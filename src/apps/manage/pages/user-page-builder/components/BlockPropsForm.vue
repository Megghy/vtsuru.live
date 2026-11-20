<script setup lang="ts">
import type { Component } from 'vue'
import { computed, defineAsyncComponent, ref, watch } from 'vue'

import { isBlockPropertyAvailable } from '@/apps/user-page/block/propertyCapabilities'
import type { BlockNode, BlockType, BlockVisibility } from '@/apps/user-page/block/schema'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/shared/ui/accordion'
import { Alert, AlertDescription } from '@/shared/ui/alert'
import { Badge } from '@/shared/ui/badge'
import { FormField } from '@/shared/ui/form-field'
import { Input } from '@/shared/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { SettingRow } from '@/shared/ui/setting-row'
import { Switch } from '@/shared/ui/switch'

import { useBlockPropsEditor } from './block-props-editors/useBlockPropsEditor'
import PropsGrid from './PropsGrid.vue'

const BasicContentPropsEditor = defineAsyncComponent(
  () => import('./block-props-editors/BasicContentPropsEditor.vue'),
)
const ButtonsPropsEditor = defineAsyncComponent(() => import('./block-props-editors/ButtonsPropsEditor.vue'))
const CardListPropsEditor = defineAsyncComponent(() => import('./block-props-editors/CardListPropsEditor.vue'))
const CheckInRankingPropsEditor = defineAsyncComponent(
  () => import('./block-props-editors/CheckInRankingPropsEditor.vue'),
)
const CollectionPropsEditor = defineAsyncComponent(() => import('./block-props-editors/CollectionPropsEditor.vue'))
const CustomHtmlPropsEditor = defineAsyncComponent(() => import('./block-props-editors/CustomHtmlPropsEditor.vue'))
const FeaturedGoodsPropsEditor = defineAsyncComponent(
  () => import('./block-props-editors/FeaturedGoodsPropsEditor.vue'),
)
const FeatureNavPropsEditor = defineAsyncComponent(() => import('./block-props-editors/FeatureNavPropsEditor.vue'))
const LayoutPropsEditor = defineAsyncComponent(() => import('./block-props-editors/LayoutPropsEditor.vue'))
const MediaDecorationPropsEditor = defineAsyncComponent(
  () => import('./block-props-editors/MediaDecorationPropsEditor.vue'),
)
const NavigationPropsEditor = defineAsyncComponent(() => import('./block-props-editors/NavigationPropsEditor.vue'))
const NowPlayingPropsEditor = defineAsyncComponent(() => import('./block-props-editors/NowPlayingPropsEditor.vue'))
const QrCodePropsEditor = defineAsyncComponent(() => import('./block-props-editors/QrCodePropsEditor.vue'))
const RemoteContentPropsEditor = defineAsyncComponent(() => import('./block-props-editors/RemoteContentPropsEditor.vue'))
const SectionNavPropsEditor = defineAsyncComponent(() => import('./block-props-editors/SectionNavPropsEditor.vue'))
const SongListPropsEditor = defineAsyncComponent(() => import('./block-props-editors/SongListPropsEditor.vue'))
const VideoCollectPropsEditor = defineAsyncComponent(() => import('./block-props-editors/VideoCollectPropsEditor.vue'))
const ImageGalleryPropsEditor = defineAsyncComponent(() => import('./ImageGalleryPropsEditor.vue'))

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
      class="w-auto box-border border rounded-lg bg-card mt-2 p-2"
    >
      <AccordionItem
        value="defaults"
        class="border-b-0"
      >
        <AccordionTrigger class="text-xs font-semibold py-2"> 卡片外观与命名 </AccordionTrigger>
        <AccordionContent class="pt-2 pb-1">
          <PropsGrid :row-gap="0">
            <FormField
              label="区块备注名称"
              class="w-full"
              data-validation-field="name"
            >
              <Input
                v-model="blockNameModel"
                maxlength="50"
                placeholder="例如：直播信息 · 紧凑"
              />
            </FormField>

            <SettingRow
              v-if="propertyAvailable('framed')"
              title="显示边框"
              variant="none"
              class="pt-4"
            >
              <Switch
                :checked="blockFramedModel"
                @update:checked="blockFramedModel = $event"
              />
            </SettingRow>

            <SettingRow
              v-if="propertyAvailable('backgrounded')"
              title="显示背景"
              variant="none"
              class="pt-4"
            >
              <Switch
                :checked="blockBackgroundedModel"
                @update:checked="blockBackgroundedModel = $event"
              />
            </SettingRow>
          </PropsGrid>
        </AccordionContent>
      </AccordionItem>

      <AccordionItem
        value="visibility"
        class="border-b-0"
      >
        <AccordionTrigger class="text-xs font-semibold py-2">
          <div class="flex-between w-full pr-2">
            <span>显示条件</span>
            <div class="flex items-center gap-1">
              <Badge v-for="tag in visibilityTags" :key="tag" variant="outline" size="xs">
                {{ tag }}
              </Badge>
            </div>
          </div>
        </AccordionTrigger>
        <AccordionContent class="pt-2 pb-1">
          <PropsGrid :row-gap="0">
            <FormField
              label="直播状态"
              data-validation-field="visibility.liveState"
            >
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
            </FormField>

            <FormField
              label="设备"
              data-validation-field="visibility.device"
            >
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
            </FormField>
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
      <Alert size="sm" v-for="(issue, index) in validationIssues" :key="`${issue.fieldPath}:${index}`" variant="destructive" :data-validation-field="issue.fieldPath || undefined">
        <AlertDescription>
          <strong v-if="issue.fieldPath">{{ issue.fieldPath }}: </strong>
          {{ issue.message }}
        </AlertDescription>
      </Alert>
    </div>
  </div>
</template>
