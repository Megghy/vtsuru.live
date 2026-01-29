<script setup lang="ts">
import type { DataTableColumns } from 'naive-ui'
import { createStore, clear as idbClear, del as idbDel, get as idbGet, keys as idbKeys } from 'idb-keyval'
import { Database20Regular, Delete16Filled, ArrowClockwise16Filled, Copy16Regular, Search16Regular, Flash24Regular } from '@vicons/fluent'
import { NAlert, NButton, NCard, NDataTable, NEmpty, NPopconfirm, NFlex, NTag, NText, useMessage, NInput, NIcon } from 'naive-ui';
import { h, onMounted, ref, computed } from 'vue'

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

const message = useMessage()

// 搜索状态
const runtimeSearch = ref('')
const persistentSearch = ref('')

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text)
    .then(() => message.success('已复制'))
    .catch(() => message.error('复制失败'))
}

// --- 持久化数据 (IndexedDB) 相关状态和函数 ---
const persistentData = ref<DataItem[]>([])
const persistentLoading = ref(true)

async function fetchPersistentData() {
  persistentLoading.value = true
  try {
    const keys = await idbKeys(userDataStore)
    const fetchedData: DataItem[] = []
    for (const key of keys) {
      try {
        const value = await idbGet(key, userDataStore)
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
            valueDisplay = '[Object]' // 不可序列化对象
          }
          type = 'object'
        } else {
          valueDisplay = `[${typeof value}]` // 其他类型
        }

        fetchedData.push({ key: String(key), value, valueDisplay, type })
      } catch (getValueError) {
        console.error(`[UserData IDB Manager] Error getting value for key ${String(key)}:`, getValueError)
        fetchedData.push({ key: String(key), value: undefined, valueDisplay: '[Error Reading Value]', type: 'error' })
      }
    }
    persistentData.value = fetchedData
  } catch (error) {
    console.error('[UserData IDB Manager] Error fetching keys:', error)
    message.error('无法加载用户持久化数据')
    persistentData.value = []
  } finally {
    persistentLoading.value = false
  }
}

const filteredPersistentData = computed(() => {
  if (!persistentSearch.value) return persistentData.value
  const lower = persistentSearch.value.toLowerCase()
  return persistentData.value.filter(item => item.key.toLowerCase().includes(lower))
})

async function deletePersistentItem(key: string) {
  try {
    await idbDel(key, userDataStore)
    message.success(`已删除持久化键: ${key}`)
    await fetchPersistentData()
  } catch (error) {
    console.error(`[UserData IDB Manager] Error deleting key ${String(key)}:`, error)
    message.error(`删除键 ${String(key)} 时出错`)
  }
}

async function clearPersistentData() {
  try {
    await idbClear(userDataStore)
    message.success('已清除所有用户持久化数据')
    await fetchPersistentData()
  } catch (error) {
    console.error('[UserData IDB Manager] Error clearing data:', error)
    message.error('清除用户数据时出错')
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
                valueDisplay = 'null'; type = 'null'
              } else if (value === undefined) {
                valueDisplay = 'undefined'; type = 'undefined'
              } else if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
                valueDisplay = String(value)
              } else if (Array.isArray(value)) {
                valueDisplay = `[Array (${value.length})]`; type = 'array'
              } else if (typeof value === 'object') {
                try {
                  valueDisplay = JSON.stringify(value, null, 2);
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
    message.error('无法加载运行时数据')
    runtimeData.value = []
  } finally {
    runtimeLoading.value = false
  }
}

const filteredRuntimeData = computed(() => {
  if (!runtimeSearch.value) return runtimeData.value
  const lower = runtimeSearch.value.toLowerCase()
  return runtimeData.value.filter(item => item.key.toLowerCase().includes(lower))
})

function deleteRuntimeItem(key: string) {
  try {
    sessionStorage.removeItem(RUNTIME_STORAGE_PREFIX + key)
    message.success(`已删除运行时键: ${key}`)
    fetchRuntimeData()
  } catch (error) {
    console.error(`[Runtime SessionStorage Manager] Error deleting key ${String(key)}:`, error)
    message.error(`删除键 ${String(key)} 时出错`)
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
    keysToRemove.forEach(key => sessionStorage.removeItem(key))
    message.success('已清除所有运行时数据')
    fetchRuntimeData()
  } catch (error) {
    console.error('[Runtime SessionStorage Manager] Error clearing data:', error)
    message.error('清除运行时数据时出错')
  }
}

// --- 表格列定义 (复用) ---
const commonColumns: DataTableColumns<DataItem> = [
  { 
    title: '键 (Key)', 
    key: 'key', 
    width: 200,
    render: row => h(NText, { code: true, style: 'font-weight: bold; color: var(--n-primary-color);' }, { default: () => row.key }) 
  },
  { 
    title: '类型', 
    key: 'type', 
    width: 100, 
    render: row => h(NTag, { size: 'small', type: (row.type === 'error' || row.type === 'parse-error') ? 'error' : 'default', bordered: false }, { default: () => row.type }) 
  },
  { 
    title: '值 (Value)', 
    key: 'valueDisplay', 
    render: row => h('div', { class: 'value-cell' }, [
      h('pre', { class: 'value-content' }, row.valueDisplay),
      h(NButton, { 
        size: 'tiny', 
        quaternary: true, 
        class: 'copy-btn', 
        onClick: () => copyToClipboard(row.valueDisplay) 
      }, { icon: () => h(NIcon, { component: Copy16Regular }) })
    ]) 
  },
]

