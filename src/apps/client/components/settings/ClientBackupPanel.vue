<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

import type { ClientBackupModule, ClientBackupPreview } from '@/apps/client/store/useClientBackup'
import {
  CLIENT_BACKUP_MIN_VERSION,
  CLIENT_BACKUP_MODULE_OPTIONS,
  useClientBackup,
} from '@/apps/client/store/useClientBackup'
import { useSettings } from '@/apps/client/store/useSettings'
import { isTauri } from '@/shared/config'

const settings = useSettings()
const backup = useClientBackup()
const router = useRouter()
const toast = useToast()

const showImportModal = ref(false)
const importPreview = ref<ClientBackupPreview | null>(null)
const importModules = ref<ClientBackupModule[]>([])

const presetOptions = [
  { label: '每 6 小时', value: 6 },
  { label: '每 12 小时', value: 12 },
  { label: '每天', value: 24 },
]

const backupSettings = computed(() => settings.settings.backup)
const canUseBackup = computed(() => isTauri() && backup.isSupported)
const lastBackupText = computed(() => {
  if (!backupSettings.value.lastBackupAt) return '尚未备份'
  return new Date(backupSettings.value.lastBackupAt).toLocaleString()
})
const effectiveIntervalText = computed(() => {
  const customHours = backupSettings.value.customHours
  if (customHours && customHours > 0) return `当前使用自定义 ${customHours} 小时`
  return `当前使用预设 ${backupSettings.value.presetHours} 小时`
})

function toggleImportModule(module: ClientBackupModule, checked: boolean) {
  importModules.value = checked
    ? [...new Set([...importModules.value, module])]
    : importModules.value.filter((value) => value !== module)
}

watch(
  () => settings.settings.backup,
  () => {
    if (!backup.initialized) return
    void settings.save()
    void backup.reschedule()
  },
  { deep: true },
)

onMounted(async () => {
  await backup.init()
})

async function handlePickDirectory() {
  try {
    const selected = await backup.pickBackupDirectory()
    if (selected) {
      toast.add({ title: '备份目录已更新', color: 'success' })
    }
  } catch (error) {
    toast.add({ title: error instanceof Error ? error.message : String(error), color: 'error' })
  }
}

async function handleManualBackup() {
  try {
    const result = await backup.createBackup('manual')
    toast.add({ title: `备份完成: ${result.fileName}`, color: 'success' })
  } catch (error) {
    toast.add({ title: error instanceof Error ? error.message : String(error), color: 'error' })
  }
}

async function handleSelectImportFile() {
  try {
    const preview = await backup.pickBackupFile()
    if (!preview) return

    importPreview.value = preview
    importModules.value = CLIENT_BACKUP_MODULE_OPTIONS.map((option) => option.value)
    showImportModal.value = true
  } catch (error) {
    toast.add({ title: error instanceof Error ? error.message : String(error), color: 'error' })
  }
}

async function handleConfirmImport() {
  if (!importPreview.value) return

  try {
    await backup.importBackup(importPreview.value.filePath, importModules.value)
    toast.add({ title: '导入完成，页面即将刷新', color: 'success' })
    showImportModal.value = false
    importPreview.value = null
    setTimeout(() => location.reload(), 300)
  } catch (error) {
    toast.add({ title: error instanceof Error ? error.message : String(error), color: 'error' })
  }
}
</script>

