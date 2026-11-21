<script setup lang="ts">
import { ExternalLink, Maximize2, Settings2 } from 'lucide-vue-next'
import { computed, ref, toRaw, watch } from 'vue'
import { toast } from 'vue-sonner'

import { SaveSetting, useAccount } from '@/api/account'
import { SYSTEM_CHINESE_FONT_OPTIONS } from '@/shared/questionDisplayPresets'
import GoogleFontPicker from '@/shared/components/GoogleFontPicker.vue'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { FormField } from '@/shared/ui/form-field'
import { Input } from '@/shared/ui/input'
import { NumberField } from '@/shared/ui/number-field'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Separator } from '@/shared/ui/separator'
import { SettingRow } from '@/shared/ui/setting-row'
import { Slider } from '@/shared/ui/slider'
import { Switch } from '@/shared/ui/switch'
import { ToggleGroup, ToggleGroupItem } from '@/shared/ui/toggle-group'

import { useObsSceneEditorStore } from '../store/useObsSceneEditorStore'
import type { ObsModuleLayer } from '../types'
import { getObsModuleById } from '../types'

const props = defineProps<{
  layer: ObsModuleLayer
}>()

const emit = defineEmits<{
  openQuestionDisplayConfig: [layerId: string]
  openDanmujiConfig: [layerId: string]
}>()

const account = useAccount()
const store = useObsSceneEditorStore()

const moduleId = computed(() => props.layer.module.moduleId)
const obsModuleMeta = computed(() => getObsModuleById(moduleId.value) ?? null)

const isScrollListModule = computed(() => {
  const id = moduleId.value
  return id === 'music-request' || id === 'live-request' || id === 'live-request-today' || id === 'queue'
})

const danmujiOpacitySlider = computed<number[]>({
  get: () => [Math.round((props.layer.module.danmujiOpacity ?? 1) * 100)],
  set: (v) => {
    props.layer.module.danmujiOpacity = Math.min(1, Math.max(0.1, (v[0] ?? 100) / 100))
  },
})

// ── 后端展示设置（侧边栏即时编辑保存） ─────────────────────────────────────
const savingBackend = ref(false)

// 1. 弹幕点歌标题
const musicObsTitle = ref('')
watch(
  [moduleId, () => account.value?.settings?.musicRequest?.obsTitle],
  ([id, title]) => {
    if (id === 'music-request') {
      musicObsTitle.value = title ?? ''
    }
  },
  { immediate: true },
)

async function saveMusicObsTitle() {
  const base = account.value?.settings?.musicRequest
  if (!base) return
  const trimmed = musicObsTitle.value.trim()
  if ((base.obsTitle ?? '') === trimmed) return
  savingBackend.value = true
  try {
    const payload = { ...structuredClone(toRaw(base)), obsTitle: trimmed }
    await SaveSetting('MusicRequest', payload)
    account.value.settings.musicRequest = payload
    toast.success('点歌面板标题已同步')
  } catch (err) {
    toast.error(err instanceof Error ? err.message : '保存点歌标题失败')
  } finally {
    savingBackend.value = false
  }
}

// 2. 互动点播 / 今日已处理点播（共用 SongRequest 设置）
const songRequestTitle = ref('')
watch(
  [
    moduleId,
    () => account.value?.settings?.songRequest?.obsTitle,
    () => account.value?.settings?.songRequest?.obsTitleToday,
  ],
  ([id, title, titleToday]) => {
    if (id === 'live-request') songRequestTitle.value = title ?? ''
    else if (id === 'live-request-today') songRequestTitle.value = titleToday ?? ''
  },
  { immediate: true },
)

async function patchSongRequestSetting(patch: Partial<NonNullable<typeof account.value.settings.songRequest>>) {
  const base = account.value?.settings?.songRequest
  if (!base) return
  savingBackend.value = true
  try {
    const payload = { ...structuredClone(toRaw(base)), ...patch }
    await SaveSetting('SongRequest', payload)
    account.value.settings.songRequest = payload
    toast.success('点播展示设置已同步')
  } catch (err) {
    toast.error(err instanceof Error ? err.message : '保存点播设置失败')
  } finally {
    savingBackend.value = false
  }
}

