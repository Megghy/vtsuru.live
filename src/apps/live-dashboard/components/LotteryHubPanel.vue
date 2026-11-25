<script setup lang="ts">
import { Dices, ExternalLink, Play, RotateCcw, Sparkles, Square, Trophy, Users } from 'lucide-vue-next'
import { computed, defineAsyncComponent, onUnmounted, ref } from 'vue'
import { toast } from 'vue-sonner'

import { useAccount } from '@/api/account'
import type { EventModel } from '@/api/client-types'
import { postApiLotteryLiveUpdateUsers } from '@/api/generated/lottery/lottery'
import { EventDataTypes, type LiveLotteryUserInfo } from '@/api/generated/model'
import type { LotteryHistory, LotteryOption } from '@/apps/open-live/components/lottery/lotteryTypes'
import {
  buildLiveLotterySyncBody,
  formatLotteryAvatar,
  getLiveLotteryUserKey,
  shuffleArray,
} from '@/apps/open-live/components/lottery/lotteryUtils'
import { CURRENT_HOST, isTauri } from '@/shared/config'
import { usePersistedStorage } from '@/shared/storage/persist'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { FormField } from '@/shared/ui/form-field'
import { Input } from '@/shared/ui/input'
import { NumberField } from '@/shared/ui/number-field'
import { SettingRow } from '@/shared/ui/setting-row'
import { Switch } from '@/shared/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs'
import { SimpleTooltip } from '@/shared/ui/tooltip'
import { useDanmakuClient } from '@/store/useDanmakuClient'

import IconAction from './IconAction.vue'
import PanelShell from './PanelShell.vue'

defineProps<{ blurred?: boolean }>()

const inTauri = isTauri()
const TianxuanPanel = defineAsyncComponent(() => import('@/apps/client/components/live-manage/TianxuanPanel.vue'))

const account = useAccount()
const client = useDanmakuClient()

const activeTab = ref('site')
const collecting = ref(false)
const drawing = ref(false)
const participants = ref<LiveLotteryUserInfo[]>([])
const winners = ref<LiveLotteryUserInfo[]>([])
const participantKeys = new Set<string>()

const option = usePersistedStorage<LotteryOption>('Settings.OpenLive.LotteryOption', {
  resultCount: 1,
  lotteryType: 'single',
  type: 'danmaku',
  danmakuFilterType: 'contains',
  danmakuKeyword: '',
  needFanMedal: false,
  needWearFanMedal: false,
  needGuard: false,
  giftMinPrice: 0,
  giftName: '',
  animationSpeed: 1,
})

const history = usePersistedStorage<LotteryHistory[]>('OpenLive.LotteryHistory', [])

const keywordModel = computed({
  get: () => option.value.danmakuKeyword,
  set: (v: string) => {
    option.value.danmakuKeyword = v
  },
})

function matchesRule(event: EventModel): boolean {
  if (event.type !== EventDataTypes.Message) return false
  if (option.value.needGuard && !event.guard_level) return false
  if (option.value.needFanMedal && !event.fans_medal_level) return false
  if (option.value.needWearFanMedal && !event.fans_medal_wearing_status) return false
  const kw = option.value.danmakuKeyword.trim()
  if (kw) {
    const msg = (event.msg || '').trim()
    if (option.value.danmakuFilterType === 'contains') {
      if (!msg.includes(kw)) return false
    } else if (option.value.danmakuFilterType === 'regex') {
      try {
        if (!new RegExp(kw).test(msg)) return false
      } catch {
        return false
      }
    } else if (msg !== kw) {
      return false
    }
  }
  return true
}

function onDanmakuEvent(event: EventModel) {
  if (!collecting.value || !matchesRule(event)) return
  const user: LiveLotteryUserInfo = {
    name: event.uname,
    uId: event.uid,
    openId: event.ouid || event.open_id || '',
    avatar: event.uface,
    fans_medal_level: event.fans_medal_level ?? 0,
    fans_medal_name: event.fans_medal_name ?? '',
    fans_medal_wearing_status: !!event.fans_medal_wearing_status,
    guard_level: event.guard_level ?? 0,
  }
  const key = getLiveLotteryUserKey(user)
  if (!key || participantKeys.has(key)) return
  participantKeys.add(key)
  participants.value = [...participants.value, user]
}

