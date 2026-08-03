<script setup lang="ts">
import type { Setting_Queue } from '@/api/api-models'
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
  <div :show="isLoading">
    <div
      vertical
      :size="12"
    >
      <UAlert
        type="info"
        size="small"
        :bordered="false"
        closable
        title="提示"
      >
        修改后会自动保存并实时生效（部分配置可能需要重新开启功能后生效）。
      </UAlert>

      <UCard
        size="small"
        title="加入规则"
        bordered
      >
        <div
          vertical
          :size="12"
        >
          <div align="center">
            <div style="width: 350px">
              <span> 弹幕关键词 </span>
              <UInput
                v-model="settings.keyword"
                placeholder="留空则禁用弹幕加入"
                @change="onChange"
              />
            </div>
            <URadioGroup
              v-model="settings.matchType"
              :items="[
                { label: '完全', value: KeywordMatchType.Full },
                { label: '包含', value: KeywordMatchType.Contains },
                { label: '正则', value: KeywordMatchType.Regex },
              ]"
              orientation="horizontal"
              @update:model-value="onChange"
            />
          </div>
          <div style="width: 250px">
            <span> 最大队列长度 </span>
            <UInputNumber
              v-model="settings.queueMaxSize"
              :min="0"
              :max="1000"
              placeholder="0为不限制"
              @update:value="onChange"
            />
          </div>
          <UCheckbox
            v-model="settings.enableOnStreaming"
            @update:model-value="onChange"
          >
            仅在直播时允许加入
          </UCheckbox>
          <USeparator
            title-placement="left"
            style="margin: 5px 0"
          >
            用户限制
          </USeparator>
          <UCheckbox
            v-model="settings.allowAllDanmaku"
            @update:model-value="onChange"
          >
            允许所有用户通过弹幕加入 (无视下方限制)
          </UCheckbox>
          <div
            v-if="!settings.allowAllDanmaku"
            vertical
            :size="10"
            style="margin-left: 20px"
          >
            <div style="width: 270px">
              <span> 最低粉丝牌等级 </span>
              <UInputNumber
                v-model="settings.fanMedalMinLevel"
                :min="0"
                @update:value="onChange"
              />
            </div>
            <UCheckbox
              v-model="settings.needJianzhang"
              @update:model-value="onChange"
            >
              需要舰长
            </UCheckbox>
            <UCheckbox
              v-model="settings.needTidu"
              @update:model-value="onChange"
            >
              需要提督
            </UCheckbox>
            <UCheckbox
              v-model="settings.needZongdu"
              @update:model-value="onChange"
            >
              需要总督
            </UCheckbox>
          </div>
        </div>
      </UCard>

      <UCard
        size="small"
        title="礼物规则"
        bordered
      >
        <div
          vertical
          :size="12"
        >
          <UCheckbox
            v-model="settings.allowGift"
            @update:model-value="onChange"
          >
            允许通过发送指定礼物直接加入队列
          </UCheckbox>
          <div
            v-if="settings.allowGift"
            vertical
            :size="10"
            style="margin-left: 20px"
          >
            <div style="width: 250px">
              <span> 最低礼物价值 (元) </span>
              <UInputNumber
                v-model="settings.minGiftPrice"
                :min="0.1"
                :step="0.1"
                @update:value="onChange"
              />
            </div>
            <div align="center">
              <span> 指定礼物名称 </span>
              <USelectMenu
                v-model="settings.giftNames"
                style="width: 300px"
                filterable
                multiple
                tag
                placeholder="输入礼物名按回车确认, 留空则不限名称"
                :show-arrow="false"
                :show="false"
                @update:value="onChange"
              />
            </div>
            <URadioGroup
              v-model="settings.giftFilterType"
              :items="[
                { label: '需同时满足名称和价值', value: QueueGiftFilterType.And },
                { label: '满足名称或价值之一', value: QueueGiftFilterType.Or },
              ]"
              orientation="horizontal"
              @update:model-value="onChange"
            />
            <UCheckbox
              v-model="settings.sendGiftDirectJoin"
              @update:model-value="onChange"
            >
              赠送符合条件的礼物后自动加入队列
              <UTooltip>
                <UIcon
                  name="i-lucide-circle"
                  size="14"
                  style="vertical-align: middle; margin-left: 2px"
                />
                <template #content> 如果不勾选，用户送礼后仍需发送排队弹幕才能加入。 </template>
              </UTooltip>
            </UCheckbox>
            <UCheckbox
              v-model="settings.sendGiftIgnoreLimit"
              @update:model-value="onChange"
            >
              赠送符合条件的礼物后无视上述用户限制 (粉丝牌/舰长等)
            </UCheckbox>
          </div>
          <USeparator style="margin: 5px 0" />
          <UCheckbox
            v-model="settings.allowIncreasePaymentBySendGift"
            @update:model-value="onChange"
          >
            允许通过送礼累计队列中的付费金额 (影响付费排序)
          </UCheckbox>
          <div
            v-if="settings.allowIncreasePaymentBySendGift"
            style="margin-left: 20px"
          >
            <UCheckbox
              v-model="settings.allowIncreaseByAnyPayment"
              @update:model-value="onChange"
            >
              允许发送任意礼物叠加金额 (否则仅限上方指定的礼物)
            </UCheckbox>
          </div>
        </div>
      </UCard>

      <UCard
        size="small"
        title="冷却时间 (CD)"
        bordered
      >
        <UCheckbox
          v-model="settings.enableCooldown"
          @update:model-value="onChange"
        >
          启用排队冷却 (用户完成后需等待一段时间才能再次加入)
        </UCheckbox>
        <div
          v-if="settings.enableCooldown"
          vertical
          :size="10"
          style="margin-left: 20px; margin-top: 10px"
        >
          <div style="width: 280px">
            <span> 普通用户 CD (秒) </span>
            <UInputNumber
              v-model="settings.cooldownSecond"
              :min="0"
              @update:value="onChange"
            />
          </div>
          <div style="width: 280px">
            <span> 舰长 CD (秒) </span>
            <UInputNumber
              v-model="settings.jianzhangCooldownSecond"
              :min="0"
              @update:value="onChange"
            />
          </div>
          <div style="width: 280px">
            <span> 提督 CD (秒) </span>
            <UInputNumber
              v-model="settings.tiduCooldownSecond"
              :min="0"
              @update:value="onChange"
            />
          </div>
          <div style="width: 280px">
            <span> 总督 CD (秒) </span>
            <UInputNumber
              v-model="settings.zongduCooldownSecond"
              :min="0"
              @update:value="onChange"
            />
          </div>
        </div>
      </UCard>

      <UCard
        size="small"
        title="显示与界面"
        bordered
      >
        <div
          vertical
          :size="12"
        >
          <USeparator
            title-placement="left"
            style="margin: 5px 0"
          >
            OBS 组件显示
          </USeparator>
          <UCheckbox
            v-model="settings.showRequireInfo"
            @update:model-value="onChange"
          >
            在 OBS 组件底部显示加入要求信息
          </UCheckbox>
          <UCheckbox
            v-model="settings.showPayment"
            @update:model-value="onChange"
          >
            在 OBS 组件和列表项中显示付费金额
          </UCheckbox>
          <UCheckbox
            v-model="settings.showFanMadelInfo"
            @update:model-value="onChange"
          >
            在 OBS 组件和列表项中显示用户粉丝牌
          </UCheckbox>
          <USeparator
            title-placement="left"
            style="margin: 5px 0"
          >
            其他界面设置
          </USeparator>
          <UCheckbox v-model="isWarnMessageAutoClose"> 自动关闭"加入队列失败"的通知消息 (默认3秒) </UCheckbox>
        </div>
      </UCard>
    </div>
  </div>
</template>
