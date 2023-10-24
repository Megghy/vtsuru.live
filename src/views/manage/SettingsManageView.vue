<script setup lang="ts">
import { useAccount } from '@/api/account'
import { NButton, NCard, NCheckbox, NCheckboxGroup, NDivider, NForm, NSelect, NSpace, NSwitch, NTabPane, NTabs, SelectOption, useMessage } from 'naive-ui'
import { computed, onMounted, ref } from 'vue'
import { useRequest } from 'vue-request'
import { FunctionTypes, ScheduleWeekInfo, SongFrom, SongLanguage, SongsInfo } from '@/api/api-models'
import { QueryPostAPI } from '@/api/query'
import { ACCOUNT_API_URL, FETCH_API } from '@/data/constants'
import ScheduleView from '../view/ScheduleView.vue'
import UserIndexView from '../view/UserIndexView.vue'
import SongListView from '../view/SongListView.vue'

const accountInfo = useAccount()
const message = useMessage()

const templateOptions = [
  {
    label: '主页',
    value: 'index',
  },
  {
    label: '歌单',
    value: 'songlist',
  },
  {
    label: '日程表',
    value: 'schedule',
  },
] as SelectOption[]
const fakeSongList = [
  {
    id: 1,
    key: 'song1',
    name: '歌曲1',
    author: ['作者1'],
    url: 'https://example.com/song1.mp3',
    from: SongFrom.Custom,
    language: [SongLanguage.Chinese],
    createTime: Date.now(),
    updateTime: Date.now(),
  },
  {
    id: 2,
    key: 'song2',
    name: '歌曲2',
    author: ['作者2'],
    url: 'https://example.com/song2.mp3',
    from: SongFrom.Custom,
    language: [SongLanguage.Chinese],
    createTime: Date.now(),
    updateTime: Date.now(),
  },
  {
    id: 3,
    key: 'song3',
    name: '歌曲3',
    author: ['作者3'],
    url: 'https://example.com/song3.mp3',
    from: SongFrom.Custom,
    language: [SongLanguage.Chinese],
    createTime: Date.now(),
    updateTime: Date.now(),
  },
  {
    id: 4,
    key: 'song4',
    name: '歌曲4',
    author: ['作者4'],
    url: 'https://example.com/song4.mp3',
    from: SongFrom.Custom,
    language: [SongLanguage.Chinese],
    createTime: Date.now(),
    updateTime: Date.now(),
  },
  {
    id: 5,
    key: 'song5',
    name: '歌曲5',
    author: ['作者5'],
    url: 'https://example.com/song5.mp3',
    from: SongFrom.Custom,
    language: [SongLanguage.Chinese],
    createTime: Date.now(),
    updateTime: Date.now(),
  },
] as SongsInfo[]
const fakeSchedule = [
  {
    year: 2023,
    week: 30,
    days: [
      {
        title: '唱唱歌!',
        tag: '歌回',
        tagColor: '#61B589',
        time: '10:00',
      },
      {
        title: '玩点游戏',
        tag: '游戏',
        tagColor: '#A36565',
        time: '20:00',
      },
      {
        title: 'Title 3',
        tag: 'Tag 3',
        tagColor: '#7BCDEF',
        time: '12:00 PM',
      },
      {
        title: null,
        tag: null,
        tagColor: null,
        time: null,
      },
      {
        title: null,
        tag: null,
        tagColor: null,
        time: null,
      },
      {
        title: null,
        tag: null,
        tagColor: null,
        time: null,
      },
      {
        title: null,
        tag: null,
        tagColor: null,
        time: null,
      },
    ],
  },
] as ScheduleWeekInfo[]
const selectedOption = ref(templateOptions[0].value)
const selectedTab = ref('general')

const scheduleTemplateOptions = [
  {
    label: '默认',
    value: '',
  },
  {
    label: '粉粉',
    value: 'PinkySchedule',
  },
] as SelectOption[]
const selectedScheduleTemplate = ref(accountInfo.value?.settings.scheduleTemplate ?? scheduleTemplateOptions[0].value?.toString())
const songListTemplateOptions = [
  {
    label: '默认',
    value: '',
  },
] as SelectOption[]
const selectedSongListTemplate = ref(accountInfo.value?.settings.songListTemplate ?? songListTemplateOptions[0].value)

const biliUserInfo = ref()

