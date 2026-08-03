<script setup lang="ts">
const Settings24Regular = 'i-lucide-circle'
const ReorderThreeOutline = 'i-lucide-circle'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { VueDraggable } from 'vue-draggable-plus'
import { clearInterval, setInterval } from 'worker-timers'

import type { OpenLiveInfo, RequestCreateBulletVote, ResponseVoteSession, VoteConfig } from '@/api/api-models'
import { QueryGetAPI, QueryPostAPI } from '@/api/query'
import OpenLivePageHeader from '@/apps/open-live/components/OpenLivePageHeader.vue'
import { VOTE_API_URL } from '@/shared/config'
import { usePersistedStorage } from '@/shared/storage/persist'
import { copyToClipboard } from '@/shared/utils'
import { useDanmakuClient } from '@/store/useDanmakuClient'

defineProps<{
  roomInfo?: OpenLiveInfo
  code?: string | undefined
  isOpenLive?: boolean
}>()

// 账号信息
const toast = useToast()
const feedback = (color: 'success' | 'error' | 'warning' | 'info', title: string) => {
  toast.add({ title, color })
}
const client = useDanmakuClient()

// 投票配置
const voteConfig = ref<VoteConfig>({
  isEnabled: false,
  showResults: true,
  voteDurationSeconds: 60,
  voteCommand: '投票',
  voteEndCommand: '结束投票',
  voteTitle: '投票',
  allowMultipleVotes: false,
  allowCustomOptions: false,
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

interface VoteFormOption {
  id: string
  text: string
}

function createVoteFormOption(text = ''): VoteFormOption {
  return {
    id: crypto.randomUUID(),
    text,
  }
}

const nowMs = ref<number>(Date.now())
const timeLeftMs = computed(() => {
  if (!currentVote.value?.endTime) return null
  const remain = currentVote.value.endTime * 1000 - nowMs.value
  return Math.max(0, remain)
})

function formatRemain(ms: number | null | undefined) {
  if (ms == null) return '--:--'
  const total = Math.floor(ms / 1000)
  const mm = Math.floor(total / 60)
    .toString()
    .padStart(2, '0')
  const ss = (total % 60).toString().padStart(2, '0')
  return `${mm}:${ss}`
}

// 当前投票的领先选项索引（用于高亮），并列或无票时返回 -1
const leadingOptionIndex = computed(() => {
  const options = currentVote.value?.options
  if (!options?.length || !currentVote.value?.totalVotes) return -1
  let maxCount = -1
  let leader = -1
  let tie = false
  options.forEach((option, index) => {
    if (option.count > maxCount) {
      maxCount = option.count
      leader = index
      tie = false
    } else if (option.count === maxCount) {
      tie = true
    }
  })
  return tie || maxCount <= 0 ? -1 : leader
})

// 快捷时长预设（秒）
const durationPresets = [30, 60, 120, 300]

// 创建投票相关
const newVoteTitle = ref('')
const newVoteOptions = ref<VoteFormOption[]>([createVoteFormOption(), createVoteFormOption()])
const voteOptionNumberDrafts = ref<Record<string, number | null>>({})
const newVoteDuration = ref(60)
const newVoteAllowMultiple = ref(false)

// 添加新选项
function addOption() {
  newVoteOptions.value.push(createVoteFormOption())
}

// 移除选项
function removeOption(index: number) {
  newVoteOptions.value.splice(index, 1)
}

function setVoteFormOptions(options: string[]) {
  newVoteOptions.value = options.map((option) => createVoteFormOption(option))
  while (newVoteOptions.value.length < 2) {
    newVoteOptions.value.push(createVoteFormOption())
  }
  voteOptionNumberDrafts.value = {}
}

function getVoteOptionTexts() {
  return newVoteOptions.value.map((option) => option.text.trim()).filter((text) => text !== '')
}

function getVoteOptionNumberValue(optionId: string, index: number) {
  return Object.prototype.hasOwnProperty.call(voteOptionNumberDrafts.value, optionId)
    ? voteOptionNumberDrafts.value[optionId]
    : index + 1
}

function setVoteOptionNumberDraft(optionId: string, value: number | null) {
  voteOptionNumberDrafts.value[optionId] = value
}

function applyVoteOptionNumber(optionId: string) {
  const targetNumber = voteOptionNumberDrafts.value[optionId]
  delete voteOptionNumberDrafts.value[optionId]

  if (targetNumber == null || !Number.isFinite(targetNumber)) {
    return
  }

  const fromIndex = newVoteOptions.value.findIndex((option) => option.id === optionId)
  if (fromIndex < 0) {
    return
  }

  const toIndex = Math.min(newVoteOptions.value.length - 1, Math.max(0, Math.round(targetNumber) - 1))
  if (fromIndex === toIndex) {
    return
  }

  const [option] = newVoteOptions.value.splice(fromIndex, 1)
  if (!option) {
    return
  }
  newVoteOptions.value.splice(toIndex, 0, option)
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
    feedback('error', '获取投票配置失败')
  } finally {
    isLoading.value = false
  }
}

// 保存投票配置
async function saveVoteConfig() {
  try {
    isLoading.value = true
    const result = await QueryPostAPI<any>(`${VOTE_API_URL}save-config`, voteConfig.value)

    if (result.code === 200) {
      feedback('success', '投票配置保存成功')
      showSettingsModal.value = false
    } else {
      feedback('error', `保存失败: ${result.message}`)
    }
  } catch (error) {
    console.error('保存投票配置失败:', error)
    feedback('error', '保存投票配置失败')
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
    feedback('error', '请输入投票标题')
    return
  }

  const filteredOptions = getVoteOptionTexts()
  if (filteredOptions.length < 2) {
    feedback('error', '至少需要两个投票选项')
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
      feedback('success', '投票创建成功')
      currentVote.value = result.data
      resetCreateVoteForm()
    } else {
      feedback('error', `创建失败: ${result.message}`)
    }
  } catch (error) {
    console.error('创建投票失败:', error)
    feedback('error', '创建投票失败')
  } finally {
    isLoading.value = false
  }
}

