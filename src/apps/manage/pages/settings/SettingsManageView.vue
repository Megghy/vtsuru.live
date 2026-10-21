<script setup lang="ts">
import { useMessage } from '@/shared/utils'
import { ref, watch } from 'vue'

import { SaveAccountSettings, SaveEnableFunctions, useAccount } from '@/api/account'
import { FunctionTypes } from '@/api/api-models'
import { useRouteQueryParam } from '@/composables/useRouteQueryParam'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { Checkbox } from '@/shared/ui/checkbox'
import { Separator } from '@/shared/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs'

import BlackListPane from './BlackListPane.vue'

const accountInfo = useAccount()
const message = useMessage()

const isSaving = ref(false)

const selectedTab = useRouteQueryParam('setting', 'general', { transform: String })
watch(
  selectedTab,
  (v) => {
    if (v === 'index') selectedTab.value = 'general'
  },
  { immediate: true },
)

const functionList: { type: FunctionTypes; label: string }[] = [
  { type: FunctionTypes.SongList, label: '歌单' },
  { type: FunctionTypes.QuestionBox, label: '提问箱（棉花糖）' },
  { type: FunctionTypes.Schedule, label: '日程' },
  { type: FunctionTypes.LiveRequest, label: '点播' },
  { type: FunctionTypes.Queue, label: '排队' },
  { type: FunctionTypes.Point, label: '积分和礼物' },
  { type: FunctionTypes.VideoCollect, label: '视频征集' },
  { type: FunctionTypes.CheckInRanking, label: '签到排行' },
]

function isFunctionEnabled(fn: FunctionTypes): boolean {
  return accountInfo.value?.settings.enableFunctions.includes(fn) ?? false
}

async function toggleFunction(fn: FunctionTypes, checked: boolean) {
  if (!accountInfo.value) return
  isSaving.value = true
  const list = accountInfo.value.settings.enableFunctions
  if (checked) {
    if (!list.includes(fn)) list.push(fn)
  } else {
    accountInfo.value.settings.enableFunctions = list.filter((f) => f !== fn)
  }

  try {
    const response = await SaveEnableFunctions(accountInfo.value.settings.enableFunctions)
    if (response.code !== 200) {
      message.error('修改失败')
      // 回滚
      if (checked) {
        accountInfo.value.settings.enableFunctions = list.filter((f) => f !== fn)
      } else if (!list.includes(fn)) {
        list.push(fn)
      }
    }
  } catch (err) {
    message.error(`修改失败: ${err}`)
    if (checked) {
      accountInfo.value.settings.enableFunctions = list.filter((f) => f !== fn)
    } else if (!list.includes(fn)) {
      list.push(fn)
    }
  } finally {
    isSaving.value = false
  }
}

/** 保存账户设置 */
async function SaveComboSetting() {
  if (!accountInfo.value) return
  isSaving.value = true
  try {
    const response = await SaveAccountSettings()
    if (response.code === 200) message.success('已保存')
    else message.error('修改失败')
  } catch (err) {
    message.error(`修改失败: ${err}`)
  } finally {
    isSaving.value = false
  }
}
</script>

