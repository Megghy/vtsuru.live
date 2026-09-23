<script setup lang="ts">
import { Bot24Regular, Copy24Regular, Delete24Regular } from '@vicons/fluent'
import {
  NAlert,
  NButton,
  NCard,
  NEmpty,
  NFlex,
  NIcon,
  NPopconfirm,
  NSpin,
  NSwitch,
  NText,
  useMessage,
} from 'naive-ui'
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
  if (data) {
    group.notify = data.notify
    return
  }
  group.notify.liveStart = !liveStart
}

async function unbind(group: QqBotGroup) {
  const ok = await run(() => unbindQqBotGroup(group.groupOpenId), { success: '已解除绑定' })
  if (ok !== undefined)
    groups.value = groups.value.filter(item => item.groupOpenId !== group.groupOpenId)
}

onMounted(() => {
  void refresh()
})
</script>

<template>
  <NFlex vertical :size="16">
    <ManagePageHeader
      title="QQ 群机器人"
      subtitle="把官方机器人拉进粉丝群，用绑定码把群绑到当前账号。群成员输入 / 即可查询直播状态和主页链接。"
    />

    <NSpin :show="loading">
      <NFlex vertical :size="16">
        <NAlert type="warning" title="开发中，暂不可用">
          QQ 群机器人还在开发中，所有功能暂不可用
        </NAlert>
        <NAlert
          v-if="status && !status.configured"
          type="warning"
          title="机器人未配置"
        >
          后端尚未填写 QQ 机器人 AppId / Secret，Webhook 不会启动。
        </NAlert>
        <NAlert
          v-else-if="status && !status.ready"
          type="info"
          title="Webhook 尚未握手"
        >
          配置已就绪。QQ 开放平台完成首次回调后才会显示已连接。
        </NAlert>

        <NCard size="small" title="绑定群">
          <NFlex vertical :size="12">
            <NText depth="3">
              1. 把机器人拉进粉丝群
              <br>
              2. 生成绑定码
              <br>
              3. 群主或管理员输入 / 打开菜单，或直接发送「/绑定 验证码」
            </NText>
            <NFlex :size="8" align="center">
              <NButton type="primary" disabled @click="createCode">
                <template #icon>
                  <NIcon :component="Bot24Regular" />
                </template>
                生成绑定码
              </NButton>
              <NButton
                v-if="bindCode"
                secondary
                @click="copy(bindCode.code, '绑定码')"
              >
                <template #icon>
                  <NIcon :component="Copy24Regular" />
                </template>
                复制绑定码
              </NButton>
              <NButton
                v-if="bindCode"
                secondary
                @click="copy(bindCode.instruction, '指令')"
              >
                复制指令
              </NButton>
            </NFlex>
            <NText v-if="bindCode" class="bind-code">
              {{ bindCode.code }}
              <NText depth="3">
                有效至 {{ new Date(bindCode.expiresAt).toLocaleString() }}
              </NText>
            </NText>
          </NFlex>
        </NCard>

        <NCard size="small" title="已绑定的群">
          <NEmpty v-if="!groups.length" description="还没有绑定任何群" />
          <NFlex v-else vertical :size="8">
            <div
              v-for="group in groups"
              :key="group.groupOpenId"
              class="group-row"
            >
              <div class="group-meta">
                <strong>群 …{{ group.groupHint }}</strong>
                <NText depth="3">
                  {{ new Date(group.boundAt).toLocaleString() }} · 今日推送 {{ group.todayPushCount }}
                </NText>
              </div>
              <NFlex :size="8" align="center">
                <NText depth="3">开播推送</NText>
                <NSwitch
                  disabled
                  :value="group.notify.liveStart"
                  @update:value="(value: boolean) => toggleLiveStart(group, value)"
                />
                <NPopconfirm @positive-click="unbind(group)">
                  <template #trigger>
                    <NButton size="small" quaternary type="error" disabled>
                      <template #icon>
                        <NIcon :component="Delete24Regular" />
                      </template>
                      解绑
                    </NButton>
                  </template>
                  确定解除这个群的绑定？
                </NPopconfirm>
              </NFlex>
            </div>
          </NFlex>
        </NCard>
      </NFlex>
    </NSpin>
  </NFlex>
</template>

<style scoped>
.bind-code {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 20px;
  letter-spacing: 0.12em;
}
.group-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 0;
  border-bottom: 1px solid var(--vtsuru-border);
}
.group-row:last-child {
  border-bottom: none;
}
.group-meta {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
</style>
