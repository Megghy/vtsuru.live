<script setup lang="ts">
import type {
  FormInst,
  FormRules,
  UploadFileInfo,
} from 'naive-ui'
import type { Option } from 'naive-ui/es/transfer/src/interface'
import type { SongRequestOption, SongsInfo } from '@/api/api-models'
import { Info24Filled } from '@vicons/fluent'
import { ArchiveOutline } from '@vicons/ionicons5'
import { useStorage } from '@vueuse/core'
import { format } from 'date-fns'
// @ts-ignore
import { saveAs } from 'file-saver'
import { List } from 'linqts'
import {
  NAlert,
  NButton,
  NCheckbox,
  NCollapse,
  NCollapseItem,
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
  NTable,
  NTabPane,
  NTabs,
  NTag,
  NText,
  NTooltip,
  NTransfer,
  NUpload,
  NUploadDragger,
  useMessage,
} from 'naive-ui'
import { computed, onMounted, ref } from 'vue'
import * as XLSX from 'xlsx'
import { useAccount } from '@/api/account'
import { FunctionTypes, SongFrom } from '@/api/api-models'
import { QueryGetAPI, QueryPostAPI } from '@/api/query'
import ManagePageHeader from '@/components/manage/ManagePageHeader.vue'
import SongList from '@/components/SongList.vue'
import { CURRENT_HOST, FETCH_API, SONG_API_URL } from '@/data/constants'
import { copyToClipboard, objectsToCSV } from '@/Utils'

const message = useMessage()
const accountInfo = useAccount()

// 全局状态变量
const isLoading = ref(true)
const showModal = ref(false)
const showModalRenderKey = ref(0)
const onlyResetNameOnAdded = ref(true)

// 文件导入的列头映射配置
const useCustomColumnMapping = ref(false)
const columnMappings = useStorage('song-list-column-mappings', {
  name: '名称,歌名,标题,title,name',
  translateName: '翻译名称,译名,translated,translate',
  author: '作者,歌手,演唱,singer,author,artist',
  description: '描述,备注,说明,description,note,remark',
  url: '链接,地址,url,link',
  language: '语言,language',
  tags: '标签,类别,分类,tag,tags,category',
})

// 歌曲列表数据
const songs = ref<SongsInfo[]>([])

// 表单相关
const formRef = ref<FormInst | null>(null)
const addSongModel = ref<SongsInfo>({} as SongsInfo)
const addSongRules: FormRules = {
  name: [{ required: true, message: '请输入歌曲名称' }],
  password: [{ required: true, message: '请输入密码' }],
}

// 网易云相关
const neteaseIdInput = ref()
const neteaseSongs = ref<SongsInfo[]>([])
const neteaseSongsOptions = ref<Option[]>([])
const selectedNeteaseSongs = ref<string[]>([])

// 5sing相关
const fivesingSearchInput = ref()
const fivesingResults = ref<SongsInfo[]>([])
const fivesingTotalPageCount = ref(1)
const fivesingCurrentPage = ref(1)
const isGettingFivesingSongPlayUrl = ref(0)

// 文件上传相关
const uploadFiles = ref<UploadFileInfo[]>([])
const uploadSongsFromFile = ref<SongsInfo[]>([])

// 文件夹读取相关
const folderSongs = ref<SongsInfo[]>([])
const folderSongsOptions = ref<Option[]>([])
const selectedFolderSongs = ref<string[]>([])
const isScanningFolder = ref(false)

// 模态框加载状态
const isModalLoading = ref(false)

// 计算属性
const neteaseSongListId = computed(() => {
  try {
    // 尝试解析URL
    const url = new URL(neteaseIdInput.value)
    if (url.host === 'music.163.com') {
      const regex = /id=(\d+)/
      const match = regex.exec(neteaseIdInput.value)
      if (match) {
        return Number(match[1])
      }
    }
  } catch (err) { }

  // 如果不是URL，尝试直接解析为数字
  try {
    return Number(neteaseIdInput.value)
  } catch { }

  return null
})

// 从歌曲列表中提取所有作者
const authors = computed(() => {
  return new List(songs.value)
    .SelectMany(s => new List(s?.author || []))
    .Distinct()
    .ToArray()
    .map(t => ({ label: t, value: t }))
})

// 从歌曲列表中提取所有标签
const tags = computed(() => {
  return new List(songs.value)
    .SelectMany(s => new List(s?.tags || []))
    .Distinct()
    .ToArray()
    .map(t => ({ label: t, value: t }))
})

