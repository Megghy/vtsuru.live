<script setup lang="ts">
import { useAccount } from '@/api/account'
import { SongFrom, SongLanguage, SongsInfo } from '@/api/api-models'
import { QueryGetAPI, QueryPostAPI } from '@/api/query'
import SongList from '@/components/SongList.vue'
import { SONG_API_URL } from '@/data/constants'
import { ca } from 'date-fns/locale'
import { FormInst, FormRules, NButton, NDivider, NForm, NFormItem, NInput, NInputGroup, NInputGroupLabel, NModal, NSelect, NSpace, NSpin, NTabPane, NTabs, NTag, NTransfer, useMessage } from 'naive-ui'
import { Option } from 'naive-ui/es/transfer/src/interface'
import { computed, onMounted, ref } from 'vue'

const message = useMessage()
const accountInfo = useAccount()

const showModal = ref(false)
const neteaseIdInput = ref()
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
      }
    })
    .catch((err) => {
      console.error(err)
      message.error(err)
    })
    .finally(() => {
      isModalLoading.value = false
    })
}
async function getSongs() {
  await QueryGetAPI<any>(SONG_API_URL + 'get', {
    uId: accountInfo.value?.biliId,
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
  <NButton @click="showModal = true"> 添加歌曲 </NButton>
  <NModal v-model:show="showModal" style="max-width: 600px" preset="card">
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
          <NButton type="primary" @click="getNeteaseSongList"> 获取 </NButton>
          <template v-if="neteaseSongsOptions.length > 0">
            <NDivider style="margin: 10px" />
            <NTransfer style="height: 500px" ref="transfer" v-model:value="selectedNeteaseSongs" :options="neteaseSongsOptions" source-filterable />
            <NDivider style="margin: 10px" />
            <NButton type="primary" @click="addNeteaseSongs"> 添加到歌单 | {{ selectedNeteaseSongs.length }} 首 </NButton>
          </template>
        </NTabPane>
        <NTabPane name="5sing" tab="从5sing搜索"> </NTabPane>
      </NTabs>
    </NSpin>
  </NModal>
  <SongList :songs="songs" />
</template>
