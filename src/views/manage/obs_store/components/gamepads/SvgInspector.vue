<template>
  <n-card class="svg-inspector">
    <n-h3>SVG结构检查工具</n-h3>
    <n-space
      align="center"
      wrap
      size="small"
    >
      <n-select
        v-model:value="selectedType"
        :options="controllerOptions"
        style="min-width: 150px"
      />

      <n-select
        v-if="availableBodies.length > 0"
        v-model:value="selectedBodyId"
        :options="bodyOptions"
        style="min-width: 150px"
      />

      <n-button
        :disabled="isInspecting"
        type="primary"
        @click="inspectSvg"
      >
        分析SVG结构
      </n-button>
    </n-space>

    <n-spin
      v-if="isInspecting"
      size="medium"
      style="margin: 20px 0"
    >
      <n-text>正在分析SVG结构...</n-text>
    </n-spin>

    <div
      v-if="svgInfo.length > 0"
      class="results"
    >
      <n-h4>检测到的元素 ({{ svgInfo.length }}个):</n-h4>
      <n-space
        vertical
        size="small"
      >
        <n-space
          align="center"
          size="medium"
        >
          <n-input
            v-model:value="searchFilter"
            placeholder="搜索元素..."
            style="min-width: 250px"
          />
          <n-checkbox v-model:checked="showLabelsOnly">
            只显示带标签的元素
          </n-checkbox>
        </n-space>

        <n-scrollbar class="results-scrollbar">
          <n-space
            vertical
            size="small"
          >
            <n-card
              v-for="(item, index) in filteredSvgInfo"
              :key="index"
              size="small"
              :bordered="false"
              style="padding: 12px"
              :class="{ 'has-label': item.label, 'element-card': true }"
              @click="selectElement(item)"
            >
              <n-space
                vertical
                size="small"
              >
                <n-text><strong>ID:</strong> {{ item.id || '(无ID)' }}</n-text>
                <n-text v-if="item.label">
                  <strong>标签:</strong> {{ item.label }}
                </n-text>
                <n-text><strong>类型:</strong> {{ item.tagName }}</n-text>
                <n-space
                  vertical
                  size="small"
                  class="hide-rule"
                >
                  <n-space size="small">
                    <n-button
                      size="tiny"
                      @click.stop="selectElement(item)"
                    >
                      选择此元素
                    </n-button>
                    <n-button
                      size="tiny"
                      @click.stop="highlightElement(item)"
                    >
                      在SVG中高亮
                    </n-button>
                  </n-space>
                  <n-code
                    v-if="item.id"
                    :code="getCssRuleForId(item.id)"
                    language="css"
                    show-line-numbers
                    size="small"
                  />
                  <n-code
                    v-if="item.label"
                    :code="getCssRuleForLabel(item.label)"
                    language="css"
                    show-line-numbers
                    size="small"
                  />
                </n-space>
              </n-space>
            </n-card>
          </n-space>
        </n-scrollbar>
      </n-space>
    </div>
  </n-card>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { gamepadConfigs, controllerBodies } from '@/data/gamepadConfigs';
import type { GamepadType } from '@/types/gamepad';
import {
  NCard,
  NSpace,
  NSelect,
  NButton,
  NSpin,
  NInput,
  NCheckbox,
  NText,
  NH3,
  NH4,
  NCode,
  NScrollbar
} from 'naive-ui';

interface Props {
  controllerType?: GamepadType;
}

const props = withDefaults(defineProps<Props>(), {
  controllerType: 'xbox',
});

interface SvgElementInfo {
  id: string | null;
  label: string | null;
  tagName: string;
  fill?: string;
  stroke?: string;
  transform?: string;
  element?: Element; // 添加对实际DOM元素的引用
  visible: boolean; // 添加visible属性
}

const selectedType = ref<GamepadType>(props.controllerType);
const selectedBodyId = ref('');
const isInspecting = ref(false);
const svgInfo = ref<SvgElementInfo[]>([]);
const searchFilter = ref('');
const showLabelsOnly = ref(false);
const highlightedElement = ref<Element | null>(null);

// 控制器类型选项
const controllerOptions = [
  { label: 'Xbox控制器', value: 'xbox' },
  { label: 'PlayStation控制器', value: 'ps' },
  { label: 'Nintendo控制器', value: 'nintendo' }
];

// 定义emit事件
const emit = defineEmits<{
  (e: 'element-selected', element: SvgElementInfo): void
}>();

// 获取当前控制器类型的所有可用主体
const availableBodies = computed(() => {
  return controllerBodies[selectedType.value] || [];
});

// 转换为NSelect需要的选项格式
const bodyOptions = computed(() => {
  const options = availableBodies.value.map(body => ({
    label: body.name,
    value: body.id
  }));

  return [
    { label: '（默认主体）', value: '' },
    ...options
  ];
});

// 为n-code生成CSS代码字符串
function getCssRuleForId(id: string) {
  return `.custom-visibility :deep([id="${id}"]) { visibility: visible; }`;
}

function getCssRuleForLabel(label: string) {
  return `.custom-visibility :deep([inkscape\\:label="${label}"]) { visibility: visible; }`;
}