// 重置创建投票表单
function resetCreateVoteForm() {
  newVoteTitle.value = ''
  setVoteFormOptions(['', ''])
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
      feedback('success', '投票已结束')
      currentVote.value = result.data
      await fetchVoteHistory()
    } else {
      feedback('error', `结束失败: ${result.message}`)
    }
  } catch (error) {
    console.error('结束投票失败:', error)
    feedback('error', '结束投票失败')
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
      feedback('success', '投票已删除')
      await fetchVoteHistory()
      if (currentVote.value?.id === id) {
        currentVote.value = null
      }
    } else {
      feedback('error', `删除失败: ${result.message}`)
    }
  } catch (error) {
    console.error('删除投票失败:', error)
    feedback('error', '删除投票失败')
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
      feedback('success', 'OBS链接已复制到剪贴板')
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
    feedback('error', '获取投票哈希失败')
    return null
  }
}

// 计算每个选项的百分比
function calculatePercentage(count: number, totalVotes: number) {
  if (totalVotes === 0) return 0
  return Math.round((count / totalVotes) * 100)
}

// 加载模板
function loadTemplate(template: { title: string; options: string[] }) {
  newVoteTitle.value = template.title
  setVoteFormOptions(template.options)
}

// 导入默认选项
function importDefaultOptions() {
  const opts = voteConfig.value.defaultOptions || []
  setVoteFormOptions(opts)
}

