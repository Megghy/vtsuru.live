<script setup lang="ts">
import {
  ArrowClockwise16Filled,
  Copy16Regular,
  Database20Regular,
  Delete16Filled,
  Flash24Regular,
  Search16Regular,
} from '@vicons/fluent'
import { clear as idbClear, createStore, del as idbDel, entries as idbEntries } from 'idb-keyval'
import { computed, onMounted, ref } from 'vue'
import { toast } from 'vue-sonner'

import { Alert, AlertDescription } from '@/shared/ui/alert'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { Empty } from '@/shared/ui/empty'
import { Input } from '@/shared/ui/input'
import { Popconfirm } from '@/shared/ui/popconfirm'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/ui/table'

const USER_DATA_DB_NAME = 'AutoActionUserDataDB'
const USER_DATA_STORE_NAME = 'userData'
const userDataStore = createStore(USER_DATA_DB_NAME, USER_DATA_STORE_NAME)

const RUNTIME_STORAGE_PREFIX = 'autoaction_runtime_'

interface DataItem {
  key: string
  value: any
  valueDisplay: string
  type: string
}

const runtimeSearch = ref('')
const persistentSearch = ref('')

function copyToClipboard(text: string) {
  navigator.clipboard
    .writeText(text)
    .then(() => toast.success('已复制'))
    .catch(() => toast.error('复制失败'))
}

// 持久化数据 (IndexedDB)
const persistentData = ref<DataItem[]>([])
const persistentLoading = ref(true)

async function fetchPersistentData() {
  persistentLoading.value = true
  try {
    const allEntries = await idbEntries(userDataStore)
    persistentData.value = allEntries.map(([key, value]) => {
      let valueDisplay = ''
      let type: string = typeof value

      if (value === null) {
        valueDisplay = 'null'
        type = 'null'
      } else if (value === undefined) {
        valueDisplay = 'undefined'
        type = 'undefined'
      } else if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        valueDisplay = String(value)
      } else if (Array.isArray(value)) {
        valueDisplay = `[Array (${value.length})]`
        type = 'array'
      } else if (typeof value === 'object') {
        try {
          valueDisplay = JSON.stringify(value, null, 2)
        } catch {
          valueDisplay = '[Object]'
        }
        type = 'object'
      } else {
        valueDisplay = `[${typeof value}]`
      }

      return { key: String(key), value, valueDisplay, type }
    })
  } catch (error) {
    console.error('[UserData IDB Manager] Error fetching entries:', error)
    toast.error('无法加载用户持久化数据')
    persistentData.value = []
  } finally {
    persistentLoading.value = false
  }
}

const filteredPersistentData = computed(() => {
  if (!persistentSearch.value) return persistentData.value
  const lower = persistentSearch.value.toLowerCase()
  return persistentData.value.filter((item) => item.key.toLowerCase().includes(lower))
})

async function deletePersistentItem(key: string) {
  try {
    await idbDel(key, userDataStore)
    toast.success(`已删除持久化键: ${key}`)
    await fetchPersistentData()
  } catch (error) {
    console.error(`[UserData IDB Manager] Error deleting key ${String(key)}:`, error)
    toast.error(`删除键 ${String(key)} 时出错`)
  }
}

async function clearPersistentData() {
  try {
    await idbClear(userDataStore)
    toast.success('已清除所有用户持久化数据')
    await fetchPersistentData()
  } catch (error) {
    console.error('[UserData IDB Manager] Error clearing data:', error)
    toast.error('清除用户数据时出错')
  }
}

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
        try {
          const storedValue = sessionStorage.getItem(prefixedKey)
          let value: any
          let valueDisplay = ''
          let type: string = 'unknown'

          if (storedValue !== null) {
            try {
              value = JSON.parse(storedValue)
              type = typeof value
              if (value === null) {
                valueDisplay = 'null'
                type = 'null'
              } else if (value === undefined) {
                valueDisplay = 'undefined'
                type = 'undefined'
              } else if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
                valueDisplay = String(value)
              } else if (Array.isArray(value)) {
                valueDisplay = `[Array (${value.length})]`
                type = 'array'
              } else if (typeof value === 'object') {
                try {
                  valueDisplay = JSON.stringify(value, null, 2)
                } catch {
                  valueDisplay = '[Object]'
                }
                type = 'object'
              } else {
                valueDisplay = `[${typeof value}]`
              }
            } catch {
              value = storedValue
              valueDisplay = `[Parse Error] ${storedValue}`
              type = 'parse-error'
            }
          } else {
            valueDisplay = '[Error Reading Value]'
            type = 'error'
          }
          fetchedData.push({ key, value, valueDisplay, type })
        } catch {
          fetchedData.push({ key, value: undefined, valueDisplay: '[Error Processing Key]', type: 'error' })
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
  if (!runtimeSearch.value) return runtimeData.value
  const lower = runtimeSearch.value.toLowerCase()
  return runtimeData.value.filter((item) => item.key.toLowerCase().includes(lower))
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
  fetchPersistentData()
  fetchRuntimeData()
})
</script>

