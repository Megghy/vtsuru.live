<script setup lang="ts">
import { Mic, MicOff, Plus, Trash2, Volume2, VolumeX } from 'lucide-vue-next'
import { computed, onUnmounted, reactive, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { toast } from 'vue-sonner'

import { useAccount } from '@/api/account'
import { OBS_ACCENT_PRESETS, OBS_WIDGET_THEME_OPTIONS } from '@/apps/obs-store/components/shared/theme'
import type { ObsWidgetTheme } from '@/apps/obs-store/components/shared/theme'
import ObsWidgetWorkbench from '@/apps/obs-store/components/store/ObsWidgetWorkbench.vue'
import { resolveObsSyncChannel, useObsBridge } from '@/apps/obs-store/sync'
import GoogleFontPicker from '@/shared/components/GoogleFontPicker.vue'
import { SYSTEM_CHINESE_FONT_OPTIONS } from '@/shared/questionDisplayPresets'
import { Button } from '@/shared/ui/button'
import { ColorPicker } from '@/shared/ui/color-picker'
import { FormField } from '@/shared/ui/form-field'
import { Input } from '@/shared/ui/input'
import { NumberField } from '@/shared/ui/number-field'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Separator } from '@/shared/ui/separator'
import { SettingRow } from '@/shared/ui/setting-row'
import { Slider } from '@/shared/ui/slider'
import { Switch } from '@/shared/ui/switch'
import { ToggleGroup, ToggleGroupItem } from '@/shared/ui/toggle-group'

import { DEFAULT_VOICE_AVATARS_STATE, getMemberMonogram, MAX_VOICE_MEMBERS } from './types'
import type {
  VoiceAvatarMember,
  VoiceAvatarShape,
  VoiceAvatarsAction,
  VoiceAvatarsLayout,
  VoiceAvatarsState,
} from './types'
import VoiceAvatarsDisplay from './VoiceAvatarsDisplay.vue'

const props = defineProps<{ channelId?: string }>()
const route = useRoute()
const account = useAccount()

const channelId = ref(resolveObsSyncChannel(props.channelId ?? route.query.channel))

watch(
  () => props.channelId ?? route.query.channel,
  (val) => {
    if (!val) return
    channelId.value = resolveObsSyncChannel(val)
  },
)

const { state, updateState, sendAction, currentHash, isSyncing, lastSyncError, hasPendingChanges, retry } =
  useObsBridge<VoiceAvatarsState, VoiceAvatarsAction>({
    componentId: 'voice-avatars',
    channelId,
    defaultState: DEFAULT_VOICE_AVATARS_STATE,
    role: 'controller',
  })

const selectedMemberId = ref<string>(state.value.members[0]?.id ?? '')
const simulatedSpeaking = reactive<Record<string, boolean>>({})

const selectedMember = computed(
  () => state.value.members.find((m) => m.id === selectedMemberId.value) ?? state.value.members[0] ?? null,
)

watch(
  () => state.value.members,
  (list) => {
    if (!list.length) {
      selectedMemberId.value = ''
      return
    }
    if (!list.some((m) => m.id === selectedMemberId.value)) {
      selectedMemberId.value = list[0].id
    }
  },
  { deep: true },
)

const hasAnySimulated = computed(() => Object.values(simulatedSpeaking).some(Boolean))

// 本机麦克风 Web Audio API VAD 状态
const micActive = ref(false)
const micLevel = ref(0)
const micSpeaking = ref(false)

let mediaStream: MediaStream | null = null
let audioContext: AudioContext | null = null
let sourceNode: MediaStreamAudioSourceNode | null = null
let analyserNode: AnalyserNode | null = null
let vadRafId: number | undefined
let timeDomainBuffer: Uint8Array<ArrayBuffer> | null = null
let holdUntilMs = 0
let lastSentLevelAt = 0

function broadcastMicBoundMembers(speaking: boolean, level: number) {
  for (const member of state.value.members) {
    if (!member.bindMic) continue
    if (simulatedSpeaking[member.id]) continue
    sendAction({ type: 'SPEAKING_STATE', memberId: member.id, speaking, level })
  }
}

