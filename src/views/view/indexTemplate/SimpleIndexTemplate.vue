<script lang="ts" setup>
import { UserInfo } from '@/api/api-models'
import { TemplateConfig } from '@/data/VTsuruTypes'
import { h } from 'vue'

const width = window.innerWidth

const props = defineProps<{
  userInfo: UserInfo | undefined
  biliInfo: any | undefined
  currentData?: any
}>()
function navigate(url: string) {
  window.open(url, '_blank')
}
</script>

<script lang="ts">
export type ConfigType = {
  cover?: string
}
export const Config: TemplateConfig<ConfigType> = {
  name: 'Template.Index.Simple',
  items: [
    {
      name: '封面',
      type: 'image',
      imageLimit: 1,
      key: 'cover',
      onUploaded: (url, config) => {
        config.cover = url[0]
      },
    },
    {
      name: 'test',
      key: 'test',
      type: 'render',
      render: (config) => h('div', '1'),
    },
  ],
}
</script>

<template>1</template>
