<script setup lang="ts">
import { useIntervalFn } from '@vueuse/core'
import { Check, Copy, History, MonitorPlay, PlusCircle, Settings2 } from 'lucide-vue-next'
import { computed, onMounted, ref } from 'vue'
import { toast } from 'vue-sonner'

import { useAccount } from '@/api/account'
import {
  createDefaultVoteConfig,
  type CreateVotePayload,
  createVote,
  deleteVote,
  endVote,
  extendVote,
  getActiveVote,
  getVoteConfig,
  getVoteHistory,
  mergeVoteOption,
  pauseVote,
  removeVoteOption,
  resumeVote,
  saveVoteConfig,
  tiebreakDraw,
  tiebreakOvertime,
  type VoteConfigModel,
  type VoteSessionModel,
  type VoteTemplateItem,
} from '@/api/vote'
import VoteActivePanel from '@/apps/manage/components/vote/VoteActivePanel.vue'
import VoteCreatePanel from '@/apps/manage/components/vote/VoteCreatePanel.vue'
import VoteHistoryPanel from '@/apps/manage/components/vote/VoteHistoryPanel.vue'
import VotePreviewPanel from '@/apps/manage/components/vote/VotePreviewPanel.vue'
import VoteSettingsDialog from '@/apps/manage/components/vote/VoteSettingsDialog.vue'
import { useVoteDanmakuBridge } from '@/composables/useVoteDanmakuBridge'
import { Button } from '@/shared/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs'
import { mergeCloudAndLocalTemplates, useVoteTemplates } from '@/shared/utils/votePresets'
import { useDanmakuClient } from '@/store/useDanmakuClient'

const PAGE_SIZE = 20

const accountInfo = useAccount()
const danmakuClient = useDanmakuClient()
const localTemplates = useVoteTemplates()

const activeTab = ref<'create' | 'history' | 'preview'>('create')
const config = ref<VoteConfigModel>(createDefaultVoteConfig())
const activeSession = ref<VoteSessionModel | null>(null)
const historyList = ref<VoteSessionModel[]>([])
const historyKeyword = ref('')
const historyLoading = ref(false)
const historyHasMore = ref(false)
const busy = ref(false)
const savingConfig = ref(false)
const settingsOpen = ref(false)
const copiedQuickObs = ref(false)
const nowMs = ref(Date.now())

const createPanelRef = ref<InstanceType<typeof VoteCreatePanel> | null>(null)

const channelStatus = computed<{ label: string; tone: 'online' | 'web' | 'offline' }>(() => {
  if (accountInfo.value?.eventFetcherState?.online) {
    return { label: 'EventFetcher 在线收票', tone: 'online' }
  }
  if (danmakuClient.connected) {
    return { label: '网页弹幕桥接收票中', tone: 'web' }
  }
  return { label: '未连接弹幕源', tone: 'offline' }
})

const mergedTemplates = computed<VoteTemplateItem[]>(() =>
  mergeCloudAndLocalTemplates(config.value.templates, localTemplates.value),
)

useVoteDanmakuBridge(activeSession, {
  config,
  onUpdate: (status, updated) => {
    if (status === 'ended') {
      activeSession.value = null
      void loadHistory(true)
    } else if (updated) {
      activeSession.value = updated
    }
  },
})

useIntervalFn(() => {
  nowMs.value = Date.now()
}, 500)

useIntervalFn(() => {
  void refreshActiveVote(true)
}, 2000)

async function loadConfig() {
  try {
    const loaded = await getVoteConfig()
    config.value = loaded
    // 自动合并老版本仅存在本地的模板到云端列表
    const merged = mergeCloudAndLocalTemplates(loaded.templates, localTemplates.value)
    localTemplates.value = merged
    if (merged.length > (loaded.templates?.length ?? 0)) {
      config.value = { ...loaded, templates: merged }
      await saveVoteConfig(config.value).catch(() => undefined)
    }
  } catch (err) {
    toast.error(err instanceof Error ? err.message : '获取投票配置失败')
  }
}

async function refreshActiveVote(silent = false) {
  try {
    const prevId = activeSession.value?.id
    const current = await getActiveVote()
    activeSession.value = current
    if (prevId && !current) {
      void loadHistory(true)
    }
  } catch (err) {
    if (!silent) {
      toast.error(err instanceof Error ? err.message : '获取活跃投票失败')
    }
  }
}

async function loadHistory(reset = true) {
  historyLoading.value = true
  try {
    const offset = reset ? 0 : historyList.value.length
    const list = await getVoteHistory(PAGE_SIZE, offset, historyKeyword.value)
    historyList.value = reset ? list : [...historyList.value, ...list]
    historyHasMore.value = list.length >= PAGE_SIZE
  } catch (err) {
    toast.error(err instanceof Error ? err.message : '获取历史记录失败')
  } finally {
    historyLoading.value = false
  }
}