function stopMic(silent = false) {
  if (vadRafId !== undefined) {
    cancelAnimationFrame(vadRafId)
    vadRafId = undefined
  }
  if (sourceNode) {
    try {
      sourceNode.disconnect()
    } catch {
      // ignore disconnect error
    }
    sourceNode = null
  }
  if (analyserNode) {
    try {
      analyserNode.disconnect()
    } catch {
      // ignore disconnect error
    }
    analyserNode = null
  }
  if (mediaStream) {
    for (const track of mediaStream.getTracks()) {
      track.stop()
    }
    mediaStream = null
  }
  if (audioContext) {
    void audioContext.close().catch(() => {})
    audioContext = null
  }
  timeDomainBuffer = null
  holdUntilMs = 0
  micLevel.value = 0
  if (micSpeaking.value) {
    micSpeaking.value = false
    broadcastMicBoundMembers(false, 0)
  }
  const wasActive = micActive.value
  micActive.value = false
  if (wasActive && !silent) {
    toast.info('已停止本机麦克风 VAD 检测')
  }
}

function sampleVadLoop(now: number) {
  if (!analyserNode || !timeDomainBuffer) return

  analyserNode.getByteTimeDomainData(timeDomainBuffer)
  let sumSq = 0
  for (let i = 0; i < timeDomainBuffer.length; i++) {
    const normalized = (timeDomainBuffer[i] - 128) / 128
    sumSq += normalized * normalized
  }
  const rms = Math.sqrt(sumSq / timeDomainBuffer.length)
  // 将 RMS 映射到 0-100 直观音量范围
  const level = Math.min(100, Math.round(rms * 240))
  micLevel.value = level

  const threshold = Math.max(1, Number(state.value.vadThreshold) || 12)
  if (level >= threshold) {
    holdUntilMs = now + 220
  }
  const nextSpeaking = level >= threshold || now < holdUntilMs

  if (nextSpeaking !== micSpeaking.value) {
    micSpeaking.value = nextSpeaking
    lastSentLevelAt = now
    broadcastMicBoundMembers(nextSpeaking, nextSpeaking ? level : 0)
  } else if (nextSpeaking && now - lastSentLevelAt > 110) {
    lastSentLevelAt = now
    broadcastMicBoundMembers(true, level)
  }

  vadRafId = requestAnimationFrame(sampleVadLoop)
}

async function toggleMic() {
  if (micActive.value) {
    stopMic()
    return
  }

  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    toast.error('当前浏览器环境不支持麦克风采集')
    return
  }

  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    })
    audioContext = new AudioContext()
    if (audioContext.state === 'suspended') {
      await audioContext.resume()
    }
    sourceNode = audioContext.createMediaStreamSource(mediaStream)
    analyserNode = audioContext.createAnalyser()
    analyserNode.fftSize = 512
    analyserNode.smoothingTimeConstant = 0.65
    sourceNode.connect(analyserNode)
    timeDomainBuffer = new Uint8Array(new ArrayBuffer(analyserNode.fftSize))
    micActive.value = true
    vadRafId = requestAnimationFrame(sampleVadLoop)
    toast.success('已开启本机麦克风 VAD 检测')
  } catch (error) {
    stopMic(true)
    const msg = error instanceof Error ? error.message : '无法访问麦克风'
    toast.error(`麦克风开启失败：${msg}`)
  }
}

onUnmounted(() => {
  stopMic(true)
})

function toggleSimulateSpeaking(memberId: string) {
  const next = !simulatedSpeaking[memberId]
  simulatedSpeaking[memberId] = next
  sendAction({
    type: 'SPEAKING_STATE',
    memberId,
    speaking: next,
    level: next ? 68 : 0,
  })
}

function clearAllSimulated() {
  for (const key of Object.keys(simulatedSpeaking)) {
    simulatedSpeaking[key] = false
  }
  sendAction({ type: 'RESET_ALL_SPEAKING' })
}