function saveSongRequestTitle() {
  const trimmed = songRequestTitle.value.trim()
  const base = account.value?.settings?.songRequest
  if (!base) return
  if (moduleId.value === 'live-request') {
    if ((base.obsTitle ?? '') === trimmed) return
    void patchSongRequestSetting({ obsTitle: trimmed })
  } else if (moduleId.value === 'live-request-today') {
    if ((base.obsTitleToday ?? '') === trimmed) return
    void patchSongRequestSetting({ obsTitleToday: trimmed })
  }
}

// 3. 排队列表展示开关
async function patchQueueSetting(patch: Partial<NonNullable<typeof account.value.settings.queue>>) {
  const base = account.value?.settings?.queue
  if (!base) return
  savingBackend.value = true
  try {
    const payload = { ...structuredClone(toRaw(base)), ...patch }
    await SaveSetting('Queue', payload)
    account.value.settings.queue = payload
    toast.success('排队展示设置已同步')
  } catch (err) {
    toast.error(err instanceof Error ? err.message : '保存排队设置失败')
  } finally {
    savingBackend.value = false
  }
}

// 4. 直播抽奖布局推荐尺寸
const LOTTERY_RECOMMENDED_SIZES: Record<string, { width: number; height: number; label: string }> = {
  card: { width: 260, height: 420, label: '260×420' },
  banner: { width: 680, height: 54, label: '680×54' },
  compact: { width: 220, height: 64, label: '220×64' },
  grid: { width: 380, height: 280, label: '380×280' },
}

const lotteryRecommended = computed(
  () => LOTTERY_RECOMMENDED_SIZES[props.layer.module.lotteryMode || 'card'] ?? LOTTERY_RECOMMENDED_SIZES.card,
)

function applyLotteryRecommendedSize() {
  const rec = lotteryRecommended.value
  store.updateLayer(props.layer.id, { width: rec.width, height: rec.height })
  toast.success(`已调整为推荐尺寸 ${rec.label}`)
}

// 5. 弹幕投票图层尺寸推荐（独立图层设置，不覆盖全局账号配置）
const voteRecommended = computed(() => {
  const isBanner =
    props.layer.module.style === 'duel' && props.layer.module.voteLayout === 'banner'
  return isBanner
    ? { width: 860, height: 180, label: '860×180' }
    : { width: 480, height: 380, label: '480×380' }
})

function applyVoteRecommendedSize() {
  const rec = voteRecommended.value
  props.layer.width = rec.width
  props.layer.height = rec.height
  store.pushHistory()
  toast.success(`已调整为推荐尺寸 ${rec.label}`)
}

function openManagePage() {
  if (!obsModuleMeta.value?.managePath) return
  window.open(obsModuleMeta.value.managePath, '_blank', 'noopener,noreferrer')
}
</script>

