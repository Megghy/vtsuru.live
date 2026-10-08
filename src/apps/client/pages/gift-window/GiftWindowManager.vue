<script setup lang="ts">
import {
  ArrowReset24Regular,
  ArrowSync24Filled,
  Checkmark24Filled,
  Color24Filled,
  Copy24Regular,
  Delete24Regular,
  Desktop24Filled,
  Filter24Filled,
  History24Filled,
  Megaphone24Filled,
  Send24Filled,
  Trophy20Regular,
  VehicleShip20Regular,
  WindowShield20Regular,
} from '@vicons/fluent'
import {
  NAvatar,
  NButton,
  NButtonGroup,
  NCard,
  NCheckbox,
  NCheckboxGroup,
  NColorPicker,
  NDivider,
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

import { GuardLevel, type ResponseLiveInfoModel, type ResponseLiveRankingEntryModel } from '@/api/api-models'
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

const rankViewOptions = [
  { label: '下播感谢合集', value: 'thank_summary' },
  { label: '打赏贡献榜', value: 'rank' },
  { label: '在场大航海', value: 'online_guard' },
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

// 实时感谢数据
const realtimeRankList = computed(() => giftWindow.getRankedList())
const realtimeGuardList = computed(() => giftWindow.getOnlineGuardList())
const realtimeThankList = computed(() => giftWindow.getThankSummaryList())

function getGuardTitle(level: GuardLevel): string {
  switch (level) {
    case GuardLevel.Zongdu:
      return '总督'
    case GuardLevel.Tidu:
      return '提督'
    case GuardLevel.Jianzhang:
      return '舰长'
    default:
      return ''
  }
}

function formatPaid(totalPaid: number) {
  return `¥${totalPaid.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
}

function copyThankText() {
  const ranked = realtimeRankList.value
  const guards = realtimeGuardList.value

  const lines: string[] = []
  lines.push(`【本场打赏贡献榜 Top ${ranked.length}】`)
  if (ranked.length === 0) {
    lines.push('(暂无打赏记录)')
  } else {
    ranked.forEach((r, idx) => {
      const guardStr = r.guardLevel > 0 ? ` [${getGuardTitle(r.guardLevel)}]` : ''
      const onlineStr = r.isOnline ? ' (在场)' : ''
      lines.push(`${idx + 1}. ${r.uname} - ¥${r.score}${guardStr}${onlineStr}`)
    })
  }

  lines.push('')
  lines.push(`【在场大航海名单 (共 ${guards.length} 人)】`)
  if (guards.length === 0) {
    lines.push('(暂无在场大航海记录)')
  } else {
    guards.forEach((g) => {
      lines.push(`- ${g.uname} [${getGuardTitle(g.guardLevel)}] (${g.lastAction})`)
    })
  }

  const text = lines.join('\n')
  navigator.clipboard
    .writeText(text)
    .then(() => {
      message.success('已复制下播感谢文案至剪贴板')
    })
    .catch(() => {
      message.error('复制到剪贴板失败')
    })
}

// 历史榜单查询
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
        description="桌面半透明置顶礼物浮窗与高能排行榜，同窗口分屏或独立展示，支持实时打赏动画、在场舰长名单与下播感谢"
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
        default-value="thank"
        class="gift-tabs"
        @update:value="onTabChange"
      >
        <!-- 下播感谢与实时榜单 -->
        <NTabPane
          name="thank"
          tab="下播感谢看板"
        >
          <template #tab>
            <NFlex
              align="center"
              :size="6"
            >
              <NIcon :component="Megaphone24Filled" />
              <span>下播感谢看板</span>
            </NFlex>
          </template>

          <NFlex
            vertical
            :size="12"
            class="client-readable"
          >
            <NCard
              title="本场打赏前 50 ➕ 在场舰长名单"
              size="small"
              bordered
            >
              <template #header-extra>
                <NFlex :size="8">
                  <NButton
                    size="small"
                    type="primary"
                    secondary
                    @click="copyThankText"
                  >
                    <template #icon>
                      <NIcon :component="Copy24Regular" />
                    </template>
                    一键复制感谢文案
                  </NButton>
                </NFlex>
              </template>

              <NGrid
                cols="1 m:2"
                :x-gap="16"
                :y-gap="12"
              >
                <!-- 左列: 本场打赏榜 Top 50 -->
                <NGi>
                  <div class="thank-section-header">
                    <span class="thank-section-title">
                      <NIcon
                        :component="Trophy20Regular"
                        style="vertical-align: -2px; margin-right: 4px;"
                      />
                      本场打赏贡献榜 (前 {{ realtimeRankList.length }} 名)
                    </span>
                    <NTag
                      size="small"
                      :bordered="false"
                      type="warning"
                    >
                      上限 {{ giftWindow.settings.rankDisplayCount }} 人
                    </NTag>
                  </div>

                  <div class="thank-scroll-box">
                    <NEmpty
                      v-if="realtimeRankList.length === 0"
                      description="本场暂无打赏记录"
                      style="padding: 30px 0"
                    />
                    <div
                      v-else
                      class="thank-list"
                    >
                      <div
                        v-for="(r, idx) in realtimeRankList"
                        :key="r.id"
                        class="thank-item"
                        :class="{ 'thank-item--top': idx < 3 }"
                      >
                        <NFlex
                          align="center"
                          justify="space-between"
                          style="width: 100%"
                        >
                          <NFlex
                            align="center"
                            :size="8"
                          >
                            <span
                              class="thank-idx"
                              :class="{
                                'thank-idx--1': idx === 0,
                                'thank-idx--2': idx === 1,
                                'thank-idx--3': idx === 2,
                              }"
                            >
                              {{ idx + 1 }}
                            </span>
                            <div class="thank-avatar-wrap">
                              <NAvatar
                                round
                                size="small"
                                :src="r.uface || undefined"
                              />
                              <span
                                class="thank-online-dot"
                                :class="{ online: r.isOnline }"
                                :title="r.isOnline ? '在场活跃' : '离线'"
                              />
                            </div>
                            <NText strong>{{ r.uname }}</NText>
                            <NTag
                              v-if="r.guardLevel > 0"
                              size="tiny"
                              :bordered="false"
                              :type="r.guardLevel === GuardLevel.Zongdu ? 'error' : r.guardLevel === GuardLevel.Tidu ? 'warning' : 'info'"
                            >
                              {{ getGuardTitle(r.guardLevel) }}
                            </NTag>
                          </NFlex>

                          <NFlex
                            align="center"
                            :size="6"
                          >
                            <NTag
                              v-if="r.isOnline"
                              size="tiny"
                              type="success"
                              :bordered="false"
                            >
                              在场
                            </NTag>
                            <NText
                              type="warning"
                              strong
                            >
                              ¥{{ r.score.toLocaleString() }}
                            </NText>
                          </NFlex>
                        </NFlex>
                      </div>
                    </div>
                  </div>
                </NGi>

                <!-- 右列: 还在直播间的在场舰长 -->
                <NGi>
                  <div class="thank-section-header">
                    <span class="thank-section-title">
                      <NIcon
                        :component="VehicleShip20Regular"
                        style="vertical-align: -2px; margin-right: 4px;"
                      />
                      还在直播间的舰长 ({{ realtimeGuardList.length }} 人)
                    </span>
                    <NText depth="3" style="font-size: 12px">
                      {{ giftWindow.settings.onlineThresholdMinutes }} 分钟内有互动
                    </NText>
                  </div>

                  <div class="thank-scroll-box">
                    <NEmpty
                      v-if="realtimeGuardList.length === 0"
                      description="当前暂无在场大航海观众活跃"
                      style="padding: 30px 0"
                    />
                    <div
                      v-else
                      class="thank-list"
                    >
                      <div
                        v-for="g in realtimeGuardList"
                        :key="g.id"
                        class="thank-item thank-item--guard"
                      >
                        <NFlex
                          align="center"
                          justify="space-between"
                          style="width: 100%"
                        >
                          <NFlex
                            align="center"
                            :size="8"
                          >
                            <NTag
                              size="small"
                              :bordered="false"
                              :type="g.guardLevel === GuardLevel.Zongdu ? 'error' : g.guardLevel === GuardLevel.Tidu ? 'warning' : 'info'"
                            >
                              {{ getGuardTitle(g.guardLevel) }}
                            </NTag>
                            <div class="thank-avatar-wrap">
                              <NAvatar
                                round
                                size="small"
                                :src="g.uface || undefined"
                              />
                              <span class="thank-online-dot online" />
                            </div>
                            <NText strong>{{ g.uname }}</NText>
                          </NFlex>

                          <NFlex
                            align="center"
                            :size="6"
                          >
                            <NText
                              depth="3"
                              style="font-size: 11px"
                            >
                              {{ g.lastAction }}
                            </NText>
                            <NTag
                              v-if="g.rankIndex"
                              size="tiny"
                              type="warning"
                              :bordered="false"
                            >
                              榜 #{{ g.rankIndex }}
                            </NTag>
                          </NFlex>
                        </NFlex>
                      </div>
                    </div>
                  </div>
                </NGi>
              </NGrid>
            </NCard>
          </NFlex>
        </NTabPane>

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
                  cols="2 s:3"
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
                  <NGi>
                    <LabelItem
                      label="浮窗滚动条"
                      description="显示极简半透明细滚动条"
                    >
                      <NSwitch v-model:value="giftWindow.settings.showScrollbar" />
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
                  description="在同窗口内展示本场直播打赏榜与在场舰长名单"
                >
                  <NSwitch v-model:value="giftWindow.settings.showRanking" />
                </LabelItem>
                <LabelItem
                  v-if="giftWindow.settings.showRanking"
                  label="浮窗默认排行视图"
                  description="打开浮窗时默认聚焦的排行板块"
                >
                  <NRadioGroup v-model:value="giftWindow.settings.rankViewMode">
                    <NFlex :size="8">
                      <NRadioButton
                        v-for="opt in rankViewOptions"
                        :key="opt.value"
                        :value="opt.value"
                      >
                        {{ opt.label }}
                      </NRadioButton>
                    </NFlex>
                  </NRadioGroup>
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
                <LabelItem
                  label="防 OBS / 屏幕共享捕捉 (防抓取)"
                  description="开启后 OBS 抓屏、全屏捕获与截屏工具将无法捕捉到此浮窗，防止遮挡游戏画面与隐私泄露"
                >
                  <template #icon>
                    <NIcon :component="WindowShield20Regular" />
                  </template>
                  <NSwitch v-model:value="giftWindow.settings.contentProtected" />
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

            <!-- 排行榜与在场规则 -->
            <NCard
              title="排行榜与在场规则"
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
                    label="排行榜显示人数上限"
                    label-placement="top"
                  >
                    <NInputNumber
                      v-model:value="giftWindow.settings.rankDisplayCount"
                      :min="5"
                      :max="200"
                      :step="10"
                    />
                  </NFormItem>
                  <NText
                    depth="3"
                    style="font-size: 12px; display: block; margin-top: -6px;"
                  >
                    依据本场直播累计送出的付费礼物与大航海总价值计算，建议设为 50。
                  </NText>
                </NGi>
                <NGi>
                  <NFormItem
                    label="在场活跃判定时间 (分钟)"
                    label-placement="top"
                  >
                    <NInputNumber
                      v-model:value="giftWindow.settings.onlineThresholdMinutes"
                      :min="5"
                      :max="120"
                      :step="5"
                    >
                      <template #suffix> 分钟 </template>
                    </NInputNumber>
                  </NFormItem>
                  <NText
                    depth="3"
                    style="font-size: 12px; display: block; margin-top: -6px;"
                  >
                    观众在该时间内有发言、送礼、进入或点赞即视为「还在直播间」。
                  </NText>
                </NGi>
              </NGrid>
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
                    :key="item.ouId"
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
                          :src="item.uFace || undefined"
                        />
                        <NText strong>{{ item.uName }}</NText>
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
  max-width: 580px;
}

/* 感谢看板 */
.thank-section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.thank-section-title {
  font-weight: 600;
  font-size: 13px;
  color: var(--vtsuru-fg);
}

.thank-scroll-box {
  max-height: 460px;
  overflow-y: auto;
  padding-right: 4px;
}

.thank-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.thank-item {
  padding: 8px 12px;
  border-radius: var(--vtsuru-radius, 6px);
  background: var(--vtsuru-bg-elevated);
  border: 1px solid var(--vtsuru-border);
  transition: all 0.15s ease;
}

.thank-item:hover {
  border-color: var(--vtsuru-primary);
}

.thank-item--top {
  border-color: rgba(234, 179, 8, 0.35);
  background: rgba(234, 179, 8, 0.04);
}

.thank-item--guard {
  border-color: rgba(56, 189, 248, 0.3);
  background: rgba(56, 189, 248, 0.04);
}

.thank-idx {
  width: 20px;
  font-weight: 700;
  font-size: 12px;
  text-align: center;
  color: var(--vtsuru-fg-muted);
}

.thank-idx--1 {
  color: #eab308;
}

.thank-idx--2 {
  color: #94a3b8;
}

.thank-idx--3 {
  color: #d97706;
}

.thank-avatar-wrap {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

.thank-online-dot {
  position: absolute;
  right: -2px;
  bottom: -2px;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #94a3b8;
  border: 1.5px solid var(--vtsuru-bg-elevated);
}

.thank-online-dot.online {
  background: #22c55e;
  box-shadow: 0 0 4px #22c55e;
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
