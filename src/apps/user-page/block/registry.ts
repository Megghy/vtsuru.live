import type { Component } from 'vue'
import type { BlockNode, BlockType } from './schema'
import ProfileBlock from './blocks/ProfileBlock.vue'
import LayoutBlock from './blocks/LayoutBlock.vue'
import HeadingBlock from './blocks/HeadingBlock.vue'
import TextBlock from './blocks/TextBlock.vue'
import RichTextBlock from './blocks/RichTextBlock.vue'
import LinksBlock from './blocks/LinksBlock.vue'
import SingleButtonBlock from './blocks/SingleButtonBlock.vue'
import ButtonsBlock from './blocks/ButtonsBlock.vue'
import ImageBlock from './blocks/ImageBlock.vue'
import ImageGalleryBlock from './blocks/ImageGalleryBlock.vue'
import EmbedBlock from './blocks/EmbedBlock.vue'
import DividerBlock from './blocks/DividerBlock.vue'
import SpacerBlock from './blocks/SpacerBlock.vue'
import FooterBlock from './blocks/FooterBlock.vue'
import AlertBlock from './blocks/AlertBlock.vue'
import LiveStatusBlock from './blocks/LiveStatusBlock.vue'
import StreamScheduleBlock from './blocks/StreamScheduleBlock.vue'
import BiliInfoBlock from './blocks/BiliInfoBlock.vue'
import VideoListBlock from './blocks/VideoListBlock.vue'
import SocialLinksBlock from './blocks/SocialLinksBlock.vue'
import MusicPlayerBlock from './blocks/MusicPlayerBlock.vue'
import TagsBlock from './blocks/TagsBlock.vue'
import MilestoneBlock from './blocks/MilestoneBlock.vue'
import FAQBlock from './blocks/FAQBlock.vue'
import QuoteBlock from './blocks/QuoteBlock.vue'
import MarqueeBlock from './blocks/MarqueeBlock.vue'
import CountdownBlock from './blocks/CountdownBlock.vue'
import FeedbackBlock from './blocks/FeedbackBlock.vue'
import SupporterBlock from './blocks/SupporterBlock.vue'
import {
  AlertCircleOutline,
  AppsOutline,
  CalendarOutline,
  ChatboxOutline,
  ChatbubbleEllipsesOutline,
  DocumentTextOutline,
  GridOutline,
  HeartOutline,
  HelpCircleOutline,
  ImageOutline,
  ImagesOutline,
  LinkOutline,
  MegaphoneOutline,
  MusicalNotesOutline,
  PersonCircleOutline,
  PlayOutline,
  PricetagsOutline,
  RadioOutline,
  RemoveOutline,
  ResizeOutline,
  ShareSocialOutline,
  StatsChartOutline,
  TextOutline,
  TimerOutline,
  VideocamOutline,
  OpenOutline,
} from '@vicons/ionicons5'

export interface BlockLibraryItem { type: BlockType, label: string, icon?: Component }

export const BLOCK_LIBRARY: BlockLibraryItem[] = [
  { type: 'profile', label: '个人信息', icon: PersonCircleOutline },
  { type: 'layout', label: '布局容器', icon: GridOutline },
  { type: 'heading', label: '标题', icon: TextOutline },
  { type: 'text', label: '文本', icon: ChatboxOutline },
  { type: 'richText', label: '富文本', icon: DocumentTextOutline },
  { type: 'alert', label: '提示框', icon: AlertCircleOutline },
  { type: 'liveStatus', label: '直播状态', icon: RadioOutline },
  { type: 'streamSchedule', label: '直播日程', icon: CalendarOutline },
  { type: 'biliInfo', label: 'B站数据卡片', icon: StatsChartOutline },
  { type: 'button', label: '按钮', icon: OpenOutline },
  { type: 'buttons', label: '按钮组', icon: AppsOutline },
  { type: 'links', label: '链接列表', icon: LinkOutline },
  { type: 'socialLinks', label: '社交图标组', icon: ShareSocialOutline },
  { type: 'supporter', label: '支持/赞助', icon: HeartOutline },
  { type: 'feedback', label: '表单/留言', icon: HelpCircleOutline },
  { type: 'image', label: '图片', icon: ImageOutline },
  { type: 'imageGallery', label: '图片组', icon: ImagesOutline },
  { type: 'embed', label: '嵌入视频', icon: VideocamOutline },
  { type: 'videoList', label: '视频列表', icon: PlayOutline },
  { type: 'musicPlayer', label: '音乐播放器', icon: MusicalNotesOutline },
  { type: 'divider', label: '分割线', icon: RemoveOutline },
  { type: 'spacer', label: '间距', icon: ResizeOutline },
  { type: 'tags', label: '标签组', icon: PricetagsOutline },
  { type: 'milestone', label: '里程碑/时间轴', icon: TimerOutline },
  { type: 'faq', label: '折叠问答', icon: HelpCircleOutline },
  { type: 'quote', label: '金句引用', icon: ChatbubbleEllipsesOutline },
  { type: 'marquee', label: '走马灯/公告', icon: MegaphoneOutline },
  { type: 'countdown', label: '倒计时', icon: TimerOutline },
  { type: 'footer', label: '页脚', icon: DocumentTextOutline },
]