// 语言选项列表
const songSelectOption = [
  { label: '中文', value: '中文' },
  { label: '日语', value: '日语' },
  { label: '英语', value: '英语' },
  { label: '韩语', value: '韩语' },
  { label: '法语', value: '法语' },
  { label: '西语', value: '西语' },
  { label: '其他', value: '其他' },
]

// 从已有歌曲中提取所有语言
const languageSelectOption = computed(() => {
  const languages = new Set<string>(songSelectOption.map(s => s.label))
  songs.value.forEach((s) => {
    if (s.language) {
      s.language.forEach(l => languages.add(l))
    }
  })
  return [...languages].map(t => ({ label: t, value: t }))
})

// 从上传文件中读取的歌曲列表选项
const uploadSongsOptions = computed(() => {
  return uploadSongsFromFile.value.map(s => ({
    label: `${s.name} - ${!s.author ? '未知' : s.author.join('/')}`,
    value: s.name,
    disabled: songs.value.findIndex(exist => exist.name == s.name) > -1,
  }))
})

const selecteduploadSongs = ref<string[]>([])

// 支持的音频文件扩展名
const AUDIO_EXTENSIONS = ['.mp3', '.wav', '.ogg', '.flac', '.m4a', '.aac', '.wma', '.ape']

/**
 * 选择文件夹并扫描音频文件
 */
async function selectFolder() {
  try {
    // 检查浏览器是否支持 File System Access API
    if (!('showDirectoryPicker' in window)) {
      message.error('您的浏览器不支持文件夹选择功能，请使用最新版本的 Chrome、Edge 或其他现代浏览器')
      return
    }

    isScanningFolder.value = true
    folderSongs.value = []

    // @ts-ignore
    const directoryHandle = await window.showDirectoryPicker({
      mode: 'read',
    })

    message.info('正在扫描文件夹...')

    const audioFiles: { name: string, file: File, path: string }[] = []

    // 递归扫描文件夹
    await scanDirectory(directoryHandle, audioFiles, '')

    if (audioFiles.length === 0) {
      message.warning('未在文件夹中找到音频文件')
      isScanningFolder.value = false
      return
    }

    message.info(`找到 ${audioFiles.length} 个音频文件，正在解析...`)

    // 解析音频文件信息
    for (const audioFile of audioFiles) {
      const songInfo = parseAudioFileName(audioFile.name, audioFile.file, audioFile.path)
      if (songInfo) {
        folderSongs.value.push(songInfo)
      }
    }

    // 更新选项
    updateFolderSongsOptions()

    message.success(`成功解析 ${folderSongs.value.length} 首歌曲`)
  } catch (err: any) {
    if (err.name === 'AbortError') {
      message.info('已取消选择')
    } else {
      console.error(err)
      message.error(`扫描文件夹失败: ${err.message}`)
    }
  } finally {
    isScanningFolder.value = false
  }
}

/**
 * 递归扫描目录
 */
async function scanDirectory(
  directoryHandle: any,
  audioFiles: { name: string, file: File, path: string }[],
  currentPath: string,
) {
  for await (const entry of directoryHandle.values()) {
    const entryPath = currentPath ? `${currentPath}/${entry.name}` : entry.name

    if (entry.kind === 'file') {
      // 检查是否为音频文件
      const ext = entry.name.substring(entry.name.lastIndexOf('.')).toLowerCase()
      if (AUDIO_EXTENSIONS.includes(ext)) {
        const file = await entry.getFile()
        audioFiles.push({
          name: entry.name,
          file,
          path: entryPath,
        })
      }
    } else if (entry.kind === 'directory') {
      // 递归扫描子目录
      await scanDirectory(entry, audioFiles, entryPath)
    }
  }
}

/**
 * 解析音频文件名，提取歌曲信息
 * 支持的格式:
 * - "歌名.mp3"
 * - "歌手 - 歌名.mp3"
 * - "歌名 - 歌手.mp3"
 * - "歌手-歌名.mp3"
 * - "[歌手] 歌名.mp3"
 * - "歌手 《歌名》.mp3"
 */
