<script setup lang="ts">
import {
  ArrowReset24Regular,
  ArrowSync24Filled,
  Color24Filled,
  Delete24Regular,
  Desktop24Filled,
  Filter24Filled,
  History24Filled,
  ResizeTable24Filled,
  Send24Filled,
  Trophy24Filled,
} from '@vicons/fluent'
import {
  NAvatar,
  NButton,
  NButtonGroup,
  NCard,
  NCheckbox,
  NCheckboxGroup,
  NColorPicker,
  NEmpty,
  NFlex,
  NFormItem,
  NGi,
  NGrid,
  NIcon,
  NInputNumber,
  NRadioButton,
  NRadioGroup,
  NSelect,
  NSlider,
  NSpin,
  NSwitch,
  NTabPane,
  NTabs,
  NTag,
  NText,
  useMessage,
} from 'naive-ui'
import { computed, ref } from 'vue'

import type { ResponseLiveInfoModel, ResponseLiveRankingEntryModel } from '@/api/api-models'
import { QueryGetAPI } from '@/api/query'
import ClientPageHeader from '@/apps/client/components/ClientPageHeader.vue'
import LabelItem from '@/apps/client/components/LabelItem.vue'
import { useGiftWindow } from '@/apps/client/store/useGiftWindow'
import { LIVE_API_URL } from '@/shared/config'

const giftWindow = useGiftWindow()
const message = useMessage()

const filterOptions = [
  { label: '普通礼物', value: 'Gift' },
  { label: '醒目留言 (SC)', value: 'SC' },
  { label: '大航海 (舰长/提督/总督)', value: 'Guard' },
]

const sortOptions = [
  { label: '送礼时间', value: 'time' },
  { label: '礼物金额', value: 'price' },
  { label: '礼物数量', value: 'num' },
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
  const names = { dark: '暗黑星空', warm: '暖色流金', purple: '梦幻浅紫' } as const
  message.success(`已应用${names[preset]}预设`)
}

function resetWindowPosition() {
  giftWindow.setPosition(0, 0)
  message.success('窗口位置已重置至默认坐标')
}

const historyLives = ref<ResponseLiveInfoModel[]>([])
const historyRanking = ref<ResponseLiveRankingEntryModel[]>([])
const selectedHistoryLiveId = ref<string | null>(null)
const isHistoryLoading = ref(false)
const isHistoryLoaded = ref(false)

const historyLiveOptions = computed(() =>
  historyLives.value.map((live) => ({
    label: `${new Date(live.startAt).toLocaleString()} · ${live.title || '未命名直播'}`,
    value: live.liveId,
  })),
)

