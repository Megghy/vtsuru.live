<script setup lang="ts">
import type { OpenLiveInfo, RequestCreateBulletVote, ResponseVoteSession, VoteConfig } from '@/api/api-models'
import { Add24Filled, Delete24Regular, Pause24Regular, Play24Regular, Settings24Regular, ShareAndroid24Regular } from '@vicons/fluent'
import {
  NAlert, NButton, NCard, NCheckbox, NColorPicker, NDivider, NEmpty, NIcon, NInput, NInputGroup, NInputGroupLabel, NInputNumber, NList, NListItem, NModal, NProgress, NRadio, NRadioGroup, NSelect, NFlex, NSpin, NSwitch, NTag, NText, NThing, useMessage } from 'naive-ui';
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { clearInterval, setInterval } from 'worker-timers'
import { QueryGetAPI, QueryPostAPI } from '@/api/query'
import { VOTE_API_URL } from '@/shared/config'
import { useDanmakuClient } from '@/store/useDanmakuClient'
import { copyToClipboard } from '@/shared/utils'
import OpenLivePageHeader from '@/apps/open-live/components/OpenLivePageHeader.vue'
import { usePersistedStorage } from '@/shared/storage/persist'

defineProps<{
  roomInfo?: OpenLiveInfo
  code?: string | undefined
  isOpenLive?: boolean
}>()

// 账号信息
const message = useMessage()
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

const nowMs = ref<number>(Date.now())
const timeLeftMs = computed(() => {
  if (!currentVote.value?.endTime) return null
  const remain = currentVote.value.endTime * 1000 - nowMs.value
  return Math.max(0, remain)
})

