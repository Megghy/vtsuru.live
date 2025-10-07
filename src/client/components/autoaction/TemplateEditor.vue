<script setup lang="ts">
import type { AutoActionItem } from '@/client/store/autoAction/types'
import { Code24Regular, Info24Filled, LiveOff24Regular } from '@vicons/fluent'
import GraphemeSplitter from 'grapheme-splitter'
import { NAlert, NBadge, NButton, NCard, NCollapse, NCollapseItem, NDivider, NFlex, NHighlight, NIcon, NInput, NModal, NScrollbar, NTabPane, NTabs, NText, useMessage } from 'naive-ui'
import { computed, ref } from 'vue'
import { EventDataTypes } from '@/api/api-models'
import { containsJsExpression, convertToJsExpressions, evaluateTemplateExpressions, extractJsExpressions } from '@/client/store/autoAction/expressionEvaluator'
import { TriggerType } from '@/client/store/autoAction/types'
import { buildExecutionContext } from '@/client/store/autoAction/utils'
import TemplateHelper from './TemplateHelper.vue'

const props = defineProps({
  template: {
    type: Object as () => AutoActionItem,
    required: true,
  },
  title: {
    type: String,
    default: '模板编辑',
  },
  description: {
    type: String,
    default: '',
  },
  checkLength: {
    type: Boolean,
    default: true,
  },
  customTestContext: {
    type: Object,
    default: undefined,
  },
})

const emit = defineEmits(['update:template'])

const mergedPlaceholders = computed(() => {
  const basePlaceholders = [
    { name: '{{user.name}}', description: '用户名称' },
    { name: '{{user.uid}}', description: '用户ID' },
    { name: '{{user.guardLevel}}', description: '用户舰队等级 (0:无, 1:总督, 2:提督, 3:舰长)' },
    { name: '{{user.hasMedal}}', description: '用户是否佩戴粉丝勋章 (true/false)' },
    { name: '{{user.medalLevel}}', description: '用户佩戴的粉丝勋章等级' },
    { name: '{{user.medalName}}', description: '用户佩戴的粉丝勋章名称' },
    { name: '{{date.formatted}}', description: '当前日期时间 (格式化)' },
    { name: '{{date.year}}', description: '当前年份' },
    { name: '{{date.month}}', description: '当前月份' },
    { name: '{{date.day}}', description: '当前日期' },
    { name: '{{date.hour}}', description: '当前小时 (0-23)' },
    { name: '{{date.minute}}', description: '当前分钟' },
    { name: '{{date.second}}', description: '当前秒数' },
    { name: '{{timeOfDay}}', description: '当前时段 (凌晨/早上/上午/中午/下午/晚上/深夜)' },
    { name: '{{event}}', description: '原始事件对象 (高级用法)' },
  ]

  const specificPlaceholders: { name: string, description: string }[] = []

  switch (props.template.triggerType) {
    case TriggerType.DANMAKU:
      specificPlaceholders.push(
        { name: '{{message}}', description: '弹幕内容' },
        { name: '{{danmaku}}', description: '弹幕事件对象' },
      )
      break
    case TriggerType.GIFT:
      specificPlaceholders.push(
        { name: '{{gift.name}}', description: '礼物名称' },
        { name: '{{gift.count}}', description: '礼物数量' },
        { name: '{{gift.price}}', description: '礼物单价(元)' },
        { name: '{{gift.totalPrice}}', description: '礼物总价值(元)' },
        { name: '{{gift.summary}}', description: '礼物概要 (例如: 5个小心心)' },
      )
      break
    case TriggerType.GUARD:
      specificPlaceholders.push(
        { name: '{{guard.level}}', description: '开通的舰队等级 (1:总督, 2:提督, 3:舰长)' },
        { name: '{{guard.levelName}}', description: '开通的舰队等级名称' },
        { name: '{{guard.giftCode}}', description: '舰长礼物代码 (预留字段)' },
      )
      break
    case TriggerType.SUPER_CHAT:
      specificPlaceholders.push(
        { name: '{{sc.message}}', description: 'SC留言内容' },
        { name: '{{sc.price}}', description: 'SC金额(元)' },
      )
      break
  }

  const finalPlaceholders = [...specificPlaceholders, ...basePlaceholders]
  return Array.from(new Map(finalPlaceholders.map(item => [item.name, item])).values())
})

