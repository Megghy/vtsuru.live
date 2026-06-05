import { defineAsyncComponent, markRaw } from 'vue'

export interface TemplateMapType {
  [key: string]: {
    name: string
    settingName?: string
    component: any
  }
}

export const ScheduleTemplateMap: TemplateMapType = {
  '': {
    name: '默认',
    component: markRaw(defineAsyncComponent(
      async () => import('@/apps/user/pages/scheduleTemplate/DefaultScheduleTemplate.vue'),
    )),
  },
  'pinky': {
    name: '粉粉',
    component: markRaw(defineAsyncComponent(
      async () => import('@/apps/user/pages/scheduleTemplate/PinkySchedule.vue'),
    )),
  },
  'kawaii': {
    name: '可爱手帐 (未完成',
    settingName: 'Template.Schedule.Kawaii',
    component: markRaw(defineAsyncComponent(
      async () => import('@/apps/user/pages/scheduleTemplate/KawaiiSchedule.vue'),
    )),
  },
}

export const SongListTemplateMap: TemplateMapType = {
  'card': {
    name: '卡片列表',
    component: markRaw(defineAsyncComponent(
      async () => import('@/apps/user/pages/songListTemplate/CardSongListTemplate.vue'),
    )),
  },
  'traditional': {
    name: '列表 (较推荐',
    settingName: 'Template.SongList.Traditional',
    component: markRaw(defineAsyncComponent(
      async () =>
        import('@/apps/user/pages/songListTemplate/TraditionalSongListTemplate.vue'),
    )),
  },
  'simple': {
    name: '简单',
    component: markRaw(defineAsyncComponent(
      async () => import('@/apps/user/pages/songListTemplate/SimpleSongListTemplate.vue'),
    )),
  },
  'gallery': {
    name: '封面画廊',
    component: markRaw(defineAsyncComponent(
      async () => import('@/apps/user/pages/songListTemplate/GallerySongListTemplate.vue'),
    )),
  },
  'compact': {
    name: '紧凑列表 (大曲库',
    component: markRaw(defineAsyncComponent(
      async () => import('@/apps/user/pages/songListTemplate/CompactSongListTemplate.vue'),
    )),
  },
  'immersive': {
    name: '沉浸播放器',
    component: markRaw(defineAsyncComponent(
      async () => import('@/apps/user/pages/songListTemplate/ImmersiveSongListTemplate.vue'),
    )),
  },
}
