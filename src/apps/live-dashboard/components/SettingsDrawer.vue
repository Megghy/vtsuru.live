<script setup lang="ts">
import { ReorderThreeOutline } from '@vicons/ionicons5'
import { saveAs } from 'file-saver'
import { computed, ref, watch } from 'vue'
import { VueDraggable } from 'vue-draggable-plus'

import type { ExportFormat } from '../core/archive'
import { clearArchive, countByType, exportArchive, importArchive } from '../core/archive'
import type { ToolbarStatOption } from '../store/settings'
import { DEFAULT_TOOLBAR_ORDER, TOOLBAR_STAT_OPTIONS } from '../store/settings'
import { useDashboardUi } from '../store/ui'
import { useLiveDashboard } from '../store/useLiveDashboard'
import { Button } from '@/shared/ui/button'
import NInputNumber from '@/shared/ui/NInputNumber.vue'
import { Popconfirm } from '@/shared/ui/popconfirm'
import { Separator } from '@/shared/ui/separator'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/shared/ui/sheet'
import { Slider } from '@/shared/ui/slider'
import { Switch } from '@/shared/ui/switch'
import { useMessage } from '@/shared/utils'

const message = useMessage()

const dashboard = useLiveDashboard()
const ui = useDashboardUi()
const counts = ref<{ label: string; count: number }[]>([])
const exporting = ref<ExportFormat>()

async function refreshCounts() {
  await dashboard.flushWrites()
  counts.value = await countByType()
}

watch(
  () => ui.settingsOpen,
  (open) => open && void refreshCounts(),
)

async function doExport(format: ExportFormat) {
  exporting.value = format
  try {
    await dashboard.flushWrites()
    const count = await exportArchive(format, dashboard.historyRange ?? undefined)
    message.success(`已导出 ${count} 条事件`)
  } finally {
    exporting.value = undefined
  }
}

async function handleFileChoose(e: Event, action: (file: File) => Promise<string>) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  try {
    const res = await action(file)
    message.success(res)
  } catch (error) {
    message.error(error instanceof Error ? error.message : '导入失败')
  } finally {
    input.value = ''
  }
}

async function onImportEvents(e: Event) {
  await handleFileChoose(e, async (file) => {
    const count = await importArchive(file)
    await refreshCounts()
    return `已导入 ${count} 条事件，刷新页面后载入列表`
  })
}

async function onImportNotes(e: Event) {
  await handleFileChoose(e, async (file) => {
    return `已导入 ${await dashboard.notes.importFile(file)} 条备注`
  })
}

function exportNotes() {
  saveAs(dashboard.notes.exportFile(), `vtsuru-dashboard-notes-${Date.now()}.json`)
}

async function clearAll() {
  await clearArchive()
  await refreshCounts()
  message.success('本地事件已清空，刷新页面后生效')
}

const orderedStatOptions = computed({
  get() {
    const map = new Map(TOOLBAR_STAT_OPTIONS.map((opt) => [opt.key, opt]))
    const order = dashboard.settings.toolbarOrder || DEFAULT_TOOLBAR_ORDER
    const list: ToolbarStatOption[] = []
    for (const key of order) {
      const item = map.get(key)
      if (item) list.push(item)
    }
    for (const opt of TOOLBAR_STAT_OPTIONS) {
      if (!order.includes(opt.key)) list.push(opt)
    }
    return list
  },
  set(newList: ToolbarStatOption[]) {
    dashboard.settings.toolbarOrder = newList.map((item) => item.key)
  },
})

function resetToolbarOrder() {
  dashboard.settings.toolbarOrder = [...DEFAULT_TOOLBAR_ORDER]
}
</script>

