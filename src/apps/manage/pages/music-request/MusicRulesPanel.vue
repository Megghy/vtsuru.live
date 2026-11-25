<script setup lang="ts">
import { Plus, RefreshCw, X } from 'lucide-vue-next'
import { computed, onMounted, ref, watch } from 'vue'

import { useAccount } from '@/api/account'
import StickyDraftSaveBar from '@/apps/open-live/components/shared/StickyDraftSaveBar.vue'
import { useUnsavedChangesGuard } from '@/shared/composables/useUnsavedChangesGuard'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { Empty } from '@/shared/ui/empty'
import { FormField } from '@/shared/ui/form-field'
import { Input } from '@/shared/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Separator } from '@/shared/ui/separator'
import { SettingRow } from '@/shared/ui/setting-row'
import { ToggleGroup, ToggleGroupItem } from '@/shared/ui/toggle-group'
import { useMessage } from '@/shared/utils'
import {
  createDefaultMusicRequestSettings,
  type MusicRequestSettings,
  useMusicRequestProvider,
} from '@/store/useMusicRequest'

import { useActiveMusicCooldowns } from './useActiveMusicCooldowns'

const message = useMessage()
const accountInfo = useAccount()
const musicRequestStore = useMusicRequestProvider()

type MusicRuleDraft = Pick<
  MusicRequestSettings,
  | 'enabled'
  | 'orderPrefix'
  | 'obsTitle'
  | 'hideWhenEmpty'
  | 'obsMaxDisplayCount'
  | 'platform'
  | 'autoFallbackPlatform'
  | 'orderMusicFirst'
  | 'playMusicWhenFree'
  | 'orderCooldown'
  | 'maxWaitingSize'
  | 'maxSongsPerUser'
  | 'preventDuplicateInQueue'
  | 'onlyAllowLibrary'
  | 'requireFansMedal'
  | 'minFansMedalLevel'
  | 'guardIgnoreCooldown'
  | 'guardAutoPin'
  | 'allowSkipCommand'
  | 'skipPrefix'
  | 'allowCancelCommand'
  | 'cancelPrefix'
  | 'blacklist'
>

function normalizeDraft(raw?: Partial<MusicRequestSettings> | null): MusicRuleDraft {
  const base = createDefaultMusicRequestSettings()
  return {
    enabled: raw?.enabled ?? base.enabled,
    orderPrefix: raw?.orderPrefix ?? base.orderPrefix,
    obsTitle: (raw?.obsTitle ?? base.obsTitle) || '点歌机',
    hideWhenEmpty: raw?.hideWhenEmpty ?? base.hideWhenEmpty,
    obsMaxDisplayCount: raw?.obsMaxDisplayCount ?? base.obsMaxDisplayCount,
    platform: raw?.platform === 'kugou' ? 'kugou' : 'netease',
    autoFallbackPlatform: raw?.autoFallbackPlatform ?? base.autoFallbackPlatform,
    orderMusicFirst: raw?.orderMusicFirst ?? base.orderMusicFirst,
    playMusicWhenFree: raw?.playMusicWhenFree ?? base.playMusicWhenFree,
    orderCooldown: raw?.orderCooldown ?? base.orderCooldown,
    maxWaitingSize: raw?.maxWaitingSize ?? base.maxWaitingSize,
    maxSongsPerUser: raw?.maxSongsPerUser ?? base.maxSongsPerUser,
    preventDuplicateInQueue: raw?.preventDuplicateInQueue ?? base.preventDuplicateInQueue,
    onlyAllowLibrary: raw?.onlyAllowLibrary ?? base.onlyAllowLibrary,
    requireFansMedal: raw?.requireFansMedal ?? base.requireFansMedal,
    minFansMedalLevel: raw?.minFansMedalLevel ?? base.minFansMedalLevel,
    guardIgnoreCooldown: raw?.guardIgnoreCooldown ?? base.guardIgnoreCooldown,
    guardAutoPin: raw?.guardAutoPin ?? base.guardAutoPin,
    allowSkipCommand: raw?.allowSkipCommand ?? base.allowSkipCommand,
    skipPrefix: (raw?.skipPrefix ?? base.skipPrefix) || '切歌',
    allowCancelCommand: raw?.allowCancelCommand ?? base.allowCancelCommand,
    cancelPrefix: (raw?.cancelPrefix ?? base.cancelPrefix) || '取消点歌',
    blacklist: [...(raw?.blacklist ?? [])],
  }
}

