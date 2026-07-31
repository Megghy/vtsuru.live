<script setup lang="ts">
import { ArrowRight24Regular, ArrowSync24Regular, Gift24Regular, Wallet24Regular } from '@vicons/fluent'
import { NAvatar, NButton, NEmpty, NIcon, NSpin, useMessage } from 'naive-ui'
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

import type { UserInfo } from '@/api/api-models'
import { POINT_API_URL } from '@/shared/config'
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
    const response = await auth.QueryBiliAuthGetAPI<PointAccount[]>(`${POINT_API_URL}user/get-all-point`)
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
    <div class="page-heading">
      <div>
        <span>POINTS OVERVIEW</span>
        <h1>我的积分</h1>
        <p>查看你在不同主播频道中的积分余额。</p>
      </div>
      <NButton
        secondary
        :loading="isLoading"
        @click="loadPoints"
      >
        <template #icon><NIcon :component="ArrowSync24Regular" /></template>
        刷新
      </NButton>
    </div>

    <div class="summary-grid">
      <div class="summary-item summary-item--primary">
        <span class="summary-icon"><NIcon :component="Wallet24Regular" /></span>
        <div>
          <small>积分总计</small>
          <strong>{{ totalPoints.toLocaleString() }}</strong>
        </div>
      </div>
      <div class="summary-item">
        <span class="summary-icon"><NIcon :component="Gift24Regular" /></span>
        <div>
          <small>已加入频道</small>
          <strong>{{ points.length }}</strong>
        </div>
      </div>
    </div>

    <section class="balance-panel">
      <div class="balance-panel__heading">
        <div>
          <h2>频道积分</h2>
          <p>进入频道兑换当前可用的积分礼物。</p>
        </div>
      </div>

      <NSpin :show="isLoading">
        <NEmpty
          v-if="!isLoading && points.length === 0"
          size="large"
        >
          <template #extra>参与主播互动后，积分会显示在这里。</template>
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
              :size="42"
            >
              {{ item.owner.name.slice(0, 1) }}
            </NAvatar>
            <div class="balance-owner">
              <strong>{{ item.owner.name }}</strong>
              <span>频道积分</span>
            </div>
            <strong class="balance-value">{{ item.points.toLocaleString() }}</strong>
            <NButton
              secondary
              size="small"
              @click="router.push({ name: 'user-goods', params: { id: item.owner.name } })"
            >
              查看兑换
              <template #icon><NIcon :component="ArrowRight24Regular" /></template>
            </NButton>
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
  gap: 18px;
}

.page-heading {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 24px;
  padding: 4px 2px;
}

.page-heading span {
  color: var(--vtsuru-primary);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0;
}

.page-heading h1,
.balance-panel h2,
.page-heading p,
.balance-panel p {
  margin: 0;
}

.page-heading h1 {
  margin-top: 4px;
  font-size: 30px;
  line-height: 1.25;
}

.page-heading p,
.balance-panel p {
  margin-top: 5px;
  color: var(--vtsuru-fg-muted);
  font-size: 13px;
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
  min-height: 92px;
  padding: 16px;
  border: 1px solid var(--vtsuru-border);
  border-radius: var(--vtsuru-radius);
  background: var(--vtsuru-bg-surface);
  box-shadow: var(--vtsuru-shadow-1);
}

.summary-item--primary {
  border-color: color-mix(in srgb, var(--vtsuru-primary) 28%, var(--vtsuru-border));
  background: color-mix(in srgb, var(--vtsuru-brand-tint) 55%, var(--vtsuru-bg-surface));
}

.summary-icon {
  display: grid;
  width: 42px;
  height: 42px;
  flex: 0 0 auto;
  place-items: center;
  border-radius: var(--vtsuru-radius-control);
  color: var(--vtsuru-primary);
  background: var(--vtsuru-brand-soft);
  font-size: 22px;
}

.summary-item div {
  display: flex;
  min-width: 0;
  flex-direction: column;
}

.summary-item small {
  color: var(--vtsuru-fg-muted);
}

.summary-item strong {
  margin-top: 2px;
  font-size: 24px;
  line-height: 1.2;
}

.balance-panel {
  overflow: hidden;
  border: 1px solid var(--vtsuru-border);
  border-radius: var(--vtsuru-radius);
  background: var(--vtsuru-bg-surface);
  box-shadow: var(--vtsuru-shadow-1);
}

.balance-panel__heading {
  padding: 16px 18px;
  border-bottom: 1px solid var(--vtsuru-border);
}

.balance-panel h2 {
  font-size: 16px;
}

.balance-panel :deep(.n-spin-container) {
  min-height: 180px;
}

.balance-panel :deep(.n-empty) {
  padding: 38px 16px;
}

.balance-list {
  display: flex;
  flex-direction: column;
}

.balance-row {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) minmax(80px, auto) auto;
  align-items: center;
  gap: 14px;
  padding: 13px 18px;
  border-bottom: 1px solid var(--vtsuru-border);
}

.balance-row:last-child {
  border-bottom: 0;
}

.balance-owner {
  display: flex;
  min-width: 0;
  flex-direction: column;
}

.balance-owner strong,
.balance-owner span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.balance-owner span {
  color: var(--vtsuru-fg-muted);
  font-size: 12px;
}

.balance-value {
  color: var(--vtsuru-primary);
  font-size: 18px;
  text-align: right;
}

@media (max-width: 600px) {
  .page-heading h1 {
    font-size: 24px;
  }

  .page-heading {
    align-items: center;
  }

  .page-heading p {
    display: none;
  }

  .summary-item {
    min-height: 78px;
    padding: 12px;
  }

  .summary-icon {
    width: 36px;
    height: 36px;
    font-size: 19px;
  }

  .summary-item strong {
    font-size: 20px;
  }

  .balance-row {
    grid-template-columns: auto minmax(0, 1fr) auto;
    gap: 10px;
    padding: 12px;
  }

  .balance-value {
    font-size: 16px;
  }

  .balance-row .n-button {
    grid-column: 2 / -1;
    justify-self: stretch;
  }
}
</style>
