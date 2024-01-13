<script setup lang="ts">
import { useAccount } from '@/api/account'
import { Info24Filled } from '@vicons/fluent'
import { NAlert, NButton, NDivider, NIcon, NTag, NTooltip } from 'naive-ui'
import { computed } from 'vue'

const accountInfo = useAccount()

const status = computed(() => {
  if (!accountInfo.value) return 'error'
  if (accountInfo.value.eventFetcherOnline == true) {
    if (accountInfo.value.eventFetcherStatus) {
      if (accountInfo.value.eventFetcherStatus == 'ok') return 'success'
      else return 'warning'
    } else if (Object.keys(accountInfo.value.eventFetcherStatusV3 ?? {}).length > 0) {
      return 'warning'
    } else {
      return 'success'
    }
  } else {
    return 'info'
  }
})
</script>

<template>
  <NAlert :type="status">
    <template #header>
      EVENT-FETCHER 状态
      <NTooltip>
        <template #trigger>
          <NIcon :component="Info24Filled" />
        </template>
        这是一个可以持续监听直播间内的 Superchat 和上舰事件并上传到本站进行记录的 Nodejs/.Net 程序
        <br />
        事件上传到本站后允许按照自定义范围进行查询, 并导出为 CSV 之类的表格
      </NTooltip>
    </template>
    <NTag :type="status">
      <template v-if="status == 'success'"> 运行中 </template>
      <template v-else-if="status == 'warning'">
        <template v-if="accountInfo?.eventFetcherStatus"> 异常: {{ accountInfo.eventFetcherStatus }} </template>
      </template>
      <template v-else-if="status == 'info'"> 未连接 </template>
    </NTag>
    <template v-if="accountInfo?.eventFetcherOnline != true">
      <NDivider vertical />
      <NButton type="info" size="small" tag="a" href="https://www.yuque.com/megghy/dez70g/vfvcyv3024xvaa1p" target="_blank"> 关于 EVENT-FETCHER </NButton>
    </template>
  </NAlert>
</template>
