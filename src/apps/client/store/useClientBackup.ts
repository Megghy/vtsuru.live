import { getVersion } from '@tauri-apps/api/app'
import { join } from '@tauri-apps/api/path'
import { open } from '@tauri-apps/plugin-dialog'
import type { DirEntry } from '@tauri-apps/plugin-fs'
import { exists, mkdir, readDir, readFile, remove, writeFile } from '@tauri-apps/plugin-fs'
import JSZip from 'jszip'
import { acceptHMRUpdate, defineStore } from 'pinia'
import { parse, stringify } from 'superjson'
import { ref, watch } from 'vue'

import { isTauri } from '@/shared/config'
import {
  AUTO_ACTION_USER_DATA_PREFIX,
  persistedEntries,
  persistedFlush,
  persistedRemoveKeys,
  persistedSetMany,
} from '@/shared/storage/persist'

import type { ClientBackupSettings } from './useSettings'
import { useSettings } from './useSettings'

export const CLIENT_BACKUP_MIN_VERSION = '0.1.7'

export type ClientBackupModule =
  | 'tauriStore'
  | 'persistKv'
  | 'autoActionConfig'
  | 'autoActionUserData'
  | 'autoActionHistory'

export interface ClientBackupManifestModule {
  file: string
  count: number
}

export interface ClientBackupManifest {
  schemaVersion: number
  app: 'vtsuru-client'
  createdAt: number
  clientVersion: string
  encoding: 'superjson'
  modules: Record<ClientBackupModule, ClientBackupManifestModule>
}

export interface ClientBackupPreview {
  filePath: string
  manifest: ClientBackupManifest
}

export const CLIENT_BACKUP_MODULE_OPTIONS: Array<{
  value: ClientBackupModule
  label: string
  description: string
}> = [
  {
    value: 'tauriStore',
    label: '客户端设置',
    description: '恢复直播/B站/VTS/转写等客户端配置，包括备份设置本身。',
  },
  {
    value: 'persistKv',
    label: '通用本地设置',
    description: '恢复弹幕窗、礼物窗、主题等通用本地设置。',
  },
  {
    value: 'autoActionConfig',
    label: '自动操作配置',
    description: '恢复自动操作列表、触发器启用状态、全局定时与签到配置。',
  },
  {
    value: 'autoActionUserData',
    label: '自动操作脚本持久化数据',
    description: '恢复自动操作脚本通过持久化接口保存的数据。',
  },
  {
    value: 'autoActionHistory',
    label: '自动操作历史记录',
    description: '恢复自动操作执行历史记录。',
  },
]

const BACKUP_SCHEMA_VERSION = 1
const BACKUP_FILE_PREFIX = 'vtsuru-client-backup-'
const BACKUP_FILE_SUFFIX = '.zip'

const MODULE_FILES: Record<ClientBackupModule, string> = {
  tauriStore: 'tauri-store.json',
  persistKv: 'idb-persist-kv.json',
  autoActionConfig: 'idb-autoaction-config.json',
  autoActionUserData: 'idb-autoaction-user-data.json',
  autoActionHistory: 'idb-autoaction-history.json',
}

function compareVersions(left: string, right: string): number {
  const leftParts = left.split('.').map((part) => Number.parseInt(part, 10) || 0)
  const rightParts = right.split('.').map((part) => Number.parseInt(part, 10) || 0)
  const maxLength = Math.max(leftParts.length, rightParts.length)
  for (let i = 0; i < maxLength; i++) {
    const diff = (leftParts[i] || 0) - (rightParts[i] || 0)
    if (diff !== 0) return diff
  }
  return 0
}

function partitionKey(key: string): ClientBackupModule {
  if (key.startsWith('autoAction_history_')) return 'autoActionHistory'
  if (key.startsWith(AUTO_ACTION_USER_DATA_PREFIX)) return 'autoActionUserData'
  if (key.startsWith('autoAction.')) return 'autoActionConfig'
  if (key.startsWith('vtsuru:')) return 'persistKv'
  return 'tauriStore'
}

function getBackupFilename(timestamp: number): string {
  const date = new Date(timestamp)
  const yyyy = date.getFullYear()
  const MM = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  const HH = String(date.getHours()).padStart(2, '0')
  const mm = String(date.getMinutes()).padStart(2, '0')
  const ss = String(date.getSeconds()).padStart(2, '0')
  return `${BACKUP_FILE_PREFIX}${yyyy}${MM}${dd}-${HH}${mm}${ss}${BACKUP_FILE_SUFFIX}`
}

function getBackupHours(config: ClientBackupSettings): number | null {
  if (config.customHours && Number.isFinite(config.customHours) && config.customHours > 0) {
    return config.customHours
  }
  if (Number.isFinite(config.presetHours) && config.presetHours > 0) {
    return config.presetHours
  }
  return null
}

