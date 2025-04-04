<script setup lang="ts">
import { copyToClipboard, objectsToCSV } from '@/Utils'
import { DisableFunction, EnableFunction, useAccount } from '@/api/account'
import { FunctionTypes, SongFrom, SongLanguage, SongRequestOption, SongsInfo } from '@/api/api-models'
import { QueryGetAPI, QueryPostAPI } from '@/api/query'
import SongList from '@/components/SongList.vue'
import { CN_HOST, CURRENT_HOST, FETCH_API, SONG_API_URL } from '@/data/constants'
import { Info24Filled } from '@vicons/fluent'
import { ArchiveOutline } from '@vicons/ionicons5'
import { useStorage } from '@vueuse/core'
import { format } from 'date-fns'
// @ts-ignore
import { saveAs } from 'file-saver'
import { List } from 'linqts'
import {
  FormInst,
  FormRules,
  NAlert,
  NButton,
  NCheckbox,
  NDivider,
  NFlex,
  NForm,
  NFormItem,
  NIcon,
  NInput,
  NInputGroup,
  NInputGroupLabel,
  NInputNumber,
  NModal,
  NP,
  NPagination,
  NScrollbar,
  NSelect,
  NSpace,
  NSpin,
  NSwitch,
  NTabPane,
  NTable,
  NTabs,
  NTag,
  NText,
  NTooltip,
  NTransfer,
  NUpload,
  NUploadDragger,
  UploadFileInfo,
  useMessage,
} from 'naive-ui'
import { Option } from 'naive-ui/es/transfer/src/interface'
import { computed, onMounted, ref } from 'vue'
import * as XLSX from 'xlsx'

const message = useMessage()
const accountInfo = useAccount()

const showModal = ref(false)
const neteaseIdInput = ref()
const fivesingSearchInput = ref()
const isModalLoading = ref(false)

const useCNUrl = useStorage('Settings.UseCNUrl', false)

const onlyResetNameOnAdded = ref(true)

const neteaseSongListId = computed(() => {
  try {
    const url = new URL(neteaseIdInput.value)
    console.log(url)
    if (url.host == 'music.163.com') {
      const regex = /id=(\d+)/

      // 使用exec方法在链接中查找匹配项
      const match = regex.exec(neteaseIdInput.value)

      // 如果找到了匹配项，那么match[1]就是分组1的值，也就是id的值
      if (match) {
        return Number(match[1])
      }
    }
  } catch (err) { }
  try {
    return Number(neteaseIdInput.value)
  } catch { }
  return null
})

const songs = ref<SongsInfo[]>([])
const neteaseSongs = ref<SongsInfo[]>([])
const neteaseSongsOptions = ref<Option[]>([])
const selectedNeteaseSongs = ref<string[]>([])

const fivesingResults = ref<SongsInfo[]>([])
const fivesingTotalPageCount = ref(1)
const fivesingCurrentPage = ref(1)

const isGettingFivesingSongPlayUrl = ref(0)
const showModalRenderKey = ref(0)

const authors = computed(() => {
  return new List(songs.value)
    .SelectMany((s) => new List(s?.author))
    .Distinct()
    .ToArray()
    .map((t) => ({
      label: t,
      value: t,
    }))
})
const tags = computed(() => {
  return new List(songs.value)
    .SelectMany((s) => new List(s?.tags))
    .Distinct()
    .ToArray()
    .map((t) => ({
      label: t,
      value: t,
    }))
})

const formRef = ref<FormInst | null>(null)
const addSongModel = ref<SongsInfo>({} as SongsInfo)
const addSongRules: FormRules = {
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
  songs.value.forEach((s) => {
    if (s.language) {
      s.language.forEach((l) => languages.add(l))
    }
  })
  return [...languages].map((t) => ({
    label: t,
    value: t,
  }))
})
const uploadFiles = ref<UploadFileInfo[]>([])
const uploadSongsFromFile = ref<SongsInfo[]>([])
const uploadSongsOptions = computed(() => {
  return uploadSongsFromFile.value.map((s) => ({
    label: `${s.name} - ${!s.author ? '未知' : s.author.join('/')}`,
    value: s.name,
    disabled: songs.value.findIndex((exist) => exist.name == s.name) > -1,
  }))
})
const selecteduploadSongs = ref<string[]>([])

