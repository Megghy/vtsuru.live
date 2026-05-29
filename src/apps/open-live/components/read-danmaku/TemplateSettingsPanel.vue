<script setup lang="ts">
import { Add20Filled, Delete20Filled } from '@vicons/fluent'
import {
  NButton, NCheckbox, NCollapse, NCollapseItem, NDivider,
  NFlex, NIcon, NInput, NInputNumber, NSelect, NSwitch, NText,
} from 'naive-ui'
import { reactive } from 'vue'
import { EventDataTypes } from '@/api/api-models'
import { copyToClipboard } from '@/shared/utils'
import {
  type ConditionField, type ConditionOp, type TemplateCondition, type TemplateRule,
  templateConstants, useSpeechService,
} from '@/store/useSpeechService'

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
  follow: [
    { label: '粉丝勋章等级', value: 'fans_medal_level' },
  ],
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

function getOpsForField(field: ConditionField) {
  return field === 'message' ? getTextOps() : getNumericOps()
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
  const defaultOp = defaultField === 'message' ? 'contains' : '>='
  rule.conditions.push({ field: defaultField, op: defaultOp as ConditionOp, value: defaultField === 'message' ? '' : 0 })
}

function removeCondition(rule: TemplateRule, index: number) {
  rule.conditions.splice(index, 1)
}

function onFieldChange(cond: TemplateCondition) {
  if (cond.field === 'message') {
    cond.op = 'contains'
    cond.value = ''
  } else {
    cond.op = '>='
    cond.value = 0
  }
}

function test(type: EventDataTypes) {
  const data: any = {
    type, uname: '测试用户', uid: 0, msg: '', price: 0, num: 0,
    time: Date.now(), guard_level: 0, fans_medal_level: 1,
    fans_medal_name: '', fans_medal_wearing_status: false,
    emoji: undefined, uface: '', open_id: '', ouid: '',
  }
  const map: Partial<Record<EventDataTypes, any>> = {
    [EventDataTypes.Message]: { msg: '测试弹幕' },
    [EventDataTypes.SC]: { msg: '测试留言', price: 30, num: 1 },
    [EventDataTypes.Guard]: { msg: '舰长', num: 1, guard_level: 3 },
    [EventDataTypes.Gift]: { msg: '测试礼物', price: 5, num: 5 },
  }
  Object.assign(data, map[type] ?? {})
  if (speechState.canSpeech) speechService.addToQueue(data)
  else speechService.forceSpeak(data)
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
  if (speechState.canSpeech) speechService.addToQueue(data)
  else speechService.forceSpeak(data)
}
</script>

