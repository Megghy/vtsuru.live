<script setup lang="ts">
import { AlertCircle, CheckCircle2, FlaskConical, Play, Send } from 'lucide-vue-next'
import { computed, reactive, ref, watch } from 'vue'
import { toast } from 'vue-sonner'

import type { AutoActionItem, SingleActionTestResult } from '@/apps/client/store/autoAction/types'
import { LIFECYCLE_TRIGGER_TYPES, OBS_ACTION_TYPES } from '@/apps/client/store/autoAction/types'
import { ActionType, TriggerType, useAutoAction } from '@/apps/client/store/useAutoAction'
import { Alert, AlertDescription, AlertTitle } from '@/shared/ui/alert'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { FormField } from '@/shared/ui/form-field'
import { Input } from '@/shared/ui/input'
import { NumberField } from '@/shared/ui/number-field'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { SettingRow } from '@/shared/ui/setting-row'
import { Switch } from '@/shared/ui/switch'

const props = defineProps<{
  open: boolean
  action: AutoActionItem | null
}>()

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
}>()

const autoActionStore = useAutoAction()

const mock = reactive({
  uname: '测试用户',
  uid: 10004,
  msg: '测试弹幕消息',
  giftName: '小花花',
  giftNum: 5,
  giftPrice: 10,
  guardLevel: '3',
  scPrice: 50,
  scMsg: '主播加油！',
  hasMedal: true,
  medalLevel: 12,
  goodsId: 1,
  goodsName: '测试整活道具',
  point: 100,
  count: 1,
  isFree: false,
})

const lastResult = ref<SingleActionTestResult | null>(null)

const actionTypeLabel = computed(() => {
  if (!props.action) return ''
  switch (props.action.actionType) {
    case ActionType.SEND_DANMAKU:
      return '发送弹幕'
    case ActionType.SEND_PRIVATE_MSG:
      return '发送私信'
    case ActionType.SEND_NOTIFICATION:
      return '客户端通知'
    case ActionType.OBS_NOTIFY:
      return 'OBS 浮窗通知'
    case ActionType.SPEAK_TTS:
      return 'TTS 语音播报'
    case ActionType.SEND_WEBHOOK:
      return 'Webhook 请求'
    case ActionType.PLAY_AUDIO:
      return '播放音效'
    case ActionType.PNGTUBER_EXPRESSION:
      return 'PNGtuber 表情'
    default:
      if (OBS_ACTION_TYPES.has(props.action.actionType)) return 'OBS 联动'
      return 'VTS 联动'
  }
})

watch(
  () => [props.open, props.action?.id],
  ([isOpen]) => {
    if (isOpen && props.action) {
      // 为弹幕规则预填第一条非正则关键词，方便直接验证命中
      if (
        props.action.triggerType === TriggerType.DANMAKU &&
        props.action.triggerConfig.keywords &&
        props.action.triggerConfig.keywords.length > 0
      ) {
        mock.msg = props.action.triggerConfig.keywords[0]
      } else {
        mock.msg = '测试弹幕消息'
      }
      runTest(true)
    } else {
      lastResult.value = null
    }
  },
)

function buildTestPayload() {
  if (!props.action) return {}
  const tt = props.action.triggerType
  if (tt === TriggerType.POINT_REDEEM) {
    return {
      mockEvent: {
        uname: mock.uname,
        uid: mock.uid,
        fans_medal_wearing_status: mock.hasMedal,
        fans_medal_level: mock.medalLevel,
        guard_level: Number(mock.guardLevel),
      },
      mockPointOrder: {
        GoodsId: mock.goodsId,
        GoodsName: mock.goodsName,
        Point: mock.isFree ? 0 : mock.point,
        Count: mock.count,
        IsFree: mock.isFree,
        BuyerName: mock.uname,
        BuyerUid: mock.uid,
      },
    }
  }

  return {
    mockEvent: {
      uname: mock.uname,
      uid: mock.uid,
      fans_medal_wearing_status: mock.hasMedal,
      fans_medal_level: mock.medalLevel,
      guard_level: Number(mock.guardLevel),
      ...(tt === TriggerType.DANMAKU ? { msg: mock.msg } : {}),
      ...(tt === TriggerType.GIFT ? { msg: mock.giftName, num: mock.giftNum, price: mock.giftPrice } : {}),
      ...(tt === TriggerType.SUPER_CHAT ? { msg: mock.scMsg, price: mock.scPrice } : {}),
      ...(tt === TriggerType.GUARD
        ? {
            msg: mock.guardLevel === '1' ? '总督' : mock.guardLevel === '2' ? '提督' : '舰长',
            price: mock.guardLevel === '1' ? 19998 : mock.guardLevel === '2' ? 1998 : 198,
          }
        : {}),
    },
  }
}

