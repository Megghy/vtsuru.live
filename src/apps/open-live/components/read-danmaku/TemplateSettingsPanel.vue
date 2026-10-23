<script setup lang="ts">
import { Add20Filled, Delete20Filled } from '@vicons/fluent'
import { reactive } from 'vue'

import { EventDataTypes } from '@/api/generated/model'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/shared/ui/accordion'
import { Alert, AlertDescription } from '@/shared/ui/alert'
import { Button } from '@/shared/ui/button'
import { Checkbox } from '@/shared/ui/checkbox'
import { Input } from '@/shared/ui/input'
import { NumberField } from '@/shared/ui/number-field'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Separator } from '@/shared/ui/separator'
import { Switch } from '@/shared/ui/switch'
import { copyToClipboard, useMessage } from '@/shared/utils'
import {
  type ConditionField,
  type ConditionOp,
  type TemplateCondition,
  type TemplateRule,
  templateConstants,
  useSpeechService,
} from '@/store/useSpeechService'

withDefaults(defineProps<{ supportsFollow?: boolean }>(), {
  supportsFollow: true,
})

const message = useMessage()
const speechService = useSpeechService()
const { settings, speechState } = speechService

const templateRows = [
  { eventKey: 'message', label: '弹幕', type: EventDataTypes.Message },
  { eventKey: 'gift', label: '礼物', type: EventDataTypes.Gift },
  { eventKey: 'sc', label: 'SC', type: EventDataTypes.SC },
  { eventKey: 'guard', label: '上舰', type: EventDataTypes.Guard },
  { eventKey: 'enter', label: '进入', type: EventDataTypes.Enter },
  { eventKey: 'follow', label: '关注', type: EventDataTypes.Follow },
]

const fieldOptionsByEvent: Record<string, Array<{ label: string; value: ConditionField }>> = {
  message: [
    { label: '粉丝勋章等级', value: 'fans_medal_level' },
    { label: '舰长等级', value: 'guard_level' },
    { label: '消息字数', value: 'message_length' },
    { label: '消息内容', value: 'message' },
  ],
  gift: [
    { label: '价格 (元)', value: 'price' },
    { label: '数量', value: 'count' },
    { label: '礼物名称', value: 'gift_name' },
    { label: '粉丝勋章等级', value: 'fans_medal_level' },
    { label: '舰长等级', value: 'guard_level' },
  ],
  sc: [
    { label: '价格 (元)', value: 'price' },
    { label: '消息字数', value: 'message_length' },
    { label: '消息内容', value: 'message' },
    { label: '粉丝勋章等级', value: 'fans_medal_level' },
  ],
  guard: [
    { label: '舰长等级', value: 'guard_level' },
    { label: '数量 (月)', value: 'count' },
    { label: '粉丝勋章等级', value: 'fans_medal_level' },
  ],
  enter: [
    { label: '舰长等级', value: 'guard_level' },
    { label: '粉丝勋章等级', value: 'fans_medal_level' },
  ],
  follow: [{ label: '粉丝勋章等级', value: 'fans_medal_level' }],
}

function getNumericOps(): Array<{ label: string; value: ConditionOp }> {
  return [
    { label: '>=', value: '>=' },
    { label: '<=', value: '<=' },
    { label: '==', value: '==' },
  ]
}

function getTextOps(): Array<{ label: string; value: ConditionOp }> {
  return [
    { label: '包含', value: 'contains' },
    { label: '正则', value: 'regex' },
  ]
}

function isTextField(field: ConditionField): boolean {
  return field === 'message' || field === 'gift_name'
}

function getOpsForField(field: ConditionField) {
  return isTextField(field) ? getTextOps() : getNumericOps()
}

function addRule(eventKey: string) {
  const config = settings.value.templates[eventKey]
  if (!config) return
  config.rules.push({ template: '', conditions: [] })
}

function removeRule(eventKey: string, index: number) {
  settings.value.templates[eventKey]?.rules.splice(index, 1)
}

function addCondition(rule: TemplateRule, eventKey: string) {
  const fields = fieldOptionsByEvent[eventKey]
  const defaultField = fields?.[0]?.value ?? 'price'
  const defaultOp = isTextField(defaultField) ? 'contains' : '>='
  rule.conditions.push({ field: defaultField, op: defaultOp as ConditionOp, value: isTextField(defaultField) ? '' : 0 })
}

function removeCondition(rule: TemplateRule, index: number) {
  rule.conditions.splice(index, 1)
}

function onFieldChange(cond: TemplateCondition) {
  if (isTextField(cond.field)) {
    cond.op = 'contains'
    cond.value = ''
  } else {
    cond.op = '>='
    cond.value = 0
  }
}

