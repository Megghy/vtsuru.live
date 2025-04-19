<script setup lang="ts">
import { NButton, NCard, NDivider, NHighlight, NInput, NList, NListItem, NPopconfirm, NScrollbar, NSpace, NTooltip, useMessage, NTabs, NTabPane, NFlex, NAlert, NIcon } from 'naive-ui';
import { computed, ref } from 'vue';
import TemplateHelper from './TemplateHelper.vue';
import TemplateTester from './TemplateTester.vue';
import { containsJsExpression, convertToJsExpressions } from '@/client/store/autoAction/expressionEvaluator';
import { Info24Filled } from '@vicons/fluent';

const props = defineProps({
  templates: {
    type: Array as () => string[],
    required: true
  },
  title: {
    type: String,
    default: '模板编辑'
  },
  description: {
    type: String,
    default: ''
  },
  placeholders: {
    type: Array as () => { name: string, description: string }[],
    default: () => []
  },
  // 新增：提供测试上下文对象
  testContext: {
    type: Object,
    default: () => ({
      user: { uid: 12345, name: '测试用户' },
      gift: { name: '测试礼物', count: 1, price: 100 }
    })
  }
});

// 添加默认的弹幕相关占位符
const mergedPlaceholders = computed(() => {
  const defaultPlaceholders = [
    { name: '{{user.name}}', description: '用户名称' },
    { name: '{{user.uid}}', description: '用户ID' },
    { name: '{{user.nameLength}}', description: '用户名长度' },
    { name: '{{date.formatted}}', description: '当前日期格式化' },
    { name: '{{timeOfDay()}}', description: '获取当前时段（早上/下午/晚上）' }
  ];

  // 合并自定义占位符和默认占位符
  return [...props.placeholders, ...defaultPlaceholders];
});

const newTemplate = ref('');
const message = useMessage();
const activeTab = ref('editor'); // 新增：标签页控制

// 新增：跟踪编辑状态
const isEditing = ref(false);
const editIndex = ref(-1);
const editTemplate = ref('');

// 新增：测试选中的模板
const selectedTemplateForTest = ref('');

function addTemplate() {
  const val = newTemplate.value.trim();
  if (!val) return;
  if (props.templates.includes(val)) {
    message.warning('模板已存在');
    return;
  }
  props.templates.push(val);
  newTemplate.value = '';
}

function removeTemplate(index: number) {
  props.templates.splice(index, 1);
}

// 新增：开始编辑模板
function startEditTemplate(index: number) {
  editIndex.value = index;
  editTemplate.value = props.templates[index];
  isEditing.value = true;
  newTemplate.value = editTemplate.value;
}

// 新增：取消编辑
function cancelEdit() {
  isEditing.value = false;
  editIndex.value = -1;
  newTemplate.value = '';
}

// 新增：保存编辑后的模板
function saveEditedTemplate() {
  const val = newTemplate.value.trim();
  if (!val) {
    message.warning('模板内容不能为空');
    return;
  }

  // 检查是否与其他模板重复（排除当前编辑的模板）
  const otherTemplates = props.templates.filter((_, idx) => idx !== editIndex.value);
  if (otherTemplates.includes(val)) {
    message.warning('模板已存在');
    return;
  }

  props.templates[editIndex.value] = val;
  message.success('模板更新成功');
  cancelEdit();
}

// 新增：转换为表达式
function convertPlaceholders() {
  if (!newTemplate.value) {
    message.warning('请先输入模板内容');
    return;
  }
  newTemplate.value = convertToJsExpressions(newTemplate.value, mergedPlaceholders.value);
  message.success('已转换占位符为表达式格式');
}

// 新增：测试模板
function testTemplate(template: string) {
  selectedTemplateForTest.value = template;
  activeTab.value = 'test';
}

// 新增：高亮JavaScript表达式
function hasJsExpression(template: string): boolean {
  return containsJsExpression(template);
}

// 新增：高亮规则
const highlightPatterns = computed(() => {
  return [
    // 普通占位符高亮
    ...mergedPlaceholders.value.map(p => p.name),
    // JS表达式高亮
    '{{js:'
  ];
});
</script>

