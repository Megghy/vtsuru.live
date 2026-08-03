<script lang="ts" setup>
import { computed, onMounted, ref, watch } from 'vue'

import type { UserInfo } from '@/api/api-models'
import { showInfoToast, showSuccessToast } from '@/shared/services/toast'
import type { ExtractConfigData } from '@/shared/types/VTsuruConfigTypes'
import { defineTemplateConfig } from '@/shared/types/VTsuruConfigTypes'

// --- Props ---
const props = defineProps<{
  config: ExampleConfigType // 从父组件接收的配置
  userInfo?: UserInfo
  biliInfo?: any
  refreshSignal?: number // 接收刷新信号
}>()

const Config = defineTemplateConfig([
  {
    name: '组件标题',
    key: 'title',
    type: 'string',
    default: '我的示例 OBS 组件',
    description: '显示在组件顶部的标题文字。',
  },
  {
    name: '提示类型',
    key: 'alertType',
    type: 'select',
    options: [
      { label: '信息 (Info)', value: 'info' },
      { label: '成功 (Success)', value: 'success' },
      { label: '警告 (Warning)', value: 'warning' },
      { label: '错误 (Error)', value: 'error' },
    ],
    default: 'info',
    description: '组件内 NAlert 提示框的样式类型。',
  },
  {
    name: '提示标题',
    key: 'alertTitle',
    type: 'string',
    default: '组件信息',
  },
  {
    name: '主要内容文本',
    key: 'contentText',
    type: 'string',
    inputType: 'textarea',
    default: '这是示例 OBS 组件的默认内容。您可以在此输入多行文本。',
    description: '组件内显示的主要文本信息。',
  },
  {
    name: '启用高级特性',
    key: 'enableAdvanced',
    type: 'boolean',
    default: false,
  },
])

type ExampleConfigType = ExtractConfigData<typeof Config>

const DefaultConfig: ExampleConfigType = {
  title: '示例组件默认标题',
  alertType: 'success',
  alertTitle: '默认提示',
  contentText: '来自 DefaultConfig 的内容。点歌点歌点歌。关注vtsuru喵！',
  enableAdvanced: false,
}

defineExpose({
  Config,
  DefaultConfig,
})

// --- Emits (可选，如果子组件需要通知父组件配置更改) ---
// const emits = defineEmits(['update:config']);

const refreshCount = ref(0)
const dynamicTitle = ref(props.config?.title || '默认标题')

// --- 计算属性，合并传入的config和默认值，确保所有字段都存在 ---
const localConfig = computed<ExampleConfigType>(() => {
  return {
    ...DefaultConfig, // 先使用默认值
    ...props.config, // 然后用传入的配置覆盖
  }
})

// --- 监听刷新信号 ---
watch(
  () => props.refreshSignal,
  (newValue, oldValue) => {
    if (newValue !== undefined && newValue !== oldValue) {
      refreshCount.value++
      showSuccessToast(`'示例 OBS 组件' 已刷新 (信号: ${newValue})`)
    }
  },
)

// --- 方法 ---
function updateTitle() {
  showInfoToast('标题已在本地临时更改。若要保存，请通过父组件的配置面板。')
}

// --- Expose (使得父组件可以通过 ref 访问 Config 和 DefaultConfig) ---
// Vue 3 <script setup> 默认关闭，需要显式 defineExpose
// 但对于 DynamicForm，它似乎能够通过某种方式访问导出的 Config 和 DefaultConfig
// 如果父组件需要通过 ref 主动调用方法或访问属性，则需要 defineExpose
// defineExpose({ Config, DefaultConfig, /* refreshMethod */ });

onMounted(() => {
  // console.log('ExampleOBSComponent mounted with config:', props.config);
  // console.log('Effective localConfig:', localConfig.value);
  // console.log('Exposed Config definition:', Config);
  // console.log('Exposed DefaultConfig:', DefaultConfig);
  dynamicTitle.value = localConfig.value.title
})

watch(
  () => props.config,
  (newConfig) => {
    dynamicTitle.value = newConfig?.title || DefaultConfig.title
  },
  { deep: true },
)
</script>

<template>
  <section class="example-obs-component">
    <h2>{{ localConfig.title || '示例 OBS 组件' }}</h2>
    <UAlert
      :color="(localConfig.alertType as 'info' | 'success' | 'warning' | 'error') || 'info'"
      :title="localConfig.alertTitle || '组件信息'"
    >
      <p>{{ localConfig.contentText || '这是示例 OBS 组件的内容。' }}</p>
      <p v-if="userInfo">当前用户: {{ userInfo.name }}</p>
      <p>刷新次数: {{ refreshCount }}</p>
      <div>
        当前配置:
        <pre>{{ JSON.stringify(localConfig, null, 2) }}</pre>
      </div>
    </UAlert>

    <form
      class="example-form"
      @submit.prevent="updateTitle"
    >
      <UFormField label="动态修改组件标题 (仅限本地，不保存)">
        <UInput
          v-model="dynamicTitle"
          placeholder="输入新标题"
        />
      </UFormField>
      <UButton type="submit">更新标题</UButton>
    </form>
  </section>
</template>

<style scoped>
.example-obs-component {
  border: 1px dashed var(--vtsuru-border);
  padding: 16px;
  border-radius: var(--vtsuru-radius);
}

.example-obs-component h2 {
  margin: 0 0 16px;
  font-size: 18px;
}

.example-form {
  display: grid;
  gap: 12px;
  margin-top: 20px;
  justify-items: start;
}

pre {
  background-color: var(--vtsuru-bg-inset);
  padding: 8px;
  border-radius: var(--vtsuru-radius);
  font-size: 0.85em;
  white-space: pre-wrap;
  /* 确保长内容能换行 */
  word-break: break-all;
  /* 强制断词，防止溢出 */
}
</style>
