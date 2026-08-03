<script setup lang="ts">
const Copy16Regular = 'i-lucide-circle'
const Delete16Filled = 'i-lucide-circle'
import { createStore, clear as idbClear, del as idbDel, entries as idbEntries } from 'idb-keyval'
import { h, onMounted, ref, computed, resolveComponent } from 'vue'

// --- 定义用户持久化数据的自定义存储区 (与 utils.ts 中保持一致) ---
const USER_DATA_DB_NAME = 'AutoActionUserDataDB'
const USER_DATA_STORE_NAME = 'userData'
const userDataStore = createStore(USER_DATA_DB_NAME, USER_DATA_STORE_NAME)
// ------------------------------------------------------------

// --- 运行时数据配置 (SessionStorage) ---
const RUNTIME_STORAGE_PREFIX = 'autoaction_runtime_'
// ------------------------------------

interface DataItem {
  key: string // Key 统一为 string
  value: any
  valueDisplay: string
  type: string
}

const toast = useToast()
const feedback = (color: 'success' | 'error' | 'warning' | 'info', title: string) => {
  toast.add({ title, color })
}

// 搜索状态
const runtimeSearch = ref('')
const persistentSearch = ref('')

function copyToClipboard(text: string) {
  navigator.clipboard
    .writeText(text)
    .then(() => feedback('success', '已复制'))
    .catch(() => feedback('error', '复制失败'))
}

// --- 持久化数据 (IndexedDB) 相关状态和函数 ---
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
    feedback('error', '无法加载用户持久化数据')
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
    feedback('success', `已删除持久化键: ${key}`)
    await fetchPersistentData()
  } catch (error) {
    console.error(`[UserData IDB Manager] Error deleting key ${String(key)}:`, error)
    feedback('error', `删除键 ${String(key)} 时出错`)
  }
}

async function clearPersistentData() {
  try {
    await idbClear(userDataStore)
    feedback('success', '已清除所有用户持久化数据')
    await fetchPersistentData()
  } catch (error) {
    console.error('[UserData IDB Manager] Error clearing data:', error)
    feedback('error', '清除用户数据时出错')
  }
}

// --- 运行时数据 (SessionStorage) 相关状态和函数 ---
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
            } catch (parseError) {
              console.error(`[Runtime SessionStorage Manager] Error parsing key '${key}':`, parseError)
              value = storedValue // 解析失败则显示原始字符串
              valueDisplay = `[Parse Error] ${storedValue}`
              type = 'parse-error'
            }
          } else {
            valueDisplay = '[Error Reading Value]'
            type = 'error'
          }
          fetchedData.push({ key, value, valueDisplay, type })
        } catch (error) {
          console.error(`[Runtime SessionStorage Manager] Error processing key '${key}':`, error)
          fetchedData.push({ key, value: undefined, valueDisplay: '[Error Processing Key]', type: 'error' })
        }
      }
    }
    runtimeData.value = fetchedData
  } catch (error) {
    console.error('[Runtime SessionStorage Manager] Error fetching keys:', error)
    feedback('error', '无法加载运行时数据')
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
    feedback('success', `已删除运行时键: ${key}`)
    fetchRuntimeData()
  } catch (error) {
    console.error(`[Runtime SessionStorage Manager] Error deleting key ${String(key)}:`, error)
    feedback('error', `删除键 ${String(key)} 时出错`)
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
    feedback('success', '已清除所有运行时数据')
    fetchRuntimeData()
  } catch (error) {
    console.error('[Runtime SessionStorage Manager] Error clearing data:', error)
    feedback('error', '清除运行时数据时出错')
  }
}

