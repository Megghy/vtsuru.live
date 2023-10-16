<script setup lang="ts">
import { SongAuthorInfo, SongFrom, SongLanguage, SongsInfo, UserInfo } from '@/api/api-models'
import { QueryGetAPI, QueryPostAPI } from '@/api/query'
import { SONG_API_URL } from '@/data/constants'
import { refDebounced, useDebounceFn } from '@vueuse/core'
import { List } from 'linqts'
import {
  DataTableBaseColumn,
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
  NIcon,
  NInput,
  NList,
  NListItem,
  NModal,
  NPopconfirm,
  NSelect,
  NSpace,
  NTag,
  NText,
  NTooltip,
  useMessage,
} from 'naive-ui'
import { onMounted, h, ref, watch, computed, reactive } from 'vue'
import APlayer from 'vue3-aplayer'
import { NotepadEdit20Filled, Delete24Filled, Play24Filled, SquareArrowForward24Filled } from '@vicons/fluent'
import NeteaseIcon from '@/svgs/netease.svg'
import FiveSingIcon from '@/svgs/fivesing.svg'

const props = defineProps<{
  songs: SongsInfo[]
  canEdit?: boolean
  isSelf: boolean
}>()
watch(
  () => props.songs,
  (newV) => {
    songsInternal.value = newV
    setTimeout(() => {
      columns.value = createColumns()
    }, 1)
  }
)
const songsInternal = ref(props.songs)
const songsComputed = computed(() => {
  if (debouncedInput.value) {
    //忽略大小写比较
    return songsInternal.value.filter((s) => s.name.toLowerCase().includes(debouncedInput.value.toLowerCase()))
  }
  return songsInternal.value
})
const message = useMessage()

const showModal = ref(false)
const updateSongModel = ref<SongsInfo>({} as SongsInfo)
const searchMusicKeyword = ref()
const debouncedInput = refDebounced(searchMusicKeyword, 500)

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
const tagsSelectOption = computed(() => {
  return new List(songsInternal.value)
    .SelectMany((s) => new List(s?.tags))
    .Distinct()
    .ToArray()
    .map((t) => ({
      label: t,
      value: t,
    }))
})
const authorsOptions = computed(() => {
  return new List(songsInternal.value)
    .SelectMany((s) => new List(s?.author))
    .Distinct()
    .ToArray()
    .map((t) => ({
      label: t,
      value: t,
    }))
})

const columns = ref<DataTableColumns<SongsInfo>>()
const authorColumn = ref<DataTableBaseColumn<SongsInfo>>({
  title: '作者',
  key: 'artist',
  width: 200,
  resizable: true,
  filter(value, row) {
    return (row.author?.findIndex((t) => t == value.toString()) ?? -1) > -1
  },
  filterOptions: authorsOptions.value,
  render(data) {
    return h(NSpace, { size: 5 }, () => data.author.map((a) => h(NButton, { size: 'tiny', type: 'info', secondary: true, onClick: () => (authorColumn.value.filterOptionValue = a) }, () => a)))
  },
})

