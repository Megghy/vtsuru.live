<script setup lang="ts">
import type { OpenLiveInfo, RequestCreateBulletVote, ResponseVoteSession, VoteConfig } from '@/api/api-models'
import { Add24Filled, Delete24Regular, Info24Filled, Pause24Regular, Play24Regular, Settings24Regular, ShareAndroid24Regular } from '@vicons/fluent'
import { useStorage } from '@vueuse/core'
import {
  NAlert,
  NButton,
  NCard,
  NCheckbox,
  NColorPicker,
  NDivider,
  NEmpty,
  NIcon,
  NInput,
  NInputGroup,
  NInputGroupLabel,
  NInputNumber,
  NList,
  NListItem,
  NModal,
  NProgress,
  NRadio,
  NRadioGroup,
  NSelect,
  NSpace,
  NSpin,
  NSwitch,
  NTag,
  NText,
  NThing,
  useMessage,
} from 'naive-ui'
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { clearInterval, setInterval } from 'worker-timers'
import { useAccount } from '@/api/account'
import { QueryGetAPI, QueryPostAPI } from '@/api/query'
import { VOTE_API_URL } from '@/data/constants'
import { useDanmakuClient } from '@/store/useDanmakuClient'
import { copyToClipboard } from '@/Utils'

const props = defineProps<{
  roomInfo?: OpenLiveInfo
  code?: string | undefined
  isOpenLive?: boolean
}>()

// 账号信息
const accountInfo = useAccount()
const message = useMessage()
const route = useRoute()
const client = useDanmakuClient()

// 投票配置
const voteConfig = ref<VoteConfig>({
  isEnabled: false,
  showResults: true,
  voteDurationSeconds: 60,
  voteCommand: '投票',
  voteEndCommand: '结束投票',
  voteTitle: '投票',
  allowMultipleOptions: false,
  allowMultipleVotes: false,
  allowCustomOptions: false,
  logVotes: true,
  defaultOptions: ['选项1', '选项2'],
  backgroundColor: '#1e1e2e',
  textColor: '#ffffff',
  optionColor: '#89b4fa',
  roundedCorners: true,
  displayPosition: 'right',
  allowGiftVoting: false,
  minGiftPrice: 1,
  voteResultMode: 0,
})

// 当前投票会话
const currentVote = ref<ResponseVoteSession | null>(null)
const isLoading = ref(false)
const showSettingsModal = ref(false)
const voteHistoryTab = ref<ResponseVoteSession[]>([])

// 创建投票相关
const newVoteTitle = ref('')
const newVoteOptions = ref<string[]>(['', ''])
const newVoteDuration = ref(60)
const newVoteAllowMultiple = ref(false)

// 添加新选项
function addOption() {
  newVoteOptions.value.push('')
}

// 移除选项
function removeOption(index: number) {
  newVoteOptions.value.splice(index, 1)
}

// 获取当前用户的投票配置
async function fetchVoteConfig() {
  try {
    isLoading.value = true
    const result = await QueryGetAPI<VoteConfig>(`${VOTE_API_URL}get-config`)

    if (result.code === 0 && result.data) {
      voteConfig.value = result.data
    }
  } catch (error) {
    console.error('获取投票配置失败:', error)
    message.error('获取投票配置失败')
  } finally {
    isLoading.value = false
  }
}

// 保存投票配置
async function saveVoteConfig() {
  try {
    isLoading.value = true
    const result = await QueryPostAPI<any>(`${VOTE_API_URL}save-config`, voteConfig.value)

    if (result.code === 0) {
      message.success('投票配置保存成功')
      showSettingsModal.value = false
    } else {
      message.error(`保存失败: ${result.message}`)
    }
  } catch (error) {
    console.error('保存投票配置失败:', error)
    message.error('保存投票配置失败')
  } finally {
    isLoading.value = false
  }
}

// 获取当前活跃投票
async function fetchActiveVote() {
  try {
    const result = await QueryGetAPI<ResponseVoteSession>(`${VOTE_API_URL}get-active`)

    if (result.code === 0) {
      currentVote.value = result.data
    }
  } catch (error) {
    console.error('获取当前投票失败:', error)
  }
}

