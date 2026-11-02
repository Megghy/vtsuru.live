<script setup lang="ts">
import {
  ArrowReset24Regular,
  Checkmark24Regular,
  Copy24Regular,
  Open24Regular,
  People24Regular,
  Settings24Regular,
  Wrench24Regular,
} from '@vicons/fluent'
import { useClipboard } from '@vueuse/core'
import { computed, ref, watch } from 'vue'
import { toast } from 'vue-sonner'

import { useAccount } from '@/api/account'
import { buildObsSourceUrl } from '@/shared/obs/obsUrl'
import {
  DEFAULT_COLLAB_SETTINGS,
  normalizeCollabSettings,
  type CollabAlignmentType,
  type CollabLayoutType,
  type PngtuberCollabSettings,
} from '@/shared/pngtuber/collabSettings'
import type { PngtuberState } from '@/shared/pngtuber/types'
import { usePngtuberCollab } from '@/shared/pngtuber/usePngtuberCollab'
import { usePngtuberDebugger } from '@/shared/pngtuber/usePngtuberDebugger'
import { Alert, AlertDescription } from '@/shared/ui/alert'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { Input } from '@/shared/ui/input'
import { Progress } from '@/shared/ui/progress'
import { Slider } from '@/shared/ui/slider'
import { Switch } from '@/shared/ui/switch'
import { ToggleGroup, ToggleGroupItem } from '@/shared/ui/toggle-group'

const props = defineProps<{
  state?: PngtuberState
  channel?: string
}>()

const emit = defineEmits<{
  (e: 'patch', val: Partial<PngtuberState>): void
}>()

const { currentRoomCode, isHost, inRoom, members, collabError, createRoom, joinRoom, leaveRoom } = usePngtuberCollab()
const account = useAccount()
const {
  isMockCollab,
  mockMembers,
  autoCollabSpeaker,
  toggleMockCollab,
  cycleCollabSpeaker,
  toggleAutoCollabSpeaker,
  addMockMember,
  removeMockMember,
  setMemberSpeaking,
} = usePngtuberDebugger()

const settings = ref<PngtuberCollabSettings>({ ...DEFAULT_COLLAB_SETTINGS })
watch(
  () => props.state?.collab,
  (val) => {
    if (val) settings.value = { ...val }
  },
  { immediate: true, deep: true },
)

function updateCollabSetting(patch: Partial<PngtuberCollabSettings>) {
  const merged = normalizeCollabSettings({ ...settings.value, ...patch })
  settings.value = merged
  emit('patch', { collab: merged })
}

function resetToDefaults() {
  settings.value = { ...DEFAULT_COLLAB_SETTINGS }
  emit('patch', { collab: { ...DEFAULT_COLLAB_SETTINGS } })
}

const inputCode = ref('')
const loading = ref(false)
const copied = ref(false)
const showSettings = ref(false)
const { copy, isSupported: isCopySupported } = useClipboard()

const obsCollabUrl = computed(() => {
  if (typeof window === 'undefined') return ''
  if (!currentRoomCode.value && !isMockCollab.value) return ''
  return buildObsSourceUrl({
    path: '/obs-store/pngtuber-collab',
    host: window.location.origin,
    credential: account.value.id ? 'public-id' : 'none',
    userId: account.value.id,
    params: {
      room: currentRoomCode.value || undefined,
      channel: props.channel,
      mock: !currentRoomCode.value && isMockCollab.value ? 1 : undefined,
    },
  })
})

async function handleCreate() {
  if (loading.value) return
  loading.value = true
  try {
    const code = await createRoom(props.state)
    toast.success(`组队房间已创建：${code}`)
  } catch (err: unknown) {
    toast.error(err instanceof Error ? err.message : String(err))
  } finally {
    loading.value = false
  }
}

async function handleJoin() {
  const code = inputCode.value.trim().toUpperCase()
  if (!code) {
    toast.warning('请输入有效的 6 位房间码')
    return
  }
  loading.value = true
  try {
    await joinRoom(code, false, props.state)
    inputCode.value = ''
    toast.success(`已加入组队房间：${code}`)
  } catch (err: unknown) {
    toast.error(err instanceof Error ? err.message : String(err))
  } finally {
    loading.value = false
  }
}