function UpdateEnableFunction(func: FunctionTypes, enable: boolean) {
  if (accountInfo.value) {
    if (enable) {
      //从account.value?.settings.enableFunctions中移除指定的func
      accountInfo.value.settings.enableFunctions = accountInfo.value?.settings.enableFunctions.filter((f) => f != func)
    } else {
      accountInfo.value.settings.enableFunctions.push(func)
    }
  }
}
async function RequestBiliUserData() {
  await fetch(FETCH_API + `https://account.bilibili.com/api/member/getCardByMid?mid=10021741`)
    .then(async (respone) => {
      let data = await respone.json()
      if (data.code == 0) {
        biliUserInfo.value = data.card
      } else {
        throw new Error('Bili User API Error: ' + data.message)
      }
    })
    .catch((err) => {
      console.error(err)
    })
}
async function SaveComboGroupSetting(value: (string | number)[], meta: { actionType: 'check' | 'uncheck'; value: string | number }) {
  if (accountInfo.value) {
    //UpdateEnableFunction(meta.value as FunctionTypes, meta.actionType == 'check')
    await QueryPostAPI(ACCOUNT_API_URL + 'update-setting', accountInfo.value?.settings)
      .then((data) => {
        if (data.code == 200) {
          //message.success('保存成功')
        } else {
          message.error('修改失败')
          if (accountInfo.value) {
            accountInfo.value.settings.enableFunctions = accountInfo.value.settings.enableFunctions.filter((f) => f != (meta.value as FunctionTypes))
          }
        }
      })
      .catch((err) => {
        console.error(err)
        message.error('修改失败')
      })
  }
}
async function SaveComboSetting(value: boolean) {
  if (accountInfo.value) {
    //UpdateEnableFunction(meta.value as FunctionTypes, meta.actionType == 'check')
    await QueryPostAPI(ACCOUNT_API_URL + 'update-setting', accountInfo.value?.settings)
      .then((data) => {
        if (data.code == 200) {
          //message.success('保存成功')
        } else {
          message.error('修改失败')
        }
      })
      .catch((err) => {
        console.error(err)
        message.error('修改失败')
      })
  }
}
const componentType = computed(() => {
  switch (selectedOption.value) {
    case 'index':
      return UserIndexView
    case 'songlist':
      return SongListView
    case 'schedule':
      return ScheduleView
    default:
      return UserIndexView
  }
})
onMounted(() => {
  RequestBiliUserData()
})
</script>

<template>
  <NCard v-if="accountInfo" title="设置" :style="`${selectedTab === 'general' ? '' : 'min-height: 800px;'}`">
    <NTabs>
      <NTabPane tab="常规" name="general">
        <NDivider style="margin: 0"> 启用功能 </NDivider>
        <NCheckboxGroup v-model:value="accountInfo.settings.enableFunctions" @update:value="SaveComboGroupSetting">
          <NCheckbox :value="FunctionTypes.SongList"> 歌单 </NCheckbox>
          <NCheckbox :value="FunctionTypes.QuestionBox"> 提问箱(棉花糖 </NCheckbox>
          <NCheckbox :value="FunctionTypes.Schedule"> 日程 </NCheckbox>
        </NCheckboxGroup>
        <NDivider> 通知 </NDivider>
        <NSpace>
          <NCheckbox v-model:checked="accountInfo.settings.sendEmail.recieveQA" @update:checked="SaveComboSetting"> 收到新提问时发送邮件 </NCheckbox>
          <NCheckbox v-model:checked="accountInfo.settings.sendEmail.recieveQAReply" @update:checked="SaveComboSetting"> 提问收到回复时发送邮件 </NCheckbox>
        </NSpace>
        <NDivider> 提问箱 </NDivider>
        <NSpace>
          <NCheckbox v-model:checked="accountInfo.settings.questionBox.allowUnregistedUser" @update:checked="SaveComboSetting"> 允许未注册用户提问 </NCheckbox>
        </NSpace>
      </NTabPane>
      <NTabPane tab="模板" name="template">
        <NSpace vertical>
          <NSpace align="center"> 页面 <NSelect :options="templateOptions" v-model:value="selectedOption" style="width: 150px" /> </NSpace>
          <NDivider style="margin: 5px 0 5px 0" title-placement="left"> 模板 </NDivider>
          <template v-if="selectedOption == 'index'">
            <NSelect style="width: 150px" />
            <UserIndexView :user-info="accountInfo" :bili-info="biliUserInfo" />
          </template>
          <template v-else-if="selectedOption == 'songlist'">
            <NSelect :options="songListTemplateOptions" v-model:value="selectedSongListTemplate" style="width: 150px" />
            <SongListView :user-info="accountInfo" :bili-info="biliUserInfo" :fake-data="fakeSongList" :is-self="false" />
          </template>
          <template v-else-if="selectedOption == 'schedule'">
            <NSelect :options="scheduleTemplateOptions" v-model:value="selectedScheduleTemplate" style="width: 150px" />
            <ScheduleView :user-info="accountInfo" :bili-info="biliUserInfo" :fake-data="fakeSchedule" :is-self="false" :template="selectedScheduleTemplate" />
          </template>
        </NSpace>
      </NTabPane>
    </NTabs>
  </NCard>
</template>
