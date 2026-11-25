<script setup lang="ts">
import {
  Clapperboard,
  Film,
  MessageSquare,
  Pencil,
  Plus,
  Scissors,
  Shield,
  Smile,
  Sparkles,
  Trash2,
  Video,
  Volume2,
  X,
} from 'lucide-vue-next'
import { computed, onMounted, ref } from 'vue'
import { toast } from 'vue-sonner'

import { useAccount } from '@/api/account'
import { setRoomSilentMode } from '@/apps/client/api/room-control'
import { roomInfo } from '@/apps/client/data/info'
import { playNotificationTone } from '@/apps/client/data/notificationSound'
import { useBiliFunction } from '@/apps/client/store/useBiliFunction'
import { useOBSStore } from '@/apps/client/store/useOBSStore'
import { usePngtuberDriver } from '@/apps/client/store/usePngtuberDriver'
import { useStreamClipRecorder } from '@/apps/client/store/useStreamClipRecorder'
import { useVtsStore } from '@/apps/client/store/useVtsStore'
import { usePersistedStorage } from '@/shared/storage/persist'
import { Button } from '@/shared/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { FormField } from '@/shared/ui/form-field'
import { Input } from '@/shared/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { SimpleTooltip } from '@/shared/ui/tooltip'

type DeckActionType =
  | 'stream_clip'
  | 'obs_replay'
  | 'obs_scene'
  | 'obs_source_toggle'
  | 'vts_hotkey'
  | 'vts_expression'
  | 'vts_clear_expr'
  | 'pngtuber_expr'
  | 'room_silent'
  | 'danmaku'
  | 'sound_tone'

export interface StreamDeckSlot {
  id: string
  label: string
  type: DeckActionType
  /** 主目标：场景名 / 热键 ID / 表情文件名 / 弹幕文本 / 门槛模式 / 音效名 */
  target?: string
  /** 副目标：如 OBS 源名称 */
  secondary?: string
  /** 颜色点缀 */
  tone?: 'default' | 'primary' | 'amber' | 'emerald' | 'rose'
}

const ACTION_TYPE_LABELS: Record<DeckActionType, string> = {
  stream_clip: '保存本地高光切片',
  obs_replay: '保存 OBS 回放缓存',
  obs_scene: '切换 OBS 场景',
  obs_source_toggle: '切换 OBS 源显隐',
  vts_hotkey: '触发 VTS 热键',
  vts_expression: '切换 VTS 表情',
  vts_clear_expr: '清除 VTS 表情',
  pngtuber_expr: '切换 PNGtuber 表情',
  room_silent: '切换发言门槛/慢速',
  danmaku: '发送快捷弹幕',
  sound_tone: '播放提示音效',
}

const DEFAULT_SLOTS: StreamDeckSlot[] = [
  { id: 'slot-clip', label: '存本地切片', type: 'stream_clip', target: '快捷切片', tone: 'primary' },
  { id: 'slot-replay', label: '存 OBS 回放', type: 'obs_replay', tone: 'emerald' },
  { id: 'slot-vts-clear', label: '重置 VTS 表情', type: 'vts_clear_expr', tone: 'default' },
  { id: 'slot-silent-medal', label: '仅粉丝牌发言', type: 'room_silent', target: 'medal', tone: 'amber' },
  { id: 'slot-silent-off', label: '解除全员门槛', type: 'room_silent', target: 'off', tone: 'default' },
  { id: 'slot-tone', label: '叮咚提示音', type: 'sound_tone', target: 'chime', tone: 'default' },
]

const slots = usePersistedStorage<StreamDeckSlot[]>(
  'vtsuru:settings:live-dashboard:stream-deck-slots',
  structuredClone(DEFAULT_SLOTS),
)

const account = useAccount()
const obs = useOBSStore()
const vts = useVtsStore()
const pngtuber = usePngtuberDriver()
const clipRecorder = useStreamClipRecorder()
const biliFunc = useBiliFunction()

const runningId = ref<string | null>(null)
const editMode = ref(false)
const dialogOpen = ref(false)
const editingIndex = ref<number | null>(null)
const sourceToggleState = ref<Record<string, boolean>>({})

const draft = ref<StreamDeckSlot>({
  id: '',
  label: '',
  type: 'danmaku',
  target: '',
  secondary: '',
  tone: 'default',
})

const roomId = computed(() => roomInfo.value?.room_id || account.value.biliRoomId || 0)

onMounted(() => {
  void obs.init()
})

function iconOf(type: DeckActionType) {
  switch (type) {
    case 'stream_clip':
      return Scissors
    case 'obs_replay':
      return Film
    case 'obs_scene':
    case 'obs_source_toggle':
      return Video
    case 'vts_hotkey':
    case 'vts_expression':
    case 'vts_clear_expr':
      return Sparkles
    case 'pngtuber_expr':
      return Smile
    case 'room_silent':
      return Shield
    case 'danmaku':
      return MessageSquare
    case 'sound_tone':
      return Volume2
  }
}

