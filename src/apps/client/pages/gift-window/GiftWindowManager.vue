<script setup lang="ts">
import { ResizeTable24Filled } from '@vicons/fluent'
import { NButton, NCard, NCheckbox, NCheckboxGroup, NColorPicker, NFlex, NFormItem, NGi, NGrid, NIcon, NInputNumber, NRadioButton, NRadioGroup, NSlider, NSwitch, NTabPane, NTabs, NText, useMessage } from 'naive-ui'
import { useGiftWindow } from '@/apps/client/store/useGiftWindow'
import ClientPageHeader from '@/apps/client/components/ClientPageHeader.vue'
import LabelItem from '@/apps/client/components/LabelItem.vue'

const giftWindow = useGiftWindow()
const message = useMessage()

const filterOptions = [
  { label: '礼物', value: 'Gift' },
  { label: 'SC (醒目留言)', value: 'SC' },
  { label: '上舰 (舰长/提督/总督)', value: 'Guard' },
]

const sortOptions = [
  { label: '时间', value: 'time' },
  { label: '金额', value: 'price' },
  { label: '数量', value: 'num' },
]

const presets = {
  dark: { backgroundColor: 'rgba(20,20,30,0.85)', windowBackgroundColor: 'rgba(0,0,0,0)', textColor: '#ffffff', highlightColor: '#fbbf24' },
  warm: { backgroundColor: 'rgba(40,20,10,0.85)', windowBackgroundColor: 'rgba(20,10,5,0.3)', textColor: '#fff5e6', highlightColor: '#ff9f43' },
  purple: { backgroundColor: 'rgba(25,15,40,0.85)', windowBackgroundColor: 'rgba(15,5,30,0.3)', textColor: '#f0e6ff', highlightColor: '#c084fc' },
}

function applyPreset(preset: keyof typeof presets) {
  Object.assign(giftWindow.settings, presets[preset])
  const names = { dark: '暗黑', warm: '暖色', purple: '紫色' } as const
  message.success(`已应用${names[preset]}主题`)
}
</script>

