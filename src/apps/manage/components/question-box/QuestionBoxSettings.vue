<script setup lang="ts">
import { Check, Eye, EyeOff, Info, Loader2, Settings, ShieldBan, Trash2 } from 'lucide-vue-next'
import { computed, onBeforeUnmount, ref, watch } from 'vue'

import { SaveAccountSettings, SaveSetting, useAccount } from '@/api/account'
import { ViolationTypes } from '@/api/generated/model'
import type { SaftyLevels } from '@/api/generated/model'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { Checkbox } from '@/shared/ui/checkbox'
import { Empty } from '@/shared/ui/empty'
import { FormField } from '@/shared/ui/form-field'
import { Input } from '@/shared/ui/input'
import { NumberField } from '@/shared/ui/number-field'
import { Popconfirm } from '@/shared/ui/popconfirm'
import { SettingRow } from '@/shared/ui/setting-row'
import { Tag } from '@/shared/ui/tag'
import { Textarea } from '@/shared/ui/textarea'
import { ToggleGroup, ToggleGroupItem } from '@/shared/ui/toggle-group'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/ui/tooltip'
import { useMessage } from '@/shared/utils'
import { useQuestionBox } from '@/store/useQuestionBox'

const accountInfo = useAccount()
const useQB = useQuestionBox()
const message = useMessage()

const addTagName = ref('')
const saveState = ref<'idle' | 'saving' | 'saved'>('idle')
let saveTimer: number | undefined
let savedHintTimer: number | undefined

const sortedTags = computed(() => useQB.tags.toSorted((a, b) => b.createAt - a.createAt))

const blockedKeywordsText = ref('')
watch(
  () => accountInfo.value?.settings?.questionBox?.blockedKeywords,
  (list) => {
    const joined = (list ?? []).join('\n')
    if (joined !== blockedKeywordsText.value) {
      blockedKeywordsText.value = joined
    }
  },
  { immediate: true },
)

const levels = [
  { level: 0, label: '无', desc: '完全关闭内容审查' },
  { level: 1, label: '宽松', desc: '仅拦截极端内容 (得分 ≤ 30)' },
  { level: 2, label: '一般', desc: '拦截潜在冒犯性内容 (得分 ≤ 60)' },
  { level: 3, label: '严格', desc: '拦截所有可能不适内容 (得分 ≤ 90)' },
]

const selectedSaftyLevel = computed({
  get: () => String(accountInfo.value?.settings?.questionBox?.saftyLevel ?? 0),
  set: (val: string) => {
    if (!val || !accountInfo.value?.settings?.questionBox) return
    accountInfo.value.settings.questionBox.saftyLevel = Number(val) as SaftyLevels
    scheduleSaveQuestionBoxSettings()
  },
})

const currentLevelDesc = computed(() => {
  const current = Number(selectedSaftyLevel.value)
  return levels.find((l) => l.level === current)?.desc ?? ''
})

interface BlockTagOption {
  type: ViolationTypes
  label: string
  desc: string
  defaultChecked: boolean
}

const availableBlockTags: BlockTagOption[] = [
  { type: ViolationTypes.THREAT, label: '现实威胁', desc: '线下跟踪、真实堵人、人肉开盒等严重恐吓', defaultChecked: true },
  { type: ViolationTypes.HATE, label: '恶毒辱骂', desc: '脏话诅咒、下流恶语、容貌智力羞辱', defaultChecked: true },
  { type: ViolationTypes.PORNOGRAPHY, label: '色情低俗', desc: '性骚扰、涉黄引流与露骨低俗', defaultChecked: true },
  { type: ViolationTypes.VIOLENCE, label: '暴力血腥', desc: '物理暴力、残害肢体等极端言论', defaultChecked: true },
  { type: ViolationTypes.ADVERTISING, label: '商业广告', desc: '垃圾推销、兼职刷单、外部账号导流', defaultChecked: true },
  { type: ViolationTypes.POLITICS, label: '政治敏感', desc: '违规涉政言论或时政攻击', defaultChecked: true },
  { type: ViolationTypes.AGGRESSION, label: '攻击敌意', desc: '明显恶意与恶语相向', defaultChecked: true },
  { type: ViolationTypes.PASSIVE_AGGRESSIVE, label: '阴阳怪气', desc: '无脏字软刀子、恶意拉踩对比、戳人痛处', defaultChecked: true },
  { type: ViolationTypes.TEASING, label: '黑称调侃', desc: '主播黑称、损友嘲弄、带刺打趣 (默认放行)', defaultChecked: false },
]