function formatPaid(totalPaid: number) {
  return `¥${totalPaid.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
}

async function loadHistoryRanking() {
  if (!selectedHistoryLiveId.value) {
    historyRanking.value = []
    return
  }

  const response = await QueryGetAPI<ResponseLiveRankingEntryModel[]>(`${LIVE_API_URL}ranking`, {
    liveId: selectedHistoryLiveId.value,
    limit: 100,
  })
  if (response.code !== 200) throw new Error(response.message)
  historyRanking.value = response.data
}

async function loadHistory() {
  if (isHistoryLoading.value) return
  isHistoryLoading.value = true
  try {
    const response = await QueryGetAPI<ResponseLiveInfoModel[]>(`${LIVE_API_URL}get-all`)
    if (response.code !== 200) throw new Error(response.message)

    historyLives.value = response.data.filter((live) => live.isFinish)
    if (!historyLives.value.some((live) => live.liveId === selectedHistoryLiveId.value)) {
      selectedHistoryLiveId.value = historyLives.value[0]?.liveId ?? null
    }
    await loadHistoryRanking()
    isHistoryLoaded.value = true
  } catch (error) {
    message.error(error instanceof Error ? error.message : '加载历史榜单失败')
  } finally {
    isHistoryLoading.value = false
  }
}

async function onHistoryLiveChange() {
  try {
    await loadHistoryRanking()
  } catch (error) {
    message.error(error instanceof Error ? error.message : '加载历史榜单失败')
  }
}

function onTabChange(tab: string) {
  if (tab === 'history' && !isHistoryLoaded.value) void loadHistory()
}
</script>

<template>
  <div class="gift-manage-view">
    <NFlex
      vertical
      :size="14"
    >
      <!-- 标准管理页标头 -->
      <ClientPageHeader
        title="礼物与高能榜浮窗管理"
        description="桌面半透明置顶礼物浮窗与高能排行榜，同窗口分屏或独立展示，支持实时打赏动画与历史追溯"
      >
        <template #actions>
          <NTag
            :type="giftWindow.isGiftWindowOpen ? 'success' : 'default'"
            round
            :bordered="false"
          >
            {{ giftWindow.isGiftWindowOpen ? '● 浮窗运行中' : '○ 浮窗已关闭' }}
          </NTag>

          <NButton
            size="small"
            :type="giftWindow.isGiftWindowOpen ? 'error' : 'primary'"
            secondary
            @click="giftWindow.isGiftWindowOpen ? giftWindow.closeWindow() : giftWindow.openWindow()"
          >
            {{ giftWindow.isGiftWindowOpen ? '关闭浮窗' : '打开浮窗' }}
          </NButton>

          <NButtonGroup size="small">
            <NButton
              secondary
              type="info"
              :disabled="!giftWindow.isGiftWindowOpen"
              @click="giftWindow.sendTestGift()"
            >
              <template #icon>
                <NIcon :component="Send24Filled" />
              </template>
              测试礼物
            </NButton>
            <NButton
              secondary
              type="warning"
              :disabled="!giftWindow.isGiftWindowOpen"
              @click="giftWindow.clearGifts()"
            >
              <template #icon>
                <NIcon :component="Delete24Regular" />
              </template>
              清空
            </NButton>
          </NButtonGroup>
        </template>
      </ClientPageHeader>

      <!-- 统一 Segmented Tabs 导航 -->
      <NTabs
        type="segment"
        animated
        default-value="appearance"
        class="gift-tabs"
        @update:value="onTabChange"
      >
        <!-- 外观与主题 -->
        <NTabPane
          name="appearance"
          tab="外观与主题"
        >
          <template #tab>
            <NFlex
              align="center"
              :size="6"
            >
              <NIcon :component="Color24Filled" />
              <span>外观与主题</span>
            </NFlex>
          </template>

          <NFlex
            vertical
            :size="12"
            class="client-readable"
          >
            <!-- 主题预设 -->
            <NCard
              title="配色预设"
              size="small"
              bordered
            >
              <NGrid
                cols="1 s:3"
                :x-gap="12"
                :y-gap="8"
              >
                <NGi>
                  <div
                    class="preset-card preset-card--dark"
                    @click="applyPreset('dark')"
                  >
                    <div class="preset-name">暗黑星空</div>
                    <div class="preset-desc">深色沉浸背景搭配琥珀金高亮</div>
                  </div>
                </NGi>
                <NGi>
                  <div
                    class="preset-card preset-card--warm"
                    @click="applyPreset('warm')"
                  >
                    <div class="preset-name">暖色流金</div>
                    <div class="preset-desc">暖咖质感底色搭配蜜橙重点色</div>
                  </div>
                </NGi>
                <NGi>
                  <div
                    class="preset-card preset-card--purple"
                    @click="applyPreset('purple')"
                  >
                    <div class="preset-name">梦幻浅紫</div>
                    <div class="preset-desc">神秘浅紫渐变搭配霓虹高光</div>
                  </div>
                </NGi>
              </NGrid>
            </NCard>

            <!-- 颜色自定义 -->
            <NCard
              title="色彩调节"
              size="small"
              bordered
            >
              <NGrid
                cols="1 s:2"
                :x-gap="16"
                :y-gap="6"
              >
                <NGi>
                  <NFormItem
                    label="卡片背景色"
                    label-placement="left"
                  >
                    <NColorPicker
                      v-model:value="giftWindow.settings.backgroundColor"
                      :show-alpha="true"
                    />
                  </NFormItem>
                </NGi>
                <NGi>
                  <NFormItem
                    label="窗口背景色"
                    label-placement="left"
                  >
                    <NColorPicker
                      v-model:value="giftWindow.settings.windowBackgroundColor"
                      :show-alpha="true"
                    />
                  </NFormItem>
                </NGi>
                <NGi>
                  <NFormItem
                    label="文字主色"
                    label-placement="left"
                  >
                    <NColorPicker
                      v-model:value="giftWindow.settings.textColor"
                      :show-alpha="true"
                    />
                  </NFormItem>
                </NGi>
                <NGi>
                  <NFormItem
                    label="金额高亮色"
                    label-placement="left"
                  >
                    <NColorPicker
                      v-model:value="giftWindow.settings.highlightColor"
                      :show-alpha="true"
                    />
                  </NFormItem>
                </NGi>
              </NGrid>
            </NCard>

            <!-- 样式细节 -->
            <NCard
              title="排版与细节"
              size="small"
              bordered
            >
              <NFlex
                vertical
                :size="6"
              >
                <NFormItem
                  label="整体不透明度"
                  label-placement="left"
                >
                  <NSlider
                    v-model:value="giftWindow.settings.opacity"
                    :min="0.1"
                    :max="1"
                    :step="0.05"
                    style="max-width: 320px"
                  />
                </NFormItem>
                <NFormItem
                  label="字号大小 (px)"
                  label-placement="left"
                >
                  <NSlider
                    v-model:value="giftWindow.settings.fontSize"
                    :min="10"
                    :max="24"
                    :step="1"
                    style="max-width: 320px"
                  />
                </NFormItem>
                <NFormItem
                  label="卡片圆角 (px)"
                  label-placement="left"
                >
                  <NSlider
                    v-model:value="giftWindow.settings.borderRadius"
                    :min="0"
                    :max="20"
                    :step="1"
                    style="max-width: 320px"
                  />
                </NFormItem>
                <NFormItem
                  label="条目间距 (px)"
                  label-placement="left"
                >
                  <NSlider
                    v-model:value="giftWindow.settings.itemSpacing"
                    :min="0"
                    :max="20"
                    :step="1"
                    style="max-width: 320px"
                  />
                </NFormItem>

                <NDivider style="margin: 8px 0" />

                <NGrid
                  cols="2 s:4"
                  :x-gap="12"
                  :y-gap="6"
                >
                  <NGi>
                    <LabelItem label="显示头像">
                      <NSwitch v-model:value="giftWindow.settings.showAvatar" />
                    </LabelItem>
                  </NGi>
                  <NGi>
                    <LabelItem label="显示金额">
                      <NSwitch v-model:value="giftWindow.settings.showPrice" />
                    </LabelItem>
                  </NGi>
                  <NGi>
                    <LabelItem label="显示时间">
                      <NSwitch v-model:value="giftWindow.settings.showTime" />
                    </LabelItem>
                  </NGi>
                  <NGi>
                    <LabelItem label="紧凑模式">
                      <NSwitch v-model:value="giftWindow.settings.compactMode" />
                    </LabelItem>
                  </NGi>
                </NGrid>
              </NFlex>
            </NCard>
          </NFlex>
        </NTabPane>

        <!-- 窗口与布局 -->
        <NTabPane
          name="window"
          tab="窗口与布局"
        >
          <template #tab>
            <NFlex
              align="center"
              :size="6"
            >
              <NIcon :component="Desktop24Filled" />
              <span>窗口与布局</span>
            </NFlex>
          </template>

          <NFlex
            vertical
            :size="12"
            class="client-readable"
          >
            <!-- 尺寸与坐标 -->
            <NCard
              title="尺寸与屏幕坐标"
              size="small"
              bordered
            >
              <NGrid
                cols="2 s:4"
                :x-gap="12"
                :y-gap="6"
              >
                <NGi>
                  <NFormItem
                    label="宽度 (px)"
                    label-placement="top"
                  >
                    <NInputNumber
                      v-model:value="giftWindow.settings.width"
                      :min="200"
                      :max="3840"
                      @update:value="(v) => giftWindow.setSize(v as number, giftWindow.settings.height)"
                    />
                  </NFormItem>
                </NGi>
                <NGi>
                  <NFormItem
                    label="高度 (px)"
                    label-placement="top"
                  >
                    <NInputNumber
                      v-model:value="giftWindow.settings.height"
                      :min="200"
                      :max="2160"
                      @update:value="(v) => giftWindow.setSize(giftWindow.settings.width, v as number)"
                    />
                  </NFormItem>
                </NGi>
                <NGi>
                  <NFormItem
                    label="X 坐标"
                    label-placement="top"
                  >
                    <NInputNumber
                      v-model:value="giftWindow.settings.x"
                      :min="0"
                      @update:value="() => giftWindow.updateWindowPosition()"
                    />
                  </NFormItem>
                </NGi>
                <NGi>
                  <NFormItem
                    label="Y 坐标"
                    label-placement="top"
                  >
                    <NInputNumber
                      v-model:value="giftWindow.settings.y"
                      :min="0"
                      @update:value="() => giftWindow.updateWindowPosition()"
                    />
                  </NFormItem>
                </NGi>
              </NGrid>
              <NFlex
                justify="end"
                style="margin-top: 10px"
              >
                <NButton
                  secondary
                  size="small"
                  @click="resetWindowPosition"
                >
                  <template #icon>
                    <NIcon :component="ArrowReset24Regular" />
                  </template>
                  重置至默认坐标
                </NButton>
              </NFlex>
            </NCard>

            <!-- 模块展示开关 -->
            <NCard
              title="同窗口展示模块"
              size="small"
              bordered
            >
              <NFlex
                vertical
                :size="10"
              >
                <LabelItem
                  label="启用礼物列表"
                  description="实时滚动显示观众送出的礼物、SC 与大航海"
                >
                  <NSwitch v-model:value="giftWindow.settings.showGiftList" />
                </LabelItem>
                <LabelItem
                  label="启用高能排行榜"
                  description="在同窗口内展示本场直播贡献值最高的观众排名"
                >
                  <NSwitch v-model:value="giftWindow.settings.showRanking" />
                </LabelItem>
              </NFlex>
            </NCard>

            <!-- 窗口行为 -->
            <NCard
              title="浮窗行为属性"
              size="small"
              bordered
            >
              <NFlex
                vertical
                :size="10"
              >
                <LabelItem
                  label="总是置顶"
                  description="让礼物窗口始终保持在游戏等应用程序上层"
                >
                  <NSwitch v-model:value="giftWindow.settings.alwaysOnTop" />
                </LabelItem>
                <LabelItem
                  label="鼠标穿透 (点击忽略)"
                  description="点击事件穿透到下层游戏界面，不影响直播操作"
                >
                  <NSwitch v-model:value="giftWindow.settings.interactive" />
                </LabelItem>
              </NFlex>
            </NCard>
          </NFlex>
        </NTabPane>

        <!-- 筛选与规则 -->
        <NTabPane
          name="filter"
          tab="筛选与规则"
        >
          <template #tab>
            <NFlex
              align="center"
              :size="6"
            >
              <NIcon :component="Filter24Filled" />
              <span>筛选与规则</span>
            </NFlex>
          </template>

          <NFlex
            vertical
            :size="12"
            class="client-readable"
          >
            <!-- 显示类型过滤 -->
            <NCard
              title="礼物类型过滤"
              size="small"
              bordered
            >
              <NCheckboxGroup v-model:value="giftWindow.settings.filterTypes">
                <NFlex
                  :size="[20, 10]"
                  wrap
                >
                  <NCheckbox
                    v-for="opt in filterOptions"
                    :key="opt.value"
                    :value="opt.value"
                    :label="opt.label"
                  />
                </NFlex>
              </NCheckboxGroup>
            </NCard>

            <!-- 排序方式 -->
            <NCard
              title="礼物排序方式"
              size="small"
              bordered
            >
              <NFlex
                vertical
                :size="10"
              >
                <NRadioGroup v-model:value="giftWindow.settings.sortBy">
                  <NFlex :size="12">
                    <NRadioButton
                      v-for="opt in sortOptions"
                      :key="opt.value"
                      :value="opt.value"
                    >
                      {{ opt.label }}
                    </NRadioButton>
                  </NFlex>
                </NRadioGroup>
                <LabelItem label="倒序呈现 (新消息排在前面)">
                  <NSwitch v-model:value="giftWindow.settings.reverseOrder" />
                </LabelItem>
              </NFlex>
            </NCard>

            <!-- 过滤与合并规则 -->
            <NCard
              title="合并与过滤阈值"
              size="small"
              bordered
            >
              <NGrid
                cols="1 s:2"
                :x-gap="16"
                :y-gap="8"
              >
                <NGi>
                  <NFormItem
                    label="最低展示金额 (金瓜子)"
                    label-placement="top"
                  >
                    <NInputNumber
                      v-model:value="giftWindow.settings.minPrice"
                      :min="0"
                      :step="100"
                    >
                      <template #suffix> 金瓜子 </template>
                    </NInputNumber>
                  </NFormItem>
                  <NText
                    depth="3"
                    style="font-size: 12px; display: block; margin-top: -6px;"
                  >
                    1000 金瓜子 = ¥1。设为 0 则不过滤免费或微额礼物。
                  </NText>
                </NGi>
                <NGi>
                  <NFormItem
                    label="合并时间窗口 (秒)"
                    label-placement="top"
                  >
                    <NInputNumber
                      v-model:value="giftWindow.settings.mergeWindowSeconds"
                      :min="0"
                      :max="60"
                      :step="5"
                    >
                      <template #suffix> 秒 </template>
                    </NInputNumber>
                  </NFormItem>
                  <NText
                    depth="3"
                    style="font-size: 12px; display: block; margin-top: -6px;"
                  >
                    同一用户在此时间内送出的相同礼物自动合并为一条连击。
                  </NText>
                </NGi>
                <NGi>
                  <NFormItem
                    label="列表最大保留条数"
                    label-placement="top"
                  >
                    <NInputNumber
                      v-model:value="giftWindow.settings.maxItemCount"
                      :min="5"
                      :max="100"
                    />
                  </NFormItem>
                </NGi>
                <NGi>
                  <NFormItem
                    label="礼物自动淡出消失 (秒)"
                    label-placement="top"
                  >
                    <NInputNumber
                      v-model:value="giftWindow.settings.autoDisappearTime"
                      :min="0"
                      :max="600"
                      :step="5"
                    >
                      <template #suffix> 秒 </template>
                    </NInputNumber>
                  </NFormItem>
                </NGi>
              </NGrid>
            </NCard>

            <!-- 排行榜规则 -->
            <NCard
              title="排行榜规则"
              size="small"
              bordered
            >
              <NFormItem
                label="排行榜上榜人数上限"
                label-placement="left"
                style="margin-bottom: 0"
              >
                <NInputNumber
                  v-model:value="giftWindow.settings.rankDisplayCount"
                  :min="5"
                  :max="100"
                  style="width: 160px"
                />
              </NFormItem>
              <NText
                depth="3"
                style="font-size: 12px; margin-top: 6px; display: block;"
              >
                排行榜依据本场直播累计送出的付费礼物与大航海总价值实时计算。
              </NText>
            </NCard>
          </NFlex>
        </NTabPane>

        <!-- 历史打赏榜 -->
        <NTabPane
          name="history"
          tab="往期打赏榜单"
        >
          <template #tab>
            <NFlex
              align="center"
              :size="6"
            >
              <NIcon :component="History24Filled" />
              <span>往期打赏榜单</span>
            </NFlex>
          </template>

          <NFlex
            vertical
            :size="12"
            class="client-readable"
          >
            <NCard
              title="查询历史直播场次榜单"
              size="small"
              bordered
            >
              <NFlex
                :size="12"
                align="center"
                style="margin-bottom: 14px"
              >
                <NSelect
                  v-model:value="selectedHistoryLiveId"
                  :options="historyLiveOptions"
                  placeholder="选择已结束的直播场次"
                  filterable
                  style="min-width: 280px; flex: 1"
                  @update:value="onHistoryLiveChange"
                />
                <NButton
                  size="small"
                  secondary
                  :loading="isHistoryLoading"
                  @click="loadHistory"
                >
                  <template #icon>
                    <NIcon :component="ArrowSync24Filled" />
                  </template>
                  刷新场次
                </NButton>
              </NFlex>

              <NSpin :show="isHistoryLoading">
                <NEmpty
                  v-if="!isHistoryLoading && historyRanking.length === 0"
                  description="该场次暂无打赏记录"
                  style="padding: 24px 0"
                />
                <NFlex
                  v-else
                  vertical
                  :size="8"
                >
                  <div
                    v-for="(item, index) in historyRanking"
                    :key="item.ouId || item.name"
                    class="history-rank-item"
                  >
                    <NFlex
                      align="center"
                      justify="space-between"
                    >
                      <NFlex
                        align="center"
                        :size="10"
                      >
                        <span
                          class="rank-num"
                          :class="{
                            'rank-num--top1': index === 0,
                            'rank-num--top2': index === 1,
                            'rank-num--top3': index === 2,
                          }"
                        >
                          {{ index + 1 }}
                        </span>
                        <NAvatar
                          round
                          size="small"
                          :src="item.avatar"
                        />
                        <NText strong>{{ item.name }}</NText>
                      </NFlex>
                      <NTag
                        type="warning"
                        size="small"
                        :bordered="false"
                      >
                        {{ formatPaid(item.totalPaid) }}
                      </NTag>
                    </NFlex>
                  </div>
                </NFlex>
              </NSpin>
            </NCard>
          </NFlex>
        </NTabPane>
      </NTabs>
    </NFlex>
  </div>
</template>

<style scoped>
.gift-manage-view {
  width: 100%;
}

.gift-tabs :deep(.n-tabs-rail) {
  max-width: 480px;
}

/* 预设卡片 */
.preset-card {
  padding: 14px;
  border-radius: var(--vtsuru-radius, 6px);
  cursor: pointer;
  border: 1px solid var(--vtsuru-border);
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  display: flex;
  flex-direction: column;
  gap: 4px;
  height: 100%;
  box-sizing: border-box;
}

.preset-card:hover {
  border-color: var(--vtsuru-primary);
  transform: translateY(-2px);
  box-shadow: var(--vtsuru-shadow-1);
}

.preset-card--dark {
  background-color: #14141e;
  color: #fbbf24;
}

.preset-card--warm {
  background-color: #28140a;
  color: #ff9f43;
}

.preset-card--purple {
  background-color: #190f28;
  color: #c084fc;
}

.preset-name {
  font-size: 13px;
  font-weight: 600;
}

.preset-desc {
  font-size: 11px;
  opacity: 0.75;
  line-height: 1.4;
}

/* 历史榜单单项 */
.history-rank-item {
  padding: 8px 12px;
  border-radius: var(--vtsuru-radius, 6px);
  background: var(--vtsuru-bg-elevated);
  border: 1px solid var(--vtsuru-border);
}

.rank-num {
  font-weight: 700;
  width: 22px;
  text-align: center;
  font-size: 13px;
  color: var(--vtsuru-fg-muted);
}

.rank-num--top1 {
  color: #eab308;
}

.rank-num--top2 {
  color: #94a3b8;
}

.rank-num--top3 {
  color: #b45309;
}
</style>
