<script setup lang="ts">
import { Bell, MessageSquare } from 'lucide-vue-next'
import { useRouter } from 'vue-router'

import type { ResponseQAInfoToTarget } from '@/api/generated/model'
import ClientPageHeader from '@/apps/client/components/ClientPageHeader.vue'
import { onReceivedQuestion } from '@/apps/client/data/notification'
import { useSettings } from '@/apps/client/store/useSettings'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { SettingRow } from '@/shared/ui/setting-row'
import { Switch } from '@/shared/ui/switch'

const router = useRouter()
const setting = useSettings()

async function testNotification() {
  onReceivedQuestion({
    id: 1,
    question: {
      message: '这是一条测试问题',
    },
    tag: '测试标签',
    sender: { name: '测试用户', id: 1, isBiliAuthed: false },
    isPublic: true,
  } as ResponseQAInfoToTarget)
}
</script>

<template>
  <div class="client-readable">
    <div class="flex flex-col gap-3.5">
      <ClientPageHeader
        title="开发与测试工具"
        description="用于本地快速触发事件、调试系统通知与排查桌面客户端运行状态"
      />

      <Card>
        <CardHeader class="py-3 px-4">
          <CardTitle>调试操作</CardTitle>
        </CardHeader>
        <CardContent class="px-4 pb-4">
          <div class="flex flex-col gap-3.5">
            <div class="flex items-center gap-2.5 flex-wrap">
              <Button
                variant="secondary"
                class="gap-1.5"
                @click="testNotification"
              >
                <Bell class="size-3.5 text-primary" />
                测试触发提问通知
              </Button>

              <Button
                variant="outline"
                class="gap-1.5"
                @click="router.push({ name: 'client-danmaku-window-manage' })"
              >
                <MessageSquare class="size-3.5" />
                跳转弹幕机配置
              </Button>
            </div>

            <SettingRow
              variant="none"
              title="禁用弹幕客户端 (开发调试)"
              description="开启后在开发环境下跳过本地弹幕 WebSocket 连接"
            >
              <Switch
                :checked="setting.settings.dev_disableDanmakuClient"
                @update:checked="
                  (val) => {
                    setting.settings.dev_disableDanmakuClient = Boolean(val)
                    setting.save()
                  }
                "
              />
            </SettingRow>
          </div>
        </CardContent>
      </Card>
    </div>
  </div>
</template>
