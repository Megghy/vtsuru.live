<script setup lang="ts">
import { EventDataTypes, ResponseLiveInfoModel } from '@/api/api-models'
import { Info24Filled } from '@vicons/fluent'
import { List } from 'linqts'
import { NPopover, NSpace, NStatistic, NTime, NDivider, NNumberAnimation, NTag, NButton, NTooltip, NIcon } from 'naive-ui'
import { ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()

const { live } = defineProps<{
  live: ResponseLiveInfoModel
}>()

let defaultDanmakusCount = ref(0)
function OnClickCover() {
  router.push({
    name: 'manage-liveDetail',
    params: { id: live.liveId },
  })
}

watch(
  () => live,
  (newValue) => {
    defaultDanmakusCount.value = newValue.danmakusCount
  }
)
</script>

<template>
  <div style="display: flex; flex-wrap: wrap">
    <NSpace style="flex-flow: nowrap">
      <span style="display: flex; align-items: center; height: 100%">
        <img
          referrerpolicy="no-referrer"
          :style="!live.isFinish ? 'animation: animated-border 2.5s infinite;cursor: pointer' : 'cursor: pointer'"
          class="liveCover"
          :src="live.coverUrl + '@200w'"
          lazy
          preview-disabled
          @click="OnClickCover()"
        />
      </span>
      <NSpace vertical justify="center" style="gap: 2px">
        <NButton text @click="OnClickCover()">
          <span style="font-size: 18px; white-space: break-spaces">
            {{ live.title }}
          </span>
        </NButton>
        <span>
          <span v-if="!live.isFinish">
            <NTag size="tiny" :bordered="false" type="success" style="justify-items: center; box-shadow: 0 0 3px #589580"> 直播中 </NTag>
          </span>
          <span v-else style="color: gray">
            {{ (((live.stopAt ?? 0) - (live.startAt ?? 0)) / (3600 * 1000)).toFixed(1) }}
            时
          </span>
          <NDivider vertical />
          <NPopover trigger="hover">
            <template #trigger>
              <div style="color: grey; font-size: small; display: inline">
                <NTime style="font-size: small" :time="live.startAt" />
              </div>
            </template>
            <span v-if="live.isFinish">
              结束于:
              <NTime :time="live.stopAt ?? 0" />
            </span>
            <span v-else>
              已直播:
              {{ ((Date.now() - (live.stopAt ?? 0)) / (3600 * 1000)).toFixed(1) }}
              时
            </span>
          </NPopover>
        </span>
      </NSpace>
    </NSpace>
    <div class="liveListItem">
      <NStatistic label="分区">
        <NTooltip>
          <template #trigger>
            <span style="font-size: 16px; font-weight: 500">
              {{ live.area }}
            </span>
          </template>
          {{ live.parentArea }}
        </NTooltip>
      </NStatistic>
      <NStatistic label="弹幕">
        <span style="font-size: 18px; font-weight: 500">
          <NNumberAnimation :from="defaultDanmakusCount" :to="live.danmakusCount" show-separator />
        </span>
      </NStatistic>
      <NStatistic label="互动" tabular-nums>
        <span style="font-size: 18px; font-weight: 500">
          <NNumberAnimation :from="0" :to="live.interactionCount" show-separator />
        </span>
      </NStatistic>
      <transition>
        <NStatistic tabular-nums>
          <template #label>
            收益
            <NTooltip>
              <template #trigger>
                <NIcon :component="Info24Filled" />
              </template>
              因为官方并没有提供上舰的价格, 所以记录中的舰长价格一律按照打折价格计算
              <br />
              即舰长 138, 提督 1598, 总督 15998
              <br />
              把鼠标放在下面的价格上就可以查看排除舰长后的收益
            </NTooltip>
          </template>
          <NTooltip>
            <template #trigger>
              <span style="font-size: 18px; font-weight: 500; color: #a35353">
                <NNumberAnimation :from="0" :to="live.totalIncomeWithGuard" show-separator />
              </span>
            </template>
            <NNumberAnimation :from="0" :to="live.totalIncome" show-separator />
          </NTooltip>
        </NStatistic>
      </transition>
    </div>
  </div>
</template>

<style scoped>
.n-statistic {
  text-align: right;
  min-width: 62px;
}

@media (max-width: 750px) {
  .liveCover {
    width: 90px;
    height: fit-content;
    border-radius: 4px;
  }

  .liveList {
    display: flex;
    flex-flow: row wrap;
    gap: 8px 10px;
  }

  .liveListItem {
    padding-top: 10px;
    display: flex;
    width: 100%;
    justify-content: space-between;
  }

  .dateEChartStyle {
    height: 500px;
  }
}

@media (min-width: 750px) {
  .liveCover {
    border-radius: 4px;
    width: 120px;
  }

  .liveList {
    display: flex;
  }

  .liveListItem {
    display: flex;
    gap: 1rem;
    flex-grow: 1;
    justify-content: end;
  }

  .dateEChartStyle {
    height: 150px;
  }
}

@keyframes animated-border {
  0% {
    box-shadow: 0 0 0px #589580;
  }

  100% {
    box-shadow: 0 0 0 4px rgba(255, 255, 255, 0);
  }
}

.v-enter-active,
.v-leave-active {
  transition: opacity 0.3s ease;
}

.v-enter-from,
.v-leave-to {
  opacity: 0;
}
</style>