function generateMockDataForEvent(eventKey: string, type: EventDataTypes, specificRule?: TemplateRule): any {
  const rules = specificRule ? [specificRule] : (settings.value.templates[eventKey]?.rules ?? [])

  const mock: any = {
    type,
    uname: '测试用户',
    uid: 10001,
    msg: '',
    price: 0,
    num: 1,
    time: Date.now(),
    guard_level: 0,
    fans_medal_level: 1,
    fans_medal_name: '粉丝勋章',
    fans_medal_wearing_status: true,
    emoji: undefined,
    uface: '',
    open_id: '',
    ouid: 'mock_uid_10001',
  }

  switch (type) {
    case EventDataTypes.Message:
      mock.msg = '测试弹幕消息'
      break
    case EventDataTypes.Gift:
      mock.msg = '测试礼物'
      mock.price = 5
      mock.num = 5
      break
    case EventDataTypes.SC:
      mock.msg = '测试醒目留言'
      mock.price = 30
      mock.num = 1
      break
    case EventDataTypes.Guard:
      mock.msg = '舰长'
      mock.guard_level = 3
      mock.num = 1
      break
    case EventDataTypes.Enter:
      mock.msg = '进入了直播间'
      mock.num = 0
      break
    case EventDataTypes.Follow:
      mock.msg = '关注了直播间'
      mock.num = 0
      break
  }

  const targetRule = specificRule || rules.find((r) => r.conditions.length > 0) || rules[0]
  if (targetRule?.conditions?.length) {
    for (const cond of targetRule.conditions) {
      const condVal = cond.value
      switch (cond.field) {
        case 'guard_level':
          mock.guard_level = Number(condVal) || 3
          break
        case 'fans_medal_level':
          mock.fans_medal_level = Number(condVal) || 10
          mock.fans_medal_wearing_status = true
          break
        case 'price':
          mock.price = Number(condVal) || 30
          break
        case 'count':
          mock.num = Number(condVal) || 1
          break
        case 'message':
        case 'gift_name':
          if (cond.op === 'contains') {
            mock.msg = condVal ? `包含${condVal}的测试内容` : mock.msg || '测试内容'
          } else if (cond.op === 'regex') {
            mock.msg = condVal ? String(condVal) : mock.msg || '测试内容'
          }
          break
        case 'message_length':
          mock.msg = '测'.repeat(Math.max(1, Number(condVal) || 5))
          break
      }
    }
  }

  return mock
}

function test(type: EventDataTypes, eventKey?: string, specificRule?: TemplateRule) {
  const actualKey = eventKey || templateRows.find((r) => r.type === type)?.eventKey || 'message'
  const mock = generateMockDataForEvent(actualKey, type, specificRule)
  const res = speechService.testEvent(mock)
  if (res.success) {
    message.success(`已触发测试播报: ${res.text}`)
  } else {
    message.warning(res.reason || '测试事件未满足当前任何模板规则，请检查条件设置')
  }
}

const mockTypeOptions = [
  { label: '弹幕', value: EventDataTypes.Message },
  { label: '礼物', value: EventDataTypes.Gift },
  { label: 'SC', value: EventDataTypes.SC },
  { label: '上舰', value: EventDataTypes.Guard },
  { label: '进入', value: EventDataTypes.Enter },
  { label: '关注', value: EventDataTypes.Follow },
]

const mockData = reactive({
  type: EventDataTypes.Message as EventDataTypes,
  uname: '模拟用户',
  msg: '模拟弹幕消息',
  price: 0,
  num: 1,
  guard_level: 0,
  fans_medal_level: 0,
})

function fireMock() {
  const data: any = {
    type: mockData.type,
    uname: mockData.uname,
    uid: 10000,
    msg: mockData.msg,
    price: mockData.price,
    num: mockData.num,
    guard_level: mockData.guard_level,
    fans_medal_level: mockData.fans_medal_level,
    fans_medal_name: '测试',
    fans_medal_wearing_status: mockData.fans_medal_level > 0,
    time: Date.now(),
    emoji: undefined,
    uface: '',
    open_id: '',
    ouid: '',
  }
  speechService.testEvent(data)
}
</script>