// 深度合并两个对象的辅助函数
function deepMerge(target: any, source: any): any {
  if (!source) return target
  if (!target) return source

  const result = { ...target }

  Object.keys(source).forEach((key) => {
    if (typeof source[key] === 'object' && source[key] !== null && typeof target[key] === 'object' && target[key] !== null) {
      result[key] = deepMerge(target[key], source[key])
    } else if (source[key] !== undefined) {
      result[key] = source[key]
    }
  })

  return result
}

const testContext = computed(() => {
  // 创建默认上下文
  const defaultContext = buildExecutionContext({
    msg: '测试',
    time: 1713542400,
    num: 1,
    price: 100,
    guard_level: 1,
    uname: '测试用户',
    uface: 'https://example.com/test.jpg',
    uid: 12345,
    ouid: '1234567890',
    type: EventDataTypes.Message,
    open_id: '1234567890',
    fans_medal_level: 1,
    fans_medal_name: '测试粉丝勋章',
    fans_medal_wearing_status: true,
    guard_level_name: '测试舰队',
    guard_level_price: 100,
  }, undefined, props.template.triggerType)

  // 如果有自定义上下文，将其与默认上下文合并
  if (props.customTestContext) {
    return deepMerge(defaultContext, props.customTestContext)
  }

  return defaultContext
})

const message = useMessage()
const activeTab = ref('editor')
const showLivePreview = ref(true)
const splitter = new GraphemeSplitter()
const showSyntaxModal = ref(false)

function countGraphemes(value: string) {
  return splitter.countGraphemes(value)
}

function convertPlaceholders() {
  if (!props.template.template) {
    message.warning('请先输入模板内容')
    return
  }
  const converted = convertToJsExpressions(props.template.template, mergedPlaceholders.value)
  if (converted !== props.template.template) {
    props.template.template = converted
    message.success('已转换占位符为表达式格式')
  } else {
    message.info('模板中没有需要转换的占位符')
  }
}

function hasJsExpression(template: string): boolean {
  return containsJsExpression(template)
}

const highlightPatterns = computed(() => {
  const simplePlaceholders = mergedPlaceholders.value.map(p => p.name)
  const jsExpressionsInTemplate = extractJsExpressions(props.template.template || '')
  const allPatterns = [...new Set([...simplePlaceholders, ...jsExpressionsInTemplate])]
  return allPatterns
})

const MAX_LENGTH = 40
const WARNING_THRESHOLD = 16

function evaluateTemplateForUI(template: string): string {
  // 深度合并默认上下文和自定义上下文
  const executionContext = buildExecutionContext(testContext.value.event, undefined, props.template.triggerType)

  // 如果有自定义上下文，将其深度合并到执行上下文中
  if (props.customTestContext) {
    Object.keys(props.customTestContext).forEach((key) => {
      if (typeof props.customTestContext?.[key] === 'object' && props.customTestContext[key] !== null) {
        executionContext.variables[key] = deepMerge(executionContext.variables[key] || {}, props.customTestContext[key])
      } else {
        executionContext.variables[key] = props.customTestContext?.[key]
      }
    })
  }

  try {
    return evaluateTemplateExpressions(template, executionContext)
  } catch (error) {
    console.error('Preview evaluation error:', error)
    return `[预览错误: ${(error as Error).message}]`
  }
}

const evaluatedTemplateResult = computed(() => {
  if (!props.template.template || !showLivePreview.value) return ''
  return evaluateTemplateForUI(props.template.template)
})

const previewResult = computed(() => {
  return evaluatedTemplateResult.value
})

const lengthStatus = computed(() => {
  if (!props.template.template || !props.checkLength || !showLivePreview.value) {
    return { status: 'normal' as const, message: '' }
  }
  try {
    const formattedText = evaluatedTemplateResult.value
    if (formattedText.startsWith('[预览错误:')) {
      return { status: 'normal' as const, message: '' }
    }

    const formattedLength = countGraphemes(formattedText)
    if (formattedLength > MAX_LENGTH) {
      return { status: 'error' as const, message: `格式化后长度超出限制（${formattedLength}/${MAX_LENGTH}字）` }
    } else if (formattedLength >= WARNING_THRESHOLD) {
      return { status: 'warning' as const, message: `格式化后长度接近限制（${formattedLength}/${MAX_LENGTH}字）` }
    }
    return { status: 'normal' as const, message: '' }
  } catch (error) {
    return { status: 'normal' as const, message: '' }
  }
})

