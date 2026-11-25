<script setup lang="ts">
import { Code, Info, List, Radio } from 'lucide-vue-next'
import { useDebounceFn } from '@vueuse/core'
import { computed, nextTick, ref, watch } from 'vue'
import { toast } from 'vue-sonner'

import { EventDataTypes } from '@/api/generated/model'
import { evaluateTemplateExpressions } from '@/apps/client/store/autoAction/expressionEvaluator'
import type { AutoActionItem } from '@/apps/client/store/autoAction/types'
import { TriggerType } from '@/apps/client/store/autoAction/types'
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

import type { Placeholder } from './placeholders'
import { getMergedPlaceholders } from './placeholders'
import TemplateHelper from './TemplateHelper.vue'

const props = withDefaults(
  defineProps<{
    template: AutoActionItem
    title?: string
    description?: string
    checkLength?: boolean
    customTestContext?: Record<string, any>
    extraPlaceholders?: Placeholder[]
    templateIndex?: number
  }>(),
  {
    title: '模板编辑',
    description: '',
    checkLength: true,
    customTestContext: undefined,
    extraPlaceholders: undefined,
    templateIndex: 0,
  },
)

const emit = defineEmits<{
  (e: 'update:template', payload: { index: number; value: string }): void
}>()

const mergedPlaceholders = computed(() => {
  const base = getMergedPlaceholders(props.template.triggerType)
  if (!props.extraPlaceholders?.length) return base
  const combined = [...props.extraPlaceholders, ...base]
  return Array.from(new Map(combined.map((item) => [item.name, item])).values())
})

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

function buildPreviewPayload(triggerType: TriggerType) {
  const baseEvent = {
    msg: '早安主播！',
    time: 1713542400,
    num: 1,
    price: 50,
    guard_level: 3,
    uname: '测试用户',
    uface: 'https://example.com/test.jpg',
    uid: 12345,
    ouid: '1234567890',
    type: EventDataTypes.Message,
    open_id: '1234567890',
    fans_medal_level: 10,
    fans_medal_name: '测试粉丝勋章',
    fans_medal_wearing_status: true,
  }

  switch (triggerType) {
    case TriggerType.GIFT:
      return {
        event: { ...baseEvent, type: EventDataTypes.Gift, msg: '小花花', num: 5, price: 50 },
      }
    case TriggerType.SUPER_CHAT:
      return {
        event: { ...baseEvent, type: EventDataTypes.SC, msg: '主播加油！', price: 50 },
      }
    case TriggerType.GUARD:
      return {
        event: { ...baseEvent, type: EventDataTypes.Guard, msg: '舰长', price: 198, guard_level: 3 },
        extra: {
          guard: {
            level: 3,
            levelName: '舰长',
            giftCode: 'GUARD-DEMO-8888',
          },
        },
      }
    case TriggerType.POINT_REDEEM:
      return {
        event: { ...baseEvent, type: EventDataTypes.Gift, msg: '测试整活道具', num: 1, price: 100 },
        extra: {
          pointOrder: {
            orderId: 99999,
            goodsId: 1,
            goodsName: '测试整活道具',
            goodsType: 0,
            count: 1,
            point: 100,
            isFree: false,
            buyerName: '测试用户',
            buyerUid: 12345,
            buyerOpenId: '1234567890',
            remark: '请主播摆个造型',
            selectedSubItems: ['默认款式'],
            subItems: '默认款式',
            timestamp: Date.now(),
          },
        },
      }
    case TriggerType.SONG_REQUEST:
    case TriggerType.SONG_START:
      return {
        event: { ...baseEvent, type: EventDataTypes.Message, msg: '打上花火' },
        extra: {
          song: {
            id: 99999,
            name: '打上花火',
            author: 'DAOKO / 米津玄师',
            requester: '测试观众',
            requesterUid: 12345,
            requesterOpenId: '1234567890',
            source: '弹幕点歌',
            price: 0,
            isPriority: false,
            keyShift: '+2',
            queueCount: 3,
            timestamp: Date.now(),
          },
        },
      }
    case TriggerType.QUEUE_JOIN:
    case TriggerType.QUEUE_NEXT_BATCH:
      return {
        event: { ...baseEvent, type: EventDataTypes.Message, msg: '艾欧尼亚 #2333' },
        extra: {
          queue: {
            id: 99999,
            userName: '测试观众A',
            uid: 12345,
            openId: '1234567890',
            content: '艾欧尼亚 #2333',
            source: '弹幕排队',
            names: '测试观众A、测试观众B、测试观众C、测试观众D',
            count: 4,
            waitingCount: 6,
            batchNo: 2,
            teamSize: 4,
            nextNames: '测试观众E、测试观众F',
            timestamp: Date.now(),
          },
        },
      }
    default:
      return { event: baseEvent }
  }
}

