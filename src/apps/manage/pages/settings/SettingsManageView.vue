<script setup lang="ts">
import type {
  SelectOption,
} from 'naive-ui'
import type {
  ScheduleWeekInfo,
  SongRequestOption,
  SongsInfo,
} from '@/api/api-models'
import type {
  TemplateMapType,
} from '@/shared/config/templates'
import { useRouteQuery } from '@vueuse/router'
import {
  NAlert,
  NButton,
  NCard,
  NCheckbox,
  NCheckboxGroup,
  NDivider,
  NEmpty,
  NFlex,
  NList,
  NListItem,
  NModal,
  NSelect,
  NSpace,
  NSpin,
  NTabPane,
  NTabs,
  NText,
  useMessage,
} from 'naive-ui'
import { computed, h, nextTick, onActivated, onMounted, ref, shallowRef, watch } from 'vue'
import {
  DelBiliBlackList,
  DelBlackList,
  downloadConfigDirect,
  SaveAccountSettings,
  SaveEnableFunctions,
  useAccount,
} from '@/api/account'
import {
  FunctionTypes,
  SongFrom,
} from '@/api/api-models'
import DynamicForm from '@/apps/manage/components/DynamicForm.vue'
import {
  FETCH_API,
} from '@/shared/config'
import { ScheduleTemplateMap, SongListTemplateMap } from '@/shared/config/templates'

// 模板定义类型接口
interface TemplateDefineTypes {
  TemplateMap: TemplateMapType
  Options: SelectOption[]
  Data: any
  Selected: string
  Config?: any | undefined
}

const accountInfo = useAccount()
const message = useMessage()

const isSaving = ref(false)