const templateExamples = [
  {
    title: '基础变量',
    examples: [
      { label: '用户名', template: '你好 {{user.name}}！' },
      { label: '条件回复', template: '{{js: user.guardLevel > 0 ? "欢迎舰长" : "欢迎"}} {{user.name}}！' },
    ],
  },
  {
    title: '高级用法',
    examples: [
      { label: '字符串操作', template: '{{js: user.name.toUpperCase()}} 有 {{js: user.name.length}} 个字' },
      { label: '随机回复', template: '{{js: ["谢谢", "感谢", "收到"][Math.floor(Math.random() * 3)]}}！' },
      { label: '日期时间', template: '{{js: new Date().toLocaleTimeString()}}，{{timeOfDay}}好！' },
      {
        label: '运行时计数',
        template: '{{js+: const count = (getData(\'messageCount\') || 0) + 1; setData(\'messageCount\', count); return `这是你本次对话的第 ${count} 条消息。`; }}',
      },
      {
        label: '运行时频率检查',
        template: '{{js+: const warns = (getData(\'warnings\') || 0) + 1; setData(\'warnings\', warns); return warns > 3 ? "发言太频繁啦！" : "收到你的消息~"; }}',
      },
      {
        label: '触发持久化计数 (异步)',
        template: '{{js+: const key = `user:${user.uid}:totalMessages`; getStorageData(key, 0).then(c => setStorageData(key, (c || 0) + 1)); return `正在为你累计总发言数...`; }}',
      },
      {
        label: '问候一次 (持久化)',
        template: '{{js+: const key = `greeted:${user.uid}`; hasStorageData(key).then(exists => { if (!exists) { setStorageData(key, true); /* 这里可以接发送欢迎消息的逻辑 */ } }); return \'检查问候状态...\'; }}',
      },
    ],
  },
  {
    title: '弹幕功能',
    examples: [
      { label: '提取内容', template: '你说的是 "{{js: message.substring(0, 5)}}{{js: message.length > 5 ? "..." : ""}}" 吗？' },
      { label: '回复问候', template: '{{js: message.includes("早上好") ? "早安" : "你好"}}，{{user.name}}！' },
    ],
  },
]