function toneClass(tone?: StreamDeckSlot['tone']) {
  if (tone === 'primary') return 'border-primary/40 text-primary hover:bg-primary/10'
  if (tone === 'emerald') return 'border-emerald-500/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10'
  if (tone === 'amber') return 'border-amber-500/40 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10'
  if (tone === 'rose') return 'border-rose-500/40 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10'
  return ''
}

async function runSlot(slot: StreamDeckSlot) {
  if (editMode.value) {
    openEdit(slots.value.findIndex((s) => s.id === slot.id))
    return
  }
  if (runningId.value) return
  runningId.value = slot.id
  try {
    switch (slot.type) {
      case 'stream_clip': {
        if (!clipRecorder.isBuffering) {
          toast.warning('本地切片缓冲未启动，请先在「直播管理 → 高光切片」开启')
          return
        }
        await clipRecorder.saveClip(slot.target || slot.label)
        toast.success(`已保存本地切片：${slot.target || slot.label}`)
        return
      }
      case 'obs_replay': {
        const res = await obs.saveReplayBuffer()
        if (res.ok) toast.success('已保存 OBS 回放缓存')
        else toast.warning(res.message || '保存 OBS 回放失败')
        return
      }
      case 'obs_scene': {
        if (!slot.target) return toast.warning('未配置目标 OBS 场景')
        await obs.switchToScene(slot.target)
        return
      }
      case 'obs_source_toggle': {
        const scene = slot.target?.trim() || obs.currentObsScene || undefined
        const source = slot.secondary?.trim()
        if (!source) return toast.warning('请配置目标 OBS 源名称')
        const nextVisible = !(sourceToggleState.value[slot.id] ?? true)
        await obs.setSceneItemEnabledByName(source, nextVisible, scene)
        sourceToggleState.value[slot.id] = nextVisible
        toast.success(`${source}：${nextVisible ? '已显示' : '已隐藏'}`)
        return
      }
      case 'vts_hotkey': {
        if (!vts.connected) return toast.warning('VTube Studio 未连接')
        if (!slot.target) return toast.warning('未配置 VTS 热键 ID')
        await vts.triggerHotkey(slot.target)
        toast.success(`已触发 VTS 热键：${slot.label}`)
        return
      }
      case 'vts_expression': {
        if (!vts.connected) return toast.warning('VTube Studio 未连接')
        if (!slot.target) return toast.warning('未配置 VTS 表情文件')
        await vts.toggleExpression(slot.target)
        return
      }
      case 'vts_clear_expr': {
        if (!vts.connected) return toast.warning('VTube Studio 未连接')
        await vts.clearExpressions()
        toast.success('已清除全部 VTS 表情')
        return
      }
      case 'pngtuber_expr': {
        if (!slot.target) return toast.warning('未配置 PNGtuber 表情 ID')
        await pngtuber.switchExpression(slot.target)
        toast.success(`已切换 PNGtuber 表情：${slot.label}`)
        return
      }
      case 'room_silent': {
        if (!roomId.value) return toast.warning('未获取到当前直播间房间号')
        const mode = (slot.target || 'off') as 'off' | 'member' | 'level' | 'medal'
        await setRoomSilentMode(roomId.value, mode, mode === 'medal' || mode === 'level' ? 1 : 0, 0)
        toast.success(`已切换发言门槛：${slot.label}`)
        return
      }
      case 'danmaku': {
        if (!roomId.value) return toast.warning('未获取到当前直播间房间号')
        const msg = (slot.target || '').trim().slice(0, 40)
        if (!msg) return toast.warning('未配置弹幕内容')
        await biliFunc.sendLiveDanmaku(roomId.value, msg)
        return
      }
      case 'sound_tone': {
        const preset = (slot.target || 'chime') as 'chime' | 'alert' | 'soft'
        await playNotificationTone(preset)
        return
      }
    }
  } catch (err) {
    toast.error(err instanceof Error ? err.message : '执行快捷动作失败')
  } finally {
    runningId.value = null
  }
}

function openCreate() {
  if (slots.value.length >= 12) {
    toast.warning('演播快捷板最多支持 12 个槽位')
    return
  }
  editingIndex.value = null
  draft.value = {
    id: `slot-${Date.now()}`,
    label: '',
    type: 'danmaku',
    target: '',
    secondary: '',
    tone: 'default',
  }
  dialogOpen.value = true
}

function openEdit(index: number) {
  const item = slots.value[index]
  if (!item) return
  editingIndex.value = index
  draft.value = { ...item }
  dialogOpen.value = true
}

