<script setup lang="ts">
import { formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { computed, ref, watch } from 'vue'

import type { ResponsePointHisrotyModel } from '@/api/api-models'
import { EventDataTypes, PointFrom } from '@/api/api-models'
import { formatDanmakuPrice, getDanmakuGiftDisplayMeta } from '@/shared/utils/danmakuGiftDisplay'

import PointGoodsItem from './PointGoodsItem.vue'

const props = defineProps<{
  histories: ResponsePointHisrotyModel[]
}>()

const page = ref(1)
const pageSize = 10
const showGoodsModal = ref(false)
const currentHistory = ref<ResponsePointHisrotyModel>()
const currentGoods = computed(() => currentHistory.value?.extra?.goods)
const selectedSubItems = computed(() => currentHistory.value?.extra?.selectedSubItems ?? [])
const pageCount = computed(() => Math.ceil(props.histories.length / pageSize))
const pagedHistories = computed(() => props.histories.slice((page.value - 1) * pageSize, page.value * pageSize))

watch(
  () => props.histories,
  () => (page.value = 1),
)

function formatHistoryTime(time: number | string | Date) {
  return formatDistanceToNow(new Date(time), { addSuffix: true, locale: zhCN })
}

function sourceMeta(row: ResponsePointHisrotyModel): {
  label: string
  color: 'info' | 'success' | 'error' | 'warning'
} {
  switch (row.from) {
    case PointFrom.Danmaku:
      return { label: '直播互动', color: 'info' }
    case PointFrom.Manual:
      return { label: row.point >= 0 ? '主播赠予' : '主播扣除', color: row.point >= 0 ? 'success' : 'error' }
    case PointFrom.Use:
      return { label: '礼物兑换', color: 'warning' }
    case PointFrom.CheckIn:
      return { label: '签到', color: 'success' }
    case PointFrom.DailyFirstInteraction:
      return { label: '首次互动', color: 'info' }
  }
}

function giftDetail(row: ResponsePointHisrotyModel) {
  const danmaku = row.extra?.danmaku
  if (!danmaku) return '礼物详情缺失'
  const gift = getDanmakuGiftDisplayMeta({ ...danmaku, num: row.count ?? danmaku.num })
  return [
    gift.giftSummaryText,
    gift.mysteryBoxPriceText ? `盲盒 ￥${gift.mysteryBoxPriceText}` : '',
    gift.giftPriceText ? `价值 ￥${gift.giftPriceText}` : '',
  ]
    .filter(Boolean)
    .join(' · ')
}

function detailText(row: ResponsePointHisrotyModel) {
  switch (row.from) {
    case PointFrom.Danmaku:
      if (row.type === EventDataTypes.Guard) return `上舰 · ${row.extra?.danmaku?.msg || '舰长支持'}`
      if (row.type === EventDataTypes.Gift) return giftDetail(row)
      if (row.type === EventDataTypes.SC)
        return `SC ￥${formatDanmakuPrice(row.extra?.danmaku?.price) ?? row.extra?.danmaku?.price ?? 0}`
      return row.extra?.danmaku?.msg || '直播互动'
    case PointFrom.Manual:
      return row.extra?.reason || '未填写调整备注'
    case PointFrom.Use: {
      const variants = row.extra?.selectedSubItems?.map((item) => `${item.nameSnapshot} x ${item.quantity}`).join(' / ')
      return [row.extra?.goods?.name || '已删除的礼物', variants, row.extra?.remark].filter(Boolean).join(' · ')
    }
    case PointFrom.CheckIn:
      return '每日签到奖励'
    case PointFrom.DailyFirstInteraction:
      return row.extra?.interactionType === 'gift' ? giftDetail(row) : row.extra?.danmaku?.msg || '每日首次互动奖励'
  }
}

function openGoods(row: ResponsePointHisrotyModel) {
  currentHistory.value = row
  showGoodsModal.value = true
}
</script>

<template>
  <div
    v-if="histories.length === 0"
    class="history-empty"
  >
    <UIcon name="i-lucide-history" />
    <span>暂无积分记录</span>
  </div>
  <template v-else>
    <div class="history-table-wrap">
      <table class="history-table">
        <thead>
          <tr>
            <th>时间</th>
            <th>积分变动</th>
            <th>来源</th>
            <th>详情</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="item in pagedHistories"
            :key="`${item.ouId}-${item.createAt}-${item.from}`"
          >
            <td>{{ formatHistoryTime(item.createAt) }}</td>
            <td>
              <strong :class="item.point < 0 ? 'point-value--out' : 'point-value--in'"
                >{{ item.point > 0 ? '+' : '' }}{{ Number(item.point.toFixed(1)) }}</strong
              >
            </td>
            <td>
              <div class="history-source">
                <UBadge
                  size="sm"
                  :color="sourceMeta(item).color"
                  :label="sourceMeta(item).label"
                />
                <a
                  v-if="item.extra?.user?.name"
                  :href="`/@${item.extra.user.name}`"
                  target="_blank"
                  >{{ item.extra.user.name }}</a
                >
              </div>
            </td>
            <td class="history-detail">
              <button
                v-if="item.from === PointFrom.Use && item.extra?.goods"
                type="button"
                class="history-link"
                @click="openGoods(item)"
              >
                {{ item.extra.goods.name }}
              </button>
              <span :title="detailText(item)">{{ detailText(item) }}</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="mobile-history-list">
      <article
        v-for="item in pagedHistories"
        :key="`${item.ouId}-${item.createAt}-${item.from}`"
        class="mobile-history-card"
      >
        <div class="mobile-history-card__topline">
          <UBadge
            size="sm"
            :color="sourceMeta(item).color"
            :label="sourceMeta(item).label"
          />
          <strong :class="item.point < 0 ? 'point-value--out' : 'point-value--in'"
            >{{ item.point > 0 ? '+' : '' }}{{ Number(item.point.toFixed(1)) }}</strong
          >
        </div>
        <button
          v-if="item.from === PointFrom.Use && item.extra?.goods"
          type="button"
          class="history-link"
          @click="openGoods(item)"
        >
          {{ item.extra.goods.name }}
        </button>
        <div class="mobile-history-card__detail">{{ detailText(item) }}</div>
        <div class="mobile-history-card__meta">
          <a
            v-if="item.extra?.user?.name"
            :href="`/@${item.extra.user.name}`"
            target="_blank"
            >{{ item.extra.user.name }}</a
          >
          <span v-else />
          <span>{{ formatHistoryTime(item.createAt) }}</span>
        </div>
      </article>
    </div>

    <div
      v-if="pageCount > 1"
      class="history-pagination"
    >
      <UButton
        color="neutral"
        variant="outline"
        size="sm"
        :disabled="page === 1"
        @click="page--"
        >上一页</UButton
      >
      <span>{{ page }} / {{ pageCount }}</span>
      <UButton
        color="neutral"
        variant="outline"
        size="sm"
        :disabled="page === pageCount"
        @click="page++"
        >下一页</UButton
      >
    </div>
  </template>

  <UModal
    v-if="currentHistory"
    v-model:open="showGoodsModal"
    title="礼物快照"
  >
    <template #body>
      <div class="history-modal-content">
        <PointGoodsItem
          v-if="currentGoods"
          :goods="currentGoods"
        />
        <template v-if="selectedSubItems.length">
          <USeparator label="已选款式" />
          <div class="history-variant-grid">
            <div
              v-for="item in selectedSubItems"
              :key="item.subItemId"
              class="history-variant"
            >
              <strong>{{ item.nameSnapshot }}</strong
              ><span>x {{ item.quantity }}</span
              ><UBadge
                size="xs"
                color="info"
                :label="`${item.priceSnapshot} 积分`"
              />
            </div>
          </div>
        </template>
        <template v-if="currentGoods?.content">
          <USeparator label="礼物内容" />
          <UTextarea
            :model-value="currentGoods.content"
            readonly
            :rows="3"
            :maxrows="8"
          />
        </template>
        <template v-if="currentHistory.extra?.remark">
          <USeparator label="兑换留言" />
          <p class="history-remark">{{ currentHistory.extra.remark }}</p>
        </template>
      </div>
    </template>
  </UModal>
</template>

<style scoped>
.history-empty {
  display: grid;
  min-height: 180px;
  place-content: center;
  gap: 10px;
  color: var(--vtsuru-fg-muted);
  text-align: center;
}
.history-empty :first-child {
  font-size: 28px;
}
.history-table-wrap {
  overflow-x: auto;
  border: 1px solid var(--vtsuru-border);
  border-radius: var(--vtsuru-radius);
}
.history-table {
  width: 100%;
  min-width: 680px;
  border-collapse: collapse;
  color: var(--vtsuru-fg);
  font-size: 13px;
}
.history-table th,
.history-table td {
  padding: 11px 14px;
  border-bottom: 1px solid var(--vtsuru-border);
  text-align: left;
}
.history-table th {
  color: var(--vtsuru-fg-muted);
  background: var(--vtsuru-bg-muted);
  font-size: 12px;
  font-weight: 600;
}
.history-table tbody tr:last-child td {
  border-bottom: 0;
}
.history-source,
.mobile-history-card__meta {
  display: flex;
  align-items: center;
  gap: 8px;
}
.history-source a,
.mobile-history-card__meta a,
.history-link {
  color: var(--vtsuru-brand);
  text-decoration: none;
}
.history-link {
  display: block;
  overflow: hidden;
  max-width: 100%;
  padding: 0;
  border: 0;
  background: transparent;
  font: inherit;
  text-align: left;
  cursor: pointer;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.history-detail > span {
  display: block;
  overflow: hidden;
  max-width: 100%;
  color: var(--vtsuru-fg-muted);
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.point-value--in {
  color: var(--vtsuru-success);
}
.point-value--out {
  color: var(--vtsuru-error);
}
.mobile-history-list {
  display: none;
}
.history-pagination {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 12px;
  color: var(--vtsuru-fg-muted);
  font-size: 12px;
}
.history-modal-content {
  display: grid;
  gap: 14px;
}
.history-variant-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}
.history-variant {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 5px 8px;
  padding: 10px;
  border: 1px solid var(--vtsuru-border);
  border-radius: var(--vtsuru-radius);
  background: var(--vtsuru-bg-elevated);
}
.history-variant :last-child {
  grid-column: 1 / -1;
  justify-self: start;
}
.history-remark {
  margin: 0;
  color: var(--vtsuru-fg);
  white-space: pre-wrap;
}
@media (max-width: 768px) {
  .history-table-wrap {
    display: none;
  }
  .mobile-history-list {
    display: grid;
    gap: 8px;
  }
  .mobile-history-card {
    display: grid;
    min-width: 0;
    gap: 8px;
    padding: 12px;
    border: 1px solid var(--vtsuru-border);
    border-radius: var(--vtsuru-radius);
    background: var(--vtsuru-bg);
  }
  .mobile-history-card__topline,
  .mobile-history-card__meta {
    justify-content: space-between;
  }
  .mobile-history-card__detail {
    overflow-wrap: anywhere;
    color: var(--vtsuru-fg);
    line-height: 1.55;
  }
  .mobile-history-card__meta {
    color: var(--vtsuru-fg-muted);
    font-size: 12px;
  }
  .history-variant-grid {
    grid-template-columns: 1fr;
  }
}
</style>
