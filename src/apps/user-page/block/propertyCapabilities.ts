import type { BlockType } from './schemaTypes'

type BlockProps = Record<string, unknown>
type CapabilityRule = (props: BlockProps) => boolean
type BlockCapabilityRules = Partial<Record<string, CapabilityRule>>

function hasText(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0
}

export const BLOCK_PROPERTY_CAPABILITY_RULES: Partial<Record<BlockType, BlockCapabilityRules>> = {
  layout: {
    wrap: (props) => (props.layout ?? 'row') === 'row',
    columns: (props) => props.layout === 'grid',
  },
  imageGallery: {
    columns: (props) => (props.layout ?? 'grid') !== 'carousel',
    gap: (props) => (props.layout ?? 'grid') !== 'carousel',
    maxHeight: (props) => (props.layout ?? 'grid') !== 'masonry',
    fit: (props) => (props.layout ?? 'grid') !== 'masonry',
    autoplay: (props) => props.layout === 'carousel',
    interval: (props) => props.layout === 'carousel' && props.autoplay === true,
    effect: (props) => props.layout === 'carousel',
    showArrow: (props) => props.layout === 'carousel',
    showDots: (props) => props.layout === 'carousel',
    dotType: (props) => props.layout === 'carousel' && props.showDots !== false,
    dotPlacement: (props) => props.layout === 'carousel' && props.showDots !== false,
    loop: (props) => props.layout === 'carousel',
    draggable: (props) => props.layout === 'carousel',
    touchable: (props) => props.layout === 'carousel',
    trigger: (props) => props.layout === 'carousel' && props.showDots !== false,
  },
  cardList: {
    columns: (props) => (props.layout ?? 'grid') === 'grid',
  },
  customHtml: {
    height: (props) => props.heightMode === 'fixed',
    maxHeight: (props) => props.heightMode !== 'fixed',
  },
  button: {
    align: (props) => props.fullWidth !== true,
  },
  buttons: {
    align: (props) => props.direction === 'horizontal' || props.fullWidth !== true,
    fullWidth: (props) => props.direction !== 'horizontal',
    borderTitle: (props) => props.framed === true,
    borderTitleAlign: (props) => props.framed === true && hasText(props.borderTitle),
  },
  videoList: {
    layout: (props) => props.source === 'userIndex',
    columns: (props) => props.source === 'userIndex' && (props.layout ?? 'grid') === 'grid',
    title: (props) => props.showTitle !== false,
    items: (props) => (props.source ?? 'manual') === 'manual',
  },
  musicPlayer: {
    height: (props) => props.compact !== true || props.provider === 'custom',
  },
  tags: {
    borderTitle: (props) => props.framed === true,
    borderTitleAlign: (props) => props.framed === true && hasText(props.borderTitle),
  },
  biliInfo: {
    showLiveRoom: (props) => props.showButtons !== false,
    spaceUrl: (props) => props.showButtons !== false,
  },
  feedback: {
    title: (props) => !(props.embed === true && props.embedMode === 'questionBox'),
    description: (props) => !(props.embed === true && props.embedMode === 'questionBox'),
    buttonText: (props) => !(props.embed === true && props.embedMode === 'questionBox'),
    url: (props) => !(props.embed === true && props.embedMode === 'questionBox'),
    embedMode: (props) => props.embed === true,
    height: (props) => props.embed === true && props.embedMode === 'iframe',
    defaultTag: (props) => props.embed === true && props.embedMode === 'questionBox',
    showPublicQuestions: (props) => props.embed === true && props.embedMode === 'questionBox',
  },
  divider: {
    framed: () => false,
    backgrounded: () => false,
    titlePlacement: (props) => hasText(props.text),
  },
  spacer: {
    backgrounded: (props) => props.framed === true,
  },
}

export function isBlockPropertyAvailable(type: BlockType, props: unknown, property: string) {
  const values = props && typeof props === 'object' && !Array.isArray(props) ? (props as BlockProps) : {}
  return BLOCK_PROPERTY_CAPABILITY_RULES[type]?.[property]?.(values) ?? true
}

export function getBlockPropertyNumberRange(type: BlockType, props: unknown, property: string) {
  const values = props && typeof props === 'object' && !Array.isArray(props) ? (props as BlockProps) : {}
  if (type === 'musicPlayer' && property === 'height') {
    return { min: 60, max: values.compact === true && values.provider === 'custom' ? 180 : 900 }
  }
  return null
}

export function getBlockPropertyValues(type: BlockType, props: unknown, property: string) {
  const values = props && typeof props === 'object' && !Array.isArray(props) ? (props as BlockProps) : {}
  if (type === 'layout' && property === 'justify' && values.layout === 'grid')
    return ['start', 'center', 'end'] as const
  return null
}
