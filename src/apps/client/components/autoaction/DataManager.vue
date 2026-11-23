<script setup lang="ts">
import { Copy, Database, Download, Eye, RotateCw, Search, Trash2, Upload, Zap } from 'lucide-vue-next'
import { computed, onMounted, ref } from 'vue'
import { toast } from 'vue-sonner'

import { useFilePicker } from '@/composables/useFilePicker'
import {
  AUTO_ACTION_USER_DATA_PREFIX,
  persistedEntries,
  persistedRemoveItem,
  persistedRemoveKeys,
  persistedSetJson,
} from '@/shared/storage/persist'
import { Alert, AlertDescription } from '@/shared/ui/alert'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { Empty } from '@/shared/ui/empty'
import { FormField } from '@/shared/ui/form-field'
import { Input } from '@/shared/ui/input'
import { Popconfirm } from '@/shared/ui/popconfirm'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table'
import { Textarea } from '@/shared/ui/textarea'

const RUNTIME_STORAGE_PREFIX = 'autoaction_runtime_'

interface DataItem {
  key: string
  value: any
  valueDisplay: string
  type: string
  scope: 'runtime' | 'persistent'
}

const runtimeSearch = ref('')
const persistentSearch = ref('')

// 详情查看 / 编辑弹窗
const inspectItem = ref<DataItem | null>(null)
const inspectEditText = ref('')
const inspectError = ref<string | undefined>(undefined)
const showInspectDialog = ref(false)

function openInspect(item: DataItem) {
  inspectItem.value = item
  inspectError.value = undefined
  try {
    inspectEditText.value = JSON.stringify(item.value, null, 2)
  } catch {
    inspectEditText.value = item.valueDisplay
  }
  showInspectDialog.value = true
}

async function saveInspectedValue() {
  if (!inspectItem.value) return
  let parsed: unknown
  try {
    parsed = JSON.parse(inspectEditText.value)
  } catch (err) {
    inspectError.value = `JSON 格式错误：${err instanceof Error ? err.message : String(err)}`
    return
  }

  inspectError.value = undefined
  const { key, scope } = inspectItem.value
  if (scope === 'runtime') {
    sessionStorage.setItem(RUNTIME_STORAGE_PREFIX + key, JSON.stringify(parsed))
    fetchRuntimeData()
  } else {
    await persistedSetJson(`${AUTO_ACTION_USER_DATA_PREFIX}${key}`, parsed)
    await fetchPersistentData()
  }
  showInspectDialog.value = false
  toast.success(`已更新键「${key}」的值`)
}

function copyToClipboard(text: string) {
  navigator.clipboard
    .writeText(text)
    .then(() => toast.success('已复制'))
    .catch(() => toast.error('复制失败'))
}

function formatDataValue(value: unknown): { valueDisplay: string; type: string } {
  if (value === null) return { valueDisplay: 'null', type: 'null' }
  if (value === undefined) return { valueDisplay: 'undefined', type: 'undefined' }
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return { valueDisplay: String(value), type: typeof value }
  }
  if (Array.isArray(value)) {
    try {
      return { valueDisplay: JSON.stringify(value), type: `array(${value.length})` }
    } catch {
      return { valueDisplay: `[Array (${value.length})]`, type: 'array' }
    }
  }
  if (typeof value === 'object') {
    try {
      return { valueDisplay: JSON.stringify(value, null, 2), type: 'object' }
    } catch {
      return { valueDisplay: '[Object]', type: 'object' }
    }
  }
  return { valueDisplay: `[${typeof value}]`, type: typeof value }
}

// 持久化数据 (本地存储)
const persistentData = ref<DataItem[]>([])
const persistentLoading = ref(true)