<template>
  <div class="flex flex-col gap-2.5">
    <Alert
      v-if="!supportsFollow"
      class="border-amber-500/30 bg-amber-50/50 dark:bg-amber-950/20 text-xs py-2"
    >
      <AlertDescription class="text-xs text-amber-700 dark:text-amber-400">
        开放平台不推送关注事件。关注播报需要使用桌面客户端的直连弹幕源。
      </AlertDescription>
    </Alert>

    <span class="text-[11px] text-muted-foreground">
      每种类型可设置多条模板，按条件匹配；无条件的模板随机选一条播报。点击变量复制。
    </span>

    <div class="flex flex-wrap gap-1 my-1">
      <Button
        v-for="item in Object.values(templateConstants)"
        :key="item.name"
        variant="outline"
        class="h-6 text-[11px] px-2"
        @click="copyToClipboard(item.words)"
      >
        {{ item.words }}
      </Button>
    </div>

    <Accordion
      type="single"
      collapsible
      default-value="message"
      class="border rounded-md px-3"
    >
      <AccordionItem
        v-for="row in templateRows"
        :key="row.eventKey"
        :value="row.eventKey"
        class="border-b last:border-b-0"
      >
        <div class="flex items-center justify-between py-2">
          <div class="flex items-center gap-2">
            <Checkbox
              :checked="settings.enabledEvents[row.eventKey as keyof typeof settings.enabledEvents]"
              :disabled="row.type === EventDataTypes.Follow && !supportsFollow"
              @update:checked="
                (v: boolean) => (settings.enabledEvents[row.eventKey as keyof typeof settings.enabledEvents] = v)
              "
              @click.stop
            />
            <span class="text-xs font-medium">{{ row.label }}</span>
            <span class="text-[11px] text-muted-foreground">
              ({{ settings.templates[row.eventKey]?.rules.length ?? 0 }} 条规则)
            </span>
          </div>
          <div class="flex items-center gap-2">
            <Button
              variant="outline"
              class="h-6 text-[11px] px-2 text-primary"
              :disabled="
                !settings.enabledEvents[row.eventKey as keyof typeof settings.enabledEvents] ||
                (row.type === EventDataTypes.Follow && !supportsFollow)
              "
              :loading="speechState.isApiAudioLoading"
              @click.stop="test(row.type, row.eventKey)"
            >
              测试
            </Button>
            <AccordionTrigger class="p-0 hover:no-underline" />
          </div>
        </div>

        <AccordionContent class="pb-3 pt-1">
          <div class="flex flex-col gap-2">
            <div
              v-for="(rule, ri) in settings.templates[row.eventKey]?.rules ?? []"
              :key="ri"
              class="border border-border rounded-md p-2 flex flex-col gap-1.5"
            >
              <div class="flex-between">
                <span class="text-[11px] text-muted-foreground">规则 {{ ri + 1 }}</span>
                <div class="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    class="h-6 text-[11px] px-2 text-primary hover:bg-primary/10"
                    :loading="speechState.isApiAudioLoading"
                    @click="test(row.type, row.eventKey, rule)"
                  >
                    测试此条
                  </Button>
                  <Button
                    variant="ghost"
                    class="h-6 w-6 p-0 text-destructive hover:bg-destructive/10"
                    @click="removeRule(row.eventKey, ri)"
                  >
                    <Delete20Filled class="size-3.5" />
                  </Button>
                </div>
              </div>
              <Input
                v-model="rule.template"
                :placeholder="`模板文本，如: ${row.label}...`"
              />
              <div class="mt-1">
                <div class="flex items-center justify-between mb-1">
                  <span class="text-[11px] text-muted-foreground">
                    {{ rule.conditions.length === 0 ? '无条件 (随机选取)' : '条件 (全部满足时使用此模板)' }}
                  </span>
                  <Button
                    variant="outline"
                    class="h-6 text-[11px] px-2 gap-1"
                    @click="addCondition(rule, row.eventKey)"
                  >
                    <Add20Filled class="size-3" />
                    添加条件
                  </Button>
                </div>
                <div
                  v-for="(cond, ci) in rule.conditions"
                  :key="ci"
                  class="flex items-center gap-1 mb-1"
                >
                  <Select
                    v-model="cond.field"
                    @update:model-value="() => onFieldChange(cond)"
                  >
                    <SelectTrigger
                      size="xs"
                      class="w-[120px]"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem
                        v-for="f in fieldOptionsByEvent[row.eventKey]"
                        :key="f.value"
                        :value="f.value"
                        class="text-xs"
                      >
                        {{ f.label }}
                      </SelectItem>
                    </SelectContent>
                  </Select>

                  <Select v-model="cond.op">
                    <SelectTrigger
                      size="xs"
                      class="w-[80px]"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem
                        v-for="op in getOpsForField(cond.field)"
                        :key="op.value"
                        :value="op.value"
                        class="text-xs"
                      >
                        {{ op.label }}
                      </SelectItem>
                    </SelectContent>
                  </Select>

                  <div
                    v-if="!isTextField(cond.field)"
                    class="w-[100px]"
                  >
                    <NumberField
                      :model-value="cond.value as number"
                      :min="0"
                      @update:model-value="(v: number | null) => (cond.value = v ?? 0)"
                    />
                  </div>
                  <Input
                    size="xs"
                    v-else
                    :model-value="String(cond.value)"
                    class="w-[140px]"
                    placeholder="匹配内容"
                    @update:model-value="(v: string | number) => (cond.value = v)"
                  />

                  <Button
                    size="xs"
                    variant="ghost"
                    class="w-7 p-0 text-destructive hover:bg-destructive/10"
                    @click="removeCondition(rule, ci)"
                  >
                    <Delete20Filled class="size-3.5" />
                  </Button>
                </div>
              </div>
            </div>
            <Button
              variant="outline"
              class="gap-1 w-fit"
              @click="addRule(row.eventKey)"
            >
              <Add20Filled class="size-3.5" />
              添加模板规则
            </Button>
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>

    <Separator class="my-1" />

    <Accordion
      type="single"
      collapsible
      class="border rounded-md px-3"
    >
      <AccordionItem
        value="mock"
        class="border-none"
      >
        <AccordionTrigger class="py-2 text-xs hover:no-underline font-medium"> 模拟触发 </AccordionTrigger>
        <AccordionContent class="pb-3">
          <div class="flex flex-col gap-2 text-xs">
            <div class="flex items-center gap-2 flex-wrap">
              <Select
                :model-value="String(mockData.type)"
                @update:model-value="mockData.type = Number($event)"
              >
                <SelectTrigger
                  size="xs"
                  class="w-[90px]"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem
                    v-for="opt in mockTypeOptions"
                    :key="opt.value"
                    :value="String(opt.value)"
                    class="text-xs"
                  >
                    {{ opt.label }}
                  </SelectItem>
                </SelectContent>
              </Select>
              <Input
                size="xs"
                v-model="mockData.uname"
                class="w-[100px]"
                placeholder="用户名"
              />
              <Input
                size="xs"
                v-model="mockData.msg"
                class="w-[140px]"
                placeholder="消息/礼物名"
              />
            </div>
            <div class="flex items-center gap-3 flex-wrap">
              <div class="flex items-center gap-1.5">
                <span class="text-[11px] text-muted-foreground">价格</span>
                <div class="w-[80px]">
                  <NumberField
                    v-model="mockData.price"
                    :min="0"
                  />
                </div>
              </div>
              <div class="flex items-center gap-1.5">
                <span class="text-[11px] text-muted-foreground">数量</span>
                <div class="w-[80px]">
                  <NumberField
                    v-model="mockData.num"
                    :min="0"
                  />
                </div>
              </div>
              <div class="flex items-center gap-1.5">
                <span class="text-[11px] text-muted-foreground">舰长</span>
                <div class="w-[70px]">
                  <NumberField
                    v-model="mockData.guard_level"
                    :min="0"
                    :max="3"
                  />
                </div>
              </div>
              <div class="flex items-center gap-1.5">
                <span class="text-[11px] text-muted-foreground">勋章</span>
                <div class="w-[70px]">
                  <NumberField
                    v-model="mockData.fans_medal_level"
                    :min="0"
                    :max="40"
                  />
                </div>
              </div>
            </div>
            <Button
              class="w-fit"
              @click="fireMock"
            >
              触发事件
            </Button>
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>

    <Separator class="my-1" />

    <div class="flex items-center gap-2 text-xs">
      <Switch
        :checked="settings.timedBroadcast.enabled"
        @update:checked="settings.timedBroadcast.enabled = $event"
      />
      <span>定时播报</span>
      <div class="w-[80px]">
        <NumberField
          v-model="settings.timedBroadcast.intervalMinutes"
          :min="1"
          :max="120"
          :disabled="!settings.timedBroadcast.enabled"
        />
      </div>
      <span class="text-[11px] text-muted-foreground">分钟/次</span>
    </div>

    <template v-if="settings.timedBroadcast.enabled">
      <div
        v-for="(_, i) in settings.timedBroadcast.texts"
        :key="i"
        class="flex items-center gap-1"
      >
        <Input
          size="xs"
          v-model="settings.timedBroadcast.texts[i]"
          class="flex-1"
          placeholder="播报文本"
        />
        <Button
          size="xs"
          variant="ghost"
          class="w-7 p-0 text-destructive hover:bg-destructive/10"
          @click="settings.timedBroadcast.texts.splice(i, 1)"
        >
          <Delete20Filled class="size-3.5" />
        </Button>
      </div>
      <Button
        variant="outline"
        class="gap-1 w-fit"
        @click="settings.timedBroadcast.texts.push('')"
      >
        <Add20Filled class="size-3.5" />
        添加播报文本
      </Button>
    </template>
  </div>
</template>