function saveSlot() {
  const label = draft.value.label.trim() || ACTION_TYPE_LABELS[draft.value.type]
  const next: StreamDeckSlot = { ...draft.value, label }
  if (editingIndex.value === null) {
    slots.value = [...slots.value, next]
  } else {
    const copy = [...slots.value]
    copy[editingIndex.value] = next
    slots.value = copy
  }
  dialogOpen.value = false
}

function removeSlot(index: number) {
  slots.value = slots.value.filter((_, idx) => idx !== index)
}
</script>

<template>
  <div class="flex items-center gap-1.5 px-2.5 py-1 border-b border-border bg-muted/30 shrink-0 overflow-x-auto scrollbar-thin">
    <div class="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground shrink-0 mr-0.5">
      <Clapperboard class="size-3.5 text-primary" />
      <span class="hidden sm:inline">演播快捷板</span>
    </div>

    <div class="flex items-center gap-1 flex-1 min-w-0">
      <div
        v-for="(slot, idx) in slots"
        :key="slot.id"
        class="relative inline-flex items-center shrink-0"
      >
        <SimpleTooltip
          :content="editMode ? '点击编辑槽位' : `${ACTION_TYPE_LABELS[slot.type]}${slot.target ? `：${slot.target}` : ''}`"
        >
          <Button
            size="xs"
            variant="outline"
            class="gap-1.5 px-2 bg-card"
            :class="[toneClass(slot.tone), editMode ? 'pr-6 border-dashed' : '']"
            :disabled="runningId === slot.id"
            @click="runSlot(slot)"
          >
            <component
              :is="iconOf(slot.type)"
              class="size-3 shrink-0"
            />
            <span class="max-w-28 truncate">{{ slot.label }}</span>
          </Button>
        </SimpleTooltip>
        <SimpleTooltip
          v-if="editMode"
          content="删除槽位"
        >
          <button
            type="button"
            class="absolute right-1 top-1/2 -translate-y-1/2 size-4 rounded-sm flex-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 cursor-pointer border-0 bg-transparent"
            aria-label="删除槽位"
            @click.stop="removeSlot(idx)"
          >
            <X class="size-3" />
          </button>
        </SimpleTooltip>
      </div>
    </div>

    <div class="flex items-center gap-1 shrink-0">
      <SimpleTooltip content="新增快捷槽位">
        <Button
          size="icon-xs"
          variant="ghost"
          aria-label="新增快捷槽位"
          :disabled="slots.length >= 12"
          @click="openCreate"
        >
          <Plus class="size-3.5" />
        </Button>
      </SimpleTooltip>
      <SimpleTooltip content="编辑或删除快捷槽位">
        <Button
          size="xs"
          :variant="editMode ? 'secondary' : 'ghost'"
          class="gap-1 px-1.5 text-muted-foreground"
          :class="{ 'text-primary': editMode }"
          aria-label="编辑或删除快捷槽位"
          @click="editMode = !editMode"
        >
          <Pencil class="size-3" />
          <span class="hidden md:inline">{{ editMode ? '完成' : '编辑' }}</span>
        </Button>
      </SimpleTooltip>
    </div>

    <Dialog v-model:open="dialogOpen">
      <DialogContent class="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle class="text-sm">
            {{ editingIndex === null ? '新增演播快捷槽位' : '编辑演播快捷槽位' }}
          </DialogTitle>
        </DialogHeader>

        <div class="space-y-3 text-xs">
          <FormField label="按钮名称">
            <Input
              v-model="draft.label"
              placeholder="例如：切游戏场景 / 眨眼 / 仅粉丝牌"
            />
          </FormField>

          <FormField label="触发动作">
            <Select v-model="draft.type">
              <SelectTrigger class="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem
                  v-for="(label, key) in ACTION_TYPE_LABELS"
                  :key="key"
                  :value="key"
                >
                  {{ label }}
                </SelectItem>
              </SelectContent>
            </Select>
          </FormField>

          <FormField
            v-if="draft.type === 'obs_scene'"
            label="目标 OBS 场景"
          >
            <Select
              v-if="obs.obsScenes.length"
              v-model="draft.target"
            >
              <SelectTrigger class="w-full">
                <SelectValue placeholder="选择场景" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem
                  v-for="scene in obs.obsScenes"
                  :key="scene"
                  :value="scene"
                >
                  {{ scene }}
                </SelectItem>
              </SelectContent>
            </Select>
            <Input
              v-else
              v-model="draft.target"
              placeholder="输入 OBS 场景名"
            />
          </FormField>

          <template v-else-if="draft.type === 'obs_source_toggle'">
            <FormField label="所在 OBS 场景（留空使用当前场景）">
              <Input
                v-model="draft.target"
                placeholder="例如：直播主场景"
              />
            </FormField>
            <FormField label="源名称">
              <Input
                v-model="draft.secondary"
                placeholder="例如：摄像头 / 遮罩层"
              />
            </FormField>
          </template>

          <FormField
            v-else-if="draft.type === 'vts_hotkey'"
            label="VTS 热键"
          >
            <Select
              v-if="vts.hotkeys.length"
              v-model="draft.target"
            >
              <SelectTrigger class="w-full">
                <SelectValue placeholder="选择 VTS 热键" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem
                  v-for="hk in vts.hotkeys"
                  :key="hk.hotkeyID"
                  :value="hk.hotkeyID"
                >
                  {{ hk.name || hk.hotkeyID }}
                </SelectItem>
              </SelectContent>
            </Select>
            <Input
              v-else
              v-model="draft.target"
              placeholder="输入热键 ID（连接 VTS 后可直接选择）"
            />
          </FormField>

          <FormField
            v-else-if="draft.type === 'vts_expression'"
            label="VTS 表情文件"
          >
            <Select
              v-if="vts.expressions.length"
              v-model="draft.target"
            >
              <SelectTrigger class="w-full">
                <SelectValue placeholder="选择 VTS 表情" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem
                  v-for="exp in vts.expressions"
                  :key="exp.file"
                  :value="exp.file"
                >
                  {{ exp.name || exp.file }}
                </SelectItem>
              </SelectContent>
            </Select>
            <Input
              v-else
              v-model="draft.target"
              placeholder="例如：blush.exp3.json"
            />
          </FormField>

          <FormField
            v-else-if="draft.type === 'pngtuber_expr'"
            label="PNGtuber 表情"
          >
            <Select
              v-if="pngtuber.config.expressions.length"
              v-model="draft.target"
            >
              <SelectTrigger class="w-full">
                <SelectValue placeholder="选择 PNGtuber 表情" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem
                  v-for="exp in pngtuber.config.expressions"
                  :key="exp.id"
                  :value="exp.id"
                >
                  {{ exp.name || exp.id }}
                </SelectItem>
              </SelectContent>
            </Select>
            <Input
              v-else
              v-model="draft.target"
              placeholder="输入表情 ID"
            />
          </FormField>

          <FormField
            v-else-if="draft.type === 'room_silent'"
            label="发言门槛模式"
          >
            <Select v-model="draft.target">
              <SelectTrigger class="w-full">
                <SelectValue placeholder="选择模式" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="off">解除全员发言限制</SelectItem>
                <SelectItem value="medal">仅粉丝牌可发言</SelectItem>
                <SelectItem value="member">仅大航海/房管可发言</SelectItem>
                <SelectItem value="level">仅等级 ≥1 观众可发言</SelectItem>
              </SelectContent>
            </Select>
          </FormField>

          <FormField
            v-else-if="draft.type === 'danmaku'"
            label="弹幕内容（最多 40 字）"
          >
            <Input
              v-model="draft.target"
              :maxlength="40"
              placeholder="输入一键发送的弹幕"
            />
          </FormField>

          <FormField
            v-else-if="draft.type === 'stream_clip'"
            label="切片标签"
          >
            <Input
              v-model="draft.target"
              placeholder="例如：精彩操作"
            />
          </FormField>

          <FormField
            v-else-if="draft.type === 'sound_tone'"
            label="提示音效"
          >
            <Select v-model="draft.target">
              <SelectTrigger class="w-full">
                <SelectValue placeholder="选择提示音" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="chime">清脆叮咚（chime）</SelectItem>
                <SelectItem value="alert">醒目提醒（alert）</SelectItem>
                <SelectItem value="soft">柔和提示（soft）</SelectItem>
              </SelectContent>
            </Select>
          </FormField>

          <FormField label="按钮强调色">
            <Select v-model="draft.tone">
              <SelectTrigger class="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="default">默认中性</SelectItem>
                <SelectItem value="primary">主题色</SelectItem>
                <SelectItem value="emerald">绿色</SelectItem>
                <SelectItem value="amber">琥珀色</SelectItem>
                <SelectItem value="rose">玫红色</SelectItem>
              </SelectContent>
            </Select>
          </FormField>
        </div>

        <DialogFooter class="gap-1.5">
          <Button
            v-if="editingIndex !== null"
            variant="ghost"
            class="mr-auto text-destructive hover:text-destructive gap-1"
            @click="
              removeSlot(editingIndex);
              dialogOpen = false
            "
          >
            <Trash2 class="size-3.5" />
            删除
          </Button>
          <Button
            variant="outline"
            @click="dialogOpen = false"
          >
            取消
          </Button>
          <Button @click="saveSlot">
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
