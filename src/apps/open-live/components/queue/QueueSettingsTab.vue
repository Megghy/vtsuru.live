<script setup lang="ts">
import { Info24Filled } from '@vicons/fluent'

import type { Setting_Queue } from '@/api/api-models'
import { KeywordMatchType, QueueGiftFilterType } from '@/api/api-models'
import { usePersistedStorage } from '@/shared/storage/persist'
import { Alert, AlertDescription, AlertTitle } from '@/shared/ui/alert'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { Checkbox } from '@/shared/ui/checkbox'
import { Input } from '@/shared/ui/input'
import NInputNumber from '@/shared/ui/NInputNumber.vue'
import { Separator } from '@/shared/ui/separator'
import { Spin } from '@/shared/ui/spin'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/ui/tooltip'

defineProps<{
  isLoading: boolean
  settings: Setting_Queue
}>()

const emit = defineEmits<{
  (e: 'change'): void
}>()

const isWarnMessageAutoClose = usePersistedStorage('Queue.Settings.WarnMessageAutoClose', false)

function onChange() {
  emit('change')
}
</script>

<template>
  <Spin :show="isLoading">
    <div class="flex flex-col gap-3">
      <Alert class="text-xs py-2 bg-muted/50 border-muted">
        <AlertTitle class="text-xs font-semibold">提示</AlertTitle>
        <AlertDescription class="text-xs">
          修改后会自动保存并实时生效（部分配置可能需要重新开启功能后生效）。
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader class="py-3 px-4 border-b">
          <CardTitle class="text-xs font-semibold">加入规则</CardTitle>
        </CardHeader>
        <CardContent class="p-4 flex flex-col gap-3">
          <div class="flex items-center gap-2 flex-wrap">
            <div class="flex items-center border rounded-md overflow-hidden text-xs w-[350px]">
              <span class="bg-muted px-2.5 py-1.5 text-muted-foreground border-r shrink-0">弹幕关键词</span>
              <Input
                v-model="settings.keyword"
                placeholder="留空则禁用弹幕加入"
                class="border-0 shadow-none text-xs h-8"
                @change="onChange"
              />
            </div>
            <div class="flex items-center border rounded-md p-0.5 gap-0.5 bg-muted/30">
              <Button
                type="button"
                size="sm"
                class="h-7 text-xs px-2.5"
                :variant="settings.matchType === KeywordMatchType.Full ? 'default' : 'ghost'"
                @click="settings.matchType = KeywordMatchType.Full; onChange()"
              >
                完全
              </Button>
              <Button
                type="button"
                size="sm"
                class="h-7 text-xs px-2.5"
                :variant="settings.matchType === KeywordMatchType.Contains ? 'default' : 'ghost'"
                @click="settings.matchType = KeywordMatchType.Contains; onChange()"
              >
                包含
              </Button>
              <Button
                type="button"
                size="sm"
                class="h-7 text-xs px-2.5"
                :variant="settings.matchType === KeywordMatchType.Regex ? 'default' : 'ghost'"
                @click="settings.matchType = KeywordMatchType.Regex; onChange()"
              >
                正则
              </Button>
            </div>
          </div>

          <div class="flex items-center border rounded-md overflow-hidden text-xs w-[250px]">
            <span class="bg-muted px-2.5 py-1.5 text-muted-foreground border-r shrink-0">最大队列长度</span>
            <NInputNumber
              v-model:value="settings.queueMaxSize"
              :min="0"
              :max="1000"
              placeholder="0为不限制"
              class="border-0 shadow-none flex-1"
              @update:value="onChange"
            />
          </div>

          <label class="flex items-center gap-2 cursor-pointer text-xs">
            <Checkbox
              :checked="settings.enableOnStreaming"
              @update:checked="(val: boolean) => { settings.enableOnStreaming = val; onChange() }"
            />
            <span>仅在直播时允许加入</span>
          </label>

          <div class="flex items-center gap-2 my-1">
            <span class="text-xs font-semibold text-muted-foreground">用户限制</span>
            <Separator class="flex-1" />
          </div>

          <label class="flex items-center gap-2 cursor-pointer text-xs">
            <Checkbox
              :checked="settings.allowAllDanmaku"
              @update:checked="(val: boolean) => { settings.allowAllDanmaku = val; onChange() }"
            />
            <span>允许所有用户通过弹幕加入 (无视下方限制)</span>
          </label>

          <div
            v-if="!settings.allowAllDanmaku"
            class="flex flex-col gap-2.5 ml-5"
          >
            <div class="flex items-center border rounded-md overflow-hidden text-xs w-[270px]">
              <span class="bg-muted px-2.5 py-1.5 text-muted-foreground border-r shrink-0">最低粉丝牌等级</span>
              <NInputNumber
                v-model:value="settings.fanMedalMinLevel"
                :min="0"
                class="border-0 shadow-none flex-1"
                @update:value="onChange"
              />
            </div>
            <label class="flex items-center gap-2 cursor-pointer text-xs">
              <Checkbox
                :checked="settings.needJianzhang"
                @update:checked="(val: boolean) => { settings.needJianzhang = val; onChange() }"
              />
              <span>需要舰长</span>
            </label>
            <label class="flex items-center gap-2 cursor-pointer text-xs">
              <Checkbox
                :checked="settings.needTidu"
                @update:checked="(val: boolean) => { settings.needTidu = val; onChange() }"
              />
              <span>需要提督</span>
            </label>
            <label class="flex items-center gap-2 cursor-pointer text-xs">
              <Checkbox
                :checked="settings.needZongdu"
                @update:checked="(val: boolean) => { settings.needZongdu = val; onChange() }"
              />
              <span>需要总督</span>
            </label>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader class="py-3 px-4 border-b">
          <CardTitle class="text-xs font-semibold">礼物规则</CardTitle>
        </CardHeader>
        <CardContent class="p-4 flex flex-col gap-3">
          <label class="flex items-center gap-2 cursor-pointer text-xs">
            <Checkbox
              :checked="settings.allowGift"
              @update:checked="(val: boolean) => { settings.allowGift = val; onChange() }"
            />
            <span>允许通过发送指定礼物直接加入队列</span>
          </label>

          <div
            v-if="settings.allowGift"
            class="flex flex-col gap-2.5 ml-5"
          >
            <div class="flex items-center border rounded-md overflow-hidden text-xs w-[250px]">
              <span class="bg-muted px-2.5 py-1.5 text-muted-foreground border-r shrink-0">最低礼物价值 (元)</span>
              <NInputNumber
                v-model:value="settings.minGiftPrice"
                :min="0.1"
                :step="0.1"
                class="border-0 shadow-none flex-1"
                @update:value="onChange"
              />
            </div>

            <div class="flex items-center gap-2 text-xs">
              <span class="text-muted-foreground shrink-0">指定礼物名称</span>
              <Input
                :model-value="(settings.giftNames || []).join(',')"
                placeholder="多个礼物名以英文逗号分隔，留空不限"
                class="w-[320px] text-xs h-8"
                @update:model-value="(val: string | number) => {
                  settings.giftNames = String(val).split(',').map((s: string) => s.trim()).filter(Boolean);
                  onChange();
                }"
              />
            </div>

            <div class="flex items-center border rounded-md p-0.5 gap-0.5 bg-muted/30 w-fit">
              <Button
                type="button"
                size="sm"
                class="h-7 text-xs px-2.5"
                :variant="settings.giftFilterType === QueueGiftFilterType.And ? 'default' : 'ghost'"
                @click="settings.giftFilterType = QueueGiftFilterType.And; onChange()"
              >
                需同时满足名称和价值
              </Button>
              <Button
                type="button"
                size="sm"
                class="h-7 text-xs px-2.5"
                :variant="settings.giftFilterType === QueueGiftFilterType.Or ? 'default' : 'ghost'"
                @click="settings.giftFilterType = QueueGiftFilterType.Or; onChange()"
              >
                满足名称或价值之一
              </Button>
            </div>

            <label class="flex items-center gap-2 cursor-pointer text-xs">
              <Checkbox
                :checked="settings.sendGiftDirectJoin"
                @update:checked="(val: boolean) => { settings.sendGiftDirectJoin = val; onChange() }"
              />
              <span>赠送符合条件的礼物后自动加入队列</span>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger as-child>
                    <Info24Filled class="size-3.5 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p class="text-xs">如果不勾选，用户送礼后仍需发送排队弹幕才能加入。</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </label>

            <label class="flex items-center gap-2 cursor-pointer text-xs">
              <Checkbox
                :checked="settings.sendGiftIgnoreLimit"
                @update:checked="(val: boolean) => { settings.sendGiftIgnoreLimit = val; onChange() }"
              />
              <span>赠送符合条件的礼物后无视上述用户限制 (粉丝牌/舰长等)</span>
            </label>
          </div>

          <Separator class="my-1" />

          <label class="flex items-center gap-2 cursor-pointer text-xs">
            <Checkbox
              :checked="settings.allowIncreasePaymentBySendGift"
              @update:checked="(val: boolean) => { settings.allowIncreasePaymentBySendGift = val; onChange() }"
            />
            <span>允许通过送礼累计队列中的付费金额 (影响付费排序)</span>
          </label>

          <div
            v-if="settings.allowIncreasePaymentBySendGift"
            class="ml-5"
          >
            <label class="flex items-center gap-2 cursor-pointer text-xs">
              <Checkbox
                :checked="settings.allowIncreaseByAnyPayment"
                @update:checked="(val: boolean) => { settings.allowIncreaseByAnyPayment = val; onChange() }"
              />
              <span>允许发送任意礼物叠加金额 (否则仅限上方指定的礼物)</span>
            </label>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader class="py-3 px-4 border-b">
          <CardTitle class="text-xs font-semibold">冷却时间 (CD)</CardTitle>
        </CardHeader>
        <CardContent class="p-4 flex flex-col gap-3">
          <label class="flex items-center gap-2 cursor-pointer text-xs">
            <Checkbox
              :checked="settings.enableCooldown"
              @update:checked="(val: boolean) => { settings.enableCooldown = val; onChange() }"
            />
            <span>启用排队冷却 (用户完成后需等待一段时间才能再次加入)</span>
          </label>

          <div
            v-if="settings.enableCooldown"
            class="flex flex-col gap-2.5 ml-5 mt-1"
          >
            <div class="flex items-center border rounded-md overflow-hidden text-xs w-[280px]">
              <span class="bg-muted px-2.5 py-1.5 text-muted-foreground border-r shrink-0">普通用户 CD (秒)</span>
              <NInputNumber
                v-model:value="settings.cooldownSecond"
                :min="0"
                class="border-0 shadow-none flex-1"
                @update:value="onChange"
              />
            </div>
            <div class="flex items-center border rounded-md overflow-hidden text-xs w-[280px]">
              <span class="bg-muted px-2.5 py-1.5 text-muted-foreground border-r shrink-0">舰长 CD (秒)</span>
              <NInputNumber
                v-model:value="settings.jianzhangCooldownSecond"
                :min="0"
                class="border-0 shadow-none flex-1"
                @update:value="onChange"
              />
            </div>
            <div class="flex items-center border rounded-md overflow-hidden text-xs w-[280px]">
              <span class="bg-muted px-2.5 py-1.5 text-muted-foreground border-r shrink-0">提督 CD (秒)</span>
              <NInputNumber
                v-model:value="settings.tiduCooldownSecond"
                :min="0"
                class="border-0 shadow-none flex-1"
                @update:value="onChange"
              />
            </div>
            <div class="flex items-center border rounded-md overflow-hidden text-xs w-[280px]">
              <span class="bg-muted px-2.5 py-1.5 text-muted-foreground border-r shrink-0">总督 CD (秒)</span>
              <NInputNumber
                v-model:value="settings.zongduCooldownSecond"
                :min="0"
                class="border-0 shadow-none flex-1"
                @update:value="onChange"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader class="py-3 px-4 border-b">
          <CardTitle class="text-xs font-semibold">显示与界面</CardTitle>
        </CardHeader>
        <CardContent class="p-4 flex flex-col gap-3">
          <div class="flex items-center gap-2 my-1">
            <span class="text-xs font-semibold text-muted-foreground">OBS 组件显示</span>
            <Separator class="flex-1" />
          </div>
          <label class="flex items-center gap-2 cursor-pointer text-xs">
            <Checkbox
              :checked="settings.showRequireInfo"
              @update:checked="(val: boolean) => { settings.showRequireInfo = val; onChange() }"
            />
            <span>在 OBS 组件底部显示加入要求信息</span>
          </label>
          <label class="flex items-center gap-2 cursor-pointer text-xs">
            <Checkbox
              :checked="settings.showPayment"
              @update:checked="(val: boolean) => { settings.showPayment = val; onChange() }"
            />
            <span>在 OBS 组件和列表项中显示付费金额</span>
          </label>
          <label class="flex items-center gap-2 cursor-pointer text-xs">
            <Checkbox
              :checked="settings.showFanMadelInfo"
              @update:checked="(val: boolean) => { settings.showFanMadelInfo = val; onChange() }"
            />
            <span>在 OBS 组件和列表项中显示用户粉丝牌</span>
          </label>

          <div class="flex items-center gap-2 my-1">
            <span class="text-xs font-semibold text-muted-foreground">其他界面设置</span>
            <Separator class="flex-1" />
          </div>
          <label class="flex items-center gap-2 cursor-pointer text-xs">
            <Checkbox
              :checked="isWarnMessageAutoClose"
              @update:checked="(val: boolean) => isWarnMessageAutoClose = val"
            />
            <span>自动关闭"加入队列失败"的通知消息 (默认3秒)</span>
          </label>
        </CardContent>
      </Card>
    </div>
  </Spin>
</template>
