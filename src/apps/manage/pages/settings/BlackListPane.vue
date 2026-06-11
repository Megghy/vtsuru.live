<script setup lang="ts">
import { NButton, NCard, NEmpty, NFlex, NList, NListItem, NText, useMessage } from 'naive-ui'
import { DelBiliBlackList, DelBlackList, useAccount } from '@/api/account'

const accountInfo = useAccount()
const message = useMessage()

function unblockBiliUser(id: number) {
  DelBiliBlackList(id).then((data) => {
    if (data.code === 200) {
      message.success(`[${id}] 已移除黑名单`)
      if (accountInfo.value) delete accountInfo.value.biliBlackList[id]
    } else {
      message.error(data.message)
    }
  }).catch(err => message.error(err))
}

function unblockUser(id: number) {
  DelBlackList(id).then((data) => {
    if (data.code === 200) {
      message.success(`[${id}] 已移除黑名单`)
      if (accountInfo.value) accountInfo.value.blackList = accountInfo.value.blackList.filter(u => u.id !== id)
    } else {
      message.error(data.message)
    }
  }).catch(err => message.error(err))
}
</script>

<template>
  <NFlex vertical :size="12">
    <NCard title="B 站黑名单" size="small" bordered :segmented="{ content: true }">
      <NList v-if="accountInfo.biliBlackList && Object.keys(accountInfo.biliBlackList).length > 0">
        <NListItem v-for="item in Object.entries(accountInfo.biliBlackList)" :key="item[0]">
          <NFlex align="center" justify="space-between" :wrap="true" :size="12">
            <NFlex align="center" :wrap="true" :size="8">
              <NText>{{ item[1] }}</NText>
              <NText depth="3" code>
                {{ item[0] }}
              </NText>
            </NFlex>
            <NButton type="error" size="small" secondary @click="unblockBiliUser(Number(item[0]))">
              移除
            </NButton>
          </NFlex>
        </NListItem>
      </NList>
      <NEmpty v-else size="small" description="暂无 B 站黑名单" />
    </NCard>

    <NCard title="站内黑名单" size="small" bordered :segmented="{ content: true }">
      <NList v-if="accountInfo.blackList && accountInfo.blackList.length > 0">
        <NListItem v-for="item in accountInfo.blackList" :key="item.id">
          <NFlex align="center" justify="space-between" :wrap="true" :size="12">
            <NFlex align="center" :wrap="true" :size="8">
              <NText>{{ item.name }}</NText>
              <NText depth="3" code>
                {{ item.id }}
              </NText>
            </NFlex>
            <NButton type="error" size="small" secondary @click="unblockUser(Number(item.id))">
              移除
            </NButton>
          </NFlex>
        </NListItem>
      </NList>
      <NEmpty v-else size="small" description="暂无站内黑名单" />
    </NCard>
  </NFlex>
</template>
