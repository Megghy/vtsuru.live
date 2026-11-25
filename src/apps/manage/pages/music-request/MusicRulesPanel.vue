<script setup lang="ts">
import Add24Regular from '@vicons/fluent/es/Add24Regular'
import ArrowClockwise24Regular from '@vicons/fluent/es/ArrowClockwise24Regular'
import Dismiss16Filled from '@vicons/fluent/es/Dismiss16Filled'
import { computed, onMounted, ref, watch } from 'vue'

import { useAccount } from '@/api/account'
import StickyDraftSaveBar from '@/apps/open-live/components/shared/StickyDraftSaveBar.vue'
import { useUnsavedChangesGuard } from '@/shared/composables/useUnsavedChangesGuard'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
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
  | 'orderPrefix'
  | 'obsTitle'
  | 'platform'
  | 'orderMusicFirst'
  | 'playMusicWhenFree'
  | 'orderCooldown'
  | 'maxWaitingSize'
  | 'preventDuplicateInQueue'
  | 'blacklist'
>

function normalizeDraft(raw?: Partial<MusicRequestSettings> | null): MusicRuleDraft {
  const base = createDefaultMusicRequestSettings()
  return {
    orderPrefix: raw?.orderPrefix ?? base.orderPrefix,
    obsTitle: (raw?.obsTitle ?? base.obsTitle) || '点歌机',
    platform: raw?.platform === 'kugou' ? 'kugou' : 'netease',
    orderMusicFirst: raw?.orderMusicFirst ?? base.orderMusicFirst,
    playMusicWhenFree: raw?.playMusicWhenFree ?? base.playMusicWhenFree,
    orderCooldown: raw?.orderCooldown ?? base.orderCooldown,
    maxWaitingSize: raw?.maxWaitingSize ?? base.maxWaitingSize,
    preventDuplicateInQueue: raw?.preventDuplicateInQueue ?? base.preventDuplicateInQueue,
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
  () => [
    musicRequestStore.settings.orderPrefix,
    musicRequestStore.settings.obsTitle,
    musicRequestStore.settings.platform,
    musicRequestStore.settings.orderMusicFirst,
    musicRequestStore.settings.playMusicWhenFree,
    musicRequestStore.settings.orderCooldown,
    musicRequestStore.settings.maxWaitingSize,
    musicRequestStore.settings.preventDuplicateInQueue,
    musicRequestStore.settings.blacklist,
  ],
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

// 黑名单关键词编辑（随草稿统一保存）
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
        .map((d) => ({
          label: d.label || `输出设备 ${d.deviceId.slice(0, 8)}`,
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
          ? '点歌机规则、OBS 标题与关键词黑名单统一点击「保存设置」同步到云端。'
          : '当前为本地演示模式，修改后点击「保存设置」保存在本机。'
      "
      @reset="handleReset"
      @save="handleSave"
    />

    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <!-- 弹幕与播放规则 -->
      <Card>
        <CardHeader class="p-3.5">
          <CardTitle class="text-xs uppercase tracking-wide">点歌弹幕与播放规则</CardTitle>
        </CardHeader>
        <CardContent class="space-y-3.5">
          <SettingRow
            v-model="draft.orderPrefix"
            type="text"
            variant="none"
            title="点歌弹幕前缀"
            placeholder="如: 点歌"
            description="输入如：点歌 晴天"
          />

          <SettingRow
            v-model="draft.obsTitle"
            type="text"
            variant="none"
            title="OBS 舞台标题"
            placeholder="点歌机"
            description="在 OBS 源顶部展示的面板标题"
          />

          <SettingRow
            variant="none"
            title="音乐搜索平台"
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

          <Separator />

          <div class="space-y-2">
            <SettingRow
              v-model="draft.orderMusicFirst"
              type="switch"
              variant="none"
              title="优先播放点歌"
              description="当前正在播闲置歌单时，收到观众点歌后立即切播"
            />
            <SettingRow
              v-model="draft.playMusicWhenFree"
              type="switch"
              variant="none"
              title="空闲时自动播放闲置歌单"
            />
          </div>

          <Separator />

          <SettingRow
            variant="none"
            title="音频输出设备 (本机)"
            description="选择播放点歌机的独立音频输出通道"
          >
            <div class="flex items-center gap-1.5">
              <Select v-model="selectedDeviceId">
                <SelectTrigger class="w-44">
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
                <ArrowClockwise24Regular class="size-3.5" />
              </Button>
            </div>
          </SettingRow>
        </CardContent>
      </Card>

      <!-- 冷却与黑名单管理 -->
      <div class="space-y-4">
        <Card>
          <CardHeader class="p-3.5">
            <CardTitle class="text-xs uppercase tracking-wide">冷却时间与防刷限制</CardTitle>
          </CardHeader>
          <CardContent class="space-y-3.5">
            <SettingRow
              v-model="draft.orderCooldown"
              type="number"
              variant="none"
              title="个人点歌冷却"
              description="单位：秒 (设为 0 不限频)"
              :min="0"
              :max="3600"
            />

            <SettingRow
              v-model="draft.maxWaitingSize"
              type="number"
              variant="none"
              title="待播队列上限"
              description="设为 0 表示不限制排队数量"
              :min="0"
              :max="200"
            />

            <SettingRow
              v-model="draft.preventDuplicateInQueue"
              type="switch"
              variant="none"
              title="禁止队列内重复点播同首歌"
              description="当前正在播放或待播中已存在该曲目时自动拦截"
            />

            <Separator />

            <div class="flex-between">
              <span class="text-xs text-muted-foreground">当前冷却中观众 ({{ activeCooldowns.length }} 人)</span>
              <Button
                size="xs"
                variant="ghost"
                class="text-amber-600 hover:bg-amber-500/10"
                :disabled="activeCooldowns.length === 0"
                @click="musicRequestStore.clearAllCooldowns()"
              >
                解除全部冷却
              </Button>
            </div>

            <div
              v-if="activeCooldowns.length > 0"
              class="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto"
            >
              <Badge
                v-for="cd in activeCooldowns"
                :key="cd.userKey"
                variant="warning"
                class="gap-1.5 pr-1"
              >
                <span>{{ cd.name }} (剩 {{ cd.remain }}s)</span>
                <button
                  type="button"
                  class="rounded-full p-0.5 hover:bg-black/10 transition-colors"
                  aria-label="解除该观众冷却"
                  @click="musicRequestStore.clearCooldown(cd.userKey)"
                >
                  <Dismiss16Filled class="size-3" />
                </button>
              </Badge>
            </div>
            <div
              v-else
              class="text-xs text-muted-foreground py-2"
            >
              暂无处于冷却中的观众
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader class="p-3.5">
            <CardTitle class="text-xs uppercase tracking-wide">歌曲关键词黑名单</CardTitle>
          </CardHeader>
          <CardContent class="space-y-3">
            <div class="flex items-center gap-2">
              <Input
                v-model="newBlacklistKeyword"
                placeholder="输入违规词或禁点歌名"
                class="flex-1"
                @keyup.enter="addBlacklist"
              />
              <Button @click="addBlacklist">
                <Add24Regular class="size-4 mr-1" />
                添加
              </Button>
            </div>

            <div
              v-if="draft.blacklist.length > 0"
              class="flex flex-wrap gap-1.5"
            >
              <Badge
                v-for="kw in draft.blacklist"
                :key="kw"
                variant="destructive"
                class="gap-1.5 pr-1"
              >
                <span>{{ kw }}</span>
                <button
                  type="button"
                  class="rounded-full p-0.5 hover:bg-white/20 transition-colors"
                  aria-label="移除关键词"
                  @click="removeBlacklist(kw)"
                >
                  <Dismiss16Filled class="size-3" />
                </button>
              </Badge>
            </div>
            <div
              v-else
              class="text-xs text-muted-foreground py-2"
            >
              黑名单当前为空；观众拉黑可在「B 站黑名单」或待播列表屏蔽菜单中管理
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  </div>
</template>