<template>
  <NFlex vertical :size="12">
    <NCard size="small" bordered>
      <ClientPageHeader
        title="礼物与排行"
        description="礼物浮窗和高能排行榜，同窗口显示，可独立开关"
      >
        <template #actions>
          <NButton
            size="small"
            :type="giftWindow.isGiftWindowOpen ? 'warning' : 'primary'"
            @click="giftWindow.isGiftWindowOpen ? giftWindow.closeWindow() : giftWindow.openWindow()"
          >
            {{ giftWindow.isGiftWindowOpen ? '关闭窗口' : '打开窗口' }}
          </NButton>
        </template>
      </ClientPageHeader>
    </NCard>

    <NCard size="small" bordered>
      <NTabs type="line" animated>
        <NTabPane name="filter" tab="筛选与排序">
          <NFlex vertical :size="12">
            <NCard title="显示类型" size="small" bordered>
              <NCheckboxGroup v-model:value="giftWindow.settings.filterTypes">
                <NFlex vertical :size="6">
                  <NCheckbox v-for="opt in filterOptions" :key="opt.value" :value="opt.value" :label="opt.label" />
                </NFlex>
              </NCheckboxGroup>
            </NCard>
            <NCard title="排序方式" size="small" bordered>
              <NFlex vertical :size="8">
                <NRadioGroup v-model:value="giftWindow.settings.sortBy">
                  <NRadioButton v-for="opt in sortOptions" :key="opt.value" :value="opt.value">
                    {{ opt.label }}
                  </NRadioButton>
                </NRadioGroup>
                <LabelItem label="倒序排列">
                  <NSwitch v-model:value="giftWindow.settings.reverseOrder" />
                </LabelItem>
              </NFlex>
            </NCard>
            <NCard title="过滤条件" size="small" bordered>
              <NFormItem label="最低金额" label-placement="left">
                <NInputNumber v-model:value="giftWindow.settings.minPrice" :min="0" :step="100">
                  <template #suffix>
                    金瓜子
                  </template>
                </NInputNumber>
              </NFormItem>
              <NText depth="3" style="font-size: 12px">
                低于此金额的礼物不会显示（1000金瓜子 = ¥1）
              </NText>
            </NCard>
          </NFlex>
        </NTabPane>

        <NTabPane name="layout" tab="布局">
          <NFlex vertical :size="12">
            <NCard title="窗口尺寸与位置" size="small" bordered>
              <NGrid cols="1 m:2" responsive="screen" :x-gap="12" :y-gap="4">
                <NGi>
                  <NFormItem label="宽度" label-placement="left">
                    <NInputNumber v-model:value="giftWindow.settings.width" :min="200" :max="2000" @update:value="(v) => giftWindow.setSize(v as number, giftWindow.settings.height)" />
                  </NFormItem>
                </NGi>
                <NGi>
                  <NFormItem label="高度" label-placement="left">
                    <NInputNumber v-model:value="giftWindow.settings.height" :min="200" :max="2000" @update:value="(v) => giftWindow.setSize(giftWindow.settings.width, v as number)" />
                  </NFormItem>
                </NGi>
                <NGi>
                  <NFormItem label="X" label-placement="left">
                    <NInputNumber v-model:value="giftWindow.settings.x" :min="0" @update:value="() => giftWindow.updateWindowPosition()" />
                  </NFormItem>
                </NGi>
                <NGi>
                  <NFormItem label="Y" label-placement="left">
                    <NInputNumber v-model:value="giftWindow.settings.y" :min="0" @update:value="() => giftWindow.updateWindowPosition()" />
                  </NFormItem>
                </NGi>
              </NGrid>
              <NFlex justify="end" style="margin-top: 8px">
                <NButton secondary size="small" @click="giftWindow.setPosition(0, 0); message.success('位置已重置')">
                  <template #icon>
                    <NIcon :component="ResizeTable24Filled" />
                  </template>
                  重置位置
                </NButton>
              </NFlex>
            </NCard>
            <NCard title="窗口行为" size="small" bordered>
              <NFlex vertical :size="4">
                <LabelItem label="总是置顶">
                  <NSwitch v-model:value="giftWindow.settings.alwaysOnTop" />
                </LabelItem>
                <LabelItem label="鼠标穿透">
                  <NSwitch v-model:value="giftWindow.settings.interactive" />
                </LabelItem>
              </NFlex>
            </NCard>
          </NFlex>
        </NTabPane>

        <NTabPane name="appearance" tab="外观">
          <NFlex vertical :size="12">
            <NCard title="颜色" size="small" bordered>
              <NGrid cols="1 m:2" responsive="screen" :x-gap="12" :y-gap="4">
                <NGi>
                  <NFormItem label="卡片背景" label-placement="left">
                    <NColorPicker v-model:value="giftWindow.settings.backgroundColor" :show-alpha="true" />
                  </NFormItem>
                </NGi>
                <NGi>
                  <NFormItem label="窗口背景" label-placement="left">
                    <NColorPicker v-model:value="giftWindow.settings.windowBackgroundColor" :show-alpha="true" />
                  </NFormItem>
                </NGi>
                <NGi>
                  <NFormItem label="文字颜色" label-placement="left">
                    <NColorPicker v-model:value="giftWindow.settings.textColor" :show-alpha="true" />
                  </NFormItem>
                </NGi>
                <NGi>
                  <NFormItem label="金额高亮色" label-placement="left">
                    <NColorPicker v-model:value="giftWindow.settings.highlightColor" :show-alpha="true" />
                  </NFormItem>
                </NGi>
              </NGrid>
              <NFlex style="margin-top: 8px" :size="8">
                <NButton size="small" @click="applyPreset('dark')">
                  暗黑
                </NButton>
                <NButton size="small" @click="applyPreset('warm')">
                  暖色
                </NButton>
                <NButton size="small" @click="applyPreset('purple')">
                  紫色
                </NButton>
              </NFlex>
            </NCard>
            <NCard title="样式" size="small" bordered>
              <NFlex vertical :size="4">
                <NFormItem label="透明度" label-placement="left">
                  <NSlider v-model:value="giftWindow.settings.opacity" :min="0" :max="1" :step="0.05" style="max-width: 300px" />
                </NFormItem>
                <NFormItem label="字体大小" label-placement="left">
                  <NSlider v-model:value="giftWindow.settings.fontSize" :min="10" :max="24" :step="1" style="max-width: 300px" />
                </NFormItem>
                <NFormItem label="圆角" label-placement="left">
                  <NSlider v-model:value="giftWindow.settings.borderRadius" :min="0" :max="20" :step="1" style="max-width: 300px" />
                </NFormItem>
                <NFormItem label="项目间距" label-placement="left">
                  <NSlider v-model:value="giftWindow.settings.itemSpacing" :min="0" :max="20" :step="1" style="max-width: 300px" />
                </NFormItem>
                <LabelItem label="显示头像">
                  <NSwitch v-model:value="giftWindow.settings.showAvatar" />
                </LabelItem>
                <LabelItem label="显示金额">
                  <NSwitch v-model:value="giftWindow.settings.showPrice" />
                </LabelItem>
                <LabelItem label="显示时间">
                  <NSwitch v-model:value="giftWindow.settings.showTime" />
                </LabelItem>
                <LabelItem label="紧凑模式">
                  <NSwitch v-model:value="giftWindow.settings.compactMode" />
                </LabelItem>
              </NFlex>
            </NCard>
          </NFlex>
        </NTabPane>

        <NTabPane name="behavior" tab="行为">
          <NFlex vertical :size="12">
            <NCard title="合并与消失" size="small" bordered>
              <NFlex vertical :size="4">
                <NFormItem label="合并时间窗口" label-placement="left">
                  <NInputNumber v-model:value="giftWindow.settings.mergeWindowSeconds" :min="0" :max="60" :step="5">
                    <template #suffix>
                      秒
                    </template>
                  </NInputNumber>
                </NFormItem>
                <NText depth="3" style="font-size: 12px">
                  同一用户在此时间内送出的相同礼物会合并为一条
                </NText>
                <NFormItem label="最大条目数" label-placement="left">
                  <NInputNumber v-model:value="giftWindow.settings.maxItemCount" :min="5" :max="100" />
                </NFormItem>
                <NFormItem label="自动消失时间" label-placement="left">
                  <NInputNumber v-model:value="giftWindow.settings.autoDisappearTime" :min="0" :max="600" :step="5">
                    <template #suffix>
                      秒
                    </template>
                  </NInputNumber>
                </NFormItem>
                <NText depth="3" style="font-size: 12px">
                  {{ giftWindow.settings.autoDisappearTime > 0 ? `礼物将在 ${giftWindow.settings.autoDisappearTime} 秒后消失` : '设为 0 则不自动消失' }}
                </NText>
              </NFlex>
            </NCard>
            <NCard title="调试" size="small" bordered>
              <NFlex :size="8" wrap>
                <NButton size="small" type="info" @click="giftWindow.sendTestGift()">
                  发送测试礼物
                </NButton>
                <NButton size="small" type="warning" @click="giftWindow.clearGifts()">
                  清空礼物
                </NButton>
              </NFlex>
            </NCard>
          </NFlex>
        </NTabPane>

        <NTabPane name="ranking" tab="排行榜">
          <NFlex vertical :size="12">
            <NCard title="显示控制" size="small" bordered>
              <NFlex vertical :size="8">
                <LabelItem label="显示礼物列表">
                  <NSwitch v-model:value="giftWindow.settings.showGiftList" />
                </LabelItem>
                <LabelItem label="显示排行榜">
                  <NSwitch v-model:value="giftWindow.settings.showRanking" />
                </LabelItem>
              </NFlex>
            </NCard>
            <NCard title="排行规则" size="small" bordered>
              <NFlex vertical :size="8">
                <NFormItem label="显示人数" label-placement="left">
                  <NInputNumber v-model:value="giftWindow.settings.rankDisplayCount" :min="5" :max="100" />
                </NFormItem>
                <NText depth="3" style="font-size: 12px">
                  按本场直播付费总金额排序
                </NText>
              </NFlex>
            </NCard>
            <NCard title="数据" size="small" bordered>
              <NFlex vertical :size="8">
                <NText depth="3" style="font-size: 12px">
                  当前已记录 {{ giftWindow.rankMap.size }} 位用户（本场直播）
                </NText>
                <NButton size="small" type="warning" @click="giftWindow.clearRank(); message.success('排行数据已清空')">
                  清空排行数据
                </NButton>
              </NFlex>
            </NCard>
          </NFlex>
        </NTabPane>
      </NTabs>
    </NCard>
  </NFlex>
</template>

<style scoped>
.n-form-item { margin-bottom: 4px; }
</style>