// 从历史复刻
function reuseVote(vote: ResponseVoteSession) {
  newVoteTitle.value = vote.title
  setVoteFormOptions(vote.options.map((o) => o.text))
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
watch(
  voteConfig,
  (newConfig) => {
    newVoteDuration.value = newConfig.voteDurationSeconds
  },
  { immediate: true },
)

// 初始模板
const savedTemplates = usePersistedStorage<{ title: string; options: string[] }[]>('DanmakuVoteTemplates', [])
const templateName = ref('')

// 保存模板
function saveTemplate() {
  if (!templateName.value) {
    feedback('error', '请输入模板名称')
    return
  }

  const filteredOptions = getVoteOptionTexts()
  if (filteredOptions.length < 2) {
    feedback('error', '至少需要两个有效的投票选项')
    return
  }

  savedTemplates.value.push({
    title: templateName.value,
    options: filteredOptions,
  })

  templateName.value = ''
  feedback('success', '模板保存成功')
}

// 删除模板
function deleteTemplate(index: number) {
  savedTemplates.value.splice(index, 1)
}
</script>

<template>
  <div
    vertical
    :size="12"
  >
    <UCard
      size="small"
      bordered
      :segmented="{ content: true }"
    >
      <OpenLivePageHeader
        title="弹幕投票"
        description="观众可发送选项编号、选项内容或带命令的弹幕参与投票，可自定义标题、选项与显示样式。"
      >
        <template #footers>
          <div
            align="center"
            :wrap="true"
            :size="10"
          >
            <UButton
              variant="soft"
              size="small"
              class="open-live-action-btn"
              @click="showSettingsModal = true"
            >
              <template #leading>
                <span><Settings24Regular /></span>
              </template>
              设置
            </UButton>
            <UButton
              color="info"
              size="small"
              class="open-live-action-btn"
              @click="copyObsLink"
            >
              <template #leading>
                <span><ShareAndroid24Regular /></span>
              </template>
              复制 OBS 链接
            </UButton>
          </div>
        </template>
      </OpenLivePageHeader>

      <UAlert
        type="info"
        size="small"
        :bordered="false"
      >
        参与格式：直接发送“1”或“选项内容”；也支持“{{ voteConfig.voteCommand }} 1 /
        {{ voteConfig.voteCommand }} 选项内容”。
      </UAlert>
    </UCard>

    <UCard
      title="投票控制"
      size="small"
      bordered
    >
      <div :show="isLoading">
        <div
          vertical
          :size="12"
        >
          <div
            align="center"
            justify="space-between"
            :wrap="true"
            :size="12"
          >
            <USwitch
              v-model="voteConfig.isEnabled"
              @update:model-value="saveVoteConfig"
            >
              <template v-if="false"> 已启用 </template>
              <template v-if="false"> 已禁用 </template>
            </USwitch>

            <UBadge
              v-if="currentVote?.isActive"
              type="success"
              size="small"
              :bordered="false"
            >
              进行中
            </UBadge>
          </div>

          <USeparator style="margin: 0" />

          <UAlert
            v-if="!voteConfig.isEnabled"
            type="warning"
            size="small"
            :bordered="false"
          >
            投票功能已禁用，请先在设置中启用功能。
          </UAlert>

          <template v-else-if="currentVote && currentVote.isActive">
            <div
              vertical
              :size="12"
            >
              <div
                align="center"
                justify="space-between"
                :wrap="true"
                :size="12"
              >
                <div
                  align="center"
                  :wrap="true"
                  :size="8"
                >
                  <span
                    strong
                    class="vote-title"
                  >
                    {{ currentVote.title }}
                  </span>
                  <UBadge
                    v-if="timeLeftMs !== null"
                    type="warning"
                    size="small"
                    :bordered="false"
                  >
                    剩余: {{ formatRemain(timeLeftMs) }}
                  </UBadge>
                </div>
                <UButton
                  color="warning"
                  size="small"
                  @click="endVote"
                >
                  <template #leading>
                    <span><Pause24Regular /></span>
                  </template>
                  结束投票
                </UButton>
              </div>

              <span depth="3"> 总票数: {{ currentVote.totalVotes }} </span>

              <div
                v-for="(option, index) in currentVote.options"
                :key="index"
                class="vote-result-row"
                :class="{ 'vote-result-row--leading': index === leadingOptionIndex }"
              >
                <div
                  vertical
                  size="small"
                >
                  <div
                    align="center"
                    justify="space-between"
                    :wrap="true"
                    :size="8"
                  >
                    <span :strong="index === leadingOptionIndex">
                      {{ index + 1 }}. {{ option.text }}
                      <UBadge
                        v-if="index === leadingOptionIndex"
                        type="warning"
                        size="small"
                        :bordered="false"
                        class="vote-leading-tag"
                      >
                        领先
                      </UBadge>
                    </span>
                    <div
                      align="center"
                      :wrap="true"
                      :size="6"
                    >
                      <UBadge
                        type="success"
                        size="small"
                        :bordered="false"
                      >
                        {{ option.count }}票
                      </UBadge>
                      <UBadge
                        size="small"
                        :bordered="false"
                      >
                        {{ calculatePercentage(option.count, currentVote.totalVotes) }}%
                      </UBadge>
                    </div>
                  </div>
                  <UProgress
                    type="line"
                    :percentage="calculatePercentage(option.count, currentVote.totalVotes)"
                    :height="10"
                    :color="index === leadingOptionIndex ? 'warning' : 'neutral'"
                  />
                </div>
              </div>
            </div>
          </template>

          <template v-else>
            <div
              vertical
              :size="12"
            >
              <UInput
                v-model="newVoteTitle"
                placeholder="投票标题"
                size="small"
              />

              <VueDraggable
                v-model="newVoteOptions"
                handle=".vote-option-handle"
                ghost-class="vote-option-ghost"
                :animation="150"
                class="vote-option-editor"
              >
                <div
                  v-for="(option, index) in newVoteOptions"
                  :key="option.id"
                  class="vote-option-row"
                >
                  <span
                    class="vote-option-handle"
                    title="拖拽排序"
                  >
                    <span><ReorderThreeOutline /></span>
                  </span>
                  <UInputNumber
                    class="vote-option-number"
                    size="small"
                    :show-button="false"
                    :min="1"
                    :max="newVoteOptions.length"
                    :value="getVoteOptionNumberValue(option.id, index)"
                    @update:value="(value: number | null) => setVoteOptionNumberDraft(option.id, value)"
                    @blur="applyVoteOptionNumber(option.id)"
                    @keydown.enter.prevent="applyVoteOptionNumber(option.id)"
                  />
                  <UInput
                    v-model="option.text"
                    class="vote-option-text"
                    placeholder="选项内容"
                    size="small"
                  />
                  <UButton
                    class="vote-option-delete"
                    variant="ghost"
                    size="small"
                    :disabled="newVoteOptions.length <= 2"
                    @click="removeOption(index)"
                  >
                    <template #leading>
                      <span><Delete24Regular /></span>
                    </template>
                  </UButton>
                </div>
              </VueDraggable>

              <div
                align="center"
                :wrap="true"
                :size="10"
              >
                <UButton
                  size="small"
                  @click="addOption"
                >
                  <template #leading>
                    <span><Add24Filled /></span>
                  </template>
                  添加选项
                </UButton>
                <UButton
                  variant="soft"
                  size="small"
                  @click="importDefaultOptions"
                >
                  导入默认选项
                </UButton>
              </div>

              <div
                align="center"
                :wrap="true"
                :size="12"
              >
                <div>
                  <span>持续时间</span>
                  <div class="flex items-center gap-2">
                    <UInputNumber
                      v-model="newVoteDuration"
                      :min="10"
                      class="vote-duration"
                      size="small"
                    />
                    <span class="text-sm text-[var(--vtsuru-fg-muted)]">秒</span>
                  </div>
                </div>

                <div size="small">
                  <UButton
                    v-for="preset in durationPresets"
                    :key="preset"
                    :color="newVoteDuration === preset ? 'primary' : 'neutral'"
                    @click="newVoteDuration = preset"
                  >
                    {{ preset }}s
                  </UButton>
                </div>

                <UCheckbox v-model="newVoteAllowMultiple"> 允许重复投票 </UCheckbox>
              </div>

              <div justify="end">
                <UButton
                  color="primary"
                  size="small"
                  @click="createVote"
                >
                  <template #leading>
                    <span><Play24Regular /></span>
                  </template>
                  开始投票
                </UButton>
              </div>
            </div>
          </template>
        </div>
      </div>
    </UCard>

    <UCard
      v-if="!currentVote?.isActive && voteConfig.isEnabled"
      title="保存/加载模板"
      size="small"
      bordered
    >
      <div
        vertical
        :size="12"
      >
        <div
          align="center"
          :wrap="true"
          :size="10"
        >
          <UInput
            v-model="templateName"
            placeholder="模板名称"
            size="small"
          />
          <UButton
            size="small"
            @click="saveTemplate"
          >
            保存当前投票为模板
          </UButton>
        </div>

        <USeparator
          v-if="savedTemplates.length > 0"
          style="margin: 0"
        />

        <UEmpty
          v-if="savedTemplates.length === 0"
          description="暂无保存的模板"
          size="small"
        />

        <ul
          v-else
          size="small"
          bordered
        >
          <li
            v-for="(template, index) in savedTemplates"
            :key="index"
          >
            <div :title="template.title">
              <div class="vote-template-description">
                <span depth="3"> 选项数: {{ template.options.length }} </span>
              </div>
              <div class="vote-template-actions">
                <div :size="8">
                  <UButton
                    size="small"
                    @click="loadTemplate(template)"
                  >
                    加载
                  </UButton>
                  <UButton
                    size="small"
                    variant="soft"
                    color="error"
                    @click="deleteTemplate(index)"
                  >
                    删除
                  </UButton>
                </div>
              </div>
            </div>
          </li>
        </ul>
      </div>
    </UCard>

    <UCard
      v-if="voteHistoryTab.length > 0 && voteConfig.isEnabled"
      title="投票历史"
      size="small"
      bordered
    >
      <ul
        size="small"
        bordered
      >
        <li
          v-for="vote in voteHistoryTab"
          :key="vote.id"
        >
          <div :title="vote.title">
            <div class="vote-history-description">
              <div
                vertical
                size="small"
              >
                <span depth="3">
                  开始于: {{ new Date(vote.startTime * 1000).toLocaleString() }}
                  <span v-if="vote.endTime"> - 结束于: {{ new Date(vote.endTime * 1000).toLocaleString() }} </span>
                </span>
                <span>总票数: {{ vote.totalVotes }}</span>
                <div
                  v-for="(option, index) in vote.options"
                  :key="index"
                  :wrap="true"
                  :size="8"
                >
                  <UBadge
                    size="small"
                    :bordered="false"
                  >
                    {{ option.text }}: {{ option.count }}票 ({{ calculatePercentage(option.count, vote.totalVotes) }}%)
                  </UBadge>
                </div>
              </div>
            </div>
            <div class="vote-history-actions">
              <div :size="8">
                <UButton
                  size="small"
                  color="primary"
                  @click="reuseVote(vote)"
                >
                  复刻
                </UButton>
                <UButton
                  size="small"
                  variant="soft"
                  color="error"
                  @click="deleteVote(vote.id)"
                >
                  删除
                </UButton>
              </div>
            </div>
          </div>
        </li>
      </ul>
    </UCard>
  </div>

  <UModal
    v-model:open="showSettingsModal"
    preset="card"
    title="投票设置"
    style="width: 900px; max-width: 90vw"
  >
    <div :show="isLoading">
      <div
        vertical
        :size="12"
      >
        <div
          vertical
          :size="10"
        >
          <span strong> 基本设置 </span>

          <div>
            <span>命令前缀</span>
            <UInput
              v-model="voteConfig.voteCommand"
              size="small"
            />
          </div>

          <span
            depth="3"
            style="font-size: 12px"
          >
            观众不输入命令前缀时，也可以直接发送选项编号或选项内容。
          </span>

          <div>
            <span>结束命令</span>
            <UInput
              v-model="voteConfig.voteEndCommand"
              size="small"
            />
          </div>

          <div>
            <span>默认标题</span>
            <UInput
              v-model="voteConfig.voteTitle"
              size="small"
            />
          </div>

          <div>
            <span>默认时长</span>
            <div class="flex items-center gap-2">
              <UInputNumber
                v-model="voteConfig.voteDurationSeconds"
                :min="10"
                size="small"
              />
              <span class="text-sm text-[var(--vtsuru-fg-muted)]">秒</span>
            </div>
          </div>

          <UCheckbox v-model="voteConfig.showResults"> 实时显示投票结果 </UCheckbox>

          <UCheckbox v-model="voteConfig.allowMultipleVotes"> 允许重复投票 </UCheckbox>
        </div>

        <USeparator style="margin: 0" />

        <div
          vertical
          :size="10"
        >
          <span strong> 礼物投票 </span>

          <UCheckbox v-model="voteConfig.allowGiftVoting"> 允许通过礼物投票 </UCheckbox>

          <div v-if="voteConfig.allowGiftVoting">
            <span>最低礼物金额</span>
            <div class="flex items-center gap-2">
              <UInputNumber
                v-model="voteConfig.minGiftPrice"
                :min="0.1"
                :precision="1"
                size="small"
              />
              <span class="text-sm text-[var(--vtsuru-fg-muted)]">元</span>
            </div>
          </div>

          <URadioGroup
            v-model="voteConfig.voteResultMode"
            :items="[
              { label: '按人数计票', value: 0 },
              { label: '按礼物价值', value: 1 },
            ]"
            orientation="horizontal"
          />
        </div>

        <USeparator style="margin: 0" />

        <div
          vertical
          :size="10"
        >
          <span strong> 显示设置 </span>

          <div
            :wrap="true"
            :size="12"
          >
            <div>
              <span>背景颜色</span>
              <UColorPicker v-model="voteConfig.backgroundColor" />
            </div>

            <div>
              <span>文本颜色</span>
              <UColorPicker v-model="voteConfig.textColor" />
            </div>

            <div>
              <span>选项颜色</span>
              <UColorPicker v-model="voteConfig.optionColor" />
            </div>
          </div>

          <div
            align="center"
            :wrap="true"
            :size="12"
          >
            <UCheckbox v-model="voteConfig.roundedCorners"> 圆角显示 </UCheckbox>

            <div>
              <span>显示位置</span>
              <USelectMenu
                v-model="voteConfig.displayPosition"
                :items="[
                  { label: '左侧', value: 'left' },
                  { label: '右侧', value: 'right' },
                  { label: '顶部', value: 'top' },
                  { label: '底部', value: 'bottom' },
                ]"
                size="small"
                style="width: 140px"
                value-key="value"
              />
            </div>
          </div>
        </div>

        <div
          justify="end"
          :size="8"
        >
          <UButton
            size="small"
            @click="showSettingsModal = false"
          >
            取消
          </UButton>
          <UButton
            color="primary"
            size="small"
            @click="saveVoteConfig"
          >
            保存
          </UButton>
        </div>
      </div>
    </div>
  </UModal>