// 获取投票历史
async function fetchVoteHistory() {
  try {
    const result = await QueryGetAPI<ResponseVoteSession[]>(`${VOTE_API_URL}history`, { limit: 10, offset: 0 })

    if (result.code === 0) {
      voteHistoryTab.value = result.data
    }
  } catch (error) {
    console.error('获取投票历史失败:', error)
  }
}

// 创建投票
async function createVote() {
  // 验证投票选项
  if (!newVoteTitle.value) {
    message.error('请输入投票标题')
    return
  }

  const filteredOptions = newVoteOptions.value.filter(opt => opt.trim() !== '')
  if (filteredOptions.length < 2) {
    message.error('至少需要两个投票选项')
    return
  }

  const createVoteData: RequestCreateBulletVote = {
    title: newVoteTitle.value,
    options: filteredOptions,
    allowMultipleVotes: newVoteAllowMultiple.value,
    durationSeconds: newVoteDuration.value,
  }

  try {
    isLoading.value = true
    const result = await QueryPostAPI<ResponseVoteSession>(`${VOTE_API_URL}create`, createVoteData)

    if (result.code === 200) {
      message.success('投票创建成功')
      currentVote.value = result.data
      resetCreateVoteForm()
    } else {
      message.error(`创建失败: ${result.message}`)
    }
  } catch (error) {
    console.error('创建投票失败:', error)
    message.error('创建投票失败')
  } finally {
    isLoading.value = false
  }
}

// 重置创建投票表单
function resetCreateVoteForm() {
  newVoteTitle.value = ''
  newVoteOptions.value = ['', '']
  newVoteDuration.value = voteConfig.value.voteDurationSeconds
  newVoteAllowMultiple.value = false
}

// 结束投票
async function endVote() {
  if (!currentVote.value) return

  try {
    isLoading.value = true
    const result = await QueryGetAPI<ResponseVoteSession>(`${VOTE_API_URL}end`, { id: currentVote.value.id })

    if (result.code === 200) {
      message.success('投票已结束')
      currentVote.value = result.data
      await fetchVoteHistory()
    } else {
      message.error(`结束失败: ${result.message}`)
    }
  } catch (error) {
    console.error('结束投票失败:', error)
    message.error('结束投票失败')
  } finally {
    isLoading.value = false
  }
}

// 删除投票
async function deleteVote(id: number) {
  try {
    isLoading.value = true
    const result = await QueryGetAPI<any>(`${VOTE_API_URL}delete`, { id })

    if (result.code === 200) {
      message.success('投票已删除')
      await fetchVoteHistory()
      if (currentVote.value?.id === id) {
        currentVote.value = null
      }
    } else {
      message.error(`删除失败: ${result.message}`)
    }
  } catch (error) {
    console.error('删除投票失败:', error)
    message.error('删除投票失败')
  } finally {
    isLoading.value = false
  }
}

// 复制OBS链接
function copyObsLink() {
  const baseUrl = window.location.origin
  const roomId = props.roomInfo?.anchor_info?.room_id || route.query.roomId

  // 获取配置哈希
  fetchVoteHash().then((hash) => {
    if (hash) {
      const obsUrl = `${baseUrl}/obs/danmaku-vote?hash=${hash}`
      copyToClipboard(obsUrl)
      message.success('OBS链接已复制到剪贴板')
    }
  })
}

// 获取投票配置哈希
async function fetchVoteHash(): Promise<string | null> {
  try {
    const result = await QueryGetAPI<string>(`${VOTE_API_URL}get-hash`)

    if (result.code === 0 && result.data) {
      return result.data
    }
    return null
  } catch (error) {
    console.error('获取投票哈希失败:', error)
    message.error('获取投票哈希失败')
    return null
  }
}

// 计算每个选项的百分比
function calculatePercentage(count: number, totalVotes: number) {
  if (totalVotes === 0) return 0
  return Math.round((count / totalVotes) * 100)
}

// 加载模板
function loadTemplate(template: { title: string, options: string[] }) {
  newVoteTitle.value = template.title
  newVoteOptions.value = [...template.options]
  // 确保至少有两个选项
  while (newVoteOptions.value.length < 2) {
    newVoteOptions.value.push('')
  }
}

