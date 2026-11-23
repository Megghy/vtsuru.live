<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { toast } from 'vue-sonner'

import type { ClientBackupModule, ClientBackupPreview } from '@/apps/client/store/useClientBackup'
import {
  CLIENT_BACKUP_MIN_VERSION,
  CLIENT_BACKUP_MODULE_OPTIONS,
  useClientBackup,
} from '@/apps/client/store/useClientBackup'
import { useSettings } from '@/apps/client/store/useSettings'
import { isTauri } from '@/shared/config'
import { Alert, AlertDescription } from '@/shared/ui/alert'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { Checkbox } from '@/shared/ui/checkbox'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { Input } from '@/shared/ui/input'
import { NumberField } from '@/shared/ui/number-field'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { SettingRow } from '@/shared/ui/setting-row'
import { Switch } from '@/shared/ui/switch'

const settings = useSettings()
const backup = useClientBackup()
const router = useRouter()

const showImportModal = ref(false)
const importPreview = ref<ClientBackupPreview | null>(null)
const importModules = ref<ClientBackupModule[]>([])

const presetOptions = [
  { label: '每 6 小时', value: '6' },
  { label: '每 12 小时', value: '12' },
  { label: '每天', value: '24' },
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
      toast.success('备份目录已更新')
    }
  } catch (error) {
    toast.error(error instanceof Error ? error.message : String(error))
  }
}

async function handleManualBackup() {
  try {
    const result = await backup.createBackup('manual')
    toast.success(`备份完成: ${result.fileName}`)
  } catch (error) {
    toast.error(error instanceof Error ? error.message : String(error))
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
    toast.error(error instanceof Error ? error.message : String(error))
  }
}

async function handleConfirmImport() {
  if (!importPreview.value) return

  try {
    await backup.importBackup(importPreview.value.filePath, importModules.value)
    toast.success('导入完成，页面即将刷新')
    showImportModal.value = false
    importPreview.value = null
    setTimeout(() => location.reload(), 300)
  } catch (error) {
    toast.error(error instanceof Error ? error.message : String(error))
  }
}

function toggleModule(mod: ClientBackupModule) {
  const idx = importModules.value.indexOf(mod)
  if (idx > -1) {
    importModules.value.splice(idx, 1)
  } else {
    importModules.value.push(mod)
  }
}
</script>

