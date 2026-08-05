import { defineAsyncComponent, markRaw } from 'vue'

import type { TemplateCapability } from './templateCapabilities'

export interface TemplateMapType {
  [key: string]: {
    name: string
    settingName?: string
    component: any
    /** 该模板拥有的能力标签, 用于在模板管理页展示与对比 */
    capabilities?: readonly TemplateCapability[]
  }
}

const scheduleCoreCapabilities = [
  'scheduleDate',
  'todayHighlight',
  'scheduleStats',
  'weekSwitch',
  'imageExport',
] as const satisfies readonly TemplateCapability[]
const scheduleConfigCapabilities = [
  'templateConfig',
  'customHeading',
  'customColors',
] as const satisfies readonly TemplateCapability[]
const scheduleArtworkCapabilities = [
  'characterArtwork',
  'avatarFallback',
] as const satisfies readonly TemplateCapability[]

export const ScheduleTemplateMap: TemplateMapType = {
  '': {
    name: '默认',
    component: markRaw(
      defineAsyncComponent(async () => import('@/apps/user/pages/scheduleTemplate/DefaultScheduleTemplate.vue')),
    ),
    capabilities: ['scheduleDate', 'todayHighlight'],
  },
  pinky: {
    name: '粉粉',
    settingName: 'Template.Schedule.Pinky',
    component: markRaw(
      defineAsyncComponent(async () => import('@/apps/user/pages/scheduleTemplate/PinkySchedule.vue')),
    ),
    capabilities: [
      ...scheduleCoreCapabilities,
      ...scheduleArtworkCapabilities,
      ...scheduleConfigCapabilities,
      'backgroundImage',
    ],
  },
  magazine: {
    name: '直播周刊',
    settingName: 'Template.Schedule.Magazine',
    component: markRaw(
      defineAsyncComponent(async () => import('@/apps/user/pages/scheduleTemplate/MagazineSchedule.vue')),
    ),
    capabilities: [
      ...scheduleCoreCapabilities,
      'categorySummary',
      ...scheduleArtworkCapabilities,
      ...scheduleConfigCapabilities,
      'backgroundImage',
    ],
  },
  kawaii: {
    name: '梦色直播手帐',
    settingName: 'Template.Schedule.Kawaii',
    component: markRaw(
      defineAsyncComponent(async () => import('@/apps/user/pages/scheduleTemplate/KawaiiSchedule.vue')),
    ),
    capabilities: [
      ...scheduleCoreCapabilities,
      'categorySummary',
      ...scheduleArtworkCapabilities,
      ...scheduleConfigCapabilities,
      'backgroundImage',
      'decorativeImages',
      'artworkPosition',
    ],
  },
  neon: {
    name: '信号播控台',
    settingName: 'Template.Schedule.NeonStage',
    component: markRaw(
      defineAsyncComponent(async () => import('@/apps/user/pages/scheduleTemplate/NeonStageSchedule.vue')),
    ),
    capabilities: [
      ...scheduleCoreCapabilities,
      'categorySummary',
      ...scheduleArtworkCapabilities,
      ...scheduleConfigCapabilities,
      'backgroundImage',
    ],
  },
  liveposter: {
    name: '直播海报',
    settingName: 'Template.Schedule.LivePoster',
    component: markRaw(
      defineAsyncComponent(async () => import('@/apps/user/pages/scheduleTemplate/LivePosterSchedule.vue')),
    ),
    capabilities: [
      ...scheduleCoreCapabilities,
      'categorySummary',
      ...scheduleArtworkCapabilities,
      ...scheduleConfigCapabilities,
      'backgroundImage',
      'artworkEffect',
    ],
  },
  prismstage: {
    name: '七曜物候历',
    settingName: 'Template.Schedule.PrismStage',
    component: markRaw(
      defineAsyncComponent(async () => import('@/apps/user/pages/scheduleTemplate/PrismStageSchedule.vue')),
    ),
    capabilities: [...scheduleCoreCapabilities, ...scheduleConfigCapabilities, 'backgroundImage'],
  },
  kinari: {
    name: '白和纸手帖',
    settingName: 'Template.Schedule.Kinari',
    component: markRaw(
      defineAsyncComponent(async () => import('@/apps/user/pages/scheduleTemplate/KinariSchedule.vue')),
    ),
    capabilities: [...scheduleCoreCapabilities, ...scheduleConfigCapabilities, 'backgroundImage'],
  },
  retrodesktop: {
    name: 'Schedule.exe',
    settingName: 'Template.Schedule.RetroDesktop',
    component: markRaw(
      defineAsyncComponent(async () => import('@/apps/user/pages/scheduleTemplate/RetroDesktopSchedule.vue')),
    ),
    capabilities: [...scheduleCoreCapabilities, 'templateConfig', 'customHeading', 'appearancePreset'],
  },
}

