import { h, ref } from 'vue'

import type { ExtractConfigData } from '@/shared/types/VTsuruConfigTypes'
import { defineTemplateConfig } from '@/shared/types/VTsuruConfigTypes'

const pendingLink = ref({ name: '', url: '' })

export const Config = defineTemplateConfig([
  {
    name: '背景',
    type: 'file',
    fileLimit: 1,
    key: 'backgroundFile',
    onUploaded: (file, config) => {
      config.backgroundFile = file
    },
  },
  {
    name: '固定歌曲列表高度',
    type: 'boolean',
    key: 'fixedHeight',
    default: true,
    description: '开启后只滚动歌曲区域，关闭后跟随页面滚动',
  },
  { name: '标题', type: 'string', key: 'title', default: '我的歌单' },
  { name: '简介', type: 'string', key: 'description' },
  { name: '详情页标题', type: 'string', key: 'detailTitle', placeholder: '链接区域标题' },
  {
    name: '详情页介绍',
    type: 'string',
    key: 'longDescription',
    placeholder: '链接区域介绍',
    inputType: 'textarea',
  },
  { type: 'string', name: '网易云链接', key: 'neteaseLink', placeholder: 'https://...' },
  { type: 'string', name: 'QQ音乐链接', key: 'qqMusicLink', placeholder: 'https://...' },
  { type: 'string', name: '抖音链接', key: 'douyinLink', placeholder: 'https://...' },
  {
    type: 'render',
    name: '自定义其他链接',
    key: 'links',
    default: [{ name: '哔哩哔哩', url: 'https://www.bilibili.com/' }],
    render: (config) =>
      h('div', { class: 'traditional-link-editor' }, [
        config.links?.map((link: { name: string; url: string }) =>
          h('span', { class: 'traditional-link-editor__tag' }, [
            link.name,
            h(
              'button',
              {
                type: 'button',
                title: `删除 ${link.name}`,
                onClick: () => {
                  config.links = config.links.filter((item: { name: string }) => item.name !== link.name)
                },
              },
              '×',
            ),
          ]),
        ),
        h('label', null, [
          '名称',
          h('input', {
            value: pendingLink.value.name,
            placeholder: '链接名称',
            onInput: (event: Event) => (pendingLink.value.name = (event.target as HTMLInputElement).value),
          }),
        ]),
        h('label', null, [
          '地址',
          h('input', {
            value: pendingLink.value.url,
            placeholder: 'https://...',
            onInput: (event: Event) => (pendingLink.value.url = (event.target as HTMLInputElement).value),
          }),
        ]),
        h(
          'button',
          {
            type: 'button',
            disabled: !pendingLink.value.name || !pendingLink.value.url,
            onClick: () => {
              config.links ??= []
              config.links.push({ ...pendingLink.value })
              pendingLink.value = { name: '', url: '' }
            },
          },
          '添加',
        ),
      ]),
  },
])

export type TraditionalConfigType = ExtractConfigData<typeof Config>
export const DefaultConfig = {} as TraditionalConfigType