function addMember() {
  if (state.value.members.length >= MAX_VOICE_MEMBERS) {
    toast.warning(`最多支持 ${MAX_VOICE_MEMBERS} 位连麦成员`)
    return
  }
  const index = state.value.members.length + 1
  const newMember: VoiceAvatarMember = {
    id: `member-${Date.now().toString(36)}`,
    name: `嘉宾 ${index}`,
    avatarUrl: '',
    accentColor: OBS_ACCENT_PRESETS[(index - 1) % OBS_ACCENT_PRESETS.length],
    bindMic: false,
  }
  updateState({ members: [...state.value.members, newMember] })
  selectedMemberId.value = newMember.id
}

function removeMember(memberId: string) {
  if (state.value.members.length <= 1) {
    toast.warning('至少保留 1 位连麦成员')
    return
  }
  delete simulatedSpeaking[memberId]
  sendAction({ type: 'SPEAKING_STATE', memberId, speaking: false, level: 0 })
  const next = state.value.members.filter((m) => m.id !== memberId)
  updateState({ members: next })
}

function updateMember(memberId: string, patch: Partial<VoiceAvatarMember>) {
  const next = state.value.members.map((m) => (m.id === memberId ? { ...m, ...patch } : m))
  if (patch.bindMic === false && micSpeaking.value && !simulatedSpeaking[memberId]) {
    sendAction({ type: 'SPEAKING_STATE', memberId, speaking: false, level: 0 })
  }
  updateState({ members: next })
}

const vadSliderValue = computed({
  get: () => [state.value.vadThreshold],
  set: (vals: number[]) => {
    const next = Math.max(1, Math.min(60, Math.round(vals[0] ?? 12)))
    updateState({ vadThreshold: next })
  },
})
</script>