export const IndexTemplateMap: TemplateMapType = {
  default: {
    name: '直播档案',
    component: markRaw(
      defineAsyncComponent(async () => import('@/apps/user/pages/indexTemplate/DefaultIndexTemplate.vue')),
    ),
    capabilities: ['backgroundImage', 'characterArtwork', 'showName', 'showCover', 'songCount'],
  },
}

export const SongListTemplateMap: TemplateMapType = {
  card: {
    name: '卡片列表',
    component: markRaw(
      defineAsyncComponent(async () => import('@/apps/user/pages/songListTemplate/CardSongListTemplate.vue')),
    ),
    capabilities: [
      'showName',
      'showTranslateName',
      'showAuthor',
      'showLanguage',
      'showTags',
      'showDescription',
      'songCount',
      'search',
      'selfViewGuard',
      'requestSong',
      'liveRequestStatus',
      'scPrice',
      'guardRequirement',
      'fanMedalRequirement',
    ],
  },
  traditional: {
    name: '列表 (较推荐',
    settingName: 'Template.SongList.Traditional',
    component: markRaw(
      defineAsyncComponent(async () => import('@/apps/user/pages/songListTemplate/TraditionalSongListTemplate.vue')),
    ),
    capabilities: [
      'showName',
      'showAuthor',
      'showLanguage',
      'showTags',
      'showDescription',
      'search',
      'filterByTag',
      'filterByAuthor',
      'filterByLanguage',
      'filterByOption',
      'sort',
      'randomPick',
      'requestSong',
      'liveRequestStatus',
      'platformLink',
      'scPrice',
      'guardRequirement',
      'fanMedalRequirement',
      'templateConfig',
    ],
  },
  simple: {
    name: '简单',
    component: markRaw(
      defineAsyncComponent(async () => import('@/apps/user/pages/songListTemplate/SimpleSongListTemplate.vue')),
    ),
    capabilities: [
      'showName',
      'showTranslateName',
      'showAuthor',
      'showTags',
      'showDescription',
      'search',
      'filterByTag',
      'filterByAuthor',
      'audioPreview',
      'requestSong',
      'liveRequestStatus',
      'embedRequestQueue',
      'scPrice',
      'guardRequirement',
      'fanMedalRequirement',
      'lazyLoad',
    ],
  },
  gallery: {
    name: '封面画廊',
    component: markRaw(
      defineAsyncComponent(async () => import('@/apps/user/pages/songListTemplate/GallerySongListTemplate.vue')),
    ),
    capabilities: [
      'showName',
      'showTranslateName',
      'showAuthor',
      'showCover',
      'songCount',
      'search',
      'filterByTag',
      'audioPreview',
      'requestSong',
      'liveRequestStatus',
      'scPrice',
      'guardRequirement',
      'fanMedalRequirement',
    ],
  },
  compact: {
    name: '紧凑列表 (大曲库',
    component: markRaw(
      defineAsyncComponent(async () => import('@/apps/user/pages/songListTemplate/CompactSongListTemplate.vue')),
    ),
    capabilities: [
      'showName',
      'showTranslateName',
      'showAuthor',
      'showTags',
      'showCover',
      'songCount',
      'search',
      'filterByTag',
      'filterByAuthor',
      'audioPreview',
      'selfViewGuard',
      'requestSong',
      'liveRequestStatus',
      'scPrice',
      'virtualScroll',
    ],
  },
  immersive: {
    name: '沉浸播放器',
    component: markRaw(
      defineAsyncComponent(async () => import('@/apps/user/pages/songListTemplate/ImmersiveSongListTemplate.vue')),
    ),
    capabilities: [
      'showName',
      'showTranslateName',
      'showAuthor',
      'showLanguage',
      'showTags',
      'showCover',
      'search',
      'audioPreview',
      'selfViewGuard',
      'requestSong',
      'liveRequestStatus',
      'scPrice',
      'guardRequirement',
      'fanMedalRequirement',
      'virtualScroll',
    ],
  },
}
