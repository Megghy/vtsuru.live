<script setup lang="ts">
import { Delete24Regular, Eye24Filled, EyeOff24Filled, Info24Filled } from '@vicons/fluent'
import { SettingsOutline } from '@vicons/ionicons5'
import { computed, ref, watch } from 'vue'

import { SaveAccountSettings, SaveSetting, useAccount } from '@/api/account'
import type { SettingQuestionBoxSaftyLevels } from '@/api/generated/model'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { Checkbox } from '@/shared/ui/checkbox'
import { Empty } from '@/shared/ui/empty'
import { Input } from '@/shared/ui/input'
import { Popconfirm } from '@/shared/ui/popconfirm'
import { Slider } from '@/shared/ui/slider'
import { Tag } from '@/shared/ui/tag'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/ui/tooltip'
import { useMessage } from '@/shared/utils'
import { useQuestionBox } from '@/store/useQuestionBox'

const accountInfo = useAccount()
const useQB = useQuestionBox()
const message = useMessage()

const addTagName = ref('')
const tempSaftyLevel = ref<number[]>([accountInfo.value?.settings?.questionBox?.saftyLevel ?? 0])
const sortedTags = computed(() => useQB.tags.toSorted((a, b) => b.createAt - a.createAt))

watch(
  () => accountInfo.value?.settings?.questionBox?.saftyLevel,
  (v) => {
    if (v !== undefined) tempSaftyLevel.value = [v]
  },
  { immediate: true },
)

const levels = [
  { level: 0, label: '无', desc: '完全关闭内容审查' },
  { level: 1, label: '宽松', desc: '仅过滤极端内容 (得分 > 30)' },
  { level: 2, label: '一般', desc: '过滤潜在冒犯性内容 (得分 > 60)' },
  { level: 3, label: '严格', desc: '过滤所有可能不适内容 (得分 > 90)' },
]

