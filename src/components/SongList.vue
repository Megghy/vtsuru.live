<script setup lang="ts">
import { SongsInfo } from '@/api/api-models'
import { DataTableColumns, NAvatar, NButton, NCollapseTransition, NDataTable, NInput, NList, NListItem, NSpace } from 'naive-ui'
import { onMounted, h, ref } from 'vue'
import APlayer from 'vue3-aplayer'

const props = defineProps<{
  songs: SongsInfo[]
  canEdit?: boolean
}>()
const songsInternal = ref<{ [id: string]: SongsInfo }>({})
const columns = ref<DataTableColumns<SongsInfo>>()
const aplayerMusic = ref<{
  title: string
  artist: string
  src: string
  pic: string
}>()

const createColumns = (): DataTableColumns<SongsInfo> => [
  {
    title: '',
    key: 'cover',
    resizable: false,
    width: 50,
    render(data) {
      return h(NAvatar, {
        src: data.cover,
        imgProps: {},
      })
    },
  },
  {
    title: '名称',
    key: 'name',
    resizable: true,
    minWidth: 100,
    render(data) {
      return props.canEdit
        ? h(NInput, {
            value: data.name,
            onUpdateValue(v) {
              songsInternal.value[data.id].name = v
            },
          })
        : h('span', data.name)
    },
  },
  {
    title: '作者',
    key: 'author',
    resizable: true,
    render(data) {
      return props.canEdit
        ? h(NInput, {
            value: data.author,
            onUpdateValue(v) {
              songsInternal.value[data.id].author = v
            },
          })
        : h('span', data.author)
    },
  },
  {
    title: '描述',
    key: 'description',
    resizable: true,
    minWidth: 75,
    render(data) {
      return props.canEdit
        ? h(NInput, {
            value: data.desc,
            onUpdateValue(v) {
              songsInternal.value[data.id].desc = v
            },
          })
        : h('span', data.desc)
    },
  },
  {
    title: '操作',
    key: 'manage',
    minWidth: 75,
    render(data) {
      return h(NSpace, [
        h(
          NButton,
          {
            onClick: () => console.log(1),
          },
          {
            default: () => '保存',
          }
        ),
        h(
          NButton,
          {
            type: 'primary',
            onClick: () => {
              aplayerMusic.value = {
                title: data.name,
                artist: data.author,
                src: data.url,
                pic: data.cover,
              }
            },
          },
          {
            default: () => '播放',
          }
        ),
      ])
    },
  },
]
onMounted(() => {
  props.songs.forEach((song) => {
    songsInternal.value[song.id] = song
  })
  columns.value = createColumns()
})
</script>

<template>
  歌单 {{ songs.length }}
  <Transition>
    <APlayer v-if="aplayerMusic" :music="aplayerMusic" />
  </Transition>
  <NDataTable :columns="columns" :data="songs"> </NDataTable>
</template>