// 模板相关数据
const templates = ref({
  schedule: {
    TemplateMap: ScheduleTemplateMap,
    Options: Object.entries(ScheduleTemplateMap).map(v => ({
      label: v[1].name,
      value: v[0],
    })),
    Data: [
      {
        year: 2023,
        week: 30,
        days: [
          [{
            title: '唱唱歌!',
            tag: '歌回',
            tagColor: '#61B589',
            time: '10:00 AM',
            id: null,
          }],
          [{
            title: '玩点游戏',
            tag: '游戏',
            tagColor: '#A36565',
            time: '20:00 PM',
            id: null,
          }],
          [{
            title: 'Title 3',
            tag: 'Tag 3',
            tagColor: '#7BCDEF',
            time: '11:00 PM',
            id: null,
          }],
          [{
            title: null,
            tag: null,
            tagColor: null,
            time: null,
            id: null,
          }],
          [{
            title: null,
            tag: null,
            tagColor: null,
            time: null,
            id: null,
          }],
          [{
            title: null,
            tag: null,
            tagColor: null,
            time: null,
            id: null,
          }],
          [{
            title: null,
            tag: null,
            tagColor: null,
            time: null,
            id: null,
          }],
        ],
      },
    ] as ScheduleWeekInfo[],
    Selected: accountInfo.value?.settings.scheduleTemplate ?? '',
  },
  songlist: {
    TemplateMap: SongListTemplateMap,
    Options: Object.entries(SongListTemplateMap).map(v => ({
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
        language: ['中文'],
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
        language: ['中文'],
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
        language: ['中文'],
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
        language: ['中文'],
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
        language: ['中文'],
        createTime: Date.now(),
        updateTime: Date.now(),
      },
    ] as SongsInfo[],
    Selected: accountInfo.value?.settings.songListTemplate ?? '',
  },
} as { [type: string]: TemplateDefineTypes })

// 模板选项配置
const templateOptions = [
  { label: '日程表', value: 'schedule' },
  { label: '歌单', value: 'songlist' },
] as SelectOption[]

// 使用 useRouteQuery 自动同步 URL 查询参数
const selectedOption = useRouteQuery('template', 'songlist', { transform: String })
const selectedTab = useRouteQuery('setting', 'general', { transform: String })

// 动态表单相关
const dynamicConfigRef = shallowRef()

const templateKey = computed(() => {
  if (selectedOption.value === 'schedule' || selectedOption.value === 'songlist') return selectedOption.value
  return 'songlist'
})

watch(
  () => selectedOption.value,
  (v) => {
    if (v === 'schedule' || v === 'songlist') return
    selectedOption.value = 'songlist'
  },
  { immediate: true },
)

watch(
  () => selectedTab.value,
  (v) => {
    if (v !== 'index') return
    selectedTab.value = 'general'
  },
  { immediate: true },
)

// 计算属性
const selectedTemplateData = computed(() => templates.value[templateKey.value])
const selectedTemplate = computed(() => selectedTemplateData.value.TemplateMap[selectedTemplateData.value.Selected])
const selectedComponent = computed(() => selectedTemplate.value.component)
const selectedTemplateConfig = computed(() => dynamicConfigRef.value?.Config ? dynamicConfigRef.value.Config : undefined)

// B站用户信息
const biliUserInfo = ref()

// 模态框控制
const settingModalVisiable = ref(false)

/**
 * 获取B站用户数据
 */
async function RequestBiliUserData() {
  try {
    const response = await fetch(`${FETCH_API}https://workers.vrp.moe/api/bilibili/user-info/10021741`)
    const data = await response.json()
    if (data.code == 0) {
      biliUserInfo.value = data.card
    } else {
      throw new Error(`Bili User API Error: ${data.message}`)
    }
  } catch (error) {
    console.error('获取B站用户数据失败:', error)
  }
}

/**
 * 保存功能启用状态
 */
async function SaveComboGroupSetting(
  value: (string | number)[],
  meta: { actionType: 'check' | 'uncheck', value: string | number },
) {
  if (!accountInfo.value) return

  isSaving.value = true
  try {
    const response = await SaveEnableFunctions(accountInfo.value.settings.enableFunctions)
    if (response.code !== 200) {
      message.error('修改失败')
      // 回滚修改
      if (accountInfo.value) {
        accountInfo.value.settings.enableFunctions = accountInfo.value.settings.enableFunctions.filter(
          f => f != (meta.value as FunctionTypes),
        )
      }
    }
  } catch (err) {
    message.error(`修改失败: ${err}`)
  } finally {
    isSaving.value = false
  }
}

/**
 * 保存账户设置
 */
async function SaveComboSetting() {
  if (!accountInfo.value) return

  isSaving.value = true
  try {
    const response = await SaveAccountSettings()
    if (response.code === 200) {
      message.success('已保存')
    } else {
      message.error('修改失败')
    }
  } catch (err) {
    message.error(`修改失败: ${err}`)
  } finally {
    isSaving.value = false
  }
}

/**
 * 保存模板设置
 */
async function SaveTemplateSetting() {
  if (!accountInfo.value) return

  // 根据选择的模板类型保存对应设置
  switch (selectedOption.value) {
    case 'songlist':
      accountInfo.value.settings.songListTemplate = selectedTemplateData.value.Selected ?? ''
      break
    case 'schedule':
      accountInfo.value.settings.scheduleTemplate = selectedTemplateData.value.Selected ?? ''
      break
  }

  await SaveComboSetting()
}

/**
 * 打开模板设置
 */
async function onOpenTemplateSettings() {
  settingModalVisiable.value = true
  nextTick(async () => {
    await getTemplateConfig()
  })
}

/**
 * 获取模板配置
 */
async function getTemplateConfig() {
  // 只获取未加载且有配置名的模板
  if (selectedTemplate.value && !selectedTemplateData.value.Config && selectedTemplate.value.settingName) {
    const name = selectedTemplate.value.settingName
    try {
      const response = await downloadConfigDirect(name)

      if (response.code === 200) {
        console.log(`已获取模板配置: ${name}`)
        selectedTemplateData.value.Config = JSON.parse(response.data)
      } else if (response.code === 404) {
        console.error(`未找到名为 ${name} 的配置文件`)
        // 使用默认配置
        selectedTemplateData.value.Config = dynamicConfigRef.value.DefaultConfig
      } else {
        message.error(`获取失败: ${response.message}`)
        console.error(`获取失败: ${response.message}`)
      }
    } catch (err) {
      message.error((err as Error).toString())
    }
  }
}

// 操作按钮组
const buttonGroup = computed(() => {
  return h(NSpace, () => [
    h(NButton, { type: 'primary', onClick: () => SaveTemplateSetting() }, () => '设为展示模板'),
    h(NButton, {
      type: 'info',
      onClick: onOpenTemplateSettings,
      disabled: !selectedTemplate.value.settingName,
    }, () => '模板设置'),
  ])
})

/**
 * 解除B站用户黑名单
 */
function unblockBiliUser(id: number) {
  DelBiliBlackList(id)
    .then((data) => {
      if (data.code === 200) {
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

/**
 * 解除普通用户黑名单
 */
function unblockUser(id: number) {
  DelBlackList(id)
    .then((data) => {
      if (data.code === 200) {
        message.success(`[${id}] 已移除黑名单`)
        if (accountInfo.value) {
          accountInfo.value.blackList = accountInfo.value.blackList.filter(u => u.id != id)
        }
      } else {
        message.error(data.message)
      }
    })
    .catch((err) => {
      message.error(err)
    })
}

// 路由激活时的处理（useRouteQuery 已自动处理参数同步）
onActivated(() => {
  // useRouteQuery 会自动同步，这里可以添加其他激活时的逻辑
})

// 组件挂载时初始化数据
onMounted(async () => {
  await RequestBiliUserData()
})
</script>

<template>
  <NCard
    title="设置"
    size="small"
    bordered
    :segmented="{ content: true }"
  >
    <NSpin :show="isSaving">
      <NTabs
        v-model:value="selectedTab"
        :default-value="$route.query.setting?.toString() ?? 'general'"
        type="line"
        animated
        size="small"
      >
        <!-- 常规设置标签页 -->
        <NTabPane
          tab="常规"
          name="general"
          display-directive="show:lazy"
        >
          <NDivider style="margin: 0">
            启用功能
          </NDivider>
          <NCheckboxGroup
            v-model:value="accountInfo.settings.enableFunctions"
            @update:value="SaveComboGroupSetting"
          >
            <NCheckbox :value="FunctionTypes.SongList">
              歌单
            </NCheckbox>
            <NCheckbox :value="FunctionTypes.QuestionBox">
              提问箱(棉花糖
            </NCheckbox>
            <NCheckbox :value="FunctionTypes.Schedule">
              日程
            </NCheckbox>
            <NCheckbox :value="FunctionTypes.LiveRequest">
              点歌
            </NCheckbox>
            <NCheckbox :value="FunctionTypes.Queue">
              排队
            </NCheckbox>
            <NCheckbox :value="FunctionTypes.CheckInRanking">
              签到排行
            </NCheckbox>
          </NCheckboxGroup>

          <NDivider> 通知 </NDivider>
          <NSpace>
            <NCheckbox
              v-model:checked="accountInfo.settings.sendEmail.recieveQA"
              @update:checked="SaveComboSetting"
            >
              收到新提问时发送邮件
            </NCheckbox>
            <NCheckbox
              v-model:checked="accountInfo.settings.sendEmail.recieveQAReply"
              @update:checked="SaveComboSetting"
            >
              提问收到回复时发送邮件
            </NCheckbox>
            <NCheckbox
              v-model:checked="accountInfo.settings.sendEmail.receiveOrder"
              @update:checked="SaveComboSetting"
            >
              积分礼物有新用户兑换时发送邮件
            </NCheckbox>
          </NSpace>

          <NDivider> 提问箱 </NDivider>
          <NSpace>
            <NCheckbox
              v-model:checked="accountInfo.settings.questionBox.allowUnregistedUser"
              @update:checked="SaveComboSetting"
            >
              允许未注册用户提问
            </NCheckbox>
          </NSpace>
        </NTabPane>

        <!-- 黑名单标签页 -->
        <NTabPane
          tab="黑名单"
          name="blacklist"
          display-directive="show:lazy"
        >
          <NFlex vertical :size="12">
            <NCard
              title="B 站黑名单"
              size="small"
              bordered
              :segmented="{ content: true }"
            >
              <NList v-if="accountInfo.biliBlackList && Object.keys(accountInfo.biliBlackList).length > 0">
                <NListItem
                  v-for="item in Object.entries(accountInfo.biliBlackList)"
                  :key="item[0]"
                >
                  <NFlex align="center" justify="space-between" :wrap="true" :size="12">
                    <NFlex align="center" :wrap="true" :size="8">
                      <NText>{{ item[1] }}</NText>
                      <NText depth="3" code>{{ item[0] }}</NText>
                    </NFlex>
                    <NButton
                      type="error"
                      size="small"
                      secondary
                      @click="unblockBiliUser(Number(item[0]))"
                    >
                      移除
                    </NButton>
                  </NFlex>
                </NListItem>
              </NList>
              <NEmpty v-else size="small" description="暂无 B 站黑名单" />
            </NCard>

            <NCard
              title="站内黑名单"
              size="small"
              bordered
              :segmented="{ content: true }"
            >
              <NList v-if="accountInfo.blackList && accountInfo.blackList.length > 0">
                <NListItem
                  v-for="item in accountInfo.blackList"
                  :key="item.id"
                >
                  <NFlex align="center" justify="space-between" :wrap="true" :size="12">
                    <NFlex align="center" :wrap="true" :size="8">
                      <NText>{{ item.name }}</NText>
                      <NText depth="3" code>{{ item.id }}</NText>
                    </NFlex>
                    <NButton
                      type="error"
                      size="small"
                      secondary
                      @click="unblockUser(Number(item.id))"
                    >
                      移除
                    </NButton>
                  </NFlex>
                </NListItem>
              </NList>
              <NEmpty v-else size="small" description="暂无站内黑名单" />
            </NCard>
          </NFlex>
        </NTabPane>

        <!-- 模板设置标签页 -->
        <NTabPane
          tab="模板"
          name="template"
          display-directive="show:lazy"
        >
          <NAlert type="success" size="small" :bordered="false">
            如果有合适的设计稿或者想法可以给我说然后做成模板捏
          </NAlert>
          <NFlex vertical :size="12">
            <NFlex align="center" :wrap="true" :size="12">
              <NText depth="2">
                页面
              </NText>
              <NSelect
                v-model:value="selectedOption"
                size="small"
                :options="templateOptions"
                style="width: 160px"
              />
            </NFlex>

            <NDivider style="margin: 0;" title-placement="left">
              模板
            </NDivider>

            <NFlex align="center" :wrap="true" :size="12">
              <NSelect
                v-model:value="selectedTemplateData.Selected"
                size="small"
                style="width: 180px"
                :options="selectedTemplateData.Options"
              />
              <component :is="buttonGroup" />
            </NFlex>

            <NDivider style="margin: 0;" />

            <Transition
              name="fade"
              mode="out-in"
            >
              <div
                v-if="selectedComponent"
                :key="selectedTemplateData.Selected"
              >
                <component
                  :is="selectedComponent"
                  ref="dynamicConfigRef"
                  :user-info="accountInfo"
                  :bili-info="biliUserInfo"
                  :data="selectedTemplateData.Data"
                  :config="selectedTemplateData.Config"
                  @vue:mounted="getTemplateConfig"
                />
              </div>
            </Transition>
          </NFlex>
        </NTabPane>
      </NTabs>
      <!-- 模板设置模态框 -->
      <NModal
        v-model:show="settingModalVisiable"
        preset="card"
        closable
        style="width: 1200px; max-width: 90vw"
        title="模板设置"
      >
        <NSpin
          v-if="!selectedTemplateData.Config"
          show
        />
        <DynamicForm
          v-else
          :key="selectedTemplateData.Selected"
          :name="selectedTemplateData.TemplateMap[selectedTemplateData.Selected].settingName"
          :config-data="selectedTemplateData.Config"
          :config="selectedTemplateConfig"
        />
      </NModal>
    </NSpin>
  </NCard>
</template>

<style scoped>
.settings-action-btn {
  max-width: 320px;
}

.settings-textarea {
  max-width: 720px;
}
</style>
