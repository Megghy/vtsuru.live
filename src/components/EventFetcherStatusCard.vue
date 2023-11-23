<script setup lang="ts">
import { useAccount } from '@/api/account'
import { Info24Filled } from '@vicons/fluent'
import { NAlert, NButton, NDivider, NIcon, NTag, NTooltip } from 'naive-ui'

const accountInfo = useAccount()
</script>

<template>
  <NAlert :type="accountInfo?.eventFetcherOnline ? (accountInfo?.eventFetcherStatus == 'ok' ? 'success' : 'warning') : 'info'">
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
    <NTag :type="accountInfo?.eventFetcherOnline ? (accountInfo?.eventFetcherStatus == 'ok' ? 'success' : 'warning') : 'error'">
      {{ accountInfo?.eventFetcherOnline ? (accountInfo?.eventFetcherStatus == 'ok' ? '正常' : `异常: ${accountInfo.eventFetcherStatus}`) : '未连接' }}
    </NTag>
    <NDivider vertical />
    <NButton v-if="accountInfo?.eventFetcherOnline != true" type="info" size="small" tag="a" href="https://www.yuque.com/megghy/dez70g/vfvcyv3024xvaa1p" target="_blank"> 关于 EVENT-FETCHER </NButton>
  </NAlert>
</template>