function parseAudioFileName(fileName: string, file: File, filePath: string): SongsInfo | null {
  // 移除文件扩展名
  const nameWithoutExt = fileName.substring(0, fileName.lastIndexOf('.'))

  let name = ''
  let author: string[] = []

  // 尝试各种格式

  // 格式: "歌手 - 歌名" 或 "歌名 - 歌手"
  if (nameWithoutExt.includes(' - ')) {
    const parts = nameWithoutExt.split(' - ').map(p => p.trim())
    if (parts.length >= 2) {
      // 假设第一部分是歌手，第二部分是歌名
      author = parts[0].split(/[/、&]/).map(a => a.trim()).filter(a => a)
      name = parts.slice(1).join(' - ')

      // 如果第二部分更像歌手名（包含多个分隔符），交换
      if (parts[1].match(/[/、&]/)) {
        name = parts[0]
        author = parts.slice(1).join(' - ').split(/[/、&]/).map(a => a.trim()).filter(a => a)
      }
    }
  }
  // 格式: "歌手-歌名" (无空格)
  else if (nameWithoutExt.includes('-') && !nameWithoutExt.startsWith('-')) {
    const parts = nameWithoutExt.split('-').map(p => p.trim())
    if (parts.length >= 2) {
      author = parts[0].split(/[/、&]/).map(a => a.trim()).filter(a => a)
      name = parts.slice(1).join('-')
    }
  }
  // 格式: "[歌手] 歌名" 或 "【歌手】歌名"
  else if (nameWithoutExt.match(/^[[【](.+?)[\]】]\s*(.+)$/)) {
    const match = nameWithoutExt.match(/^[[【](.+?)[\]】]\s*(.+)$/)
    if (match) {
      author = match[1].split(/[/、&]/).map(a => a.trim()).filter(a => a)
      name = match[2].trim()
    }
  }
  // 格式: "歌手 《歌名》" 或 "歌手《歌名》"
  else if (nameWithoutExt.match(/^(.+?)\s*[《<](.+?)[》>]$/)) {
    const match = nameWithoutExt.match(/^(.+?)\s*[《<](.+?)[》>]$/)
    if (match) {
      author = match[1].split(/[/、&]/).map(a => a.trim()).filter(a => a)
      name = match[2].trim()
    }
  }
  // 默认: 整个文件名作为歌名
  else {
    name = nameWithoutExt.trim()
  }

  if (!name) {
    return null
  }

  // 创建一个本地URL（用于后续可能的播放预览）
  const url = URL.createObjectURL(file)

  return {
    id: 0,
    key: '',
    name,
    author: author.length > 0 ? author : ['未知'],
    url,
    description: `从文件导入: ${filePath}`,
    language: [],
    tags: [],
    from: SongFrom.Custom,
    createTime: Date.now(),
    updateTime: Date.now(),
    // 存储原始文件信息，以便后续可能需要上传
    // @ts-ignore
    _originalFile: file,
    // @ts-ignore
    _filePath: filePath,
  } as SongsInfo
}

/**
 * 更新文件夹歌曲选项
 */
function updateFolderSongsOptions(newlyAddedSongs: SongsInfo[] = []) {
  folderSongsOptions.value = folderSongs.value.map(s => ({
    label: `${s.name} - ${s.author?.join('/') || '未知'}`,
    value: `${s.name}_${(s as any)._filePath}`, // 使用组合键避免重名
    disabled:
      songs.value.findIndex(exist => exist.name === s.name) > -1
      || newlyAddedSongs.findIndex(add => add.name === s.name) > -1,
  }))
}

/**
 * 添加从文件夹选择的歌曲
 */
async function addFolderSongs() {
  if (selectedFolderSongs.value.length === 0) {
    message.error('请选择要添加的歌曲')
    return
  }

  isModalLoading.value = true

  try {
    const songsToAdd = folderSongs.value.filter(s =>
      selectedFolderSongs.value.find(select => select === (`${s.name}_${(s as any)._filePath}`)),
    )

    // 注意: 由于歌曲URL是本地Blob URL，需要根据实际需求处理
    // 选项1: 直接使用本地URL（仅在当前会话有效）
    // 选项2: 上传文件到服务器（需要实现文件上传接口）
    // 这里使用选项1，但添加提示

    const result = await addSongs(songsToAdd.map(s => ({
      ...s,
      description: `${s.description || ''} [注意: 链接为本地文件，刷新页面后可能失效]`,
    })), SongFrom.Custom)

    if (result.code === 200) {
      message.success(`已添加 ${result.data.length} 首歌曲`)
      songs.value.push(...result.data)

      // 更新选项禁用状态
      updateFolderSongsOptions(result.data)
    } else {
      message.error(`添加失败: ${result.message}`)
    }
  } catch (err: any) {
    message.error(`添加失败: ${err.message}`)
    console.error(err)
  } finally {
    isModalLoading.value = false
  }
}

