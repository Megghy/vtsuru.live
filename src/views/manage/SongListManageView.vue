<script setup lang="ts">
import { useAccount } from '@/api/account'
import { SongFrom, SongLanguage, SongsInfo } from '@/api/api-models'
import { QueryGetAPI, QueryPostAPI } from '@/api/query'
import SongList from '@/components/SongList.vue'
import { FETCH_API, FIVESING_SEARCH_API, SONG_API_URL } from '@/data/constants'
import { ca } from 'date-fns/locale'
import {
  FormInst,
  FormRules,
  NButton,
  NDivider,
  NForm,
  NFormItem,
  NInput,
  NInputGroup,
  NInputGroupLabel,
  NList,
  NListItem,
  NModal,
  NPagination,
  NSelect,
  NSpace,
  NSpin,
  NTabPane,
  NTable,
  NTabs,
  NTag,
  NTransfer,
  useMessage,
} from 'naive-ui'
import { Option } from 'naive-ui/es/transfer/src/interface'
import { computed, onMounted, ref } from 'vue'

const message = useMessage()
const accountInfo = useAccount()

const showModal = ref(false)
const neteaseIdInput = ref()
const fivesingSearchInput = ref()
const isModalLoading = ref(false)

const neteaseSongListId = computed(() => {
  try {
    const url = new URL(neteaseIdInput.value)
    console.log(url)
    if (url.host == 'music.163.com') {
      let regex = /id=(\d+)/

      // 使用exec方法在链接中查找匹配项
      let match = regex.exec(neteaseIdInput.value)

      // 如果找到了匹配项，那么match[1]就是分组1的值，也就是id的值
      if (match) {
        return Number(match[1])
      }
    }
  } catch (err) {}
  try {
    return Number(neteaseIdInput.value)
  } catch {}
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

async function addCustomSong() {
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
              addSongModel.value = {} as SongsInfo
            } else {
              message.error('未能添加歌曲, 已存在相同名称的曲目')
            }
          } else {
            message.error('添加失败: ' + data.message)
          }
        })
        .catch((err) => {
          message.error('添加失败')
          console.error(err)
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
          disabled: songs.value.findIndex((exist) => exist.id == s.id) > -1 || data.data.findIndex((add) => add.id == s.id) > -1,
        }))
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
async function addFingsingSongs(song: SongsInfo) {
  isModalLoading.value = true
  if (!song.url) {
    try {
      const url = await getFivesingSongUrl(song)
      song.url = url
    } catch (err) {
      isModalLoading.value = false
      message.error('添加失败')
      console.error(err)
      return
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
    }))
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
          label: `${s.name} - ${s.author.join('/')}`,
          value: s.key,
          disabled: songs.value.findIndex((exist) => exist.id == s.id) > -1,
        }))
        message.success(`成功获取歌曲信息, 共 ${data.data.length} 条, 歌单中已存在 ${neteaseSongsOptions.value.filter((s) => s.disabled).length} 首`)
      } else {
        message.error('获取歌单失败: ' + data.message)
      }
    })
    .catch((err) => {
      console.error(err)
      message.error('获取歌单失败: ' + err)
    })
    .finally(() => {
      isModalLoading.value = false
    })
}
async function getFivesingSearchList(isRestart = false) {
  isModalLoading.value = true
  await fetch(FETCH_API + `http://search.5sing.kugou.com/home/json?keyword=${fivesingSearchInput.value}&sort=1&page=${fivesingCurrentPage.value}&filter=3`)
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
      console.error(err)
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
      console.error(err)
      message.error('获取歌曲链接失败: ' + err)
    })
    .finally(() => {
      isGettingFivesingSongPlayUrl.value = 0
    })
}
async function getFivesingSongUrl(song: SongsInfo): Promise<string> {
  const data = await fetch(FETCH_API + `http://service.5sing.kugou.com/song/getsongurl?songid=${song.id}&songtype=bz&from=web&version=6.6.72`)
  const result = await data.text()
  //忽略掉result的第一个字符和最后一个字符, 并反序列化
  const json = JSON.parse(result.substring(1, result.length - 1))
  if (json.code == 0) {
    return json.data.lqurl
  }
  return ''
}

async function getSongs() {
  await QueryGetAPI<any>(SONG_API_URL + 'get', {
    id: accountInfo.value?.id,
  }).then((data) => {
    if (data.code == 200) {
      songs.value = data.data
    }
  })
}

onMounted(async () => {
  await getSongs()
})
</script>