function createColumns(): DataTableColumns<SongsInfo> {
  authorColumn.value.filterOptions = authorsOptions.value
  return [
    {
      key: 'name',
      resizable: true,
      minWidth: 100,
      width: 300,
      sorter: 'default',
      render(data) {
        return h(NSpace, { size: 5 }, () => [h(NText, () => data.name), h(NText, { depth: '3' }, () => data.translateName)])
      },
      title: '曲名',
    },
    authorColumn.value,
    {
      title: '语言',
      key: 'language',
      width: 150,
      resizable: true,
      filterOptions: songSelectOption,
      filter(value, row) {
        return (row.language?.findIndex((t) => t == (value.toString() as unknown as SongLanguage)) ?? -1) > -1
      },
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
      filterOptions: tagsSelectOption.value,
      render(data) {
        return (data.tags?.length ?? 0) > 0 ? h(NSpace, { size: 5 }, () => data.tags?.map((a) => h(NTag, { bordered: false, size: 'small' }, () => a))) : null
      },
    },
    {
      title: '操作',
      key: 'manage',
      disabled: () => !props.canEdit,
      width: props.isSelf ? 170 : 100,
      render(data) {
        return h(
          NSpace,
          {
            justify: 'end',
            size: 10
          },
          () => [
            GetPlayButton(data),
            data.url
              ? h(NTooltip, null, {
                  trigger: () =>
                    h(
                      NButton,
                      {
                        type: 'primary',
                        size: 'small',
                        circle: true,
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
                        icon: () => h(NIcon, { component: Play24Filled }),
                      }
                    ),
                  default: () => '试听',
                })
              : null,
            props.isSelf
              ? [
                  h(NTooltip, null, {
                    trigger: () =>
                      h(
                        NButton,
                        {
                          size: 'small',
                          circle: true,
                          secondary: true,
                          onClick: () => {
                            updateSongModel.value = JSON.parse(JSON.stringify(data))
                            showModal.value = true
                          },
                        },
                        {
                          icon: () => h(NIcon, { component: NotepadEdit20Filled }),
                        }
                      ),
                    default: () => '修改',
                  }),
                  h(NTooltip, null, {
                    trigger: () =>
                      h(
                        NPopconfirm,
                        {
                          onPositiveClick: () => delSong(data),
                        },
                        {
                          trigger: () =>
                            h(
                              NButton,
                              {
                                type: 'error',
                                size: 'small',
                                circle: true,
                              },
                              {
                                icon: () => h(NIcon, { component: Delete24Filled }),
                              }
                            ),
                          default: () => '确认删除该歌曲？',
                        }
                      ),
                    default: () => '删除',
                  }),
                ]
              : null,
          ]
        )
      },
    },
  ]
}
function GetPlayButton(song: SongsInfo) {
  switch (song.from) {
    case SongFrom.FiveSing: {
      return h(NTooltip, null, {
        trigger: () =>
          h(
            h(
              NButton,
              {
                size: 'small',
                color: '#00BBB3',
                ghost: true,
                onClick: () => {
                  window.open(`http://5sing.kugou.com/bz/${song.id}.html`)
                },
              },
              {
                icon: () => h(FiveSingIcon, { class: 'svg-icon fivesing' }),
              }
            )
          ),
        default: () => '在5sing打开',
      })
    }
    case SongFrom.Netease:
      return h(NTooltip, null, {
        trigger: () =>
          h(
            NButton,
            {
              size: 'small',
              color: '#C20C0C',
              ghost: true,
              onClick: () => {
                window.open(`https://music.163.com/#/song?id=${song.id}`)
              },
            },
            {
              icon: () => h(NeteaseIcon, { class: 'svg-icon netease' }),
            }
          ),
        default: () => '在网易云打开',
      })
    case SongFrom.Custom:
      return song.url
        ? h(NTooltip, null, {
            trigger: () =>
              h(
                NButton,
                {
                  size: 'small',
                  color: '#6b95bd',
                  ghost: true,
                  onClick: () => {
                    window.open(song.url)
                  },
                },
                {
                  icon: () => h(NIcon, { component: SquareArrowForward24Filled }),
                }
              ),
            default: () => '打开链接',
          })
        : null
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
async function delSong(song: SongsInfo) {
  await QueryGetAPI<SongsInfo>(SONG_API_URL + 'del', {
    key: song.key,
  }).then((data) => {
    if (data.code == 200) {
      songsInternal.value = songsInternal.value.filter((s) => s.key != song.key)
      message.success('已删除歌曲')
    } else {
      message.error('未能删除歌曲: ' + data.message)
    }
  })
}

onMounted(() => {
  songsInternal.value = props.songs
  setTimeout(() => {
    columns.value = createColumns()
  }, 1)
})
</script>

<template>
  <NCard embedded size="small">
    <NInput placeholder="搜索歌曲" v-model:value="searchMusicKeyword" size="small" style="max-width: 150px" />
  </NCard>
  <NDivider style="margin: 5px 0 5px 0"> 共 {{ songsInternal.length }} 首 </NDivider>
  <Transition>
    <div v-if="aplayerMusic">
      <APlayer :music="aplayerMusic" autoplay />
      <NDivider style="margin: 15px 0 15px 0" />
    </div>
  </Transition>
  <NDataTable
    size="small"
    :columns="columns"
    :data="songsComputed"
    :pagination="{ itemCount: songsInternal.length, defaultPageSize: 25, pageSizes: [25, 50, 200], size: 'small', showSizePicker: true }"
  />
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

<style>
.netease path:nth-child(2) {
  fill: #c20c0c;
}
.fivesing:first-child {
  fill: #00bbb3;
}
</style>