async function fetchPersistentData() {
  persistentLoading.value = true
  try {
    const allEntries = (await persistedEntries()).filter(([key]) => key.startsWith(AUTO_ACTION_USER_DATA_PREFIX))
    persistentData.value = allEntries.map(([rawKey, value]) => {
      const key = rawKey.slice(AUTO_ACTION_USER_DATA_PREFIX.length)
      const { valueDisplay, type } = formatDataValue(value)
      return { key: String(key), value, valueDisplay, type, scope: 'persistent' }
    })
  } catch (error) {
    console.error('[UserData Manager] Error fetching entries:', error)
    toast.error('无法加载用户持久化数据')
    persistentData.value = []
  } finally {
    persistentLoading.value = false
  }
}

const filteredPersistentData = computed(() => {
  if (!persistentSearch.value.trim()) return persistentData.value
  const lower = persistentSearch.value.trim().toLowerCase()
  return persistentData.value.filter(
    (item) => item.key.toLowerCase().includes(lower) || item.valueDisplay.toLowerCase().includes(lower),
  )
})

async function deletePersistentItem(key: string) {
  try {
    await persistedRemoveItem(`${AUTO_ACTION_USER_DATA_PREFIX}${key}`)
    toast.success(`已删除持久化键: ${key}`)
    await fetchPersistentData()
  } catch (error) {
    console.error(`[UserData Manager] Error deleting key ${String(key)}:`, error)
    toast.error(`删除键 ${String(key)} 时出错`)
  }
}

async function clearPersistentData() {
  try {
    const keys = (await persistedEntries())
      .map(([key]) => key)
      .filter((key) => key.startsWith(AUTO_ACTION_USER_DATA_PREFIX))
    await persistedRemoveKeys(keys)
    toast.success('已清除所有用户持久化数据')
    await fetchPersistentData()
  } catch (error) {
    console.error('[UserData Manager] Error clearing data:', error)
    toast.error('清除用户数据时出错')
  }
}

function exportPersistentData() {
  if (persistentData.value.length === 0) {
    toast.warning('暂无持久化数据可导出')
    return
  }
  const obj: Record<string, unknown> = {}
  for (const item of persistentData.value) {
    obj[item.key] = item.value
  }
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `autoaction-userdata-${Date.now()}.json`
  a.click()
  URL.revokeObjectURL(url)
  toast.success(`已导出 ${persistentData.value.length} 条持久化数据`)
}

const { open: openImportPersistent } = useFilePicker({
  accept: '.json',
  onSelect: async ([file]) => {
    try {
      const parsed = JSON.parse(await file.text()) as Record<string, unknown>
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('JSON 必须是键值对对象')
      }
      const entries = Object.entries(parsed)
      for (const [k, v] of entries) {
        await persistedSetJson(`${AUTO_ACTION_USER_DATA_PREFIX}${k}`, v)
      }
      await fetchPersistentData()
      toast.success(`已导入 ${entries.length} 条持久化数据`)
    } catch (err) {
      toast.error(`导入失败: ${err instanceof Error ? err.message : String(err)}`)
    }
  },
})

// 运行时数据 (SessionStorage)
const runtimeData = ref<DataItem[]>([])
const runtimeLoading = ref(true)

function fetchRuntimeData() {
  runtimeLoading.value = true
  try {
    const fetchedData: DataItem[] = []
    for (let i = 0; i < sessionStorage.length; i++) {
      const prefixedKey = sessionStorage.key(i)
      if (prefixedKey && prefixedKey.startsWith(RUNTIME_STORAGE_PREFIX)) {
        const key = prefixedKey.substring(RUNTIME_STORAGE_PREFIX.length)
        const storedValue = sessionStorage.getItem(prefixedKey)
        if (storedValue !== null) {
          try {
            const value = JSON.parse(storedValue)
            const { valueDisplay, type } = formatDataValue(value)
            fetchedData.push({ key, value, valueDisplay, type, scope: 'runtime' })
          } catch {
            fetchedData.push({
              key,
              value: storedValue,
              valueDisplay: `[Parse Error] ${storedValue}`,
              type: 'parse-error',
              scope: 'runtime',
            })
          }
        }
      }
    }
    runtimeData.value = fetchedData
  } catch (error) {
    console.error('[Runtime SessionStorage Manager] Error fetching keys:', error)
    toast.error('无法加载运行时数据')
    runtimeData.value = []
  } finally {
    runtimeLoading.value = false
  }
}