function formatRemain(ms: number | null | undefined) {
  if (ms == null) return '--:--'
  const total = Math.floor(ms / 1000)
  const mm = Math.floor(total / 60).toString().padStart(2, '0')
  const ss = (total % 60).toString().padStart(2, '0')
  return `${mm}:${ss}`
}

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

    if (result.code === 200 && result.data) {
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

    if (result.code === 200) {
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

    if (result.code === 200) {
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

    if (result.code === 200 && result.data) {
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

// 导入默认选项
function importDefaultOptions() {
  const opts = voteConfig.value.defaultOptions || []
  newVoteOptions.value = [...opts]
  while (newVoteOptions.value.length < 2) {
    newVoteOptions.value.push('')
  }
}

// 从历史复刻
function reuseVote(vote: ResponseVoteSession) {
  newVoteTitle.value = vote.title
  newVoteOptions.value = vote.options.map(o => o.text)
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

  const tickInterval = setInterval(() => {
    nowMs.value = Date.now()
  }, 1000)

  onUnmounted(() => {
    clearInterval(pollInterval)
    clearInterval(tickInterval)
    client.dispose()
  })
})

// 监视配置变化，更新创建表单中的默认值
watch(() => voteConfig.value, (newConfig) => {
  newVoteDuration.value = newConfig.voteDurationSeconds
}, { immediate: true })

// 初始模板
const savedTemplates = usePersistedStorage<{ title: string, options: string[] }[]>('DanmakuVoteTemplates', [])
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
  <NFlex vertical :size="12">
    <NCard size="small" bordered :segmented="{ content: true }">
      <OpenLivePageHeader
        title="弹幕投票"
        description="观众通过发送指定格式的弹幕参与投票，可自定义标题、选项与显示样式。"
      >
        <template #actions>
          <NFlex align="center" :wrap="true" :size="10">
            <NButton
              secondary
              size="small"
              class="open-live-action-btn"
              @click="showSettingsModal = true"
            >
              <template #icon>
                <NIcon><Settings24Regular /></NIcon>
              </template>
              设置
            </NButton>
            <NButton
              type="info"
              size="small"
              class="open-live-action-btn"
              @click="copyObsLink"
            >
              <template #icon>
                <NIcon><ShareAndroid24Regular /></NIcon>
              </template>
              复制 OBS 链接
            </NButton>
          </NFlex>
        </template>
      </OpenLivePageHeader>

      <NAlert type="info" size="small" :bordered="false">
        提示：默认触发格式为 “{{ voteConfig.voteCommand }} 选项编号/内容”，也可在设置中自定义。
      </NAlert>
    </NCard>

    <NCard title="投票控制" size="small" bordered>
      <NSpin :show="isLoading">
        <NFlex vertical :size="12">
          <NFlex align="center" justify="space-between" :wrap="true" :size="12">
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

            <NTag
              v-if="currentVote?.isActive"
              type="success"
              size="small"
              :bordered="false"
            >
              进行中
            </NTag>
          </NFlex>

          <NDivider style="margin: 0" />

          <NAlert
            v-if="!voteConfig.isEnabled"
            type="warning"
            size="small"
            :bordered="false"
          >
            投票功能已禁用，请先在设置中启用功能。
          </NAlert>

          <template v-else-if="currentVote && currentVote.isActive">
            <NFlex vertical :size="12">
              <NFlex align="center" justify="space-between" :wrap="true" :size="12">
                <NFlex align="center" :wrap="true" :size="8">
                  <NText strong class="vote-title">
                    {{ currentVote.title }}
                  </NText>
                  <NTag
                    v-if="timeLeftMs !== null"
                    type="warning"
                    size="small"
                    :bordered="false"
                  >
                    剩余: {{ formatRemain(timeLeftMs) }}
                  </NTag>
                </NFlex>
                <NButton type="warning" size="small" @click="endVote">
                  <template #icon>
                    <NIcon><Pause24Regular /></NIcon>
                  </template>
                  结束投票
                </NButton>
              </NFlex>

              <NText depth="3">
                总票数: {{ currentVote.totalVotes }}
              </NText>

              <div
                v-for="(option, index) in currentVote.options"
                :key="index"
              >
                <NFlex vertical size="small">
                  <NFlex align="center" justify="space-between" :wrap="true" :size="8">
                    <NText>{{ index + 1 }}. {{ option.text }}</NText>
                    <NFlex align="center" :wrap="true" :size="6">
                      <NTag type="success" size="small" :bordered="false">
                        {{ option.count }}票
                      </NTag>
                      <NTag size="small" :bordered="false">
                        {{ calculatePercentage(option.count, currentVote.totalVotes) }}%
                      </NTag>
                    </NFlex>
                  </NFlex>
                  <NProgress
                    type="line"
                    :percentage="calculatePercentage(option.count, currentVote.totalVotes)"
                    :height="10"
                  />
                </NFlex>
                <NDivider v-if="index < currentVote.options.length - 1" style="margin: 10px 0" />
              </div>
            </NFlex>
          </template>

          <template v-else>
            <NFlex vertical :size="12">
              <NInput
                v-model:value="newVoteTitle"
                placeholder="投票标题"
                size="small"
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
                    size="small"
                  />
                  <NButton
                    quaternary
                    size="small"
                    :disabled="newVoteOptions.length <= 2"
                    @click="removeOption(index)"
                  >
                    <template #icon>
                      <NIcon><Delete24Regular /></NIcon>
                    </template>
                  </NButton>
                </NInputGroup>
              </div>

              <NFlex align="center" :wrap="true" :size="10">
                <NButton size="small" @click="addOption">
                  <template #icon>
                    <NIcon><Add24Filled /></NIcon>
                  </template>
                  添加选项
                </NButton>
                <NButton secondary size="small" @click="importDefaultOptions">
                  导入默认选项
                </NButton>
              </NFlex>

              <NFlex align="center" :wrap="true" :size="12">
                <NInputGroup>
                  <NInputGroupLabel>持续时间</NInputGroupLabel>
                  <NInputNumber
                    v-model:value="newVoteDuration"
                    :min="10"
                    class="vote-duration"
                    size="small"
                  >
                    <template #suffix>
                      秒
                    </template>
                  </NInputNumber>
                </NInputGroup>

                <NCheckbox v-model:checked="newVoteAllowMultiple">
                  允许重复投票
                </NCheckbox>
              </NFlex>

              <NFlex justify="end">
                <NButton type="primary" size="small" @click="createVote">
                  <template #icon>
                    <NIcon><Play24Regular /></NIcon>
                  </template>
                  开始投票
                </NButton>
              </NFlex>
            </NFlex>
          </template>
        </NFlex>
      </NSpin>
    </NCard>

    <NCard
      v-if="!currentVote?.isActive && voteConfig.isEnabled"
      title="保存/加载模板"
      size="small"
      bordered
    >
      <NFlex vertical :size="12">
        <NFlex align="center" :wrap="true" :size="10">
          <NInput
            v-model:value="templateName"
            placeholder="模板名称"
            size="small"
          />
          <NButton size="small" @click="saveTemplate">
            保存当前投票为模板
          </NButton>
        </NFlex>

        <NDivider v-if="savedTemplates.length > 0" style="margin: 0" />

        <NEmpty
          v-if="savedTemplates.length === 0"
          description="暂无保存的模板"
          size="small"
        />

        <NList v-else size="small" bordered>
          <NListItem
            v-for="(template, index) in savedTemplates"
            :key="index"
          >
            <NThing :title="template.title">
              <template #description>
                <NText depth="3">
                  选项数: {{ template.options.length }}
                </NText>
              </template>
              <template #action>
                <NFlex :size="8">
                  <NButton size="small" @click="loadTemplate(template)">
                    加载
                  </NButton>
                  <NButton size="small" secondary type="error" @click="deleteTemplate(index)">
                    删除
                  </NButton>
                </NFlex>
              </template>
            </NThing>
          </NListItem>
        </NList>
      </NFlex>
    </NCard>

    <NCard
      v-if="voteHistoryTab.length > 0 && voteConfig.isEnabled"
      title="投票历史"
      size="small"
      bordered
    >
      <NList size="small" bordered>
        <NListItem
          v-for="vote in voteHistoryTab"
          :key="vote.id"
        >
          <NThing :title="vote.title">
            <template #description>
              <NFlex vertical size="small">
                <NText depth="3">
                  开始于: {{ new Date(vote.startTime * 1000).toLocaleString() }}
                  <span v-if="vote.endTime">
                    - 结束于: {{ new Date(vote.endTime * 1000).toLocaleString() }}
                  </span>
                </NText>
                <NText>总票数: {{ vote.totalVotes }}</NText>
                <NFlex
                  v-for="(option, index) in vote.options"
                  :key="index"
                  :wrap="true"
                  :size="8"
                >
                  <NTag size="small" :bordered="false">
                    {{ option.text }}: {{ option.count }}票 ({{ calculatePercentage(option.count, vote.totalVotes) }}%)
                  </NTag>
                </NFlex>
              </NFlex>
            </template>
            <template #action>
              <NFlex :size="8">
                <NButton size="small" type="primary" @click="reuseVote(vote)">
                  复刻
                </NButton>
                <NButton size="small" secondary type="error" @click="deleteVote(vote.id)">
                  删除
                </NButton>
              </NFlex>
            </template>
          </NThing>
        </NListItem>
      </NList>
    </NCard>
  </NFlex>

  <NModal
    v-model:show="showSettingsModal"
    preset="card"
    title="投票设置"
    style="width: 900px; max-width: 90vw"
  >
    <NSpin :show="isLoading">
      <NFlex vertical :size="12">
        <NFlex vertical :size="10">
          <NText strong>
            基本设置
          </NText>

          <NInputGroup>
            <NInputGroupLabel>触发命令</NInputGroupLabel>
            <NInput v-model:value="voteConfig.voteCommand" size="small" />
          </NInputGroup>

          <NInputGroup>
            <NInputGroupLabel>结束命令</NInputGroupLabel>
            <NInput v-model:value="voteConfig.voteEndCommand" size="small" />
          </NInputGroup>

          <NInputGroup>
            <NInputGroupLabel>默认标题</NInputGroupLabel>
            <NInput v-model:value="voteConfig.voteTitle" size="small" />
          </NInputGroup>

          <NInputGroup>
            <NInputGroupLabel>默认时长</NInputGroupLabel>
            <NInputNumber
              v-model:value="voteConfig.voteDurationSeconds"
              :min="10"
              size="small"
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
        </NFlex>

        <NDivider style="margin: 0" />

        <NFlex vertical :size="10">
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
              size="small"
            >
              <template #suffix>
                元
              </template>
            </NInputNumber>
          </NInputGroup>

          <NRadioGroup v-model:value="voteConfig.voteResultMode">
            <NFlex :size="12">
              <NRadio :value="0">
                按人数计票
              </NRadio>
              <NRadio :value="1">
                按礼物价值
              </NRadio>
            </NFlex>
          </NRadioGroup>
        </NFlex>

        <NDivider style="margin: 0" />

        <NFlex vertical :size="10">
          <NText strong>
            显示设置
          </NText>

          <NFlex :wrap="true" :size="12">
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
          </NFlex>

          <NFlex align="center" :wrap="true" :size="12">
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
                size="small"
                style="width: 140px"
              />
            </NInputGroup>
          </NFlex>
        </NFlex>

        <NFlex justify="end" :size="8">
          <NButton size="small" @click="showSettingsModal = false">
            取消
          </NButton>
          <NButton type="primary" size="small" @click="saveVoteConfig">
            保存
          </NButton>
        </NFlex>
      </NFlex>
    </NSpin>
  </NModal>
</template>

<style scoped>
.vote-title {
  font-size: 1.1em;
}

.vote-duration {
  width: 120px;
}
</style>
