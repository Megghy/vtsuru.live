<script setup lang="ts">
import { AppsListDetail24Regular, Code24Regular, Info24Filled, LiveOff24Regular } from '@vicons/fluent'
import { useDebounceFn } from '@vueuse/core'
import { computed, nextTick, ref, watch } from 'vue'

import { EventDataTypes } from '@/api/api-models'
import { evaluateTemplateExpressions } from '@/apps/client/store/autoAction/expressionEvaluator'
import type { AutoActionItem } from '@/apps/client/store/autoAction/types'
import { buildExecutionContext } from '@/apps/client/store/autoAction/utils'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/shared/ui/accordion'
import { Alert, AlertDescription, AlertTitle } from '@/shared/ui/alert'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { ScrollArea } from '@/shared/ui/scroll-area'
import { Separator } from '@/shared/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs'
import { Textarea } from '@/shared/ui/textarea'
import { useMessage } from '@/shared/utils'

import { getMergedPlaceholders } from './placeholders'
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
  templateIndex: {
    type: Number,
    default: 0,
  },
})

const emit = defineEmits<{
  (e: 'update:template', payload: { index: number; value: string }): void
}>()

const mergedPlaceholders = computed(() => getMergedPlaceholders(props.template.triggerType))

function deepMerge(target: any, source: any): any {
  if (!source) return target
  if (!target) return source

  const result = { ...target }

  Object.keys(source).forEach((key) => {
    if (
      typeof source[key] === 'object' &&
      source[key] !== null &&
      typeof target[key] === 'object' &&
      target[key] !== null
    ) {
      result[key] = deepMerge(target[key], source[key])
    } else if (source[key] !== undefined) {
      result[key] = source[key]
    }
  })

  return result
}

const testContext = computed(() => {
  const defaultContext = buildExecutionContext(
    {
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
    },
    undefined,
    props.template.triggerType,
  )

  if (props.customTestContext) {
    return deepMerge(defaultContext, props.customTestContext)
  }

  return defaultContext
})

const message = useMessage()
const activeTab = ref('editor')
const showLivePreview = ref(true)
const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' })
const showSyntaxModal = ref(false)
const inputInst = ref<HTMLTextAreaElement | null>(null)

function countGraphemes(value: string) {
  return [...segmenter.segment(value)].length
}

const MAX_LENGTH = 40
const WARNING_THRESHOLD = 32

function evaluateTemplateForUI(template: string): string {
  const executionContext = buildExecutionContext(testContext.value.event, undefined, props.template.triggerType)

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

const evaluatedTemplateResult = ref('')

const updatePreview = useDebounceFn(() => {
  if (!props.template.template || !showLivePreview.value) {
    evaluatedTemplateResult.value = ''
    return
  }
  evaluatedTemplateResult.value = evaluateTemplateForUI(props.template.template)
}, 250)

watch(() => [props.template.template, showLivePreview.value], updatePreview, { immediate: true })

const previewResult = computed(() => evaluatedTemplateResult.value)

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
  } catch {
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
        template:
          "{{js+: const count = (getData('messageCount') || 0) + 1; setData('messageCount', count); return '这是你本次对话的第 ' + count + ' 条消息。'; }}",
      },
      {
        label: '运行时频率检查',
        template:
          '{{js+: const warns = (getData(\'warnings\') || 0) + 1; setData(\'warnings\', warns); return warns > 3 ? "发言太频繁啦！" : "收到你的消息~"; }}',
      },
      {
        label: '触发持久化计数 (异步)',
        template:
          "{{js+: const key = 'user:' + user.uid + ':totalMessages'; getStorageData(key, 0).then(c => setStorageData(key, (c || 0) + 1)); return '正在为你累计总发言数...'; }}",
      },
      {
        label: '问候一次 (持久化)',
        template:
          "{{js+: const key = 'greeted:' + user.uid; hasStorageData(key).then(exists => { if (!exists) { setStorageData(key, true); /* 这里可以接发送欢迎消息的逻辑 */ } }); return '检查问候状态...'; }}",
      },
    ],
  },
  {
    title: '弹幕功能',
    examples: [
      {
        label: '提取内容',
        template: '你说的是 "{{js: message.substring(0, 5)}}{{js: message.length > 5 ? "..." : ""}}" 吗？',
      },
      { label: '回复问候', template: '{{js: message.includes("早上好") ? "早安" : "你好"}}，{{user.name}}！' },
    ],
  },
]

function insertExample(template: string) {
  props.template.template = template
  emit('update:template', { index: props.templateIndex, value: template })
  message.success('已插入示例模板')
}