const activeTab = ref('editor')
const showLivePreview = ref(true)
const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' })
const showSyntaxModal = ref(false)
const inputInst = ref<{ $el?: HTMLElement } | HTMLTextAreaElement | null>(null)

function countGraphemes(value: string) {
  return [...segmenter.segment(value)].length
}

const MAX_LENGTH = 40
const WARNING_THRESHOLD = 32

function evaluateTemplateForUI(template: string): string {
  const { event, extra } = buildPreviewPayload(props.template.triggerType)
  // dryRun=true：使用内存只读隔离沙盒，实时打字预览绝不污染真实 sessionStorage 或持久化存储
  const executionContext = buildExecutionContext(
    event,
    undefined,
    props.template.triggerType,
    extra,
    { dryRun: true },
  )

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

watch(() => [props.template.template, showLivePreview.value, props.template.triggerType], updatePreview, {
  immediate: true,
})

const isEmptyTemplate = computed(() => typeof props.template.template !== 'string' || !props.template.template.trim())

const previewLines = computed(() =>
  evaluatedTemplateResult.value
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0),
)

// 按每行独立计算字数（多行模板每次仅发送其中一行，不再把所有候选行长度相加导致误报超长）
const lengthStatus = computed(() => {
  if (isEmptyTemplate.value || !props.checkLength || !showLivePreview.value) {
    return { status: 'normal' as const, message: '' }
  }
  const formattedText = evaluatedTemplateResult.value
  if (!formattedText || formattedText.startsWith('[预览错误:')) {
    return { status: 'normal' as const, message: '' }
  }

  const lines = previewLines.value
  if (lines.length === 0) return { status: 'normal' as const, message: '' }

  let maxLen = 0
  let longestLineIdx = 0
  lines.forEach((line, idx) => {
    const len = countGraphemes(line)
    if (len > maxLen) {
      maxLen = len
      longestLineIdx = idx
    }
  })

  const prefix = lines.length > 1 ? `第 ${longestLineIdx + 1} 行预览长度` : '预览长度'
  if (maxLen > MAX_LENGTH) {
    return { status: 'error' as const, message: `${prefix}超出 B 站弹幕限制（${maxLen}/${MAX_LENGTH} 字）` }
  }
  if (maxLen >= WARNING_THRESHOLD) {
    return { status: 'warning' as const, message: `${prefix}接近弹幕上限（${maxLen}/${MAX_LENGTH} 字）` }
  }
  return { status: 'normal' as const, message: '' }
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
        label: '触发持久化计数 (异步副作用)',
        template:
          "{{js+: const key = 'user:' + user.uid + ':totalMessages'; getStorageData(key, 0).then(c => setStorageData(key, (c || 0) + 1)); return '已记录本次互动~'; }}",
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
  activeTab.value = 'editor'
  toast.success('已填入示例模板')
}

function resolveTextareaEl(): HTMLTextAreaElement | null {
  const inst = inputInst.value
  if (!inst) return null
  if (inst instanceof HTMLTextAreaElement) return inst
  if (inst.$el instanceof HTMLTextAreaElement) return inst.$el
  return inst.$el?.querySelector('textarea') ?? null
}

function handleVariableInsert(text: string) {
  const inputEl = resolveTextareaEl()
  let newTemplate = props.template.template || ''

  if (inputEl) {
    const start = inputEl.selectionStart ?? newTemplate.length
    const end = inputEl.selectionEnd ?? newTemplate.length
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
  <Card class="template-editor-card">
    <CardHeader class="p-3 border-b flex flex-row items-center justify-between space-y-0">
      <div>
        <CardTitle class="text-xs font-semibold">
          {{ title }}
        </CardTitle>
        <p
          v-if="description"
          class="text-[11px] text-muted-foreground mt-0.5"
        >
          {{ description }}
        </p>
      </div>
      <Button
        v-if="mergedPlaceholders.length > 0"
        variant="ghost"
        size="xs"
        class="gap-1 shrink-0"
        @click="showSyntaxModal = true"
      >
        <Info class="size-3.5" />
        语法说明
      </Button>
    </CardHeader>

    <CardContent class="p-3">
      <Tabs
        v-model="activeTab"
        class="editor-tabs w-full"
      >
        <TabsList class="mb-3">
          <TabsTrigger value="editor">编辑模板</TabsTrigger>
          <TabsTrigger value="examples">示例库</TabsTrigger>
        </TabsList>

        <TabsContent
          value="editor"
          class="mt-0"
        >
          <div class="grid grid-cols-1 md:grid-cols-5 gap-3.5">
            <div class="md:col-span-3 flex flex-col gap-2 min-w-0">
              <!-- 空模板警告 -->
              <Alert
                v-if="isEmptyTemplate"
                size="sm"
                variant="warning"
              >
                <AlertDescription class="m-0">模板内容为空，该规则触发时不会发送任何消息。</AlertDescription>
              </Alert>

              <!-- 单行长度超限检查 -->
              <Alert
                v-else-if="checkLength && lengthStatus.message && lengthStatus.status !== 'normal'"
                size="sm"
                :variant="lengthStatus.status === 'error' ? 'destructive' : 'warning'"
              >
                <AlertDescription class="m-0">{{ lengthStatus.message }}</AlertDescription>
              </Alert>

              <!-- 模板输入框 -->
              <Textarea
                ref="inputInst"
                :model-value="template.template"
                placeholder="输入模板内容... 多行输入时每次触发将按行随机（或顺序）发送其中一条；点击右侧变量可快速插入"
                class="template-input min-h-[140px] font-mono"
                @update:model-value="(val) => emit('update:template', { index: templateIndex, value: String(val) })"
              />

              <!-- 实时预览切换与沙盒预览区 -->
              <div class="flex-between">
                <Button
                  size="xs"
                  variant="ghost"
                  class="gap-1 px-2"
                  @click="showLivePreview = !showLivePreview"
                >
                  <component
                    :is="showLivePreview ? Radio : Code"
                    class="size-3.5"
                  />
                  {{ showLivePreview ? '隐藏预览' : '显示预览' }}
                </Button>
                <span class="text-[11px] text-muted-foreground">沙盒预览 · 不写入真实存储</span>
              </div>

              <div
                v-if="showLivePreview"
                class="bg-muted/40 rounded-md border border-border overflow-hidden"
              >
                <div class="py-1 px-2.5 bg-muted/60 text-foreground border-b border-border flex items-center gap-1.5 text-xs">
                  <List class="size-3.5" />
                  <span>效果预览</span>
                </div>
                <div class="p-2.5 break-all min-h-[40px] space-y-1">
                  <template v-if="previewLines.length > 0">
                    <div
                      v-for="(line, idx) in previewLines"
                      :key="idx"
                      class="text-xs font-sans text-foreground flex items-baseline gap-2"
                    >
                      <span
                        v-if="previewLines.length > 1"
                        class="text-[11px] text-muted-foreground tabular-nums shrink-0"
                      >
                        #{{ idx + 1 }}
                      </span>
                      <span class="flex-1">{{ line }}</span>
                      <span
                        v-if="checkLength"
                        class="text-[11px] tabular-nums shrink-0"
                        :class="countGraphemes(line) > MAX_LENGTH ? 'text-destructive font-semibold' : 'text-muted-foreground'"
                      >
                        {{ countGraphemes(line) }}/{{ MAX_LENGTH }}
                      </span>
                    </div>
                  </template>
                  <span
                    v-else
                    class="text-xs text-muted-foreground italic"
                  >
                    等待输入...
                  </span>
                </div>
              </div>
            </div>

            <div class="md:col-span-2 min-w-0">
              <span class="text-xs text-muted-foreground block mb-1.5">可用变量（点击插入）</span>
              <TemplateHelper
                :placeholders="mergedPlaceholders"
                @insert="handleVariableInsert"
              />
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
              <div class="font-semibold text-xs mb-2">
                {{ category.title }}
              </div>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
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
    </CardContent>

    <!-- 语法弹窗 -->
    <Dialog v-model:open="showSyntaxModal">
      <DialogContent class="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle class="text-sm">模板语法与变量说明</DialogTitle>
        </DialogHeader>

        <ScrollArea class="h-[60vh] pr-3 [&_[data-reka-scroll-area-viewport]>div]:!block">
          <Alert class="mb-4">
            <AlertTitle class="text-xs font-bold mb-1">模板语法说明</AlertTitle>
            <AlertDescription class="space-y-2 text-xs">
              <p>模板支持变量替换与同步 JavaScript 表达式求值；每行视为一条独立候选文案。</p>
              <Separator class="my-2" />
              <div>
                <strong>1. 简单变量替换：</strong><br />
                直接使用 <code v-pre>{{变量名.属性}}</code> 插入值，例如 <code v-pre>{{user.name}}</code>。
              </div>
              <Separator class="my-2" />
              <div>
                <strong>2. JS 表达式求值 (<code>js:</code>)：</strong><br />
                使用 <code v-pre>{{js: 表达式}}</code> 执行单个 JS 表达式并隐式返回结果。<br />
                示例：<code v-pre>{{js: user.guardLevel > 0 ? "舰长" : "观众"}}</code>
              </div>
              <Separator class="my-2" />
              <div>
                <strong>3. JS 代码块 (<code>js+:</code> 或 <code>js-run:</code>)：</strong><br />
                执行多行同步 JS 代码，<span class="text-amber-500 font-semibold">必须使用 <code>return</code> 返回输出文本</span>。<br />
                <pre
                  v-pre
                  class="bg-muted p-2 rounded mt-1 overflow-x-auto text-[11px]"
                ><code>{{js+:
  const count = (getData('greetCount') || 0) + 1;
  setData('greetCount', count);
  return `这是第 ${count} 次问候！`;
}}</code></pre>
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
                数据存储函数说明（在 js+ / js-run 中使用）
              </AccordionTrigger>
              <AccordionContent class="text-xs space-y-3">
                <Alert size="sm">
                  <AlertDescription>
                    <strong>运行时数据</strong>仅在本次客户端运行期间有效，读写均为<strong>同步</strong>操作，可直接参与返回值计算。
                  </AlertDescription>
                </Alert>
                <ul
                  class="space-y-1 [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:font-mono [&_code]:mr-1"
                >
                  <li><code>getData(key, defaultValue?)</code>: 获取运行时数据</li>
                  <li><code>setData(key, value)</code>: 设置运行时数据</li>
                  <li><code>containsData(key)</code>: 检查运行时数据是否存在</li>
                  <li><code>removeData(key)</code>: 移除运行时数据</li>
                </ul>

                <Separator class="my-2" />

                <Alert size="sm">
                  <AlertDescription>
                    <strong>持久化数据</strong>会长期保存到本地存储，操作返回 <code>Promise</code>。注意：模板求值为<strong>同步执行</strong>，不支持 <code>await</code>，请使用 <code>.then()</code> 触发异步读写副作用。
                  </AlertDescription>
                </Alert>
                <ul
                  class="space-y-1 [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:font-mono [&_code]:mr-1"
                >
                  <li><code>getStorageData(key, defaultValue?)</code>: 获取持久化数据 (Promise)</li>
                  <li><code>setStorageData(key, value)</code>: 写入持久化数据 (Promise)</li>
                  <li><code>hasStorageData(key)</code>: 检查持久化键是否存在 (Promise)</li>
                  <li><code>removeStorageData(key)</code>: 删除持久化键 (Promise)</li>
                  <li><code>clearStorageData()</code>: 清空全部用户持久化数据 (Promise)</li>
                </ul>
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          <div class="text-xs font-bold mb-2">当前可用变量：</div>
          <div class="space-y-1 text-xs">
            <div
              v-for="ph in mergedPlaceholders"
              :key="ph.name"
              class="placeholder-item"
            >
              <code class="bg-muted px-1.5 py-0.5 rounded text-[11px] font-mono mr-1.5">{{ ph.name }}</code>:
              {{ ph.description }}
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  </Card>
</template>
