<script setup lang="ts">
import { ArrowRight24Regular, ArrowSync24Regular, Gift24Regular, Open24Regular, Wallet24Regular } from '@vicons/fluent'
import { NAvatar, NButton, NEmpty, NIcon, NSpin, NTooltip, useMessage } from 'naive-ui'
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

import type { UserInfo } from '@/api/api-models'
import { getApiPointUserGetAllPoint } from '@/api/generated/point/point'
import AccountPageHeader from '@/apps/account/components/AccountPageHeader.vue'
import { useBiliAuth } from '@/store/useBiliAuth'

interface PointAccount {
  owner: UserInfo
  points: number
}

const auth = useBiliAuth()
const message = useMessage()
const router = useRouter()
const isLoading = ref(false)
const points = ref<PointAccount[]>([])

const totalPoints = computed(() => points.value.reduce((total, item) => total + item.points, 0))

async function loadPoints() {
  isLoading.value = true
  try {
    const response = (await getApiPointUserGetAllPoint({
      headers: Object.fromEntries(await auth.getBiliAuthHeaders()),
    })) as unknown as {
      code: number
      message?: string
      data: PointAccount[]
    }
    if (response.code !== 200) throw new Error(response.message)
    points.value = response.data
  } catch (error) {
    message.error(`获取积分失败：${error instanceof Error ? error.message : String(error)}`)
  } finally {
    isLoading.value = false
  }
}

onMounted(loadPoints)
</script>

<template>
  <div class="point-overview">
    <AccountPageHeader
      title="我的积分"
      subtitle="查看你在不同主播频道中的积分余额与兑换入口。"
    >
      <template #actions>
        <NButton
          secondary
          :loading="isLoading"
          @click="loadPoints"
        >
          <template #icon><NIcon :component="ArrowSync24Regular" /></template>
          刷新
        </NButton>
      </template>
    </AccountPageHeader>

    <div class="summary-grid">
      <div class="summary-item summary-item--primary">
        <span class="summary-icon"><NIcon :component="Wallet24Regular" /></span>
        <div class="summary-content">
          <span class="summary-label">积分总计</span>
          <strong class="summary-value">{{ totalPoints.toLocaleString() }}</strong>
        </div>
      </div>
      <div class="summary-item">
        <span class="summary-icon"><NIcon :component="Gift24Regular" /></span>
        <div class="summary-content">
          <span class="summary-label">已加入频道</span>
          <strong class="summary-value">{{ points.length }}</strong>
        </div>
      </div>
    </div>

    <section class="balance-panel">
      <div class="balance-panel__heading">
        <div>
          <h2>频道积分列表</h2>
          <p>进入各主播频道即可兑换当前可用的礼物与特权。</p>
        </div>
      </div>

      <NSpin :show="isLoading">
        <NEmpty
          v-if="!isLoading && points.length === 0"
          size="medium"
          description="暂无任何频道的积分"
          class="empty-state"
        >
          <template #extra>
            <span class="empty-tip">在已开通积分的主播直播间互动、签到或赠送礼物后，即可在此查看积分。</span>
          </template>
        </NEmpty>

        <div
          v-else
          class="balance-list"
        >
          <article
            v-for="item in points"
            :key="item.owner.id"
            class="balance-row"
          >
            <NAvatar
              :src="item.owner.faceUrl"
              round
              :size="40"
              class="balance-avatar"
            >
              {{ item.owner.name.slice(0, 1) }}
            </NAvatar>
            <div class="balance-owner">
              <div class="balance-owner__name-row">
                <strong>{{ item.owner.name }}</strong>
                <NTooltip v-if="item.owner.biliId">
                  <template #trigger>
                    <a
                      :href="`https://space.bilibili.com/${item.owner.biliId}`"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="bili-space-link"
                      title="打开 B 站空间"
                    >
                      <NIcon :component="Open24Regular" />
                    </a>
                  </template>
                  查看主播 Bilibili 空间
                </NTooltip>
              </div>
              <span class="balance-owner__sub">频道专属积分</span>
            </div>
            <div class="balance-value-cell">
              <strong class="balance-value">{{ item.points.toLocaleString() }}</strong>
              <span class="balance-unit">分</span>
            </div>
            <div class="balance-actions">
              <NButton
                secondary
                type="primary"
                size="small"
                @click="router.push({ name: 'user-goods', params: { id: item.owner.name } })"
              >
                前往兑换
                <template #icon><NIcon :component="ArrowRight24Regular" /></template>
              </NButton>
            </div>
          </article>
        </div>
      </NSpin>
    </section>
  </div>