<template>
  <div class="panel">
    <NText depth="3" style="font-size: 11px">
      每种类型可设置多条模板，按条件匹配；无条件的模板随机选一条播报。点击变量复制。
    </NText>

    <NFlex :size="4" :wrap="true" style="margin: 4px 0">
      <NButton
        v-for="item in Object.values(templateConstants)"
        :key="item.name"
        size="tiny" tertiary
        @click="copyToClipboard(item.words)"
      >
        {{ item.words }}
      </NButton>
    </NFlex>

    <NCollapse :default-expanded-names="['message']" accordion>
      <NCollapseItem
        v-for="row in templateRows" :key="row.eventKey"
        :name="row.eventKey"
      >
        <template #header>
          <NFlex align="center" :size="8" style="width: 100%">
            <NCheckbox
              :checked="settings.enabledEvents[row.eventKey as keyof typeof settings.enabledEvents]"
              @update:checked="(v: boolean) => settings.enabledEvents[row.eventKey as keyof typeof settings.enabledEvents] = v"
              @click.stop
            />
            <NText>{{ row.label }}</NText>
            <NText depth="3" style="font-size: 11px">
              ({{ settings.templates[row.eventKey]?.rules.length ?? 0 }} 条规则)
            </NText>
          </NFlex>
        </template>
        <template #header-extra>
          <NButton
            size="tiny" type="primary" tertiary
            :disabled="!settings.enabledEvents[row.eventKey as keyof typeof settings.enabledEvents]"
            :loading="speechState.isApiAudioLoading"
            @click.stop="test(row.type)"
          >
            测试
          </NButton>
        </template>
        <!-- Rules list for this event type -->
        <div class="rules-list">
          <div
            v-for="(rule, ri) in settings.templates[row.eventKey]?.rules ?? []"
            :key="ri"
            class="rule-card"
          >
            <div class="rule-header">
              <NText depth="3" style="font-size: 11px">
                规则 {{ ri + 1 }}
              </NText>
              <NButton size="tiny" tertiary type="error" @click="removeRule(row.eventKey, ri)">
                <template #icon>
                  <NIcon :component="Delete20Filled" />
                </template>
              </NButton>
            </div>
            <NInput
              v-model:value="rule.template"
              size="small"
              :placeholder="`模板文本，如: ${row.label}...`"
            />
            <div class="conditions-section">
              <NFlex align="center" :size="4" style="margin-bottom: 4px">
                <NText depth="3" style="font-size: 11px">
                  {{ rule.conditions.length === 0 ? '无条件 (随机选取)' : '条件 (全部满足时使用此模板)' }}
                </NText>
                <NButton size="tiny" tertiary type="primary" @click="addCondition(rule, row.eventKey)">
                  <template #icon>
                    <NIcon :component="Add20Filled" />
                  </template>
                  添加条件
                </NButton>
              </NFlex>
              <div v-for="(cond, ci) in rule.conditions" :key="ci" class="condition-row">
                <NSelect
                  v-model:value="cond.field"
                  :options="fieldOptionsByEvent[row.eventKey]"
                  size="small" style="width: 120px"
                  @update:value="() => onFieldChange(cond)"
                />
                <NSelect
                  v-model:value="cond.op"
                  :options="getOpsForField(cond.field)"
                  size="small" style="width: 80px"
                />
                <NInputNumber
                  v-if="cond.field !== 'message'"
                  :value="cond.value as number"
                  size="small" style="width: 100px" :min="0"
                  @update:value="(v: number | null) => cond.value = v ?? 0"
                />
                <NInput
                  v-else
                  :value="String(cond.value)"
                  size="small" style="width: 140px" placeholder="匹配内容"
                  @update:value="(v: string) => cond.value = v"
                />
                <NButton size="tiny" tertiary type="error" @click="removeCondition(rule, ci)">
                  <template #icon>
                    <NIcon :component="Delete20Filled" />
                  </template>
                </NButton>
              </div>
            </div>
          </div>
          <NButton size="tiny" tertiary type="primary" @click="addRule(row.eventKey)">
            <template #icon>
              <NIcon :component="Add20Filled" />
            </template>
            添加模板规则
          </NButton>
        </div>
      </NCollapseItem>
    </NCollapse>

    <NDivider style="margin: 4px 0" />

    <NCollapse>
      <NCollapseItem name="mock" title="模拟触发">
        <div class="mock-section">
          <NFlex :size="8" :wrap="true" align="center">
            <NSelect
              v-model:value="mockData.type"
              :options="mockTypeOptions"
              size="small" style="width: 90px"
            />
            <NInput v-model:value="mockData.uname" size="small" placeholder="用户名" style="width: 100px" />
            <NInput v-model:value="mockData.msg" size="small" placeholder="消息/礼物名" style="width: 140px" />
          </NFlex>
          <NFlex :size="8" :wrap="true" align="center">
            <NFlex align="center" :size="4">
              <NText depth="3" style="font-size: 11px">
                价格
              </NText>
              <NInputNumber v-model:value="mockData.price" size="small" :min="0" style="width: 80px" />
            </NFlex>
            <NFlex align="center" :size="4">
              <NText depth="3" style="font-size: 11px">
                数量
              </NText>
              <NInputNumber v-model:value="mockData.num" size="small" :min="0" style="width: 80px" />
            </NFlex>
            <NFlex align="center" :size="4">
              <NText depth="3" style="font-size: 11px">
                舰长
              </NText>
              <NInputNumber v-model:value="mockData.guard_level" size="small" :min="0" :max="3" style="width: 70px" />
            </NFlex>
            <NFlex align="center" :size="4">
              <NText depth="3" style="font-size: 11px">
                勋章
              </NText>
              <NInputNumber v-model:value="mockData.fans_medal_level" size="small" :min="0" :max="40" style="width: 70px" />
            </NFlex>
          </NFlex>
          <NButton size="small" type="primary" @click="fireMock">
            触发事件
          </NButton>
        </div>
      </NCollapseItem>
    </NCollapse>

    <NDivider style="margin: 4px 0" />

    <NFlex align="center" :size="8">
      <NSwitch v-model:value="settings.timedBroadcast.enabled" size="small" />
      <NText style="font-size: 12px">
        定时播报
      </NText>
      <NInputNumber
        v-model:value="settings.timedBroadcast.intervalMinutes"
        :min="1" :max="120" size="small"
        :disabled="!settings.timedBroadcast.enabled"
        style="width: 80px"
      />
      <NText depth="3" style="font-size: 11px">
        分钟/次
      </NText>
    </NFlex>

    <template v-if="settings.timedBroadcast.enabled">
      <div v-for="(_, i) in settings.timedBroadcast.texts" :key="i" class="broadcast-row">
        <NInput
          v-model:value="settings.timedBroadcast.texts[i]"
          size="small" placeholder="播报文本"
          style="flex: 1"
        />
        <NButton size="tiny" tertiary type="error" @click="settings.timedBroadcast.texts.splice(i, 1)">
          <template #icon>
            <NIcon :component="Delete20Filled" />
          </template>
        </NButton>
      </div>
      <NButton size="tiny" tertiary type="primary" @click="settings.timedBroadcast.texts.push('')">
        <template #icon>
          <NIcon :component="Add20Filled" />
        </template>
        添加播报文本
      </NButton>
    </template>
  </div>
</template>

<style scoped>
.panel {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.broadcast-row {
  display: flex;
  align-items: center;
  gap: 4px;
}
.rules-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.rule-card {
  border: 1px solid var(--n-border-color, #e0e0e0);
  border-radius: 6px;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.rule-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.conditions-section {
  margin-top: 4px;
}
.condition-row {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-bottom: 4px;
}
.mock-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
</style>