export const BLOCK_COMPONENTS: Record<BlockType, Component> = {
  profile: ProfileBlock,
  layout: LayoutBlock,
  heading: HeadingBlock,
  text: TextBlock,
  richText: RichTextBlock,
  links: LinksBlock,
  button: SingleButtonBlock,
  buttons: ButtonsBlock,
  image: ImageBlock,
  imageGallery: ImageGalleryBlock,
  embed: EmbedBlock,
  divider: DividerBlock,
  spacer: SpacerBlock,
  footer: FooterBlock,
  alert: AlertBlock,
  liveStatus: LiveStatusBlock,
  streamSchedule: StreamScheduleBlock,
  biliInfo: BiliInfoBlock,
  videoList: VideoListBlock,
  socialLinks: SocialLinksBlock,
  musicPlayer: MusicPlayerBlock,
  tags: TagsBlock,
  milestone: MilestoneBlock,
  faq: FAQBlock,
  quote: QuoteBlock,
  marquee: MarqueeBlock,
  countdown: CountdownBlock,
  feedback: FeedbackBlock,
  supporter: SupporterBlock,
}

export function getBlockLabel(type: BlockType): string {
  return BLOCK_LIBRARY.find(it => it.type === type)?.label ?? type
}

export function createBlockNode(type: BlockType, id: string): BlockNode {
  const block: BlockNode = { id, type, props: {} }
  if (type === 'layout') block.props = { layout: 'row', wrap: true, gap: 12, maxWidth: '', columns: 2, justify: 'start', align: 'stretch', children: [] }
  if (type === 'heading') block.props = { text: '标题', level: 2 }
  if (type === 'text') block.props = { text: '' }
  if (type === 'richText') block.props = { html: '', imagesFile: [], framed: false, backgrounded: false }
  if (type === 'links') block.props = { items: [] }
  if (type === 'button') block.props = { label: '按钮', page: 'home', type: 'primary', variant: 'solid', fullWidth: true, align: 'start', framed: false, backgrounded: false }
  if (type === 'buttons') block.props = { items: [], direction: 'vertical', type: 'primary', variant: 'solid', gap: 10, fullWidth: true, align: 'start', framed: false, backgrounded: false, borderTitle: '', borderTitleAlign: 'left' }
  if (type === 'alert') block.props = { type: 'info', title: '提示', text: '这里是一段提示内容', showIcon: true, bordered: false }
  if (type === 'image') block.props = { alt: '', maxWidth: '', maxHeight: '', shape: 'rounded' }
  if (type === 'imageGallery') block.props = { layout: 'grid', columns: 3, gap: 12, maxWidth: '', maxHeight: '', fit: 'cover', autoplay: false, interval: 5000, effect: 'slide', showArrow: true, showDots: true, dotType: 'line', dotPlacement: 'bottom', loop: true, draggable: true, touchable: true, trigger: 'click', items: [], framed: false, backgrounded: false }
  if (type === 'embed') block.props = { url: '', title: '' }
  if (type === 'divider') block.props = { text: '', titlePlacement: 'center', marginTop: 12, marginBottom: 12 }
  if (type === 'spacer') block.props = { size: 'md' }
  if (type === 'footer') block.props = { text: '', framed: false, backgrounded: false }
  if (type === 'liveStatus') block.props = { variant: 'card', showTitle: true, showArea: true, showCover: true, showButtons: true }
  if (type === 'streamSchedule') block.props = { layout: 'list', weeksCount: 1, showIcs: true, highlightToday: true, showTag: true }
  if (type === 'biliInfo') block.props = { variant: 'card', showAvatar: true, showName: true, showSign: true, showStats: true, showButtons: true, showLiveRoom: true, spaceUrl: '' }
  if (type === 'videoList') block.props = { source: 'manual', layout: 'grid', columns: 2, maxItems: 6, showTitle: true, items: [] }
  if (type === 'socialLinks') block.props = { size: 'md', variant: 'round', showLabel: false, items: [] }
  if (type === 'musicPlayer') block.props = { provider: 'netease', url: '', height: 300, compact: false }
  if (type === 'tags') block.props = { size: 'medium', rounded: true, items: [], framed: false, backgrounded: false, borderTitle: '', borderTitleAlign: 'left' }
  if (type === 'milestone') block.props = { mode: 'timeline', items: [] }
  if (type === 'faq') block.props = { accordion: false, items: [] }
  if (type === 'quote') block.props = { text: '', author: '', align: 'center' }
  if (type === 'marquee') block.props = { text: '', direction: 'left', durationSec: 18, pauseOnHover: true, framed: false, backgrounded: false }
  if (type === 'countdown') block.props = { title: '', target: '', style: 'cards', showSeconds: true, doneText: '已到达', framed: false, backgrounded: false }
  if (type === 'feedback') block.props = { title: '留言 / 提问', description: '', url: '', buttonText: '打开', embed: false, embedMode: 'questionBox', height: 520 }
  if (type === 'supporter') block.props = { title: '支持我', description: '', items: [] }
  return block
}