function handleVariableInsert(text: string) {
  const inputEl = inputInst.value
  let newTemplate = props.template.template || ''

  if (inputEl) {
    const start = inputEl.selectionStart
    const end = inputEl.selectionEnd
    newTemplate = newTemplate.substring(0, start) + text + newTemplate.substring(end)

    props.template.template = newTemplate
    emit('update:template', { index: props.templateIndex, value: newTemplate })

    nextTick(() => {
      inputEl.focus()
      inputEl.setSelectionRange(start + text.length, start + text.length)
    })
  } else {
    newTemplate += text
    props.template.template = newTemplate
    emit('update:template', { index: props.templateIndex, value: newTemplate })
  }
}
</script>

<template>
  <Card class="template-editor-card border-none bg-transparent shadow-none">
    <CardHeader class="p-0 pb-3 flex flex-row items-center justify-between">
      <CardTitle class="text-sm font-semibold">
        {{ title }}
      </CardTitle>
      <Button
        v-if="mergedPlaceholders.length > 0"
        variant="ghost"
        size="xs"
        class="flex items-center gap-1"
        @click="showSyntaxModal = true"
      >
        <Info24Filled class="h-4 w-4" />
        变量与语法说明
      </Button>
    </CardHeader>

    <p
      v-if="description"
      class="template-description text-xs text-muted-foreground mb-3"
    >
      {{ description }}
    </p>

    <!-- 标签页支持 -->
    <Tabs
      v-model="activeTab"
      class="editor-tabs w-full"
    >
      <TabsList class="mb-3">
        <TabsTrigger value="editor"> 编辑 </TabsTrigger>
        <TabsTrigger value="examples"> 示例库 </TabsTrigger>
      </TabsList>

      <TabsContent
        value="editor"
        class="mt-0"
      >
        <div class="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div class="md:col-span-3 flex flex-col gap-2">
            <!-- 长度检查警告 -->
            <Alert
              v-if="checkLength && lengthStatus.message && lengthStatus.status !== 'normal'"
              :variant="lengthStatus.status === 'error' ? 'destructive' : 'default'"
              class="py-2 text-xs"
            >
              <AlertDescription>{{ lengthStatus.message }}</AlertDescription>
            </Alert>

            <!-- 模板输入框 -->
            <Textarea
              ref="inputInst"
              :model-value="template.template"
              placeholder="输入模板内容... 点击右侧变量可快速插入"
              class="template-input min-h-[140px] font-mono text-sm"
              @update:model-value="(val) => emit('update:template', { index: templateIndex, value: String(val) })"
            />

            <!-- 实时预览切换与区域 -->
            <div class="flex items-center justify-between mt-1">
              <Button
                size="xs"
                variant="ghost"
                class="px-2 flex items-center gap-1"
                @click="showLivePreview = !showLivePreview"
              >
                <component
                  :is="showLivePreview ? LiveOff24Regular : Code24Regular"
                  class="h-4 w-4"
                />
                {{ showLivePreview ? '隐藏预览' : '显示预览' }}
              </Button>
            </div>

            <div
              v-if="showLivePreview"
              class="live-preview-container"
            >
              <div class="live-preview-label flex items-center gap-1 text-xs">
                <AppsListDetail24Regular class="h-3.5 w-3.5" />
                <span>效果预览</span>
              </div>
              <div class="live-preview-content">
                <span
                  v-if="previewResult"
                  class="text-sm font-sans"
                  >{{ previewResult }}</span
                >
                <span
                  v-else
                  class="text-xs text-muted-foreground italic"
                  >等待输入...</span
                >
              </div>
            </div>
          </div>

          <div class="md:col-span-2">
            <div class="helper-container">
              <span class="text-xs text-muted-foreground block mb-1.5">可用变量 (点击插入)</span>
              <TemplateHelper
                :placeholders="mergedPlaceholders"
                @insert="handleVariableInsert"
              />
            </div>
          </div>
        </div>
      </TabsContent>

      <TabsContent
        value="examples"
        class="mt-0"
      >
        <div class="examples-container flex flex-col gap-4">
          <div
            v-for="(category, idx) in templateExamples"
            :key="idx"
            class="example-category"
          >
            <div class="font-semibold text-sm mb-2">
              {{ category.title }}
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Card
                v-for="(example, i) in category.examples"
                :key="i"
                class="example-card cursor-pointer hover:border-primary transition-colors p-3"
                @click="insertExample(example.template)"
              >
                <div class="example-header font-medium text-xs mb-1.5 text-foreground">
                  {{ example.label }}
                </div>
                <div class="example-code font-mono text-xs text-muted-foreground bg-muted/60 p-1.5 rounded truncate">
                  {{ example.template }}
                </div>
              </Card>
            </div>
          </div>
        </div>
      </TabsContent>
    </Tabs>

    <!-- 语法弹窗 -->
    <Dialog v-model:open="showSyntaxModal">
      <DialogContent class="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>模板语法与变量说明</DialogTitle>
        </DialogHeader>

        <ScrollArea class="h-[60vh] pr-4">
          <Alert class="mb-4">
            <AlertTitle class="text-sm font-bold mb-1"> 模板语法说明 </AlertTitle>
            <AlertDescription class="text-xs space-y-2">
              <p>模板支持插入变量和执行 JavaScript。</p>
              <Separator class="my-2" />
              <div>
                <strong>1. 简单变量替换:</strong><br />
                直接使用 <code>{{ '\{\{变量名.属性\}\}' }}</code> 插入值。<br />
                示例: <code>{{ '\{\{user.name\}\}' }}</code> → 显示用户名
              </div>
              <Separator class="my-2" />
              <div>
                <strong>2. JS 表达式求值 (<code>js:</code>):</strong><br />
                使用 <code>{{ '\{\{js: 表达式\}\}' }}</code> 执行单个 JS 表达式并插入结果 (隐式返回)。<br />
                适合简单计算、字符串操作、三元运算等。<br />
                示例: <code>{{ '\{\{js: user.guardLevel > 0 ? "舰长" : "非舰长\}\}' }}</code
                ><br />
                示例: <code>{{ '\{\{js: gift.price * gift.count\}\}' }}</code>
              </div>
              <Separator class="my-2" />
              <div>
                <strong>3. JS 代码块执行 (<code>js+:</code> 或 <code>js-run:</code>):</strong><br />
                使用 <code>{{ '\{\{js+: 代码...\}\}' }}</code> 执行多行 JS 代码。<br />
                <span class="text-amber-500 font-semibold"
                  >需要显式使用 <code>return</code> 语句来指定输出到模板的值。</span
                ><br />
                适合需要临时变量、多步逻辑或调用 <code>getData/setData</code> 等函数的场景。<br />
                <pre
                  class="bg-muted p-2 rounded mt-1 overflow-x-auto text-[11px]"
                ><code>{{ '\{\{js+:\n  const count = (getData(\'greetCount\') || 0) + 1;\n  setData(\'greetCount\', count);\n  return \`这是第 ${count} 次问候！\`;\n\}\}' }}</code></pre>
              </div>
            </AlertDescription>
          </Alert>

          <Accordion
            type="single"
            collapsible
            class="w-full mb-4"
          >
            <AccordionItem value="data-functions">
              <AccordionTrigger class="text-xs font-semibold">
                数据存储函数说明 (在 js+ 或 js-run 中使用)
              </AccordionTrigger>
              <AccordionContent class="text-xs space-y-3">
                <Alert
                  variant="default"
                  class="py-2"
                >
                  <AlertDescription>
                    <strong>运行时数据</strong>仅在本次运行有效, 重启后失效，且操作是<strong>同步</strong>的。
                  </AlertDescription>
                </Alert>
                <ul class="function-list space-y-1">
                  <li><code>getData(key, defaultValue?)</code>: 获取运行时数据。</li>
                  <li><code>setData(key, value)</code>: 设置运行时数据。</li>
                  <li><code>containsData(key)</code>: 检查运行时数据是否存在。</li>
                  <li><code>removeData(key)</code>: 移除运行时数据。</li>
                </ul>

                <Separator class="my-2" />

                <Alert
                  variant="default"
                  class="py-2"
                >
                  <AlertDescription>
                    <strong>持久化数据</strong>会长期保留，但操作是<strong>异步</strong>的 (返回 Promise)。<br />
                    在 <code>js+</code> 中使用 <code>await</code> 或 <code>.then()</code>。
                  </AlertDescription>
                </Alert>
                <ul class="function-list space-y-1">
                  <li><code>getStorageData(key, defaultValue?)</code>: 获取持久化数据 (异步)。</li>
                  <li><code>setStorageData(key, value)</code>: 设置持久化数据 (异步)。</li>
                  <li><code>hasStorageData(key)</code>: 检查持久化数据是否存在 (异步)。</li>
                  <li><code>removeStorageData(key)</code>: 移除持久化数据 (异步)。</li>
                  <li><code>clearStorageData()</code>: 清除所有用户持久化数据 (异步)。</li>
                </ul>
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          <div class="text-xs font-bold mb-2">可用变量 (基础):</div>
          <div class="space-y-1 text-xs">
            <div
              v-for="(ph, idx) in mergedPlaceholders"
              :key="idx"
              class="placeholder-item"
            >
              <code class="bg-muted px-1.5 py-0.5 rounded text-[11px] font-mono mr-1.5">{{ ph.name }}</code
              >: {{ ph.description }}
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  </Card>
</template>

<style scoped>
.live-preview-container {
  margin-top: 8px;
  background-color: var(--muted);
  border-radius: var(--radius);
  border: 1px solid var(--border);
  overflow: hidden;
}

.live-preview-label {
  padding: 4px 8px;
  background-color: var(--muted);
  color: var(--foreground);
  border-bottom: 1px solid var(--border);
}

.live-preview-content {
  padding: 8px 12px;
  word-break: break-all;
  min-height: 40px;
}

.function-list code {
  background-color: var(--muted);
  padding: 1px 4px;
  border-radius: var(--radius);
  font-family: monospace;
  margin-right: 4px;
}
</style>
