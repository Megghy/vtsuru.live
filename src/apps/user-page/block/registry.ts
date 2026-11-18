import AlertCircleOutline from '@vicons/ionicons5/es/AlertCircleOutline'
import AppsOutline from '@vicons/ionicons5/es/AppsOutline'
import CalendarOutline from '@vicons/ionicons5/es/CalendarOutline'
import ChatboxOutline from '@vicons/ionicons5/es/ChatboxOutline'
import ChatbubbleEllipsesOutline from '@vicons/ionicons5/es/ChatbubbleEllipsesOutline'
import CodeSlashOutline from '@vicons/ionicons5/es/CodeSlashOutline'
import DocumentTextOutline from '@vicons/ionicons5/es/DocumentTextOutline'
import GridOutline from '@vicons/ionicons5/es/GridOutline'
import HeartOutline from '@vicons/ionicons5/es/HeartOutline'
import HelpCircleOutline from '@vicons/ionicons5/es/HelpCircleOutline'
import ImageOutline from '@vicons/ionicons5/es/ImageOutline'
import ImagesOutline from '@vicons/ionicons5/es/ImagesOutline'
import LinkOutline from '@vicons/ionicons5/es/LinkOutline'
import MegaphoneOutline from '@vicons/ionicons5/es/MegaphoneOutline'
import MusicalNotesOutline from '@vicons/ionicons5/es/MusicalNotesOutline'
import OpenOutline from '@vicons/ionicons5/es/OpenOutline'
import PersonCircleOutline from '@vicons/ionicons5/es/PersonCircleOutline'
import PlayOutline from '@vicons/ionicons5/es/PlayOutline'
import PricetagsOutline from '@vicons/ionicons5/es/PricetagsOutline'
import QrCodeOutline from '@vicons/ionicons5/es/QrCodeOutline'
import RadioOutline from '@vicons/ionicons5/es/RadioOutline'
import RemoveOutline from '@vicons/ionicons5/es/RemoveOutline'
import ReorderThreeOutline from '@vicons/ionicons5/es/ReorderThreeOutline'
import ResizeOutline from '@vicons/ionicons5/es/ResizeOutline'
import ShareSocialOutline from '@vicons/ionicons5/es/ShareSocialOutline'
import StatsChartOutline from '@vicons/ionicons5/es/StatsChartOutline'
import StorefrontOutline from '@vicons/ionicons5/es/StorefrontOutline'
import TextOutline from '@vicons/ionicons5/es/TextOutline'
import TimerOutline from '@vicons/ionicons5/es/TimerOutline'
import VideocamOutline from '@vicons/ionicons5/es/VideocamOutline'
import type { Component } from 'vue'

import { BLOCK_COMPONENTS } from './blockComponents'
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

export const BLOCK_DEFINITIONS = SHARED_BLOCK_DEFINITIONS.map((definition): BlockDefinition => ({
  ...definition,
  icon: ICONS[definition.type],
  editor: { kind: 'shared-properties-form' },
  viewer: BLOCK_COMPONENTS[definition.type],
}))

export const BLOCK_DEFINITION_MAP = Object.fromEntries(
  BLOCK_DEFINITIONS.map((definition) => [definition.type, definition]),
) as Record<BlockType, BlockDefinition>

export const BLOCK_LIBRARY: BlockLibraryItem[] = BLOCK_DEFINITIONS.map(({ type, label, icon, category, keywords }) => ({
  type,
  label,
  icon,
  category,
  keywords,
}))

export { BLOCK_COMPONENTS }

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

if (BLOCK_DEFINITIONS.length !== BLOCK_TYPES.length || BLOCK_TYPES.some((type) => !BLOCK_DEFINITION_MAP[type])) {
  throw new Error('区块 registry 定义不完整')
}
