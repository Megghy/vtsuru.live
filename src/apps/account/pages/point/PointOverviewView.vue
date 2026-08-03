<script setup lang="ts">
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
const toast = useToast()
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
    toast.add({
      title: `获取积分失败：${error instanceof Error ? error.message : String(error)}`,
      color: 'error',
    })
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
      <UButton
        color="neutral"
        variant="soft"
        icon="i-lucide-refresh-cw"
        :loading="isLoading"
        @click="loadPoints"
      >
        刷新
      </UButton>
    </div>

    <div class="summary-grid">
      <div class="summary-item summary-item--primary">
        <UIcon
          class="summary-icon"
          name="i-lucide-wallet"
        />
        <div>
          <small>积分总计</small>
          <strong>{{ totalPoints.toLocaleString() }}</strong>
        </div>
      </div>
      <div class="summary-item">
        <UIcon
          class="summary-icon"
          name="i-lucide-gift"
        />
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

      <UEmpty
        v-if="!isLoading && points.length === 0"
        class="balance-empty"
        icon="i-lucide-wallet-cards"
        title="还没有积分记录"
        description="参与主播互动后，积分会显示在这里。"
      />

      <div
        v-else
        class="balance-list"
        :aria-busy="isLoading"
      >
        <article
          v-for="item in points"
          :key="item.owner.id"
          class="balance-row"
        >
          <UAvatar
            :src="item.owner.faceUrl"
            :alt="item.owner.name"
            :text="item.owner.name.slice(0, 1)"
            size="lg"
          />
          <div class="balance-owner">
            <strong>{{ item.owner.name }}</strong>
            <span>频道积分</span>
          </div>
          <strong class="balance-value">{{ item.points.toLocaleString() }}</strong>
          <UButton
            color="neutral"
            variant="soft"
            size="sm"
            trailing-icon="i-lucide-arrow-right"
            @click="router.push({ name: 'user-goods', params: { id: item.owner.name } })"
          >
            查看兑换
          </UButton>
        </article>
      </div>
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
  width: 42px;
  height: 42px;
  flex: 0 0 auto;
  padding: 10px;
  border-radius: var(--vtsuru-radius-control);
  color: var(--vtsuru-primary);
  background: var(--vtsuru-brand-soft);
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

.balance-empty {
  min-height: 180px;
  padding: 38px 16px;
}

.balance-list {
  display: flex;
  min-height: 180px;
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
    padding: 8px;
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

  .balance-row :deep(.u-button) {
    grid-column: 2 / -1;
    justify-self: stretch;
  }
}
</style>