function insertExample(template: string) {
  props.template.template = template
  message.success('已插入示例模板')
}
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
      <NButton
        quaternary
        size="small"
        class="btn-with-transition"
        @click="showSyntaxModal = true"
      >
        <NIcon
          :component="Info24Filled"
          style="margin-right: 4px;"
        />
        变量与语法说明
      </NButton>
    </template>

    <p
      v-if="description"
      class="template-description"
    >
      {{ description }}
    </p>

    <!-- 标签页支持 -->
    <NTabs
      v-model:value="activeTab"
      type="line"
      animated
      class="editor-tabs"
    >
      <NTabPane
        name="editor"
        tab="编辑"
      >
        <NFlex
          vertical
          :size="12"
        >
          <!-- 模板帮助组件 -->
          <TemplateHelper :placeholders="mergedPlaceholders" />

          <!-- 当前模板预览 -->
          <NInput
            v-model:value="template.template"
            type="textarea"
            placeholder="输入模板内容... 使用 {{变量名}} 插入变量， {{js: 表达式}} 执行JS"
            :autosize="{ minRows: 3, maxRows: 6 }"
            :show-count="checkLength"
            :count-graphemes="countGraphemes"
            :status="checkLength && lengthStatus.status !== 'normal' ? (lengthStatus.status === 'error' ? 'error' : 'warning') : undefined"
            class="template-input"
          />

          <!-- 长度检查警告 -->
          <NAlert
            v-if="checkLength && lengthStatus.message && lengthStatus.status !== 'normal'"
            :type="lengthStatus.status === 'error' ? 'error' : 'warning'"
            class="length-alert"
          >
            {{ lengthStatus.message }}
          </NAlert>

          <!-- 实时预览 -->
          <NFlex
            align="center"
            justify="space-between"
            class="preview-toggle"
          >
            <NButton
              quaternary
              size="small"
              @click="showLivePreview = !showLivePreview"
            >
              <template #icon>
                <NIcon :component="showLivePreview ? LiveOff24Regular : Code24Regular" />
              </template>
              {{ showLivePreview ? '隐藏预览' : '显示预览' }}
            </NButton>

            <transition name="fade">
              <div
                v-if="showLivePreview && previewResult"
                class="live-preview"
              >
                <NBadge
                  dot
                  type="info"
                /> 实时预览:
                <NHighlight
                  :text="previewResult"
                  :patterns="highlightPatterns"
                />
              </div>
            </transition>
          </NFlex>

          <!-- 模板示例 -->
          <NCollapse
            class="template-examples"
          >
            <NCollapseItem
              name="examples"
              title="模板示例 (点击展开)"
            >
              <NFlex
                vertical
                :size="8"
              >
                <div
                  v-for="(category, idx) in templateExamples"
                  :key="idx"
                  class="example-category"
                >
                  <h4>{{ category.title }}</h4>
                  <NFlex
                    wrap
                    :size="8"
                  >
                    <NButton
                      v-for="(example, i) in category.examples"
                      :key="i"
                      size="small"
                      tertiary
                      class="example-button"
                      @click="insertExample(example.template)"
                    >
                      {{ example.label }}
                    </NButton>
                  </NFlex>
                </div>
              </NFlex>
            </NCollapseItem>
          </NCollapse>
        </NFlex>
      </NTabPane>
    </NTabs>

    <!-- 新增 Modal 组件 -->
    <NModal
      v-model:show="showSyntaxModal"
      preset="card"
      title="模板语法与变量说明"
      :bordered="false"
      size="huge"
      style="width: 600px; max-width: 90vw;"
      :close-on-esc="true"
      :mask-closable="true"
    >
      <NScrollbar style="max-height: 80vh;">
        <NAlert
          title="模板语法说明"
          type="info"
          :show-icon="false"
          style="margin-bottom: 16px;"
        >
          模板支持插入变量和执行 JavaScript。
          <NDivider style="margin: 8px 0;" />
          <strong>1. 简单变量替换:</strong><br>
          直接使用 <code>{{ '\{\{变量名.属性\}\}' }}</code> 插入值。<br>
          示例: <code>{{ '\{\{user.name\}\}' }}</code> → 显示用户名
          <NDivider style="margin: 8px 0;" />
          <strong>2. JS 表达式求值 (<code>js:</code>):</strong><br>
          使用 <code>{{ '\{\{js: 表达式\}\}' }}</code> 执行单个 JS 表达式并插入结果 (隐式返回)。<br>
          适合简单计算、字符串操作、三元运算等。<br>
          示例: <code>{{ '\{\{js: user.guardLevel > 0 ? "舰长" : "非舰长\}\}' }}</code><br>
          示例: <code>{{ '\{\{js: gift.price * gift.count\}\}' }}</code>
          <NDivider style="margin: 8px 0;" />
          <strong>3. JS 代码块执行 (<code>js+:</code> 或 <code>js-run:</code>):</strong><br>
          使用 <code>{{ '\{\{js+: 代码...\}\}' }}</code> 或 <code>{{ '\{\{js-run: 代码...\}\}' }}</code> 执行多行 JS 代码。<br>
          <strong style="color: var(--warning-color);">需要显式使用 <code>return</code> 语句来指定输出到模板的值。</strong><br>
          适合需要临时变量、多步逻辑或调用 <code>getData/setData</code> 等函数的场景。<br>
          <pre><code>{{ '\{\{js+:\n  const count = (getData(\'greetCount\') || 0) + 1;\n  setData(\'greetCount\', count);\n  return \`这是第 ${count} 次问候！\`;\n\}\}' }}</code></pre>
        </NAlert>

        <NCollapse arrow-placement="right">
          <NCollapseItem
            title="数据存储函数说明 (在 js+ 或 js-run 中使用)"
            name="data-functions"
          >
            <NAlert
              type="warning"
              :bordered="false"
              size="small"
              style="margin-bottom: 8px;"
            >
              <strong>运行时数据</strong>仅在本次运行有效, 重启后就没了，且操作是<strong>同步</strong>的。
            </NAlert>
            <ul class="function-list">
              <li><code>getData(key, defaultValue?)</code>: 获取运行时数据。</li>
              <li><code>setData(key, value)</code>: 设置运行时数据。</li>
              <li><code>containsData(key)</code>: 检查运行时数据是否存在。</li>
              <li><code>removeData(key)</code>: 移除运行时数据。</li>
            </ul>

            <NDivider style="margin: 12px 0;" />

            <NAlert
              type="info"
              :bordered="false"
              size="small"
              style="margin-bottom: 8px;"
            >
              <strong>持久化数据</strong>会长期保留，但操作是<strong>异步</strong>的 (返回 Promise)。<br>
              在 <code>js+</code> 或 <code>js-run</code> 中使用 <code>await</code> 处理或使用 <code>.then()</code>。
            </NAlert>
            <ul class="function-list">
              <li><code>getStorageData(key, defaultValue?)</code>: 获取持久化数据 (异步)。</li>
              <li><code>setStorageData(key, value)</code>: 设置持久化数据 (异步)。</li>
              <li><code>hasStorageData(key)</code>: 检查持久化数据是否存在 (异步)。</li>
              <li><code>removeStorageData(key)</code>: 移除持久化数据 (异步)。</li>
              <li><code>clearStorageData()</code>: 清除所有用户持久化数据 (异步)。</li>
            </ul>
            <pre><code>{{ '\{\{js+:\n  // 异步获取并设置持久化数据\n  const key = \`user:${user.uid}:visitCount\`;\n  const count = (await getStorageData(key, 0)) + 1;\n  await setStorageData(key, count);\n  return \`你是第 ${count} 次访问！\`;\n\}\}' }}</code></pre>
          </NCollapseItem>
        </NCollapse>
        <br>
        <strong>可用变量 (基础):</strong>

        <div
          v-for="(ph, idx) in mergedPlaceholders"
          :key="idx"
          class="placeholder-item"
        >
          <NText code>
            {{ ph.name }}
          </NText>: {{ ph.description }}
        </div>
      </NScrollbar>
    </NModal>
  </NCard>