<template>
  <NSpace>
    <NButton @click="showModal = true" type="primary"> 添加歌曲 </NButton>
    <NButton
      @click="
        () => {
          getSongs()
          message.success('完成')
        }
      "
    >
      刷新
    </NButton>
  </NSpace>
  <NDivider style="margin: 16px 0 16px 0" />
  <NModal v-model:show="showModal" style="max-width: 1000px" preset="card">
    <template #header> 添加歌曲 </template>
    <NSpin :show="isModalLoading">
      <NTabs default-value="custom" animated>
        <NTabPane name="custom" tab="手动录入">
          <NForm ref="formRef" :rules="addSongRules" :model="addSongModel">
            <NFormItem path="name" label="名称">
              <NInput v-model:value="addSongModel.name" autosize style="min-width: 200px" placeholder="就是歌曲名称" />
            </NFormItem>
            <NFormItem path="author" label="作者">
              <NSelect v-model:value="addSongModel.author" filterable multiple tag placeholder="输入，按回车确认" :show-arrow="false" :show="false" />
            </NFormItem>
            <NFormItem path="description" label="备注">
              <NInput v-model:value="addSongModel.description" placeholder="可选" :maxlength="250" show-count autosize style="min-width: 300px" clearable />
            </NFormItem>
            <NFormItem path="language" label="语言">
              <NSelect v-model:value="addSongModel.language" multiple :options="songSelectOption" placeholder="可选" />
            </NFormItem>
            <NFormItem path="url" label="链接">
              <NInput v-model:value="addSongModel.url" placeholder="可选, 后缀为mp3、wav、ogg时将会尝试播放, 否则会在新页面打开" />
            </NFormItem>
          </NForm>
          <NButton type="primary" @click="addCustomSong"> 添加 </NButton>
        </NTabPane>
        <NTabPane name="netease" tab="从网易云歌单导入">
          <NInput clearable style="width: 100%" autosize :status="neteaseSongListId ? 'success' : 'error'" v-model:value="neteaseIdInput" placeholder="直接输入歌单Id或者网页链接">
            <template #suffix>
              <NTag v-if="neteaseSongListId" type="success" size="small"> 歌单Id: {{ neteaseSongListId }} </NTag>
            </template>
          </NInput>
          <NDivider style="margin: 10px" />
          <NButton type="primary" @click="getNeteaseSongList" :disabled="!neteaseSongListId"> 获取 </NButton>
          <template v-if="neteaseSongsOptions.length > 0">
            <NDivider style="margin: 10px" />
            <NTransfer style="height: 500px" ref="transfer" v-model:value="selectedNeteaseSongs" :options="neteaseSongsOptions" source-filterable />
            <NDivider style="margin: 10px" />
            <NButton type="primary" @click="addNeteaseSongs"> 添加到歌单 | {{ selectedNeteaseSongs.length }} 首 </NButton>
          </template>
        </NTabPane>
        <NTabPane name="5sing" tab="从5sing搜索">
          <NInput clearable style="width: 100%" autosize v-model:value="fivesingSearchInput" placeholder="输入要搜索的歌名" maxlength="15" />
          <NDivider style="margin: 10px" />
          <NButton type="primary" @click="getFivesingSearchList(true)" :disabled="!fivesingSearchInput"> 搜索 </NButton>
          <template v-if="fivesingResults.length > 0">
            <NDivider style="margin: 10px" />
            <div style="overflow-x: auto">
              <NTable size="small" style="overflow-x: auto">
                <thead>
                  <tr>
                    <th>名称</th>
                    <th>作者</th>
                    <th>试听</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="song in fivesingResults" v-bind:key="song.id">
                    <td>{{ song.name }}</td>
                    <td>
                      <NSpace>
                        <NTag size="small" v-for="author in song.author" :key="author">
                          {{ author }}
                        </NTag>
                      </NSpace>
                    </td>
                    <td style="display: flex; justify-content: flex-end">
                      <!-- 在这里播放song.url链接中的音频 -->
                      <NButton size="small" v-if="!song.url" @click="playFivesingSong(song)" :loading="isGettingFivesingSongPlayUrl == song.id"> 试听 </NButton>
                      <audio v-else controls style="max-height: 30px">
                        <source :src="song.url" />
                      </audio>
                    </td>
                    <td>
                      <NButton size="small" color="green" @click="addFingsingSongs(song)" :disabled="songs.findIndex((s) => s.from == SongFrom.FiveSing && s.id == song.id) > -1"> 添加 </NButton>
                    </td>
                  </tr>
                </tbody>
              </NTable>
            </div>
            <br />
            <NPagination v-model:page="fivesingCurrentPage" :page-count="fivesingTotalPageCount" simple @update-page="getFivesingSearchList(false)" />
          </template>
        </NTabPane>
      </NTabs>
    </NSpin>
  </NModal>
  <SongList :songs="songs" is-self />
  <NDivider />
</template>