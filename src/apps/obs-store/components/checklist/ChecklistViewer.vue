<script setup lang="ts">
import {
  ArrowDown,
  ArrowUp,
  Check,
  Circle,
  Play,
  Plus,
  RotateCcw,
  SkipForward,
  Sparkles,
  Trash2,
} from 'lucide-vue-next'
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { toast } from 'vue-sonner'

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
import { SettingRow } from '@/shared/ui/setting-row'

import ChecklistDisplay from './ChecklistDisplay.vue'
import { CHECKLIST_TEMPLATES, createChecklistItemId, DEFAULT_CHECKLIST_STATE } from './types'
import type { ChecklistAction, ChecklistItem, ChecklistItemStatus, ChecklistState, ChecklistTemplate } from './types'

const props = defineProps<{ channelId?: string }>()
const route = useRoute()

const channelId = ref(resolveObsSyncChannel(props.channelId ?? route.query.channel))

watch(
  () => props.channelId,
  (val) => {
    if (val) channelId.value = resolveObsSyncChannel(val)
  },
)

watch(
  () => route.query.channel,
  (val) => {
    if (!props.channelId && val) {
      channelId.value = resolveObsSyncChannel(val)
    }
  },
)

const { state, updateState, sendAction, currentHash, isSyncing, lastSyncError, hasPendingChanges, retry } =
  useObsBridge<ChecklistState, ChecklistAction>({
    componentId: 'checklist',
    channelId,
    defaultState: DEFAULT_CHECKLIST_STATE,
    role: 'controller',
  })

const newItemText = ref('')

const doneCount = computed(() => state.value.items.filter((item) => item.status === 'done').length)
const hasNextStep = computed(() => state.value.items.some((item) => item.status !== 'done'))

function addItem() {
  const text = newItemText.value.trim()
  if (!text) return
  const next: ChecklistItem[] = [...state.value.items, { id: createChecklistItemId(), text, status: 'pending' }]
  updateState({ items: next })
  newItemText.value = ''
}

function setItemStatus(id: string, status: ChecklistItemStatus) {
  const next = state.value.items.map((item) => {
    if (item.id === id) {
      return { ...item, status }
    }
    if (status === 'active' && state.value.singleActive && item.status === 'active') {
      return { ...item, status: 'pending' as const }
    }
    return item
  })
  updateState({ items: next })
  sendAction({ type: 'STATUS_CHANGED', id, status })
}

function updateItemText(id: string, text: string) {
  const next = state.value.items.map((item) => (item.id === id ? { ...item, text } : item))
  updateState({ items: next })
}

function moveItem(index: number, delta: -1 | 1) {
  const target = index + delta
  if (target < 0 || target >= state.value.items.length) return
  const next = [...state.value.items]
  const [moved] = next.splice(index, 1)
  next.splice(target, 0, moved)
  updateState({ items: next })
}

function removeItem(id: string) {
  updateState({ items: state.value.items.filter((item) => item.id !== id) })
}

function advanceNextStep() {
  const items = state.value.items.map((item) => ({ ...item }))
  const activeIdx = items.findIndex((item) => item.status === 'active')
  if (activeIdx >= 0) {
    items[activeIdx].status = 'done'
  }
  const nextPendingIdx = items.findIndex((item, idx) => idx > activeIdx && item.status === 'pending')
  const fallbackPendingIdx = nextPendingIdx >= 0 ? nextPendingIdx : items.findIndex((item) => item.status === 'pending')
  if (fallbackPendingIdx >= 0) {
    items[fallbackPendingIdx].status = 'active'
  }
  updateState({ items })
}

function resetAllToPending() {
  updateState({
    items: state.value.items.map((item) => ({ ...item, status: 'pending' })),
  })
  sendAction({ type: 'RESET_ALL' })
  toast.success('已将全部事项重置为待进行')
}