async function syncObs(finished: boolean) {
  try {
    await postApiLotteryLiveUpdateUsers(
      buildLiveLotterySyncBody({
        code: account.value.biliAuthCode ?? undefined,
        users: participants.value,
        resultUsers: winners.value,
        drawing: drawing.value,
        finished,
      }),
    )
  } catch {
    // OBS 同步失败不影响本地抽奖结果
  }
}

function startCollect() {
  if (collecting.value) return
  collecting.value = true
  winners.value = []
  client.onEvent('all', onDanmakuEvent)
  void syncObs(false)
  toast.success('已开始收集参与弹幕')
}

function stopCollect() {
  if (!collecting.value) return
  collecting.value = false
  client.offEvent('all', onDanmakuEvent)
  void syncObs(false)
}

async function drawNow() {
  if (participants.value.length === 0) {
    toast.warning('当前参与名单为空')
    return
  }
  stopCollect()
  drawing.value = true
  try {
    const count = Math.max(1, Math.min(option.value.resultCount || 1, participants.value.length))
    const picked = shuffleArray(participants.value).slice(0, count)
    winners.value = picked
    history.value = [{ users: picked, time: Date.now() }, ...history.value].slice(0, 30)
    await syncObs(true)
    toast.success(`已抽出 ${picked.length} 位中奖观众`)
  } finally {
    drawing.value = false
  }
}

function resetPool() {
  stopCollect()
  participantKeys.clear()
  participants.value = []
  winners.value = []
  void syncObs(false)
}

async function openFullLottery() {
  const url = `${CURRENT_HOST}manage/lottery`
  if (isTauri()) {
    const { openUrl } = await import('@tauri-apps/plugin-opener')
    await openUrl(url)
  } else {
    window.open(url, '_blank')
  }
}

onUnmounted(() => {
  client.offEvent('all', onDanmakuEvent)
})
</script>

