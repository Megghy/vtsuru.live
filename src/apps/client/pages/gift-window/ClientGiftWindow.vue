<script setup lang="ts">
import { Check, Copy, Gift, Ship, Trophy, Users } from 'lucide-vue-next'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'

import { EventDataTypes, GuardLevel } from '@/api/generated/model'
import type {
  GiftEntry,
  GiftWindowBCData,
  GiftWindowSettings,
  OnlineGuardEntry,
  OnlineViewerEntry,
  RankEntry,
  RankViewMode,
  ThankSummaryItem,
} from '@/apps/client/store/useGiftWindow'
import { GIFT_WINDOW_BROADCAST_CHANNEL } from '@/apps/client/store/useGiftWindow'
import { formatYuanPrice } from '@/apps/client/utils/overlayWindow'
import { resolveFontFamilyCss, useGoogleFont } from '@/apps/user-page/googleFonts'
import { Spin } from '@/shared/ui/spin'

import './ClientGiftWindow.css'
import { ToggleGroup, ToggleGroupItem } from '@/shared/ui/toggle-group'
import { postBroadcastMessage } from '@/shared/utils/broadcastChannel'

let bc: BroadcastChannel | undefined
const setting = ref<GiftWindowSettings>()
const giftList = ref<GiftEntry[]>([])
const rankList = ref<RankEntry[]>([])
const onlineGuardList = ref<OnlineGuardEntry[]>([])
const onlineViewerList = ref<OnlineViewerEntry[]>([])
const activeRankTab = ref<RankViewMode>('thank_summary')
const isCopied = ref(false)
let copyTimer: ReturnType<typeof setTimeout> | null = null

const hasContent = computed(
  () =>
    giftList.value.length > 0 ||
    rankList.value.length > 0 ||
    onlineGuardList.value.length > 0 ||
    onlineViewerList.value.length > 0,
)

const thankSummaryList = computed<ThankSummaryItem[]>(() => {
  const ranked = rankList.value
  const guards = onlineGuardList.value
  const rankedIds = new Set(ranked.map((r) => r.id))

  const items: ThankSummaryItem[] = ranked.map((r, idx) => ({
    id: r.id,
    uid: r.uid,
    uname: r.uname,
    uface: r.uface,
    totalPaid: r.totalPaid,
    guardLevel: r.guardLevel,
    isOnline: r.isOnline,
    lastActiveTime: r.lastActiveTime,
    isTopRank: true,
    rankIndex: idx + 1,
    isGuardOnly: false,
  }))

  const extraGuards = guards.filter((g) => !rankedIds.has(g.id))
  for (const g of extraGuards) {
    items.push({
      id: g.id,
      uid: g.uid,
      uname: g.uname,
      uface: g.uface,
      totalPaid: g.totalPaid,
      guardLevel: g.guardLevel,
      isOnline: true,
      lastActiveTime: g.lastActiveTime,
      isTopRank: false,
      isGuardOnly: true,
    })
  }

  return items
})

useGoogleFont(computed(() => setting.value?.fontFamily || undefined))

function updateCssVariables() {
  if (!setting.value) return
  const root = document.documentElement
  root.style.setProperty('--gw-bg-color', setting.value.backgroundColor)
  root.style.setProperty('--gw-window-bg-color', setting.value.windowBackgroundColor)
  root.style.setProperty('--gw-text-color', setting.value.textColor)
  root.style.setProperty('--gw-highlight-color', setting.value.highlightColor)
  root.style.setProperty('--gw-border-radius', `${setting.value.borderRadius}px`)
  root.style.setProperty('--gw-opacity', `${setting.value.opacity}`)
  root.style.setProperty('--gw-font-size', `${setting.value.fontSize}px`)
  root.style.setProperty(
    '--gw-font-family',
    setting.value.fontFamily ? resolveFontFamilyCss(setting.value.fontFamily) : 'inherit',
  )
  root.style.setProperty('--gw-item-spacing', `${setting.value.itemSpacing}px`)
  root.style.setProperty('--gw-avatar-size', `${setting.value.fontSize + 10}px`)
}

function formatPrice(price: number): string {
  return formatYuanPrice(price)
}