</template>

<style scoped>
.template-editor-card {
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
  margin-bottom: 12px;
  color: var(--n-text-color-disabled);
  font-size: 13px;
}

.alert-header {
  display: flex;
  align-items: center;
  font-weight: bold;
}

.placeholder-item {
  margin-bottom: 4px;
  font-size: 13px;
}

.placeholder-item code {
  font-size: 13px;
  padding: 1px 4px;
}

.template-input {
  margin-top: 8px;
  font-family: 'Courier New', Courier, monospace;
}

.preview-toggle {
  margin-top: 4px;
  height: 28px;
}

.length-alert {
  margin-top: 8px;
  font-size: 13px;
}

.live-preview {
  background-color: var(--n-color-target);
  border-radius: var(--n-border-radius);
  padding: 4px 8px;
  font-size: 13px;
  border-left: 3px solid var(--n-color-target);
  word-break: break-all;
  transition: all 0.3s ease;
  margin-left: 8px;
  display: flex;
  align-items: center;
}

.live-preview .n-badge {
  margin-right: 6px;
}

.template-examples {
  margin-top: 16px;
}

.example-category h4 {
  margin: 0 0 6px 0;
  font-size: 14px;
  color: var(--n-text-color-2);
}

.example-button {
  transition: all 0.2s ease;
}

.example-button:hover {
  transform: translateY(-1px);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.btn-with-transition {
  transition: all 0.2s ease;
}

.btn-with-transition:hover {
  transform: translateY(-1px);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
}

.function-list {
  list-style: none;
  padding-left: 10px;
  font-size: 13px;
}
.function-list li {
  margin-bottom: 5px;
}
.function-list code {
   background-color: var(--n-code-color);
   padding: 1px 4px;
   border-radius: var(--n-border-radius);
   font-family: monospace;
   margin-right: 4px;
}
.n-collapse {
  margin-top: 16px;
}
.n-alert pre {
  margin: 4px 0 0 0;
  padding: 6px 8px;
  background-color: var(--n-code-color);
  border-radius: var(--n-border-radius);
  overflow-x: auto;
  font-size: 12px;
  line-height: 1.4;
}
.n-alert code {
   background-color: transparent;
   padding: 0;
   font-family: monospace;
   font-size: inherit;
}
.n-alert pre code {
  background-color: transparent;
  padding: 0;
}
</style>
