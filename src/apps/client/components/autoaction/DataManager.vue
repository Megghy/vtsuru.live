<script setup lang="ts">
import type { DataTableColumns } from 'naive-ui'
import { createStore, clear as idbClear, del as idbDel, get as idbGet, keys as idbKeys } from 'idb-keyval'
import { NAlert, NButton, NCard, NDataTable, NDivider, NEmpty, NPopconfirm, NSpace, NSpin, NTag, NText, useMessage } from 'naive-ui'
import { h, onMounted, ref } from 'vue'

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

// --- 持久化数据 (IndexedDB) 相关状态和函数 ---
const persistentData = ref<DataItem[]>([])
const persistentLoading = ref(true)
const message = useMessage()

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
            valueDisplay = JSON.stringify(value, null, 2) // 尝试格式化
            if (valueDisplay.length > 200) {
              valueDisplay = `[Object]` // 太长则简化
            }
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
                  valueDisplay = JSON.stringify(value, null, 2); if (valueDisplay.length > 200) {
                    valueDisplay = `[Object]`
                  }
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
            // 理论上不应该发生，因为 getItem(key(i)) 应该有值
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
  { title: '键 (Key)', key: 'key', resizable: true, render: row => h(NText, { code: true }, { default: () => row.key }) },
  { title: '类型 (Type)', key: 'type', width: 120, render: row => h(NTag, { size: 'small', type: (row.type === 'error' || row.type === 'parse-error') ? 'error' : 'default', bordered: false }, { default: () => row.type }) },
  { title: '值 (Value)', key: 'valueDisplay', resizable: true, ellipsis: { tooltip: true }, render: row => h('pre', row.valueDisplay) },
]

const persistentColumns: DataTableColumns<DataItem> = [
  ...commonColumns,
  { title: '操作', key: 'actions', width: 100, render: row => h(NPopconfirm, { onPositiveClick: () => deletePersistentItem(row.key), positiveText: '确认删除', negativeText: '取消' }, { trigger: () => h(NButton, { size: 'small', type: 'error', ghost: true }, { default: () => '删除' }), default: () => `删除持久化键 "${row.key}"?` }) },
]

const runtimeColumns: DataTableColumns<DataItem> = [
  ...commonColumns,
  { title: '操作', key: 'actions', width: 100, render: row => h(NPopconfirm, { onPositiveClick: () => deleteRuntimeItem(row.key), positiveText: '确认删除', negativeText: '取消' }, { trigger: () => h(NButton, { size: 'small', type: 'error', ghost: true }, { default: () => '删除' }), default: () => `删除运行时键 "${row.key}"?` }) },
]

// --- 组件挂载时加载数据 ---
onMounted(() => {
  fetchPersistentData()
  fetchRuntimeData()
})
</script>

<template>
  <NSpace
    vertical
    size="large"
  >
    <!-- 运行时数据 (SessionStorage) -->
    <NCard
      title="运行时数据"
      size="small"
      bordered
      :segmented="{ content: true }"
    >
      <NAlert
        type="warning"
        :bordered="false"
        style="margin-bottom: 16px;"
      >
        这里显示的是脚本通过 <code>getData</code>, <code>setData</code> 管理的数据。
        这些数据仅在程序运行期间保留，程序关闭后将丢失。
      </NAlert>
      <NSpace
        justify="end"
        style="margin-bottom: 16px;"
      >
        <NButton
          :loading="runtimeLoading"
          size="small"
          @click="fetchRuntimeData"
        >
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
              size="small"
              :disabled="runtimeData.length === 0"
            >
              清除所有运行时数据
            </NButton>
          </template>
          确定要清除所有当前会话的运行时数据吗？此操作不可逆！
        </NPopconfirm>
      </NSpace>
      <NSpin :show="runtimeLoading">
        <NDataTable
          :columns="runtimeColumns"
          :data="runtimeData"
          :bordered="false"
          :single-line="false"
          size="small"
          max-height="35vh"
          virtual-scroll
        >
          <template #empty>
            <NEmpty description="当前会话没有运行时数据" />
          </template>
        </NDataTable>
      </NSpin>
    </NCard>

    <NDivider />

    <!-- 用户持久化数据 (IndexedDB) -->
    <NCard
      title="持久化数据"
      size="small"
      bordered
      :segmented="{ content: true }"
    >
      <NAlert
        type="info"
        :bordered="false"
        style="margin-bottom: 16px;"
      >
        这是持久化数据，程序关闭后不会丢失。
      </NAlert>
      <NSpace
        justify="end"
        style="margin-bottom: 16px;"
      >
        <NButton
          :loading="persistentLoading"
          size="small"
          @click="fetchPersistentData"
        >
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
              size="small"
              :disabled="persistentData.length === 0"
            >
              清除所有用户数据
            </NButton>
          </template>
          确定要清除所有由自动操作脚本存储的用户数据吗？应用配置不会被清除。此操作不可逆！
        </NPopconfirm>
      </NSpace>
      <NSpin :show="persistentLoading">
        <NDataTable
          :columns="persistentColumns"
          :data="persistentData"
          :bordered="false"
          :single-line="false"
          size="small"
          max-height="35vh"
          virtual-scroll
        >
          <template #empty>
            <NEmpty description="脚本尚未存储任何持久化数据" />
          </template>
        </NDataTable>
      </NSpin>
    </NCard>
  </NSpace>
</template>

<style scoped>
pre {
  white-space: pre-wrap;
  word-break: break-all;
  margin: 0;
  font-family: inherit; /* 继承表格字体 */
  font-size: inherit; /* 继承表格字体大小 */
}
code {
  background-color: var(--n-code-color);
  padding: 2px 4px;
  border-radius: var(--n-border-radius);
  font-family: monospace;
  font-size: 13px;
}
</style>
