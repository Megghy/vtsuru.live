import {
  AlertCircle,
  AlignLeft,
  BarChart3,
  Briefcase,
  Calendar,
  CircleHelp,
  Clock,
  Code2,
  Compass,
  ExternalLink,
  FileText,
  Film,
  Grid2x2,
  Heading,
  Heart,
  Image as ImageIcon,
  Images,
  LayoutGrid,
  Link2,
  List,
  ListOrdered,
  Megaphone,
  Minus,
  MousePointerClick,
  MoveVertical,
  Music,
  Palette,
  Play,
  QrCode,
  Quote,
  Radio,
  Share2,
  Store,
  Tag,
  Timer,
  UserCircle,
  Video,
  Volume2,
  Vote,
} from 'lucide-vue-next'
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
  profile: UserCircle,
  layout: LayoutGrid,
  heading: Heading,
  text: AlignLeft,
  richText: FileText,
  customHtml: Code2,
  alert: AlertCircle,
  links: Link2,
  button: MousePointerClick,
  buttons: Grid2x2,
  image: ImageIcon,
  imageGallery: Images,
  qrcode: QrCode,
  featureNav: Compass,
  songList: Music,
  cardList: LayoutGrid,
  checkInRanking: BarChart3,
  featuredGoods: Store,
  videoCollect: Film,
  sectionNav: List,
  nowPlaying: Music,
  embed: Video,
  divider: Minus,
  spacer: MoveVertical,
  footer: FileText,
  liveStatus: Radio,
  streamSchedule: Calendar,
  biliInfo: BarChart3,
  videoList: Play,
  socialLinks: Share2,
  musicPlayer: Music,
  tags: Tag,
  milestone: Clock,
  faq: CircleHelp,
  quote: Quote,
  marquee: Megaphone,
  countdown: Timer,
  feedback: ExternalLink,
  supporter: Heart,
  danmakuVote: Vote,
  queueStatus: ListOrdered,
  ocProfile: Palette,
  commission: Briefcase,
  voiceBoard: Volume2,
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
