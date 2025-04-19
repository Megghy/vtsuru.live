<script setup lang="ts">
import { SongFrom, SongRequestOption, SongsInfo } from '@/api/api-models';
import { QueryGetAPI, QueryPostAPI } from '@/api/query';
import { SONG_API_URL } from '@/data/constants';
import {
  Delete24Filled,
  Info24Filled,
  NotepadEdit20Filled,
  Play24Filled
} from '@vicons/fluent';
import { refDebounced, useLocalStorage } from '@vueuse/core';
import { List } from 'linqts';
import {
  DataTableBaseColumn,
  DataTableColumns,
  DataTableRowKey,
  FormInst,
  FormRules,
  NButton,
  NCard,
  NCheckbox,
  NDataTable,
  NDivider,
  NEllipsis,
  NForm,
  NFormItem,
  NIcon,
  NInput,
  NInputGroup,
  NInputGroupLabel,
  NInputNumber,
  NModal,
  NPopconfirm,
  NSelect,
  NSpace,
  NTabPane,
  NTabs,
  NTag,
  NText,
  NTooltip,
  useMessage,
} from 'naive-ui';
import { VNodeChild, computed, h, onMounted, ref, watch } from 'vue';
  import SongPlayer from './SongPlayer.vue';
import { GetPlayButton } from '@/Utils';

const props = defineProps<{
  songs: SongsInfo[]
  canEdit?: boolean
  isSelf: boolean
  extraButton?: (song: SongsInfo) => VNodeChild[]
}>()
watch(
  () => props.songs,
  (newV) => {
    songsInternal.value = newV
    setTimeout(() => {
      columns.value = createColumns()
    }, 1)
  },
)
const volume = useLocalStorage('Settings.AplayerVolume', 0.8)
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
const showBatchModal = ref(false)
const updateSongModel = ref<SongsInfo>({} as SongsInfo)
const searchMusicKeyword = ref()
const debouncedInput = refDebounced(searchMusicKeyword, 500)

const batchUpdate_Author = ref<string[]>([])
const batchUpdate_Tag = ref<string[]>([])
const batchUpdate_Language = ref<string[]>([])
const batchUpdate_Option = ref<SongRequestOption>()

const playingSong = ref<SongsInfo>()
const isLrcLoading = ref<string>()
const isLoading = ref(false)

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
    value: '中文',
  },
  {
    label: '日语',
    value: '日语',
  },
  {
    label: '英语',
    value: '英语',
  },
  {
    label: '韩语',
    value: '韩语',
  },
  {
    label: '法语',
    value: '法语',
  },
  {
    label: '西语',
    value: '西语',
  },
  {
    label: '其他',
    value: '其他',
  },
]
const languageSelectOption = computed(() => {
  const languages = new Set<string>(songSelectOption.map((s) => s.label))
  songsInternal.value.forEach((s) => {
    if (s.language) {
      s.language.forEach((l) => languages.add(l))
    }
  })
  return [...languages].map((t) => ({
    label: t,
    value: t,
  }))
})
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
const selectedColumn = ref<DataTableRowKey[]>([])
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
    return h(NSpace, { size: 5 }, () =>
      data.author.map((a) =>
        h(NButton, { size: 'tiny', type: 'info', secondary: true, onClick: () => onAuthorClick(a) }, () => a),
      ),
    )
  },
})
const onAuthorClick = (author: string) => {
  if (authorColumn.value.filterOptionValue == author) {
    authorColumn.value.filterOptionValue = undefined
  } else {
    authorColumn.value.filterOptionValue = author
  }
}