// 根据选择的主体获取对应的SVG组件
const currentBodySvg = computed(() => {
  if (selectedBodyId.value) {
    const selectedBody = availableBodies.value.find(b => b.id === selectedBodyId.value);
    if (selectedBody) return selectedBody.body;
  }

  // 如果未选择特定主体或找不到所选主体，则使用默认主体
  return gamepadConfigs[selectedType.value]?.bodySvg;
});

// 监听props变化，更新选择的控制器类型
watch(() => props.controllerType, (newType) => {
  selectedType.value = newType;
  // 切换控制器类型时重置所选主体
  selectedBodyId.value = '';
}, { immediate: true });

// 自动分析当前控制器类型
onMounted(() => {
  // 延迟执行以确保组件完全挂载
  setTimeout(() => {
    inspectSvg();
  }, 500);
});

const filteredSvgInfo = computed(() => {
  return svgInfo.value.filter(item => {
    // 筛选显示带标签的元素
    if (showLabelsOnly.value && !item.label) {
      return false;
    }

    // 搜索过滤
    const filter = searchFilter.value.toLowerCase();
    if (!filter) return true;

    return (
      (item.id && item.id.toLowerCase().includes(filter)) ||
      (item.label && item.label.toLowerCase().includes(filter)) ||
      item.tagName.toLowerCase().includes(filter)
    );
  });
});

// 选择元素并发送到父组件
function selectElement(item: SvgElementInfo) {
  // 移除之前高亮的元素
  clearHighlight();

  // 发出选中事件
  emit('element-selected', item);
}

// 在SVG中高亮显示元素
function highlightElement(item: SvgElementInfo) {
  // 清除之前的高亮
  clearHighlight();

  if (item.element) {
    // 保存原始样式
    const originalStyle = item.element.getAttribute('style') || '';
    item.element.setAttribute('data-original-style', originalStyle);

    // 应用高亮样式
    item.element.setAttribute('style', `${originalStyle}; outline: 2px solid red; outline-offset: 2px;`);
    highlightedElement.value = item.element;

    // 5秒后自动清除高亮
    setTimeout(() => {
      clearHighlight();
    }, 5000);
  }
}

// 清除高亮
function clearHighlight() {
  if (highlightedElement.value) {
    const originalStyle = highlightedElement.value.getAttribute('data-original-style') || '';
    highlightedElement.value.setAttribute('style', originalStyle);
    highlightedElement.value.removeAttribute('data-original-style');
    highlightedElement.value = null;
  }
}

// 分析SVG结构
async function inspectSvg() {
  try {
    isInspecting.value = true;
    svgInfo.value = [];

    const svgComponent = currentBodySvg.value;
    if (!svgComponent) {
      throw new Error(`找不到${selectedType.value}控制器的SVG配置`);
    }

    // 创建一个临时元素来加载SVG
    const tempContainer = document.createElement('div');
    tempContainer.style.position = 'absolute';
    tempContainer.style.visibility = 'hidden';
    document.body.appendChild(tempContainer);

    // 使用Vue组件加载SVG (需要异步处理)
    const { createApp, h } = await import('vue');
    const app = createApp({
      render: () => h(svgComponent)
    });
    app.mount(tempContainer);

    // 等待SVG呈现 (实际情况下可能需要更复杂的检测机制)
    await new Promise(resolve => setTimeout(resolve, 100));

    // 现在分析临时容器中的SVG结构
    const svgElement = tempContainer.querySelector('svg');
    if (!svgElement) {
      throw new Error('无法在组件中找到SVG元素');
    }

    // 递归收集SVG元素的信息
    collectSvgElements(svgElement);

    // 清理
    app.unmount();
    document.body.removeChild(tempContainer);
    isInspecting.value = false;
  } catch (error) {
    console.error('SVG分析失败:', error);
    isInspecting.value = false;
  }
}

// 递归收集SVG元素信息
function collectSvgElements(element: Element) {
  // 检查是否有ID或inkscape:label
  const id = element.id;
  const label = element.getAttribute('inkscape:label');
  const computedStyle = window.getComputedStyle(element);

  // 如果有ID或标签，添加到列表中
  if (id || label) {
    svgInfo.value.push({
      id,
      label,
      tagName: element.tagName.toLowerCase(),
      fill: computedStyle.fill !== 'none' ? computedStyle.fill : undefined,
      stroke: computedStyle.stroke !== 'none' ? computedStyle.stroke : undefined,
      transform: element.getAttribute('transform') || undefined,
      element, // 保存对DOM元素的引用
      visible: true // 默认可见
    });
  }

  // 递归处理子元素
  Array.from(element.children).forEach(child => {
    collectSvgElements(child);
  });
}
</script>

<style scoped>
.svg-inspector {
  margin-bottom: 20px;
  max-height: 100vh;
  overflow: auto;
}

.has-label {
  border-left: 3px solid #18a058 !important;
}

.results {
  margin-top: 15px;
}

.element-card {
  cursor: pointer;
  transition: background-color 0.2s;
}

.element-card:hover {
  background-color: rgba(0, 0, 0, 0.05);
}

.hide-rule {
  margin-top: 10px;
}

.results-scrollbar {
  max-height: calc(80vh - 200px);
  overflow: auto;
}
</style>