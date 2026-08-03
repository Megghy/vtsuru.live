<script setup lang="ts">
import { DelBiliBlackList, DelBlackList, useAccount } from '@/api/account'
import { showErrorToast, showSuccessToast } from '@/shared/services/toast'

const account = useAccount()

async function unblockBiliUser(id: number) {
  try {
    const response = await DelBiliBlackList(id)
    if (response.code !== 200) throw new Error(response.message)
    delete account.value.biliBlackList[id]
    showSuccessToast(`[${id}] 已移除黑名单`)
  } catch (error) {
    showErrorToast(error instanceof Error ? error.message : String(error))
  }
}

async function unblockUser(id: number) {
  try {
    const response = await DelBlackList(id)
    if (response.code !== 200) throw new Error(response.message)
    account.value.blackList = account.value.blackList.filter((user) => user.id !== id)
    showSuccessToast(`[${id}] 已移除黑名单`)
  } catch (error) {
    showErrorToast(error instanceof Error ? error.message : String(error))
  }
}
</script>

<template>
  <div class="blacklist-grid">
    <UCard title="B 站黑名单">
      <div
        v-if="Object.keys(account.biliBlackList ?? {}).length"
        class="blacklist-items"
      >
        <div
          v-for="[id, name] in Object.entries(account.biliBlackList)"
          :key="id"
          class="blacklist-row"
        >
          <span
            ><strong>{{ name }}</strong
            ><code>{{ id }}</code></span
          >
          <UButton
            color="error"
            variant="soft"
            @click="unblockBiliUser(Number(id))"
            >移除</UButton
          >
        </div>
      </div>
      <UEmpty
        v-else
        icon="i-lucide-user-x"
        title="暂无 B 站黑名单"
      />
    </UCard>
    <UCard title="站内黑名单">
      <div
        v-if="account.blackList?.length"
        class="blacklist-items"
      >
        <div
          v-for="user in account.blackList"
          :key="user.id"
          class="blacklist-row"
        >
          <span
            ><strong>{{ user.name }}</strong
            ><code>{{ user.id }}</code></span
          >
          <UButton
            color="error"
            variant="soft"
            @click="unblockUser(user.id)"
            >移除</UButton
          >
        </div>
      </div>
      <UEmpty
        v-else
        icon="i-lucide-user-x"
        title="暂无站内黑名单"
      />
    </UCard>
  </div>
</template>

<style scoped>
.blacklist-grid,
.blacklist-items {
  display: grid;
  gap: 12px;
}
.blacklist-row,
.blacklist-row span {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}
.blacklist-row {
  padding-block: 8px;
  border-bottom: 1px solid var(--vtsuru-border-muted);
}
.blacklist-row code {
  color: var(--vtsuru-fg-muted);
}
</style>
