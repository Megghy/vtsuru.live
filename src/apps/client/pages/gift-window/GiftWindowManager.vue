<script setup lang="ts">
import ClientPageHeader from '@/apps/client/components/ClientPageHeader.vue'
import LabelItem from '@/apps/client/components/LabelItem.vue'
import { useGiftWindow } from '@/apps/client/store/useGiftWindow'

const giftWindow = useGiftWindow()
const toast = useToast()
const feedback = (color: 'success' | 'error' | 'warning' | 'info', title: string) => {
  toast.add({ title, color })
}

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
  dark: {
    backgroundColor: 'rgba(20,20,30,0.85)',
    windowBackgroundColor: 'rgba(0,0,0,0)',
    textColor: '#ffffff',
    highlightColor: '#fbbf24',
  },
  warm: {
    backgroundColor: 'rgba(40,20,10,0.85)',
    windowBackgroundColor: 'rgba(20,10,5,0.3)',
    textColor: '#fff5e6',
    highlightColor: '#ff9f43',
  },
  purple: {
    backgroundColor: 'rgba(25,15,40,0.85)',
    windowBackgroundColor: 'rgba(15,5,30,0.3)',
    textColor: '#f0e6ff',
    highlightColor: '#c084fc',
  },
}

function applyPreset(preset: keyof typeof presets) {
  Object.assign(giftWindow.settings, presets[preset])
  const names = { dark: '暗黑', warm: '暖色', purple: '紫色' } as const
  feedback('success', `已应用${names[preset]}主题`)
}

function resetWindowPosition() {
  giftWindow.setPosition(0, 0)
  feedback('success', '位置已重置')
}