const draft = ref<MusicRuleDraft>(normalizeDraft(musicRequestStore.settings))
const savedSnapshot = ref(JSON.stringify(draft.value))
const isSaving = ref(false)
const newBlacklistKeyword = ref('')

const isDirty = computed(() => JSON.stringify(draft.value) !== savedSnapshot.value)

function syncFromStore() {
  const next = normalizeDraft(musicRequestStore.settings)
  draft.value = next
  savedSnapshot.value = JSON.stringify(next)
}

watch(
  () => musicRequestStore.settings,
  () => {
    if (!isDirty.value) {
      syncFromStore()
    }
  },
  { deep: true },
)

async function handleSave() {
  isSaving.value = true
  try {
    const ok = await musicRequestStore.saveSettings(draft.value)
    if (ok) {
      syncFromStore()
    }
    return ok
  } finally {
    isSaving.value = false
  }
}

function handleReset() {
  syncFromStore()
  message.info('已还原为上次保存的设置')
}

useUnsavedChangesGuard(isDirty, '点歌机规则有未保存的更改，确定要离开吗？')

function addBlacklist() {
  const kw = newBlacklistKeyword.value.trim()
  if (!kw) return
  if (draft.value.blacklist.includes(kw)) {
    message.warning('该关键词已在黑名单中')
    newBlacklistKeyword.value = ''
    return
  }
  draft.value.blacklist.push(kw)
  newBlacklistKeyword.value = ''
}

function removeBlacklist(item: string) {
  draft.value.blacklist = draft.value.blacklist.filter((k) => k !== item)
}

// 音频输出设备（本机硬件选项）
const audioDevices = ref<{ label: string; value: string }[]>([{ label: '系统默认设备', value: 'default' }])
const isLoadingDevices = ref(false)

async function loadAudioDevices() {
  if (!navigator.mediaDevices?.enumerateDevices) return
  isLoadingDevices.value = true
  try {
    const devices = await navigator.mediaDevices.enumerateDevices()
    audioDevices.value = [
      { label: '系统默认设备', value: 'default' },
      ...devices
        .filter((d) => d.kind === 'audiooutput' && d.deviceId && d.deviceId !== 'default')
        .map((d, idx) => ({
          label: d.label || `输出设备 #${idx + 1} (${d.deviceId.slice(0, 6)})`,
          value: d.deviceId,
        })),
    ]
  } catch {
    /* ignore */
  } finally {
    isLoadingDevices.value = false
  }
}

const selectedDeviceId = computed({
  get: () => musicRequestStore.settings.deviceId || 'default',
  set: (val: string) => {
    musicRequestStore.settings.deviceId = val
    musicRequestStore.setSinkId()
  },
})

const activeCooldowns = useActiveMusicCooldowns()

onMounted(() => {
  syncFromStore()
  void loadAudioDevices()
})
</script>