async function parseZip(bytes: Uint8Array): Promise<JSZip> {
  return JSZip.loadAsync(bytes)
}

async function readManifestFromZip(zip: JSZip): Promise<ClientBackupManifest> {
  const manifestFile = zip.file('manifest.json')
  if (!manifestFile) {
    throw new Error('备份文件缺少 manifest.json')
  }

  const manifest = JSON.parse(await manifestFile.async('string')) as ClientBackupManifest
  if (manifest.app !== 'vtsuru-client') {
    throw new Error('备份文件来源不匹配')
  }
  if (manifest.schemaVersion !== BACKUP_SCHEMA_VERSION) {
    throw new Error(`不支持的备份格式版本: ${manifest.schemaVersion}`)
  }
  return manifest
}

async function readModulePayload<T>(
  zip: JSZip,
  manifest: ClientBackupManifest,
  module: ClientBackupModule,
): Promise<T> {
  const moduleFile = zip.file(manifest.modules[module].file)
  if (!moduleFile) {
    throw new Error(`备份文件缺少模块: ${module}`)
  }
  return parse<T>(await moduleFile.async('string'))
}

export const useClientBackup = defineStore('clientBackup', () => {
  const currentVersion = ref('')
  const isSupported = ref(false)
  const initialized = ref(false)
  const busy = ref(false)
  const scheduler = ref<number | null>(null)
  let stopSettingsWatch: (() => void) | null = null

  async function ensureSupported() {
    if (!isTauri()) throw new Error('当前环境不是 Tauri 客户端')
    if (!initialized.value) {
      await init()
    }
    if (!isSupported.value) {
      throw new Error(`备份功能需要客户端版本 >= ${CLIENT_BACKUP_MIN_VERSION}`)
    }
  }

  async function init() {
    if (initialized.value) return
    if (!isTauri()) {
      initialized.value = true
      return
    }

    currentVersion.value = await getVersion()
    isSupported.value = compareVersions(currentVersion.value, CLIENT_BACKUP_MIN_VERSION) >= 0
    initialized.value = true

    if (!isSupported.value) return

    const settingsStore = useSettings()
    stopSettingsWatch = watch(
      () => settingsStore.settings.backup,
      () => {
        void reschedule()
      },
      { deep: true },
    )

    await reschedule()
  }

  function stopSchedule() {
    if (scheduler.value !== null) {
      clearInterval(scheduler.value)
      scheduler.value = null
    }
  }

  async function dispose() {
    stopSchedule()
    stopSettingsWatch?.()
    stopSettingsWatch = null
    initialized.value = false
  }

  async function reschedule() {
    stopSchedule()
    if (!isSupported.value) return

    const settingsStore = useSettings()
    const config = settingsStore.settings.backup
    const hours = getBackupHours(config)

    if (!config.scheduleEnabled || !config.directory.trim() || !hours) return

    scheduler.value = window.setInterval(
      () => {
        void createBackup('scheduled').catch((error) => {
          console.error('[ClientBackup] 自动备份失败:', error)
        })
      },
      hours * 60 * 60 * 1000,
    )
  }

  async function pickBackupDirectory() {
    await ensureSupported()

    const selected = await open({
      title: '选择备份目录',
      directory: true,
      multiple: false,
    })

    if (typeof selected !== 'string') return null

    const settingsStore = useSettings()
    settingsStore.settings.backup.directory = selected
    await settingsStore.save()
    await reschedule()
    return selected
  }

  async function pickBackupFile(): Promise<ClientBackupPreview | null> {
    await ensureSupported()

    const selected = await open({
      title: '选择备份 ZIP',
      directory: false,
      multiple: false,
      filters: [{ name: 'ZIP', extensions: ['zip'] }],
    })

    if (typeof selected !== 'string') return null

    const zip = await parseZip(await readFile(selected))
    const manifest = await readManifestFromZip(zip)
    return {
      filePath: selected,
      manifest,
    }
  }

  async function buildBackupArchive() {
    await useSettings().save()
    await persistedFlush()

    const createdAt = Date.now()
    const grouped: Record<ClientBackupModule, Array<[string, unknown]>> = {
      tauriStore: [],
      persistKv: [],
      autoActionConfig: [],
      autoActionUserData: [],
      autoActionHistory: [],
    }
    for (const [key, value] of await persistedEntries()) {
      grouped[partitionKey(String(key))].push([String(key), value])
    }
    const tauriStoreEntries = grouped.tauriStore
    const persistEntries = grouped.persistKv
    const autoActionConfigEntries = grouped.autoActionConfig
    const autoActionUserDataEntries = grouped.autoActionUserData
    const autoActionHistoryEntries = grouped.autoActionHistory

    const manifest: ClientBackupManifest = {
      schemaVersion: BACKUP_SCHEMA_VERSION,
      app: 'vtsuru-client',
      createdAt,
      clientVersion: currentVersion.value,
      encoding: 'superjson',
      modules: {
        tauriStore: { file: MODULE_FILES.tauriStore, count: tauriStoreEntries.length },
        persistKv: { file: MODULE_FILES.persistKv, count: persistEntries.length },
        autoActionConfig: { file: MODULE_FILES.autoActionConfig, count: autoActionConfigEntries.length },
        autoActionUserData: { file: MODULE_FILES.autoActionUserData, count: autoActionUserDataEntries.length },
        autoActionHistory: { file: MODULE_FILES.autoActionHistory, count: autoActionHistoryEntries.length },
      },
    }

    const zip = new JSZip()
    zip.file('manifest.json', JSON.stringify(manifest, null, 2))
    zip.file(MODULE_FILES.tauriStore, stringify(tauriStoreEntries))
    zip.file(MODULE_FILES.persistKv, stringify(persistEntries))
    zip.file(MODULE_FILES.autoActionConfig, stringify(autoActionConfigEntries))
    zip.file(MODULE_FILES.autoActionUserData, stringify(autoActionUserDataEntries))
    zip.file(MODULE_FILES.autoActionHistory, stringify(autoActionHistoryEntries))

    const bytes = await zip.generateAsync({
      type: 'uint8array',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    })

    return {
      bytes,
      fileName: getBackupFilename(createdAt),
      manifest,
    }
  }

  async function pruneOldBackups(directory: string, keepCount: number) {
    const dirEntries = await readDir(directory)
    const backupEntries = dirEntries
      .filter(
        (entry: DirEntry) =>
          entry.isFile && entry.name.startsWith(BACKUP_FILE_PREFIX) && entry.name.endsWith(BACKUP_FILE_SUFFIX),
      )
      .toSorted((left, right) => right.name.localeCompare(left.name))

    for (const staleEntry of backupEntries.slice(Math.max(keepCount, 1))) {
      await remove(await join(directory, staleEntry.name))
    }
  }

  async function createBackup(reason: 'manual' | 'scheduled' = 'manual') {
    await ensureSupported()
    if (busy.value) throw new Error('当前已有备份任务在运行')

    const settingsStore = useSettings()
    const config = settingsStore.settings.backup
    const directory = config.directory.trim()
    if (!directory) throw new Error('请先选择备份目录')

    busy.value = true
    try {
      if (!(await exists(directory))) {
        await mkdir(directory, { recursive: true })
      }

      const backup = await buildBackupArchive()
      const outputPath = await join(directory, backup.fileName)
      await writeFile(outputPath, backup.bytes)
      await pruneOldBackups(directory, config.keepCount)

      settingsStore.settings.backup.lastBackupAt = backup.manifest.createdAt
      settingsStore.settings.backup.lastBackupFile = backup.fileName
      await settingsStore.save()

      return {
        fileName: backup.fileName,
        outputPath,
        createdAt: backup.manifest.createdAt,
        reason,
      }
    } finally {
      busy.value = false
    }
  }

  async function restoreModule(module: ClientBackupModule, moduleEntries: Array<[string, unknown]>) {
    const currentKeys = (await persistedEntries())
      .map(([key]) => String(key))
      .filter((key) => partitionKey(key) === module)
    await persistedRemoveKeys(currentKeys)
    const normalized = moduleEntries.map(([key, value]) => {
      const nextKey = String(key)
      if (module === 'autoActionUserData' && !nextKey.startsWith(AUTO_ACTION_USER_DATA_PREFIX)) {
        return [`${AUTO_ACTION_USER_DATA_PREFIX}${nextKey}`, value] as [string, unknown]
      }
      return [nextKey, value] as [string, unknown]
    })
    if (normalized.length > 0) {
      await persistedSetMany(normalized)
    }
    await persistedFlush()
  }

  async function importBackup(filePath: string, modules: ClientBackupModule[]) {
    await ensureSupported()
    if (busy.value) throw new Error('当前已有备份任务在运行')
    if (modules.length === 0) throw new Error('请至少选择一个导入模块')

    busy.value = true
    try {
      const zip = await parseZip(await readFile(filePath))
      const manifest = await readManifestFromZip(zip)

      for (const module of modules) {
        const payload = await readModulePayload<Array<[string, unknown]>>(zip, manifest, module)
        await restoreModule(module, payload)
      }

      return manifest
    } finally {
      busy.value = false
    }
  }

  return {
    currentVersion,
    isSupported,
    initialized,
    busy,
    init,
    dispose,
    reschedule,
    pickBackupDirectory,
    pickBackupFile,
    createBackup,
    importBackup,
  }
})

if (import.meta.hot) import.meta.hot.accept(acceptHMRUpdate(useClientBackup, import.meta.hot))
