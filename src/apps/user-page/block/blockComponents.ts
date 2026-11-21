import type { AsyncComponentLoader, Component } from 'vue'
import { defineAsyncComponent, h } from 'vue'

import type { BlockType } from './schemaTypes'

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
  danmakuVote: async () => import('./blocks/DanmakuVoteBlock.vue'),
  queueStatus: async () => import('./blocks/QueueStatusBlock.vue'),
  ocProfile: async () => import('./blocks/OcProfileBlock.vue'),
  commission: async () => import('./blocks/CommissionBlock.vue'),
  voiceBoard: async () => import('./blocks/VoiceBoardBlock.vue'),
}

const AsyncBlockLoading = () =>
  h(
    'div',
    {
      class: 'block-load-state',
      style: 'min-height:48px;display:grid;place-items:center;color:var(--muted-foreground)',
    },
    '正在加载区块',
  )

const AsyncBlockError = () =>
  h(
    'div',
    {
      class: 'block-load-state block-load-state--error',
      role: 'alert',
      style: 'min-height:48px;display:grid;place-items:center;color:var(--vtsuru-error)',
    },
    '区块加载失败',
  )

function createViewer(loader: AsyncComponentLoader): Component {
  return defineAsyncComponent({
    loader,
    loadingComponent: AsyncBlockLoading,
    errorComponent: AsyncBlockError,
    delay: 120,
    timeout: 15000,
  })
}

export const BLOCK_COMPONENTS = Object.fromEntries(
  Object.entries(VIEWERS).map(([type, loader]) => [type, createViewer(loader)]),
) as Record<BlockType, Component>
