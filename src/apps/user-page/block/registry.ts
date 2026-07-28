import type { AsyncComponentLoader, Component } from 'vue'
import { defineAsyncComponent, h } from 'vue'
import {
  AlertCircleOutline,
  AppsOutline,
  CalendarOutline,
  ChatboxOutline,
  ChatbubbleEllipsesOutline,
  CodeSlashOutline,
  DocumentTextOutline,
  GridOutline,
  HeartOutline,
  HelpCircleOutline,
  ImageOutline,
  ImagesOutline,
  LinkOutline,
  MegaphoneOutline,
  MusicalNotesOutline,
  OpenOutline,
  PersonCircleOutline,
  PlayOutline,
  PricetagsOutline,
  QrCodeOutline,
  RadioOutline,
  ReorderThreeOutline,
  RemoveOutline,
  ResizeOutline,
  ShareSocialOutline,
  StatsChartOutline,
  StorefrontOutline,
  TextOutline,
  TimerOutline,
  VideocamOutline,
} from '@vicons/ionicons5'
import { SHARED_BLOCK_DEFINITIONS } from './definitions'
import type { SharedBlockDefinition } from './definitions'
import { BLOCK_TYPES } from './schemaTypes'
import type { BlockNode, BlockType } from './schemaTypes'

export interface BlockLibraryItem {
  type: BlockType
  label: string
  icon: Component
  category: SharedBlockDefinition['category']
  keywords: readonly string[]
}

export interface BlockDefinition extends SharedBlockDefinition {
  icon: Component
  editor: { kind: 'shared-properties-form' }
  viewer: Component
}

const ICONS: Record<BlockType, Component> = {
  profile: PersonCircleOutline,
  layout: GridOutline,
  heading: TextOutline,
  text: ChatboxOutline,
  richText: DocumentTextOutline,
  customHtml: CodeSlashOutline,
  alert: AlertCircleOutline,
  links: LinkOutline,
  button: OpenOutline,
  buttons: AppsOutline,
  image: ImageOutline,
  imageGallery: ImagesOutline,
  qrcode: QrCodeOutline,
  featureNav: GridOutline,
  songList: MusicalNotesOutline,
  cardList: GridOutline,
  checkInRanking: StatsChartOutline,
  featuredGoods: StorefrontOutline,
  videoCollect: VideocamOutline,
  sectionNav: ReorderThreeOutline,
  nowPlaying: MusicalNotesOutline,
  embed: VideocamOutline,
  divider: RemoveOutline,
  spacer: ResizeOutline,
  footer: DocumentTextOutline,
  liveStatus: RadioOutline,
  streamSchedule: CalendarOutline,
  biliInfo: StatsChartOutline,
  videoList: PlayOutline,
  socialLinks: ShareSocialOutline,
  musicPlayer: MusicalNotesOutline,
  tags: PricetagsOutline,
  milestone: TimerOutline,
  faq: HelpCircleOutline,
  quote: ChatbubbleEllipsesOutline,
  marquee: MegaphoneOutline,
  countdown: TimerOutline,
  feedback: HelpCircleOutline,
  supporter: HeartOutline,
}