</template>

<style scoped>
.point-overview {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.summary-item {
  display: flex;
  align-items: center;
  gap: 14px;
  min-height: 84px;
  padding: 14px 16px;
  border: 1px solid var(--vtsuru-border);
  border-radius: var(--vtsuru-radius);
  background: var(--vtsuru-bg-surface);
  box-shadow: var(--vtsuru-shadow-1, 0 1px 2px rgba(0, 0, 0, 0.03));
  transition: border-color 0.15s ease, background-color 0.15s ease;
}

.summary-item:hover {
  border-color: var(--vtsuru-border-hover, color-mix(in srgb, var(--vtsuru-fg) 20%, var(--vtsuru-border)));
}

.summary-item--primary {
  border-color: color-mix(in srgb, var(--vtsuru-primary) 32%, var(--vtsuru-border));
  background: color-mix(in srgb, var(--vtsuru-brand-tint) 40%, var(--vtsuru-bg-surface));
}

.summary-icon {
  display: grid;
  width: 40px;
  height: 40px;
  flex: 0 0 auto;
  place-items: center;
  border-radius: var(--vtsuru-radius-control);
  color: var(--vtsuru-primary);
  background: var(--vtsuru-brand-soft);
  font-size: 20px;
}

.summary-content {
  display: flex;
  min-width: 0;
  flex-direction: column;
}

.summary-label {
  color: var(--vtsuru-fg-muted);
  font-size: 12px;
  font-weight: 500;
  line-height: 1.4;
}

.summary-value {
  margin-top: 2px;
  color: var(--vtsuru-fg);
  font-size: 22px;
  font-weight: 700;
  line-height: 1.25;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.balance-panel {
  overflow: hidden;
  border: 1px solid var(--vtsuru-border);
  border-radius: var(--vtsuru-radius);
  background: var(--vtsuru-bg-surface);
  box-shadow: var(--vtsuru-shadow-1, 0 1px 2px rgba(0, 0, 0, 0.03));
}

.balance-panel__heading {
  padding: 14px 18px;
  border-bottom: 1px solid var(--vtsuru-border);
}

.balance-panel h2 {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: var(--vtsuru-fg);
  line-height: 1.35;
}

.balance-panel p {
  margin: 4px 0 0;
  color: var(--vtsuru-fg-muted);
  font-size: 12px;
}

.balance-panel :deep(.n-spin-container) {
  min-height: 160px;
}

.empty-state {
  padding: 40px 16px;
}

.empty-tip {
  color: var(--vtsuru-fg-muted);
  font-size: 12px;
  line-height: 1.5;
}

.balance-list {
  display: flex;
  flex-direction: column;
}

.balance-row {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto auto;
  align-items: center;
  gap: 14px;
  padding: 12px 18px;
  border-bottom: 1px solid var(--vtsuru-border);
  transition: background-color 0.15s ease;
}

.balance-row:hover {
  background-color: var(--vtsuru-bg-muted, rgba(127, 127, 127, 0.04));
}

.balance-row:last-child {
  border-bottom: 0;
}

.balance-avatar {
  flex-shrink: 0;
}

.balance-owner {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 2px;
}

.balance-owner__name-row {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.balance-owner__name-row strong {
  font-size: 14px;
  font-weight: 600;
  color: var(--vtsuru-fg);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.bili-space-link {
  display: inline-flex;
  align-items: center;
  color: var(--vtsuru-fg-muted);
  font-size: 13px;
  text-decoration: none;
  transition: color 0.15s ease;
}

.bili-space-link:hover {
  color: var(--vtsuru-primary);
}

.balance-owner__sub {
  color: var(--vtsuru-fg-muted);
  font-size: 12px;
}

.balance-value-cell {
  display: flex;
  align-items: baseline;
  gap: 3px;
  text-align: right;
}

.balance-value {
  color: var(--vtsuru-primary);
  font-size: 18px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.balance-unit {
  font-size: 11px;
  color: var(--vtsuru-fg-muted);
}

.balance-actions {
  display: flex;
  align-items: center;
}

@media (max-width: 640px) {
  .summary-grid {
    grid-template-columns: 1fr;
    gap: 8px;
  }

  .summary-item {
    min-height: 72px;
    padding: 12px;
  }

  .balance-row {
    grid-template-columns: auto minmax(0, 1fr) auto;
    gap: 10px;
    padding: 12px 14px;
  }

  .balance-actions {
    grid-column: 1 / -1;
    justify-content: flex-end;
    margin-top: 2px;
  }
}
</style>