// 初始化和轮询
onMounted(async () => {
  // 初始化弹幕客户端
  await client.initOpenlive()

  // 获取投票配置
  await fetchVoteConfig()

  // 获取当前活跃投票和历史记录
  await fetchActiveVote()
  await fetchVoteHistory()

  // 设置轮询，每5秒获取一次当前投票数据
  const pollInterval = setInterval(async () => {
    await fetchActiveVote()
  }, 5000)

  onUnmounted(() => {
    clearInterval(pollInterval)
    client.dispose()
  })
})

// 监视配置变化，更新创建表单中的默认值
watch(() => voteConfig.value, (newConfig) => {
  newVoteDuration.value = newConfig.voteDurationSeconds
}, { immediate: true })

// 初始模板
const savedTemplates = useStorage<{ title: string, options: string[] }[]>('DanmakuVoteTemplates', [])
const templateName = ref('')

// 保存模板
function saveTemplate() {
  if (!templateName.value) {
    message.error('请输入模板名称')
    return
  }

  const filteredOptions = newVoteOptions.value.filter(opt => opt.trim() !== '')
  if (filteredOptions.length < 2) {
    message.error('至少需要两个有效的投票选项')
    return
  }

  savedTemplates.value.push({
    title: templateName.value,
    options: filteredOptions,
  })

  templateName.value = ''
  message.success('模板保存成功')
}

// 删除模板
function deleteTemplate(index: number) {
  savedTemplates.value.splice(index, 1)
}
</script>

