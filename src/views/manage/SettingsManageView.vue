<script setup lang="ts">
import { DelBiliBlackList, SaveAccountSettings, SaveEnableFunctions, downloadConfigDirect, useAccount } from '@/api/account'
import { FunctionTypes, ScheduleWeekInfo, SongFrom, SongLanguage, SongRequestOption, SongsInfo } from '@/api/api-models'
import DynamicForm from '@/components/DynamicForm.vue'
import { TemplateConfig } from '@/data/VTsuruTypes'
import { FETCH_API, IndexTemplateMap, ScheduleTemplateMap, SongListTemplateMap } from '@/data/constants'
import { NButton, NCard, NCheckbox, NCheckboxGroup, NDivider, NEmpty, NList, NListItem, NModal, NSelect, NSpace, NSpin, NTabPane, NTabs, NText, SelectOption, useMessage } from 'naive-ui'
import { computed, h, nextTick, onActivated, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'

interface TemplateDefineTypes {
  TemplateMap: { [name: string]: { name: string; compoent: any } }
  Options: SelectOption[]
  Data: any
  Selected: string
  Config?: any | undefined
}

const accountInfo = useAccount()
const message = useMessage()
const route = useRoute()

const isSaving = ref(false)

const templates = ref({
  index: {
    TemplateMap: IndexTemplateMap,
    Options: Object.entries(IndexTemplateMap).map((v) => ({
      label: v[1].name,
      value: v[0],
    })),
    Data: null,
    Selected: accountInfo.value?.settings.indexTemplate ?? '',
  },
  schedule: {
    TemplateMap: ScheduleTemplateMap,
    Options: Object.entries(ScheduleTemplateMap).map((v) => ({
      label: v[1].name,
      value: v[0],
    })),
    Data: [
      {
        year: 2023,
        week: 30,
        days: [
          {
            title: '唱唱歌!',
            tag: '歌回',
            tagColor: '#61B589',
            time: '10:00 AM',
          },
          {
            title: '玩点游戏',
            tag: '游戏',
            tagColor: '#A36565',
            time: '20:00 PM',
          },
          {
            title: 'Title 3',
            tag: 'Tag 3',
            tagColor: '#7BCDEF',
            time: '11:00 PM',
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
    ] as ScheduleWeekInfo[],
    Selected: accountInfo.value?.settings.scheduleTemplate ?? '',
  },
  songlist: {
    TemplateMap: SongListTemplateMap,
    Options: Object.entries(SongListTemplateMap).map((v) => ({
      label: v[1].name,
      value: v[0],
    })),
    Data: [
      {
        id: 1,
        key: 'song1',
        name: '歌曲1',
        author: ['作者1'],
        tags: ['标签1', '标签2'],
        description: '这是一段描述',
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
        author: ['作者1'],
        tags: ['标签1', '标签2'],
        url: 'https://example.com/song2.mp3',
        from: SongFrom.Custom,
        language: [SongLanguage.Chinese],
        createTime: Date.now(),
        updateTime: Date.now(),
        description: '这还是一段描述',
        options: {
          scMinPrice: 30,
          fanMedalMinLevel: 5,
          needJianzhang: true,
        } as SongRequestOption,
      },
      {
        id: 3,
        key: 'song3',
        name: '歌曲3',
        tags: ['标签3', '很长很长很长很长很长很长很长很长很长很长的标签'],
        author: ['作者3'],
        url: 'https://example.com/song3.mp3',
        from: SongFrom.Custom,
        description: '这是一段很长很长很长很长很长很长很长很长很长很长的描述',
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
        tags: ['标签1', '标签5', '标签6', '标签7', '标签8', '标签9', '标签10'],
        url: 'https://example.com/song5.mp3',
        from: SongFrom.Custom,
        language: [SongLanguage.Chinese],
        createTime: Date.now(),
        updateTime: Date.now(),
      },
    ] as SongsInfo[],
    Selected: accountInfo.value?.settings.songListTemplate ?? '',
  },
} as { [type: string]: TemplateDefineTypes })

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
const selectedOption = ref(route.query.template?.toString() ?? 'index')
const selectedTab = ref(route.query.tab?.toString() ?? 'general')

const dynamicConfigRef = ref()
const selectedTemplateData = computed(() => templates.value[selectedOption.value])
const selectedComponent = computed(() => selectedTemplateData.value?.TemplateMap[selectedTemplateData.value.Selected].compoent)
const selectedTemplateConfig = computed(() => {
  if (dynamicConfigRef.value?.Config) {
    return dynamicConfigRef.value?.Config as TemplateConfig<any>
  }
  return undefined
})

const biliUserInfo = ref()
const settingModalVisiable = ref(false)

async function RequestBiliUserData() {
  await fetch(FETCH_API + `https://account.bilibili.com/api/member/getCardByMid?mid=10021741`).then(async (respone) => {
    let data = await respone.json()
    if (data.code == 0) {
      biliUserInfo.value = data.card
    } else {
      throw new Error('Bili User API Error: ' + data.message)
    }
  })
}
async function SaveComboGroupSetting(value: (string | number)[], meta: { actionType: 'check' | 'uncheck'; value: string | number }) {
  if (accountInfo.value) {
    isSaving.value = true
    //UpdateEnableFunction(meta.value as FunctionTypes, meta.actionType == 'check')
    await SaveEnableFunctions(accountInfo.value.settings.enableFunctions)
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
        message.error('修改失败')
      })
      .finally(() => {
        isSaving.value = false
      })
  }
}
async function SaveComboSetting() {
  isSaving.value = true
  if (accountInfo.value) {
    //UpdateEnableFunction(meta.value as FunctionTypes, meta.actionType == 'check')
    await SaveAccountSettings()
      .then((data) => {
        if (data.code == 200) {
          message.success('已保存')
        } else {
          message.error('修改失败')
        }
      })
      .catch((err) => {
        message.error('修改失败')
      })
      .finally(() => {
        isSaving.value = false
      })
  }
}
async function SaveTemplateSetting() {
  if (accountInfo.value) {
    switch (selectedOption.value) {
      case 'index': {
        accountInfo.value.settings.indexTemplate = selectedTemplateData.value.Selected ?? ''
        break
      }
      case 'songlist': {
        accountInfo.value.settings.songListTemplate = selectedTemplateData.value.Selected ?? ''
        break
      }
      case 'schedule': {
        accountInfo.value.settings.scheduleTemplate = selectedTemplateData.value.Selected ?? ''
        break
      }
    }
    await SaveComboSetting()
  }
}
async function onOpenTemplateSettings() {
  settingModalVisiable.value = true
  nextTick(async () => {
    await getTemplateConfig()
  })
}
async function getTemplateConfig() {
  if (selectedTemplateConfig.value && !selectedTemplateData.value.Config) {
    await downloadConfigDirect(selectedTemplateConfig.value.name)
      .then((data) => {
        if (data.code == 200) {
          message.success('已获取配置文件')
          console.log(`已获取模板配置: ${selectedTemplateConfig.value?.name}`)
          selectedTemplateData.value.Config = JSON.parse(data.data)
        } else if (data.code == 404) {
          //message.error(`未找到名为 ${name} 的配置文件`)
          console.error(`未找到名为 ${selectedTemplateConfig.value?.name} 的配置文件`)
          selectedTemplateData.value.Config = dynamicConfigRef.value.DefaultConfig
        } else {
          message.error('获取失败: ' + data.message)
          console.error('获取失败: ' + data.message)
        }
      })
      .catch((err) => {
        message.error(err)
      })
  }
}
const buttonGroup = computed(() => {
  return h(NSpace, () => [h(NButton, { type: 'primary', onClick: () => SaveTemplateSetting() }, () => '设为展示模板'), h(NButton, { type: 'info', onClick: onOpenTemplateSettings }, () => '模板设置')])
})

function unblockUser(id: number) {
  DelBiliBlackList(id)
    .then((data) => {
      if (data.code == 200) {
        message.success(`[${id}] 已移除黑名单`)
        if (accountInfo.value) {
          delete accountInfo.value.biliBlackList[id]
        }
      } else {
        message.error(data.message)
      }
    })
    .catch((err) => {
      message.error(err)
    })
}

onActivated(() => {
  if (route.query.tab) {
    selectedTab.value = route.query.tab.toString()
  }
  if (route.query.template) {
    selectedOption.value = route.query.template.toString()
  }
})
onMounted(async () => {
  await RequestBiliUserData()
})
</script>

<template>
  <NCard v-if="accountInfo" title="设置" :style="`${selectedTab === 'general' ? '' : 'min-height: 800px;'}`">
    <NSpin :show="isSaving">
      <NTabs v-model:value="selectedTab">
        <NTabPane tab="常规" name="general">
          <NDivider style="margin: 0"> 启用功能 </NDivider>
          <NCheckboxGroup v-model:value="accountInfo.settings.enableFunctions" @update:value="SaveComboGroupSetting">
            <NCheckbox :value="FunctionTypes.SongList"> 歌单 </NCheckbox>
            <NCheckbox :value="FunctionTypes.QuestionBox"> 提问箱(棉花糖 </NCheckbox>
            <NCheckbox :value="FunctionTypes.Schedule"> 日程 </NCheckbox>
            <NCheckbox :value="FunctionTypes.SongRequest"> 点歌 </NCheckbox>
            <NCheckbox :value="FunctionTypes.Queue"> 排队 </NCheckbox>
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
        <NTabPane tab="黑名单" name="blacklist">
          <NList v-if="accountInfo.biliBlackList && Object.keys(accountInfo.biliBlackList).length > 0">
            <NListItem v-for="item in Object.entries(accountInfo.biliBlackList)" :key="item[0]">
              <NSpace align="center">
                <NText>
                  {{ item[1] }}
                </NText>
                <NText depth="3">
                  {{ item[0] }}
                </NText>
                <NButton type="error" @click="unblockUser(Number(item[0]))" size="small"> 移除 </NButton>
              </NSpace>
            </NListItem>
          </NList>
          <NEmpty v-else />
        </NTabPane>
        <NTabPane tab="模板" name="template">
          <NSpace vertical>
            <NSpace align="center"> 页面 <NSelect :options="templateOptions" v-model:value="selectedOption" style="width: 150px" /> </NSpace>
            <NDivider style="margin: 5px 0 5px 0" title-placement="left"> 模板 </NDivider>
            <div>
              <NSpace>
                <NSelect style="width: 150px" :options="selectedTemplateData.Options" v-model:value="selectedTemplateData.Selected" />
                <component :is="buttonGroup" />
              </NSpace>
              <NDivider />
              <Transition name="fade" mode="out-in">
                <div v-if="selectedComponent" :key="selectedTemplateData.Selected">
                  <component ref="dynamicConfigRef" :is="selectedComponent" :user-info="accountInfo" :bili-info="biliUserInfo" :current-data="selectedTemplateData.Data" />
                </div>
              </Transition>
            </div>
          </NSpace>
        </NTabPane>
      </NTabs>
    </NSpin>
  </NCard>
  <NModal preset="card" v-model:show="settingModalVisiable" closable style="width: 600px; max-width: 90vw" title="模板设置">
    只是测试, 没用
    <NSpin v-if="!selectedTemplateData.Config" show />
    <DynamicForm v-else :key="selectedTemplateData.Selected" :configData="selectedTemplateData.Config" :config="selectedTemplateConfig" />
  </NModal>
</template>