function isTagBlocked(tagType: ViolationTypes): boolean {
  const current = accountInfo.value?.settings?.questionBox?.blockedTags
  if (!current || current.length === 0) {
    return availableBlockTags.find((t) => t.type === tagType)?.defaultChecked ?? false
  }
  return current.includes(tagType)
}

function toggleBlockTag(tagType: ViolationTypes) {
  if (!accountInfo.value?.settings?.questionBox) return
  const qb = accountInfo.value.settings.questionBox
  let current = qb.blockedTags
    ? [...qb.blockedTags]
    : availableBlockTags.filter((t) => t.defaultChecked).map((t) => t.type)
  if (current.includes(tagType)) {
    current = current.filter((t) => t !== tagType)
  } else {
    current.push(tagType)
  }
  qb.blockedTags = current
  scheduleSaveQuestionBoxSettings()
}

function commitBlockedKeywords() {
  if (!accountInfo.value?.settings?.questionBox) return
  const items = blockedKeywordsText.value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 100)
  accountInfo.value.settings.questionBox.blockedKeywords = items
  scheduleSaveQuestionBoxSettings(100)
}

function removeBlockedBiliUid(uid: number) {
  const qb = accountInfo.value?.settings?.questionBox
  if (!qb?.blockedBiliUids) return
  qb.blockedBiliUids = qb.blockedBiliUids.filter((id) => id !== uid)
  scheduleSaveQuestionBoxSettings(100)
}

function clearBlockedSenderHashes() {
  const qb = accountInfo.value?.settings?.questionBox
  if (!qb) return
  qb.blockedSenderHashes = []
  scheduleSaveQuestionBoxSettings(100)
}

function scheduleSaveQuestionBoxSettings(delayMs = 350) {
  window.clearTimeout(saveTimer)
  saveState.value = 'saving'
  saveTimer = window.setTimeout(() => {
    void saveQuestionBoxSettings()
  }, delayMs)
}

async function saveQuestionBoxSettings() {
  if (!accountInfo.value?.settings?.questionBox) return
  saveState.value = 'saving'
  try {
    await SaveSetting('QuestionBox', accountInfo.value.settings.questionBox)
    saveState.value = 'saved'
    window.clearTimeout(savedHintTimer)
    savedHintTimer = window.setTimeout(() => {
      if (saveState.value === 'saved') saveState.value = 'idle'
    }, 2200)
  } catch (err) {
    saveState.value = 'idle'
    message.error(`保存设置时出错: ${err instanceof Error ? err.message : String(err)}`)
  }
}

async function saveNotificationSetting() {
  if (!accountInfo.value?.settings?.sendEmail) return
  try {
    const response = await SaveAccountSettings()
    if (response.code === 200) message.success('通知设置已保存')
    else message.error(`修改通知设置失败: ${response.message}`)
  } catch (err) {
    message.error(`修改通知设置失败: ${err}`)
  }
}

function addTag() {
  if (!addTagName.value.trim()) return
  void useQB.addTag(addTagName.value.trim())
  addTagName.value = ''
}

onBeforeUnmount(() => {
  window.clearTimeout(saveTimer)
  window.clearTimeout(savedHintTimer)
})
</script>

