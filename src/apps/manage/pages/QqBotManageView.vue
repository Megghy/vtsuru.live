<script setup lang="ts">
import { Bot24Regular, Copy24Regular, Delete24Regular } from '@vicons/fluent'
import {  useMessage  } from '@/shared/utils'
import { onMounted, ref } from 'vue'

import {
  createQqBotBindCode,
  getQqBotGroups,
  getQqBotStatus,
  unbindQqBotGroup,
  updateQqBotGroupNotify,
  type QqBotBindCode,
  type QqBotGroup,
  type QqBotStatus,
} from '@/api/qq-bot'
import ManagePageHeader from '@/apps/manage/components/ManagePageHeader.vue'
import { useApiAction } from '@/apps/manage/composables/useApiAction'
import { copyToClipboard } from '@/shared/utils'
import { Alert, AlertDescription, AlertTitle } from '@/shared/ui/alert'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/shared/ui/alert-dialog'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { Switch } from '@/shared/ui/switch'

const message = useMessage()
const { loading, run } = useApiAction()
const status = ref<QqBotStatus>()
const groups = ref<QqBotGroup[]>([])
const bindCode = ref<QqBotBindCode>()

async function refresh() {
  const [nextStatus, nextGroups] = await Promise.all([
    run(() => getQqBotStatus(), { fail: '读取机器人状态失败' }),
    run(() => getQqBotGroups(), { fail: '读取已绑定群失败' }),
  ])
  if (nextStatus) status.value = nextStatus
  if (nextGroups) groups.value = nextGroups
}

async function createCode() {
  const data = await run(() => createQqBotBindCode(), { success: '已生成绑定码，10 分钟内有效' })
  if (data) bindCode.value = data
}

function copy(text: string, label: string) {
  copyToClipboard(text)
  message.success(`已复制${label}`)
}

async function toggleLiveStart(group: QqBotGroup, liveStart: boolean) {
  const data = await run(() => updateQqBotGroupNotify(group.groupOpenId, liveStart), { success: '已更新开播推送' })
  if (data && typeof data === 'object' && data !== null && 'notify' in data) {
    group.notify = (data as QqBotGroup).notify
    return
  }
  group.notify.liveStart = !liveStart
}

async function unbind(group: QqBotGroup) {
  const ok = await run(() => unbindQqBotGroup(group.groupOpenId), { success: '已解除绑定' })
  if (ok !== undefined)
    groups.value = groups.value.filter((item) => item.groupOpenId !== group.groupOpenId)
}

onMounted(() => {
  void refresh()
})
</script>

<template>
  <div class="space-y-4 w-full">
    <ManagePageHeader
      title="QQ 群机器人"
      subtitle="把官方机器人拉进粉丝群，用绑定码把群绑到当前账号。群成员输入 / 即可查询直播状态和主页链接"
    />

    <div class="space-y-4">
      <Alert variant="destructive">
        <AlertTitle>开发中，暂不可用</AlertTitle>
        <AlertDescription class="text-xs">
          QQ 群机器人还在开发中，所有功能暂不可用
        </AlertDescription>
      </Alert>

      <Alert
        v-if="status && !status.configured"
        variant="destructive"
      >
        <AlertTitle>机器人未配置</AlertTitle>
        <AlertDescription class="text-xs">
          后端尚未填写 QQ 机器人 AppId / Secret，Webhook 不会启动。
        </AlertDescription>
      </Alert>

      <Alert
        v-else-if="status && !status.ready"
        variant="default"
      >
        <AlertTitle>Webhook 尚未握手</AlertTitle>
        <AlertDescription class="text-xs">
          配置已就绪。QQ 开放平台完成首次回调后才会显示已连接。
        </AlertDescription>
      </Alert>

      <!-- 绑定群卡片 -->
      <Card>
        <CardHeader class="p-4 pb-2">
          <CardTitle class="text-sm font-semibold">
            绑定群
          </CardTitle>
        </CardHeader>
        <CardContent class="p-4 pt-0 space-y-3">
          <div class="text-xs text-muted-foreground leading-relaxed">
            1. 把机器人拉进粉丝群
            <br>
            2. 生成绑定码
            <br>
            3. 群主或管理员输入 / 打开菜单，或直接发送「/绑定 验证码」
          </div>

          <div class="flex items-center gap-2 flex-wrap">
            <Button
              size="xs"
              variant="brand"
              disabled
              @click="createCode"
            >
              <component
                :is="Bot24Regular"
                class="h-3.5 w-3.5 mr-1"
              />
              生成绑定码
            </Button>

            <Button
              v-if="bindCode"
              size="xs"
              variant="outline"
              @click="copy(bindCode.code, '绑定码')"
            >
              <component
                :is="Copy24Regular"
                class="h-3.5 w-3.5 mr-1"
              />
              复制绑定码
            </Button>

            <Button
              v-if="bindCode"
              size="xs"
              variant="outline"
              @click="copy(bindCode.instruction, '指令')"
            >
              复制指令
            </Button>
          </div>

          <div
            v-if="bindCode"
            class="p-2.5 rounded-lg bg-muted/40 border border-border flex items-baseline gap-2"
          >
            <span class="font-mono text-xl tracking-wider font-bold text-foreground">{{ bindCode.code }}</span>
            <span class="text-xs text-muted-foreground">有效至 {{ new Date(bindCode.expiresAt).toLocaleString() }}</span>
          </div>
        </CardContent>
      </Card>

      <!-- 已绑定的群卡片 -->
      <Card>
        <CardHeader class="p-4 pb-2">
          <CardTitle class="text-sm font-semibold">
            已绑定的群
          </CardTitle>
        </CardHeader>
        <CardContent class="p-4 pt-0">
          <div
            v-if="!groups.length"
            class="text-center py-8 text-xs text-muted-foreground"
          >
            还没有绑定任何群
          </div>

          <div
            v-else
            class="divide-y divide-border"
          >
            <div
              v-for="group in groups"
              :key="group.groupOpenId"
              class="py-2.5 flex items-center justify-between gap-3 text-xs"
            >
              <div>
                <strong class="text-foreground">群 …{{ group.groupHint }}</strong>
                <div class="text-[11px] text-muted-foreground mt-0.5">
                  {{ new Date(group.boundAt).toLocaleString() }} · 今日推送 {{ group.todayPushCount }}
                </div>
              </div>

              <div class="flex items-center gap-3">
                <div class="flex items-center gap-1.5 text-muted-foreground">
                  <span>开播推送</span>
                  <Switch
                    disabled
                    :checked="group.notify.liveStart"
                    @update:checked="(value: boolean) => toggleLiveStart(group, value)"
                  />
                </div>

                <AlertDialog>
                  <AlertDialogTrigger as-child>
                    <Button
                      size="xs"
                      variant="ghost"
                      class="text-destructive hover:bg-destructive/10"
                      disabled
                    >
                      <component
                        :is="Delete24Regular"
                        class="h-3.5 w-3.5 mr-1"
                      />
                      解绑
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent class="sm:max-w-md">
                    <AlertDialogHeader>
                      <AlertDialogTitle>解绑确认</AlertDialogTitle>
                      <AlertDialogDescription class="text-xs">
                        确定解除这个群的绑定？
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>取消</AlertDialogCancel>
                      <AlertDialogAction @click="unbind(group)">
                        确定解绑
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  </div>
</template>