function handleLeave() {
  leaveRoom()
  toast.info('已退出组队联动')
}

async function copyObsLink() {
  if (!obsCollabUrl.value) return
  if (!isCopySupported.value) {
    toast.warning('当前环境不支持直接写入剪贴板，请手动复制')
    return
  }
  try {
    await copy(obsCollabUrl.value)
    copied.value = true
    toast.success('已复制 OBS 组队画面链接')
    setTimeout(() => {
      copied.value = false
    }, 2000)
  } catch {
    toast.error('复制失败，请手动复制')
  }
}

function toggleMockPreview() {
  toggleMockCollab(props.state)
  toast.info(isMockCollab.value ? '已启动多人组队前端模拟（3人轮流发言）' : '已退出组队模拟')
}

const displayMembers = computed(() => {
  if (inRoom.value) return members.value
  if (isMockCollab.value) return mockMembers.value
  return []
})
</script>

<template>
  <Card class="border border-border/80 bg-card/60">
    <CardHeader class="py-3 px-4 flex flex-row items-center justify-between gap-2 border-b border-border/50">
      <div class="flex items-center gap-2 flex-wrap">
        <div class="flex items-center gap-1.5 font-semibold text-sm">
          <People24Regular class="size-4 text-brand" />
          <CardTitle class="text-sm font-semibold">多人联动（组队模式）</CardTitle>
        </div>

        <Badge
          v-if="inRoom"
          variant="outline"
          class="border-emerald-500/40 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 text-xs gap-1 font-mono"
        >
          组队中 · {{ currentRoomCode }}
          <span class="font-sans">({{ isHost ? '房主' : '队员' }})</span>
        </Badge>

        <Badge
          v-else-if="isMockCollab"
          variant="outline"
          class="border-amber-500/40 text-amber-600 dark:text-amber-400 bg-amber-500/10 text-xs gap-1 font-mono"
        >
          模拟调试中 (3人)
        </Badge>
      </div>

      <div class="flex items-center gap-1.5 flex-wrap">
        <Button
          variant="ghost"
          size="xs"
          class="gap-1"
          :class="{ 'bg-secondary text-primary font-medium': showSettings }"
          @click="showSettings = !showSettings"
        >
          <Settings24Regular class="size-3.5" />
          房间设置
        </Button>

        <Button
          variant="outline"
          size="xs"
          class="gap-1"
          :class="{
            'border-amber-500/50 bg-amber-500/10 text-amber-600 dark:text-amber-400': isMockCollab,
          }"
          @click="toggleMockPreview"
        >
          <Wrench24Regular class="size-3.5" />
          {{ isMockCollab ? '停止模拟' : '模拟多人效果' }}
        </Button>

        <template v-if="obsCollabUrl">
          <Button
            variant="secondary"
            size="xs"
            class="gap-1"
            @click="copyObsLink"
          >
            <Checkmark24Regular
              v-if="copied"
              class="size-3.5"
            />
            <Copy24Regular
              v-else
              class="size-3.5"
            />
            复制组队 OBS 链接
          </Button>

          <Button
            variant="outline"
            size="xs"
            class="gap-1"
            as-child
          >
            <a
              :href="obsCollabUrl"
              target="_blank"
              rel="noopener"
            >
              <Open24Regular class="size-3.5" />
              画面预览
            </a>
          </Button>
        </template>

        <Button
          v-if="inRoom"
          variant="destructive"
          size="xs"
          @click="handleLeave"
        >
          {{ isHost ? '解散房间' : '退出组队' }}
        </Button>
      </div>
    </CardHeader>

    <CardContent class="p-4 space-y-3">
      <div
        v-if="showSettings"
        class="p-3.5 rounded-lg border border-border/80 bg-muted/30 space-y-3.5 transition-all text-xs"
      >
        <div class="flex items-center justify-between">
          <span class="font-medium text-foreground flex items-center gap-1.5">
            <Settings24Regular class="size-3.5 text-muted-foreground" />
            房间本地显示与排版设置
          </span>
          <Button
            variant="ghost"
            size="xs"
            class="gap-1 text-muted-foreground hover:text-foreground"
            @click="resetToDefaults"
          >
            <ArrowReset24Regular class="size-3" />
            恢复推荐默认
          </Button>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="space-y-1.5">
            <div class="flex justify-between items-center text-muted-foreground">
              <span>立绘间距 (Gap)</span>
              <span class="font-mono text-foreground">{{ settings.gap }}px</span>
            </div>
            <Slider
              :min="0"
              :max="160"
              :step="4"
              :model-value="[settings.gap]"
              @update:model-value="updateCollabSetting({ gap: $event?.[0] })"
            />
          </div>

          <div class="space-y-1.5">
            <div class="flex justify-between items-center text-muted-foreground">
              <span>整体缩放大小 (Scale)</span>
              <span class="font-mono text-foreground">{{ Math.round(settings.scale * 100) }}%</span>
            </div>
            <Slider
              :min="0.5"
              :max="1.6"
              :step="0.05"
              :model-value="[settings.scale]"
              @update:model-value="updateCollabSetting({ scale: $event?.[0] })"
            />
          </div>

          <div class="space-y-1.5">
            <div class="text-muted-foreground">排列方向 (Layout)</div>
            <ToggleGroup
              type="single"
              :model-value="settings.layout"
              class="justify-start"
              @update:model-value="
                (val) => {
                  if (val) updateCollabSetting({ layout: val as CollabLayoutType })
                }
              "
            >
              <ToggleGroupItem value="row">横向贴底</ToggleGroupItem>
              <ToggleGroupItem value="grid">2x2 网格</ToggleGroupItem>
              <ToggleGroupItem value="column">垂直侧边</ToggleGroupItem>
            </ToggleGroup>
          </div>

          <div class="space-y-1.5">
            <div class="text-muted-foreground">对齐基线 (Alignment)</div>
            <ToggleGroup
              type="single"
              :model-value="settings.alignment"
              class="justify-start"
              @update:model-value="
                (val) => {
                  if (val) updateCollabSetting({ alignment: val as CollabAlignmentType })
                }
              "
            >
              <ToggleGroupItem value="bottom">贴底对齐</ToggleGroupItem>
              <ToggleGroupItem value="center">垂直居中</ToggleGroupItem>
              <ToggleGroupItem value="top">顶部对齐</ToggleGroupItem>
            </ToggleGroup>
          </div>
        </div>

        <div class="pt-2 border-t border-border/60 flex flex-wrap items-center gap-x-6 gap-y-2">
          <label class="flex items-center gap-2 cursor-pointer select-none">
            <Switch
              :checked="settings.spotlight"
              @update:checked="updateCollabSetting({ spotlight: $event })"
            />
            <span class="text-muted-foreground">聚光灯聚焦模式 (发言者放大、未发言压暗)</span>
          </label>

          <label class="flex items-center gap-2 cursor-pointer select-none">
            <Switch
              :checked="settings.showNames"
              @update:checked="updateCollabSetting({ showNames: $event })"
            />
            <span class="text-muted-foreground">显示主播名牌</span>
          </label>

          <label class="flex items-center gap-2 cursor-pointer select-none">
            <Switch
              :checked="settings.showVolumeBar"
              @update:checked="updateCollabSetting({ showVolumeBar: $event })"
            />
            <span class="text-muted-foreground">名牌微型音量条</span>
          </label>
        </div>

        <div class="text-[11px] text-muted-foreground/80 leading-relaxed">
          设置已接入 OBS Store 云端同步机制，在控制台修改间距与大小时，OBS
          画面将通过实时总线自动无缝刷新，无需重新复制或配置链接。
        </div>
      </div>

      <Alert
        v-if="collabError"
        variant="destructive"
      >
        <AlertDescription class="text-xs">{{ collabError }}</AlertDescription>
      </Alert>

      <div
        v-if="!inRoom && !isMockCollab"
        class="space-y-3"
      >
        <p class="text-xs text-muted-foreground leading-relaxed m-0">
          通过 6 位房间码与其他主播快速连麦组队！加入后将在同一个 OBS
          画面中并排展示双方立绘，并实时同步说话状态。无需队友时也可点击「模拟多人效果」预览排版。
        </p>

        <div class="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center">
          <div class="flex items-center gap-1.5 flex-1">
            <Input
              v-model="inputCode"
              placeholder="输入 6 位房间码（如 MEUK86）"
              class="uppercase tracking-widest font-mono text-xs"
              maxlength="16"
              @keyup.enter="handleJoin"
            />
            <Button
              variant="secondary"
              class="shrink-0"
              :disabled="loading || !inputCode.trim()"
              @click="handleJoin"
            >
              加入组队
            </Button>
          </div>

          <div class="h-4 w-px bg-border/80 hidden sm:block shrink-0" />

          <Button
            class="shrink-0"
            :disabled="loading"
            @click="handleCreate"
          >
            创建组队房间
          </Button>
        </div>
      </div>

      <div
        v-else
        class="space-y-3"
      >
        <div class="text-xs text-muted-foreground flex items-center justify-between">
          <div class="flex items-center gap-2">
            <span>队伍成员 ({{ displayMembers.length }} 人)</span>
            <span
              v-if="isMockCollab"
              class="text-amber-500 font-medium"
            >
              [模拟演示模式]
            </span>
          </div>

          <div
            v-if="isMockCollab"
            class="flex items-center gap-1.5"
          >
            <Button
              variant="outline"
              size="xs"
              @click="cycleCollabSpeaker"
            >
              切换下一个发言
            </Button>
            <Button
              variant="outline"
              size="xs"
              :class="{ 'border-primary text-primary': autoCollabSpeaker }"
              @click="toggleAutoCollabSpeaker"
            >
              {{ autoCollabSpeaker ? '自动轮流' : '暂停轮流' }}
            </Button>
            <Button
              variant="outline"
              size="xs"
              @click="addMockMember"
            >
              + 增加队友
            </Button>
          </div>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
          <div
            v-for="member in displayMembers"
            :key="member.userId"
            class="p-2.5 rounded-md border border-border bg-card/70 flex flex-col gap-1.5 transition-all"
            :class="{ 'ring-1 ring-primary/60 border-primary/50 bg-primary/5': member.isSpeaking }"
          >
            <div class="flex items-center justify-between text-xs">
              <div class="flex items-center gap-1.5 truncate">
                <span
                  class="size-2 rounded-full shrink-0 transition-colors"
                  :class="member.isSpeaking ? 'bg-emerald-500 animate-pulse' : 'bg-muted-foreground/40'"
                />
                <span class="font-medium truncate">{{ member.name }}</span>
                <span
                  v-if="inRoom && member.userId === account.id"
                  class="text-[10px] text-muted-foreground shrink-0"
                  >(我)</span
                >
              </div>

              <div class="flex items-center gap-1 shrink-0">
                <Badge
                  v-if="member.muted"
                  variant="outline"
                  class="text-[10px] px-1 py-0 h-4 border-amber-500/40 text-amber-500"
                >
                  静音
                </Badge>
                <Badge
                  v-else-if="member.away"
                  variant="outline"
                  class="text-[10px] px-1 py-0 h-4 border-muted text-muted-foreground"
                >
                  暂离
                </Badge>
                <Badge
                  v-else-if="member.isSpeaking"
                  variant="outline"
                  class="text-[10px] px-1 py-0 h-4 border-emerald-500/40 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10"
                >
                  说话中
                </Badge>
                <span class="text-[11px] font-mono text-muted-foreground">{{ Math.round(member.volume) }}%</span>
              </div>
            </div>

            <Progress
              :model-value="Math.min(100, Math.max(0, Math.round(member.volume)))"
              class="h-1.5"
            />

            <div
              v-if="isMockCollab"
              class="flex items-center justify-between pt-1 text-[11px] text-muted-foreground"
            >
              <button
                type="button"
                class="hover:text-foreground underline underline-offset-2"
                @click="setMemberSpeaking(member.userId, !member.isSpeaking)"
              >
                {{ member.isSpeaking ? '停止说话' : '模拟发言' }}
              </button>
              <button
                v-if="displayMembers.length > 2"
                type="button"
                class="hover:text-destructive text-[10px]"
                @click="removeMockMember(member.userId)"
              >
                移除
              </button>
            </div>
          </div>
        </div>
      </div>
    </CardContent>
  </Card>
</template>