<template>
  <div class="space-y-4">
    <!-- 运行时数据 (SessionStorage) -->
    <Card class="border bg-card">
      <CardHeader class="p-3 pb-2 border-b flex flex-row items-center justify-between">
        <div class="flex items-center gap-2">
          <Flash24Regular class="size-4 text-amber-500" />
          <CardTitle class="text-sm font-semibold">运行时数据 (SessionStorage)</CardTitle>
          <Badge variant="outline" class="text-[10px] h-4.5 px-1.5 border-amber-500/40 text-amber-600 bg-amber-500/10">
            临时
          </Badge>
        </div>
      </CardHeader>

      <CardContent class="p-3 space-y-3">
        <Alert class="py-2 px-2.5 border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400">
          <AlertDescription class="text-xs m-0">
            这里显示通过 <code>getData</code> / <code>setData</code> 管理的数据。仅在程序运行期间保留，重启即逝。
          </AlertDescription>
        </Alert>

        <div class="flex items-center justify-between gap-2 flex-wrap">
          <div class="relative w-[200px]">
            <Search16Regular class="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <Input
              v-model="runtimeSearch"
              placeholder="搜索 Key..."
              class="h-8 text-xs pl-8 pr-2"
            />
          </div>

          <div class="flex items-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              class="h-7 text-xs gap-1"
              :disabled="runtimeLoading"
              @click="fetchRuntimeData"
            >
              <ArrowClockwise16Filled class="size-3.5" :class="{ 'animate-spin': runtimeLoading }" />
              刷新
            </Button>
            <Popconfirm
              title="确认清除"
              @positive-click="clearRuntimeData"
            >
              <template #trigger>
                <Button
                  size="sm"
                  variant="outline"
                  class="h-7 text-xs border-destructive/40 text-destructive hover:bg-destructive/10 gap-1"
                  :disabled="runtimeData.length === 0"
                >
                  <Delete16Filled class="size-3.5" />
                  清除所有
                </Button>
              </template>
              确定要清除所有当前会话的运行时数据吗？此操作不可逆！
            </Popconfirm>
          </div>
        </div>

        <div class="border rounded-md overflow-hidden bg-card max-h-[300px] overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead class="text-xs w-[200px]">键 (Key)</TableHead>
                <TableHead class="text-xs w-[100px]">类型</TableHead>
                <TableHead class="text-xs">值 (Value)</TableHead>
                <TableHead class="text-xs text-center w-[80px]">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <template v-if="filteredRuntimeData.length > 0">
                <TableRow
                  v-for="row in filteredRuntimeData"
                  :key="row.key"
                >
                  <TableCell class="text-xs font-mono font-bold text-primary">
                    {{ row.key }}
                  </TableCell>
                  <TableCell class="text-xs">
                    <Badge
                      variant="secondary"
                      class="text-[10px] h-4.5 px-1.5"
                      :class="row.type === 'error' || row.type === 'parse-error' ? 'border-destructive text-destructive' : ''"
                    >
                      {{ row.type }}
                    </Badge>
                  </TableCell>
                  <TableCell class="text-xs">
                    <div class="flex items-center justify-between gap-2">
                      <pre class="font-mono text-xs max-h-16 overflow-hidden text-ellipsis whitespace-pre-wrap flex-1">{{ row.valueDisplay }}</pre>
                      <Button
                        size="xs"
                        variant="ghost"
                        class="h-6 w-6 p-0 text-muted-foreground hover:text-foreground shrink-0"
                        @click="copyToClipboard(row.valueDisplay)"
                      >
                        <Copy16Regular class="size-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell class="text-center">
                    <Popconfirm
                      title="确认删除"
                      @positive-click="deleteRuntimeItem(row.key)"
                    >
                      <template #trigger>
                        <Button
                          size="xs"
                          variant="ghost"
                          class="h-6 w-6 p-0 text-destructive hover:bg-destructive/10"
                        >
                          <Delete16Filled class="size-3.5" />
                        </Button>
                      </template>
                      删除运行时键 "{{ row.key }}"?
                    </Popconfirm>
                  </TableCell>
                </TableRow>
              </template>
              <template v-else>
                <TableRow>
                  <TableCell colspan="4" class="text-center py-6">
                    <Empty description="当前会话没有运行时数据" />
                  </TableCell>
                </TableRow>
              </template>
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>

    <!-- 持久化数据 (IndexedDB) -->
    <Card class="border bg-card">
      <CardHeader class="p-3 pb-2 border-b flex flex-row items-center justify-between">
        <div class="flex items-center gap-2">
          <Database20Regular class="size-4 text-sky-500" />
          <CardTitle class="text-sm font-semibold">持久化数据 (IndexedDB)</CardTitle>
          <Badge variant="outline" class="text-[10px] h-4.5 px-1.5 border-sky-500/40 text-sky-600 bg-sky-500/10">
            永久
          </Badge>
        </div>
      </CardHeader>

      <CardContent class="p-3 space-y-3">
        <Alert class="py-2 px-2.5 border-sky-500/20 bg-sky-500/10 text-sky-600 dark:text-sky-400">
          <AlertDescription class="text-xs m-0">
            这里显示通过 <code>getStorageData</code> / <code>setStorageData</code> 管理的数据。程序关闭后依然保留。
          </AlertDescription>
        </Alert>

        <div class="flex items-center justify-between gap-2 flex-wrap">
          <div class="relative w-[200px]">
            <Search16Regular class="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <Input
              v-model="persistentSearch"
              placeholder="搜索 Key..."
              class="h-8 text-xs pl-8 pr-2"
            />
          </div>

          <div class="flex items-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              class="h-7 text-xs gap-1"
              :disabled="persistentLoading"
              @click="fetchPersistentData"
            >
              <ArrowClockwise16Filled class="size-3.5" :class="{ 'animate-spin': persistentLoading }" />
              刷新
            </Button>
            <Popconfirm
              title="确认清除"
              @positive-click="clearPersistentData"
            >
              <template #trigger>
                <Button
                  size="sm"
                  variant="outline"
                  class="h-7 text-xs border-destructive/40 text-destructive hover:bg-destructive/10 gap-1"
                  :disabled="persistentData.length === 0"
                >
                  <Delete16Filled class="size-3.5" />
                  清除所有
                </Button>
              </template>
              确定要清除所有由自动操作脚本存储的用户数据吗？应用配置不会被清除。此操作不可逆！
            </Popconfirm>
          </div>
        </div>

        <div class="border rounded-md overflow-hidden bg-card max-h-[300px] overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead class="text-xs w-[200px]">键 (Key)</TableHead>
                <TableHead class="text-xs w-[100px]">类型</TableHead>
                <TableHead class="text-xs">值 (Value)</TableHead>
                <TableHead class="text-xs text-center w-[80px]">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <template v-if="filteredPersistentData.length > 0">
                <TableRow
                  v-for="row in filteredPersistentData"
                  :key="row.key"
                >
                  <TableCell class="text-xs font-mono font-bold text-primary">
                    {{ row.key }}
                  </TableCell>
                  <TableCell class="text-xs">
                    <Badge
                      variant="secondary"
                      class="text-[10px] h-4.5 px-1.5"
                      :class="row.type === 'error' || row.type === 'parse-error' ? 'border-destructive text-destructive' : ''"
                    >
                      {{ row.type }}
                    </Badge>
                  </TableCell>
                  <TableCell class="text-xs">
                    <div class="flex items-center justify-between gap-2">
                      <pre class="font-mono text-xs max-h-16 overflow-hidden text-ellipsis whitespace-pre-wrap flex-1">{{ row.valueDisplay }}</pre>
                      <Button
                        size="xs"
                        variant="ghost"
                        class="h-6 w-6 p-0 text-muted-foreground hover:text-foreground shrink-0"
                        @click="copyToClipboard(row.valueDisplay)"
                      >
                        <Copy16Regular class="size-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell class="text-center">
                    <Popconfirm
                      title="确认删除"
                      @positive-click="deletePersistentItem(row.key)"
                    >
                      <template #trigger>
                        <Button
                          size="xs"
                          variant="ghost"
                          class="h-6 w-6 p-0 text-destructive hover:bg-destructive/10"
                        >
                          <Delete16Filled class="size-3.5" />
                        </Button>
                      </template>
                      删除持久化键 "{{ row.key }}"?
                    </Popconfirm>
                  </TableCell>
                </TableRow>
              </template>
              <template v-else>
                <TableRow>
                  <TableCell colspan="4" class="text-center py-6">
                    <Empty description="脚本尚未存储任何持久化数据" />
                  </TableCell>
                </TableRow>
              </template>
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  </div>
</template>