<template>
  <PanelShell
    title="抽奖控台"
    panel-id="lottery"
    :count="activeTab === 'site' ? participants.length : undefined"
    :blurred="blurred"
  >
    <template #actions>
      <IconAction
        :icon="ExternalLink"
        tip="打开完整抽奖页"
        @click="openFullLottery"
      />
    </template>

    <div class="flex flex-col h-full min-h-0 p-2 gap-2 text-xs">
      <Tabs
        v-model="activeTab"
        class="flex flex-col flex-1 min-h-0"
      >
        <TabsList
          v-if="inTauri"
          size="xs"
          class="grid w-full grid-cols-2 shrink-0"
        >
          <TabsTrigger
            value="site"
            class="gap-1"
          >
            <Dices class="size-3" />
            站内抽奖
          </TabsTrigger>
          <TabsTrigger
            value="tianxuan"
            class="gap-1"
          >
            <Sparkles class="size-3" />
            天选时刻
          </TabsTrigger>
        </TabsList>

        <TabsContent
          value="site"
          class="flex-1 min-h-0 overflow-y-auto scrollbar-thin space-y-2.5 mt-2"
        >
          <div class="rounded-md border border-border bg-card/70 p-2 space-y-2">
            <FormField label="参与弹幕口令（留空表示任意弹幕）">
              <Input
                v-model="keywordModel"
                size="xs"
                placeholder="例如：抽奖、我要参加"
                :disabled="collecting"
              />
            </FormField>

            <div class="grid grid-cols-2 gap-2 items-end">
              <FormField label="抽取人数">
                <NumberField
                  v-model="option.resultCount"
                  :min="1"
                  :max="50"
                  :disabled="collecting"
                />
              </FormField>
              <div class="flex items-center gap-1 justify-end">
                <Button
                  v-if="!collecting"
                  size="xs"
                  class="gap-1 flex-1"
                  @click="startCollect"
                >
                  <Play class="size-3" />
                  开始收集
                </Button>
                <Button
                  v-else
                  size="xs"
                  variant="destructive"
                  class="gap-1 flex-1"
                  @click="stopCollect"
                >
                  <Square class="size-3" />
                  停止收集
                </Button>
              </div>
            </div>

            <div class="grid grid-cols-2 gap-x-3 gap-y-1 pt-1 border-t border-border/60">
              <SettingRow
                variant="none"
                title="需佩戴粉丝牌"
              >
                <Switch
                  v-model="option.needWearFanMedal"
                  :disabled="collecting"
                />
              </SettingRow>
              <SettingRow
                variant="none"
                title="仅限大航海"
              >
                <Switch
                  v-model="option.needGuard"
                  :disabled="collecting"
                />
              </SettingRow>
            </div>
          </div>

          <div class="flex items-center gap-1.5">
            <Button
              size="xs"
              variant="default"
              class="flex-1 gap-1"
              :disabled="!participants.length || drawing"
              @click="drawNow"
            >
              <Trophy class="size-3.5" />
              立即开奖（{{ participants.length }} 人已参与）
            </Button>
            <SimpleTooltip content="清空奖池">
              <Button
                size="icon-xs"
                variant="outline"
                aria-label="清空奖池"
                :disabled="!participants.length && !winners.length"
                @click="resetPool"
              >
                <RotateCcw class="size-3.5" />
              </Button>
            </SimpleTooltip>
          </div>

          <!-- 中奖名单 -->
          <div
            v-if="winners.length > 0"
            class="rounded-md border border-amber-500/40 bg-amber-500/8 p-2 space-y-1.5"
          >
            <div class="flex items-center gap-1 font-semibold text-amber-600 dark:text-amber-400">
              <Trophy class="size-3.5" />
              <span>中奖观众（{{ winners.length }}）</span>
            </div>
            <div class="space-y-1">
              <div
                v-for="user in winners"
                :key="getLiveLotteryUserKey(user)"
                class="flex items-center gap-2 rounded bg-card/80 px-2 py-1"
              >
                <img
                  :src="formatLotteryAvatar(user.avatar, 48)"
                  referrerpolicy="no-referrer"
                  class="size-5 rounded-full shrink-0"
                />
                <span class="font-medium text-foreground truncate">{{ user.name }}</span>
                <Badge
                  v-if="user.fans_medal_name"
                  variant="secondary"
                  size="xs"
                  class="ml-auto text-[10px]"
                >
                  {{ user.fans_medal_name }} {{ user.fans_medal_level }}
                </Badge>
              </div>
            </div>
          </div>

          <!-- 参与名单预览 -->
          <div class="space-y-1">
            <div class="flex-between text-[11px] text-muted-foreground">
              <span class="inline-flex items-center gap-1">
                <Users class="size-3" />
                参与池（{{ participants.length }}）
              </span>
              <span v-if="collecting" class="text-emerald-500">正在监听弹幕...</span>
            </div>
            <div
              v-if="participants.length > 0"
              class="flex flex-wrap gap-1 max-h-40 overflow-y-auto scrollbar-thin"
            >
              <Badge
                v-for="user in participants.slice(-40)"
                :key="getLiveLotteryUserKey(user)"
                variant="outline"
                size="xs"
                class="max-w-[140px] truncate font-normal"
              >
                {{ user.name }}
              </Badge>
            </div>
            <div
              v-else
              class="py-5 text-center text-muted-foreground"
            >
              点击「开始收集」后，满足条件的弹幕观众会自动进入奖池
            </div>
          </div>
        </TabsContent>

        <TabsContent
          v-if="inTauri"
          value="tianxuan"
          class="flex-1 min-h-0 overflow-y-auto scrollbar-thin mt-2"
        >
          <TianxuanPanel />
        </TabsContent>
      </Tabs>
    </div>
  </PanelShell>
</template>
