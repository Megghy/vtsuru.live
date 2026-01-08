<script setup lang="ts">
import type { LotteryOption } from '@/apps/open-live/components/lottery/lotteryTypes'
import { Add24Filled, Delete24Filled, Pause24Filled, Play24Filled, Sparkle24Filled, Target24Filled } from '@vicons/fluent'
import {
  NButton,
  NCheckbox,
  NCollapseTransition,
  NForm,
  NFormItem,
  NIcon,
  NInput,
  NInputGroup,
  NInputNumber,
  NRadioButton,
  NRadioGroup,
  NSpace,
} from 'naive-ui'

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
      <NSpace align="center">
        <NIcon :component="Sparkle24Filled" color="var(--n-warning-color)" />
        <span style="font-weight: bold; font-size: 16px">抽奖设置</span>
      </NSpace>
      <NButton
        size="tiny"
        secondary
        :disabled="isStartLottery"
        @click="emit('reset')"
      >
        恢复默认
      </NButton>
    </div>

    <div class="settings-layout">
      <div class="setting-column">
        <div class="setting-section">
          <div class="section-header">
            <NIcon :component="Target24Filled" />
            参与规则
          </div>
          <NForm label-placement="left" label-width="80" size="small">
            <NFormItem label="参与方式">
              <NRadioGroup
                v-model:value="option.type"
                :disabled="isLottering || isStartLottery"
              >
                <NRadioButton value="danmaku">
                  弹幕
                </NRadioButton>
                <NRadioButton value="gift">
                  礼物
                </NRadioButton>
              </NRadioGroup>
            </NFormItem>

            <template v-if="option.type === 'danmaku'">
              <NFormItem label="弹幕内容">
                <NInput
                  v-model:value="option.danmakuKeyword"
                  :disabled="isStartLottery"
                  placeholder="留空则任意弹幕"
                />
              </NFormItem>
              <NFormItem v-if="option.danmakuKeyword" label="匹配规则">
                <NRadioGroup v-model:value="option.danmakuFilterType" :disabled="isStartLottery">
                  <NRadioButton value="all">
                    完全一致
                  </NRadioButton>
                  <NRadioButton value="contains">
                    包含
                  </NRadioButton>
                  <NRadioButton value="regex">
                    正则
                  </NRadioButton>
                </NRadioGroup>
              </NFormItem>
            </template>

            <template v-else-if="option.type === 'gift'">
              <NFormItem label="礼物限制">
                <NInputGroup>
                  <NInputNumber
                    v-model:value="option.giftMinPrice"
                    :disabled="isStartLottery"
                    placeholder="最低价格"
                    :min="0"
                    style="width: 50%"
                  >
                    <template #suffix>
                      元
                    </template>
                  </NInputNumber>
                  <NInput
                    v-model:value="option.giftName"
                    :disabled="isStartLottery"
                    placeholder="指定礼物名称"
                    style="width: 50%"
                  />
                </NInputGroup>
              </NFormItem>
            </template>

            <NFormItem label="身份限制">
              <NSpace>
                <NCheckbox v-model:checked="option.needGuard" :disabled="isStartLottery">
                  舰长
                </NCheckbox>
                <NCheckbox v-model:checked="option.needFanMedal" :disabled="isStartLottery">
                  粉丝牌
                </NCheckbox>
                <NCheckbox v-model:checked="option.needWearFanMedal" :disabled="isStartLottery">
                  佩戴
                </NCheckbox>
              </NSpace>
            </NFormItem>

            <NCollapseTransition :show="option.needFanMedal">
              <NFormItem label="粉丝牌等级">
                <NInputNumber
                  v-model:value="option.fanCardLevel"
                  :min="1"
                  :max="50"
                  :disabled="isStartLottery"
                />
              </NFormItem>
            </NCollapseTransition>
          </NForm>
        </div>
      </div>

      <div class="setting-column">
        <div class="setting-section">
          <div class="section-header">
            <NIcon :component="Sparkle24Filled" />
            玩法设置
          </div>
          <NForm label-placement="left" label-width="auto" size="small">
            <div class="form-row">
              <NFormItem label="抽取人数" style="flex: 1">
                <NInputNumber
                  v-model:value="option.resultCount"
                  :min="1"
                  :disabled="isStartLottery"
                  style="width: 100%"
                />
              </NFormItem>
              <NFormItem label="动画速度" style="flex: 1">
                <NInputNumber
                  v-model:value="option.animationSpeed"
                  :step="100"
                  :min="100"
                  :max="5000"
                  :disabled="isLottering"
                  style="width: 100%"
                >
                  <template #suffix>
                    ms
                  </template>
                </NInputNumber>
              </NFormItem>
            </div>

            <NFormItem label="玩法模式">
              <div class="mode-selector-grid">
                <div
                  v-for="(desc, key) in lotteryTypeDescriptions"
                  :key="key"
                  class="mode-card"
                  :class="{
                    active: option.lotteryType === key,
                    disabled: isLottering || (key === 'wheel' && currentUsersLength < 2),
                  }"
                  @click="!isLottering && (key !== 'wheel' || currentUsersLength >= 2) && (option.lotteryType = key as any)"
                >
                  <div class="mode-icon">
                    <NIcon v-if="key === 'single'" :component="Delete24Filled" />
                    <NIcon v-else-if="key === 'half'" :component="Pause24Filled" style="transform: rotate(90deg)" />
                    <NIcon v-else-if="key === 'flip'" :component="Sparkle24Filled" />
                    <NIcon v-else-if="key === 'wheel'" :component="Target24Filled" />
                    <NIcon v-else-if="key === 'cards'" :component="Add24Filled" />
                    <NIcon v-else-if="key === 'elimination'" :component="Play24Filled" />
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
            </NFormItem>
          </NForm>
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
  background: var(--n-card-color);
  border-radius: var(--n-border-radius);
  padding: 20px;
  height: 100%;
  border: 1px solid var(--n-border-color);
  box-sizing: border-box;
}

.section-header {
  font-size: 16px;
  font-weight: bold;
  margin-bottom: 20px;
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--n-text-color);
  border-bottom: 1px dashed var(--n-border-color);
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
  border: 1px solid var(--n-border-color);
  border-radius: var(--n-border-radius);
  background-color: var(--n-card-color);
  cursor: pointer;
  text-align: center;
  gap: 8px;
}

.mode-card:hover:not(.disabled) {
  border-color: var(--n-primary-color);
  background-color: rgba(var(--n-primary-color-rgb), 0.05);
}

.mode-card.active {
  border-color: var(--n-primary-color);
  background-color: rgba(var(--n-primary-color-rgb), 0.1);
  color: var(--n-primary-color);
}
</style>