function runTest(dryRun: boolean) {
  if (!props.action) return
  const payload = buildTestPayload()
  const res = autoActionStore.testSingleAction(props.action, {
    dryRun,
    ...payload,
  })
  lastResult.value = res
  if (!dryRun) {
    if (res.executed) {
      toast.success('已真实触发该规则（请留意直播间/私信或执行历史）')
    } else {
      toast.warning(res.error || res.reason || '未能执行该规则')
    }
  }
}
</script>

<template>
  <Dialog
    :open="open"
    @update:open="emit('update:open', $event)"
  >
    <DialogContent class="sm:max-w-[540px]">
      <DialogHeader>
        <div class="flex items-center gap-2">
          <FlaskConical class="size-4 text-primary" />
          <DialogTitle class="text-sm">单条规则沙盒测试</DialogTitle>
          <Badge
            v-if="action"
            variant="secondary"
            size="xs"
          >
            {{ actionTypeLabel }}
          </Badge>
        </div>
        <DialogDescription class="text-xs">
          {{ action?.name || '未命名规则' }} — 模拟匹配使用只读隔离沙盒，不会发送消息或污染本地数据。
        </DialogDescription>
      </DialogHeader>

      <div
        v-if="action"
        class="space-y-3 py-1 max-h-[65vh] overflow-y-auto scrollbar-thin pr-1"
      >
        <!-- 定时任务 / 状态触发器无事件字段 -->
        <Alert
          v-if="action.triggerType === TriggerType.SCHEDULED || LIFECYCLE_TRIGGER_TYPES.has(action.triggerType)"
          size="sm"
        >
          <AlertDescription>
            {{
              action.triggerType === TriggerType.SCHEDULED
                ? '定时发送规则不依赖观众事件，可直接预览当前模板渲染结果或真实触发一次。'
                : '状态与告警规则由客户端运行状态变化触发，可直接预览模板渲染结果或真实模拟触发一次。'
            }}
          </AlertDescription>
        </Alert>

        <!-- 事件模拟输入 -->
        <div
          v-else
          class="space-y-2.5 p-3 rounded-md border bg-muted/20"
        >
          <span class="text-xs font-semibold text-foreground block">模拟事件参数</span>

          <div class="grid grid-cols-2 gap-2.5">
            <FormField
              label="模拟用户名"
              class="min-w-0"
            >
              <Input v-model="mock.uname" />
            </FormField>

            <FormField
              label="用户 UID"
              class="min-w-0"
            >
              <NumberField
                v-model="mock.uid"
                :min="1"
                :show-buttons="false"
              />
            </FormField>
          </div>

          <FormField
            v-if="action.triggerType === TriggerType.DANMAKU"
            label="模拟弹幕内容"
          >
            <Input
              v-model="mock.msg"
              placeholder="输入用于测试关键词/正则的弹幕..."
            />
          </FormField>

          <div
            v-if="action.triggerType === TriggerType.GIFT"
            class="grid grid-cols-3 gap-2"
          >
            <FormField
              label="礼物名称"
              class="min-w-0"
            >
              <Input v-model="mock.giftName" />
            </FormField>
            <FormField
              label="数量"
              class="min-w-0"
            >
              <NumberField
                v-model="mock.giftNum"
                :min="1"
              />
            </FormField>
            <FormField
              label="总价值 (元，0=免费)"
              class="min-w-0"
            >
              <NumberField
                v-model="mock.giftPrice"
                :min="0"
              />
            </FormField>
          </div>

          <div
            v-if="action.triggerType === TriggerType.SUPER_CHAT"
            class="grid grid-cols-3 gap-2"
          >
            <FormField
              label="SC 金额 (元)"
              class="min-w-0"
            >
              <NumberField
                v-model="mock.scPrice"
                :min="1"
              />
            </FormField>
            <FormField
              label="SC 留言"
              class="col-span-2 min-w-0"
            >
              <Input v-model="mock.scMsg" />
            </FormField>
          </div>

          <div
            v-if="action.triggerType === TriggerType.POINT_REDEEM"
            class="space-y-2"
          >
            <div class="grid grid-cols-3 gap-2">
              <FormField
                label="商品 ID"
                class="min-w-0"
              >
                <NumberField
                  v-model="mock.goodsId"
                  :min="1"
                  :show-buttons="false"
                />
              </FormField>
              <FormField
                label="商品名称"
                class="col-span-2 min-w-0"
              >
                <Input v-model="mock.goodsName" />
              </FormField>
            </div>
            <div class="grid grid-cols-2 gap-2">
              <FormField
                label="消耗积分"
                class="min-w-0"
              >
                <NumberField
                  v-model="mock.point"
                  :min="0"
                />
              </FormField>
              <SettingRow
                variant="compact"
                title="免费商品"
                class="self-end"
              >
                <Switch v-model:checked="mock.isFree" />
              </SettingRow>
            </div>
          </div>

          <!-- 通用身份属性（舰队等级 & 粉丝勋章） -->
          <div class="grid grid-cols-3 gap-2 pt-1 border-t border-border/60">
            <FormField
              label="大航海身份"
              class="min-w-0"
            >
              <Select v-model="mock.guardLevel">
                <SelectTrigger class="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">普通观众</SelectItem>
                  <SelectItem value="3">舰长</SelectItem>
                  <SelectItem value="2">提督</SelectItem>
                  <SelectItem value="1">总督</SelectItem>
                </SelectContent>
              </Select>
            </FormField>

            <FormField
              label="粉丝勋章等级"
              class="min-w-0"
            >
              <NumberField
                v-model="mock.medalLevel"
                :min="0"
                :max="40"
                :disabled="!mock.hasMedal"
              />
            </FormField>

            <SettingRow
              variant="compact"
              title="佩戴勋章"
              class="self-end"
            >
              <Switch v-model:checked="mock.hasMedal" />
            </SettingRow>
          </div>
        </div>

        <!-- 测试结果展示 -->
        <div
          v-if="lastResult"
          class="space-y-2"
        >
          <Alert
            v-if="lastResult.matched && !lastResult.error"
            size="sm"
            class="border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
          >
            <CheckCircle2 class="size-4" />
            <AlertTitle>
              {{ lastResult.executed ? '匹配通过并已真实触发' : '匹配通过（模拟预览）' }}
            </AlertTitle>
            <AlertDescription class="mt-1 space-y-1">
              <div class="text-xs font-mono p-2 rounded bg-background/80 border text-foreground break-all">
                {{ lastResult.renderedText }}
              </div>
            </AlertDescription>
          </Alert>

          <Alert
            v-else
            size="sm"
            :variant="lastResult.error ? 'destructive' : 'warning'"
          >
            <AlertCircle class="size-4" />
            <AlertTitle>{{ lastResult.error ? '执行被拦截' : '当前模拟条件未命中规则' }}</AlertTitle>
            <AlertDescription class="mt-0.5">
              {{ lastResult.error || lastResult.reason }}
            </AlertDescription>
          </Alert>
        </div>
      </div>

      <DialogFooter class="gap-2 pt-2">
        <Button
          variant="secondary"
          class="gap-1.5"
          @click="runTest(true)"
        >
          <Play class="size-3.5" />
          模拟匹配与渲染
        </Button>
        <Button
          class="gap-1.5"
          @click="runTest(false)"
        >
          <Send class="size-3.5" />
          真实触发执行
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
