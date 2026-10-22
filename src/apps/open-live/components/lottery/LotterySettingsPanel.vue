<script setup lang="ts">
import {
  Add24Filled,
  Delete24Filled,
  Pause24Filled,
  Play24Filled,
  Sparkle24Filled,
  Target24Filled,
} from '@vicons/fluent'

import type { LotteryOption } from '@/apps/open-live/components/lottery/lotteryTypes'
import { Button } from '@/shared/ui/button'
import { Checkbox } from '@/shared/ui/checkbox'
import { Input } from '@/shared/ui/input'
import { NumberField } from '@/shared/ui/number-field'

defineProps<{
  option: LotteryOption
  isStartLottery: boolean
  isLottering: boolean
  currentUsersLength: number
}>()

const emit = defineEmits<{
  (e: 'reset'): void
}>()

const lotteryTypeDescriptions: Record<LotteryOption['lotteryType'], string> = {
  single: '一个一个随机淘汰用户，直到剩余指定人数',
  half: '每次点击随机淘汰一半用户',
  flip: '点击翻牌，随机显示中奖用户',
  wheel: '转轮抽取，模拟幸运转轮',
  cards: '抽卡模式，随机翻开中奖卡片',
  elimination: '淘汰赛模式，分轮次进行抽取',
}
</script>