function getTimeDiff(time: number): string {
  const diff = Math.floor((Date.now() - time) / 1000)
  if (diff < 5) return '刚刚'
  if (diff < 60) return `${diff}s`
  if (diff < 3600) return `${Math.floor(diff / 60)}m`
  return `${Math.floor(diff / 3600)}h`
}

function getGuardLabel(level: GuardLevel): string {
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

async function startResize() {
  const win = getCurrentWindow()
  await win.startResizeDragging('SouthEast')
}

function formatRankScore(score: number): string {
  return `¥${score.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
}

function copyOnlineViewersThankText() {
  const viewers = onlineViewerList.value
  if (viewers.length === 0) return

  const guards: string[] = []
  const formerGuards: string[] = []
  const fansWithMedal: string[] = []
  const others: string[] = []

  for (const v of viewers) {
    if (v.guardLevel > 0) {
      guards.push(`${v.uname} [${getGuardLabel(v.guardLevel)}]`)
    } else if (v.isFormerGuard) {
      formerGuards.push(`${v.uname} (老舰长)`)
    } else if (v.medalLevel && v.medalLevel > 0) {
      fansWithMedal.push(`${v.uname} [${v.medalName || '粉丝'} Lv.${v.medalLevel}]`)
    } else {
      others.push(v.uname)
    }
  }

  const sections: string[] = []
  if (guards.length > 0) {
    sections.push(`在场大航海：${guards.join('、')}`)
  }
  if (formerGuards.length > 0) {
    sections.push(`老舰长陪伴：${formerGuards.join('、')}`)
  }
  if (fansWithMedal.length > 0) {
    sections.push(`高牌子陪伴：${fansWithMedal.join('、')}`)
  }
  if (others.length > 0) {
    sections.push(`在线观众：${others.join('、')}`)
  }

  const text = `感谢大家的在线陪伴与支持！\n${sections.join('\n')}`
  navigator.clipboard.writeText(text).then(() => {
    isCopied.value = true
    if (copyTimer) clearTimeout(copyTimer)
    copyTimer = setTimeout(() => {
      isCopied.value = false
    }, 2000)
  })
}

onMounted(() => {
  bc = new BroadcastChannel(GIFT_WINDOW_BROADCAST_CHANNEL)
  postBroadcastMessage(bc, { type: 'window-ready' })
  bc.onmessage = (event) => {
    const data = event.data as GiftWindowBCData
    switch (data.type) {
      case 'gift-list':
        giftList.value = data.data
        break
      case 'rank-list':
        rankList.value = data.data
        break
      case 'online-guard-list':
        onlineGuardList.value = data.data
        break
      case 'online-viewer-list':
        onlineViewerList.value = data.data
        break
      case 'update-setting':
        setting.value = data.data
        if (data.data.rankViewMode) {
          activeRankTab.value = data.data.rankViewMode
        }
        updateCssVariables()
        break
      case 'clear':
        giftList.value = []
        rankList.value = []
        onlineGuardList.value = []
        onlineViewerList.value = []
        break
    }
  }
  updateCssVariables()
})

onUnmounted(() => {
  bc?.close()
  bc = undefined
  if (copyTimer) {
    clearTimeout(copyTimer)
    copyTimer = null
  }
})

watch(
  () => setting.value,
  () => updateCssVariables(),
  { deep: true },
)
</script>

<template>
  <div
    v-if="!setting"
    class="flex-center w-full h-full min-h-[100px]"
  >
    <Spin size="medium" />
  </div>
  <div
    v-else
    class="gw"
    :class="{
      compact: setting.compactMode,
      'has-scrollbar': setting.showScrollbar,
    }"
  >
    <div class="gw-header">
      <span class="gw-header__title">礼物与排行</span>
      <div class="gw-header__status">
        <span
          v-if="onlineGuardList.length > 0"
          class="gw-guard-badge"
          title="当前在场大航海人数"
        >
          <Ship class="size-3.5 inline-block" />
          <span>在场 {{ onlineGuardList.length }}</span>
        </span>
      </div>
    </div>
    <div
      class="gw-body"
      :class="setting.showScrollbar ? 'scrollbar-thin' : 'no-scrollbar'"
    >
      <!-- 礼物列表 -->
      <template v-if="setting.showGiftList">
        <TransitionGroup
          v-if="giftList.length > 0"
          name="gw-anim"
          tag="div"
          class="gw-list"
        >
          <div
            v-for="item in giftList"
            :key="item.id"
            class="gw-item"
            :class="{
              'gw-item--sc': item.type === EventDataTypes.SC,
              'gw-item--guard': item.type === EventDataTypes.Guard,
            }"
          >
            <div class="gw-item__icon">
              <img
                v-if="item.giftIcon"
                :src="item.giftIcon"
                referrerpolicy="no-referrer"
                class="gw-item__gift-img"
                alt=""
              />
              <div
                v-else-if="item.type === EventDataTypes.SC"
                class="gw-item__type-icon gw-item__type-icon--sc"
              >
                SC
              </div>
              <div
                v-else-if="item.type === EventDataTypes.Guard"
                class="gw-item__type-icon gw-item__type-icon--guard"
              >
                {{ getGuardLabel(item.guardLevel).charAt(0) }}
              </div>
              <div
                v-else
                class="gw-item__type-icon gw-item__type-icon--gift"
              >
                礼
              </div>
            </div>
            <div class="gw-item__body">
              <div class="gw-item__top">
                <span class="gw-item__name">{{ item.uname }}</span>
                <span
                  v-if="setting.showTime"
                  class="gw-item__time"
                  >{{ getTimeDiff(item.firstTime) }}</span
                >
              </div>
              <div class="gw-item__bottom">
                <span class="gw-item__gift">{{ item.giftName }}</span>
                <span
                  v-if="item.totalNum > 1"
                  class="gw-item__num"
                  >×{{ item.totalNum }}</span
                >
              </div>
            </div>
            <div
              v-if="setting.showPrice && item.totalPrice > 0"
              class="gw-item__price"
            >
              {{ formatPrice(item.totalPrice) }}
            </div>
          </div>
        </TransitionGroup>
      </template>

      <!-- 排行榜与在线舰长/在线观众 -->
      <template
        v-if="setting.showRanking && (rankList.length > 0 || onlineGuardList.length > 0 || onlineViewerList.length > 0)"
      >
        <div
          v-if="setting.showGiftList && giftList.length > 0"
          class="gw-divider"
        />

        <!-- 排行榜顶部模式切换器 -->
        <div class="gw-rank-nav">
          <ToggleGroup
            type="single"
            size="xs"
            class="w-full"
            :model-value="activeRankTab"
            @update:model-value="
              (val) => {
                if (val) activeRankTab = val as RankViewMode
              }
            "
          >
            <ToggleGroupItem
              value="thank_summary"
              class="flex-1 gap-1 text-[11px]"
            >
              <Gift class="gw-tab-icon size-3.5" />
              <span>下播感谢</span>
            </ToggleGroupItem>
            <ToggleGroupItem
              value="rank"
              class="flex-1 gap-1 text-[11px]"
            >
              <Trophy class="gw-tab-icon size-3.5" />
              <span>打赏榜 ({{ rankList.length }})</span>
            </ToggleGroupItem>
            <ToggleGroupItem
              value="online_guard"
              class="flex-1 gap-1 text-[11px]"
            >
              <Ship class="gw-tab-icon size-3.5" />
              <span>在场舰长 ({{ onlineGuardList.length }})</span>
            </ToggleGroupItem>
            <ToggleGroupItem
              value="online_viewers"
              class="flex-1 gap-1 text-[11px]"
            >
              <Users class="gw-tab-icon size-3.5" />
              <span>在线观众 ({{ onlineViewerList.length }})</span>
            </ToggleGroupItem>
          </ToggleGroup>
        </div>

        <!-- 视图 1: 下播感谢合集 (Top 50 + 在场舰长) -->
        <div
          v-if="activeRankTab === 'thank_summary'"
          class="gw-rank-list"
        >
          <div
            v-for="(r, idx) in thankSummaryList"
            :key="r.id"
            class="gw-rank-item"
            :class="{
              'gw-rank-top': r.isTopRank && idx < 3,
              'gw-rank-guard-only': r.isGuardOnly,
            }"
          >
            <div class="gw-rank-left">
              <span
                v-if="r.isTopRank"
                class="gw-rank-idx"
                :class="`gw-rank-idx--${idx < 3 ? idx + 1 : 'n'}`"
              >
                {{ r.rankIndex }}
              </span>
              <span
                v-else
                class="gw-rank-guard-icon"
              >
                <Ship class="size-3.5" />
              </span>

              <div class="gw-avatar-wrap">
                <img
                  v-if="setting.showAvatar && r.uface"
                  :src="r.uface"
                  referrerpolicy="no-referrer"
                  class="gw-avatar"
                  alt=""
                />
                <span
                  class="gw-online-dot"
                  :class="{ online: r.isOnline }"
                  :title="r.isOnline ? '在场活跃' : '离线'"
                />
              </div>

              <div class="gw-user-info">
                <div class="gw-user-name-row">
                  <span class="gw-rank-name">{{ r.uname }}</span>
                  <span
                    v-if="r.guardLevel > 0"
                    class="gw-guard-tag"
                    :class="`gw-guard-tag--${r.guardLevel}`"
                  >
                    {{ getGuardLabel(r.guardLevel) }}
                  </span>
                </div>
                <span
                  v-if="r.isGuardOnly"
                  class="gw-sub-info"
                >
                  在场大航海 · {{ getTimeDiff(r.lastActiveTime) }}前活跃
                </span>
              </div>
            </div>

            <div class="gw-rank-right">
              <span
                v-if="r.totalPaid > 0"
                class="gw-rank-score"
              >
                {{ formatRankScore(r.totalPaid) }}
              </span>
              <span
                v-else
                class="gw-online-badge"
              >
                在场
              </span>
            </div>
          </div>
        </div>

        <!-- 视图 2: 纯打赏榜单 -->
        <div
          v-else-if="activeRankTab === 'rank'"
          class="gw-rank-list"
        >
          <div
            v-for="(r, idx) in rankList"
            :key="r.id"
            class="gw-rank-item"
            :class="{ 'gw-rank-top': idx < 3 }"
          >
            <div class="gw-rank-left">
              <span
                class="gw-rank-idx"
                :class="`gw-rank-idx--${idx < 3 ? idx + 1 : 'n'}`"
              >
                {{ idx + 1 }}
              </span>
              <div class="gw-avatar-wrap">
                <img
                  v-if="setting.showAvatar && r.uface"
                  :src="r.uface"
                  referrerpolicy="no-referrer"
                  class="gw-avatar"
                  alt=""
                />
                <span
                  class="gw-online-dot"
                  :class="{ online: r.isOnline }"
                  :title="r.isOnline ? '在场活跃' : '离线'"
                />
              </div>
              <div class="gw-user-info">
                <div class="gw-user-name-row">
                  <span class="gw-rank-name">{{ r.uname }}</span>
                  <span
                    v-if="r.guardLevel > 0"
                    class="gw-guard-tag"
                    :class="`gw-guard-tag--${r.guardLevel}`"
                  >
                    {{ getGuardLabel(r.guardLevel) }}
                  </span>
                </div>
              </div>
            </div>
            <span class="gw-rank-score">{{ formatRankScore(r.score) }}</span>
          </div>
        </div>

        <!-- 视图 3: 在场舰长 -->
        <div
          v-else-if="activeRankTab === 'online_guard'"
          class="gw-rank-list"
        >
          <div
            v-if="onlineGuardList.length === 0"
            class="gw-sub-empty"
          >
            当前直播间暂无在场舰长活跃记录
          </div>
          <div
            v-for="g in onlineGuardList"
            :key="g.id"
            class="gw-rank-item gw-rank-guard-item"
          >
            <div class="gw-rank-left">
              <span
                class="gw-guard-tag gw-guard-tag--badge"
                :class="`gw-guard-tag--${g.guardLevel}`"
              >
                {{ getGuardLabel(g.guardLevel) }}
              </span>
              <div class="gw-avatar-wrap">
                <img
                  v-if="setting.showAvatar && g.uface"
                  :src="g.uface"
                  referrerpolicy="no-referrer"
                  class="gw-avatar"
                  alt=""
                />
                <span class="gw-online-dot online" />
              </div>
              <div class="gw-user-info">
                <span class="gw-rank-name">{{ g.uname }}</span>
                <span class="gw-sub-info">{{ g.lastAction }} · {{ getTimeDiff(g.lastActiveTime) }}前</span>
              </div>
            </div>
            <div class="gw-rank-right">
              <span
                v-if="g.totalPaid > 0"
                class="gw-rank-score"
              >
                {{ formatRankScore(g.totalPaid) }}
              </span>
              <span
                v-else
                class="gw-online-badge"
              >
                在场
              </span>
            </div>
          </div>
        </div>

        <!-- 视图 4: 在线观众 (高能榜 + 活跃观众 + 老舰长 + 高牌子) -->
        <div
          v-else-if="activeRankTab === 'online_viewers'"
          class="gw-rank-list"
        >
          <div
            v-if="onlineViewerList.length === 0"
            class="gw-sub-empty"
          >
            当前暂无在线观众数据，正在获取高能榜...
          </div>
          <template v-else>
            <div
              v-for="v in onlineViewerList"
              :key="v.id"
              class="gw-rank-item"
            >
              <div class="gw-rank-left">
                <div class="gw-avatar-wrap">
                  <img
                    v-if="setting.showAvatar && v.uface"
                    :src="v.uface"
                    referrerpolicy="no-referrer"
                    class="gw-avatar"
                    alt=""
                  />
                  <span
                    class="gw-online-dot"
                    :class="{ online: v.isOnline }"
                    :title="v.isOnline ? '在场在线' : '离线'"
                  />
                </div>

                <div class="gw-user-info">
                  <div class="gw-user-name-row">
                    <span class="gw-rank-name">{{ v.uname }}</span>
                    <!-- 现任舰长徽标 -->
                    <span
                      v-if="v.guardLevel > 0"
                      class="gw-guard-tag"
                      :class="`gw-guard-tag--${v.guardLevel}`"
                    >
                      {{ getGuardLabel(v.guardLevel) }}
                    </span>
                    <!-- 曾是大航海 / 老舰长 荣誉标记 -->
                    <span
                      v-else-if="v.isFormerGuard"
                      class="gw-guard-tag gw-guard-tag--former"
                      title="曾为大航海老舰长"
                    >
                      老舰长
                    </span>
                    <!-- 粉丝牌等级 -->
                    <span
                      v-if="v.medalLevel && v.medalLevel > 0"
                      class="gw-medal-tag"
                      :title="`${v.medalName || '粉丝'} Lv.${v.medalLevel}`"
                    >
                      {{ v.medalName || '粉' }} {{ v.medalLevel }}
                    </span>
                  </div>
                  <span class="gw-sub-info"> {{ v.lastAction }} · {{ getTimeDiff(v.lastActiveTime) }}前 </span>
                </div>
              </div>

              <div class="gw-rank-right">
                <span
                  v-if="v.score && v.score > 0"
                  class="gw-viewer-score"
                  title="高能在线贡献"
                >
                  {{ v.score }}
                </span>
                <span
                  v-else
                  class="gw-online-badge"
                >
                  在场
                </span>
              </div>
            </div>

            <!-- 底部一键复制在线观众感谢名单 -->
            <div class="pt-2 pb-1 border-t border-white/10 flex-center">
              <button
                class="w-full py-1 px-2 text-xs rounded bg-white/10 hover:bg-white/15 text-white/90 border border-white/15 transition-all flex-center gap-1 active:scale-[0.98]"
                @click="copyOnlineViewersThankText"
              >
                <Check
                  v-if="isCopied"
                  class="size-3.5 text-emerald-400"
                />
                <Copy
                  v-else
                  class="size-3.5"
                />
                <span>{{ isCopied ? '已复制感谢名单' : '一键复制在场名单感谢' }}</span>
              </button>
            </div>
          </template>
        </div>
      </template>

      <div
        v-if="!hasContent"
        class="gw-empty"
      >
        等待中...
      </div>
    </div>
    <div
      class="gw-resize"
      @mousedown="startResize"
    />
  </div>
</template>