async function addCustomSong() {
  if (songs.value.findIndex((s) => s.name == addSongModel.value.name) > -1) {
    message.error('已存在相同名称的歌曲')
    return
  }
  isModalLoading.value = true
  formRef.value
    ?.validate()
    .then(async () => {
      await addSongs([addSongModel.value], SongFrom.Custom)
        .then((data) => {
          if (data.code == 200) {
            if (data.data.length == 1) {
              message.success('成功添加歌曲: ' + addSongModel.value.name)
              songs.value.push(data.data[0])
              resetAddingSong(onlyResetNameOnAdded.value)
            } else {
              message.error('未能添加歌曲, 已存在相同名称的曲目')
            }
          } else {
            message.error('添加失败: ' + data.message)
          }
        })
        .catch((err) => {
          message.error('添加失败')
        })
    })
    .finally(() => {
      isModalLoading.value = false
    })
}
async function addNeteaseSongs() {
  isModalLoading.value = true
  const selected = neteaseSongs.value.filter((s) => selectedNeteaseSongs.value.find((select) => s.key == select))
  await addSongs(selected, SongFrom.Netease)
    .then((data) => {
      if (data.code == 200) {
        message.success(`已添加 ${data.data.length} 首歌曲`)
        songs.value.push(...data.data)
        neteaseSongsOptions.value = neteaseSongs.value.map((s) => ({
          label: `${s.name} - ${s.author.join('/')}`,
          value: s.key,
          disabled:
            songs.value.findIndex((exist) => exist.id == s.id) > -1 ||
            data.data.findIndex((add) => add.id == s.id) > -1,
        }))
      } else {
        message.error('添加失败: ' + data.message)
      }
    })
    .catch((err) => {
      message.error('添加失败')
    })
    .finally(() => {
      isModalLoading.value = false
    })
}
async function addFingsingSongs(song: SongsInfo) {
  isModalLoading.value = true
  if (!song.url) {
    try {
      const url = await getFivesingSongUrl(song)
      song.url = url
    } catch (err) {
      isModalLoading.value = false
      message.error('未能获取到歌曲链接, 将留空')
    }
  }
  await addSongs([song], SongFrom.FiveSing)
    .then((data) => {
      if (data.code == 200) {
        message.success(`已添加歌曲`)
        addSongModel.value = {} as SongsInfo
        songs.value.push(...data.data)
      } else {
        message.error('添加失败: ' + data.message)
      }
    })
    .catch((err) => {
      message.error('添加失败')
      console.error(err)
    })
    .finally(() => {
      isModalLoading.value = false
    })
}
async function addUploadFileSong() {
  if (selecteduploadSongs.value.length == 0) {
    message.error('请选择歌曲')
    return
  }
  isModalLoading.value = true
  await addSongs(
    uploadSongsFromFile.value.filter((s) => selecteduploadSongs.value.find((select) => s.name == select)),
    SongFrom.Custom,
  )
    .then((data) => {
      if (data.code == 200) {
        message.success(`已添加 ${data.data.length} 首歌曲`)
        songs.value.push(...data.data)
      } else {
        message.error('添加失败: ' + data.message)
      }
    })
    .catch((err) => {
      message.error('添加失败: ' + err)
      console.error(err)
    })
    .finally(() => {
      isModalLoading.value = false
    })
}
async function addSongs(songsShoudAdd: SongsInfo[], from: SongFrom) {
  return QueryPostAPI<SongsInfo[]>(
    SONG_API_URL + 'add',
    songsShoudAdd.map((s) => ({
      Name: s.name,
      Id: from == SongFrom.Custom ? -1 : s.id,
      From: from,
      Author: s.author,
      Url: s.url,
      Description: s.description,
      Cover: s.cover,
      Tags: s.tags,
      Language: s.language,
      TranslateName: s.translateName,
      Options: s.options,
    })),
  )
}