const persistentColumns: DataTableColumns<DataItem> = [
  ...commonColumns,
  { 
    title: '操作', 
    key: 'actions', 
    width: 80, 
    align: 'center',
    render: row => h(NPopconfirm, { onPositiveClick: () => deletePersistentItem(row.key), positiveText: '确认删除', negativeText: '取消' }, { trigger: () => h(NButton, { size: 'small', type: 'error', quaternary: true }, { icon: () => h(NIcon, { component: Delete16Filled }) }), default: () => `删除持久化键 "${row.key}"?` }) 
  },
]

const runtimeColumns: DataTableColumns<DataItem> = [
  ...commonColumns,
  { 
    title: '操作', 
    key: 'actions', 
    width: 80,
    align: 'center',
    render: row => h(NPopconfirm, { onPositiveClick: () => deleteRuntimeItem(row.key), positiveText: '确认删除', negativeText: '取消' }, { trigger: () => h(NButton, { size: 'small', type: 'error', quaternary: true }, { icon: () => h(NIcon, { component: Delete16Filled }) }), default: () => `删除运行时键 "${row.key}"?` }) 
  },
]

// --- 组件挂载时加载数据 ---
onMounted(() => {
  fetchPersistentData()
  fetchRuntimeData()
})
</script>

<template>
  <NScrollbar class="data-manager-scrollbar">
    <NFlex
      vertical
      size="large"
      class="data-manager"
    >
      <!-- 运行时数据 (SessionStorage) -->
      <NCard
        size="small"
        bordered
        :segmented="{ content: true }"
      >
        <template #header>
          <NFlex align="center">
            <NIcon :component="Flash24Regular" />
            <span>运行时数据 (SessionStorage)</span>
            <NTag size="small" :bordered="false" type="warning">
              临时
            </NTag>
          </NFlex>
        </template>

        <NFlex vertical :size="12">
          <NAlert
            type="warning"
            :bordered="false"
            size="small"
          >
            这里显示通过 <code>getData</code> / <code>setData</code> 管理的数据。仅在程序运行期间保留，重启即逝。
          </NAlert>
          
          <NFlex justify="space-between" align="center">
            <NInput 
              v-model:value="runtimeSearch" 
              placeholder="搜索 Key..." 
              size="small" 
              style="width: 200px" 
              clearable
            >
              <template #prefix>
                <NIcon :component="Search16Regular" />
              </template>
            </NInput>
            
            <NFlex>
              <NButton
                :loading="runtimeLoading"
                size="small"
                @click="fetchRuntimeData"
              >
                <template #icon>
                  <NIcon :component="ArrowClockwise16Filled" />
                </template>
                刷新
              </NButton>
              <NPopconfirm
                positive-text="确认清除"
                negative-text="取消"
                @positive-click="clearRuntimeData"
              >
                <template #trigger>
                  <NButton
                    type="error"
                    ghost
                    size="small"
                    :disabled="runtimeData.length === 0"
                  >
                    <template #icon>
                      <NIcon :component="Delete16Filled" />
                    </template>
                    清除所有
                  </NButton>
                </template>
                确定要清除所有当前会话的运行时数据吗？此操作不可逆！
              </NPopconfirm>
            </NFlex>
          </NFlex>

          <NDataTable
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
              <NEmpty description="当前会话没有运行时数据" />
            </template>
          </NDataTable>
        </NFlex>
      </NCard>

      <!-- 用户持久化数据 (IndexedDB) -->
      <NCard
        size="small"
        bordered
        :segmented="{ content: true }"
      >
        <template #header>
          <NFlex align="center">
            <NIcon :component="Database20Regular" />
            <span>持久化数据 (IndexedDB)</span>
            <NTag size="small" :bordered="false" type="info">
              永久
            </NTag>
          </NFlex>
        </template>

        <NFlex vertical :size="12">
          <NAlert
            type="info"
            :bordered="false"
            size="small"
          >
            这里显示通过 <code>getStorageData</code> / <code>setStorageData</code> 管理的数据。程序关闭后依然保留。
          </NAlert>
          
          <NFlex justify="space-between" align="center">
            <NInput 
              v-model:value="persistentSearch" 
              placeholder="搜索 Key..." 
              size="small" 
              style="width: 200px" 
              clearable
            >
              <template #prefix>
                <NIcon :component="Search16Regular" />
              </template>
            </NInput>

            <NFlex>
              <NButton
                :loading="persistentLoading"
                size="small"
                @click="fetchPersistentData"
              >
                <template #icon>
                  <NIcon :component="ArrowClockwise16Filled" />
                </template>
                刷新
              </NButton>
              <NPopconfirm
                positive-text="确认清除"
                negative-text="取消"
                @positive-click="clearPersistentData"
              >
                <template #trigger>
                  <NButton
                    type="error"
                    ghost
                    size="small"
                    :disabled="persistentData.length === 0"
                  >
                    <template #icon>
                      <NIcon :component="Delete16Filled" />
                    </template>
                    清除所有
                  </NButton>
                </template>
                确定要清除所有由自动操作脚本存储的用户数据吗？应用配置不会被清除。此操作不可逆！
              </NPopconfirm>
            </NFlex>
          </NFlex>
          
          <NDataTable
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
              <NEmpty description="脚本尚未存储任何持久化数据" />
            </template>
          </NDataTable>
        </NFlex>
      </NCard>
    </NFlex>
  </NScrollbar>
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
  background-color: var(--n-color-embedded);
  padding: 4px 8px;
  border-radius: 4px;
  max-height: 100px;
}

:deep(.copy-btn) {
  position: absolute;
  top: 0;
  right: 0;
  opacity: 0;
  transition: opacity 0.2s;
  background-color: var(--n-color-embedded);
}

:deep(.value-cell:hover .copy-btn) {
  opacity: 1;
}

code {
  background-color: var(--n-code-color);
  padding: 2px 4px;
  border-radius: var(--n-border-radius);
  font-family: monospace;
  font-size: 13px;
}
</style>
