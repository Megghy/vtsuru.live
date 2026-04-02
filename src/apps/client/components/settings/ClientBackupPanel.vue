<script setup lang="ts">
import type { ClientBackupModule, ClientBackupPreview } from '@/apps/client/store/useClientBackup'
import { computed, onMounted, ref, watch } from 'vue'
import {
  NAlert,
  NButton,
  NCard,
  NCheckbox,
  NCheckboxGroup,
  NFlex,
  NInput,
  NInputNumber,
  NModal,
  NSelect,
  NText,
} from 'naive-ui'
import { isTauri } from '@/shared/config'
import {
  CLIENT_BACKUP_MIN_VERSION,
  CLIENT_BACKUP_MODULE_OPTIONS,
  useClientBackup,
} from '@/apps/client/store/useClientBackup'
import { useSettings } from '@/apps/client/store/useSettings'

const settings = useSettings()
const backup = useClientBackup()

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

watch(() => settings.settings.backup, () => {
  if (!backup.initialized) return
  void settings.save()
  void backup.reschedule()
}, { deep: true })

onMounted(async () => {
  await backup.init()
})

async function handlePickDirectory() {
  try {
    const selected = await backup.pickBackupDirectory()
    if (selected) {
      window.$message.success('备份目录已更新')
    }
  } catch (error) {
    window.$message.error(error instanceof Error ? error.message : String(error))
  }
}

async function handleManualBackup() {
  try {
    const result = await backup.createBackup('manual')
    window.$message.success(`备份完成: ${result.fileName}`)
  } catch (error) {
    window.$message.error(error instanceof Error ? error.message : String(error))
  }
}

async function handleSelectImportFile() {
  try {
    const preview = await backup.pickBackupFile()
    if (!preview) return

    importPreview.value = preview
    importModules.value = CLIENT_BACKUP_MODULE_OPTIONS.map(option => option.value)
    showImportModal.value = true
  } catch (error) {
    window.$message.error(error instanceof Error ? error.message : String(error))
  }
}

async function handleConfirmImport() {
  if (!importPreview.value) return

  try {
    await backup.importBackup(importPreview.value.filePath, importModules.value)
    window.$message.success('导入完成，页面即将刷新')
    showImportModal.value = false
    importPreview.value = null
    setTimeout(() => location.reload(), 300)
  } catch (error) {
    window.$message.error(error instanceof Error ? error.message : String(error))
  }
}
</script>

<template>
  <NFlex vertical :size="12">
    <NAlert
      v-if="!isTauri()"
      type="error"
      :bordered="false"
    >
      当前不是 Tauri 客户端环境，无法使用备份功能。
    </NAlert>

    <NAlert
      v-else-if="!backup.isSupported"
      type="warning"
      :bordered="false"
    >
      当前客户端版本为 {{ backup.currentVersion || '未知' }}，备份功能要求版本 >= {{ CLIENT_BACKUP_MIN_VERSION }}，请先更新客户端。
    </NAlert>

    <template v-else>
      <NAlert type="info" :bordered="false">
        备份会生成单个 ZIP 文件，覆盖 Tauri Store 与客户端 IndexedDB 数据。自动备份仅在客户端运行期间生效。
      </NAlert>

      <NCard title="备份目录" size="small" bordered>
        <NFlex vertical :size="8">
          <NInput
            :value="backupSettings.directory"
            readonly
            placeholder="尚未选择备份目录"
          />
          <NFlex justify="space-between" align="center">
            <NText depth="3">
              目录由系统对话框选择，定时备份和手动备份都写入这里。
            </NText>
            <NButton size="small" @click="handlePickDirectory">
              选择目录
            </NButton>
          </NFlex>
        </NFlex>
      </NCard>

      <NCard title="自动备份" size="small" bordered>
        <NFlex vertical :size="12">
          <label class="setting-row">
            <span>启用定时备份</span>
            <NCheckbox v-model:checked="backupSettings.scheduleEnabled" />
          </label>

          <label class="setting-row">
            <span>预设周期</span>
            <NSelect
              v-model:value="backupSettings.presetHours"
              :options="presetOptions"
              style="width: 180px"
            />
          </label>

          <label class="setting-row">
            <span>自定义周期（小时）</span>
            <NInputNumber
              v-model:value="backupSettings.customHours"
              clearable
              :min="1"
              style="width: 180px"
            />
          </label>

          <label class="setting-row">
            <span>最多保留份数</span>
            <NInputNumber
              v-model:value="backupSettings.keepCount"
              :min="1"
              :max="999"
              style="width: 180px"
            />
          </label>

          <NText depth="3">
            {{ effectiveIntervalText }}
          </NText>
        </NFlex>
      </NCard>

      <NCard title="操作" size="small" bordered>
        <NFlex vertical :size="8">
          <NText depth="3">
            上次备份: {{ lastBackupText }}
          </NText>
          <NText depth="3">
            最近文件: {{ backupSettings.lastBackupFile || '无' }}
          </NText>
          <NFlex>
            <NButton
              type="primary"
              :loading="backup.busy"
              :disabled="!canUseBackup || !backupSettings.directory"
              @click="handleManualBackup"
            >
              立即备份
            </NButton>
            <NButton
              :loading="backup.busy"
              :disabled="!canUseBackup"
              @click="handleSelectImportFile"
            >
              导入备份
            </NButton>
          </NFlex>
        </NFlex>
      </NCard>
    </template>

    <NModal
      v-model:show="showImportModal"
      preset="card"
      title="导入备份"
      style="width: 680px; max-width: calc(100vw - 24px)"
      :mask-closable="false"
    >
      <NFlex v-if="importPreview" vertical :size="12">
        <NAlert type="warning" :bordered="false">
          导入会覆盖已勾选模块的当前数据，未勾选模块保持不变。
        </NAlert>

        <NText depth="3">
          备份时间: {{ new Date(importPreview.manifest.createdAt).toLocaleString() }}
        </NText>
        <NText depth="3">
          备份客户端版本: {{ importPreview.manifest.clientVersion }}
        </NText>

        <NCheckboxGroup v-model:value="importModules">
          <NFlex vertical :size="8">
            <NCard
              v-for="option in CLIENT_BACKUP_MODULE_OPTIONS"
              :key="option.value"
              size="small"
              bordered
            >
              <NFlex justify="space-between" align="center">
                <div>
                  <NCheckbox :value="option.value">
                    {{ option.label }}
                  </NCheckbox>
                  <div class="module-desc">
                    {{ option.description }}
                  </div>
                </div>
                <NText depth="3">
                  {{ importPreview.manifest.modules[option.value].count }} 项
                </NText>
              </NFlex>
            </NCard>
          </NFlex>
        </NCheckboxGroup>

        <NFlex justify="end">
          <NButton @click="showImportModal = false">
            取消
          </NButton>
          <NButton
            type="error"
            :loading="backup.busy"
            :disabled="importModules.length === 0"
            @click="handleConfirmImport"
          >
            确认导入并覆盖
          </NButton>
        </NFlex>
      </NFlex>
    </NModal>
  </NFlex>
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
  color: var(--n-text-color-3);
  font-size: 12px;
}
</style>