<template>
  <div
    vertical
    :size="12"
  >
    <UAlert
      v-if="!isTauri()"
      type="error"
      :bordered="false"
    >
      当前不是 Tauri 客户端环境，无法使用备份功能。
    </UAlert>

    <UAlert
      v-else-if="!backup.isSupported"
      type="warning"
      :bordered="false"
    >
      <div
        align="center"
        justify="space-between"
      >
        <span
          >当前客户端版本为 {{ backup.currentVersion || '未知' }}，备份功能要求版本 >=
          {{ CLIENT_BACKUP_MIN_VERSION }}，请先更新客户端。</span
        >
        <UButton
          size="small"
          color="warning"
          @click="router.push({ name: 'client-settings', query: { tab: 'about' } })"
        >
          检查更新
        </UButton>
      </div>
    </UAlert>

    <template v-else>
      <UAlert
        type="info"
        :bordered="false"
      >
        备份会生成单个 ZIP 文件，覆盖 Tauri Store 与客户端 IndexedDB 数据。自动备份仅在客户端运行期间生效。
      </UAlert>

      <UCard
        title="备份目录"
        size="small"
        bordered
      >
        <div
          vertical
          :size="8"
        >
          <UInput
            :value="backupSettings.directory"
            readonly
            placeholder="尚未选择备份目录"
          />
          <div
            justify="space-between"
            align="center"
          >
            <span depth="3"> 目录由系统对话框选择，定时备份和手动备份都写入这里。 </span>
            <UButton
              size="small"
              @click="handlePickDirectory"
            >
              选择目录
            </UButton>
          </div>
        </div>
      </UCard>

      <UCard
        title="自动备份"
        size="small"
        bordered
      >
        <div
          vertical
          :size="12"
        >
          <label class="setting-row">
            <span>启用定时备份</span>
            <UCheckbox v-model="backupSettings.scheduleEnabled" />
          </label>

          <label class="setting-row">
            <span>预设周期</span>
            <USelectMenu
              v-model="backupSettings.presetHours"
              :items="presetOptions"
              style="width: 180px"
              value-key="value"
            />
          </label>

          <label class="setting-row">
            <span>自定义周期（小时）</span>
            <UInputNumber
              v-model="backupSettings.customHours"
              clearable
              :min="1"
              style="width: 180px"
            />
          </label>

          <label class="setting-row">
            <span>最多保留份数</span>
            <UInputNumber
              v-model="backupSettings.keepCount"
              :min="1"
              :max="999"
              style="width: 180px"
            />
          </label>

          <span depth="3">
            {{ effectiveIntervalText }}
          </span>
        </div>
      </UCard>

      <UCard
        title="操作"
        size="small"
        bordered
      >
        <div
          vertical
          :size="8"
        >
          <span depth="3"> 上次备份: {{ lastBackupText }} </span>
          <span depth="3"> 最近文件: {{ backupSettings.lastBackupFile || '无' }} </span>
          <div>
            <UButton
              color="primary"
              :loading="backup.busy"
              :disabled="!canUseBackup || !backupSettings.directory"
              @click="handleManualBackup"
            >
              立即备份
            </UButton>
            <UButton
              :loading="backup.busy"
              :disabled="!canUseBackup"
              @click="handleSelectImportFile"
            >
              导入备份
            </UButton>
          </div>
        </div>
      </UCard>
    </template>

    <UModal
      v-model:open="showImportModal"
      preset="card"
      title="导入备份"
      style="width: 680px; max-width: calc(100vw - 24px)"
      :mask-closable="false"
    >
      <div
        v-if="importPreview"
        vertical
        :size="12"
      >
        <UAlert
          type="warning"
          :bordered="false"
        >
          导入会覆盖已勾选模块的当前数据，未勾选模块保持不变。
        </UAlert>

        <span depth="3"> 备份时间: {{ new Date(importPreview.manifest.createdAt).toLocaleString() }} </span>
        <span depth="3"> 备份客户端版本: {{ importPreview.manifest.clientVersion }} </span>

        <div>
          <div
            vertical
            :size="8"
          >
            <UCard
              v-for="option in CLIENT_BACKUP_MODULE_OPTIONS"
              :key="option.value"
              size="small"
              bordered
            >
              <div
                justify="space-between"
                align="center"
              >
                <div>
                  <UCheckbox
                    :model-value="importModules.includes(option.value)"
                    @update:model-value="(checked) => toggleImportModule(option.value, checked === true)"
                  >
                    {{ option.label }}
                  </UCheckbox>
                  <div class="module-desc">
                    {{ option.description }}
                  </div>
                </div>
                <span depth="3"> {{ importPreview.manifest.modules[option.value].count }} 项 </span>
              </div>
            </UCard>
          </div>
        </div>

        <div justify="end">
          <UButton @click="showImportModal = false"> 取消 </UButton>
          <UButton
            color="error"
            :loading="backup.busy"
            :disabled="importModules.length === 0"
            @click="handleConfirmImport"
          >
            确认导入并覆盖
          </UButton>
        </div>
      </div>
    </UModal>
  </div>
</template>

<style scoped>
.setting-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.module-desc {
  margin-top: 4px;
  color: var(--vtsuru-fg-muted);
  font-size: 12px;
}
</style>
