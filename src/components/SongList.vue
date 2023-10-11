<script setup lang="ts">
import { SongAuthorInfo, SongFrom, SongLanguage, SongsInfo } from '@/api/api-models'
import { QueryPostAPI } from '@/api/query'
import { SONG_API_URL } from '@/data/constants'
import { List } from 'linqts'
import {
  DataTableColumns,
  FormInst,
  FormRules,
  NAvatar,
  NButton,
  NCard,
  NCollapseTransition,
  NDataTable,
  NDivider,
  NEllipsis,
  NForm,
  NFormItem,
  NInput,
  NList,
  NListItem,
  NModal,
  NSelect,
  NSpace,
  NTag,
  NText,
  useMessage,
} from 'naive-ui'
import { FilterOptionValue } from 'naive-ui/es/data-table/src/interface'
import { nextTick } from 'process'
import { onMounted, h, ref, watch, computed } from 'vue'
import APlayer from 'vue3-aplayer'

const props = defineProps<{
  songs: SongsInfo[]
  canEdit?: boolean
}>()
watch(
  () => props.songs,
  (newV) => {
    let map = new Map()
    newV.forEach((s) => {
      s.tags?.forEach((t) => map.set(t, t))
    })
    map.forEach((tag) => {
      tagsSelectOption.value.push({
        label: tag,
        value: tag,
      })
    })
    songsInternal.value = newV
  }
)
const songsInternal = ref(props.songs)
const message = useMessage()

const showModal = ref(false)
const updateSongModel = ref<SongsInfo>({} as SongsInfo)

const columns = ref<DataTableColumns<SongsInfo>>()
const aplayerMusic = ref<{
  title: string
  artist: string
  src: string
  pic: string
}>()

const formRef = ref<FormInst | null>(null)
const updateSongRules: FormRules = {
  name: [
    {
      required: true,
      message: '请输入歌曲名称',
    },
  ],
  password: [
    {
      required: true,
      message: '请输入密码',
    },
  ],
}
const songSelectOption = [
  {
    label: '中文',
    value: SongLanguage.Chinese,
  },
  {
    label: '日语',
    value: SongLanguage.Japanese,
  },
  {
    label: '英语',
    value: SongLanguage.English,
  },
  {
    label: '法语',
    value: SongLanguage.French,
  },
  {
    label: '西语',
    value: SongLanguage.Spanish,
  },
  {
    label: '其他',
    value: SongLanguage.Other,
  },
]
const tagsSelectOption = ref<{ label: string; value: string }[]>([])
const tags = ref<string[]>([])
const tagsOptions = computed(() => {
  return tags.value.map((t) => ({
    label: t,
    value: t,
  }))
})

function createColumns(): DataTableColumns<SongsInfo> {
  return [
    {
      title: '名称',
      key: 'name',
      resizable: true,
      minWidth: 100,
      width: 300,
      sorter: 'default',
      render(data) {
        return h(NSpace, { size: 5 }, () => [h(NText, () => data.name), h(NText, { depth: '3' }, () => data.translateName)])
      },
    },
    {
      title: '作者',
      key: 'artist',
      width: 200,
      resizable: true,
      render(data) {
        return h(NSpace, { size: 5 }, () => data.author.map((a) => h(NTag, { bordered: false, size: 'small', type: 'info' }, () => a)))
      },
    },
    {
      title: '语言',
      key: 'language',
      width: 150,
      resizable: true,
      render(data) {
        return (data.language?.length ?? 0) > 0
          ? h(NSpace, { size: 5 }, () => data.language?.map((a) => h(NTag, { bordered: false, size: 'small' }, () => songSelectOption.find((s) => s.value == a)?.label)))
          : null
      },
    },
    {
      title: '描述',
      key: 'description',
      resizable: true,
      render(data) {
        return h(NEllipsis, () => data.description)
      },
    },
    {
      title: '标签',
      key: 'tags',
      resizable: true,
      filter(value, row) {
        return (row.tags?.findIndex((t) => t == value.toString()) ?? -1) > -1
      },
      filterOptions: tagsOptions.value,
      render(data) {
        return (data.tags?.length ?? 0) > 0 ? h(NSpace, { size: 5 }, () => data.tags?.map((a) => h(NTag, { bordered: false, size: 'small' }, () => a))) : null
      },
    },
    {
      title: '操作',
      key: 'manage',
      disabled: () => !props.canEdit,
      width: 200,
      render(data) {
        return h(
          NSpace,
          {
            justify: 'space-around',
          },
          () => [
            h(
              NButton,
              {
                size: 'small',
                onClick: () => {
                  updateSongModel.value = JSON.parse(JSON.stringify(data))
                  showModal.value = true
                },
              },
              {
                default: () => '修改',
              }
            ),
            h(
              NButton,
              {
                type: 'primary',
                size: 'small',
                onClick: () => {
                  aplayerMusic.value = {
                    title: data.name,
                    artist: data.author.join('/') ?? '',
                    src: data.url,
                    pic: '',
                  }
                },
              },
              {
                default: () => '播放',
              }
            ),
            h(
              NButton,
              {
                type: 'error',
                size: 'small',
                onClick: () => {
                  aplayerMusic.value = {
                    title: data.name,
                    artist: data.author.join('/') ?? '',
                    src: data.url,
                    pic: '',
                  }
                },
              },
              {
                default: () => '删除',
              }
            ),
            GetPlayButton(data),
          ]
        )
      },
    },
  ]
}
function GetPlayButton(song: SongsInfo) {
  switch (song.from) {
    case SongFrom.FiveSing: {
      return h(
        NButton,
        {
          size: 'small',
          color: '#00BBB3',
          onClick: () => {
            window.open(`http://5sing.kugou.com/bz/${song.id}.html`)
          },
        },
        {
          default: () => '在5sing打开',
        }
      )
    }
    case SongFrom.Netease:
      return h(
        NButton,
        {
          size: 'small',
          color: '#C20C0C',
          onClick: () => {
            window.open(`https://music.163.com/#/song?id=${song.id}`)
          },
        },
        {
          default: () => '在网易云打开',
        }
      )
  }
}
function renderCell(value: string | number) {
  if (!value) {
    return h(NText, { depth: 3 }, { default: () => '未填写' })
  }
  return value
}

