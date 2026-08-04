import { getISOWeek, getISOWeekYear } from 'date-fns'

import type { ScheduleWeekInfo, SongRequestOption, SongsInfo } from '@/api/api-models'
import { SongFrom } from '@/api/api-models'

// 模板预览用的假数据 (仅用于设置页实时预览, 不参与实际展示)

export const schedulePreviewData: ScheduleWeekInfo[] = [
  {
    year: getISOWeekYear(new Date()),
    week: getISOWeek(new Date()),
    days: [
      [{ title: '早安杂谈与新衣预告', tag: '杂谈', tagColor: '#E97A9B', time: '09:30', id: 'preview-1' }],
      [{ title: '夏日歌回：听海的颜色', tag: '歌回', tagColor: '#3FB8B0', time: '20:00', id: 'preview-2' }],
      [
        { title: '午后电台', tag: '电台', tagColor: '#E4AA37', time: '14:00', id: 'preview-3' },
        { title: '观众参加型小游戏', tag: '联机', tagColor: '#6C8BE7', time: '21:00', id: 'preview-4' },
      ],
      [{ title: null, tag: null, tagColor: null, time: null, id: null }],
      [{ title: '主线剧情推进', tag: '游戏', tagColor: '#9B76D1', time: '19:30', id: 'preview-5' }],
      [{ title: '深夜读棉花糖', tag: '杂谈', tagColor: '#E97A9B', time: '23:00', id: 'preview-6' }],
      [{ title: '周末特别企划', tag: '企划', tagColor: '#E15C58', time: '20:00', id: 'preview-7' }],
    ],
  },
]

export const songListPreviewData: SongsInfo[] = [
  {
    id: 1,
    key: 'song1',
    name: '歌曲1',
    author: ['作者1'],
    tags: ['标签1', '标签2'],
    description: '这是一段描述',
    url: 'https://example.com/song1.mp3',
    from: SongFrom.Custom,
    language: ['中文'],
    createTime: Date.now(),
    updateTime: Date.now(),
  },
  {
    id: 2,
    key: 'song2',
    name: '歌曲2',
    author: ['作者1'],
    tags: ['标签1', '标签2'],
    url: 'https://example.com/song2.mp3',
    from: SongFrom.Custom,
    language: ['中文'],
    createTime: Date.now(),
    updateTime: Date.now(),
    description: '这还是一段描述',
    options: {
      scMinPrice: 30,
      fanMedalMinLevel: 5,
      needJianzhang: true,
    } as SongRequestOption,
  },
  {
    id: 3,
    key: 'song3',
    name: '歌曲3',
    tags: ['标签3', '很长很长很长很长很长很长很长很长很长很长的标签'],
    author: ['作者3'],
    url: 'https://example.com/song3.mp3',
    from: SongFrom.Custom,
    description: '这是一段很长很长很长很长很长很长很长很长很长很长的描述',
    language: ['中文'],
    createTime: Date.now(),
    updateTime: Date.now(),
  },
  {
    id: 4,
    key: 'song4',
    name: '歌曲4',
    author: ['作者4'],
    url: 'https://example.com/song4.mp3',
    from: SongFrom.Custom,
    language: ['中文'],
    createTime: Date.now(),
    updateTime: Date.now(),
  },
  {
    id: 5,
    key: 'song5',
    name: '歌曲5',
    author: ['作者5'],
    tags: ['标签1', '标签5', '标签6', '标签7', '标签8', '标签9', '标签10'],
    url: 'https://example.com/song5.mp3',
    from: SongFrom.Custom,
    language: ['中文'],
    createTime: Date.now(),
    updateTime: Date.now(),
  },
]
