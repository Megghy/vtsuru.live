import type { Component } from 'vue'
import type { BlockNode, BlockType } from './schema'
import ProfileBlock from './blocks/ProfileBlock.vue'
import LayoutBlock from './blocks/LayoutBlock.vue'
import HeadingBlock from './blocks/HeadingBlock.vue'
import TextBlock from './blocks/TextBlock.vue'
import RichTextBlock from './blocks/RichTextBlock.vue'
import LinksBlock from './blocks/LinksBlock.vue'
import ButtonsBlock from './blocks/ButtonsBlock.vue'
import ImageBlock from './blocks/ImageBlock.vue'
import ImageGalleryBlock from './blocks/ImageGalleryBlock.vue'
import EmbedBlock from './blocks/EmbedBlock.vue'
import DividerBlock from './blocks/DividerBlock.vue'
import SpacerBlock from './blocks/SpacerBlock.vue'
import FooterBlock from './blocks/FooterBlock.vue'
import AlertBlock from './blocks/AlertBlock.vue'
import {
  AlertCircleOutline,
  AppsOutline,
  ChatboxOutline,
  DocumentTextOutline,
  GridOutline,
  ImageOutline,
  ImagesOutline,
  LinkOutline,
  PersonCircleOutline,
  RemoveOutline,
  ResizeOutline,
  TextOutline,
  VideocamOutline,
} from '@vicons/ionicons5'

export type BlockLibraryItem = { type: BlockType, label: string, icon?: Component }

export const BLOCK_LIBRARY: BlockLibraryItem[] = [
  { type: 'profile', label: '个人信息', icon: PersonCircleOutline },
  { type: 'layout', label: '布局容器', icon: GridOutline },
  { type: 'heading', label: '标题', icon: TextOutline },
  { type: 'text', label: '文本', icon: ChatboxOutline },
  { type: 'richText', label: '富文本', icon: DocumentTextOutline },
  { type: 'alert', label: '提示框', icon: AlertCircleOutline },
  { type: 'buttons', label: '按钮组', icon: AppsOutline },
  { type: 'links', label: '链接列表', icon: LinkOutline },
  { type: 'image', label: '图片', icon: ImageOutline },
  { type: 'imageGallery', label: '图片组', icon: ImagesOutline },
  { type: 'embed', label: '嵌入视频', icon: VideocamOutline },
  { type: 'divider', label: '分割线', icon: RemoveOutline },
  { type: 'spacer', label: '间距', icon: ResizeOutline },
  { type: 'footer', label: '页脚', icon: DocumentTextOutline },
]

export const BLOCK_COMPONENTS: Record<BlockType, Component> = {
  profile: ProfileBlock,
  layout: LayoutBlock,
  heading: HeadingBlock,
  text: TextBlock,
  richText: RichTextBlock,
  links: LinksBlock,
  buttons: ButtonsBlock,
  image: ImageBlock,
  imageGallery: ImageGalleryBlock,
  embed: EmbedBlock,
  divider: DividerBlock,
  spacer: SpacerBlock,
  footer: FooterBlock,
  alert: AlertBlock,
}

export function getBlockLabel(type: BlockType): string {
  return BLOCK_LIBRARY.find(it => it.type === type)?.label ?? type
}

export function createBlockNode(type: BlockType, id: string): BlockNode {
  const block: BlockNode = { id, type, props: {} }
  if (type === 'layout') block.props = { layout: 'row', wrap: true, gap: 12, maxWidth: '', columns: 2, justify: 'start', align: 'stretch', children: [] }
  if (type === 'heading') block.props = { text: '标题', level: 2 }
  if (type === 'text') block.props = { text: '' }
  if (type === 'richText') block.props = { html: '', imagesFile: [] }
  if (type === 'links') block.props = { items: [] }
  if (type === 'buttons') block.props = { items: [], direction: 'vertical', type: 'primary', variant: 'solid', gap: 10, fullWidth: true, align: 'start' }
  if (type === 'alert') block.props = { type: 'info', title: '提示', text: '这里是一段提示内容', showIcon: true, bordered: false }
  if (type === 'image') block.props = { url: '', alt: '', maxWidth: '', maxHeight: '' }
  if (type === 'imageGallery') block.props = { layout: 'grid', columns: 3, gap: 12, maxWidth: '', maxHeight: '', fit: 'cover', autoplay: false, interval: 5000, effect: 'slide', showArrow: true, showDots: true, dotType: 'line', dotPlacement: 'bottom', loop: true, draggable: true, touchable: true, trigger: 'click', items: [] }
  if (type === 'embed') block.props = { url: '', title: '' }
  if (type === 'divider') block.props = { text: '', titlePlacement: 'center', marginTop: 12, marginBottom: 12 }
  if (type === 'spacer') block.props = { size: 'md' }
  if (type === 'footer') block.props = { text: '' }
  return block
}
