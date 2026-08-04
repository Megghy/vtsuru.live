export const SCHEDULE_CATEGORIES = [
  { key: 'talk', aliases: ['杂谈', '聊天', 'talk'], name: 'TALK' },
  { key: 'music', aliases: ['歌回', '音乐', 'music'], name: 'MUSIC' },
  { key: 'radio', aliases: ['电台', 'radio'], name: 'RADIO' },
  { key: 'game', aliases: ['游戏', '联机', 'game'], name: 'GAME' },
  { key: 'project', aliases: ['企划', '企划直播', 'project'], name: 'PROJECT' },
] as const

export type ScheduleCategoryKey = (typeof SCHEDULE_CATEGORIES)[number]['key']

export function resolveScheduleCategory(tag?: string | null) {
  const normalized = tag?.trim().toLowerCase()
  return SCHEDULE_CATEGORIES.find((category) => (category.aliases as readonly string[]).includes(normalized ?? ''))
}