/**
 * 批量编辑文件夹歌曲信息
 */
function batchEditFolderSongs(field: 'author' | 'language' | 'tags', value: string[]) {
  const selectedSongs = folderSongs.value.filter(s =>
    selectedFolderSongs.value.find(select => select === (`${s.name}_${(s as any)._filePath}`)),
  )

  selectedSongs.forEach((song) => {
    if (field === 'author') {
      song.author = value
    } else if (field === 'language') {
      song.language = value
    } else if (field === 'tags') {
      song.tags = value
    }
  })

  // 更新选项显示
  updateFolderSongsOptions()
  message.success(`已更新 ${selectedSongs.length} 首歌曲的${field === 'author' ? '作者' : field === 'language' ? '语言' : '标签'}信息`)
}

/**
 * 添加自定义歌曲
 */
async function addCustomSong() {
  // 检查歌曲名称是否已存在
  if (songs.value.findIndex(s => s.name == addSongModel.value.name) > -1) {
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
              message.success(`成功添加歌曲: ${addSongModel.value.name}`)
              songs.value.push(data.data[0])
              resetAddingSong(onlyResetNameOnAdded.value)
            } else {
              message.error('未能添加歌曲, 已存在相同名称的曲目')
            }
          } else {
            message.error(`添加失败: ${data.message}`)
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

/**
 * 添加选中的网易云歌曲
 */
async function addNeteaseSongs() {
  isModalLoading.value = true
  const selected = neteaseSongs.value.filter(s => selectedNeteaseSongs.value.find(select => s.key == select))

  await addSongs(selected, SongFrom.Netease)
    .then((data) => {
      if (data.code == 200) {
        message.success(`已添加 ${data.data.length} 首歌曲`)
        songs.value.push(...data.data)
        // 更新选项禁用状态
        updateNeteaseSongsOptions(data.data)
      } else {
        message.error(`添加失败: ${data.message}`)
      }
    })
    .catch((err) => {
      message.error('添加失败')
    })
    .finally(() => {
      isModalLoading.value = false
    })
}

/**
 * 更新网易云歌曲选项的禁用状态
 */
function updateNeteaseSongsOptions(newlyAddedSongs: SongsInfo[] = []) {
  neteaseSongsOptions.value = neteaseSongs.value.map(s => ({
    label: `${s.name} - ${s.author.join('/')}`,
    value: s.key,
    disabled:
      songs.value.findIndex(exist => exist.id == s.id) > -1
      || newlyAddedSongs.findIndex(add => add.id == s.id) > -1,
  }))
}

/**
 * 添加5sing歌曲
 */
async function addFingsingSongs(song: SongsInfo) {
  isModalLoading.value = true

  // 如果没有URL，尝试获取
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
        message.error(`添加失败: ${data.message}`)
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

/**
 * 添加从文件中选择的歌曲
 */
async function addUploadFileSong() {
  if (selecteduploadSongs.value.length == 0) {
    message.error('请选择歌曲')
    return
  }

  isModalLoading.value = true
  const songsToAdd = uploadSongsFromFile.value.filter(s =>
    selecteduploadSongs.value.find(select => s.name == select),
  )

  await addSongs(songsToAdd, SongFrom.Custom)
    .then((data) => {
      if (data.code == 200) {
        message.success(`已添加 ${data.data.length} 首歌曲`)
        songs.value.push(...data.data)
      } else {
        message.error(`添加失败: ${data.message}`)
      }
    })
    .catch((err) => {
      message.error(`添加失败: ${err}`)
      console.error(err)
    })
    .finally(() => {
      isModalLoading.value = false
    })
}

/**
 * 向服务器发送添加歌曲请求
 */
async function addSongs(songsShoudAdd: SongsInfo[], from: SongFrom) {
  return QueryPostAPI<SongsInfo[]>(
    `${SONG_API_URL}add`,
    songsShoudAdd.map(s => ({
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

/**
 * 获取网易云歌单列表
 */
async function getNeteaseSongList() {
  if (!neteaseSongListId.value) {
    message.error('请输入有效的网易云歌单ID')
    return
  }

  isModalLoading.value = true
  await QueryGetAPI<SongsInfo[]>(`${SONG_API_URL}get-netease-list`, {
    id: neteaseSongListId.value,
  })
    .then((data) => {
      if (data.code == 200) {
        neteaseSongs.value = data.data
        updateNeteaseSongsOptions()
        message.success(
          `成功获取歌曲信息, 共 ${data.data.length} 条, 歌单中已存在 ${neteaseSongsOptions.value.filter(s => s.disabled).length} 首`,
        )
      } else {
        message.error(`获取歌单失败: ${data.message}`)
      }
    })
    .catch((err) => {
      message.error(`获取歌单失败: ${err}`)
    })
    .finally(() => {
      isModalLoading.value = false
    })
}

/**
 * 获取5sing搜索结果
 */
async function getFivesingSearchList(isRestart = false) {
  if (!fivesingSearchInput.value) {
    message.error('请输入搜索关键词')
    return
  }

  isModalLoading.value = true
  if (isRestart) {
    fivesingCurrentPage.value = 1
  }

  const searchUrl = `http://search.5sing.kugou.com/home/json?keyword=${fivesingSearchInput.value}&sort=1&page=${fivesingCurrentPage.value}&filter=3`

  await fetch(FETCH_API + searchUrl)
    .then(async (data) => {
      const json = await data.json()
      if (json.list.length == 0) {
        message.error('搜索结果为空')
      }

      fivesingResults.value = []
      json.list.forEach((song: any) => {
        const songInfo = {
          id: song.songId,
          name: extractTextFromHtml(song.songName),
          author: [song.originSinger, song.singer],
        } as SongsInfo
        fivesingResults.value.push(songInfo)
      })

      fivesingTotalPageCount.value = json.pageInfo.totalPages
      message.success(`成功获取搜索信息, 共 ${json.pageInfo.totalCount} 条, 当前第 ${fivesingCurrentPage.value} 页`)
    })
    .catch((err) => {
      message.error(`获取歌单失败: ${err}`)
    })
    .finally(() => {
      isModalLoading.value = false
    })
}

/**
 * 从HTML中提取文本内容
 */
function extractTextFromHtml(html: string): string {
  const regex = /<em class="keyword">(.*?)<\/em>/
  const match = regex.exec(html)
  if (match) {
    return match[1]
  } else {
    return html
  }
}

/**
 * 播放5sing歌曲
 */
async function playFivesingSong(song: SongsInfo) {
  isGettingFivesingSongPlayUrl.value = song.id
  await getFivesingSongUrl(song)
    .then((data) => {
      song.url = data
    })
    .catch((err) => {
      message.error(`获取歌曲链接失败: ${err}`)
    })
    .finally(() => {
      isGettingFivesingSongPlayUrl.value = 0
    })
}

/**
 * 获取5sing歌曲URL
 */
async function getFivesingSongUrl(song: SongsInfo): Promise<string> {
  const apiUrl = `http://service.5sing.kugou.com/song/getsongurl?songid=${song.id}&songtype=bz&from=web&version=6.6.72`
  const data = await fetch(FETCH_API + apiUrl)
  const result = await data.text()

  // 忽略掉result的第一个字符和最后一个字符, 并反序列化
  const json = JSON.parse(result.substring(1, result.length - 1))
  if (json.code == 0) {
    return json.data.lqurl
  }
  return ''
}

/**
 * 获取歌曲列表
 */
async function getSongs() {
  isLoading.value = true
  await QueryGetAPI<any>(`${SONG_API_URL}get`, {
    id: accountInfo.value?.id,
  })
    .then((data) => {
      if (data.code == 200) {
        songs.value = data.data
      }
    })
    .catch((err) => {
      message.error(`获取歌曲失败: ${err}`)
    })
    .finally(() => {
      isLoading.value = false
    })
}

/**
 * 导出歌单数据为CSV
 */
function exportData() {
  // 转换歌曲来源为中文
  const from = (f: SongFrom) => {
    switch (f) {
      case SongFrom.Custom: return '手动添加'
      case SongFrom.Netease: return '网易云'
      case SongFrom.FiveSing: return '5sing'
    }
  }

  // 构建CSV数据
  const csvData = songs.value.map(s => ({
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
  }))

  const text = objectsToCSV(csvData)

  // 添加UTF-8 BOM以支持中文
  const BOM = new Uint8Array([0xEF, 0xBB, 0xBF])
  const utf8encoder = new TextEncoder()
  const utf8array = utf8encoder.encode(text)

  // 保存文件
  const fileName = `歌单_${format(Date.now(), 'yyyy-MM-dd HH:mm:ss')}_${accountInfo.value?.name}_.csv`
  saveAs(
    new Blob([BOM, utf8array], { type: 'text/csv;charset=utf-8;' }),
    fileName,
  )
}

/**
 * 解析Excel文件
 */
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
      return
    }

    const headers = json[0] as any
    const rows = json.slice(1) as any[]

    // 解析每一行数据
    const parsedSongs = rows.map((row) => {
      const song = {} as SongsInfo

      for (let i = 0; i < headers.length; i++) {
        const headerFromFile = (headers[i] as string)?.toLowerCase().trim()
        if (!headerFromFile) continue

        const value = row[i]

        // 歌曲名称 (必填)
        const nameHeaders = columnMappings.value.name.split(/,|，/).map(h => h.trim().toLowerCase())
        if (nameHeaders.includes(headerFromFile)) {
          if (value) song.name = value
          // 注意：即使找到歌名，也不立即continue，因为一个列可能对应多个信息（虽然不推荐）
          // 但标准做法是每个信息有独立列
        }

        // 翻译名称
        if (columnMappings.value.translateName) {
          const translateNameHeaders = columnMappings.value.translateName.split(/,|，/).map(h => h.trim().toLowerCase())
          if (translateNameHeaders.includes(headerFromFile)) {
            if (value) song.translateName = value
          }
        }

        // 作者
        if (columnMappings.value.author) {
          const authorHeaders = columnMappings.value.author.split(/,|，/).map(h => h.trim().toLowerCase())
          if (authorHeaders.includes(headerFromFile)) {
            if (value) song.author = parseMultipleValues(value as string)
          }
        }

        // 描述
        if (columnMappings.value.description) {
          const descriptionHeaders = columnMappings.value.description.split(/,|，/).map(h => h.trim().toLowerCase())
          if (descriptionHeaders.includes(headerFromFile)) {
            song.description = value
          }
        }

        // 链接
        if (columnMappings.value.url) {
          const urlHeaders = columnMappings.value.url.split(/,|，/).map(h => h.trim().toLowerCase())
          if (urlHeaders.includes(headerFromFile)) {
            song.url = value
          }
        }

        // 语言
        if (columnMappings.value.language) {
          const languageHeaders = columnMappings.value.language.split(/,|，/).map(h => h.trim().toLowerCase())
          if (languageHeaders.includes(headerFromFile)) {
            if (value) song.language = parseMultipleValues(value as string)
          }
        }

        // 标签
        if (columnMappings.value.tags) {
          const tagsHeaders = columnMappings.value.tags.split(/,|，/).map(h => h.trim().toLowerCase())
          if (tagsHeaders.includes(headerFromFile)) {
            if (value) song.tags = parseMultipleValues(value as string)
          }
        }
      }

      // 如果没有解析到歌名，则这条记录无效
      if (!song.name) {
        console.log(`忽略无效记录（未找到歌名或歌名为空）: ${row.join(',')}`)
        return null
      }

      return song
    }).filter(s => s !== null) as SongsInfo[]

    uploadSongsFromFile.value = parsedSongs
    message.success(`解析完成, 共获取 ${uploadSongsFromFile.value.length} 首曲目`)
  }
}

/**
 * 解析多值字段（如作者、标签等）
 */
function parseMultipleValues(value: string): string[] {
  if (!value) return []
  if (typeof value !== 'string') {
    // @ts-ignore
    value = value.toString()
  }
  return value
    ?.replace('／', '/')
    .replace('，', ',')
    .split(/\/|,/)
    .map((a: string) => a.trim())
    .filter((value: string, index: number, self: string[]) =>
      value && self.indexOf(value) === index,
    )
}

/**
 * 上传前验证文件类型
 */
function beforeUpload(data: { file: UploadFileInfo, fileList: UploadFileInfo[] }) {
  const validExtensions = ['.xlsx', '.xls', '.csv']
  const isValid = validExtensions.some(ext => data.file.name.endsWith(ext))

  if (isValid) {
    return true
  }

  message.error('只能选择xlsx和xls和csv')
  return false
}

/**
 * 重置添加歌曲表单
 */
function resetAddingSong(onlyName = false) {
  if (onlyName) {
    addSongModel.value.name = ''
    addSongModel.value.description = ''
  } else {
    addSongModel.value = {} as SongsInfo
  }

  showModalRenderKey.value++
  message.success('已重置')
}

/**
 * 重置自定义列头映射
 */
function resetColumnMappings() {
  columnMappings.value = {
    name: '名称,歌名,标题,title,name',
    translateName: '翻译名称,译名,translated,translate',
    author: '作者,歌手,演唱,singer,author,artist',
    description: '描述,备注,说明,description,note,remark',
    url: '链接,地址,url,link',
    language: '语言,language',
    tags: '标签,类别,分类,tag,tags,category',
  }
  message.success('已重置为默认映射')
}

/**
 * 保存自定义列头映射
 */
function saveColumnMappings() {
  // 由于使用了useStorage，映射内容会自动保存
  // 这里只需要提示用户保存成功
  message.success('映射已保存，下次导入将使用当前设置')
}

// 组件挂载时加载歌曲列表
onMounted(async () => {
  await getSongs()
})
</script>

<template>
  <ManagePageHeader
    title="歌单管理"
    :function-type="FunctionTypes.SongList"
  >
    <template #action>
      <!-- 功能按钮区 -->
      <NButton
        type="primary"
        @click="showModal = true"
      >
        添加歌曲
      </NButton>
      <NButton
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
        }"
      >
        刷新
      </NButton>
    </template>

    <!-- 歌单展示页链接 -->
    <NDivider
      style="margin: 16px 0 16px 0"
      title-placement="left"
    >
      歌单展示页链接
    </NDivider>
    <NFlex align="center">
      <NInputGroup style="max-width: 400px;">
        <NInput
          :value="`${CURRENT_HOST}@${accountInfo.name}/song-list`"
          readonly
        />
        <NButton
          secondary
          @click="copyToClipboard(`${CURRENT_HOST}@${accountInfo.name}/song-list`)"
        >
          复制
        </NButton>
      </NInputGroup>
    </NFlex>
    <NDivider style="margin: 16px 0 16px 0" />
  </ManagePageHeader>

  <!-- 添加歌曲模态框 -->
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
          <!-- 手动录入选项卡 -->
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
              <!-- 点歌设置选项 -->
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
                    }"
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
                        }"
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
                        }"
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

          <!-- 从网易云歌单导入选项卡 -->
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

          <!-- 从5sing搜索选项卡 -->
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

          <!-- 从文件导入选项卡 -->
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

            <NDivider>
              导入设置
            </NDivider>

            <NSpace vertical>
              <NCheckbox v-model:checked="useCustomColumnMapping">
                自定义列头映射
                <NTooltip>
                  <template #trigger>
                    <NIcon :component="Info24Filled" />
                  </template>
                  启用后可以自定义Excel文件中列头与歌曲信息的对应关系
                </NTooltip>
              </NCheckbox>

              <NCollapse v-if="useCustomColumnMapping">
                <NCollapseItem
                  title="自定义列头映射"
                  name="custom-mapping"
                >
                  <NSpace vertical>
                    <NAlert type="info">
                      请输入各字段对应的Excel列头名称，多个名称用逗号分隔。导入时会自动匹配这些名称，不区分大小写。
                    </NAlert>
                    <NFormItem label="歌曲名称 (必填)">
                      <NInput
                        v-model:value="columnMappings.name"
                        placeholder="使用逗号分隔多个可能的列头名称"
                      />
                    </NFormItem>
                    <NFormItem label="翻译名称">
                      <NInput
                        v-model:value="columnMappings.translateName"
                        placeholder="使用逗号分隔多个可能的列头名称"
                      />
                    </NFormItem>
                    <NFormItem label="作者">
                      <NInput
                        v-model:value="columnMappings.author"
                        placeholder="使用逗号分隔多个可能的列头名称"
                      />
                    </NFormItem>
                    <NFormItem label="描述">
                      <NInput
                        v-model:value="columnMappings.description"
                        placeholder="使用逗号分隔多个可能的列头名称"
                      />
                    </NFormItem>
                    <NFormItem label="链接">
                      <NInput
                        v-model:value="columnMappings.url"
                        placeholder="使用逗号分隔多个可能的列头名称"
                      />
                    </NFormItem>
                    <NFormItem label="语言">
                      <NInput
                        v-model:value="columnMappings.language"
                        placeholder="使用逗号分隔多个可能的列头名称"
                      />
                    </NFormItem>
                    <NFormItem label="标签">
                      <NInput
                        v-model:value="columnMappings.tags"
                        placeholder="使用逗号分隔多个可能的列头名称"
                      />
                    </NFormItem>
                    <NSpace>
                      <NButton
                        type="primary"
                        @click="saveColumnMappings"
                      >
                        保存映射
                      </NButton>
                      <NButton
                        type="warning"
                        @click="resetColumnMappings"
                      >
                        重置为默认映射
                      </NButton>
                    </NSpace>
                    <NAlert type="info">
                      设置完成后请点击"保存映射"，设置将自动保存到本地浏览器，下次访问时仍会使用
                    </NAlert>
                  </NSpace>
                </NCollapseItem>
              </NCollapse>
            </NSpace>

            <NDivider>
              文件上传
            </NDivider>

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

          <!-- 从文件夹读取选项卡 -->
          <NTabPane
            name="directory"
            tab="从文件夹读取"
          >
            <NAlert
              type="info"
              style="margin-bottom: 16px"
            >
              <template #header>
                功能说明
              </template>
              <NSpace vertical>
                <div>选择本地文件夹，自动扫描其中的音频文件（支持 MP3、WAV、OGG、FLAC、M4A 等格式）</div>
                <div>支持的文件名格式：</div>
                <ul style="margin: 8px 0; padding-left: 20px">
                  <li>歌名.mp3</li>
                  <li>歌手 - 歌名.mp3</li>
                  <li>歌手-歌名.mp3</li>
                  <li>[歌手] 歌名.mp3</li>
                  <li>歌手 《歌名》.mp3</li>
                </ul>
                <div style="color: #ff6b6b">
                  <strong>注意：</strong>导入的歌曲链接为本地文件地址，仅在当前浏览器会话有效。刷新页面后可能需要重新导入。
                </div>
              </NSpace>
            </NAlert>

            <NButton
              type="primary"
              :loading="isScanningFolder"
              @click="selectFolder"
            >
              <template #icon>
                <NIcon :component="ArchiveOutline" />
              </template>
              选择文件夹
            </NButton>

            <template v-if="folderSongsOptions.length > 0">
              <NDivider style="margin: 16px 0" />

              <!-- 批量编辑工具 -->
              <NCollapse>
                <NCollapseItem
                  title="批量编辑工具"
                  name="batch-edit"
                >
                  <NSpace
                    vertical
                    style="width: 100%"
                  >
                    <NAlert type="info">
                      选中歌曲后，可以批量设置作者、语言或标签信息
                    </NAlert>
                    <NSpace align="center">
                      <span>批量设置作者：</span>
                      <NSelect
                        style="width: 300px"
                        :options="authors"
                        filterable
                        multiple
                        tag
                        placeholder="选择或输入作者"
                        @update:value="(value) => batchEditFolderSongs('author', value)"
                      />
                    </NSpace>
                    <NSpace align="center">
                      <span>批量设置语言：</span>
                      <NSelect
                        style="width: 300px"
                        :options="languageSelectOption"
                        filterable
                        multiple
                        tag
                        placeholder="选择或输入语言"
                        @update:value="(value) => batchEditFolderSongs('language', value)"
                      />
                    </NSpace>
                    <NSpace align="center">
                      <span>批量设置标签：</span>
                      <NSelect
                        style="width: 300px"
                        :options="tags"
                        filterable
                        multiple
                        tag
                        placeholder="选择或输入标签"
                        @update:value="(value) => batchEditFolderSongs('tags', value)"
                      />
                    </NSpace>
                  </NSpace>
                </NCollapseItem>
              </NCollapse>

              <NDivider style="margin: 16px 0" />

              <NButton
                type="primary"
                @click="addFolderSongs"
              >
                添加到歌单 | {{ selectedFolderSongs.length }} 首
              </NButton>

              <NDivider style="margin: 16px 0" />

              <NTransfer
                v-model:value="selectedFolderSongs"
                style="height: 500px"
                :options="folderSongsOptions"
                source-filterable
              />
            </template>
          </NTabPane>
        </NTabs>
      </NSpin>
    </NScrollbar>
  </NModal>

  <!-- 歌曲列表展示 -->
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