<template>
  <Sheet v-model:open="ui.settingsOpen">
    <SheetContent side="right" class="w-[340px] sm:max-w-[340px] overflow-y-auto">
      <SheetHeader>
        <SheetTitle>中控台设置</SheetTitle>
      </SheetHeader>
      <div class="settings mt-4">
        <div class="settings__group">显示</div>
        <label class="settings__row">显示头像<Switch v-model="dashboard.settings.showAvatar" /></label>
        <label class="settings__row">显示粉丝勋章<Switch v-model="dashboard.settings.showMedal" /></label>
        <label class="settings__row">显示绝对时间<Switch v-model="dashboard.settings.absoluteTime" /></label>
        <div class="settings__row">字号 {{ dashboard.settings.fontSize }}px</div>
        <Slider
          :model-value="[dashboard.settings.fontSize]"
          :min="12"
          :max="28"
          :step="1"
          @update:model-value="(val) => val && (dashboard.settings.fontSize = val[0])"
        />
        <label class="settings__row">
          启动时载入最近（小时）
          <NInputNumber
            v-model="dashboard.settings.historyHours"
            size="small"
            :min="0"
            :max="168"
            class="w-24"
          />
        </label>

        <Separator />
        <div class="settings__stat-header flex justify-between items-center">
          <div class="settings__group">顶栏指标项 (支持拖拽排序)</div>
          <Button
            size="sm"
            variant="ghost"
            class="h-6 text-xs px-2 text-muted-foreground"
            @click="resetToolbarOrder"
          >
            重置排序
          </Button>
        </div>
        <VueDraggable
          v-model="orderedStatOptions"
          handle=".drag-handle"
          :animation="150"
          class="settings__stat-list"
          ghost-class="settings__stat-ghost"
        >
          <div
            v-for="opt in orderedStatOptions"
            :key="opt.key"
            class="settings__row settings__stat-item"
            :title="opt.description"
          >
            <div class="settings__stat-label flex items-center gap-1.5">
              <span
                class="drag-handle cursor-grab text-muted-foreground"
                title="按住拖拽排序"
              >
                <component :is="ReorderThreeOutline" class="h-4 w-4" />
              </span>
              <span>{{ opt.label }}</span>
            </div>
            <Switch
              v-model="dashboard.settings.toolbarStats[opt.key]"
            />
          </div>
        </VueDraggable>

        <Separator />
        <div class="settings__group">卡片模式</div>
        <label class="settings__row">
          卡片数量
          <NInputNumber
            v-model="dashboard.settings.card.size"
            size="small"
            :min="4"
            :max="80"
            class="w-24"
          />
        </label>
        <label class="settings__row"
          >自动隐藏刷屏弹幕<Switch v-model="dashboard.settings.card.autoHide"
        /></label>
        <template v-if="dashboard.settings.card.autoHide">
          <label class="settings__row">
            重复次数达到
            <NInputNumber
              v-model="dashboard.settings.card.autoHideThreshold"
              size="small"
              :min="2"
              class="w-24"
            />
          </label>
          <label class="settings__row">
            隐藏时长（秒）
            <NInputNumber
              v-model="dashboard.settings.card.autoHideSeconds"
              size="small"
              :min="5"
              class="w-24"
            />
          </label>
        </template>

        <Separator />
        <div class="settings__group">用户备注</div>
        <div class="settings__buttons">
          <Button
            size="sm"
            variant="outline"
            @click="exportNotes"
          >
            导出备注
          </Button>
          <label>
            <input
              type="file"
              accept=".json"
              class="hidden"
              @change="onImportNotes"
            >
            <Button size="sm" variant="outline" as="span" class="cursor-pointer">
              导入备注
            </Button>
          </label>
        </div>

        <Separator />
        <div class="settings__group">本地事件库</div>
        <div class="settings__hint">
          事件保存在当前浏览器，清除浏览器数据会一并删除。{{
            dashboard.historyRange ? '导出范围为当前选择的时间段。' : ''
          }}
        </div>
        <div class="settings__counts flex flex-wrap gap-2 text-xs text-muted-foreground">
          <span
            v-for="c in counts"
            :key="c.label"
            >{{ c.label }} {{ c.count }}</span
          >
          <span v-if="!counts.length">暂无数据</span>
        </div>
        <div class="settings__buttons">
          <Button
            v-for="f in ['json', 'csv', 'xlsx'] as const"
            :key="f"
            size="sm"
            variant="outline"
            :disabled="exporting === f"
            @click="doExport(f)"
          >
            导出 {{ f.toUpperCase() }}
          </Button>
        </div>
        <div class="settings__buttons items-center">
          <label>
            <input
              type="file"
              accept=".json"
              class="hidden"
              @change="onImportEvents"
            >
            <Button size="sm" variant="outline" as="span" class="cursor-pointer">
              导入 JSON 归档
            </Button>
          </label>
          <Popconfirm @positive-click="clearAll">
            <template #trigger>
              <Button
                size="sm"
                variant="destructive"
              >
                清空本地事件
              </Button>
            </template>
            确定清空全部本地事件？此操作不可撤销。
          </Popconfirm>
        </div>

        <Separator />
        <div class="settings__hint">
          直播间房主发送弹幕 <code>/vt reload</code> 可远程刷新已打开的中控台（仅直连模式可识别房主）。
        </div>
      </div>
    </SheetContent>
  </Sheet>
</template>

<style scoped>
.settings {
  display: grid;
  gap: 10px;
  font-size: 13px;
}

.settings__group {
  font-weight: 600;
}

.settings__row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}

.settings__buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.settings__hint {
  font-size: 12px;
  color: var(--vtsuru-fg-muted);
}

.settings__counts {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 10px;
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}

.settings__stat-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.settings__stat-list {
  display: grid;
  gap: 6px;
}

.settings__stat-item {
  padding: 4px 6px;
  border-radius: var(--vtsuru-radius);
  background: var(--vtsuru-bg-elevated);
  transition: background 0.15s ease;
}

.settings__stat-item:hover {
  background: var(--vtsuru-bg-hover, rgba(255, 255, 255, 0.06));
}

.settings__stat-label {
  display: flex;
  align-items: center;
  gap: 6px;
  user-select: none;
}

.drag-handle {
  display: inline-flex;
  align-items: center;
  cursor: grab;
  color: var(--vtsuru-fg-muted);
  font-size: 14px;
}

.drag-handle:active {
  cursor: grabbing;
}

.settings__stat-ghost {
  opacity: 0.4;
  background: var(--vtsuru-brand-soft, rgba(59, 130, 246, 0.15));
}

.settings :deep(.n-divider) {
  margin: 4px 0;
}
</style>
