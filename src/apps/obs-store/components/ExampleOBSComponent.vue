<script lang="ts" setup>
import type { UserInfo } from '@/api/api-models'
import type { ExtractConfigData } from '@/shared/types/VTsuruConfigTypes'
// ConfigItemType is imported in the script block above
// import { ConfigItemDefinition, ConfigItemType, ExtractConfigData, defineTemplateConfig } from '@/shared/types/VTsuruConfigTypes';
import { NAlert, NButton, NCard, NForm, NFormItem, NInput, useMessage } from 'naive-ui'
import { computed, onMounted, ref, watch } from 'vue'
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

const message = useMessage()

// --- 本地状态 ---
const refreshCount = ref(0)
const dynamicTitle = ref(props.config?.title || '默认标题')

// --- 计算属性，合并传入的config和默认值，确保所有字段都存在 ---
const localConfig = computed<ExampleConfigType>(() => {
  return {
    ...DefaultConfig, // 先使用默认值
    ...(props.config || {}), // 然后用传入的配置覆盖
  }
})

// --- 监听刷新信号 ---
watch(() => props.refreshSignal, (newValue, oldValue) => {
  if (newValue !== undefined && newValue !== oldValue) {
    refreshCount.value++
    message.success(`'示例 OBS 组件' 已刷新 (信号: ${newValue})`)
    // 在这里执行组件的刷新逻辑，例如重新获取数据、重置状态等
    // fetchData();
  }
})

// --- 方法 ---
function updateTitle() {
  if (props.config) {
    // 这是直接修改 prop，Vue 会发出警告。在实际应用中，应该通过 emit 更新父组件的配置
    // (props.config as any).title = dynamicTitle.value;
    message.info('标题已在本地临时更改。若要保存，请通过父组件的配置面板。')
    // 要正确更新，应该 emit事件，例如：
    // emits('update:config', { ...localConfig.value, title: dynamicTitle.value });
  }
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

watch(() => props.config, (newConfig) => {
  dynamicTitle.value = newConfig?.title || DefaultConfig.title
}, { deep: true })
</script>

<template>
  <NCard
    :title="localConfig.title || '示例 OBS 组件'"
    class="example-obs-component"
  >
    <NAlert
      :type="localConfig.alertType as any || 'info'"
      :title="localConfig.alertTitle || '组件信息'"
    >
      <p>{{ localConfig.contentText || '这是示例 OBS 组件的内容。' }}</p>
      <p v-if="userInfo">
        当前用户: {{ userInfo.name }}
      </p>
      <p>刷新次数: {{ refreshCount }}</p>
      <p>
        当前配置:
        <pre>{{ JSON.stringify(localConfig, null, 2) }}</pre>
      </p>
    </NAlert>

    <NForm style="margin-top: 20px;">
      <NFormItem label="动态修改组件标题 (仅限本地，不保存)">
        <NInput
          v-model:value="dynamicTitle"
          placeholder="输入新标题"
        />
      </NFormItem>
      <NButton @click="updateTitle">
        更新标题
      </NButton>
    </NForm>
  </NCard>
</template>

<style scoped>
  .example-obs-component {
    border: 1px dashed var(--n-border-color);
    padding: 16px;
  }

  pre {
    background-color: var(--n-code-block-color);
    padding: 8px;
    border-radius: var(--n-border-radius);
    font-size: 0.85em;
    white-space: pre-wrap;
    /* 确保长内容能换行 */
    word-break: break-all;
    /* 强制断词，防止溢出 */
  }
</style>
