<script setup lang="ts">
import type { Setting_Queue } from '@/api/api-models'
import { Info24Filled } from '@vicons/fluent'
import {
  NAlert, NCard, NCheckbox, NDivider, NIcon, NInput, NInputGroup, NInputGroupLabel, NInputNumber, NRadioButton, NRadioGroup, NSelect, NFlex, NSpin, NText, NTooltip } from 'naive-ui';
import { KeywordMatchType, QueueGiftFilterType } from '@/api/api-models'
import { usePersistedStorage } from '@/shared/storage/persist'

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
  <NSpin :show="isLoading">
    <NFlex vertical :size="12">
      <NAlert type="info" size="small" :bordered="false" closable title="提示">
        修改后会自动保存并实时生效（部分配置可能需要重新开启功能后生效）。
      </NAlert>

      <NCard size="small" title="加入规则" bordered>
        <NFlex vertical :size="12">
          <NFlex align="center">
            <NInputGroup style="width: 350px">
              <NInputGroupLabel> 弹幕关键词 </NInputGroupLabel>
              <NInput v-model:value="settings.keyword" placeholder="留空则禁用弹幕加入" @change="onChange" />
            </NInputGroup>
            <NRadioGroup
              v-model:value="settings.matchType"
              type="button"
              size="small"
              @update:value="onChange"
            >
              <NRadioButton :value="KeywordMatchType.Full">
                完全
              </NRadioButton>
              <NRadioButton :value="KeywordMatchType.Contains">
                包含
              </NRadioButton>
              <NRadioButton :value="KeywordMatchType.Regex">
                正则
              </NRadioButton>
            </NRadioGroup>
          </NFlex>
          <NInputGroup style="width: 250px">
            <NInputGroupLabel> 最大队列长度 </NInputGroupLabel>
            <NInputNumber
              v-model:value="settings.queueMaxSize"
              min="0"
              max="1000"
              placeholder="0为不限制"
              @update:value="onChange"
            />
          </NInputGroup>
          <NCheckbox v-model:checked="settings.enableOnStreaming" @update:checked="onChange">
            仅在直播时允许加入
          </NCheckbox>
          <NDivider title-placement="left" style="margin: 5px 0;">
            用户限制
          </NDivider>
          <NCheckbox v-model:checked="settings.allowAllDanmaku" @update:checked="onChange">
            允许所有用户通过弹幕加入 (无视下方限制)
          </NCheckbox>
          <NFlex v-if="!settings.allowAllDanmaku" vertical :size="10" style="margin-left: 20px;">
            <NInputGroup style="width: 270px">
              <NInputGroupLabel> 最低粉丝牌等级 </NInputGroupLabel>
              <NInputNumber v-model:value="settings.fanMedalMinLevel" min="0" @update:value="onChange" />
            </NInputGroup>
            <NCheckbox v-model:checked="settings.needJianzhang" @update:checked="onChange">
              需要舰长
            </NCheckbox>
            <NCheckbox v-model:checked="settings.needTidu" @update:checked="onChange">
              需要提督
            </NCheckbox>
            <NCheckbox v-model:checked="settings.needZongdu" @update:checked="onChange">
              需要总督
            </NCheckbox>
          </NFlex>
        </NFlex>
      </NCard>

      <NCard size="small" title="礼物规则" bordered>
        <NFlex vertical :size="12">
          <NCheckbox v-model:checked="settings.allowGift" @update:checked="onChange">
            允许通过发送指定礼物直接加入队列
          </NCheckbox>
          <NFlex v-if="settings.allowGift" vertical :size="10" style="margin-left: 20px;">
            <NInputGroup style="width: 250px">
              <NInputGroupLabel> 最低礼物价值 (元) </NInputGroupLabel>
              <NInputNumber
                v-model:value="settings.minGiftPrice"
                :min="0.1"
                :step="0.1"
                @update:value="onChange"
              />
            </NInputGroup>
            <NFlex align="center">
              <NText> 指定礼物名称 </NText>
              <NSelect
                v-model:value="settings.giftNames"
                style="width: 300px"
                filterable
                multiple
                tag
                placeholder="输入礼物名按回车确认, 留空则不限名称"
                :show-arrow="false"
                :show="false"
                @update:value="onChange"
              />
            </NFlex>
            <NRadioGroup v-model:value="settings.giftFilterType" size="small" @update:value="onChange">
              <NRadioButton :value="QueueGiftFilterType.And">
                需同时满足名称和价值
              </NRadioButton>
              <NRadioButton :value="QueueGiftFilterType.Or">
                满足名称或价值之一
              </NRadioButton>
            </NRadioGroup>
            <NCheckbox v-model:checked="settings.sendGiftDirectJoin" @update:checked="onChange">
              赠送符合条件的礼物后自动加入队列
              <NTooltip>
                <template #trigger>
                  <NIcon :component="Info24Filled" size="14" style="vertical-align: middle; margin-left: 2px;" />
                </template>
                如果不勾选，用户送礼后仍需发送排队弹幕才能加入。
              </NTooltip>
            </NCheckbox>
            <NCheckbox v-model:checked="settings.sendGiftIgnoreLimit" @update:checked="onChange">
              赠送符合条件的礼物后无视上述用户限制 (粉丝牌/舰长等)
            </NCheckbox>
          </NFlex>
          <NDivider style="margin: 5px 0;" />
          <NCheckbox v-model:checked="settings.allowIncreasePaymentBySendGift" @update:checked="onChange">
            允许通过送礼累计队列中的付费金额 (影响付费排序)
          </NCheckbox>
          <NFlex v-if="settings.allowIncreasePaymentBySendGift" style="margin-left: 20px;">
            <NCheckbox v-model:checked="settings.allowIncreaseByAnyPayment" @update:checked="onChange">
              允许发送任意礼物叠加金额 (否则仅限上方指定的礼物)
            </NCheckbox>
          </NFlex>
        </NFlex>
      </NCard>

      <NCard size="small" title="冷却时间 (CD)" bordered>
        <NCheckbox v-model:checked="settings.enableCooldown" @update:checked="onChange">
          启用排队冷却 (用户完成后需等待一段时间才能再次加入)
        </NCheckbox>
        <NFlex v-if="settings.enableCooldown" vertical :size="10" style="margin-left: 20px; margin-top: 10px;">
          <NInputGroup style="width: 280px">
            <NInputGroupLabel> 普通用户 CD (秒) </NInputGroupLabel>
            <NInputNumber v-model:value="settings.cooldownSecond" min="0" @update:value="onChange" />
          </NInputGroup>
          <NInputGroup style="width: 280px">
            <NInputGroupLabel> 舰长 CD (秒) </NInputGroupLabel>
            <NInputNumber v-model:value="settings.jianzhangCooldownSecond" min="0" @update:value="onChange" />
          </NInputGroup>
          <NInputGroup style="width: 280px">
            <NInputGroupLabel> 提督 CD (秒) </NInputGroupLabel>
            <NInputNumber v-model:value="settings.tiduCooldownSecond" min="0" @update:value="onChange" />
          </NInputGroup>
          <NInputGroup style="width: 280px">
            <NInputGroupLabel> 总督 CD (秒) </NInputGroupLabel>
            <NInputNumber v-model:value="settings.zongduCooldownSecond" min="0" @update:value="onChange" />
          </NInputGroup>
        </NFlex>
      </NCard>

      <NCard size="small" title="显示与界面" bordered>
        <NFlex vertical :size="12">
          <NDivider title-placement="left" style="margin: 5px 0;">
            OBS 组件显示
          </NDivider>
          <NCheckbox v-model:checked="settings.showRequireInfo" @update:checked="onChange">
            在 OBS 组件底部显示加入要求信息
          </NCheckbox>
          <NCheckbox v-model:checked="settings.showPayment" @update:checked="onChange">
            在 OBS 组件和列表项中显示付费金额
          </NCheckbox>
          <NCheckbox v-model:checked="settings.showFanMadelInfo" @update:checked="onChange">
            在 OBS 组件和列表项中显示用户粉丝牌
          </NCheckbox>
          <NDivider title-placement="left" style="margin: 5px 0;">
            其他界面设置
          </NDivider>
          <NCheckbox v-model:checked="isWarnMessageAutoClose">
            自动关闭"加入队列失败"的通知消息 (默认3秒)
          </NCheckbox>
        </NFlex>
      </NCard>
    </NFlex>
  </NSpin>
</template>