function clearRank() {
  giftWindow.clearRank()
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
        title="礼物与排行"
        description="礼物浮窗和高能排行榜，同窗口显示，可独立开关"
      >
        <template #footers>
          <UButton
            size="small"
            :color="giftWindow.isGiftWindowOpen ? 'warning' : 'primary'"
            @click="giftWindow.isGiftWindowOpen ? giftWindow.closeWindow() : giftWindow.openWindow()"
          >
            {{ giftWindow.isGiftWindowOpen ? '关闭窗口' : '打开窗口' }}
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
          name="filter"
          tab="筛选与排序"
        >
          <div
            vertical
            :size="12"
          >
            <UCard
              title="显示类型"
              size="small"
              embedded
            >
              <UCheckboxGroup
                v-model="giftWindow.settings.filterTypes"
                :items="filterOptions"
              />
            </UCard>
            <UCard
              title="排序方式"
              size="small"
              embedded
            >
              <div
                vertical
                :size="8"
              >
                <URadioGroup
                  v-model="giftWindow.settings.sortBy"
                  :items="sortOptions"
                  orientation="horizontal"
                />
                <LabelItem label="倒序排列">
                  <USwitch v-model="giftWindow.settings.reverseOrder" />
                </LabelItem>
              </div>
            </UCard>
            <UCard
              title="过滤条件"
              size="small"
              embedded
            >
              <UFormField
                label="最低金额"
                label-placement="left"
              >
                <div class="flex items-center gap-2">
                  <UInputNumber
                    v-model="giftWindow.settings.minPrice"
                    :min="0"
                    :step="100"
                  />
                  <span class="text-sm text-[var(--vtsuru-fg-muted)]">金瓜子</span>
                </div>
              </UFormField>
              <span
                depth="3"
                style="font-size: 12px"
              >
                按金瓜子计价（1000 金瓜子 =
                ¥1），礼物按单价×数量，SC/上舰按其金额。低于此值的礼物、SC、上舰都不会显示，设为 0 不过滤
              </span>
            </UCard>
          </div>
        </section>

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
                      v-model="giftWindow.settings.width"
                      :min="200"
                      :max="2000"
                      @update:value="(v) => giftWindow.setSize(v as number, giftWindow.settings.height)"
                    />
                  </UFormField>
                </div>
                <div>
                  <UFormField
                    label="高度"
                    label-placement="left"
                  >
                    <UInputNumber
                      v-model="giftWindow.settings.height"
                      :min="200"
                      :max="2000"
                      @update:value="(v) => giftWindow.setSize(giftWindow.settings.width, v as number)"
                    />
                  </UFormField>
                </div>
                <div>
                  <UFormField
                    label="X"
                    label-placement="left"
                  >
                    <UInputNumber
                      v-model="giftWindow.settings.x"
                      :min="0"
                      @update:value="() => giftWindow.updateWindowPosition()"
                    />
                  </UFormField>
                </div>
                <div>
                  <UFormField
                    label="Y"
                    label-placement="left"
                  >
                    <UInputNumber
                      v-model="giftWindow.settings.y"
                      :min="0"
                      @update:value="() => giftWindow.updateWindowPosition()"
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
                  <USwitch v-model="giftWindow.settings.alwaysOnTop" />
                </LabelItem>
                <LabelItem label="鼠标穿透">
                  <USwitch v-model="giftWindow.settings.interactive" />
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
                    label="卡片背景"
                    label-placement="left"
                  >
                    <UColorPicker
                      v-model="giftWindow.settings.backgroundColor"
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
                      v-model="giftWindow.settings.windowBackgroundColor"
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
                      v-model="giftWindow.settings.textColor"
                      :show-alpha="true"
                    />
                  </UFormField>
                </div>
                <div>
                  <UFormField
                    label="金额高亮色"
                    label-placement="left"
                  >
                    <UColorPicker
                      v-model="giftWindow.settings.highlightColor"
                      :show-alpha="true"
                    />
                  </UFormField>
                </div>
              </div>
              <div
                style="margin-top: 8px"
                :size="8"
              >
                <UButton
                  size="small"
                  @click="applyPreset('dark')"
                >
                  暗黑
                </UButton>
                <UButton
                  size="small"
                  @click="applyPreset('warm')"
                >
                  暖色
                </UButton>
                <UButton
                  size="small"
                  @click="applyPreset('purple')"
                >
                  紫色
                </UButton>
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
                    v-model="giftWindow.settings.opacity"
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
                    v-model="giftWindow.settings.fontSize"
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
                    v-model="giftWindow.settings.borderRadius"
                    :min="0"
                    :max="20"
                    :step="1"
                    style="max-width: 300px"
                  />
                </UFormField>
                <UFormField
                  label="项目间距"
                  label-placement="left"
                >
                  <USlider
                    v-model="giftWindow.settings.itemSpacing"
                    :min="0"
                    :max="20"
                    :step="1"
                    style="max-width: 300px"
                  />
                </UFormField>
                <LabelItem label="显示头像">
                  <USwitch v-model="giftWindow.settings.showAvatar" />
                </LabelItem>
                <LabelItem label="显示金额">
                  <USwitch v-model="giftWindow.settings.showPrice" />
                </LabelItem>
                <LabelItem label="显示时间">
                  <USwitch v-model="giftWindow.settings.showTime" />
                </LabelItem>
                <LabelItem label="紧凑模式">
                  <USwitch v-model="giftWindow.settings.compactMode" />
                </LabelItem>
              </div>
            </UCard>
          </div>
        </section>

        <section
          name="behavior"
          tab="行为"
        >
          <div
            vertical
            :size="12"
          >
            <UCard
              title="合并与消失"
              size="small"
              embedded
            >
              <div
                vertical
                :size="4"
              >
                <UFormField
                  label="合并时间窗口"
                  label-placement="left"
                >
                  <div class="flex items-center gap-2">
                    <UInputNumber
                      v-model="giftWindow.settings.mergeWindowSeconds"
                      :min="0"
                      :max="60"
                      :step="5"
                    />
                    <span class="text-sm text-[var(--vtsuru-fg-muted)]">秒</span>
                  </div>
                </UFormField>
                <span
                  depth="3"
                  style="font-size: 12px"
                >
                  同一用户在此时间内送出的相同礼物会合并为一条
                </span>
                <UFormField
                  label="最大条目数"
                  label-placement="left"
                >
                  <UInputNumber
                    v-model="giftWindow.settings.maxItemCount"
                    :min="5"
                    :max="100"
                  />
                </UFormField>
                <UFormField
                  label="自动消失时间"
                  label-placement="left"
                >
                  <div class="flex items-center gap-2">
                    <UInputNumber
                      v-model="giftWindow.settings.autoDisappearTime"
                      :min="0"
                      :max="600"
                      :step="5"
                    />
                    <span class="text-sm text-[var(--vtsuru-fg-muted)]">秒</span>
                  </div>
                </UFormField>
                <span
                  depth="3"
                  style="font-size: 12px"
                >
                  {{
                    giftWindow.settings.autoDisappearTime > 0
                      ? `礼物将在 ${giftWindow.settings.autoDisappearTime} 秒后消失`
                      : '设为 0 则不自动消失'
                  }}
                </span>
              </div>
            </UCard>
            <UCard
              title="调试"
              size="small"
              embedded
            >
              <div
                :size="8"
                wrap
              >
                <UButton
                  size="small"
                  color="info"
                  @click="giftWindow.sendTestGift()"
                >
                  发送测试礼物
                </UButton>
                <UButton
                  size="small"
                  color="warning"
                  @click="giftWindow.clearGifts()"
                >
                  清空礼物
                </UButton>
              </div>
            </UCard>
          </div>
        </section>

        <section
          name="ranking"
          tab="排行榜"
        >
          <div
            vertical
            :size="12"
          >
            <UCard
              title="显示控制"
              size="small"
              embedded
            >
              <div
                vertical
                :size="8"
              >
                <LabelItem label="显示礼物列表">
                  <USwitch v-model="giftWindow.settings.showGiftList" />
                </LabelItem>
                <LabelItem label="显示排行榜">
                  <USwitch v-model="giftWindow.settings.showRanking" />
                </LabelItem>
              </div>
            </UCard>
            <UCard
              title="排行规则"
              size="small"
              embedded
            >
              <div
                vertical
                :size="8"
              >
                <UFormField
                  label="显示人数"
                  label-placement="left"
                >
                  <UInputNumber
                    v-model="giftWindow.settings.rankDisplayCount"
                    :min="5"
                    :max="100"
                  />
                </UFormField>
                <span
                  depth="3"
                  style="font-size: 12px"
                >
                  按本场直播付费总金额排序
                </span>
              </div>
            </UCard>
            <UCard
              title="数据"
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
                  当前已记录 {{ giftWindow.rankMap.size }} 位用户（本场直播）
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