<template>
  <NSpace vertical>
    <NAlert type="info">
      <template #icon>
        <NIcon>
          <Info24Filled />
        </NIcon>
      </template>
      弹幕投票功能让观众可以通过发送特定格式的弹幕参与投票。您可以自定义投票的标题、选项和外观。
    </NAlert>

    <NCard
      title="投票控制"
      size="small"
    >
      <NSpin :show="isLoading">
        <NSpace vertical>
          <NSpace>
            <NSwitch
              v-model:value="voteConfig.isEnabled"
              @update:value="saveVoteConfig"
            >
              <template #checked>
                已启用
              </template>
              <template #unchecked>
                已禁用
              </template>
            </NSwitch>
            <NButton
              secondary
              @click="showSettingsModal = true"
            >
              <template #icon>
                <NIcon><Settings24Regular /></NIcon>
              </template>
              设置
            </NButton>
            <NButton
              type="info"
              @click="copyObsLink"
            >
              <template #icon>
                <NIcon><ShareAndroid24Regular /></NIcon>
              </template>
              复制OBS链接
            </NButton>
          </NSpace>

          <NDivider />

          <div v-if="!voteConfig.isEnabled">
            <NAlert type="warning">
              投票功能已禁用，请先在设置中启用功能。
            </NAlert>
          </div>
          <div v-else-if="currentVote && currentVote.isActive">
            <NCard
              title="进行中的投票"
              size="small"
            >
              <NSpace vertical>
                <NSpace justify="space-between">
                  <NText
                    strong
                    style="font-size: 1.2em"
                  >
                    {{ currentVote.title }}
                  </NText>
                  <NButton
                    type="warning"
                    @click="endVote"
                  >
                    <template #icon>
                      <NIcon><Pause24Regular /></NIcon>
                    </template>
                    结束投票
                  </NButton>
                </NSpace>

                <NText>总票数: {{ currentVote.totalVotes }}</NText>

                <div
                  v-for="(option, index) in currentVote.options"
                  :key="index"
                >
                  <NSpace
                    vertical
                    size="small"
                  >
                    <NSpace justify="space-between">
                      <NText>{{ index + 1 }}. {{ option.text }}</NText>
                      <NSpace>
                        <NTag type="success">
                          {{ option.count }}票
                        </NTag>
                        <NTag>{{ calculatePercentage(option.count, currentVote.totalVotes) }}%</NTag>
                      </NSpace>
                    </NSpace>
                    <NProgress
                      type="line"
                      :percentage="calculatePercentage(option.count, currentVote.totalVotes)"
                      :height="12"
                    />
                  </NSpace>
                  <NDivider v-if="index < currentVote.options.length - 1" />
                </div>
              </NSpace>
            </NCard>
          </div>
          <div v-else>
            <NSpace vertical>
              <NInput
                v-model:value="newVoteTitle"
                placeholder="投票标题"
              />

              <div
                v-for="(option, index) in newVoteOptions"
                :key="index"
              >
                <NInputGroup>
                  <NInputGroupLabel>{{ index + 1 }}</NInputGroupLabel>
                  <NInput
                    v-model:value="newVoteOptions[index]"
                    placeholder="选项内容"
                  />
                  <NButton
                    quaternary
                    :disabled="newVoteOptions.length <= 2"
                    @click="removeOption(index)"
                  >
                    <template #icon>
                      <NIcon><Delete24Regular /></NIcon>
                    </template>
                  </NButton>
                </NInputGroup>
              </div>

              <NSpace>
                <NButton @click="addOption">
                  <template #icon>
                    <NIcon><Add24Filled /></NIcon>
                  </template>
                  添加选项
                </NButton>
              </NSpace>

              <NSpace>
                <NInputGroup>
                  <NInputGroupLabel>持续时间</NInputGroupLabel>
                  <NInputNumber
                    v-model:value="newVoteDuration"
                    :min="10"
                    style="width: 100px"
                  >
                    <template #suffix>
                      秒
                    </template>
                  </NInputNumber>
                </NInputGroup>

                <NCheckbox v-model:checked="newVoteAllowMultiple">
                  允许重复投票
                </NCheckbox>
              </NSpace>

              <NSpace justify="end">
                <NButton
                  type="primary"
                  @click="createVote"
                >
                  <template #icon>
                    <NIcon><Play24Regular /></NIcon>
                  </template>
                  开始投票
                </NButton>
              </NSpace>
            </NSpace>
          </div>
        </NSpace>
      </NSpin>
    </NCard>

    <NCard
      v-if="!currentVote?.isActive && voteConfig.isEnabled"
      title="保存/加载模板"
      size="small"
    >
      <NSpace vertical>
        <NSpace>
          <NInput
            v-model:value="templateName"
            placeholder="模板名称"
          />
          <NButton @click="saveTemplate">
            保存当前投票为模板
          </NButton>
        </NSpace>

        <NDivider v-if="savedTemplates.length > 0" />

        <NEmpty
          v-if="savedTemplates.length === 0"
          description="暂无保存的模板"
        />

        <NList v-else>
          <NListItem
            v-for="(template, index) in savedTemplates"
            :key="index"
          >
            <NThing :title="template.title">
              <template #description>
                <NText>选项数: {{ template.options.length }}</NText>
              </template>
              <template #action>
                <NSpace>
                  <NButton
                    size="small"
                    @click="loadTemplate(template)"
                  >
                    加载
                  </NButton>
                  <NButton
                    size="small"
                    @click="deleteTemplate(index)"
                  >
                    删除
                  </NButton>
                </NSpace>
              </template>
            </NThing>
          </NListItem>
        </NList>
      </NSpace>
    </NCard>

    <NCard
      v-if="voteHistoryTab.length > 0 && voteConfig.isEnabled"
      title="投票历史"
      size="small"
    >
      <NList>
        <NListItem
          v-for="vote in voteHistoryTab"
          :key="vote.id"
        >
          <NThing :title="vote.title">
            <template #description>
              <NSpace
                vertical
                size="small"
              >
                <NText depth="3">
                  开始于: {{ new Date(vote.startTime * 1000).toLocaleString() }}
                  <span v-if="vote.endTime">
                    - 结束于: {{ new Date(vote.endTime * 1000).toLocaleString() }}
                  </span>
                </NText>
                <NText>总票数: {{ vote.totalVotes }}</NText>
                <NSpace
                  v-for="(option, index) in vote.options"
                  :key="index"
                >
                  <NTag>{{ option.text }}: {{ option.count }}票 ({{ calculatePercentage(option.count, vote.totalVotes) }}%)</NTag>
                </NSpace>
              </NSpace>
            </template>
            <template #action>
              <NButton
                size="small"
                type="error"
                @click="deleteVote(vote.id)"
              >
                删除
              </NButton>
            </template>
          </NThing>
        </NListItem>
      </NList>
    </NCard>
  </NSpace>

  <!-- 设置弹窗 -->
  <NModal
    v-model:show="showSettingsModal"
    preset="card"
    title="投票设置"
    style="width: 600px"
  >
    <NSpin :show="isLoading">
      <NSpace vertical>
        <NSpace vertical>
          <NText strong>
            基本设置
          </NText>

          <NInputGroup>
            <NInputGroupLabel>触发命令</NInputGroupLabel>
            <NInput v-model:value="voteConfig.voteCommand" />
          </NInputGroup>

          <NInputGroup>
            <NInputGroupLabel>结束命令</NInputGroupLabel>
            <NInput v-model:value="voteConfig.voteEndCommand" />
          </NInputGroup>

          <NInputGroup>
            <NInputGroupLabel>默认标题</NInputGroupLabel>
            <NInput v-model:value="voteConfig.voteTitle" />
          </NInputGroup>

          <NInputGroup>
            <NInputGroupLabel>默认时长</NInputGroupLabel>
            <NInputNumber
              v-model:value="voteConfig.voteDurationSeconds"
              :min="10"
            >
              <template #suffix>
                秒
              </template>
            </NInputNumber>
          </NInputGroup>

          <NCheckbox v-model:checked="voteConfig.showResults">
            实时显示投票结果
          </NCheckbox>

          <NCheckbox v-model:checked="voteConfig.allowMultipleVotes">
            允许重复投票
          </NCheckbox>

          <NCheckbox v-model:checked="voteConfig.logVotes">
            记录投票详情
          </NCheckbox>
        </NSpace>

        <NDivider />

        <NSpace vertical>
          <NText strong>
            礼物投票
          </NText>

          <NCheckbox v-model:checked="voteConfig.allowGiftVoting">
            允许通过礼物投票
          </NCheckbox>

          <NInputGroup v-if="voteConfig.allowGiftVoting">
            <NInputGroupLabel>最低礼物金额</NInputGroupLabel>
            <NInputNumber
              v-model:value="voteConfig.minGiftPrice"
              :min="0.1"
              :precision="1"
            >
              <template #suffix>
                元
              </template>
            </NInputNumber>
          </NInputGroup>

          <NRadioGroup v-model:value="voteConfig.voteResultMode">
            <NSpace>
              <NRadio :value="0">
                按人数计票
              </NRadio>
              <NRadio :value="1">
                按礼物价值
              </NRadio>
            </NSpace>
          </NRadioGroup>
        </NSpace>

        <NDivider />

        <NSpace vertical>
          <NText strong>
            显示设置
          </NText>

          <NSpace>
            <NInputGroup>
              <NInputGroupLabel>背景颜色</NInputGroupLabel>
              <NColorPicker v-model:value="voteConfig.backgroundColor" />
            </NInputGroup>

            <NInputGroup>
              <NInputGroupLabel>文本颜色</NInputGroupLabel>
              <NColorPicker v-model:value="voteConfig.textColor" />
            </NInputGroup>

            <NInputGroup>
              <NInputGroupLabel>选项颜色</NInputGroupLabel>
              <NColorPicker v-model:value="voteConfig.optionColor" />
            </NInputGroup>
          </NSpace>

          <NSpace>
            <NCheckbox v-model:checked="voteConfig.roundedCorners">
              圆角显示
            </NCheckbox>

            <NInputGroup>
              <NInputGroupLabel>显示位置</NInputGroupLabel>
              <NSelect
                v-model:value="voteConfig.displayPosition"
                :options="[
                  { label: '左侧', value: 'left' },
                  { label: '右侧', value: 'right' },
                  { label: '顶部', value: 'top' },
                  { label: '底部', value: 'bottom' },
                ]"
                style="width: 120px"
              />
            </NInputGroup>
          </NSpace>
        </NSpace>

        <NSpace justify="end">
          <NButton @click="showSettingsModal = false">
            取消
          </NButton>
          <NButton
            type="primary"
            @click="saveVoteConfig"
          >
            保存
          </NButton>
        </NSpace>
      </NSpace>
    </NSpin>
  </NModal>
</template>