function createColumns(): DataTableColumns<SongsInfo> {
  authorColumn.value.filterOptions = authorsOptions.value
  return [
    {
      type: 'selection',
      disabled: () => !props.isSelf,
    },
    {
      key: 'name',
      resizable: true,
      minWidth: 100,
      width: 300,
      sorter: 'default',
      render(data) {
        return h(NSpace, { size: 5 }, () => [
          h(NText, { style: { color: data.options?.scMinPrice ? '#c36767' : '' } }, () => data.name),
          h(NText, { depth: '3' }, () => data.translateName),
        ])
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
        return (row.language?.findIndex((t) => t == value) ?? -1) > -1
      },
      render(data) {
        return (data.language?.length ?? 0) > 0
          ? h(NSpace, { size: 5 }, () =>
            data.language?.map((a) => h(NTag, { bordered: false, size: 'small' }, () => a)),
          )
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
      title: '要求',
      key: 'options',
      resizable: true,
      render(data) {
        return data.options
          ? h(NSpace, {}, () => [
            data.options?.needJianzhang
              ? h(
                NTag,
                { color: { textColor: 'white', color: GetGuardColor(3), borderColor: 'white' }, size: 'small' },
                () => '舰长',
              )
              : null,
            data.options?.needTidu
              ? h(
                NTag,
                { color: { textColor: 'white', color: GetGuardColor(2), borderColor: 'white' }, size: 'small' },
                () => '提督',
              )
              : null,
            data.options?.needZongdu
              ? h(
                NTag,
                { color: { textColor: 'white', color: GetGuardColor(1), borderColor: 'white' }, size: 'small' },
                () => '总督',
              )
              : null,
            data.options?.scMinPrice
              ? h(
                NTag,
                {
                  color: { textColor: 'white', color: GetSCColor(data.options.scMinPrice), borderColor: 'white' },
                  size: 'small',
                },
                () => 'SC | ' + data.options?.scMinPrice,
              )
              : null,
            data.options?.fanMedalMinLevel
              ? h(NTag, { type: 'info', size: 'small' }, () => '粉丝牌 | ' + data.options?.fanMedalMinLevel)
              : null,
          ])
          : null
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
        return (data.tags?.length ?? 0) > 0
          ? h(NSpace, { size: 5 }, () => data.tags?.map((a) => h(NTag, { bordered: false, size: 'small' }, () => a)))
          : null
      },
    },
    {
      title: '操作',
      key: 'manage',
      disabled: () => !props.canEdit,
      width: 170,
      render(data) {
        return h(
          NSpace,
          {
            justify: 'end',
            size: 10,
          },
          () => [
            GetPlayButton(data),
            data.url?.endsWith('mp3') ||
              data.url?.endsWith('flac') ||
              data.url?.endsWith('ogg') ||
              data.url?.endsWith('wav') ||
              data.url?.endsWith('m4a')
              ? h(NTooltip, null, {
                trigger: () =>
                  h(
                    NButton,
                    {
                      type: 'primary',
                      size: 'small',
                      circle: true,
                      loading: isLrcLoading.value == data.key,
                      onClick: () => {
                        playingSong.value = data
                      },
                    },
                    {
                      icon: () => h(NIcon, { component: Play24Filled }),
                    },
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
                      },
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
                            },
                          ),
                        default: () => '确认删除该歌曲？',
                      },
                    ),
                  default: () => '删除',
                }),
              ]
              : null,
            props.extraButton?.(data),
          ],
        )
      },
    },
  ]
}

function renderCell(value: string | number) {
  if (!value) {
    return h(NText, { depth: 3 }, { default: () => '未填写' })
  }
  return value
}

