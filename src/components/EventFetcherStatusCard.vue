<script setup lang="ts">
import { useAccount } from '@/api/account'
import { EventFetcherType } from '@/api/api-models'
import { FlashCheckmark16Filled, Info24Filled } from '@vicons/fluent'
import { NAlert, NButton, NDivider, NIcon, NTag, NText, NTooltip } from 'naive-ui'
import { computed } from 'vue'

const accountInfo = useAccount()
const state = accountInfo.value?.eventFetcherState

const status = computed(() => {
  if (state.online == true) {
    if (state.status == undefined || state.status == null) {
      return 'warning'
    } else if (Object.keys(state.status ?? {}).length > 0) {
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
  <NAlert :type="status" v-if="status">
    <template #header>
      EVENT-FETCHER 状态
      <NTooltip>
        <template #trigger>
          <NIcon :component="Info24Filled" />
        </template>
        这是一个可以持续监听直播间内的 Superchat 和上舰事件并上传到本站进行记录的 .Net 程序
        <br />
        事件上传到本站后允许按照自定义范围进行查询, 并导出为 CSV 之类的表格
        <br />
        <NButton
          type="info"
          size="small"
          tag="a"
          href="https://www.yuque.com/megghy/dez70g/vfvcyv3024xvaa1p"
          target="_blank"
        >
          关于 EVENT-FETCHER
        </NButton>
      </NTooltip>
    </template>
    <template v-if="status != 'info' && !accountInfo?.isServerFetcherOnline">
      <NTooltip>
        <template #trigger>
          <NTag size="small" :color="{ borderColor: 'white', textColor: 'white', color: '#4b6159' }">
            <NIcon :component="FlashCheckmark16Filled" />
            {{ state.type == EventFetcherType.OBS ? 'OBS/网页端' : state.version ?? '未知' }}
          </NTag>
        </template>
        你所使用的版本
      </NTooltip>
      <NDivider vertical />
    </template>
    <NTag :type="status">
      <template v-if="state?.online == true && (state?.status == null || state?.status == undefined)">
        此版本已过期, 请更新
        <NTooltip trigger="click">
          <template #trigger>
            <NButton type="warning" size="tiny"> 关于 </NButton>
          </template>
          Node.js 版已不再更新, 如果是 Docker 的话请切换至 ghcr.io/megghy/vtsurueventfetcher.net, 其他环境请下载
          https://github.com/Megghy/VtsuruEventFetcher.Net/releases/latest
        </NTooltip>
      </template>
      <template v-else>
        <template v-if="status == 'success'">
          <NText>
            {{ accountInfo?.isServerFetcherOnline ? '正在由本站提供监听服务' : '运行中' }}
          </NText>
          | 今日已接收
          <NText color="white" strong>
            {{ state.todayReceive }}
          </NText>
          条
        </template>
        <template v-else-if="status == 'warning'">
          <template v-if="state.status"> 异常: {{ Object.values(state.status).join('; ') }} </template>
        </template>
        <template v-else-if="status == 'info'"> 未连接 </template>
      </template>
    </NTag>
    <template v-if="!state.online">
      <NDivider vertical />
      <NButton
        type="info"
        size="tiny"
        tag="a"
        href="https://www.yuque.com/megghy/dez70g/vfvcyv3024xvaa1p"
        target="_blank"
      >
        关于 EVENT-FETCHER
      </NButton>
    </template>
  </NAlert>
</template>