// --- 表格列定义 (复用) ---
const commonColumns: any[] = [
  {
    title: '键 (Key)',
    key: 'key',
    width: 200,
    render: (row) =>
      h('span', { code: true, style: 'font-weight: bold; color: var(--vtsuru-primary);' }, { default: () => row.key }),
  },
  {
    title: '类型',
    key: 'type',
    width: 100,
    render: (row) =>
      h(
        resolveComponent('UBadge'),
        {
          size: 'small',
          type: row.type === 'error' || row.type === 'parse-error' ? 'error' : 'default',
          bordered: false,
        },
        { default: () => row.type },
      ),
  },
  {
    title: '值 (Value)',
    key: 'valueDisplay',
    render: (row) =>
      h('div', { class: 'value-cell' }, [
        h('pre', { class: 'value-content' }, row.valueDisplay),
        h(
          resolveComponent('UButton'),
          {
            size: 'tiny',
            quaternary: true,
            class: 'copy-btn',
            onClick: () => copyToClipboard(row.valueDisplay),
          },
          { icon: () => h(resolveComponent('UIcon'), { component: Copy16Regular }) },
        ),
      ]),
  },
]

const persistentColumns: any[] = [
  ...commonColumns,
  {
    title: '操作',
    key: 'actions',
    width: 80,
    align: 'center',
    render: (row) =>
      h(
        resolveComponent('UPopover'),
        { onPositiveClick: () => deletePersistentItem(row.key), positiveText: '确认删除', negativeText: '取消' },
        {
          trigger: () =>
            h(
              resolveComponent('UButton'),
              { size: 'small', type: 'error', quaternary: true },
              { icon: () => h(resolveComponent('UIcon'), { component: Delete16Filled }) },
            ),
          default: () => `删除持久化键 "${row.key}"?`,
        },
      ),
  },
]

const runtimeColumns: any[] = [
  ...commonColumns,
  {
    title: '操作',
    key: 'actions',
    width: 80,
    align: 'center',
    render: (row) =>
      h(
        resolveComponent('UPopover'),
        { onPositiveClick: () => deleteRuntimeItem(row.key), positiveText: '确认删除', negativeText: '取消' },
        {
          trigger: () =>
            h(
              resolveComponent('UButton'),
              { size: 'small', type: 'error', quaternary: true },
              { icon: () => h(resolveComponent('UIcon'), { component: Delete16Filled }) },
            ),
          default: () => `删除运行时键 "${row.key}"?`,
        },
      ),
  },
]

// --- 组件挂载时加载数据 ---
onMounted(() => {
  fetchPersistentData()
  fetchRuntimeData()
})
</script>