<template>
  <div class="my-4">
    <div class="flex-between mb-4 px-1">
      <div class="flex items-center gap-2">
        <Sparkle24Filled class="size-5 text-amber-500" />
        <span class="font-bold text-base text-foreground">抽奖设置</span>
      </div>
      <Button
        size="xs"
        variant="secondary"
        class="h-6 text-[11px]"
        :disabled="isStartLottery"
        @click="emit('reset')"
      >
        恢复默认
      </Button>
    </div>

    <div class="flex flex-wrap gap-6">
      <!-- 左列：参与规则 -->
      <div class="flex-1 min-w-[300px]">
        <div class="bg-card rounded-[var(--radius)] p-4 h-full border border-border box-border">
          <div class="text-sm font-bold mb-4 flex items-center gap-2 text-foreground border-b border-dashed border-border pb-2.5">
            <Target24Filled class="size-4" />
            参与规则
          </div>

          <div class="space-y-4">
            <!-- 参与方式 -->
            <div class="flex items-center gap-3">
              <span class="text-xs text-muted-foreground w-16 shrink-0">参与方式</span>
              <div class="inline-flex rounded-md border border-input p-0.5 bg-background text-muted-foreground">
                <button
                  type="button"
                  :disabled="isLottering || isStartLottery"
                  class="px-2.5 py-1 text-xs font-medium rounded-sm transition-all"
                  :class="
                    option.type === 'danmaku' ? 'bg-primary text-primary-foreground shadow-sm' : 'hover:text-foreground'
                  "
                  @click="option.type = 'danmaku'"
                >
                  弹幕
                </button>
                <button
                  type="button"
                  :disabled="isLottering || isStartLottery"
                  class="px-2.5 py-1 text-xs font-medium rounded-sm transition-all"
                  :class="
                    option.type === 'gift' ? 'bg-primary text-primary-foreground shadow-sm' : 'hover:text-foreground'
                  "
                  @click="option.type = 'gift'"
                >
                  礼物
                </button>
              </div>
            </div>

            <!-- 弹幕规则 -->
            <template v-if="option.type === 'danmaku'">
              <div class="flex items-center gap-3">
                <span class="text-xs text-muted-foreground w-16 shrink-0">弹幕内容</span>
                <Input
                  v-model="option.danmakuKeyword"
                  :disabled="isStartLottery"
                  placeholder="留空则任意弹幕"
                  class="flex-1"
                />
              </div>

              <div
                v-if="option.danmakuKeyword"
                class="flex items-center gap-3"
              >
                <span class="text-xs text-muted-foreground w-16 shrink-0">匹配规则</span>
                <div class="inline-flex rounded-md border border-input p-0.5 bg-background text-muted-foreground">
                  <button
                    type="button"
                    :disabled="isStartLottery"
                    class="px-2 py-1 text-xs font-medium rounded-sm transition-all"
                    :class="
                      option.danmakuFilterType === 'all'
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'hover:text-foreground'
                    "
                    @click="option.danmakuFilterType = 'all'"
                  >
                    完全一致
                  </button>
                  <button
                    type="button"
                    :disabled="isStartLottery"
                    class="px-2 py-1 text-xs font-medium rounded-sm transition-all"
                    :class="
                      option.danmakuFilterType === 'contains'
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'hover:text-foreground'
                    "
                    @click="option.danmakuFilterType = 'contains'"
                  >
                    包含
                  </button>
                  <button
                    type="button"
                    :disabled="isStartLottery"
                    class="px-2 py-1 text-xs font-medium rounded-sm transition-all"
                    :class="
                      option.danmakuFilterType === 'regex'
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'hover:text-foreground'
                    "
                    @click="option.danmakuFilterType = 'regex'"
                  >
                    正则
                  </button>
                </div>
              </div>
            </template>

            <!-- 礼物规则 -->
            <template v-else-if="option.type === 'gift'">
              <div class="flex items-center gap-3">
                <span class="text-xs text-muted-foreground w-16 shrink-0">礼物限制</span>
                <div class="flex items-center gap-1.5 flex-1">
                  <NumberField
                    :model-value="option.giftMinPrice"
                    :disabled="isStartLottery"
                    placeholder="最低价格(元)"
                    :min="0"
                    class="flex-1"
                    @update:model-value="option.giftMinPrice = $event || 0"
                  />
                  <Input
                    v-model="option.giftName"
                    :disabled="isStartLottery"
                    placeholder="指定礼物名称"
                    class="flex-1"
                  />
                </div>
              </div>
            </template>

            <!-- 身份限制 -->
            <div class="flex items-center gap-3">
              <span class="text-xs text-muted-foreground w-16 shrink-0">身份限制</span>
              <div class="flex items-center gap-4 text-xs">
                <label class="flex items-center gap-1.5 cursor-pointer">
                  <Checkbox
                    :checked="option.needGuard"
                    :disabled="isStartLottery"
                    @update:checked="option.needGuard = $event"
                  />
                  <span>舰长</span>
                </label>
                <label class="flex items-center gap-1.5 cursor-pointer">
                  <Checkbox
                    :checked="option.needFanMedal"
                    :disabled="isStartLottery"
                    @update:checked="option.needFanMedal = $event"
                  />
                  <span>粉丝牌</span>
                </label>
                <label class="flex items-center gap-1.5 cursor-pointer">
                  <Checkbox
                    :checked="option.needWearFanMedal"
                    :disabled="isStartLottery"
                    @update:checked="option.needWearFanMedal = $event"
                  />
                  <span>佩戴</span>
                </label>
              </div>
            </div>

            <!-- 粉丝牌等级 -->
            <div
              v-if="option.needFanMedal"
              class="flex items-center gap-3"
            >
              <span class="text-xs text-muted-foreground w-16 shrink-0">粉丝牌等级</span>
              <NumberField
                :model-value="option.fanCardLevel"
                :min="1"
                :max="50"
                :disabled="isStartLottery"
                class="w-32"
                @update:model-value="option.fanCardLevel = $event || 1"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- 右列：玩法设置 -->
      <div class="flex-1 min-w-[300px]">
        <div class="bg-card rounded-[var(--radius)] p-4 h-full border border-border box-border">
          <div class="text-sm font-bold mb-4 flex items-center gap-2 text-foreground border-b border-dashed border-border pb-2.5">
            <Sparkle24Filled class="size-4" />
            玩法设置
          </div>

          <div class="space-y-4">
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div class="space-y-1">
                <label class="text-xs text-muted-foreground">抽取人数</label>
                <NumberField
                  :model-value="option.resultCount"
                  :min="1"
                  :disabled="isStartLottery"
                  class="w-full"
                  @update:model-value="option.resultCount = $event || 1"
                />
              </div>

              <div class="space-y-1">
                <label class="text-xs text-muted-foreground">动画速度 (ms)</label>
                <NumberField
                  :model-value="option.animationSpeed"
                  :step="100"
                  :min="100"
                  :max="5000"
                  :disabled="isLottering"
                  class="w-full"
                  @update:model-value="option.animationSpeed = $event || 1000"
                />
              </div>
            </div>

            <div class="space-y-2">
              <label class="text-xs text-muted-foreground">玩法模式</label>
              <div class="grid grid-cols-[repeat(auto-fit,minmax(130px,1fr))] gap-2.5 w-full">
                <div
                  v-for="(desc, key) in lotteryTypeDescriptions"
                  :key="key"
                  class="flex flex-col-center p-2.5 border border-border rounded-[var(--radius)] bg-card cursor-pointer text-center gap-1.5 transition hover:border-[var(--brand)] hover:bg-[var(--brand-soft)]"
                  :class="{
                    'border-[var(--brand)] bg-[var(--brand-soft)] text-[var(--brand)]': option.lotteryType === key,
                    'opacity-50 cursor-not-allowed hover:border-border hover:bg-card': isLottering || (key === 'wheel' && currentUsersLength < 2),
                  }"
                  @click="
                    !isLottering && (key !== 'wheel' || currentUsersLength >= 2) && (option.lotteryType = key as any)
                  "
                >
                  <div class="text-muted-foreground group-hover:text-[var(--brand)]">
                    <Delete24Filled
                      v-if="key === 'single'"
                      class="size-5"
                    />
                    <Pause24Filled
                      v-else-if="key === 'half'"
                      class="size-5 rotate-90"
                    />
                    <Sparkle24Filled
                      v-else-if="key === 'flip'"
                      class="size-5"
                    />
                    <Target24Filled
                      v-else-if="key === 'wheel'"
                      class="size-5"
                    />
                    <Add24Filled
                      v-else-if="key === 'cards'"
                      class="size-5"
                    />
                    <Play24Filled
                      v-else-if="key === 'elimination'"
                      class="size-5"
                    />
                  </div>
                  <div class="mode-info">
                    <div class="text-xs font-semibold text-foreground">
                      {{
                        key === 'single'
                          ? '单个淘汰'
                          : key === 'half'
                            ? '减半淘汰'
                            : key === 'flip'
                              ? '翻牌抽取'
                              : key === 'wheel'
                                ? '转轮抽取'
                                : key === 'cards'
                                  ? '抽卡模式'
                                  : '淘汰赛'
                      }}
                    </div>
                    <div class="text-[10px] text-muted-foreground leading-tight">
                      {{ desc }}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