<template>
  <div class="flex flex-col gap-3">
    <Alert
      v-if="!isTauri()"
      variant="destructive"
    >
      <AlertDescription class="m-0"> 当前不是 Tauri 客户端环境，无法使用备份功能。 </AlertDescription>
    </Alert>

    <Alert
      v-else-if="!backup.isSupported"
      variant="warning"
    >
      <div class="flex-between gap-2">
        <AlertDescription class="m-0">
          当前客户端版本为 {{ backup.currentVersion || '未知' }}，备份功能要求版本 >=
          {{ CLIENT_BACKUP_MIN_VERSION }}，请先更新客户端。
        </AlertDescription>
        <Button
          size="xs"
          variant="outline"
          class="shrink-0"
          @click="router.push({ name: 'client-settings', query: { tab: 'about' } })"
        >
          检查更新
        </Button>
      </div>
    </Alert>

    <template v-else>
      <Alert variant="info">
        <AlertDescription class="m-0">
          备份会生成单个 ZIP 文件，覆盖 Tauri Store 与客户端 IndexedDB 数据。默认剔除 B 站 Cookie、Token 与转写密钥，防止分享配置时泄露账号。
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader class="p-3 pb-1">
          <CardTitle>备份目录</CardTitle>
        </CardHeader>
        <CardContent class="p-3 space-y-2">
          <Input
            :model-value="backupSettings.directory"
            readonly
            placeholder="尚未选择备份目录"
          />
          <div class="flex-between gap-2">
            <span class="text-xs text-muted-foreground"> 目录由系统对话框选择，定时备份和手动备份都写入这里。 </span>
            <Button
              variant="secondary"
              class="shrink-0"
              @click="handlePickDirectory"
            >
              选择目录
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader class="p-3 pb-1">
          <CardTitle>备份策略与安全</CardTitle>
        </CardHeader>
        <CardContent class="p-3 space-y-3">
          <SettingRow
            variant="none"
            title="包含敏感凭据（Cookie / API 密钥）"
            description="关闭时将自动剔除 B 站 Cookie、账号池、推流码及转写服务密钥；导入此类脱敏备份时也会保留本机已有凭据"
          >
            <Switch
              :checked="Boolean(backupSettings.includeSensitiveCredentials)"
              @update:checked="backupSettings.includeSensitiveCredentials = Boolean($event)"
            />
          </SettingRow>

          <SettingRow
            variant="none"
            title="启用定时备份"
            description="仅在客户端运行期间按以下周期自动写入备份目录"
          >
            <Switch
              :checked="backupSettings.scheduleEnabled"
              @update:checked="backupSettings.scheduleEnabled = Boolean($event)"
            />
          </SettingRow>

          <SettingRow
            variant="none"
            title="预设周期"
          >
            <div class="w-[180px]">
              <Select
                :model-value="String(backupSettings.presetHours)"
                @update:model-value="backupSettings.presetHours = Number($event)"
              >
                <SelectTrigger class="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem
                    v-for="opt in presetOptions"
                    :key="opt.value"
                    :value="opt.value"
                  >
                    {{ opt.label }}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </SettingRow>

          <SettingRow
            variant="none"
            title="自定义周期（小时）"
            description="留空时使用上方预设周期"
          >
            <NumberField
              :model-value="backupSettings.customHours"
              :min="1"
              class="w-[180px]"
              @update:model-value="backupSettings.customHours = $event ?? null"
            />
          </SettingRow>

          <SettingRow
            variant="none"
            title="最多保留份数"
            description="超出后自动清理最旧的备份文件"
          >
            <NumberField
              :model-value="backupSettings.keepCount"
              :min="1"
              :max="999"
              class="w-[180px]"
              @update:model-value="backupSettings.keepCount = $event || 10"
            />
          </SettingRow>

          <div class="text-xs text-muted-foreground pt-1 border-t border-border">
            {{ effectiveIntervalText }}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader class="p-3 pb-1">
          <CardTitle>操作</CardTitle>
        </CardHeader>
        <CardContent class="p-3 space-y-2">
          <div class="text-xs text-muted-foreground">上次备份: {{ lastBackupText }}</div>
          <div class="text-xs text-muted-foreground">最近文件: {{ backupSettings.lastBackupFile || '无' }}</div>
          <div class="flex items-center gap-2 pt-1">
            <Button
              :disabled="!canUseBackup || !backupSettings.directory || backup.busy"
              @click="handleManualBackup"
            >
              {{ backup.busy ? '备份中...' : '立即备份' }}
            </Button>
            <Button
              variant="outline"
              :disabled="!canUseBackup || backup.busy"
              @click="handleSelectImportFile"
            >
              导入备份
            </Button>
          </div>
        </CardContent>
      </Card>
    </template>

    <Dialog v-model:open="showImportModal">
      <DialogContent class="sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle class="text-base">导入备份</DialogTitle>
        </DialogHeader>

        <div
          v-if="importPreview"
          class="space-y-3 pt-2"
        >
          <Alert
            size="sm"
            variant="warning"
          >
            <AlertDescription class="m-0">
              导入会覆盖已勾选模块的当前数据，未勾选模块保持不变。
              <template v-if="importPreview.manifest.includesSensitiveCredentials === false">
                该备份为脱敏备份，导入时会自动保留你本机现有的 Cookie 与凭据。
              </template>
            </AlertDescription>
          </Alert>

          <div class="flex items-center justify-between text-xs text-muted-foreground">
            <div class="space-y-0.5">
              <div>备份时间: {{ new Date(importPreview.manifest.createdAt).toLocaleString() }}</div>
              <div>备份客户端版本: {{ importPreview.manifest.clientVersion }}</div>
            </div>
            <Badge
              :variant="importPreview.manifest.includesSensitiveCredentials === false ? 'secondary' : 'outline'"
              size="xs"
            >
              {{ importPreview.manifest.includesSensitiveCredentials === false ? '脱敏备份（不含凭据）' : '含凭据 / 完整备份' }}
            </Badge>
          </div>

          <div class="space-y-2 max-h-[300px] overflow-y-auto">
            <Card
              v-for="option in CLIENT_BACKUP_MODULE_OPTIONS"
              :key="option.value"
              class="cursor-pointer hover:bg-muted/10 transition-colors"
              @click="toggleModule(option.value)"
            >
              <CardContent class="p-2.5 flex-between gap-2">
                <div class="flex items-start gap-2 min-w-0">
                  <Checkbox
                    :checked="importModules.includes(option.value)"
                    class="mt-0.5"
                    @click.stop="toggleModule(option.value)"
                  />
                  <div>
                    <span class="text-xs font-semibold text-foreground block">{{ option.label }}</span>
                    <span class="text-[11px] text-muted-foreground block">{{ option.description }}</span>
                  </div>
                </div>
                <span class="text-xs text-muted-foreground shrink-0">
                  {{ importPreview.manifest.modules[option.value].count }} 项
                </span>
              </CardContent>
            </Card>
          </div>

          <div class="flex justify-end gap-2 pt-2 border-t border-border">
            <Button
              variant="outline"
              @click="showImportModal = false"
            >
              取消
            </Button>
            <Button
              variant="destructive"
              :disabled="importModules.length === 0 || backup.busy"
              @click="handleConfirmImport"
            >
              {{ backup.busy ? '导入中...' : '确认导入并覆盖' }}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  </div>
</template>
