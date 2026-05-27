<script setup lang="ts">
import { ResizeTable24Filled } from '@vicons/fluent'
import { NButton, NCard, NColorPicker, NFlex, NFormItem, NGi, NGrid, NIcon, NInputNumber, NRadioButton, NRadioGroup, NSlider, NSwitch, NTabPane, NTabs, NText, useMessage } from 'naive-ui'
import { useEnergyRank } from '@/apps/client/store/useEnergyRank'
import ClientPageHeader from '@/apps/client/components/ClientPageHeader.vue'
import LabelItem from '@/apps/client/components/LabelItem.vue'

const energyRank = useEnergyRank()
const message = useMessage()

const rankByOptions = [
  { label: '付费金额', value: 'paid' },
  { label: '弹幕数量', value: 'danmaku' },
  { label: '综合', value: 'combined' },
]
</script>

<template>
  <NFlex vertical :size="12">
    <NCard size="small" bordered>
      <ClientPageHeader
        title="高能排行榜"
        description="本场直播贡献排行，下播时方便逐一感谢"
      >
        <template #actions>
          <NButton
            size="small"
            :type="energyRank.isEnergyRankOpen ? 'warning' : 'primary'"
            @click="energyRank.isEnergyRankOpen ? energyRank.closeWindow() : energyRank.openWindow()"
          >
            {{ energyRank.isEnergyRankOpen ? '关闭排行榜' : '打开排行榜' }}
          </NButton>
        </template>
      </ClientPageHeader>
    </NCard>

    <NCard size="small" bordered>
      <NTabs type="line" animated>
        <NTabPane name="layout" tab="布局">
          <NFlex vertical :size="12">
            <NCard title="窗口尺寸与位置" size="small" bordered>
              <NGrid cols="1 m:2" responsive="screen" :x-gap="12" :y-gap="4">
                <NGi>
                  <NFormItem label="宽度" label-placement="left">
                    <NInputNumber v-model:value="energyRank.settings.width" :min="200" :max="2000" @update:value="(v) => energyRank.setSize(v as number, energyRank.settings.height)" />
                  </NFormItem>
                </NGi>
                <NGi>
                  <NFormItem label="高度" label-placement="left">
                    <NInputNumber v-model:value="energyRank.settings.height" :min="200" :max="2000" @update:value="(v) => energyRank.setSize(energyRank.settings.width, v as number)" />
                  </NFormItem>
                </NGi>
                <NGi>
                  <NFormItem label="X" label-placement="left">
                    <NInputNumber v-model:value="energyRank.settings.x" :min="0" @update:value="() => energyRank.updateWindowPosition()" />
                  </NFormItem>
                </NGi>
                <NGi>
                  <NFormItem label="Y" label-placement="left">
                    <NInputNumber v-model:value="energyRank.settings.y" :min="0" @update:value="() => energyRank.updateWindowPosition()" />
                  </NFormItem>
                </NGi>
              </NGrid>
              <NFlex justify="end" style="margin-top: 8px">
                <NButton secondary size="small" @click="energyRank.setPosition(0, 0); message.success('位置已重置')">
                  <template #icon><NIcon :component="ResizeTable24Filled" /></template>
                  重置位置
                </NButton>
              </NFlex>
            </NCard>
            <NCard title="窗口行为" size="small" bordered>
              <NFlex vertical :size="4">
                <LabelItem label="总是置顶">
                  <NSwitch v-model:value="energyRank.settings.alwaysOnTop" />
                </LabelItem>
                <LabelItem label="鼠标穿透">
                  <NSwitch v-model:value="energyRank.settings.interactive" />
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
                  <NFormItem label="排行背景" label-placement="left">
                    <NColorPicker v-model:value="energyRank.settings.backgroundColor" :show-alpha="true" />
                  </NFormItem>
                </NGi>
                <NGi>
                  <NFormItem label="窗口背景" label-placement="left">
                    <NColorPicker v-model:value="energyRank.settings.windowBackgroundColor" :show-alpha="true" />
                  </NFormItem>
                </NGi>
                <NGi>
                  <NFormItem label="文字颜色" label-placement="left">
                    <NColorPicker v-model:value="energyRank.settings.textColor" :show-alpha="true" />
                  </NFormItem>
                </NGi>
              </NGrid>
            </NCard>
            <NCard title="样式" size="small" bordered>
              <NFlex vertical :size="4">
                <NFormItem label="透明度" label-placement="left">
                  <NSlider v-model:value="energyRank.settings.opacity" :min="0" :max="1" :step="0.05" style="max-width: 300px" />
                </NFormItem>
                <NFormItem label="字体大小" label-placement="left">
                  <NSlider v-model:value="energyRank.settings.fontSize" :min="10" :max="24" :step="1" style="max-width: 300px" />
                </NFormItem>
                <NFormItem label="圆角" label-placement="left">
                  <NSlider v-model:value="energyRank.settings.borderRadius" :min="0" :max="20" :step="1" style="max-width: 300px" />
                </NFormItem>
              </NFlex>
            </NCard>
          </NFlex>
        </NTabPane>

        <NTabPane name="ranking" tab="排行设置">
          <NFlex vertical :size="12">
            <NCard title="排行规则" size="small" bordered>
              <NFlex vertical :size="4">
                <NFormItem label="排序方式" label-placement="left">
                  <NRadioGroup v-model:value="energyRank.settings.rankBy">
                    <NFlex>
                      <NRadioButton v-for="opt in rankByOptions" :key="opt.value" :value="opt.value">
                        {{ opt.label }}
                      </NRadioButton>
                    </NFlex>
                  </NRadioGroup>
                </NFormItem>
                <NText depth="3" style="font-size: 12px">
                  付费金额：按礼物/SC/上舰总金额排序；弹幕数量：按发言条数排序；综合：金额 + 弹幕数×10
                </NText>
                <NFormItem label="显示人数" label-placement="left">
                  <NInputNumber v-model:value="energyRank.settings.displayCount" :min="5" :max="100" />
                </NFormItem>
              </NFlex>
            </NCard>
            <NCard title="数据管理" size="small" bordered>
              <NFlex vertical :size="8">
                <NText depth="3" style="font-size: 12px">
                  当前已记录 {{ energyRank.rankMap.size }} 位用户的贡献数据（本场直播）
                </NText>
                <NButton size="small" type="warning" @click="energyRank.clearRank(); message.success('排行数据已清空')">
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