async function runAction<T>(fn: () => Promise<T>, onSuccess: (res: T) => void) {
  busy.value = true
  try {
    const res = await fn()
    onSuccess(res)
  } catch (err) {
    toast.error(err instanceof Error ? err.message : '操作失败')
  } finally {
    busy.value = false
  }
}

function handleCreate(payload: CreateVotePayload) {
  void runAction(
    () => createVote(payload),
    (created) => {
      activeSession.value = created
      toast.success('弹幕投票已发起')
      void loadHistory(true)
    },
  )
}

function handleExtend(seconds: number) {
  void runAction(
    () => extendVote(seconds),
    (updated) => {
      activeSession.value = updated
      toast.success(`已延长 ${seconds} 秒`)
    },
  )
}

function handlePause() {
  void runAction(
    () => pauseVote(),
    (updated) => {
      activeSession.value = updated
      toast.success('投票已暂停')
    },
  )
}

function handleResume() {
  void runAction(
    () => resumeVote(),
    (updated) => {
      activeSession.value = updated
      toast.success('投票已恢复继续')
    },
  )
}

function handleEnd(id: number) {
  void runAction(
    () => endVote(id),
    () => {
      activeSession.value = null
      toast.success('投票已结束，OBS 正在展示结算结果')
      void loadHistory(true)
    },
  )
}

function handleRemoveOption(optionText: string) {
  void runAction(
    () => removeVoteOption(optionText),
    (updated) => {
      activeSession.value = updated
      toast.success(`已移除选项「${optionText}」`)
    },
  )
}

function handleMergeOption(sourceText: string, targetText: string) {
  void runAction(
    () => mergeVoteOption(sourceText, targetText),
    (updated) => {
      activeSession.value = updated
      toast.success(`已将「${sourceText}」并入「${targetText}」`)
    },
  )
}

function handleTiebreakDraw(sessionId: number) {
  void runAction(
    () => tiebreakDraw(sessionId),
    ({ winner }) => {
      if (activeSession.value?.id === sessionId) {
        activeSession.value = null
      }
      toast.success(winner ? `抽签结果：「${winner}」胜出` : '平票抽签已完成')
      void loadHistory(true)
    },
  )
}

function handleTiebreakOvertime(seconds: number) {
  void runAction(
    () => tiebreakOvertime(seconds),
    (next) => {
      activeSession.value = next
      toast.success(`已开启 ${seconds} 秒平票加时赛`)
      void loadHistory(true)
    },
  )
}

async function handleSaveConfig(next: VoteConfigModel) {
  savingConfig.value = true
  try {
    const payload = { ...next, templates: mergedTemplates.value }
    await saveVoteConfig(payload)
    config.value = payload
    settingsOpen.value = false
    toast.success('投票配置已保存并同步')
  } catch (err) {
    toast.error(err instanceof Error ? err.message : '保存配置失败')
  } finally {
    savingConfig.value = false
  }
}

async function handlePatchVisualConfig(patch: Partial<VoteConfigModel>) {
  savingConfig.value = true
  try {
    const next = { ...config.value, ...patch, templates: mergedTemplates.value }
    await saveVoteConfig(next)
    config.value = next
    toast.success('已更新默认 OBS 主题与位置')
  } catch (err) {
    toast.error(err instanceof Error ? err.message : '保存失败')
  } finally {
    savingConfig.value = false
  }
}

async function handleSaveTemplate(template: VoteTemplateItem) {
  const nextTemplates = [
    template,
    ...mergedTemplates.value.filter((t) => t.name.toLowerCase() !== template.name.toLowerCase()),
  ].slice(0, 50)
  localTemplates.value = nextTemplates
  config.value = { ...config.value, templates: nextTemplates }
  try {
    await saveVoteConfig(config.value)
    toast.success(`模板「${template.name}」已保存并同步云端`)
  } catch {
    toast.warning('模板已保存本地，云端同步稍后重试')
  }
}

async function handleDeleteTemplate(templateId: string) {
  const nextTemplates = mergedTemplates.value.filter((t) => t.id !== templateId)
  localTemplates.value = nextTemplates
  config.value = { ...config.value, templates: nextTemplates }
  try {
    await saveVoteConfig(config.value)
    toast.success('模板已删除')
  } catch {
    toast.warning('模板已从本地移除，云端同步失败')
  }
}