const filteredRuntimeData = computed(() => {
  if (!runtimeSearch.value.trim()) return runtimeData.value
  const lower = runtimeSearch.value.trim().toLowerCase()
  return runtimeData.value.filter(
    (item) => item.key.toLowerCase().includes(lower) || item.valueDisplay.toLowerCase().includes(lower),
  )
})

function deleteRuntimeItem(key: string) {
  try {
    sessionStorage.removeItem(RUNTIME_STORAGE_PREFIX + key)
    toast.success(`已删除运行时键: ${key}`)
    fetchRuntimeData()
  } catch {
    toast.error(`删除键 ${String(key)} 时出错`)
  }
}

function clearRuntimeData() {
  try {
    const keysToRemove: string[] = []
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i)
      if (key && key.startsWith(RUNTIME_STORAGE_PREFIX)) {
        keysToRemove.push(key)
      }
    }
    keysToRemove.forEach((key) => sessionStorage.removeItem(key))
    toast.success('已清除所有运行时数据')
    fetchRuntimeData()
  } catch {
    toast.error('清除运行时数据时出错')
  }
}

onMounted(() => {
  void fetchPersistentData()
  fetchRuntimeData()
})
</script>

<template>
  <div class="space-y-4">
    <!-- 运行时数据 (SessionStorage) -->
    <Card>
      <CardHeader class="p-3 border-b flex flex-row items-center justify-between space-y-0">
        <div class="flex items-center gap-2">
          <Zap class="size-4 text-amber-500" />
          <CardTitle class="text-xs font-semibold">运行时数据 (SessionStorage)</CardTitle>
          <Badge
            variant="warning"
            size="xs"
          >
            临时 · {{ runtimeData.length }} 项
          </Badge>
        </div>
      </CardHeader>

      <CardContent class="p-3 space-y-3">
        <Alert
          size="sm"
          variant="warning"
        >
          <AlertDescription class="m-0">
            显示通过 <code>getData</code> / <code>setData</code> 写入的临时数据，仅在本次运行期间保留，重启后清空。
          </AlertDescription>
        </Alert>

        <div class="flex-between gap-2 flex-wrap">
          <div class="relative w-52">
            <Search class="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
            <Input
              v-model="runtimeSearch"
              placeholder="搜索 Key 或值..."
              class="pl-8 pr-2"
            />
          </div>

          <div class="flex items-center gap-2">
            <Button
              variant="secondary"
              class="gap-1.5"
              :disabled="runtimeLoading"
              @click="fetchRuntimeData"
            >
              <RotateCw
                class="size-3.5"
                :class="{ 'animate-spin': runtimeLoading }"
              />
              刷新
            </Button>
            <Popconfirm
              title="确定清除所有当前会话的运行时数据吗？"
              description="此操作不可逆。"
              @confirm="clearRuntimeData"
            >
              <Button
                variant="outline"
                class="border-destructive/40 text-destructive hover:bg-destructive/10 gap-1.5"
                :disabled="runtimeData.length === 0"
              >
                <Trash2 class="size-3.5" />
                清除所有
              </Button>
            </Popconfirm>
          </div>
        </div>

        <div class="border rounded-md overflow-hidden bg-card max-h-[300px] overflow-y-auto scrollbar-thin">
          <Table>
            <TableHeader class="sticky top-0 bg-card z-10">
              <TableRow>
                <TableHead class="w-48">键 (Key)</TableHead>
                <TableHead class="w-24">类型</TableHead>
                <TableHead>值 (Value)</TableHead>
                <TableHead class="text-right w-24">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <template v-if="filteredRuntimeData.length > 0">
                <TableRow
                  v-for="row in filteredRuntimeData"
                  :key="row.key"
                >
                  <TableCell class="font-mono font-semibold text-primary">
                    {{ row.key }}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="secondary"
                      size="xs"
                      :class="
                        row.type === 'error' || row.type === 'parse-error' ? 'border-destructive text-destructive' : ''
                      "
                    >
                      {{ row.type }}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <pre
                      class="font-mono text-xs max-h-14 overflow-hidden text-ellipsis whitespace-pre-wrap cursor-pointer hover:text-primary"
                      title="点击查看或编辑完整 JSON"
                      @click="openInspect(row)"
                    >{{ row.valueDisplay }}</pre>
                  </TableCell>
                  <TableCell class="text-right">
                    <div class="flex items-center justify-end gap-0.5">
                      <Button
                        size="icon-xs"
                        variant="ghost"
                        title="查看 / 编辑"
                        @click="openInspect(row)"
                      >
                        <Eye class="size-3.5" />
                      </Button>
                      <Button
                        size="icon-xs"
                        variant="ghost"
                        title="复制值"
                        @click="copyToClipboard(row.valueDisplay)"
                      >
                        <Copy class="size-3.5" />
                      </Button>
                      <Popconfirm
                        :title="`确定删除运行时键「${row.key}」吗？`"
                        @confirm="deleteRuntimeItem(row.key)"
                      >
                        <Button
                          size="icon-xs"
                          variant="ghost"
                          class="text-destructive hover:bg-destructive/10"
                          title="删除"
                        >
                          <Trash2 class="size-3.5" />
                        </Button>
                      </Popconfirm>
                    </div>
                  </TableCell>
                </TableRow>
              </template>
              <template v-else>
                <TableRow>
                  <TableCell
                    colspan="4"
                    class="text-center py-6"
                  >
                    <Empty description="当前会话没有运行时数据" />
                  </TableCell>
                </TableRow>
              </template>
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>

    <!-- 持久化数据 (本地存储) -->
    <Card>
      <CardHeader class="p-3 border-b flex flex-row items-center justify-between space-y-0">
        <div class="flex items-center gap-2">
          <Database class="size-4 text-sky-500" />
          <CardTitle class="text-xs font-semibold">持久化数据 (本地存储)</CardTitle>
          <Badge
            variant="outline"
            size="xs"
            class="border-sky-500/40 text-sky-600 dark:text-sky-400 bg-sky-500/10"
          >
            持久 · {{ persistentData.length }} 项
          </Badge>
        </div>
      </CardHeader>

      <CardContent class="p-3 space-y-3">
        <Alert
          size="sm"
          variant="info"
        >
          <AlertDescription class="m-0">
            显示通过 <code>getStorageData</code> / <code>setStorageData</code> 写入的持久化数据（客户端存于本地文件，网页端存于浏览器存储）。
          </AlertDescription>
        </Alert>

        <div class="flex-between gap-2 flex-wrap">
          <div class="relative w-52">
            <Search class="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
            <Input
              v-model="persistentSearch"
              placeholder="搜索 Key 或值..."
              class="pl-8 pr-2"
            />
          </div>

          <div class="flex items-center gap-1.5 flex-wrap">
            <Button
              variant="outline"
              size="xs"
              class="gap-1"
              @click="exportPersistentData"
            >
              <Download class="size-3.5" />
              导出 JSON
            </Button>
            <Button
              variant="outline"
              size="xs"
              class="gap-1"
              @click="openImportPersistent"
            >
              <Upload class="size-3.5" />
              导入 JSON
            </Button>
            <Button
              variant="secondary"
              size="xs"
              class="gap-1"
              :disabled="persistentLoading"
              @click="fetchPersistentData"
            >
              <RotateCw
                class="size-3.5"
                :class="{ 'animate-spin': persistentLoading }"
              />
              刷新
            </Button>
            <Popconfirm
              title="确定清除所有用户持久化数据吗？"
              description="仅清除脚本写入的数据，不会影响自动操作规则配置。"
              @confirm="clearPersistentData"
            >
              <Button
                variant="outline"
                size="xs"
                class="border-destructive/40 text-destructive hover:bg-destructive/10 gap-1"
                :disabled="persistentData.length === 0"
              >
                <Trash2 class="size-3.5" />
                清除所有
              </Button>
            </Popconfirm>
          </div>
        </div>

        <div class="border rounded-md overflow-hidden bg-card max-h-[300px] overflow-y-auto scrollbar-thin">
          <Table>
            <TableHeader class="sticky top-0 bg-card z-10">
              <TableRow>
                <TableHead class="w-48">键 (Key)</TableHead>
                <TableHead class="w-24">类型</TableHead>
                <TableHead>值 (Value)</TableHead>
                <TableHead class="text-right w-24">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <template v-if="filteredPersistentData.length > 0">
                <TableRow
                  v-for="row in filteredPersistentData"
                  :key="row.key"
                >
                  <TableCell class="font-mono font-semibold text-primary">
                    {{ row.key }}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="secondary"
                      size="xs"
                      :class="
                        row.type === 'error' || row.type === 'parse-error' ? 'border-destructive text-destructive' : ''
                      "
                    >
                      {{ row.type }}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <pre
                      class="font-mono text-xs max-h-14 overflow-hidden text-ellipsis whitespace-pre-wrap cursor-pointer hover:text-primary"
                      title="点击查看或编辑完整 JSON"
                      @click="openInspect(row)"
                    >{{ row.valueDisplay }}</pre>
                  </TableCell>
                  <TableCell class="text-right">
                    <div class="flex items-center justify-end gap-0.5">
                      <Button
                        size="icon-xs"
                        variant="ghost"
                        title="查看 / 编辑"
                        @click="openInspect(row)"
                      >
                        <Eye class="size-3.5" />
                      </Button>
                      <Button
                        size="icon-xs"
                        variant="ghost"
                        title="复制值"
                        @click="copyToClipboard(row.valueDisplay)"
                      >
                        <Copy class="size-3.5" />
                      </Button>
                      <Popconfirm
                        :title="`确定删除持久化键「${row.key}」吗？`"
                        @confirm="deletePersistentItem(row.key)"
                      >
                        <Button
                          size="icon-xs"
                          variant="ghost"
                          class="text-destructive hover:bg-destructive/10"
                          title="删除"
                        >
                          <Trash2 class="size-3.5" />
                        </Button>
                      </Popconfirm>
                    </div>
                  </TableCell>
                </TableRow>
              </template>
              <template v-else>
                <TableRow>
                  <TableCell
                    colspan="4"
                    class="text-center py-6"
                  >
                    <Empty description="脚本尚未存储任何持久化数据" />
                  </TableCell>
                </TableRow>
              </template>
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>

    <!-- 查看 / 编辑数据弹窗 -->
    <Dialog v-model:open="showInspectDialog">
      <DialogContent class="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle class="text-sm flex items-center gap-2">
            <span class="font-mono">{{ inspectItem?.key }}</span>
            <Badge
              v-if="inspectItem"
              variant="secondary"
              size="xs"
            >
              {{ inspectItem.scope === 'runtime' ? '运行时' : '持久化' }}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <FormField
          label="JSON 值"
          :error="inspectError"
          description="可直接修改合法 JSON 并保存"
        >
          <Textarea
            v-model="inspectEditText"
            class="font-mono min-h-[200px]"
          />
        </FormField>

        <DialogFooter class="gap-2 pt-2">
          <Button
            variant="ghost"
            class="gap-1.5 mr-auto"
            @click="copyToClipboard(inspectEditText)"
          >
            <Copy class="size-3.5" />
            复制
          </Button>
          <Button
            variant="secondary"
            @click="showInspectDialog = false"
          >
            取消
          </Button>
          <Button @click="saveInspectedValue">保存修改</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