function applyTemplate(tpl: ChecklistTemplate) {
  updateState({
    title: tpl.title,
    subtitle: tpl.subtitle,
    items: tpl.items.map((item) => ({
      id: createChecklistItemId(),
      text: item.text,
      status: item.status ?? 'pending',
    })),
  })
  toast.success(`已套用「${tpl.name}」模板`)
}
</script>

<template>
  <ObsWidgetWorkbench
    component-id="checklist"
    title="直播话题与待办清单"
    obs-path="/obs-store/checklist"
    recommended-size="360 × 380 px"
    :channel-id="channelId"
    :is-syncing="isSyncing"
    :last-sync-error="lastSyncError"
    :has-pending-changes="hasPendingChanges"
    :current-hash="currentHash"
    :stage-min-height="340"
    @update:channel-id="channelId = $event"
    @retry="retry"
  >
    <template #controls>
      <!-- 快捷添加 -->
      <FormField
        label="新增事项"
        :extra="`已完成 ${doneCount} / ${state.items.length}`"
      >
        <div class="flex items-center gap-1.5">
          <Input
            v-model="newItemText"
            placeholder="输入今日话题或任务，按回车添加"
            class="flex-1 min-w-0"
            @keyup.enter="addItem"
          />
          <Button
            :disabled="!newItemText.trim()"
            class="shrink-0 gap-1"
            @click="addItem"
          >
            <Plus class="size-3.5" />
            添加
          </Button>
        </div>
      </FormField>

      <!-- 快捷操作与预设模板 -->
      <div class="flex flex-wrap items-center gap-1.5">
        <Button
          size="xs"
          :disabled="!hasNextStep"
          class="gap-1"
          @click="advanceNextStep"
        >
          <SkipForward class="size-3" />
          推进下一项
        </Button>
        <Button
          variant="outline"
          size="xs"
          :disabled="state.items.length === 0"
          class="gap-1"
          @click="resetAllToPending"
        >
          <RotateCcw class="size-3" />
          全部重置
        </Button>
      </div>

      <div class="flex flex-wrap items-center gap-1.5">
        <span class="text-[11px] text-muted-foreground inline-flex items-center gap-1">
          <Sparkles class="size-3" />
          预设模板:
        </span>
        <Button
          v-for="tpl in CHECKLIST_TEMPLATES"
          :key="tpl.id"
          variant="outline"
          size="xs"
          @click="applyTemplate(tpl)"
        >
          {{ tpl.name }}
        </Button>
      </div>

      <!-- 清单管理列表 -->
      <div class="space-y-1.5 max-h-[270px] overflow-y-auto scrollbar-thin pr-0.5">
        <div
          v-for="(item, index) in state.items"
          :key="item.id"
          class="flex items-center gap-1.5 rounded-md border px-2 py-1.5 transition-colors"
          :class="
            item.status === 'active'
              ? 'border-brand/50 bg-brand-soft/40'
              : item.status === 'done'
                ? 'border-border/60 bg-muted/30 opacity-75'
                : 'border-border bg-card'
          "
        >
          <!-- 三态快速切换按钮组 -->
          <div class="flex items-center gap-0.5 shrink-0">
            <Button
              size="none"
              :variant="item.status === 'pending' ? 'secondary' : 'ghost'"
              class="size-6 rounded-sm"
              title="设为待进行"
              @click="setItemStatus(item.id, 'pending')"
            >
              <Circle class="size-3" />
            </Button>
            <Button
              size="none"
              :variant="item.status === 'active' ? 'brand' : 'ghost'"
              class="size-6 rounded-sm"
              title="设为当前进行中"
              @click="setItemStatus(item.id, 'active')"
            >
              <Play class="size-3" />
            </Button>
            <Button
              size="none"
              :variant="item.status === 'done' ? 'default' : 'ghost'"
              class="size-6 rounded-sm"
              title="标记已完成"
              @click="setItemStatus(item.id, 'done')"
            >
              <Check class="size-3" />
            </Button>
          </div>

          <Input
            :model-value="item.text"
            size="xs"
            class="flex-1 min-w-0"
            :class="{ 'line-through text-muted-foreground': item.status === 'done' }"
            @update:model-value="updateItemText(item.id, String($event))"
          />

          <div class="flex items-center gap-0.5 shrink-0">
            <Button
              size="none"
              variant="ghost"
              class="size-6 rounded-sm"
              :disabled="index === 0"
              title="上移"
              @click="moveItem(index, -1)"
            >
              <ArrowUp class="size-3" />
            </Button>
            <Button
              size="none"
              variant="ghost"
              class="size-6 rounded-sm"
              :disabled="index === state.items.length - 1"
              title="下移"
              @click="moveItem(index, 1)"
            >
              <ArrowDown class="size-3" />
            </Button>
            <Button
              size="none"
              variant="ghost"
              class="size-6 rounded-sm text-muted-foreground hover:text-destructive"
              title="删除"
              @click="removeItem(item.id)"
            >
              <Trash2 class="size-3" />
            </Button>
          </div>
        </div>

        <div
          v-if="state.items.length === 0"
          class="rounded-md border border-dashed border-border py-6 text-center text-xs text-muted-foreground"
        >
          清单为空，可在上方输入新增事项或套用预设模板
        </div>
      </div>
    </template>

    <template #preview>
      <ChecklistDisplay
        :channel-id="channelId"
        :inline-mode="true"
      />
    </template>

    <template #settings>
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <FormField
          label="清单标题"
          class="min-w-0"
        >
          <Input
            :model-value="state.title"
            placeholder="例如：今日直播清单"
            @update:model-value="updateState({ title: String($event) })"
          />
        </FormField>

        <FormField
          label="副标题小标"
          class="min-w-0"
        >
          <Input
            :model-value="state.subtitle"
            placeholder="例如：STREAM PLAN"
            @update:model-value="updateState({ subtitle: String($event) })"
          />
        </FormField>

        <FormField
          label="最大可见条数"
          class="min-w-0"
        >
          <NumberField
            :model-value="state.maxVisible"
            :min="2"
            :max="20"
            class="w-full"
            @update:model-value="updateState({ maxVisible: Math.min(20, Math.max(2, Number($event) || 6)) })"
          />
        </FormField>

        <FormField
          label="视觉主题"
          class="min-w-0"
        >
          <Select
            :model-value="state.theme"
            @update:model-value="updateState({ theme: $event as ObsWidgetTheme })"
          >
            <SelectTrigger class="w-full">
              <SelectValue placeholder="选择主题" />
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
          label="强调高亮色"
          class="min-w-0"
        >
          <ColorPicker
            :model-value="state.accentColor"
            :swatches="OBS_ACCENT_PRESETS"
            :show-alpha="false"
            @update:model-value="updateState({ accentColor: $event })"
          />
        </FormField>

        <FormField
          label="字体"
          class="min-w-0"
        >
          <GoogleFontPicker
            :model-value="state.fontFamily || null"
            :extra-options="SYSTEM_CHINESE_FONT_OPTIONS"
            :show-preview="false"
            @update:model-value="updateState({ fontFamily: $event || '' })"
          />
        </FormField>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <SettingRow
          title="仅单选进行中"
          description="切换新进行项时自动取消旧高亮"
          variant="compact"
          type="switch"
          :model-value="state.singleActive"
          @update:model-value="updateState({ singleActive: Boolean($event) })"
        />
        <SettingRow
          title="隐藏已完成项"
          description="OBS 仅聚焦展示未完成事项"
          variant="compact"
          type="switch"
          :model-value="state.hideCompleted"
          @update:model-value="updateState({ hideCompleted: Boolean($event) })"
        />
        <SettingRow
          title="显示完成进度条"
          description="标题下方展示实时完成占比"
          variant="compact"
          type="switch"
          :model-value="state.showProgress"
          @update:model-value="updateState({ showProgress: Boolean($event) })"
        />
      </div>
    </template>
  </ObsWidgetWorkbench>
</template>