async function getNeteaseSongList() {
  isModalLoading.value = true
  await QueryGetAPI<SongsInfo[]>(SONG_API_URL + 'get-netease-list', {
    id: neteaseSongListId.value,
  })
    .then((data) => {
      if (data.code == 200) {
        neteaseSongs.value = data.data
        neteaseSongsOptions.value = data.data.map((s) => ({
          label: `${s.name} - ${!s.author ? '未知' : s.author.join('/')}`,
          value: s.key,
          disabled: songs.value.findIndex((exist) => exist.id == s.id) > -1,
        }))
        message.success(
          `成功获取歌曲信息, 共 ${data.data.length} 条, 歌单中已存在 ${neteaseSongsOptions.value.filter((s) => s.disabled).length} 首`,
        )
      } else {
        message.error('获取歌单失败: ' + data.message)
      }
    })
    .catch((err) => {
      message.error('获取歌单失败: ' + err)
    })
    .finally(() => {
      isModalLoading.value = false
    })
}
async function getFivesingSearchList(isRestart = false) {
  isModalLoading.value = true
  await fetch(
    FETCH_API +
    `http://search.5sing.kugou.com/home/json?keyword=${fivesingSearchInput.value}&sort=1&page=${fivesingCurrentPage.value}&filter=3`,
  )
    .then(async (data) => {
      const json = await data.json()
      if (json.list.length == 0) {
        message.error('搜索结果为空')
      }
      if (isRestart) {
        fivesingCurrentPage.value = 1
      }
      fivesingResults.value = []
      //fivesingResultsOptions.value = []
      json.list.forEach((song: any) => {
        const songInfo = {
          id: song.songId,
          name: extractTextFromHtml(song.songName),
          author: [song.originSinger, song.singer],
          //url: `http://service.5sing.kugou.com/song/getsongurl?songid=${song.songId}&songtype=bz&from=web&version=6.6.72`,
        } as SongsInfo
        fivesingResults.value.push(songInfo)
      })
      fivesingTotalPageCount.value = json.pageInfo.totalPages
      message.success(`成功获取搜索信息, 共 ${json.pageInfo.totalCount} 条, 当前第 ${fivesingCurrentPage.value} 页`)
    })
    .catch((err) => {
      message.error('获取歌单失败: ' + err)
    })
    .finally(() => {
      isModalLoading.value = false
    })
}
function extractTextFromHtml(html: string): string {
  const regex = /<em class="keyword">(.*?)<\/em>/
  const match = regex.exec(html)
  if (match) {
    return match[1]
  } else {
    return html
  }
}
async function playFivesingSong(song: SongsInfo) {
  isGettingFivesingSongPlayUrl.value = song.id
  await getFivesingSongUrl(song)
    .then((data) => {
      song.url = data
    })
    .catch((err) => {
      message.error('获取歌曲链接失败: ' + err)
    })
    .finally(() => {
      isGettingFivesingSongPlayUrl.value = 0
    })
}
async function getFivesingSongUrl(song: SongsInfo): Promise<string> {
  const data = await fetch(
    FETCH_API + `http://service.5sing.kugou.com/song/getsongurl?songid=${song.id}&songtype=bz&from=web&version=6.6.72`,
  )
  const result = await data.text()
  //忽略掉result的第一个字符和最后一个字符, 并反序列化
  const json = JSON.parse(result.substring(1, result.length - 1))
  if (json.code == 0) {
    return json.data.lqurl
  }
  return ''
}
const isLoading = ref(true)
async function getSongs() {
  isLoading.value = true
  await QueryGetAPI<any>(SONG_API_URL + 'get', {
    id: accountInfo.value?.id,
  })
    .then((data) => {
      if (data.code == 200) {
        songs.value = data.data
      }
    })
    .catch((err) => {
      message.error('获取歌曲失败: ' + err)
    })
    .finally(() => {
      isLoading.value = false
    })
}
function exportData() {
  const from = (f: SongFrom) => {
    switch (f) {
      case SongFrom.Custom:
        return '手动添加'
      case SongFrom.Netease:
        return '网易云'
      case SongFrom.FiveSing:
        return '5sing'
    }
  }
  const text = objectsToCSV(
    songs.value.map((s) => ({
      id: s.id,
      名称: s.name,
      翻译名称: s.translateName,
      作者: s.author?.join('/') ?? '未知',
      创建于: format(s.createTime, 'yyyy-MM-dd HH:mm:ss'),
      更新于: format(s.updateTime, 'yyyy-MM-dd HH:mm:ss'),
      描述: s.description,
      来自: from(s.from),
      语言: s.language.join(','),
      标签: s.tags?.join(',') ?? '',
      链接: s.url,
    })),
  )
  const BOM = new Uint8Array([0xef, 0xbb, 0xbf])
  const utf8encoder = new TextEncoder()
  const utf8array = utf8encoder.encode(text)
  saveAs(
    new Blob([BOM, utf8array], { type: 'text/csv;charset=utf-8;' }),
    `歌单_${format(Date.now(), 'yyyy-MM-dd HH:mm:ss')}_${accountInfo.value?.name}_.csv`,
  )
}
function parseExcelFile() {
  if (uploadFiles.value.length == 0) {
    message.error('请选择文件')
    return
  }
  const file = uploadFiles.value[0]
  if (!file.file) {
    message.error('无效的文件')
    return
  }
  const reader = new FileReader()
  reader.readAsArrayBuffer(file.file)
  reader.onload = (e) => {
    const data = new Uint8Array(e?.target?.result as ArrayBuffer)
    const workbook = XLSX.read(data, { type: 'array' })
    const sheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[sheetName]
    const json = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null })
    if (json.length == 0) {
      message.error('文件为空')
    }
    const headers = json[0] as any
    const rows = json.slice(1) as any[]
    const songs = rows.map((row) => {
      const song = {} as SongsInfo
      for (let i = 0; i < headers.length; i++) {
        const key = headers[i] as string
        const value = row[i] as string
        switch (key.toLowerCase().trim()) {
          case 'id':
          case 'name':
          case '名称':
          case '曲名':
          case '歌名':
            if (!value) {
              console.log('忽略空歌名: ' + row)
              continue
            }
            song.name = value
            break
          case 'author':
          case 'singer':
          case '作者':
          case '歌手':
            song.author = value
              ?.replace('／', '/')
              .replace('，', ',')
              .split(/\/|,/)
              .map((a: string) => a.trim())
              .filter((value: string, index: number, self: string[]) => self.indexOf(value) === index)
            break
          case 'description':
          case 'desc':
          case '说明':
          case '描述':
            song.description = value
            break
          case 'url':
          case '链接':
            song.url = value
            break
          case 'language':
          case '语言':
            song.language = value
              ?.replace('／', '/')
              .replace('，', ',')
              .split(/\/|,/)
              .map((a: string) => a.trim())
              .filter((value: string, index: number, self: string[]) => self.indexOf(value) === index)
            break
          case 'tags':
          case 'tag':
          case '标签':
            song.tags = value
              ?.replace('／', '/')
              .replace('，', ',')
              .split(/\/|,/)
              .map((t: string) => t.trim())
              .filter((value: string, index: number, self: string[]) => self.indexOf(value) === index)
            break
        }
      }
      return song
    })
    uploadSongsFromFile.value = songs.filter((s) => s.name)
    console.log(uploadSongsFromFile.value)
    message.success('解析完成, 共获取 ' + uploadSongsFromFile.value.length + ' 首曲目')
  }
}
function beforeUpload(data: { file: UploadFileInfo; fileList: UploadFileInfo[] }) {
  //只能选择xlsx和xls和csv
  if (data.file.name.endsWith('.xlsx') || data.file.name.endsWith('.xls') || data.file.name.endsWith('.csv')) {
    return true
  }
  message.error('只能选择xlsx和xls和csv')
  return false
}
async function setFunctionEnable(enable: boolean) {
  let success = false
  if (enable) {
    success = await EnableFunction(FunctionTypes.SongList)
  } else {
    success = await DisableFunction(FunctionTypes.SongList)
  }
  if (success) {
    message.success('已' + (enable ? '启用' : '禁用'))
  } else {
    message.error('无法' + (enable ? '启用' : '禁用'))
  }
}
function resetAddingSong(onlyName = false) {
  if (onlyName) {
    addSongModel.value.name = ''
    addSongModel.value.description = ''
  }
  addSongModel.value = {} as SongsInfo
  showModalRenderKey.value++
  message.success('已重置')
}