<template>
  <section class="space-y-3">
    <div class="flex-between gap-2">
      <span class="text-xs font-semibold text-foreground">站内直播组件</span>
      <Badge
        variant="outline"
        class="truncate max-w-[130px]"
      >
        {{ obsModuleMeta?.name ?? moduleId }}
      </Badge>
    </div>

    <p
      v-if="obsModuleMeta?.description"
      class="text-[11px] text-muted-foreground leading-relaxed"
    >
      {{ obsModuleMeta.description }}
    </p>

    <!-- 1. 弹幕机：常用快捷项 + 完整设置弹窗（含实时预览/规则/自定义CSS） -->
    <template v-if="moduleId === 'danmuji'">
      <Button
        class="w-full"
        variant="secondary"
        @click="emit('openDanmujiConfig', layer.id)"
      >
        <Settings2 class="w-3.5 h-3.5" />
        <span>打开弹幕机详细设置</span>
      </Button>

      <FormField label="快捷预设样式">
        <Select
          :model-value="layer.module.danmujiPreset || 'classic'"
          @update:model-value="
            (v) => {
              layer.module.danmujiPreset = String(v) as 'classic' | 'bubble' | 'minimal'
              store.pushHistory()
            }
          "
        >
          <SelectTrigger class="w-full"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="classic">经典样式 (Classic)</SelectItem>
            <SelectItem value="bubble">气泡卡片 (Bubble)</SelectItem>
            <SelectItem value="minimal">极简无头像 (Minimal)</SelectItem>
          </SelectContent>
        </Select>
      </FormField>

      <FormField label="弹幕字号 (px)">
        <NumberField
          :model-value="layer.module.danmujiFontSize ?? 18"
          :min="10"
          :max="72"
          @update:model-value="
            (v) => {
              if (v) {
                layer.module.danmujiFontSize = v
                store.pushHistory()
              }
            }
          "
        />
      </FormField>

      <FormField
        label="弹幕不透明度"
        :extra="`${Math.round((layer.module.danmujiOpacity ?? 1) * 100)}%`"
      >
        <Slider
          v-model="danmujiOpacitySlider"
          :min="10"
          :max="100"
          :step="5"
          @value-commit="store.pushHistory()"
        />
      </FormField>

      <SettingRow
        variant="none"
        title="最新弹幕置底"
      >
        <Switch
          :model-value="layer.module.danmujiReverse !== false"
          @update:model-value="
            (v) => {
              layer.module.danmujiReverse = v
              store.pushHistory()
            }
          "
        />
      </SettingRow>

      <SettingRow
        variant="none"
        title="顶部固定 SC 条"
      >
        <Switch
          :model-value="Boolean(layer.module.danmujiPinned)"
          @update:model-value="
            (v) => {
              layer.module.danmujiPinned = v
              store.pushHistory()
            }
          "
        />
      </SettingRow>

      <p
        class="text-[11px] text-sky-500/90 leading-relaxed rounded-md bg-sky-500/10 border border-sky-500/20 px-2.5 py-1.5"
      >
        弹幕机在播出态需鉴权，复制 OBS 链接或一键写入 OBS 时会自动附带您的账号 token（不会存入云端公开数据）。
      </p>
    </template>

    <!-- 2. 列表滚动类组件（点歌 / 点播 / 今日已处理点播 / 排队）：全部侧边栏直调 -->
    <template v-else-if="isScrollListModule">
      <FormField label="界面主题风格">
        <Select
          :model-value="layer.module.style || 'classic'"
          @update:model-value="
            (v) => {
              layer.module.style = String(v)
              store.pushHistory()
            }
          "
        >
          <SelectTrigger class="w-full"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="classic">经典 (Classic)</SelectItem>
            <SelectItem value="glass">毛玻璃 (Glass)</SelectItem>
            <SelectItem value="fresh">清新 (Fresh)</SelectItem>
            <SelectItem value="minimal">极简 (Minimal)</SelectItem>
            <SelectItem value="transparent">全透明 (Transparent)</SelectItem>
          </SelectContent>
        </Select>
      </FormField>

      <FormField label="滚动速度倍率">
        <NumberField
          :model-value="layer.module.speedMultiplier ?? 1"
          :min="0.2"
          :max="5"
          :step="0.2"
          @update:model-value="
            (v) => {
              if (v) {
                layer.module.speedMultiplier = v
                store.pushHistory()
              }
            }
          "
        />
      </FormField>

      <Separator v-if="account?.id" />

      <!-- 弹幕点歌后端展示配置 -->
      <template v-if="moduleId === 'music-request' && account?.settings?.musicRequest">
        <FormField
          label="面板标题"
          description="留空显示默认「点歌机」，失焦自动同步"
        >
          <Input
            v-model="musicObsTitle"
            placeholder="点歌机"
            :disabled="savingBackend"
            @blur="saveMusicObsTitle"
            @keydown.enter="saveMusicObsTitle"
          />
        </FormField>
      </template>

      <!-- 互动点播 / 今日已处理点播后端展示配置 -->
      <template
        v-else-if="(moduleId === 'live-request' || moduleId === 'live-request-today') && account?.settings?.songRequest"
      >
        <FormField
          :label="moduleId === 'live-request' ? '点播面板标题' : '今日已播面板标题'"
          description="失焦或回车自动同步"
        >
          <Input
            v-model="songRequestTitle"
            :placeholder="moduleId === 'live-request' ? '点播' : '今日已唱'"
            :disabled="savingBackend"
            @blur="saveSongRequestTitle"
            @keydown.enter="saveSongRequestTitle"
          />
        </FormField>

        <SettingRow
          v-if="moduleId === 'live-request'"
          variant="none"
          title="显示底部点播条件"
        >
          <Switch
            :disabled="savingBackend"
            :model-value="account.settings.songRequest.showRequireInfo !== false"
            @update:model-value="(v) => patchSongRequestSetting({ showRequireInfo: v })"
          />
        </SettingRow>

        <SettingRow
          variant="none"
          title="显示点播观众昵称"
        >
          <Switch
            :disabled="savingBackend"
            :model-value="account.settings.songRequest.showUserName !== false"
            @update:model-value="(v) => patchSongRequestSetting({ showUserName: v })"
          />
        </SettingRow>

        <SettingRow
          variant="none"
          title="显示观众粉丝牌"
        >
          <Switch
            :disabled="savingBackend"
            :model-value="account.settings.songRequest.showFanMadelInfo !== false"
            @update:model-value="(v) => patchSongRequestSetting({ showFanMadelInfo: v })"
          />
        </SettingRow>
      </template>

      <!-- 排队列表后端展示配置 -->
      <template v-else-if="moduleId === 'queue' && account?.settings?.queue">
        <SettingRow
          variant="none"
          title="显示底部排队条件"
        >
          <Switch
            :disabled="savingBackend"
            :model-value="account.settings.queue.showRequireInfo !== false"
            @update:model-value="(v) => patchQueueSetting({ showRequireInfo: v })"
          />
        </SettingRow>

        <SettingRow
          variant="none"
          title="显示付费 / 礼物徽章"
        >
          <Switch
            :disabled="savingBackend"
            :model-value="account.settings.queue.showPayment !== false"
            @update:model-value="(v) => patchQueueSetting({ showPayment: v })"
          />
        </SettingRow>

        <SettingRow
          variant="none"
          title="显示观众粉丝牌"
        >
          <Switch
            :disabled="savingBackend"
            :model-value="account.settings.queue.showFanMadelInfo !== false"
            @update:model-value="(v) => patchQueueSetting({ showFanMadelInfo: v })"
          />
        </SettingRow>
      </template>
    </template>

    <!-- 3. 直播抽奖：布局 + 配色 + 推荐尺寸一键适配 -->
    <template v-else-if="moduleId === 'live-lottery'">
      <FormField label="展示布局">
        <Select
          :model-value="layer.module.lotteryMode || 'card'"
          @update:model-value="
            (v) => {
              layer.module.lotteryMode = String(v) as 'card' | 'banner' | 'compact' | 'grid'
              store.pushHistory()
            }
          "
        >
          <SelectTrigger class="w-full"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="card">标准卡片 (侧边栏)</SelectItem>
            <SelectItem value="banner">横向长条 (顶底栏)</SelectItem>
            <SelectItem value="compact">悬浮胶囊 (小挂件)</SelectItem>
            <SelectItem value="grid">舞台网格 (多列墙)</SelectItem>
          </SelectContent>
        </Select>
      </FormField>

      <FormField label="配色风格">
        <Select
          :model-value="layer.module.style || 'slate'"
          @update:model-value="
            (v) => {
              layer.module.style = String(v)
              store.pushHistory()
            }
          "
        >
          <SelectTrigger class="w-full"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="slate">现代深邃 (Slate)</SelectItem>
            <SelectItem value="transparent">纯粹悬浮 (透明底)</SelectItem>
            <SelectItem value="champagne">温润香槟 (Champagne)</SelectItem>
            <SelectItem value="classic">经典暗色 (Classic)</SelectItem>
          </SelectContent>
        </Select>
      </FormField>

      <Button
        class="w-full"
        variant="secondary"
        size="xs"
        @click="applyLotteryRecommendedSize"
      >
        <Maximize2 class="w-3.5 h-3.5" />
        <span>适配当前布局推荐尺寸 ({{ lotteryRecommended.label }})</span>
      </Button>
    </template>

    <!-- 4. 弹幕投票：主题 + 形态 + 字体 + 选项上限（图层级独立配置，不污染全局） -->
    <template v-else-if="moduleId === 'danmaku-vote'">
      <FormField label="卡片主题风格">
        <Select
          :model-value="layer.module.style || 'glass'"
          @update:model-value="
            (v) => {
              layer.module.style = String(v)
              store.pushHistory()
            }
          "
        >
          <SelectTrigger class="w-full"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="glass">毛玻璃 (Glass)</SelectItem>
            <SelectItem value="duel">红蓝对决 (Duel)</SelectItem>
            <SelectItem value="minimal">极简深色 (Minimal)</SelectItem>
            <SelectItem value="light">浅色通透 (Light)</SelectItem>
            <SelectItem value="transparent">透明无底 (Transparent)</SelectItem>
          </SelectContent>
        </Select>
      </FormField>

      <FormField
        v-if="(layer.module.style || 'glass') === 'duel'"
        label="对决布局形态"
        description="双选项时可切换为顶部长条横幅"
      >
        <ToggleGroup
          type="single"
          :model-value="layer.module.voteLayout || 'auto'"
          class="w-full grid grid-cols-3"
          @update:model-value="
            (v) => {
              if (!v) return
              layer.module.voteLayout = v as 'auto' | 'card' | 'banner'
              store.pushHistory()
            }
          "
        >
          <ToggleGroupItem value="auto">自动</ToggleGroupItem>
          <ToggleGroupItem value="card">卡片</ToggleGroupItem>
          <ToggleGroupItem value="banner">横幅</ToggleGroupItem>
        </ToggleGroup>
      </FormField>

      <Button
        variant="outline"
        class="w-full"
        @click="applyVoteRecommendedSize"
      >
        <Maximize2 class="size-3.5" />
        <span>适配推荐尺寸 ({{ voteRecommended.label }})</span>
      </Button>

      <FormField label="最多显示选项数">
        <NumberField
          :model-value="layer.module.maxDisplay ?? 6"
          :min="2"
          :max="20"
          @update:model-value="
            (v) => {
              if (v) {
                layer.module.maxDisplay = v
                store.pushHistory()
              }
            }
          "
        />
      </FormField>

      <FormField
        label="图层字体（可选）"
        description="留空时沿用投票管理页全局字体"
      >
        <GoogleFontPicker
          :model-value="layer.module.voteFontFamily || ''"
          :extra-options="SYSTEM_CHINESE_FONT_OPTIONS"
          placeholder="沿用全局字体"
          @update:model-value="
            (v) => {
              layer.module.voteFontFamily = v || ''
              store.pushHistory()
            }
          "
        />
      </FormField>

      <Separator />

      <SettingRow
        variant="none"
        title="本图层显示实时票数"
        description="关闭时仅在本场景隐藏实时票数"
      >
        <Switch
          :model-value="layer.module.voteShowResults !== false"
          @update:model-value="
            (v) => {
              layer.module.voteShowResults = v
              store.pushHistory()
            }
          "
        />
      </SettingRow>
    </template>

    <!-- 5. 提问箱展示：弹出带实时画面的样式设置弹窗 -->
    <template v-else-if="moduleId === 'question-display'">
      <Button
        class="w-full"
        variant="secondary"
        @click="emit('openQuestionDisplayConfig', layer.id)"
      >
        <Settings2 class="w-3.5 h-3.5" />
        <span>打开提问箱样式设置</span>
      </Button>
    </template>

    <Button
      v-if="obsModuleMeta?.managePath"
      class="w-full"
      variant="outline"
      @click="openManagePage"
    >
      <ExternalLink class="w-3.5 h-3.5" />
      <span>前往业务管理页</span>
    </Button>
  </section>
</template>