async function saveQuestionBoxSettings() {
  if (!accountInfo.value?.settings?.questionBox) return
  try {
    const success = await SaveSetting('QuestionBox', accountInfo.value.settings.questionBox)
    if (success) message.success('设置已保存')
    else message.error('保存设置失败')
  } catch (err) {
    message.error(`保存设置时出错: ${err}`)
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
  useQB.addTag(addTagName.value.trim())
  addTagName.value = ''
}
</script>

<template>
  <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-1">
    <!-- 左栏：基础设定、内容审查、通知设置 -->
    <div class="space-y-4">
      <Card>
        <CardHeader class="py-3 px-4 border-b flex flex-row items-center justify-between">
          <CardTitle class="text-xs font-semibold">基础设定</CardTitle>
          <SettingsOutline class="size-4 text-muted-foreground" />
        </CardHeader>
        <CardContent class="p-4 space-y-3" v-if="accountInfo?.settings?.questionBox">
          <label class="flex items-center gap-2 cursor-pointer text-xs">
            <Checkbox
              v-model="accountInfo.settings.questionBox.allowUnregistedUser"
              :disabled="useQB.isLoading"
              @update:model-value="saveQuestionBoxSettings"
            />
            <span>允许未注册/未登录用户提问</span>
          </label>
          <label class="flex items-center gap-2 cursor-pointer text-xs">
            <Checkbox
              v-model="accountInfo.settings.questionBox.allowAnonymous"
              :disabled="useQB.isLoading"
              @update:model-value="saveQuestionBoxSettings"
            />
            <span>允许匿名提问（关闭后必须以登录/认证身份实名提交）</span>
          </label>
          <label class="flex items-center gap-2 cursor-pointer text-xs">
            <Checkbox
              v-model="accountInfo.settings.questionBox.allowImageUpload"
              :disabled="useQB.isLoading"
              @update:model-value="saveQuestionBoxSettings"
            />
            <span>允许上传图片</span>
          </label>
          <label class="flex items-center gap-2 cursor-pointer text-xs">
            <Checkbox
              :model-value="accountInfo.settings.questionBox.showPublicReplies !== false"
              :disabled="useQB.isLoading"
              @update:model-value="
                (checked) => {
                  if (accountInfo?.settings?.questionBox) {
                    accountInfo.settings.questionBox.showPublicReplies = Boolean(checked)
                    saveQuestionBoxSettings()
                  }
                }
              "
            />
            <span>在提问页显示公开回复</span>
          </label>
          <label class="flex items-center gap-2 cursor-pointer text-xs">
            <Checkbox
              :model-value="accountInfo.settings.questionBox.defaultPublic !== false"
              :disabled="useQB.isLoading"
              @update:model-value="
                (checked) => {
                  if (accountInfo?.settings?.questionBox) {
                    accountInfo.settings.questionBox.defaultPublic = Boolean(checked)
                    saveQuestionBoxSettings()
                  }
                }
              "
            />
            <span>新提问默认公开展示</span>
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardHeader class="py-3 px-4 border-b">
          <CardTitle class="text-xs font-semibold">内容审查</CardTitle>
        </CardHeader>
        <CardContent class="p-4 space-y-4">
          <div class="text-xs text-muted-foreground">设置过滤强度，自动拦截恶意提问</div>
          <div class="px-2">
            <Slider
              v-model="tempSaftyLevel"
              :min="0"
              :max="3"
              :step="1"
              :disabled="useQB.isLoading"
              @update:model-value="
                (val) => {
                  if (accountInfo?.settings?.questionBox && val[0] !== undefined) {
                    accountInfo.settings.questionBox.saftyLevel = val[0] as SettingQuestionBoxSaftyLevels
                    saveQuestionBoxSettings()
                  }
                }
              "
            />
            <div class="flex justify-between items-center text-xs text-muted-foreground mt-2">
              <div
                v-for="item in levels"
                :key="item.level"
                class="flex flex-col items-center cursor-pointer"
                @click="
                  () => {
                    tempSaftyLevel = [item.level]
                    if (accountInfo?.settings?.questionBox) {
                      accountInfo.settings.questionBox.saftyLevel = item.level as SettingQuestionBoxSaftyLevels
                      saveQuestionBoxSettings()
                    }
                  }
                "
              >
                <span :class="{ 'font-semibold text-primary': tempSaftyLevel[0] === item.level }">
                  {{ item.label }}
                </span>
                <span class="text-[10px] text-muted-foreground/80 scale-90">{{ item.desc }}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader class="py-3 px-4 border-b">
          <CardTitle class="text-xs font-semibold">通知设置</CardTitle>
        </CardHeader>
        <CardContent class="p-4 space-y-3" v-if="accountInfo?.settings?.sendEmail">
          <label class="flex items-center gap-2 cursor-pointer text-xs">
            <Checkbox
              v-model:checked="accountInfo.settings.sendEmail.recieveQA"
              :disabled="useQB.isLoading"
              @update:checked="saveNotificationSetting"
            />
            <span>收到新提问时发送邮件通知</span>
          </label>
          <label class="flex items-center gap-2 cursor-pointer text-xs">
            <Checkbox
              v-model:checked="accountInfo.settings.sendEmail.recieveQAReply"
              :disabled="useQB.isLoading"
              @update:checked="saveNotificationSetting"
            />
            <span>我发送的提问收到回复时发送邮件通知</span>
          </label>
        </CardContent>
      </Card>
    </div>

    <!-- 右栏：标签/话题管理 -->
    <div>
      <Card class="h-full flex flex-col">
        <CardHeader class="py-3 px-4 border-b flex flex-row items-center justify-between">
          <CardTitle class="text-xs font-semibold">标签/话题管理</CardTitle>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger as-child>
                <Info24Filled class="size-4 text-muted-foreground/70 cursor-help" />
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
              class="h-8 text-xs flex-1"
              @keydown.enter="addTag"
            />
            <Button
              size="sm"
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

          <div v-else class="space-y-1.5 overflow-y-auto max-h-[460px] pr-1">
            <div
              v-for="item in sortedTags"
              :key="item.name"
              class="flex items-center justify-between p-2 rounded-md border border-border bg-card hover:bg-muted/30 transition-colors text-xs"
            >
              <div class="flex items-center gap-2">
                <Tag :type="item.visiable ? 'primary' : 'default'" size="small">
                  #{{ item.name }}
                </Tag>
                <span v-if="!item.visiable" class="text-[11px] text-muted-foreground">
                  (已隐藏)
                </span>
              </div>

              <div class="flex items-center gap-1">
                <Button
                  size="icon"
                  variant="ghost"
                  class="size-6 text-muted-foreground hover:text-foreground"
                  :title="item.visiable ? '在提问页隐藏该话题' : '在提问页显示该话题'"
                  @click="useQB.changeTagVisiable(item.name, !item.visiable)"
                >
                  <Eye24Filled v-if="item.visiable" class="size-3.5" />
                  <EyeOff24Filled v-else class="size-3.5" />
                </Button>

                <Popconfirm
                  title="确认删除标签？"
                  :description="`确认删除标签「${item.name}」吗？`"
                  @confirm="useQB.delTag(item.name)"
                >
                  <Button
                    size="icon"
                    variant="ghost"
                    class="size-6 text-muted-foreground hover:text-destructive"
                  >
                    <Delete24Regular class="size-3.5" />
                  </Button>
                </Popconfirm>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  </div>
</template>
