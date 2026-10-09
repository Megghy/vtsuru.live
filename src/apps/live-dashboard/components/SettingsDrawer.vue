<script setup lang="ts">
import { ReorderThreeOutline } from '@vicons/ionicons5'
import { saveAs } from 'file-saver'
import {
  NButton,
  NDivider,
  NDrawer,
  NDrawerContent,
  NIcon,
  NInputNumber,
  NPopconfirm,
  NSlider,
  NSwitch,
  NUpload,
  type UploadCustomRequestOptions,
} from 'naive-ui'
import { computed, ref, watch } from 'vue'
import { VueDraggable } from 'vue-draggable-plus'

import type { ExportFormat } from '../core/archive'
import { clearArchive, countByType, exportArchive, importArchive } from '../core/archive'
import type { ToolbarStatOption } from '../store/settings'
import { DEFAULT_TOOLBAR_ORDER, TOOLBAR_STAT_OPTIONS } from '../store/settings'
import { useDashboardUi } from '../store/ui'
import { useLiveDashboard } from '../store/useLiveDashboard'

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
    window.$message.success(`已导出 ${count} 条事件`)
  } finally {
    exporting.value = undefined
  }
}

/** NUpload 只用来选文件，读取在本地完成 */
function fileHandler(action: (file: File) => Promise<string>) {
  return async ({ file, onFinish, onError }: UploadCustomRequestOptions) => {
    try {
      window.$message.success(await action(file.file!))
      onFinish()
    } catch (error) {
      window.$message.error(error instanceof Error ? error.message : '导入失败')
      onError()
    }
  }
}

const importEvents = fileHandler(async (file) => {
  const count = await importArchive(file)
  await refreshCounts()
  return `已导入 ${count} 条事件，刷新页面后载入列表`
})

const importNotes = fileHandler(async (file) => `已导入 ${await dashboard.notes.importFile(file)} 条备注`)

function exportNotes() {
  saveAs(dashboard.notes.exportFile(), `vtsuru-dashboard-notes-${Date.now()}.json`)
}

async function clearAll() {
  await clearArchive()
  await refreshCounts()
  window.$message.success('本地事件已清空，刷新页面后生效')
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
  <NDrawer
    v-model:show="ui.settingsOpen"
    :width="340"
    placement="right"
  >
    <NDrawerContent
      title="中控台设置"
      closable
      :native-scrollbar="false"
    >
      <div class="settings">
        <div class="settings__group">显示</div>
        <label class="settings__row">显示头像<NSwitch v-model:value="dashboard.settings.showAvatar" /></label>
        <label class="settings__row">显示粉丝勋章<NSwitch v-model:value="dashboard.settings.showMedal" /></label>
        <label class="settings__row">显示绝对时间<NSwitch v-model:value="dashboard.settings.absoluteTime" /></label>
        <div class="settings__row">字号 {{ dashboard.settings.fontSize }}px</div>
        <NSlider
          v-model:value="dashboard.settings.fontSize"
          :min="12"
          :max="28"
        />
        <label class="settings__row">
          启动时载入最近（小时）
          <NInputNumber
            v-model:value="dashboard.settings.historyHours"
            size="small"
            :min="0"
            :max="168"
            style="width: 100px"
          />
        </label>

        <NDivider />
        <div class="settings__stat-header">
          <div class="settings__group">顶栏指标项 (支持拖拽排序)</div>
          <NButton
            size="tiny"
            quaternary
            @click="resetToolbarOrder"
          >
            重置排序
          </NButton>
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
            <div class="settings__stat-label">
              <span
                class="drag-handle"
                title="按住拖拽排序"
              >
                <NIcon><ReorderThreeOutline /></NIcon>
              </span>
              <span>{{ opt.label }}</span>
            </div>
            <NSwitch
              v-model:value="dashboard.settings.toolbarStats[opt.key]"
              size="small"
            />
          </div>
        </VueDraggable>

        <NDivider />
        <div class="settings__group">卡片模式</div>
        <label class="settings__row">
          卡片数量
          <NInputNumber
            v-model:value="dashboard.settings.card.size"
            size="small"
            :min="4"
            :max="80"
            style="width: 100px"
          />
        </label>
        <label class="settings__row"
          >自动隐藏刷屏弹幕<NSwitch v-model:value="dashboard.settings.card.autoHide"
        /></label>
        <template v-if="dashboard.settings.card.autoHide">
          <label class="settings__row">
            重复次数达到
            <NInputNumber
              v-model:value="dashboard.settings.card.autoHideThreshold"
              size="small"
              :min="2"
              style="width: 100px"
            />
          </label>
          <label class="settings__row">
            隐藏时长（秒）
            <NInputNumber
              v-model:value="dashboard.settings.card.autoHideSeconds"
              size="small"
              :min="5"
              style="width: 100px"
            />
          </label>
        </template>

        <NDivider />
        <div class="settings__group">用户备注</div>
        <div class="settings__buttons">
          <NButton
            size="small"
            @click="exportNotes"
          >
            导出备注
          </NButton>
          <NUpload
            accept=".json"
            :show-file-list="false"
            :custom-request="importNotes"
          >
            <NButton size="small"> 导入备注 </NButton>
          </NUpload>
        </div>

        <NDivider />
        <div class="settings__group">本地事件库</div>
        <div class="settings__hint">
          事件保存在当前浏览器，清除浏览器数据会一并删除。{{
            dashboard.historyRange ? '导出范围为当前选择的时间段。' : ''
          }}
        </div>
        <div class="settings__counts">
          <span
            v-for="c in counts"
            :key="c.label"
            >{{ c.label }} {{ c.count }}</span
          >
          <span v-if="!counts.length">暂无数据</span>
        </div>
        <div class="settings__buttons">
          <NButton
            v-for="f in ['json', 'csv', 'xlsx'] as const"
            :key="f"
            size="small"
            :loading="exporting === f"
            @click="doExport(f)"
          >
            导出 {{ f.toUpperCase() }}
          </NButton>
        </div>
        <div class="settings__buttons">
          <NUpload
            accept=".json"
            :show-file-list="false"
            :custom-request="importEvents"
          >
            <NButton size="small"> 导入 JSON 归档 </NButton>
          </NUpload>
          <NPopconfirm @positive-click="clearAll">
            <template #trigger>
              <NButton
                size="small"
                type="error"
                secondary
              >
                清空本地事件
              </NButton>
            </template>
            确定清空全部本地事件？此操作不可撤销。
          </NPopconfirm>
        </div>

        <NDivider />
        <div class="settings__hint">
          直播间房主发送弹幕 <code>/vt reload</code> 可远程刷新已打开的中控台（仅直连模式可识别房主）。
        </div>
      </div>
    </NDrawerContent>
  </NDrawer>
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
