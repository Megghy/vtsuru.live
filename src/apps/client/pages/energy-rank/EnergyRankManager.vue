<script setup lang="ts">
import ClientPageHeader from '@/apps/client/components/ClientPageHeader.vue'
import LabelItem from '@/apps/client/components/LabelItem.vue'
import { useEnergyRank } from '@/apps/client/store/useEnergyRank'

const energyRank = useEnergyRank()
const toast = useToast()
const feedback = (color: 'success' | 'error' | 'warning' | 'info', title: string) => {
  toast.add({ title, color })
}

const rankByOptions = [
  { label: '付费金额', value: 'paid' },
  { label: '弹幕数量', value: 'danmaku' },
  { label: '综合', value: 'combined' },
]

function resetWindowPosition() {
  energyRank.setPosition(0, 0)
  feedback('success', '位置已重置')
}

function clearRank() {
  energyRank.clearRank()
  feedback('success', '排行数据已清空')
}
</script>

<template>
  <div
    vertical
    :size="12"
    class="client-readable"
  >
    <UCard
      size="small"
      bordered
    >
      <ClientPageHeader
        title="高能排行榜"
        description="本场直播贡献排行，下播时方便逐一感谢"
      >
        <template #footers>
          <UButton
            size="small"
            :color="energyRank.isEnergyRankOpen ? 'warning' : 'primary'"
            @click="energyRank.isEnergyRankOpen ? energyRank.closeWindow() : energyRank.openWindow()"
          >
            {{ energyRank.isEnergyRankOpen ? '关闭排行榜' : '打开排行榜' }}
          </UButton>
        </template>
      </ClientPageHeader>
    </UCard>

    <UCard
      size="small"
      bordered
    >
      <div
        type="line"
        animated
      >
        <section
          name="layout"
          tab="布局"
        >
          <div
            vertical
            :size="12"
          >
            <UCard
              title="窗口尺寸与位置"
              size="small"
              embedded
            >
              <div
                cols="1 m:2"
                responsive="screen"
                :x-gap="12"
                :y-gap="4"
              >
                <div>
                  <UFormField
                    label="宽度"
                    label-placement="left"
                  >
                    <UInputNumber
                      v-model="energyRank.settings.width"
                      :min="200"
                      :max="2000"
                      @update:value="(v) => energyRank.setSize(v as number, energyRank.settings.height)"
                    />
                  </UFormField>
                </div>
                <div>
                  <UFormField
                    label="高度"
                    label-placement="left"
                  >
                    <UInputNumber
                      v-model="energyRank.settings.height"
                      :min="200"
                      :max="2000"
                      @update:value="(v) => energyRank.setSize(energyRank.settings.width, v as number)"
                    />
                  </UFormField>
                </div>
                <div>
                  <UFormField
                    label="X"
                    label-placement="left"
                  >
                    <UInputNumber
                      v-model="energyRank.settings.x"
                      :min="0"
                      @update:value="() => energyRank.updateWindowPosition()"
                    />
                  </UFormField>
                </div>
                <div>
                  <UFormField
                    label="Y"
                    label-placement="left"
                  >
                    <UInputNumber
                      v-model="energyRank.settings.y"
                      :min="0"
                      @update:value="() => energyRank.updateWindowPosition()"
                    />
                  </UFormField>
                </div>
              </div>
              <div
                justify="end"
                style="margin-top: 8px"
              >
                <UButton
                  variant="soft"
                  size="small"
                  @click="resetWindowPosition"
                >
                  <template #leading>
                    <UIcon name="i-lucide-circle" />
                  </template>
                  重置位置
                </UButton>
              </div>
            </UCard>
            <UCard
              title="窗口行为"
              size="small"
              embedded
            >
              <div
                vertical
                :size="4"
              >
                <LabelItem label="总是置顶">
                  <USwitch v-model="energyRank.settings.alwaysOnTop" />
                </LabelItem>
                <LabelItem label="鼠标穿透">
                  <USwitch v-model="energyRank.settings.interactive" />
                </LabelItem>
              </div>
            </UCard>
          </div>
        </section>

        <section
          name="appearance"
          tab="外观"
        >
          <div
            vertical
            :size="12"
          >
            <UCard
              title="颜色"
              size="small"
              embedded
            >
              <div
                cols="1 m:2"
                responsive="screen"
                :x-gap="12"
                :y-gap="4"
              >
                <div>
                  <UFormField
                    label="排行背景"
                    label-placement="left"
                  >
                    <UColorPicker
                      v-model="energyRank.settings.backgroundColor"
                      :show-alpha="true"
                    />
                  </UFormField>
                </div>
                <div>
                  <UFormField
                    label="窗口背景"
                    label-placement="left"
                  >
                    <UColorPicker
                      v-model="energyRank.settings.windowBackgroundColor"
                      :show-alpha="true"
                    />
                  </UFormField>
                </div>
                <div>
                  <UFormField
                    label="文字颜色"
                    label-placement="left"
                  >
                    <UColorPicker
                      v-model="energyRank.settings.textColor"
                      :show-alpha="true"
                    />
                  </UFormField>
                </div>
              </div>
            </UCard>
            <UCard
              title="样式"
              size="small"
              embedded
            >
              <div
                vertical
                :size="4"
              >
                <UFormField
                  label="透明度"
                  label-placement="left"
                >
                  <USlider
                    v-model="energyRank.settings.opacity"
                    :min="0"
                    :max="1"
                    :step="0.05"
                    style="max-width: 300px"
                  />
                </UFormField>
                <UFormField
                  label="字体大小"
                  label-placement="left"
                >
                  <USlider
                    v-model="energyRank.settings.fontSize"
                    :min="10"
                    :max="24"
                    :step="1"
                    style="max-width: 300px"
                  />
                </UFormField>
                <UFormField
                  label="圆角"
                  label-placement="left"
                >
                  <USlider
                    v-model="energyRank.settings.borderRadius"
                    :min="0"
                    :max="20"
                    :step="1"
                    style="max-width: 300px"
                  />
                </UFormField>
              </div>
            </UCard>
          </div>
        </section>

        <section
          name="ranking"
          tab="排行设置"
        >
          <div
            vertical
            :size="12"
          >
            <UCard
              title="排行规则"
              size="small"
              embedded
            >
              <div
                vertical
                :size="4"
              >
                <UFormField
                  label="排序方式"
                  label-placement="left"
                >
                  <URadioGroup
                    v-model="energyRank.settings.rankBy"
                    :items="rankByOptions"
                    orientation="horizontal"
                  />
                </UFormField>
                <span
                  depth="3"
                  style="font-size: 12px"
                >
                  付费金额：按礼物/SC/上舰总金额排序；弹幕数量：按发言条数排序；综合：金额 + 弹幕数×10
                </span>
                <UFormField
                  label="显示人数"
                  label-placement="left"
                >
                  <UInputNumber
                    v-model="energyRank.settings.displayCount"
                    :min="5"
                    :max="100"
                  />
                </UFormField>
              </div>
            </UCard>
            <UCard
              title="数据管理"
              size="small"
              embedded
            >
              <div
                vertical
                :size="8"
              >
                <span
                  depth="3"
                  style="font-size: 12px"
                >
                  当前已记录 {{ energyRank.rankMap.size }} 位用户的贡献数据（本场直播）
                </span>
                <UButton
                  size="small"
                  color="warning"
                  @click="clearRank"
                >
                  清空排行数据
                </UButton>
              </div>
            </UCard>
          </div>
        </section>
      </div>
    </UCard>
  </div>
</template>

<style scoped>
.u-form-item {
  margin-bottom: 4px;
}
</style>
