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
import NInputNumber from '@/shared/ui/NInputNumber.vue'

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
  <div class="settings-wrapper">
    <div class="settings-header">
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

    <div class="settings-layout">
      <!-- 左列：参与规则 -->
      <div class="setting-column">
        <div class="setting-section">
          <div class="section-header">
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
                  :class="option.type === 'danmaku' ? 'bg-primary text-primary-foreground shadow-sm' : 'hover:text-foreground'"
                  @click="option.type = 'danmaku'"
                >
                  弹幕
                </button>
                <button
                  type="button"
                  :disabled="isLottering || isStartLottery"
                  class="px-2.5 py-1 text-xs font-medium rounded-sm transition-all"
                  :class="option.type === 'gift' ? 'bg-primary text-primary-foreground shadow-sm' : 'hover:text-foreground'"
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
                  class="h-8 text-xs flex-1"
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
                    :class="option.danmakuFilterType === 'all' ? 'bg-primary text-primary-foreground shadow-sm' : 'hover:text-foreground'"
                    @click="option.danmakuFilterType = 'all'"
                  >
                    完全一致
                  </button>
                  <button
                    type="button"
                    :disabled="isStartLottery"
                    class="px-2 py-1 text-xs font-medium rounded-sm transition-all"
                    :class="option.danmakuFilterType === 'contains' ? 'bg-primary text-primary-foreground shadow-sm' : 'hover:text-foreground'"
                    @click="option.danmakuFilterType = 'contains'"
                  >
                    包含
                  </button>
                  <button
                    type="button"
                    :disabled="isStartLottery"
                    class="px-2 py-1 text-xs font-medium rounded-sm transition-all"
                    :class="option.danmakuFilterType === 'regex' ? 'bg-primary text-primary-foreground shadow-sm' : 'hover:text-foreground'"
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
                  <NInputNumber
                    :value="option.giftMinPrice"
                    :disabled="isStartLottery"
                    placeholder="最低价格(元)"
                    :min="0"
                    size="small"
                    class="flex-1"
                    @update:value="option.giftMinPrice = $event || 0"
                  />
                  <Input
                    v-model="option.giftName"
                    :disabled="isStartLottery"
                    placeholder="指定礼物名称"
                    class="h-8 text-xs flex-1"
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
              <NInputNumber
                :value="option.fanCardLevel"
                :min="1"
                :max="50"
                :disabled="isStartLottery"
                size="small"
                class="w-32"
                @update:value="option.fanCardLevel = $event || 1"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- 右列：玩法设置 -->
      <div class="setting-column">
        <div class="setting-section">
          <div class="section-header">
            <Sparkle24Filled class="size-4" />
            玩法设置
          </div>

          <div class="space-y-4">
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div class="space-y-1">
                <label class="text-xs text-muted-foreground">抽取人数</label>
                <NInputNumber
                  :value="option.resultCount"
                  :min="1"
                  :disabled="isStartLottery"
                  size="small"
                  class="w-full"
                  @update:value="option.resultCount = $event || 1"
                />
              </div>

              <div class="space-y-1">
                <label class="text-xs text-muted-foreground">动画速度 (ms)</label>
                <NInputNumber
                  :value="option.animationSpeed"
                  :step="100"
                  :min="100"
                  :max="5000"
                  :disabled="isLottering"
                  size="small"
                  class="w-full"
                  @update:value="option.animationSpeed = $event || 1000"
                />
              </div>
            </div>

            <div class="space-y-2">
              <label class="text-xs text-muted-foreground">玩法模式</label>
              <div class="mode-selector-grid">
                <div
                  v-for="(desc, key) in lotteryTypeDescriptions"
                  :key="key"
                  class="mode-card"
                  :class="{
                    active: option.lotteryType === key,
                    disabled: isLottering || (key === 'wheel' && currentUsersLength < 2),
                  }"
                  @click="
                    !isLottering && (key !== 'wheel' || currentUsersLength >= 2) && (option.lotteryType = key as any)
                  "
                >
                  <div class="mode-icon">
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
                    <div class="mode-title">
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
                    <div class="mode-desc">
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

<style scoped>
.settings-wrapper {
  margin-bottom: 16px;
  margin-top: 16px;
}

.settings-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding: 0 4px;
}

.settings-layout {
  display: flex;
  flex-wrap: wrap;
  gap: 24px;
}

.setting-column {
  flex: 1;
  min-width: 300px;
}

.setting-section {
  background: var(--vtsuru-bg-surface);
  border-radius: var(--vtsuru-radius);
  padding: 16px;
  height: 100%;
  border: 1px solid var(--vtsuru-border);
  box-sizing: border-box;
}

.section-header {
  font-size: 14px;
  font-weight: bold;
  margin-bottom: 16px;
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--vtsuru-fg);
  border-bottom: 1px dashed var(--vtsuru-border);
  padding-bottom: 10px;
}

.mode-selector-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
  gap: 10px;
  width: 100%;
}

.mode-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 10px;
  border: 1px solid var(--vtsuru-border);
  border-radius: var(--vtsuru-radius);
  background-color: var(--vtsuru-bg-surface);
  cursor: pointer;
  text-align: center;
  gap: 6px;
  transition: all 0.15s ease;
}

.mode-icon {
  color: var(--vtsuru-fg-muted);
}

.mode-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--vtsuru-fg);
}

.mode-desc {
  font-size: 10px;
  color: var(--vtsuru-fg-muted);
  line-height: 1.3;
}

.mode-card:hover:not(.disabled) {
  border-color: var(--vtsuru-brand);
  background-color: var(--vtsuru-brand-soft);
}

.mode-card:hover:not(.disabled) .mode-icon,
.mode-card:hover:not(.disabled) .mode-title {
  color: var(--vtsuru-brand);
}

.mode-card.active {
  border-color: var(--vtsuru-brand);
  background-color: var(--vtsuru-brand-soft);
}

.mode-card.active .mode-icon,
.mode-card.active .mode-title {
  color: var(--vtsuru-brand);
}

.mode-card.disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