<template>
  <div class="space-y-4">
    <StickyDraftSaveBar
      :is-dirty="isDirty"
      :is-saving="isSaving"
      :can-edit="true"
      :clean-hint="
        accountInfo?.id
          ? '修改任意点歌机规则后，此处将出现「保存设置」按钮同步到云端。'
          : '当前为本地演示模式，修改任意规则后点击「保存设置」保存在本机。'
      "
      @reset="handleReset"
      @save="handleSave"
    />

    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <!-- 卡片 1：弹幕接单与播放规则 -->
      <Card>
        <CardHeader class="p-3.5 pb-2">
          <CardTitle class="text-xs font-semibold">弹幕接单与播放规则</CardTitle>
        </CardHeader>
        <CardContent class="p-3.5 pt-1 space-y-3">
          <SettingRow
            v-model="draft.enabled"
            type="switch"
            variant="none"
            title="开启弹幕点歌接单"
            description="关闭后暂停响应观众点歌、切歌与取消弹幕，不影响当前背景播放"
          />

          <SettingRow
            v-model="draft.orderPrefix"
            type="text"
            variant="none"
            title="点歌弹幕前缀"
            placeholder="如: 点歌"
            description="观众发送「前缀 + 歌名」触发，例如：点歌 晴天"
          />

          <SettingRow
            variant="none"
            title="主搜索平台"
          >
            <ToggleGroup
              v-model="draft.platform"
              type="single"
              size="xs"
            >
              <ToggleGroupItem value="netease">网易云音乐</ToggleGroupItem>
              <ToggleGroupItem value="kugou">酷狗音乐</ToggleGroupItem>
            </ToggleGroup>
          </SettingRow>

          <SettingRow
            v-model="draft.autoFallbackPlatform"
            type="switch"
            variant="none"
            title="主平台无结果时自动回退另一平台"
            description="优先使用主平台，无版权或搜不到时自动尝试备用平台"
          />

          <Separator />

          <SettingRow
            v-model="draft.orderMusicFirst"
            type="switch"
            variant="none"
            title="优先播放观众点歌"
            description="当前正在播闲置曲库时，收到观众点歌后立即切播"
          />

          <SettingRow
            v-model="draft.playMusicWhenFree"
            type="switch"
            variant="none"
            title="空闲时自动播放闲置曲库"
            description="待播点歌播完后自动切回闲置曲库轮播"
          />

          <Separator />

          <SettingRow
            variant="none"
            title="音频输出设备 (本机)"
            description="可指定虚拟声卡以在 OBS 中独立控制点歌机音量"
          >
            <div class="flex items-center gap-1.5">
              <Select v-model="selectedDeviceId">
                <SelectTrigger
                  size="xs"
                  class="w-44"
                >
                  <SelectValue placeholder="系统默认设备" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem
                    v-for="dev in audioDevices"
                    :key="dev.value"
                    :value="dev.value"
                  >
                    {{ dev.label }}
                  </SelectItem>
                </SelectContent>
              </Select>
              <Button
                size="icon-xs"
                variant="outline"
                :loading="isLoadingDevices"
                aria-label="刷新音频设备"
                @click="loadAudioDevices"
              >
                <RefreshCw class="size-3.5" />
              </Button>
            </div>
          </SettingRow>
        </CardContent>
      </Card>

      <!-- 卡片 2：观众门槛与弹幕指令 -->
      <Card>
        <CardHeader class="p-3.5 pb-2">
          <CardTitle class="text-xs font-semibold">观众门槛与弹幕指令</CardTitle>
        </CardHeader>
        <CardContent class="p-3.5 pt-1 space-y-3">
          <SettingRow
            v-model="draft.onlyAllowLibrary"
            type="switch"
            variant="none"
            title="仅允许点播闲置曲库内歌曲"
            description="开启后不再在线搜索外部曲库，只匹配已收录歌曲（支持别名与译名）"
          />

          <SettingRow
            v-model="draft.requireFansMedal"
            type="switch"
            variant="none"
            title="要求佩戴粉丝牌"
            description="未佩戴粉丝牌的观众无法点歌（大航海默认放行）"
          />

          <SettingRow
            v-model="draft.minFansMedalLevel"
            type="number"
            variant="none"
            title="最低粉丝牌等级"
            description="设为 0 表示不限制牌子等级"
            :min="0"
            :max="40"
          />

          <Separator />

          <SettingRow
            v-model="draft.guardIgnoreCooldown"
            type="switch"
            variant="none"
            title="大航海免冷却"
            description="舰长 / 提督 / 总督不受个人点歌冷却限制"
          />

          <SettingRow
            v-model="draft.guardAutoPin"
            type="switch"
            variant="none"
            title="大航海点歌自动置顶"
            description="大航海入队时自动置顶到下一首优先播放"
          />

          <Separator />

          <SettingRow
            v-model="draft.allowCancelCommand"
            type="switch"
            variant="none"
            title="允许观众撤回自己点的歌"
            description="观众发送取消指令可撤回自己最近入队的歌曲并清除本次冷却"
          />

          <SettingRow
            v-if="draft.allowCancelCommand"
            v-model="draft.cancelPrefix"
            type="text"
            variant="none"
            title="取消点歌指令"
            placeholder="取消点歌"
          />

          <SettingRow
            v-model="draft.allowSkipCommand"
            type="switch"
            variant="none"
            title="允许弹幕切歌指令"
            description="仅当前点歌人本人、主播或大航海可触发切歌"
          />

          <SettingRow
            v-if="draft.allowSkipCommand"
            v-model="draft.skipPrefix"
            type="text"
            variant="none"
            title="切歌指令"
            placeholder="切歌"
          />
        </CardContent>
      </Card>

      <!-- 卡片 3：防刷限频、OBS 展示与冷却监控 -->
      <Card>
        <CardHeader class="p-3.5 pb-2">
          <CardTitle class="text-xs font-semibold">防刷限频与 OBS 展示</CardTitle>
        </CardHeader>
        <CardContent class="p-3.5 pt-1 space-y-3">
          <SettingRow
            v-model="draft.orderCooldown"
            type="number"
            variant="none"
            title="个人点歌冷却 (秒)"
            description="设为 0 不限频"
            :min="0"
            :max="3600"
          />

          <SettingRow
            v-model="draft.maxWaitingSize"
            type="number"
            variant="none"
            title="待播队列总上限"
            description="设为 0 表示不限制排队总数"
            :min="0"
            :max="200"
          />

          <SettingRow
            v-model="draft.maxSongsPerUser"
            type="number"
            variant="none"
            title="单人同时排队上限"
            description="限制单个观众同时在播/待播的曲目数，0 不限"
            :min="0"
            :max="20"
          />

          <SettingRow
            v-model="draft.preventDuplicateInQueue"
            type="switch"
            variant="none"
            title="禁止队列内重复点播同首歌"
            description="当前正在播放或待播中已存在该曲目时自动拦截"
          />

          <Separator />

          <SettingRow
            v-model="draft.obsTitle"
            type="text"
            variant="none"
            title="OBS 舞台标题"
            placeholder="点歌机"
          />

          <SettingRow
            v-model="draft.hideWhenEmpty"
            type="switch"
            variant="none"
            title="OBS 无点歌时自动隐藏"
            description="当前无观众点歌且待播为空时隐藏独立 OBS 源面板"
          />

          <SettingRow
            v-model="draft.obsMaxDisplayCount"
            type="number"
            variant="none"
            title="OBS 最多展示待播条数"
            description="设为 0 表示全部展示"
            :min="0"
            :max="50"
          />

          <Separator />

          <FormField :label="`当前冷却中观众 (${activeCooldowns.length} 人)`">
            <template #extra>
              <Button
                size="xs"
                variant="ghost"
                class="text-amber-600 dark:text-amber-400 hover:bg-amber-500/10"
                :disabled="activeCooldowns.length === 0"
                @click="musicRequestStore.clearAllCooldowns()"
              >
                解除全部冷却
              </Button>
            </template>

            <div
              v-if="activeCooldowns.length > 0"
              class="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto scrollbar-thin"
            >
              <Badge
                v-for="cd in activeCooldowns"
                :key="cd.userKey"
                variant="warning"
                class="gap-1 pr-1"
              >
                <span class="tabular-nums">{{ cd.name }} (剩 {{ cd.remain }}s)</span>
                <Button
                  size="none"
                  variant="ghost"
                  class="size-4 rounded-full hover:bg-foreground/10"
                  aria-label="解除该观众冷却"
                  @click="musicRequestStore.clearCooldown(cd.userKey)"
                >
                  <X class="size-2.5" />
                </Button>
              </Badge>
            </div>
            <Empty
              v-else
              size="small"
              description="暂无处于冷却中的观众"
              class="py-3"
            />
          </FormField>
        </CardContent>
      </Card>

      <!-- 卡片 4：歌曲关键词黑名单 -->
      <Card>
        <CardHeader class="p-3.5 pb-2">
          <CardTitle class="text-xs font-semibold">歌曲关键词黑名单</CardTitle>
        </CardHeader>
        <CardContent class="p-3.5 pt-1 space-y-3">
          <FormField
            label="添加屏蔽关键词"
            description="命中歌名或歌手关键词的弹幕点歌将被拦截；观众拉黑可在待播列表屏蔽菜单或 B 站黑名单中管理"
          >
            <div class="flex items-center gap-2">
              <Input
                v-model="newBlacklistKeyword"
                placeholder="输入违规词、歌手或禁点歌名"
                class="flex-1 min-w-0"
                @keyup.enter="addBlacklist"
              />
              <Button @click="addBlacklist">
                <Plus class="size-3.5 mr-1" />
                添加
              </Button>
            </div>
          </FormField>

          <div
            v-if="draft.blacklist.length > 0"
            class="flex flex-wrap gap-1.5"
          >
            <Badge
              v-for="kw in draft.blacklist"
              :key="kw"
              variant="destructive"
              class="gap-1 pr-1"
            >
              <span>{{ kw }}</span>
              <Button
                size="none"
                variant="ghost"
                class="size-4 rounded-full hover:bg-background/20"
                aria-label="移除关键词"
                @click="removeBlacklist(kw)"
              >
                <X class="size-2.5" />
              </Button>
            </Badge>
          </div>
          <Empty
            v-else
            size="small"
            description="黑名单当前为空"
            class="py-6"
          />
        </CardContent>
      </Card>
    </div>
  </div>
</template>
