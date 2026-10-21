import { Dismiss12Regular } from '@vicons/fluent'
import { h, ref } from 'vue'

import type { ExtractConfigData } from '@/shared/types/VTsuruConfigTypes'
import { defineTemplateConfig } from '@/shared/types/VTsuruConfigTypes'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'

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
      h('div', { class: 'flex flex-wrap items-center gap-2' }, [
        config.links?.map((link: { name: string; url: string }) =>
          h(
            Badge,
            {
              variant: 'secondary',
              class: 'flex items-center gap-1 text-xs h-6 px-2 font-normal',
            },
            () => [
              link.name,
              h(
                'button',
                {
                  type: 'button',
                  class: 'hover:text-destructive transition cursor-pointer p-0.5 ml-0.5',
                  onClick: () => {
                    config.links = config.links.filter((item: { name: string }) => item.name !== link.name)
                  },
                },
                [h(Dismiss12Regular, { class: 'size-3' })],
              ),
            ],
          ),
        ),
        h('div', { class: 'flex items-center gap-1.5 flex-1 min-w-[300px]' }, [
          h(Input, {
            modelValue: pendingLink.value.name,
            placeholder: '链接名称',
            class: 'h-8 text-xs w-28',
            'onUpdate:modelValue': (value: string) => (pendingLink.value.name = value),
          }),
          h(Input, {
            modelValue: pendingLink.value.url,
            placeholder: 'https://...',
            class: 'h-8 text-xs flex-1',
            'onUpdate:modelValue': (value: string) => (pendingLink.value.url = value),
          }),
          h(
            Button,
            {
              size: 'sm',
              class: 'h-8 text-xs',
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