async function updateSong() {
  await QueryPostAPI<SongsInfo>(SONG_API_URL + 'update', {
    key: updateSongModel.value.key,
    song: updateSongModel.value,
  }).then((data) => {
    if (data.code == 200) {
      const index = songsInternal.value.findIndex((s) => s.key == data.data.key)
      songsInternal.value.splice(index, 1, data.data)
      message.success('已更新歌曲信息')
    } else {
      message.error('未能更新歌曲信息: ' + data.message)
    }
  })
}

onMounted(() => {
  songsInternal.value = props.songs
  tags.value = new List(songsInternal.value)
    .SelectMany((s) => new List(s?.tags))
    .Distinct()
    .ToArray()
  setTimeout(() => {
    columns.value = createColumns()
  }, 1)
})
</script>

<template>
  歌单 {{ songsInternal.length }}
  <NCard embedded>
    <NButton> </NButton>
  </NCard>
  <Transition>
    <APlayer v-if="aplayerMusic" :music="aplayerMusic" autoplay />
  </Transition>
  <NDataTable size="small" :columns="columns" :data="songsInternal"> </NDataTable>
  <NModal v-model:show="showModal" style="max-width: 600px" preset="card">
    <template #header> 修改信息 </template>
    <NForm ref="formRef" :rules="updateSongRules" :model="updateSongModel" :render-cell="renderCell">
      <NFormItem path="name" label="名称">
        <NInput v-model:value="updateSongModel.name" autosize style="min-width: 200px" placeholder="就是歌曲名称" />
      </NFormItem>
      <NFormItem path="author" label="作者">
        <NSelect v-model:value="updateSongModel.author" filterable multiple tag placeholder="输入，按回车确认" :show-arrow="false" :show="false" />
      </NFormItem>
      <NFormItem path="description" label="备注">
        <NInput v-model:value="updateSongModel.description" placeholder="可选" :maxlength="250" show-count autosize style="min-width: 300px" clearable />
      </NFormItem>
      <NFormItem path="language" label="语言">
        <NSelect v-model:value="updateSongModel.language" multiple :options="songSelectOption" placeholder="可选" />
      </NFormItem>
      <NFormItem path="tags" label="标签">
        <NSelect v-model:value="updateSongModel.tags" filterable multiple tag placeholder="可选，按回车确认" :show-arrow="false" :show="false" :options="tagsSelectOption" />
      </NFormItem>
      <NFormItem path="url" label="链接">
        <NInput v-model:value="updateSongModel.url" placeholder="可选, 后缀为mp3、wav、ogg时将会尝试播放, 否则会在新页面打开" :disabled="updateSongModel.from != SongFrom.Custom" />
      </NFormItem>
    </NForm>
    <NDivider style="margin: 10px" />
    <NButton @click="updateSong" type="success"> 更新 </NButton>
  </NModal>
</template>
