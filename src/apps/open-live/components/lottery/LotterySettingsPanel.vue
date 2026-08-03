<script setup lang="ts">
import type { LotteryOption } from '@/apps/open-live/components/lottery/lotteryTypes'
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
      <div align="center">
        <UIcon
          name="i-lucide-circle"
          color="var(--vtsuru-warning)"
        />
        <span style="font-weight: bold; font-size: 16px">抽奖设置</span>
      </div>
      <UButton
        size="tiny"
        variant="soft"
        :disabled="isStartLottery"
        @click="emit('reset')"
      >
        恢复默认
      </UButton>
    </div>

    <div class="settings-layout">
      <div class="setting-column">
        <div class="setting-section">
          <div class="section-header">
            <UIcon name="i-lucide-circle" />
            参与规则
          </div>
          <UForm
            label-placement="left"
            label-width="80"
            size="small"
          >
            <UFormField label="参与方式">
              <URadioGroup
                v-model="option.type"
                :disabled="isLottering || isStartLottery"
                :items="[
                  { label: '弹幕', value: 'danmaku' },
                  { label: '礼物', value: 'gift' },
                ]"
                orientation="horizontal"
              />
            </UFormField>

            <template v-if="option.type === 'danmaku'">
              <UFormField label="弹幕内容">
                <UInput
                  v-model="option.danmakuKeyword"
                  :disabled="isStartLottery"
                  placeholder="留空则任意弹幕"
                />
              </UFormField>
              <UFormField
                v-if="option.danmakuKeyword"
                label="匹配规则"
              >
                <URadioGroup
                  v-model="option.danmakuFilterType"
                  :disabled="isStartLottery"
                  :items="[
                    { label: '完全一致', value: 'all' },
                    { label: '包含', value: 'contains' },
                    { label: '正则', value: 'regex' },
                  ]"
                  orientation="horizontal"
                />
              </UFormField>
            </template>

            <template v-else-if="option.type === 'gift'">
              <UFormField label="礼物限制">
                <div>
                  <div class="flex items-center gap-2">
                    <UInputNumber
                      v-model="option.giftMinPrice"
                      :disabled="isStartLottery"
                      placeholder="最低价格"
                      :min="0"
                      style="width: 50%"
                    />
                    <span class="text-sm text-[var(--vtsuru-fg-muted)]">元</span>
                  </div>
                  <UInput
                    v-model="option.giftName"
                    :disabled="isStartLottery"
                    placeholder="指定礼物名称"
                    style="width: 50%"
                  />
                </div>
              </UFormField>
            </template>

            <UFormField label="身份限制">
              <div>
                <UCheckbox
                  v-model="option.needGuard"
                  :disabled="isStartLottery"
                >
                  舰长
                </UCheckbox>
                <UCheckbox
                  v-model="option.needFanMedal"
                  :disabled="isStartLottery"
                >
                  粉丝牌
                </UCheckbox>
                <UCheckbox
                  v-model="option.needWearFanMedal"
                  :disabled="isStartLottery"
                >
                  佩戴
                </UCheckbox>
              </div>
            </UFormField>

            <div :show="option.needFanMedal">
              <UFormField label="粉丝牌等级">
                <UInputNumber
                  v-model="option.fanCardLevel"
                  :min="1"
                  :max="50"
                  :disabled="isStartLottery"
                />
              </UFormField>
            </div>
          </UForm>
        </div>
      </div>

      <div class="setting-column">
        <div class="setting-section">
          <div class="section-header">
            <UIcon name="i-lucide-circle" />
            玩法设置
          </div>
          <UForm
            label-placement="left"
            label-width="auto"
            size="small"
          >
            <div class="form-row">
              <UFormField
                label="抽取人数"
                style="flex: 1"
              >
                <UInputNumber
                  v-model="option.resultCount"
                  :min="1"
                  :disabled="isStartLottery"
                  style="width: 100%"
                />
              </UFormField>
              <UFormField
                label="动画速度"
                style="flex: 1"
              >
                <div class="flex items-center gap-2">
                  <UInputNumber
                    v-model="option.animationSpeed"
                    :step="100"
                    :min="100"
                    :max="5000"
                    :disabled="isLottering"
                    style="width: 100%"
                  />
                  <span class="text-sm text-[var(--vtsuru-fg-muted)]">ms</span>
                </div>
              </UFormField>
            </div>

            <UFormField label="玩法模式">
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
                    <UIcon
                      name="i-lucide-circle"
                      v-if="key === 'single'"
                    />
                    <UIcon
                      name="i-lucide-circle"
                      v-else-if="key === 'half'"
                      style="transform: rotate(90deg)"
                    />
                    <UIcon
                      name="i-lucide-circle"
                      v-else-if="key === 'flip'"
                    />
                    <UIcon
                      name="i-lucide-circle"
                      v-else-if="key === 'wheel'"
                    />
                    <UIcon
                      name="i-lucide-circle"
                      v-else-if="key === 'cards'"
                    />
                    <UIcon
                      name="i-lucide-circle"
                      v-else-if="key === 'elimination'"
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
            </UFormField>
          </UForm>
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

.form-row {
  display: flex;
  gap: 16px;
  width: 100%;
}

@media (max-width: 600px) {
  .form-row {
    flex-direction: column;
    gap: 0;
  }
}

.setting-section {
  background: var(--vtsuru-bg-surface);
  border-radius: var(--vtsuru-radius);
  padding: 20px;
  height: 100%;
  border: 1px solid var(--vtsuru-border);
  box-sizing: border-box;
}

.section-header {
  font-size: 16px;
  font-weight: bold;
  margin-bottom: 20px;
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--vtsuru-fg);
  border-bottom: 1px dashed var(--vtsuru-border);
  padding-bottom: 12px;
}

.mode-selector-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 12px;
  width: 100%;
}

.mode-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 12px;
  border: 1px solid var(--vtsuru-border);
  border-radius: var(--vtsuru-radius);
  background-color: var(--vtsuru-bg-surface);
  cursor: pointer;
  text-align: center;
  gap: 8px;
}

.mode-card:hover:not(.disabled) {
  border-color: var(--vtsuru-primary);
  background-color: rgba(var(--vtsuru-primary-rgb), 0.05);
}

.mode-card.active {
  border-color: var(--vtsuru-primary);
  background-color: rgba(var(--vtsuru-primary-rgb), 0.1);
  color: var(--vtsuru-primary);
}
</style>