<template>
  <div class="data-manager-scrollbar">
    <div
      vertical
      :size="16"
      class="data-manager"
    >
      <!-- 运行时数据 (SessionStorage) -->
      <UCard
        size="small"
        bordered
        :segmented="{ content: true }"
      >
        <template #header>
          <div align="center">
            <UIcon name="i-lucide-circle" />
            <span>运行时数据 (SessionStorage)</span>
            <UBadge
              size="small"
              :bordered="false"
              type="warning"
            >
              临时
            </UBadge>
          </div>
        </template>

        <div
          vertical
          :size="12"
        >
          <UAlert
            type="warning"
            :bordered="false"
            size="small"
          >
            这里显示通过 <code>getData</code> / <code>setData</code> 管理的数据。仅在程序运行期间保留，重启即逝。
          </UAlert>

          <div
            justify="space-between"
            align="center"
          >
            <UInput
              v-model="runtimeSearch"
              placeholder="搜索 Key..."
              size="small"
              style="width: 200px"
              clearable
            >
              <template #leading>
                <UIcon name="i-lucide-circle" />
              </template>
            </UInput>

            <div>
              <UButton
                :loading="runtimeLoading"
                size="small"
                @click="fetchRuntimeData"
              >
                <template #leading>
                  <UIcon name="i-lucide-circle" />
                </template>
                刷新
              </UButton>
              <UPopover>
                <UButton
                  color="error"
                  ghost
                  size="sm"
                  :disabled="runtimeData.length === 0"
                >
                  <template #leading>
                    <UIcon name="i-lucide-circle" />
                  </template>
                  清除所有
                </UButton>
                <template #content="{ close }">
                  <div class="space-y-3 p-3">
                    <div>确定要清除所有当前会话的运行时数据吗？此操作不可逆！</div>
                    <div class="flex justify-end gap-2">
                      <UButton
                        size="xs"
                        color="neutral"
                        variant="ghost"
                        @click="close"
                        >取消</UButton
                      >
                      <UButton
                        size="xs"
                        color="error"
                        @click="(close(), clearRuntimeData)"
                        >确认清除</UButton
                      >
                    </div>
                  </div>
                </template>
              </UPopover>
            </div>
          </div>

          <UTable
            :columns="runtimeColumns"
            :data="filteredRuntimeData"
            :bordered="false"
            :single-line="false"
            size="small"
            max-height="300"
            virtual-scroll
            :loading="runtimeLoading"
            scroll-x="800"
          >
            <template #empty>
              <UEmpty description="当前会话没有运行时数据" />
            </template>
          </UTable>
        </div>
      </UCard>

      <!-- 用户持久化数据 (IndexedDB) -->
      <UCard
        size="small"
        bordered
        :segmented="{ content: true }"
      >
        <template #header>
          <div align="center">
            <UIcon name="i-lucide-circle" />
            <span>持久化数据 (IndexedDB)</span>
            <UBadge
              size="small"
              :bordered="false"
              type="info"
            >
              永久
            </UBadge>
          </div>
        </template>

        <div
          vertical
          :size="12"
        >
          <UAlert
            type="info"
            :bordered="false"
            size="small"
          >
            这里显示通过 <code>getStorageData</code> / <code>setStorageData</code> 管理的数据。程序关闭后依然保留。
          </UAlert>

          <div
            justify="space-between"
            align="center"
          >
            <UInput
              v-model="persistentSearch"
              placeholder="搜索 Key..."
              size="small"
              style="width: 200px"
              clearable
            >
              <template #leading>
                <UIcon name="i-lucide-circle" />
              </template>
            </UInput>

            <div>
              <UButton
                :loading="persistentLoading"
                size="small"
                @click="fetchPersistentData"
              >
                <template #leading>
                  <UIcon name="i-lucide-circle" />
                </template>
                刷新
              </UButton>
              <UPopover>
                <UButton
                  color="error"
                  ghost
                  size="sm"
                  :disabled="persistentData.length === 0"
                >
                  <template #leading>
                    <UIcon name="i-lucide-circle" />
                  </template>
                  清除所有
                </UButton>
                <template #content="{ close }">
                  <div class="space-y-3 p-3">
                    <div>确定要清除所有由自动操作脚本存储的用户数据吗？应用配置不会被清除。此操作不可逆！</div>
                    <div class="flex justify-end gap-2">
                      <UButton
                        size="xs"
                        color="neutral"
                        variant="ghost"
                        @click="close"
                        >取消</UButton
                      >
                      <UButton
                        size="xs"
                        color="error"
                        @click="(close(), clearPersistentData)"
                        >确认清除</UButton
                      >
                    </div>
                  </div>
                </template>
              </UPopover>
            </div>
          </div>

          <UTable
            :columns="persistentColumns"
            :data="filteredPersistentData"
            :bordered="false"
            :single-line="false"
            size="small"
            max-height="300"
            virtual-scroll
            :loading="persistentLoading"
            scroll-x="800"
          >
            <template #empty>
              <UEmpty description="脚本尚未存储任何持久化数据" />
            </template>
          </UTable>
        </div>
      </UCard>
    </div>
  </div>
</template>

<style scoped>
.data-manager-scrollbar {
  height: 100%;
}

.data-manager {
  padding-right: 12px;
}

:deep(.value-cell) {
  position: relative;
  width: 100%;
}

:deep(.value-content) {
  white-space: pre-wrap;
  word-break: break-all;
  margin: 0;
  font-family: monospace;
  font-size: 12px;
  background-color: var(--vtsuru-bg-inset);
  padding: 4px 8px;
  border-radius: var(--vtsuru-radius);
  max-height: 100px;
}

:deep(.copy-btn) {
  position: absolute;
  top: 0;
  right: 0;
  opacity: 0;
  transition: opacity 0.2s;
  background-color: var(--vtsuru-bg-inset);
}

:deep(.value-cell:hover .copy-btn) {
  opacity: 1;
}

code {
  background-color: var(--vtsuru-bg-inset);
  padding: 2px 4px;
  border-radius: var(--vtsuru-radius);
  font-family: monospace;
  font-size: 13px;
}
</style>
