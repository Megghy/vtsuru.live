import type {
  ScheduleWeekInfo,
  SongRequestOption,
  SongsInfo,
} from '@/api/api-models'
import { SongFrom } from '@/api/api-models'

// 模板预览用的假数据 (仅用于设置页实时预览, 不参与实际展示)

export const schedulePreviewData: ScheduleWeekInfo[] = [
  {
    year: 2023,
    week: 30,
    days: [
      [{ title: '唱唱歌!', tag: '歌回', tagColor: '#61B589', time: '10:00 AM', id: null }],
      [{ title: '玩点游戏', tag: '游戏', tagColor: '#A36565', time: '20:00 PM', id: null }],
      [{ title: 'Title 3', tag: 'Tag 3', tagColor: '#7BCDEF', time: '11:00 PM', id: null }],
      [{ title: null, tag: null, tagColor: null, time: null, id: null }],
      [{ title: null, tag: null, tagColor: null, time: null, id: null }],
      [{ title: null, tag: null, tagColor: null, time: null, id: null }],
      [{ title: null, tag: null, tagColor: null, time: null, id: null }],
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