const VIEWERS: Record<BlockType, AsyncComponentLoader> = {
  profile: async () => import('./blocks/ProfileBlock.vue'),
  layout: async () => import('./blocks/LayoutBlock.vue'),
  heading: async () => import('./blocks/HeadingBlock.vue'),
  text: async () => import('./blocks/TextBlock.vue'),
  richText: async () => import('./blocks/RichTextBlock.vue'),
  customHtml: async () => import('./blocks/CustomHtmlBlock.vue'),
  alert: async () => import('./blocks/AlertBlock.vue'),
  links: async () => import('./blocks/LinksBlock.vue'),
  button: async () => import('./blocks/SingleButtonBlock.vue'),
  buttons: async () => import('./blocks/ButtonsBlock.vue'),
  image: async () => import('./blocks/ImageBlock.vue'),
  imageGallery: async () => import('./blocks/ImageGalleryBlock.vue'),
  qrcode: async () => import('./blocks/QrCodeBlock.vue'),
  featureNav: async () => import('./blocks/FeatureNavBlock.vue'),
  songList: async () => import('./blocks/SongListBlock.vue'),
  cardList: async () => import('./blocks/CardListBlock.vue'),
  checkInRanking: async () => import('./blocks/CheckInRankingBlock.vue'),
  featuredGoods: async () => import('./blocks/FeaturedGoodsBlock.vue'),
  videoCollect: async () => import('./blocks/VideoCollectBlock.vue'),
  sectionNav: async () => import('./blocks/SectionNavBlock.vue'),
  nowPlaying: async () => import('./blocks/NowPlayingBlock.vue'),
  embed: async () => import('./blocks/EmbedBlock.vue'),
  divider: async () => import('./blocks/DividerBlock.vue'),
  spacer: async () => import('./blocks/SpacerBlock.vue'),
  footer: async () => import('./blocks/FooterBlock.vue'),
  liveStatus: async () => import('./blocks/LiveStatusBlock.vue'),
  streamSchedule: async () => import('./blocks/StreamScheduleBlock.vue'),
  biliInfo: async () => import('./blocks/BiliInfoBlock.vue'),
  videoList: async () => import('./blocks/VideoListBlock.vue'),
  socialLinks: async () => import('./blocks/SocialLinksBlock.vue'),
  musicPlayer: async () => import('./blocks/MusicPlayerBlock.vue'),
  tags: async () => import('./blocks/TagsBlock.vue'),
  milestone: async () => import('./blocks/MilestoneBlock.vue'),
  faq: async () => import('./blocks/FAQBlock.vue'),
  quote: async () => import('./blocks/QuoteBlock.vue'),
  marquee: async () => import('./blocks/MarqueeBlock.vue'),
  countdown: async () => import('./blocks/CountdownBlock.vue'),
  feedback: async () => import('./blocks/FeedbackBlock.vue'),
  supporter: async () => import('./blocks/SupporterBlock.vue'),
}

const AsyncBlockLoading = () => h('div', {
  class: 'block-load-state',
  style: 'min-height:48px;display:grid;place-items:center;color:var(--vtsuru-fg-muted)',
}, '正在加载区块')

const AsyncBlockError = () => h('div', {
  class: 'block-load-state block-load-state--error',
  role: 'alert',
  style: 'min-height:48px;display:grid;place-items:center;color:var(--n-error-color)',
}, '区块加载失败')

function createViewer(loader: AsyncComponentLoader): Component {
  return defineAsyncComponent({
    loader,
    loadingComponent: AsyncBlockLoading,
    errorComponent: AsyncBlockError,
    delay: 120,
    timeout: 15000,
  })
}

export const BLOCK_DEFINITIONS = SHARED_BLOCK_DEFINITIONS.map((definition): BlockDefinition => ({
  ...definition,
  icon: ICONS[definition.type],
  editor: { kind: 'shared-properties-form' },
  viewer: createViewer(VIEWERS[definition.type]),
}))

export const BLOCK_DEFINITION_MAP = Object.fromEntries(
  BLOCK_DEFINITIONS.map(definition => [definition.type, definition]),
) as Record<BlockType, BlockDefinition>

export const BLOCK_LIBRARY: BlockLibraryItem[] = BLOCK_DEFINITIONS.map(({ type, label, icon, category, keywords }) => ({
  type,
  label,
  icon,
  category,
  keywords,
}))

export const BLOCK_COMPONENTS = Object.fromEntries(
  BLOCK_DEFINITIONS.map(definition => [definition.type, definition.viewer]),
) as Record<BlockType, Component>

export function getBlockLabel(type: string): string {
  return BLOCK_DEFINITION_MAP[type as BlockType]?.label ?? `不支持的区块 (${type})`
}

export function createBlockNode(type: BlockType, id: string): BlockNode {
  return {
    id,
    type,
    props: structuredClone(BLOCK_DEFINITION_MAP[type].defaultProps),
  }
}

if (BLOCK_DEFINITIONS.length !== BLOCK_TYPES.length || BLOCK_TYPES.some(type => !BLOCK_DEFINITION_MAP[type])) {
  throw new Error('区块 registry 定义不完整')
}
