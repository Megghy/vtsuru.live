<script setup lang="ts">
import type { Component } from 'vue'
import { computed, defineAsyncComponent, ref, watch } from 'vue'

import { isBlockPropertyAvailable } from '@/apps/user-page/block/propertyCapabilities'
import type { BlockNode, BlockType, BlockVisibility } from '@/apps/user-page/block/schema'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/shared/ui/accordion'
import { Alert, AlertDescription } from '@/shared/ui/alert'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { FormField } from '@/shared/ui/form-field'
import { Input } from '@/shared/ui/input'
import { NumberField } from '@/shared/ui/number-field'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { SettingRow } from '@/shared/ui/setting-row'
import { Switch } from '@/shared/ui/switch'

import { useBlockPropsEditor } from './block-props-editors/useBlockPropsEditor'
import PropsGrid from './PropsGrid.vue'

const BiliContentPropsEditor = defineAsyncComponent(
  () => import('./block-props-editors/BiliContentPropsEditor.vue'),
)
const BasicContentPropsEditor = defineAsyncComponent(
  () => import('./block-props-editors/BasicContentPropsEditor.vue'),
)
const ButtonsPropsEditor = defineAsyncComponent(() => import('./block-props-editors/ButtonsPropsEditor.vue'))
const CardListPropsEditor = defineAsyncComponent(() => import('./block-props-editors/CardListPropsEditor.vue'))
const CheckInRankingPropsEditor = defineAsyncComponent(
  () => import('./block-props-editors/CheckInRankingPropsEditor.vue'),
)
const CollectionPropsEditor = defineAsyncComponent(() => import('./block-props-editors/CollectionPropsEditor.vue'))
const CommissionPropsEditor = defineAsyncComponent(() => import('./block-props-editors/CommissionPropsEditor.vue'))
const CustomHtmlPropsEditor = defineAsyncComponent(() => import('./block-props-editors/CustomHtmlPropsEditor.vue'))
const OcProfilePropsEditor = defineAsyncComponent(() => import('./block-props-editors/OcProfilePropsEditor.vue'))
const VoiceBoardPropsEditor = defineAsyncComponent(() => import('./block-props-editors/VoiceBoardPropsEditor.vue'))
const FeaturedGoodsPropsEditor = defineAsyncComponent(
  () => import('./block-props-editors/FeaturedGoodsPropsEditor.vue'),
)
const FeatureNavPropsEditor = defineAsyncComponent(() => import('./block-props-editors/FeatureNavPropsEditor.vue'))
const LayoutPropsEditor = defineAsyncComponent(() => import('./block-props-editors/LayoutPropsEditor.vue'))
const LiveInteractionPropsEditor = defineAsyncComponent(
  () => import('./block-props-editors/LiveInteractionPropsEditor.vue'),
)
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
  danmakuVote: LiveInteractionPropsEditor,
  queueStatus: LiveInteractionPropsEditor,
  ocProfile: OcProfilePropsEditor,
  commission: CommissionPropsEditor,
  voiceBoard: VoiceBoardPropsEditor,
  biliVideos: BiliContentPropsEditor,
  biliDynamics: BiliContentPropsEditor,
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

function findParentGridColumns(blocks: BlockNode[], targetId: string): number | null {
  for (const node of blocks) {
    if (node.type !== 'layout') continue
    const nodeProps = node.props as Record<string, any> | undefined
    const children = Array.isArray(nodeProps?.children) ? (nodeProps.children as BlockNode[]) : []
    if (children.some((child) => child.id === targetId)) {
      if (nodeProps?.layout === 'grid') {
        const cols = Number(nodeProps.columns)
        return Number.isInteger(cols) && cols >= 1 && cols <= 12 ? cols : 2
      }
      return null
    }
    const nested = findParentGridColumns(children, targetId)
    if (nested !== null) return nested
  }
  return null
}

const parentGridColumns = computed(() => {
  const blocks = editor.currentProject.value?.blocks
  if (!blocks) return null
  return findParentGridColumns(blocks, props.block.id)
})

const colSpanModel = computed({
  get: () => (typeof props.block.colSpan === 'number' && props.block.colSpan >= 1 ? props.block.colSpan : 1),
  set(val: number) {
    const clamped = Math.max(1, Math.min(parentGridColumns.value ?? 12, Math.round(val || 1)))
    if (clamped <= 1) delete props.block.colSpan
    else props.block.colSpan = clamped
  },
})