<template>
  <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-1">
    <!-- 左栏：收件状态、基础设定、内容审查、通知设置 -->
    <div class="space-y-4">
      <Card v-if="accountInfo?.settings?.questionBox">
        <CardHeader class="py-3 px-4 border-b flex flex-row items-center justify-between space-y-0">
          <div class="flex items-center gap-2">
            <CardTitle class="text-xs">收件状态与公告</CardTitle>
            <span
              v-if="saveState === 'saving'"
              class="inline-flex items-center gap-1 text-[11px] text-muted-foreground"
            >
              <Loader2 class="size-3 animate-spin" />
              保存中
            </span>
            <span
              v-else-if="saveState === 'saved'"
              class="inline-flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400"
            >
              <Check class="size-3" />
              已自动保存
            </span>
          </div>
          <Settings class="size-4 text-muted-foreground" />
        </CardHeader>
        <CardContent class="p-4 space-y-3">
          <SettingRow
            v-model="accountInfo.settings.questionBox.pauseAccepting"
            type="switch"
            variant="compact"
            title="暂停接收新提问"
            description="开启后仍保留公开已回复列表，但不接受新的提问投稿"
            @change="scheduleSaveQuestionBoxSettings(100)"
          />

          <FormField
            v-if="accountInfo.settings.questionBox.pauseAccepting"
            label="暂停收件提示语"
            description="展示给访问提问页的观众（留空使用默认文案）"
          >
            <Input
              :model-value="accountInfo.settings.questionBox.pauseMessage ?? ''"
              maxlength="200"
              placeholder="例如：近期闭关准备新歌回，下周重新开放提问箱~"
              @update:model-value="accountInfo.settings.questionBox.pauseMessage = String($event)"
              @blur="scheduleSaveQuestionBoxSettings(100)"
            />
          </FormField>

          <FormField
            label="提问箱顶部公告 / 投稿须知"
            description="固定展示在提问输入框上方，最多 500 字"
          >
            <Textarea
              :model-value="accountInfo.settings.questionBox.notice ?? ''"
              maxlength="500"
              :rows="3"
              placeholder="例如：欢迎投递杂谈话题、歌曲推荐，不接受节奏与引战内容"
              @update:model-value="accountInfo.settings.questionBox.notice = String($event)"
              @blur="scheduleSaveQuestionBoxSettings(100)"
            />
          </FormField>

          <div class="grid grid-cols-2 gap-2.5 pt-1">
            <FormField
              label="发件冷却 (秒)"
              description="5–3600 秒"
              class="min-w-0"
            >
              <NumberField
                :model-value="accountInfo.settings.questionBox.cooldownSeconds || 30"
                :min="5"
                :max="3600"
                @update:model-value="
                  (val) => {
                    if (accountInfo?.settings?.questionBox) {
                      accountInfo.settings.questionBox.cooldownSeconds = Number(val) || 30
                      scheduleSaveQuestionBoxSettings()
                    }
                  }
                "
              />
            </FormField>
            <FormField
              label="单条字数上限"
              description="50–10000 字"
              class="min-w-0"
            >
              <NumberField
                :model-value="accountInfo.settings.questionBox.maxMessageLength || 10000"
                :min="50"
                :max="10000"
                :step="100"
                @update:model-value="
                  (val) => {
                    if (accountInfo?.settings?.questionBox) {
                      accountInfo.settings.questionBox.maxMessageLength = Number(val) || 10000
                      scheduleSaveQuestionBoxSettings()
                    }
                  }
                "
              />
            </FormField>
          </div>
        </CardContent>
      </Card>

      <Card v-if="accountInfo?.settings?.questionBox">
        <CardHeader class="py-3 px-4 border-b">
          <CardTitle class="text-xs">基础权限与展示</CardTitle>
        </CardHeader>
        <CardContent class="p-4 space-y-2">
          <SettingRow
            v-model="accountInfo.settings.questionBox.allowUnregistedUser"
            type="switch"
            variant="compact"
            title="允许未注册/未登录用户提问"
            @change="scheduleSaveQuestionBoxSettings(100)"
          />
          <SettingRow
            v-model="accountInfo.settings.questionBox.allowAnonymous"
            type="switch"
            variant="compact"
            title="允许已登录用户隐藏身份"
            @change="scheduleSaveQuestionBoxSettings(100)"
          />
          <SettingRow
            v-model="accountInfo.settings.questionBox.allowImageUpload"
            type="switch"
            variant="compact"
            title="允许上传图片"
            @change="scheduleSaveQuestionBoxSettings(100)"
          />
          <SettingRow
            type="switch"
            variant="compact"
            title="在提问页显示公开回复"
            :model-value="accountInfo.settings.questionBox.showPublicReplies !== false"
            @change="
              (checked) => {
                if (accountInfo?.settings?.questionBox) {
                  accountInfo.settings.questionBox.showPublicReplies = Boolean(checked)
                  scheduleSaveQuestionBoxSettings(100)
                }
              }
            "
          />
          <SettingRow
            type="switch"
            variant="compact"
            title="新提问默认公开展示"
            :model-value="accountInfo.settings.questionBox.defaultPublic !== false"
            @change="
              (checked) => {
                if (accountInfo?.settings?.questionBox) {
                  accountInfo.settings.questionBox.defaultPublic = Boolean(checked)
                  scheduleSaveQuestionBoxSettings(100)
                }
              }
            "
          />
          <SettingRow
            v-model="accountInfo.settings.questionBox.allowFollowUp"
            type="switch"
            variant="compact"
            title="允许有身份的提问者在回复后追问"
            @change="scheduleSaveQuestionBoxSettings(100)"
          />
          <SettingRow
            v-if="accountInfo.settings.questionBox.allowFollowUp"
            v-model="accountInfo.settings.questionBox.maxFollowUps"
            type="number"
            variant="compact"
            title="每条提问最多追问次数"
            :min="1"
            :max="10"
            @change="scheduleSaveQuestionBoxSettings()"
          />
        </CardContent>
      </Card>

      <Card v-if="accountInfo?.settings?.questionBox">
        <CardHeader class="py-3 px-4 border-b">
          <CardTitle class="text-xs">内容审查与屏蔽词</CardTitle>
        </CardHeader>
        <CardContent class="p-4 space-y-4">
          <FormField
            label="AI 过滤强度"
            :extra="currentLevelDesc"
          >
            <ToggleGroup
              v-model="selectedSaftyLevel"
              type="single"
              class="w-full grid grid-cols-4"
            >
              <ToggleGroupItem
                v-for="item in levels"
                :key="item.level"
                :value="String(item.level)"
                class="w-full"
              >
                {{ item.label }}
              </ToggleGroupItem>
            </ToggleGroup>
          </FormField>

          <div
            v-if="Number(selectedSaftyLevel) > 0"
            class="pt-3 border-t border-border/60 space-y-3"
          >
            <FormField
              label="自选拦截分类"
              extra="勾选你希望自动拦截的类型"
            >
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div
                  v-for="tag in availableBlockTags"
                  :key="tag.type"
                  class="flex items-start gap-2 p-2 rounded-md border border-border/50 hover:bg-muted/40 transition-colors cursor-pointer"
                  @click="toggleBlockTag(tag.type)"
                >
                  <Checkbox
                    :checked="isTagBlocked(tag.type)"
                    class="mt-0.5 pointer-events-none"
                  />
                  <div class="flex-1 min-w-0">
                    <div class="text-xs font-medium text-foreground leading-none">{{ tag.label }}</div>
                    <div class="text-[11px] text-muted-foreground mt-1 line-clamp-1">{{ tag.desc }}</div>
                  </div>
                </div>
              </div>
            </FormField>

            <SettingRow
              type="switch"
              variant="compact"
              title="审查提问附带的图片"
              description="多模态识别全部配图中的违规内容"
              :model-value="accountInfo.settings.questionBox.reviewImages !== false"
              @change="
                (checked) => {
                  if (accountInfo?.settings?.questionBox) {
                    accountInfo.settings.questionBox.reviewImages = Boolean(checked)
                    scheduleSaveQuestionBoxSettings(100)
                  }
                }
              "
            />
          </div>

          <FormField
            label="自定义屏蔽词（本地优先拦截）"
            description="每行一个关键词，支持 /正则/ 语法，命中后直接移入垃圾站且不触发通知"
          >
            <Textarea
              v-model="blockedKeywordsText"
              :rows="3"
              placeholder="每行输入一个屏蔽词，例如：&#10;广告词&#10;/代练|刷单/"
              @blur="commitBlockedKeywords"
            />
          </FormField>
        </CardContent>
      </Card>

      <Card v-if="accountInfo?.settings?.sendEmail">
        <CardHeader class="py-3 px-4 border-b">
          <CardTitle class="text-xs">邮件通知设置</CardTitle>
        </CardHeader>
        <CardContent class="p-4 space-y-2">
          <SettingRow
            v-model="accountInfo.settings.sendEmail.recieveQA"
            type="switch"
            variant="compact"
            title="收到新提问时发送邮件通知"
            @change="saveNotificationSetting"
          />
          <SettingRow
            v-model="accountInfo.settings.sendEmail.recieveQAReply"
            type="switch"
            variant="compact"
            title="我发送的提问收到回复时发送邮件通知"
            @change="saveNotificationSetting"
          />
        </CardContent>
      </Card>
    </div>

    <!-- 右栏：标签/话题管理 + 已拉黑来源 -->
    <div class="space-y-4">
      <Card class="flex flex-col">
        <CardHeader class="py-3 px-4 border-b flex flex-row items-center justify-between space-y-0">
          <CardTitle class="text-xs">标签/话题管理</CardTitle>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger as-child>
                <Info class="size-4 text-muted-foreground/70 cursor-help" />
              </TooltipTrigger>
              <TooltipContent>
                <p class="text-xs">用于对收到的提问进行分类，或让提问者选择相关话题。</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </CardHeader>
        <CardContent class="p-4 flex-1 flex flex-col space-y-3">
          <div class="flex items-center gap-2">
            <Input
              v-model="addTagName"
              placeholder="输入新标签名称..."
              maxlength="20"
              class="flex-1"
              @keydown.enter="addTag"
            />
            <Button
              :disabled="!addTagName.trim()"
              @click="addTag"
            >
              添加
            </Button>
          </div>

          <Empty
            v-if="sortedTags.length === 0"
            description="暂无标签，添加后提问者可选择分类"
            class="py-8"
          />

          <div
            v-else
            class="space-y-1.5 overflow-y-auto scrollbar-thin max-h-[420px] pr-1"
          >
            <div
              v-for="item in sortedTags"
              :key="item.name"
              class="flex-between p-2 rounded-md border border-border bg-card hover:bg-muted/30 transition-colors text-xs"
            >
              <div class="flex items-center gap-2 min-w-0">
                <Tag
                  :type="item.visiable ? 'primary' : 'default'"
                  size="small"
                >
                  #{{ item.name }}
                </Tag>
                <span
                  v-if="!item.visiable"
                  class="text-[11px] text-muted-foreground"
                >
                  (已隐藏)
                </span>
              </div>

              <div class="flex items-center gap-1 shrink-0">
                <Button
                  size="icon-xs"
                  variant="ghost"
                  class="text-muted-foreground"
                  :aria-label="item.visiable ? '在提问页隐藏该话题' : '在提问页显示该话题'"
                  @click="useQB.changeTagVisiable(item.name, !item.visiable)"
                >
                  <Eye
                    v-if="item.visiable"
                    class="size-3.5"
                  />
                  <EyeOff
                    v-else
                    class="size-3.5"
                  />
                </Button>

                <Popconfirm
                  title="确认删除话题？"
                  :description="`确认删除话题「${item.name}」吗？`"
                  @confirm="useQB.delTag(item.name)"
                >
                  <Button
                    size="icon-xs"
                    variant="ghost"
                    class="text-muted-foreground hover:text-destructive"
                    aria-label="删除话题"
                  >
                    <Trash2 class="size-3.5" />
                  </Button>
                </Popconfirm>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card v-if="accountInfo?.settings?.questionBox">
        <CardHeader class="py-3 px-4 border-b flex flex-row items-center justify-between space-y-0">
          <CardTitle class="text-xs">已拉黑的提问来源</CardTitle>
          <ShieldBan class="size-4 text-muted-foreground" />
        </CardHeader>
        <CardContent class="p-4 space-y-3 text-xs">
          <div class="flex-between">
            <span class="text-muted-foreground">匿名来源哈希黑名单</span>
            <div class="flex items-center gap-2">
              <Badge
                variant="secondary"
                size="xs"
                class="tabular-nums"
              >
                {{ accountInfo.settings.questionBox.blockedSenderHashes?.length ?? 0 }} 条
              </Badge>
              <Popconfirm
                v-if="(accountInfo.settings.questionBox.blockedSenderHashes?.length ?? 0) > 0"
                title="清空匿名黑名单？"
                description="清空后之前被拉黑的匿名来源将恢复投稿权限。"
                @confirm="clearBlockedSenderHashes"
              >
                <Button
                  size="xs"
                  variant="outline"
                >
                  清空
                </Button>
              </Popconfirm>
            </div>
          </div>

          <div
            v-if="accountInfo.settings.questionBox.blockedBiliUids?.length"
            class="space-y-1.5 pt-2 border-t border-border/60"
          >
            <div class="text-[11px] text-muted-foreground">已拉黑的 B 站 UID</div>
            <div class="flex items-center gap-1.5 flex-wrap">
              <Badge
                v-for="uid in accountInfo.settings.questionBox.blockedBiliUids"
                :key="uid"
                variant="outline"
                class="gap-1 pr-1 tabular-nums"
              >
                UID {{ uid }}
                <button
                  type="button"
                  aria-label="解除拉黑"
                  class="hover:text-destructive"
                  @click="removeBlockedBiliUid(uid)"
                >
                  ×
                </button>
              </Badge>
            </div>
          </div>
          <p
            v-else
            class="text-[11px] text-muted-foreground m-0"
          >
            站内注册账号黑名单请在「系统设置 → 黑名单」管理。
          </p>
        </CardContent>
      </Card>
    </div>
  </div>
</template>