<template>
  <Card>
    <CardHeader class="p-3.5 pb-2">
      <CardTitle class="text-sm font-semibold">
        系统设置
      </CardTitle>
    </CardHeader>

    <CardContent class="p-3.5 pt-0">
      <Tabs
        v-model="selectedTab"
        class="w-full"
      >
        <TabsList class="grid w-full grid-cols-2 max-w-xs h-8 p-0.5 bg-muted mb-3">
          <TabsTrigger
            value="general"
            class="text-xs h-7"
          >
            常规
          </TabsTrigger>
          <TabsTrigger
            value="blacklist"
            class="text-xs h-7"
          >
            黑名单
          </TabsTrigger>
        </TabsList>

        <!-- 常规设置 -->
        <TabsContent
          value="general"
          class="space-y-4 mt-2"
        >
          <!-- 启用功能 -->
          <div class="space-y-2">
            <span class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">启用功能</span>
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 rounded-md border border-border/60 bg-muted/20">
              <label
                v-for="item in functionList"
                :key="item.type"
                class="flex items-center gap-2 cursor-pointer text-xs font-medium select-none text-foreground hover:text-primary transition-colors"
              >
                <Checkbox
                  :model-value="isFunctionEnabled(item.type)"
                  :disabled="isSaving"
                  @update:model-value="(val) => toggleFunction(item.type, Boolean(val))"
                />
                <span>{{ item.label }}</span>
              </label>
            </div>
          </div>

          <Separator />

          <!-- 通知设置 -->
          <div class="space-y-2">
            <span class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">邮件通知</span>
            <div
              v-if="accountInfo"
              class="flex flex-col gap-2.5 p-3 rounded-md border border-border/60 bg-muted/20"
            >
              <label class="flex items-center gap-2 cursor-pointer text-xs font-medium select-none text-foreground">
                <Checkbox
                  :model-value="accountInfo.settings.sendEmail.recieveQA"
                  :disabled="isSaving"
                  @update:model-value="(val) => {
                    if (accountInfo) {
                      accountInfo.settings.sendEmail.recieveQA = Boolean(val)
                      SaveComboSetting()
                    }
                  }"
                />
                <span>收到新提问时发送邮件</span>
              </label>

              <label class="flex items-center gap-2 cursor-pointer text-xs font-medium select-none text-foreground">
                <Checkbox
                  :model-value="accountInfo.settings.sendEmail.recieveQAReply"
                  :disabled="isSaving"
                  @update:model-value="(val) => {
                    if (accountInfo) {
                      accountInfo.settings.sendEmail.recieveQAReply = Boolean(val)
                      SaveComboSetting()
                    }
                  }"
                />
                <span>提问收到回复时发送邮件</span>
              </label>

              <label class="flex items-center gap-2 cursor-pointer text-xs font-medium select-none text-foreground">
                <Checkbox
                  :model-value="accountInfo.settings.sendEmail.receiveOrder"
                  :disabled="isSaving"
                  @update:model-value="(val) => {
                    if (accountInfo) {
                      accountInfo.settings.sendEmail.receiveOrder = Boolean(val)
                      SaveComboSetting()
                    }
                  }"
                />
                <span>积分礼物有新用户兑换时发送邮件</span>
              </label>
            </div>
          </div>

          <Separator />

          <!-- 提问箱设置 -->
          <div class="space-y-2">
            <span class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">提问箱</span>
            <div
              v-if="accountInfo"
              class="flex flex-col gap-2 p-3 rounded-md border border-border/60 bg-muted/20"
            >
              <label class="flex items-center gap-2 cursor-pointer text-xs font-medium select-none text-foreground">
                <Checkbox
                  :model-value="accountInfo.settings.questionBox.allowUnregistedUser"
                  :disabled="isSaving"
                  @update:model-value="(val) => {
                    if (accountInfo) {
                      accountInfo.settings.questionBox.allowUnregistedUser = Boolean(val)
                      SaveComboSetting()
                    }
                  }"
                />
                <span>允许未注册/未登录用户提问</span>
              </label>
              <label class="flex items-center gap-2 cursor-pointer text-xs font-medium select-none text-foreground">
                <Checkbox
                  :model-value="accountInfo.settings.questionBox.allowAnonymous"
                  :disabled="isSaving"
                  @update:model-value="(val) => {
                    if (accountInfo) {
                      accountInfo.settings.questionBox.allowAnonymous = Boolean(val)
                      SaveComboSetting()
                    }
                  }"
                />
                <span>允许匿名提问（关闭后必须实名）</span>
              </label>
            </div>
          </div>
        </TabsContent>

        <!-- 黑名单设置 -->
        <TabsContent
          value="blacklist"
          class="mt-2"
        >
          <BlackListPane />
        </TabsContent>
      </Tabs>
    </CardContent>
  </Card>
</template>