const rowSpanModel = computed({
  get: () => (typeof props.block.rowSpan === 'number' && props.block.rowSpan >= 1 ? props.block.rowSpan : 1),
  set(val: number) {
    const clamped = Math.max(1, Math.min(6, Math.round(val || 1)))
    if (clamped <= 1) delete props.block.rowSpan
    else props.block.rowSpan = clamped
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

function unixToLocalInput(ts: number | undefined): string {
  if (typeof ts !== 'number' || !Number.isFinite(ts) || ts <= 0) return ''
  const d = new Date(ts * 1000)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function localInputToUnix(raw: string): number | undefined {
  const s = raw.trim()
  if (!s) return undefined
  const ms = Date.parse(s)
  if (!Number.isFinite(ms) || ms < 0) return undefined
  return Math.floor(ms / 1000)
}

const startsAtInput = computed({
  get: () => unixToLocalInput(props.block.visibility?.startsAt),
  set: (val: string) => updateVisibility({ startsAt: localInputToUnix(val) }),
})

const endsAtInput = computed({
  get: () => unixToLocalInput(props.block.visibility?.endsAt),
  set: (val: string) => updateVisibility({ endsAt: localInputToUnix(val) }),
})

const visibilityTags = computed(() => {
  const tags: string[] = []
  if (liveStateModel.value === 'live') tags.push('仅直播中')
  else if (liveStateModel.value === 'offline') tags.push('仅未开播')
  if (deviceModel.value === 'desktop') tags.push('仅桌面端')
  else if (deviceModel.value === 'mobile') tags.push('仅移动端')
  if (props.block.visibility?.startsAt || props.block.visibility?.endsAt) tags.push('定时展示')
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
    <!-- Bento 网格跨度（仅当位于 grid 布局容器内时自动显示） -->
    <div
      v-if="parentGridColumns !== null"
      class="rounded-lg border border-border bg-muted/30 p-3 space-y-2"
    >
      <div class="flex-between">
        <span class="text-xs font-semibold text-foreground">Bento 网格占位</span>
        <span class="text-[11px] text-muted-foreground tabular-nums">父网格共 {{ parentGridColumns }} 列</span>
      </div>
      <div class="grid grid-cols-2 gap-2">
        <FormField
          label="跨列数 (colSpan)"
          class="min-w-0"
          data-validation-field="colSpan"
        >
          <NumberField
            v-model="colSpanModel"
            :min="1"
            :max="parentGridColumns"
            class="w-full"
          />
        </FormField>
        <FormField
          label="跨行数 (rowSpan)"
          class="min-w-0"
          data-validation-field="rowSpan"
        >
          <NumberField
            v-model="rowSpanModel"
            :min="1"
            :max="6"
            class="w-full"
          />
        </FormField>
      </div>
    </div>

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
      class="w-auto box-border border border-border rounded-lg bg-card mt-2 px-2.5 py-1"
    >
      <AccordionItem
        value="defaults"
        class="border-b-0"
      >
        <AccordionTrigger class="text-xs font-semibold py-2">卡片外观与命名</AccordionTrigger>
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
              class="pt-3"
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
              class="pt-3"
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
            <div class="flex items-center gap-1 flex-wrap justify-end">
              <Badge
                v-for="tag in visibilityTags"
                :key="tag"
                variant="outline"
                size="xs"
              >
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
                <SelectTrigger class="w-full">
                  <SelectValue placeholder="直播状态" />
                </SelectTrigger>
                <SelectContent>
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
                <SelectTrigger class="w-full">
                  <SelectValue placeholder="设备" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="always">所有设备</SelectItem>
                  <SelectItem value="desktop">仅桌面端</SelectItem>
                  <SelectItem value="mobile">仅移动端</SelectItem>
                </SelectContent>
              </Select>
            </FormField>

            <FormField
              label="定时上架（开始时间）"
              class="span-full pt-2"
              data-validation-field="visibility.startsAt"
            >
              <div class="flex items-center gap-1.5">
                <Input
                  v-model="startsAtInput"
                  type="datetime-local"
                  class="flex-1 min-w-0"
                />
                <Button
                  v-if="startsAtInput"
                  variant="ghost"
                  size="xs"
                  @click="startsAtInput = ''"
                >
                  清除
                </Button>
              </div>
            </FormField>

            <FormField
              label="定时下架（结束时间）"
              class="span-full pt-2"
              data-validation-field="visibility.endsAt"
            >
              <div class="flex items-center gap-1.5">
                <Input
                  v-model="endsAtInput"
                  type="datetime-local"
                  class="flex-1 min-w-0"
                />
                <Button
                  v-if="endsAtInput"
                  variant="ghost"
                  size="xs"
                  @click="endsAtInput = ''"
                >
                  清除
                </Button>
              </div>
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
      <Alert
        v-for="(issue, index) in validationIssues"
        :key="`${issue.fieldPath}:${index}`"
        variant="destructive"
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
