<template>
  <div class="template-tester">
    <NSpace vertical>
      <NInput
        v-model:value="template"
        type="textarea"
        placeholder="输入包含表达式的模板"
      />

      <NSpace>
        <NButton
          type="primary"
          size="small"
          @click="testTemplate"
        >
          测试模板
        </NButton>
        <NButton
          size="small"
          @click="resetTemplate"
        >
          重置
        </NButton>
      </NSpace>

      <template
        v-if="hasResult"
      >
      <NDivider style="margin: 5px;" />
        <NCard
          title="结果预览"
          size="small"
        >
          <NInput
            type="textarea"
            :value="result"
            readonly
          />
        </NCard>
      </template>
    </NSpace>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { NSpace, NInput, NInputGroup, NInputGroupLabel, NButton, useMessage, NDivider } from 'naive-ui';
import { evaluateTemplateExpressions } from '@/client/store/autoAction/expressionEvaluator';

const props = defineProps({
  defaultTemplate: {
    type: String,
    default: ''
  },
  context: {
    type: Object,
    required: true
  }
});

const template = ref(props.defaultTemplate || '');
const result = ref('');
const hasResult = computed(() => result.value !== '');
const message = useMessage();

function testTemplate() {
  try {
    result.value = evaluateTemplateExpressions(template.value, props.context);
  } catch (error) {
    message.error(`表达式求值错误: ${(error as Error).message}`);
    result.value = `[错误] ${(error as Error).message}`;
  }
}

function resetTemplate() {
  template.value = props.defaultTemplate;
  result.value = '';
}
</script>

<style scoped>
.template-tester {
  margin-top: 16px;
  margin-bottom: 16px;
}

.result-container {
  margin-top: 8px;
  padding: 8px;
  border: 1px solid #d9d9d9;
  border-radius: 4px;
  background-color: #f5f5f5;
}

.result-title {
  font-weight: bold;
  margin-bottom: 4px;
}

.result-content {
  padding: 8px;
  background-color: white;
  border-radius: 4px;
  border: 1px dashed #d9d9d9;
  word-break: break-all;
}
</style>