async function updateSong() {
  if (props.songs.filter((s) => s.name == updateSongModel.value.name).length > 1) {
    message.error('已存在相同名称的歌曲')
    return
  }
  isLoading.value = true
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
  }).finally(() => {
    isLoading.value = false
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
async function delBatchSong() {
  const ids = selectedColumn.value.map((s) => s.toString())
  isLoading.value = true
  await QueryPostAPI<SongsInfo>(SONG_API_URL + 'del-batch', ids).then((data) => {
    if (data.code == 200) {
      songsInternal.value = songsInternal.value.filter((s) => !ids.includes(s.key))
      message.success('已删除 ' + ids.length + ' 首歌曲')
      showBatchModal.value = false
      selectedColumn.value = []
    } else {
      message.error('未能删除歌曲: ' + data.message)
    }
  }).finally(() => {
    isLoading.value = false
  })
}
function GetSCColor(price: number): string {
  if (price === 0) return `#2a60b2`
  if (price > 0 && price < 30) return `#2a60b2`
  if (price >= 30 && price < 50) return `#2a60b2`
  if (price >= 50 && price < 100) return `#427d9e`
  if (price >= 100 && price < 500) return `#c99801`
  if (price >= 500 && price < 1000) return `#e09443`
  if (price >= 1000 && price < 2000) return `#e54d4d`
  if (price >= 2000) return `#ab1a32`
  return ''
}
function GetGuardColor(level: number | null | undefined): string {
  if (level) {
    switch (level) {
      case 1: {
        return 'rgb(122, 4, 35)'
      }
      case 2: {
        return 'rgb(157, 155, 255)'
      }
      case 3: {
        return 'rgb(104, 136, 241)'
      }
    }
  }
  return ''
}
function batchUpdateAuthor() {
  if (selectedColumn.value.length == 0) {
    message.error('请先选择歌曲')
    return
  }
  isLoading.value = true
  QueryPostAPI<SongsInfo[]>(SONG_API_URL + 'update-batch-author', {
    ids: selectedColumn.value.map((s) => s.toString()),
    data: batchUpdate_Author.value,
  })
    .then((data) => {
      if (data.code == 200) {
        message.success('已更新歌曲')
        for (const song of songsInternal.value) {
          if (selectedColumn.value.includes(song.key)) {
            const index = songsInternal.value.findIndex((s) => s.key == song.key)
            songsInternal.value[index].author = batchUpdate_Author.value
          }
        }
      } else {
        message.error('未能更新歌曲: ' + data.message)
      }
    })
    .catch((err) => {
      message.error('未能更新歌曲: ' + err)
    }).finally(() => {
      isLoading.value = false
    })
}
function batchUpdateTag() {
  if (selectedColumn.value.length == 0) {
    message.error('请先选择歌曲')
    return
  }
  isLoading.value = true
  QueryPostAPI<SongsInfo[]>(SONG_API_URL + 'update-batch-tag', {
    ids: selectedColumn.value.map((s) => s.toString()),
    data: batchUpdate_Tag.value,
  })
    .then((data) => {
      if (data.code == 200) {
        message.success('已更新歌曲')
        for (const song of songsInternal.value) {
          if (selectedColumn.value.includes(song.key)) {
            const index = songsInternal.value.findIndex((s) => s.key == song.key)
            songsInternal.value[index].tags = batchUpdate_Tag.value
          }
        }
      } else {
        message.error('未能更新歌曲: ' + data.message)
      }
    })
    .catch((err) => {
      message.error('未能更新歌曲: ' + err)
    }).finally(() => {
      isLoading.value = false
    })
}
function batchUpdateLanguage() {
  if (selectedColumn.value.length == 0) {
    message.error('请先选择歌曲')
    return
  }
  isLoading.value = true
  QueryPostAPI<SongsInfo[]>(SONG_API_URL + 'update-batch-language', {
    ids: selectedColumn.value.map((s) => s.toString()),
    data: batchUpdate_Language.value,
  })
    .then((data) => {
      if (data.code == 200) {
        message.success('已更新歌曲')
        for (const song of songsInternal.value) {
          if (selectedColumn.value.includes(song.key)) {
            const index = songsInternal.value.findIndex((s) => s.key == song.key)
            songsInternal.value[index].language = batchUpdate_Language.value
          }
        }
      } else {
        message.error('未能更新歌曲: ' + data.message)
      }
    })
    .catch((err) => {
      message.error('未能更新歌曲: ' + err)
    }).finally(() => {
      isLoading.value = false
    })
}
function batchUpdateOption() {
  if (selectedColumn.value.length == 0) {
    message.error('请先选择歌曲')
    return
  }
  isLoading.value = true
  QueryPostAPI<SongsInfo[]>(SONG_API_URL + 'update-batch-option', {
    ids: selectedColumn.value.map((s) => s.toString()),
    data: batchUpdate_Option.value ? batchUpdate_Option.value : null,
  })
    .then((data) => {
      if (data.code == 200) {
        message.success('已更新歌曲')
        for (const song of songsInternal.value) {
          if (selectedColumn.value.includes(song.key)) {
            const index = songsInternal.value.findIndex((s) => s.key == song.key)
            songsInternal.value[index].options = batchUpdate_Option.value
          }
        }
      } else {
        message.error('未能更新歌曲: ' + data.message)
      }
    })
    .catch((err) => {
      message.error('未能更新歌曲: ' + err)
    }).finally(() => {
      isLoading.value = false
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
  <NCard
    embedded
    size="small"
  >
    <NSpace>
      <NInput
        v-model:value="searchMusicKeyword"
        placeholder="搜索歌曲"
        size="small"
        style="width: 150px"
      />
      <NSelect
        v-model:value="authorColumn.filterOptionValue"
        placeholder="选择歌手"
        :options="authorsOptions"
        clearable
        filterable
        size="small"
        style="width: 150px"
      />
      <NButton
        v-if="authorColumn.filterOptionValue"
        type="error"
        size="small"
        @click="authorColumn.filterOptionValue = null"
      >
        清除歌手选择
      </NButton>
    </NSpace>
  </NCard>
  <NDivider style="margin: 5px 0 5px 0">
    共 {{ songsComputed.length }} 首
  </NDivider>
  <Transition>
    <div
      v-if="playingSong"
      class="song-list"
    >
      <SongPlayer
        v-model:is-lrc-loading="isLrcLoading"
        :song="playingSong"
      />
      <NDivider style="margin: 15px 0 15px 0" />
    </div>
  </Transition>
  <template v-if="isSelf">
    <NButton

      :disabled="selectedColumn.length <= 1 && isSelf"
      type="info"
      size="small"
      @click="showBatchModal = true"
    >
      批量编辑
    </NButton>
    <NDivider style="margin: 5px 0 5px 0" />
  </template>
  <NDataTable
    v-model:checked-row-keys="selectedColumn"
    size="small"
    :columns="columns"
    :data="songsComputed"
    :pagination="{
      itemCount: songsInternal.length,
      defaultPageSize: 25,
      pageSizes: [25, 50, 200],
      size: 'small',
      showSizePicker: true,
    }"
  />
  <NModal
    v-model:show="showModal"
    style="max-width: 600px"
    preset="card"
  >
    <template #header>
      修改信息
    </template>
    <NForm
      ref="formRef"
      :rules="updateSongRules"
      :model="updateSongModel"
      :render-cell="renderCell"
    >
      <NFormItem
        path="name"
        label="名称"
      >
        <NInput
          v-model:value="updateSongModel.name"
          autosize
          style="min-width: 200px"
          placeholder="就是歌曲名称"
        />
      </NFormItem>
      <NFormItem
        path="author"
        label="作者"
      >
        <NSelect
          v-model:value="updateSongModel.author"
          filterable
          multiple
          tag
          placeholder="输入，按回车确认"
          :options="authorsOptions"
        />
      </NFormItem>
      <NFormItem
        path="description"
        label="备注"
      >
        <NInput
          v-model:value="updateSongModel.description"
          placeholder="可选"
          :maxlength="250"
          show-count
          autosize
          style="min-width: 300px"
          clearable
        />
      </NFormItem>
      <NFormItem
        path="language"
        label="语言"
      >
        <NSelect
          v-model:value="updateSongModel.language"
          filterable
          multiple
          clearable
          tag
          placeholder="可选，输入后按回车新增"
          :options="languageSelectOption"
        />
      </NFormItem>
      <NFormItem
        path="tags"
        label="标签"
      >
        <NSelect
          v-model:value="updateSongModel.tags"
          filterable
          multiple
          clearable
          tag
          placeholder="可选，按回车确认"
          :options="tagsSelectOption"
        />
      </NFormItem>
      <NFormItem path="options">
        <template #label>
          点歌设置
          <NTooltip>
            <template #trigger>
              <NIcon :component="Info24Filled" />
            </template>
            这个不是控制是否允许点歌的! 启用后将会覆盖点歌功能中的设置, 用于单独设置歌曲要求
          </NTooltip>
        </template>
        <NSpace vertical>
          <NCheckbox
            :checked="updateSongModel.options != undefined"
            @update:checked="(checked: boolean) => {
              updateSongModel.options = checked
                ? ({
                  needJianzhang: false,
                  needTidu: false,
                  needZongdu: false,
                } as SongRequestOption)
                : undefined
            }
            "
          >
            是否启用
          </NCheckbox>
          <template v-if="updateSongModel.options != undefined">
            <NSpace>
              <NCheckbox v-model:checked="updateSongModel.options.needJianzhang">
                需要舰长
              </NCheckbox>
              <NCheckbox v-model:checked="updateSongModel.options.needTidu">
                需要提督
              </NCheckbox>
              <NCheckbox v-model:checked="updateSongModel.options.needZongdu">
                需要总督
              </NCheckbox>
            </NSpace>
            <NSpace align="center">
              <NCheckbox
                :checked="updateSongModel.options.scMinPrice != undefined"
                @update:checked="(checked: boolean) => {
                  if (updateSongModel.options) updateSongModel.options.scMinPrice = checked ? 30 : undefined
                }
                "
              >
                需要SC
              </NCheckbox>
              <NInputGroup
                v-if="updateSongModel.options?.scMinPrice"
                style="width: 200px"
              >
                <NInputGroupLabel> SC最低价格 </NInputGroupLabel>
                <NInputNumber
                  v-model:value="updateSongModel.options.scMinPrice"
                  min="30"
                />
              </NInputGroup>
            </NSpace>
            <NSpace align="center">
              <NCheckbox
                :checked="updateSongModel.options.fanMedalMinLevel != undefined"
                @update:checked="(checked: boolean) => {
                  if (updateSongModel.options) updateSongModel.options.fanMedalMinLevel = checked ? 5 : undefined
                }
                "
              >
                需要粉丝牌
                <NTooltip>
                  <template #trigger>
                    <NIcon :component="Info24Filled" />
                  </template>
                  这个即使不开也会遵循全局点歌设置的粉丝牌等级
                </NTooltip>
              </NCheckbox>
              <NInputGroup
                v-if="updateSongModel.options?.fanMedalMinLevel"
                style="width: 200px"
              >
                <NInputGroupLabel> 最低等级 </NInputGroupLabel>
                <NInputNumber
                  v-model:value="updateSongModel.options.fanMedalMinLevel"
                  min="0"
                />
              </NInputGroup>
            </NSpace>
          </template>
        </NSpace>
      </NFormItem>
      <NFormItem
        path="url"
        label="链接"
      >
        <NInput
          v-model:value="updateSongModel.url"
          placeholder="可选, 后缀为mp3、wav、ogg时将会尝试播放, 否则会在新页面打开"
          :disabled="updateSongModel.from != SongFrom.Custom"
        />
      </NFormItem>
    </NForm>
    <NDivider style="margin: 10px" />
    <NButton
      type="success"
      :loading="isLoading"
      @click="updateSong"
    >
      更新
    </NButton>
  </NModal>
  <NModal
    v-model:show="showBatchModal"
    preset="card"
    :title="`批量编辑 | 已选择: ${selectedColumn.length}`"
    style="max-width: 600px"
  >
    <NTabs>
      <NTabPane
        name="delete"
        tab="删除"
      >
        <NPopconfirm @positive-click="delBatchSong">
          <template #trigger>
            <NButton type="error">
              批量删除
            </NButton>
          </template>
          <span> 确定删除 {{ selectedColumn.length }} 首曲目吗？ </span>
        </NPopconfirm>
      </NTabPane>
      <NTabPane
        name="author"
        tab="作者"
      >
        <NSelect
          v-model:value="batchUpdate_Author"
          filterable
          multiple
          tag
          placeholder="输入后按回车新增"
          :options="authorsOptions"
        />
        <NDivider />
        <NButton
          type="success"
          :loading="isLoading"
          @click="batchUpdateAuthor"
        >
          更新
        </NButton>
      </NTabPane>
      <NTabPane
        name="tag"
        tab="标签"
      >
        <NSelect
          v-model:value="batchUpdate_Tag"
          filterable
          multiple
          clearable
          tag
          placeholder="可选，按回车确认"
          :options="tagsSelectOption"
        />
        <NDivider />
        <NButton
          type="success"
          :loading="isLoading"
          @click="batchUpdateTag"
        >
          更新
        </NButton>
      </NTabPane>
      <NTabPane
        name="language"
        tab="语言"
      >
        <NSelect
          v-model:value="batchUpdate_Language"
          filterable
          multiple
          clearable
          tag
          placeholder="可选，输入后按回车新增"
          :options="languageSelectOption"
        />
        <NDivider />
        <NButton
          type="success"
          :loading="isLoading"
          @click="batchUpdateLanguage"
        >
          更新
        </NButton>
      </NTabPane>
      <NTabPane
        name="option"
        tab="点歌选项"
      >
        <NSpace vertical>
          <NCheckbox
            :checked="batchUpdate_Option != undefined"
            @update:checked="(checked: boolean) => {
              batchUpdate_Option = checked
                ? ({
                  needJianzhang: false,
                  needTidu: false,
                  needZongdu: false,
                } as SongRequestOption)
                : undefined
            }
            "
          >
            是否启用
          </NCheckbox>
          <template v-if="batchUpdate_Option != undefined">
            <NSpace>
              <NCheckbox v-model:checked="batchUpdate_Option.needJianzhang">
                需要舰长
              </NCheckbox>
              <NCheckbox v-model:checked="batchUpdate_Option.needTidu">
                需要提督
              </NCheckbox>
              <NCheckbox v-model:checked="batchUpdate_Option.needZongdu">
                需要总督
              </NCheckbox>
            </NSpace>
            <NSpace align="center">
              <NCheckbox
                :checked="batchUpdate_Option.scMinPrice != undefined"
                @update:checked="(checked: boolean) => {
                  if (batchUpdate_Option) batchUpdate_Option.scMinPrice = checked ? 30 : undefined
                }
                "
              >
                需要SC
              </NCheckbox>
              <NInputGroup
                v-if="batchUpdate_Option?.scMinPrice"
                style="width: 200px"
              >
                <NInputGroupLabel> SC最低价格 </NInputGroupLabel>
                <NInputNumber
                  v-model:value="batchUpdate_Option.scMinPrice"
                  min="30"
                />
              </NInputGroup>
            </NSpace>
            <NSpace align="center">
              <NCheckbox
                :checked="batchUpdate_Option.fanMedalMinLevel != undefined"
                @update:checked="(checked: boolean) => {
                  if (batchUpdate_Option) batchUpdate_Option.fanMedalMinLevel = checked ? 5 : undefined
                }
                "
              >
                需要粉丝牌
                <NTooltip>
                  <template #trigger>
                    <NIcon :component="Info24Filled" />
                  </template>
                  这个即使不开也会遵循全局点歌设置的粉丝牌等级
                </NTooltip>
              </NCheckbox>
              <NInputGroup
                v-if="batchUpdate_Option?.fanMedalMinLevel"
                style="width: 200px"
              >
                <NInputGroupLabel> 最低等级 </NInputGroupLabel>
                <NInputNumber
                  v-model:value="batchUpdate_Option.fanMedalMinLevel"
                  min="0"
                />
              </NInputGroup>
            </NSpace>
          </template>
        </NSpace>
        <NDivider />
        <NButton
          type="success"
          :loading="isLoading"
          @click="batchUpdateOption"
        >
          更新
        </NButton>
      </NTabPane>
    </NTabs>
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