onMounted(async () => {
  await getSongs()
})
</script>

<template>
  <NSpace align="center">
    <NAlert
      :type="accountInfo.settings.enableFunctions.includes(FunctionTypes.SongList) ? 'success' : 'warning'"
      style="max-width: 200px"
    >
      启用歌单
      <NDivider vertical />
      <NSwitch
        :value="accountInfo?.settings.enableFunctions.includes(FunctionTypes.SongList)"
        @update:value="setFunctionEnable"
      />
    </NAlert>
    <NButton
      type="primary"
      @click="showModal = true"
    >
      添加歌曲
    </NButton>
    <NButton
    secondary
    type="primary"
      @click="$router.push({ name: 'manage-index', query: { tab: 'setting', setting: 'template', template: 'songlist' } })"
    >
      修改展示模板
    </NButton>
    <NButton
      type="primary"
      secondary
      @click="exportData"
    >
      导出为 CSV
    </NButton>
    <NButton
      secondary
      @click="$router.push({ name: 'manage-liveRequest' })"
    >
      前往点播管理页
    </NButton>
    <NButton
      secondary
      @click="$router.push({ name: 'user-songList', params: { id: accountInfo?.name } })"
    >
      前往歌单展示页
    </NButton>
    <NButton
      :loading="isLoading"
      @click="() => {
        getSongs()
        message.success('完成')
      }
      "
    >
      刷新
    </NButton>
  </NSpace>
  <NDivider
    style="margin: 16px 0 16px 0"
    title-placement="left"
  >
    歌单展示页链接
  </NDivider>
  <NFlex align="center">
    <NInputGroup style="max-width: 400px;">
      <NInput
        :value="`${useCNUrl ? CN_HOST : CURRENT_HOST}@${accountInfo.name}/song-list`"
        readonly
      />
      <NButton
        secondary
        @click="copyToClipboard(`${useCNUrl ? CN_HOST : CURRENT_HOST}@${accountInfo.name}/song-list`)"
      >
        复制
      </NButton>
    </NInputGroup>
    <NCheckbox v-model:checked="useCNUrl">
      使用国内镜像(访问更快)
    </NCheckbox>
  </NFlex>
  <NDivider style="margin: 16px 0 16px 0" />
  <NModal
    :key="showModalRenderKey"
    v-model:show="showModal"
    style="max-width: 1000px"
    preset="card"
  >
    <template #header>
      添加歌曲
    </template>
    <NScrollbar style="max-height: 80vh">
      <NSpin :show="isModalLoading">
        <NTabs
          default-value="custom"
          animated
        >
          <NTabPane
            name="custom"
            tab="手动录入"
          >
            <NForm
              ref="formRef"
              :rules="addSongRules"
              :model="addSongModel"
            >
              <NFormItem
                path="name"
                label="名称"
              >
                <NInput
                  v-model:value="addSongModel.name"
                  autosize
                  style="min-width: 200px"
                  placeholder="就是歌曲名称"
                  :status="songs.findIndex((s) => s.name == addSongModel.name) > -1 ? 'error' : 'success'"
                />
              </NFormItem>
              <NFormItem
                path="author"
                label="作者 (可多选)"
              >
                <NSelect
                  v-model:value="addSongModel.author"
                  :options="authors"
                  filterable
                  multiple
                  tag
                  placeholder="输入后按回车新增"
                />
              </NFormItem>
              <NFormItem
                path="description"
                label="备注"
              >
                <NInput
                  v-model:value="addSongModel.description"
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
                label="语言 (可多选)"
              >
                <NSelect
                  v-model:value="addSongModel.language"
                  filterable
                  multiple
                  clearable
                  tag
                  placeholder="可选，输入后按回车新增"
                  :options="songSelectOption"
                />
              </NFormItem>
              <NFormItem
                path="tags"
                label="标签 (可多选)"
              >
                <NSelect
                  v-model:value="addSongModel.tags"
                  filterable
                  multiple
                  clearable
                  tag
                  placeholder="可选，输入后按回车新增"
                  :options="tags"
                />
              </NFormItem>
              <NFormItem
                path="url"
                label="链接"
              >
                <NInput
                  v-model:value="addSongModel.url"
                  placeholder="可选, 后缀为mp3、wav、ogg时将会尝试播放, 否则会在新页面打开"
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
                    :checked="addSongModel.options != undefined"
                    @update:checked="(checked: boolean) => {
                      addSongModel.options = checked
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
                  <template v-if="addSongModel.options != undefined">
                    <NSpace>
                      <NCheckbox v-model:checked="addSongModel.options.needJianzhang">
                        需要舰长
                      </NCheckbox>
                      <NCheckbox v-model:checked="addSongModel.options.needTidu">
                        需要提督
                      </NCheckbox>
                      <NCheckbox v-model:checked="addSongModel.options.needZongdu">
                        需要总督
                      </NCheckbox>
                    </NSpace>
                    <NSpace align="center">
                      <NCheckbox
                        :checked="addSongModel.options.scMinPrice != undefined"
                        @update:checked="(checked: boolean) => {
                          if (addSongModel.options) addSongModel.options.scMinPrice = checked ? 30 : undefined
                        }
                        "
                      >
                        需要SC
                      </NCheckbox>
                      <NInputGroup
                        v-if="addSongModel.options?.scMinPrice"
                        style="width: 200px"
                      >
                        <NInputGroupLabel> SC最低价格 </NInputGroupLabel>
                        <NInputNumber
                          v-model:value="addSongModel.options.scMinPrice"
                          min="30"
                        />
                      </NInputGroup>
                    </NSpace>
                    <NSpace align="center">
                      <NCheckbox
                        :checked="addSongModel.options.fanMedalMinLevel != undefined"
                        @update:checked="(checked: boolean) => {
                          if (addSongModel.options) addSongModel.options.fanMedalMinLevel = checked ? 5 : undefined
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
                        v-if="addSongModel.options?.fanMedalMinLevel"
                        style="width: 200px"
                      >
                        <NInputGroupLabel> 最低等级 </NInputGroupLabel>
                        <NInputNumber
                          v-model:value="addSongModel.options.fanMedalMinLevel"
                          min="0"
                        />
                      </NInputGroup>
                    </NSpace>
                  </template>
                </NSpace>
              </NFormItem>
            </NForm>
            <NFlex align="center">
              <NButton
                type="primary"
                @click="addCustomSong"
              >
                添加
              </NButton>
              <NButton
                type="warning"
                @click="resetAddingSong()"
              >
                还原
              </NButton>
              <NButton
                type="warning"
                @click="resetAddingSong(true)"
              >
                还原(仅歌名和备注)
              </NButton>
              <NCheckbox v-model:checked="onlyResetNameOnAdded">
                添加完成时仅重置歌名和备注
              </NCheckbox>
            </NFlex>
          </NTabPane>
          <NTabPane
            name="netease"
            tab="从网易云歌单导入"
          >
            <NInput
              v-model:value="neteaseIdInput"
              clearable
              style="width: 100%"
              autosize
              :status="neteaseSongListId ? 'success' : 'error'"
              placeholder="直接输入歌单Id或者网页链接"
            >
              <template #suffix>
                <NTag
                  v-if="neteaseSongListId"
                  type="success"
                  size="small"
                >
                  歌单Id: {{ neteaseSongListId }}
                </NTag>
              </template>
            </NInput>
            <NDivider style="margin: 10px" />
            <NButton
              type="primary"
              :disabled="!neteaseSongListId"
              @click="getNeteaseSongList"
            >
              获取
            </NButton>
            <template v-if="neteaseSongsOptions.length > 0">
              <NDivider style="margin: 10px" />
              <NTransfer
                ref="transfer"
                v-model:value="selectedNeteaseSongs"
                style="height: 500px"
                :options="neteaseSongsOptions"
                source-filterable
              />
              <NDivider style="margin: 10px" />
              <NButton
                type="primary"
                @click="addNeteaseSongs"
              >
                添加到歌单 | {{ selectedNeteaseSongs.length }} 首
              </NButton>
            </template>
          </NTabPane>
          <NTabPane
            name="5sing"
            tab="从5sing搜索"
          >
            <NInput
              v-model:value="fivesingSearchInput"
              clearable
              style="width: 100%"
              autosize
              placeholder="输入要搜索的歌名"
              maxlength="15"
            />
            <NDivider style="margin: 10px" />
            <NButton
              type="primary"
              :disabled="!fivesingSearchInput"
              @click="getFivesingSearchList(true)"
            >
              搜索
            </NButton>
            <template v-if="fivesingResults.length > 0">
              <NDivider style="margin: 10px" />
              <div style="overflow-x: auto">
                <NTable
                  size="small"
                  style="overflow-x: auto"
                >
                  <thead>
                    <tr>
                      <th>名称</th>
                      <th>作者</th>
                      <th>试听</th>
                      <th>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr
                      v-for="song in fivesingResults"
                      :key="song.id"
                    >
                      <td>{{ song.name }}</td>
                      <td>
                        <NSpace>
                          <NTag
                            v-for="author in song.author"
                            :key="author"
                            size="small"
                          >
                            {{ author }}
                          </NTag>
                        </NSpace>
                      </td>
                      <td style="display: flex; justify-content: flex-end">
                        <!-- 在这里播放song.url链接中的音频 -->
                        <NButton
                          v-if="!song.url"
                          size="small"
                          :loading="isGettingFivesingSongPlayUrl == song.id"
                          @click="playFivesingSong(song)"
                        >
                          试听
                        </NButton>
                        <audio
                          v-else
                          controls
                          style="max-height: 30px"
                        >
                          <source :src="song.url">
                        </audio>
                      </td>
                      <td>
                        <NButton
                          size="small"
                          color="green"
                          :disabled="songs.findIndex((s) => s.from == SongFrom.FiveSing && s.id == song.id) > -1"
                          @click="addFingsingSongs(song)"
                        >
                          添加
                        </NButton>
                      </td>
                    </tr>
                  </tbody>
                </NTable>
              </div>
              <br>
              <NPagination
                v-model:page="fivesingCurrentPage"
                :page-count="fivesingTotalPageCount"
                simple
                @update-page="getFivesingSearchList(false)"
              />
            </template>
          </NTabPane>
          <NTabPane
            name="file"
            tab="从文件导入"
          >
            <NAlert type="info">
              Excel 文件格式详见:
              <NButton
                type="info"
                tag="a"
                href="https://www.wolai.com/hZWizjCnAdc6hDdntuWgcU"
                target="_blank"
                size="tiny"
              >
                此页面
              </NButton>
            </NAlert>
            <NUpload
              v-model:file-list="uploadFiles"
              :default-upload="false"
              :max="1"
              directory-dnd
              @before-upload="beforeUpload"
            >
              <NUploadDragger>
                <div style="margin-bottom: 12px">
                  <NIcon
                    size="48"
                    :depth="3"
                  >
                    <ArchiveOutline />
                  </NIcon>
                </div>
                <NText style="font-size: 16px">
                  点击或者拖动文件到该区域来上传
                </NText>
                <NP
                  depth="3"
                  style="margin: 8px 0 0 0"
                >
                  仅限 Excel 文件(.xlsx和.xls) 以及 csv 文件
                </NP>
              </NUploadDragger>
            </NUpload>
            <NButton
              type="primary"
              @click="parseExcelFile"
            >
              解析
            </NButton>
            <template v-if="uploadSongsOptions.length > 0">
              <NDivider style="margin: 10px" />
              <NButton
                type="primary"
                @click="addUploadFileSong"
              >
                添加到歌单 | {{ selecteduploadSongs.length }} 首
              </NButton>
              <NDivider style="margin: 10px" />
              <NTransfer
                v-model:value="selecteduploadSongs"
                style="height: 400px"
                :options="uploadSongsOptions"
                source-filterable
              />
            </template>
          </NTabPane>
          <NTabPane
            name="directory"
            tab="从文件夹读取"
          >
            开发中...
          </NTabPane>
        </NTabs>
      </NSpin>
    </NScrollbar>
  </NModal>
  <NSpin
    v-if="isLoading"
    show
  />
  <SongList
    v-else
    :songs="songs"
    is-self
  />
  <NDivider />
</template>