function handleReuseHistory(session: VoteSessionModel) {
  activeTab.value = 'create'
  createPanelRef.value?.fillFromHistory(
    session.title,
    (session.options ?? []).map((o) => o.text),
    session.multiVoteMode,
  )
  toast.success('已回填历史投票内容，可直接修改发起')
}

function handleDeleteHistory(id: number) {
  void runAction(
    () => deleteVote(id),
    () => {
      historyList.value = historyList.value.filter((item) => item.id !== id)
      if (activeSession.value?.id === id) activeSession.value = null
      toast.success('已删除历史记录')
    },
  )
}

async function copyQuickObsLink() {
  const url = new URL('/obs/danmaku-vote', window.location.origin)
  if (accountInfo.value?.id) url.searchParams.set('id', String(accountInfo.value.id))
  url.searchParams.set('theme', config.value.theme || 'glass')
  url.searchParams.set('position', config.value.displayPosition || 'center')
  await navigator.clipboard.writeText(url.toString())
  copiedQuickObs.value = true
  toast.success('已复制 OBS 投票链接')
  setTimeout(() => {
    copiedQuickObs.value = false
  }, 1800)
}

onMounted(() => {
  void loadConfig()
  void refreshActiveVote(true)
  void loadHistory(true)
})
</script>

<template>
  <div class="mx-auto max-w-6xl space-y-4 p-4">
    <!-- 顶部栏 -->
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 class="text-lg font-semibold tracking-tight text-foreground">弹幕投票</h1>
        <p class="text-xs text-muted-foreground">
          支持单选改票、多选防刷、大航海加权、粉丝牌门槛、礼物贡献 PK、平票破局与 OBS 自定义样式
        </p>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <Button variant="outline" @click="copyQuickObsLink">
          <Check v-if="copiedQuickObs" class="size-3.5 text-emerald-500" />
          <Copy v-else class="size-3.5" />
          {{ copiedQuickObs ? '已复制 OBS 链接' : '复制 OBS 链接' }}
        </Button>
        <Button variant="secondary" @click="settingsOpen = true">
          <Settings2 class="size-3.5" />
          全局与外观设置
        </Button>
      </div>
    </div>

    <!-- 进行中实时控场区 -->
    <VoteActivePanel
      v-if="activeSession"
      :session="activeSession"
      :config="config"
      :now-ms="nowMs"
      :busy="busy"
      :channel-status="channelStatus"
      @extend="handleExtend"
      @pause="handlePause"
      @resume="handleResume"
      @end="handleEnd"
      @remove-option="handleRemoveOption"
      @merge-option="handleMergeOption"
      @tiebreak-draw="handleTiebreakDraw"
      @tiebreak-overtime="handleTiebreakOvertime"
    />

    <!-- 功能标签页 -->
    <Tabs v-model="activeTab" class="space-y-4">
      <TabsList>
        <TabsTrigger value="create" class="gap-1.5">
          <PlusCircle class="size-3.5" />
          发起与模板
        </TabsTrigger>
        <TabsTrigger value="preview" class="gap-1.5">
          <MonitorPlay class="size-3.5" />
          OBS 预览与调试
        </TabsTrigger>
        <TabsTrigger value="history" class="gap-1.5">
          <History class="size-3.5" />
          历史与复盘
        </TabsTrigger>
      </TabsList>

      <TabsContent value="create" class="mt-0">
        <VoteCreatePanel
          ref="createPanelRef"
          :config="config"
          :templates="mergedTemplates"
          :has-active-vote="!!activeSession"
          :busy="busy"
          @create="handleCreate"
          @save-template="handleSaveTemplate"
          @delete-template="handleDeleteTemplate"
        />
      </TabsContent>

      <TabsContent value="preview" class="mt-0">
        <VotePreviewPanel
          :config="config"
          :active-session="activeSession"
          :now-ms="nowMs"
          :user-id="accountInfo?.id ?? 0"
          :saving-config="savingConfig"
          @apply-visual-to-config="handlePatchVisualConfig"
        />
      </TabsContent>

      <TabsContent value="history" class="mt-0">
        <VoteHistoryPanel
          :items="historyList"
          :loading="historyLoading"
          :has-more="historyHasMore"
          :keyword="historyKeyword"
          :result-mode="config.voteResultMode"
          @update:keyword="(v) => { historyKeyword = v }"
          @search="loadHistory(true)"
          @load-more="loadHistory(false)"
          @reuse="handleReuseHistory"
          @delete="handleDeleteHistory"
          @tiebreak-draw="handleTiebreakDraw"
        />
      </TabsContent>
    </Tabs>

    <!-- 全局设置弹窗 -->
    <VoteSettingsDialog
      v-model:open="settingsOpen"
      :config="config"
      :saving="savingConfig"
      @save="handleSaveConfig"
    />
  </div>
</template>