</template>

<style scoped>
.vote-title {
  font-size: 1.1em;
}

.vote-duration {
  width: 120px;
}

.vote-result-row {
  padding: 10px 12px;
  border: 1px solid transparent;
  border-radius: var(--vtsuru-radius);
  transition:
    background 0.15s ease,
    border-color 0.15s ease;
}

.vote-result-row + .vote-result-row {
  margin-top: 8px;
}

.vote-result-row--leading {
  background: var(--vtsuru-brand-soft);
  border-color: var(--vtsuru-brand-rail);
}

.vote-leading-tag {
  margin-left: 6px;
  vertical-align: middle;
}

.vote-option-editor {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.vote-option-row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.vote-option-handle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  font-size: 18px;
  border: 1px solid var(--vtsuru-border);
  border-radius: var(--vtsuru-radius-control);
  cursor: grab;
  user-select: none;
  color: var(--vtsuru-fg-muted);
  background: var(--vtsuru-bg-elevated);
  flex: 0 0 auto;
  transition:
    border-color 0.15s ease,
    color 0.15s ease,
    background 0.15s ease;
}

.vote-option-handle:hover {
  border-color: var(--vtsuru-border-hover);
  color: var(--vtsuru-fg);
}

.vote-option-handle:active {
  cursor: grabbing;
}

.vote-option-number {
  width: 72px;
  flex: 0 0 auto;
}

.vote-option-text {
  min-width: 140px;
  flex: 1 1 240px;
}

.vote-option-delete {
  flex: 0 0 auto;
}

.vote-option-ghost {
  opacity: 0.45;
}

@media (max-width: 560px) {
  .vote-option-row {
    flex-wrap: wrap;
  }

  .vote-option-text {
    flex-basis: calc(100% - 112px);
  }
}
</style>
