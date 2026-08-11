import { NButton, NFlex, NInput, NInputGroup, NInputGroupLabel, NTag } from 'naive-ui'
import { h, ref } from 'vue'

import type { ExtractConfigData } from '@/shared/types/VTsuruConfigTypes'
import { defineTemplateConfig } from '@/shared/types/VTsuruConfigTypes'

/** 配置面板输入态：放在 render 外，避免每次重渲染丢失 */
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
      h(NFlex, { align: 'center', wrap: true }, () => [
        config.links?.map((link: { name: string; url: string }) =>
          h(
            NTag,
            {
              closable: true,
              onClose: () => {
                config.links = config.links.filter((item: { name: string }) => item.name !== link.name)
              },
            },
            () => link.name,
          ),
        ),
        h(NInputGroup, { size: 'small', style: { flex: '1 1 300px' } }, () => [
          h(NInputGroupLabel, null, () => '名称'),
          h(NInput, {
            value: pendingLink.value.name,
            placeholder: '链接名称',
            onUpdateValue: (value) => (pendingLink.value.name = value),
          }),
          h(NInputGroupLabel, null, () => '地址'),
          h(NInput, {
            value: pendingLink.value.url,
            placeholder: 'https://...',
            onUpdateValue: (value) => (pendingLink.value.url = value),
          }),
          h(
            NButton,
            {
              type: 'primary',
              disabled: !pendingLink.value.name || !pendingLink.value.url,
              onClick: () => {
                config.links ??= []
                config.links.push({ ...pendingLink.value })
                pendingLink.value = { name: '', url: '' }
              },
            },
            () => '添加',
          ),
        ]),
      ]),
  },
])

export type TraditionalConfigType = ExtractConfigData<typeof Config>
export const DefaultConfig = {} as TraditionalConfigType
