<script setup lang="ts">
import { useAccount } from '@/api/account'
import { isDev } from '@/shared/config'

const account = useAccount()
</script>

<template>
  <UCard
    title="增值"
    description="管理账户增值服务与积分。"
  >
    <UAlert
      v-if="!isDev"
      color="info"
      icon="i-lucide-construction"
      title="增值服务面板正在开发中"
    />
    <div
      v-else
      class="payment-overview"
    >
      <span>当前积分</span>
      <strong>{{ account.point }}</strong>
      <USeparator />
      <UEmpty
        icon="i-lucide-hard-drive"
        title="弹幕存储服务即将提供"
      />
    </div>
  </UCard>
</template>

<style scoped>
.payment-overview {
  display: grid;
  gap: 12px;
}

.payment-overview span {
  color: var(--vtsuru-fg-muted);
}

.payment-overview strong {
  font-size: 24px;
}
</style>
