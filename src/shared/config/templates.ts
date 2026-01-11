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
  '': {
    name: '默认',
    component: markRaw(defineAsyncComponent(
      async () => import('@/apps/user/pages/songListTemplate/DefaultSongListTemplate.vue'),
    )),
  },
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
}