<template>
  <NCard
    :title="title"
    size="small"
    class="template-editor-card"
  >
    <template
      v-if="mergedPlaceholders.length > 0"
      #header-extra
    >
      <NTooltip
        trigger="hover"
        placement="top"
      >
        <template #trigger>
          <NButton
            quaternary
            size="small"
            class="btn-with-transition"
          >
            变量说明
          </NButton>
        </template>

        <NAlert
          type="info"
          closable
          style="margin-bottom: 8px"
        >
          <template #header>
            <div class="alert-header">
              <NIcon
                :component="Info24Filled"
                size="18"
                style="margin-right: 8px"
              />
              模板支持简单的JavaScript表达式
            </div>
          </template>
          在模板中使用 <code>{{ '\{\{js:\}\}' }}</code> 语法可以执行简单的JavaScript表达式

          <NFlex vertical>
            <span>
              <code>{{ '\{\{js: user.name.toUpperCase()\}\}' }}</code> → 将用户名转为大写
            </span>
            <span>
              <code>{{ '\{\{js: gift.count > 10 ? "大量" : "少量"\}\}' }}</code> → 根据数量显示不同文本
            </span>
          </NFlex>
        </NAlert>
        <NScrollbar style="max-height: 200px; max-width: 300px">
          <div
            v-for="(ph, idx) in mergedPlaceholders"
            :key="idx"
          >
            <strong>{{ ph.name }}</strong>: {{ ph.description }}
          </div>
        </NScrollbar>
      </NTooltip>
    </template>

    <p
      v-if="description"
      class="template-description"
    >
      {{ description }}
    </p>

    <!-- 新增：添加标签页支持 -->
    <NTabs
      v-model:value="activeTab"
      type="line"
      animated
      class="editor-tabs"
    >
      <NTabPane
        name="editor"
        tab="编辑模板"
      >
        <!-- 新增：添加模板帮助组件 -->
        <transition
          name="fade"
          mode="out-in"
          appear
        >
          <TemplateHelper :placeholders="mergedPlaceholders" />
        </transition>

        <NList
          bordered
          class="template-list"
        >
          <transition-group
            name="list-slide"
            tag="div"
            appear
          >
            <NListItem
              v-for="(template, index) in templates"
              :key="index"
              class="template-list-item"
            >
              <NSpace
                justify="space-between"
                align="center"
                style="width: 100%"
              >
                <!-- 更新：使用自定义高亮规则 -->
                <div
                  class="template-content"
                  :class="{ 'has-js-expr': hasJsExpression(template) }"
                >
                  <NHighlight
                    :patterns="highlightPatterns"
                    :text="template"
                  />
                  <div
                    v-if="hasJsExpression(template)"
                    class="js-expr-badge"
                  >
                    JS
                  </div>
                </div>

                <NSpace>
                  <NButton
                    size="small"
                    class="btn-with-transition"
                    @click="testTemplate(template)"
                  >
                    测试
                  </NButton>
                  <NButton
                    size="small"
                    class="btn-with-transition"
                    @click="startEditTemplate(index)"
                  >
                    编辑
                  </NButton>
                  <NPopconfirm
                    @positive-click="removeTemplate(index)"
                  >
                    <template #trigger>
                      <NButton
                        size="small"
                        class="btn-with-transition"
                      >
                        删除
                      </NButton>
                    </template>
                    确定要删除这个模板吗？
                  </NPopconfirm>
                </NSpace>
              </NSpace>
            </NListItem>
          </transition-group>
        </NList>

        <NDivider />

        <transition
          name="fade-scale"
          appear
        >
          <NSpace
            vertical
            style="width: 100%"
          >
            <NInput
              v-model:value="newTemplate"
              type="textarea"
              placeholder="输入新模板"
              :autosize="{ minRows: 2, maxRows: 5 }"
              class="template-input"
              @keydown.enter.ctrl="isEditing ? saveEditedTemplate() : addTemplate()"
            />

            <NSpace justify="space-between">
              <NSpace>
                <NButton
                  type="default"
                  class="btn-with-transition"
                  @click="convertPlaceholders"
                >
                  转换为表达式
                </NButton>
              </NSpace>

              <NSpace>
                <NButton
                  v-if="isEditing"
                  class="btn-with-transition"
                  @click="cancelEdit"
                >
                  取消
                </NButton>
                <NButton
                  type="primary"
                  class="btn-with-transition"
                  @click="isEditing ? saveEditedTemplate() : addTemplate()"
                >
                  {{ isEditing ? '保存' : '添加' }}
                </NButton>
              </NSpace>
            </NSpace>
          </NSpace>
        </transition>
      </NTabPane>

      <NTabPane
        name="test"
        tab="测试模板"
      >
        <transition
          name="fade"
          mode="out-in"
          appear
        >
          <TemplateTester
            :default-template="selectedTemplateForTest"
            :context="testContext"
            :placeholders="mergedPlaceholders"
          />
        </transition>
      </NTabPane>
    </NTabs>
  </NCard>
</template>

<style scoped>
.template-editor-card {
  transition: all 0.3s ease;
  animation: card-appear 0.4s ease-out;
}

@keyframes card-appear {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.template-description {
  margin-bottom: 16px;
  color: #666;
  transition: all 0.3s ease;
}

.editor-tabs {
  transition: all 0.3s ease;
}

.template-list {
  margin-top: 16px;
  transition: all 0.3s ease;
}

.template-list-item {
  transition: all 0.3s ease;
}

.template-list-item:hover {
  background-color: rgba(0, 0, 0, 0.02);
}

.template-content {
  position: relative;
  padding-right: 30px;
  word-break: break-all;
  transition: all 0.3s ease;
}

.has-js-expr {
  background-color: rgba(64, 158, 255, 0.05);
  border-radius: 4px;
  padding: 4px 8px;
}

.js-expr-badge {
  position: absolute;
  top: 0;
  right: 0;
  background-color: #409EFF;
  color: white;
  font-size: 12px;
  padding: 1px 4px;
  border-radius: 3px;
  transition: all 0.3s ease;
}

.template-input {
  transition: all 0.3s ease;
}

.template-input:focus {
  box-shadow: 0 0 0 2px rgba(64, 158, 255, 0.2);
}

/* 列表动画 */
.list-slide-enter-active,
.list-slide-leave-active {
  transition: all 0.4s ease;
}
.list-slide-enter-from {
  opacity: 0;
  transform: translateX(-20px);
}
.list-slide-leave-to {
  opacity: 0;
  transform: translateX(20px);
}
.list-slide-move {
  transition: transform 0.4s ease;
}

/* 淡入缩放 */
.fade-scale-enter-active,
.fade-scale-leave-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}
.fade-scale-enter-from,
.fade-scale-leave-to {
  opacity: 0;
  transform: scale(0.95);
}

/* 淡入淡出 */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* 按钮过渡 */
.btn-with-transition {
  transition: all 0.2s ease;
}
.btn-with-transition:hover {
  transform: translateY(-2px);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
}
</style>