<template>
  <ObsWidgetWorkbench
    component-id="voice-avatars"
    title="极简连麦语音头像"
    obs-path="/obs-store/voice-avatars"
    recommended-size="560×180 px"
    :channel-id="channelId"
    :is-syncing="isSyncing"
    :last-sync-error="lastSyncError"
    :has-pending-changes="hasPendingChanges"
    :current-hash="currentHash"
    :stage-min-height="200"
    @update:channel-id="channelId = $event"
    @retry="retry"
  >
    <template #controls>
      <!-- 本机麦克风 VAD 控制 -->
      <div class="rounded-lg border border-border bg-card p-3 space-y-2.5">
        <div class="flex-between gap-2">
          <div class="min-w-0">
            <div class="text-xs font-semibold text-foreground">本机麦克风 VAD 检测</div>
            <div class="text-[11px] text-muted-foreground">自动驱动已绑定麦克风的成员亮灯</div>
          </div>
          <Button
            :variant="micActive ? 'destructive' : 'default'"
            class="gap-1.5 shrink-0"
            @click="toggleMic"
          >
            <MicOff
              v-if="micActive"
              class="size-3.5"
            />
            <Mic
              v-else
              class="size-3.5"
            />
            {{ micActive ? '停止采集' : '开启麦克风' }}
          </Button>
        </div>

        <!-- 实时音量条 + 阈值参考线 -->
        <div class="space-y-1">
          <div class="flex-between text-[11px] text-muted-foreground tabular-nums">
            <span>实时音量：{{ micLevel }}%</span>
            <span :class="micSpeaking ? 'text-emerald-500 font-medium' : ''">
              {{ micActive ? (micSpeaking ? '说话中' : '静音') : '未开启' }}
            </span>
          </div>
          <div class="relative h-2 w-full rounded-full bg-muted overflow-hidden">
            <div
              class="h-full w-full rounded-full origin-left transition-transform duration-150"
              :class="micSpeaking ? 'bg-emerald-500' : 'bg-primary/60'"
              :style="{ transform: `scaleX(${micLevel / 100})` }"
            />
            <div
              class="absolute top-0 bottom-0 w-0.5 bg-amber-500 pointer-events-none"
              :style="{ left: `${Math.min(100, state.vadThreshold)}%` }"
              title="VAD 触发阈值"
            />
          </div>
        </div>

        <FormField
          label="触发灵敏度阈值"
          :extra="`${state.vadThreshold}%`"
        >
          <Slider
            v-model="vadSliderValue"
            :min="1"
            :max="60"
            :step="1"
          />
        </FormField>
      </div>

      <!-- 成员槽位与模拟说话 -->
      <div class="space-y-2">
        <div class="flex-between gap-2">
          <span class="text-xs font-semibold text-foreground">
            连麦成员 ({{ state.members.length }}/{{ MAX_VOICE_MEMBERS }})
          </span>
          <div class="flex items-center gap-1.5">
            <Button
              v-if="hasAnySimulated"
              variant="ghost"
              size="xs"
              class="gap-1"
              @click="clearAllSimulated"
            >
              <VolumeX class="size-3.5" />
              全静
            </Button>
            <Button
              variant="outline"
              size="xs"
              class="gap-1"
              :disabled="state.members.length >= MAX_VOICE_MEMBERS"
              @click="addMember"
            >
              <Plus class="size-3.5" />
              添加成员
            </Button>
          </div>
        </div>

        <div class="text-[11px] text-muted-foreground">
          点击头像即可切换「模拟说话」测试 OBS 亮灯效果，点击右侧区域编辑成员资料
        </div>

        <div class="space-y-1.5 max-h-[210px] overflow-y-auto scrollbar-thin pr-0.5">
          <div
            v-for="member in state.members"
            :key="member.id"
            class="flex items-center gap-2 p-1.5 rounded-md border transition-colors cursor-pointer"
            :class="
              selectedMember?.id === member.id
                ? 'border-primary/60 bg-accent/30'
                : 'border-border/70 bg-card hover:bg-accent/15'
            "
            @click="selectedMemberId = member.id"
          >
            <!-- 点击头像即时切换模拟说话 -->
            <button
              type="button"
              class="relative size-8 rounded-full shrink-0 flex-center text-xs font-bold text-white border-2 transition-transform cursor-pointer"
              :class="simulatedSpeaking[member.id] ? 'scale-105' : 'opacity-85 hover:opacity-100'"
              :style="{
                backgroundColor: member.accentColor,
                borderColor: simulatedSpeaking[member.id] ? '#10b981' : 'transparent',
              }"
              title="点击切换模拟说话"
              @click.stop="toggleSimulateSpeaking(member.id)"
            >
              <img
                v-if="member.avatarUrl"
                :src="member.avatarUrl"
                :alt="member.name"
                class="size-full rounded-full object-cover"
              />
              <span v-else>{{ getMemberMonogram(member.name) }}</span>
            </button>

            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-1.5">
                <span class="text-xs font-medium text-foreground truncate">{{ member.name }}</span>
                <Mic
                  v-if="member.bindMic"
                  class="size-3 text-emerald-500 shrink-0"
                  title="已绑定本机麦克风"
                />
              </div>
              <div class="text-[11px] text-muted-foreground">
                {{ simulatedSpeaking[member.id] ? '模拟说话中' : member.bindMic ? '本机麦驱动' : '点击头像测试' }}
              </div>
            </div>

            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              :title="simulatedSpeaking[member.id] ? '停止模拟说话' : '模拟说话'"
              @click.stop="toggleSimulateSpeaking(member.id)"
            >
              <Volume2
                class="size-3.5"
                :class="simulatedSpeaking[member.id] ? 'text-emerald-500' : 'text-muted-foreground'"
              />
            </Button>

            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              class="text-muted-foreground hover:text-destructive"
              title="删除成员"
              :disabled="state.members.length <= 1"
              @click.stop="removeMember(member.id)"
            >
              <Trash2 class="size-3.5" />
            </Button>
          </div>
        </div>
      </div>

      <!-- 当前选中成员编辑区 -->
      <template v-if="selectedMember">
        <Separator />
        <div class="space-y-2.5">
          <div class="text-xs font-semibold text-foreground">编辑成员：{{ selectedMember.name }}</div>
          <div class="grid grid-cols-2 gap-2">
            <FormField
              label="成员昵称"
              class="min-w-0"
            >
              <Input
                :model-value="selectedMember.name"
                placeholder="输入昵称"
                @update:model-value="(val) => updateMember(selectedMember!.id, { name: String(val ?? '') })"
              />
            </FormField>

            <FormField
              label="高亮强调色"
              class="min-w-0"
            >
              <ColorPicker
                :model-value="selectedMember.accentColor"
                :show-alpha="false"
                :swatches="OBS_ACCENT_PRESETS"
                @update:model-value="(val) => updateMember(selectedMember!.id, { accentColor: val })"
              />
            </FormField>

            <FormField
              label="头像图片 URL"
              class="min-w-0 col-span-2"
            >
              <Input
                :model-value="selectedMember.avatarUrl"
                placeholder="留空则自动显示昵称首字徽标"
                @update:model-value="(val) => updateMember(selectedMember!.id, { avatarUrl: String(val ?? '') })"
              />
            </FormField>
          </div>

          <SettingRow
            title="绑定本机麦克风 VAD"
            description="开启后由本机麦克风音量自动驱动此成员说话亮灯"
            variant="compact"
          >
            <Switch
              :checked="selectedMember.bindMic"
              @update:checked="(val) => updateMember(selectedMember!.id, { bindMic: Boolean(val) })"
            />
          </SettingRow>
        </div>
      </template>
    </template>

    <template #preview>
      <VoiceAvatarsDisplay
        :channel-id="channelId"
        :user-id="account.id"
        inline-mode
      />
    </template>

    <template #settings>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
        <FormField
          label="排列布局"
          class="min-w-0"
        >
          <ToggleGroup
            type="single"
            class="w-full grid grid-cols-3"
            :model-value="state.layout"
            @update:model-value="(val) => val && updateState({ layout: val as VoiceAvatarsLayout })"
          >
            <ToggleGroupItem value="row">横排</ToggleGroupItem>
            <ToggleGroupItem value="column">竖排</ToggleGroupItem>
            <ToggleGroupItem value="grid">网格</ToggleGroupItem>
          </ToggleGroup>
        </FormField>

        <FormField
          label="头像形状"
          class="min-w-0"
        >
          <ToggleGroup
            type="single"
            class="w-full grid grid-cols-2"
            :model-value="state.shape"
            @update:model-value="(val) => val && updateState({ shape: val as VoiceAvatarShape })"
          >
            <ToggleGroupItem value="circle">圆形头像</ToggleGroupItem>
            <ToggleGroupItem value="rounded">圆角方形</ToggleGroupItem>
          </ToggleGroup>
        </FormField>

        <FormField
          label="视觉主题"
          class="min-w-0"
        >
          <Select
            :model-value="state.theme"
            @update:model-value="(val) => updateState({ theme: val as ObsWidgetTheme })"
          >
            <SelectTrigger class="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem
                v-for="opt in OBS_WIDGET_THEME_OPTIONS"
                :key="opt.value"
                :value="opt.value"
              >
                {{ opt.label }}
              </SelectItem>
            </SelectContent>
          </Select>
        </FormField>

        <FormField
          label="昵称字体"
          class="min-w-0"
        >
          <GoogleFontPicker
            :model-value="state.fontFamily || null"
            :extra-options="SYSTEM_CHINESE_FONT_OPTIONS"
            @update:model-value="(val) => updateState({ fontFamily: val || '' })"
          />
        </FormField>

        <FormField
          label="头像尺寸 (px)"
          class="min-w-0"
        >
          <NumberField
            :model-value="state.avatarSize"
            :min="44"
            :max="140"
            :step="2"
            @update:model-value="(val) => updateState({ avatarSize: Math.max(44, Math.min(140, Number(val) || 78)) })"
          />
        </FormField>

        <FormField
          label="成员间距 (px)"
          class="min-w-0"
        >
          <NumberField
            :model-value="state.gap"
            :min="6"
            :max="48"
            :step="2"
            @update:model-value="(val) => updateState({ gap: Math.max(6, Math.min(48, Number(val) || 20)) })"
          />
        </FormField>

        <SettingRow
          title="显示成员昵称"
          description="说话时昵称底色同步以成员强调色点亮"
          type="switch"
          variant="compact"
          :model-value="state.showName"
          @update:model-value="(val) => updateState({ showName: Boolean(val) })"
        />

        <SettingRow
          title="隐藏静音成员"
          description="仅在 OBS 画面中显示当前正在说话的连麦成员"
          type="switch"
          variant="compact"
          :model-value="state.hideMuted"
          @update:model-value="(val) => updateState({ hideMuted: Boolean(val) })"
        />
      </div>
    </template>
  </ObsWidgetWorkbench>
</template>
