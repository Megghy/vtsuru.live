<script setup lang="ts">
import { NAvatar, NButton, NCard, NEmpty, NGrid, NGridItem, NIcon, NImage, NInput, NSelect, NSkeleton, NFlex, NTag, NTime, NTooltip } from 'naive-ui'
import { ChatbubblesOutline, DownloadOutline, PeopleOutline, SearchOutline, TimeOutline, WalletOutline } from '@vicons/ionicons5'
import { computed, onMounted } from 'vue'
import { injectOrgLives } from '../../composables/useOrgLives'
import { injectOrgStreamers } from '../../composables/useOrgStreamers'
import { exportCsv, withImageSize } from '../../utils'

const { loading, view, streamerFilter, sortKey, search, load } = injectOrgLives()
const { options: streamerOptions } = injectOrgStreamers()

const sortOptions = [
  { label: '按时间', value: 'startAt' },
  { label: '按营收', value: 'income' },
  { label: '按互动', value: 'interaction' },
  { label: '按弹幕', value: 'danmaku' },
]

const streamerSelectOptions = computed(() => [{ label: '全部主播', value: 0 }, ...streamerOptions.value])

function exportLives() {
  exportCsv(
    `直播记录_${Date.now()}.csv`,
    ['主播', '标题', '分区', '开始时间', '营收', '互动', '弹幕', '点赞'],
    view.value.map(({ streamer, live }) => [
      streamer.name, live.title, `${live.parentArea}/${live.area}`,
      new Date(live.startAt).toLocaleString(),
      live.totalIncomeWithGuard.toFixed(2), live.interactionCount, live.danmakusCount, live.likeCount,
    ]),
  )
}

onMounted(() => load())
</script>

<template>
  <NFlex align="center" wrap style="margin-bottom: 12px;">
    <NInput v-model:value="search" placeholder="搜索标题/主播" size="small" style="width: 200px;">
      <template #prefix>
        <NIcon :component="SearchOutline" />
      </template>
    </NInput>
    <NSelect
      v-model:value="streamerFilter"
      :options="streamerSelectOptions"
      size="small"
      style="width: 160px;"
      :consistent-menu-width="false"
    />
    <NSelect v-model:value="sortKey" :options="sortOptions" size="small" style="width: 120px;" />
    <NButton size="small" secondary :disabled="view.length === 0" @click="exportLives">
      <template #icon>
        <NIcon :component="DownloadOutline" />
      </template>
      导出 CSV
    </NButton>
    <span style="opacity: .6; font-size: 12px;">共 {{ view.length }} 场</span>
  </NFlex>

  <NSkeleton v-if="loading" text :repeat="6" />
  <NEmpty v-else-if="view.length === 0" description="暂无直播记录" />
  <NGrid v-else :x-gap="12" :y-gap="12" cols="1 600:2 1100:3" item-responsive>
    <NGridItem v-for="item in view" :key="item.live.liveId">
      <NCard hoverable size="small" class="live-card">
        <template #cover>
          <div class="live-cover">
            <NImage
              v-if="item.live.coverUrl"
              :src="withImageSize(item.live.coverUrl, '@140h')"
              object-fit="cover"
              :img-props="{ referrerpolicy: 'no-referrer' }"
              style="width: 100%; height: 100%;"
              preview-disabled
            />
            <div v-else class="live-cover-empty">
              <NIcon size="48" :component="TimeOutline" />
            </div>
            <div class="live-badge">
              <NTag v-if="!item.live.isFinish" type="success" size="small">
                LIVE
              </NTag>
              <NTag v-else :color="{ color: '#00000080' }" text-color="#fff" :bordered="false" size="small">
                已结束
              </NTag>
            </div>
            <div class="live-streamer">
              <NAvatar
                v-if="item.streamer.faceUrl"
                round
                :size="20"
                :src="withImageSize(item.streamer.faceUrl, '@20w')"
                :img-props="{ referrerpolicy: 'no-referrer' }"
                style="margin-right: 6px; border: 1px solid rgba(255,255,255,0.5);"
              />
              {{ item.streamer.name }}
            </div>
          </div>
        </template>

        <NTooltip trigger="hover">
          <template #trigger>
            <div class="live-card-title text-ellipsis-2">
              {{ item.live.title }}
            </div>
          </template>
          {{ item.live.title }}
        </NTooltip>

        <div class="live-card-meta">
          <div>{{ item.live.parentArea }} / {{ item.live.area }}</div>
          <div>
            <NTime :time="item.live.startAt" format="MM-dd HH:mm" />
            <template v-if="item.live.stopAt">
              - <NTime :time="item.live.stopAt" format="HH:mm" />
            </template>
            <template v-else>
              - Now
            </template>
          </div>
        </div>

        <template #footer>
          <NFlex justify="space-between" size="small" style="font-size: 12px; opacity: 0.9;">
            <span title="营收">
              <NIcon :component="WalletOutline" style="vertical-align: -2px;" /> {{ item.live.totalIncomeWithGuard.toFixed(0) }}
            </span>
            <span title="互动">
              <NIcon :component="PeopleOutline" style="vertical-align: -2px;" /> {{ item.live.interactionCount }}
            </span>
            <span title="弹幕">
              <NIcon :component="ChatbubblesOutline" style="vertical-align: -2px;" /> {{ item.live.danmakusCount }}
            </span>
          </NFlex>
        </template>
      </NCard>
    </NGridItem>
  </NGrid>
</template>

<style scoped>
.live-card {
  height: 100%;
  border: 1px solid var(--n-border-color);
}
.live-card:hover {
  border-color: var(--n-primary-color);
}
.live-cover {
  height: 140px;
  overflow: hidden;
  position: relative;
  background: var(--n-color-embedded);
}
.live-cover-empty {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--n-text-color-3);
}
.live-badge {
  position: absolute;
  top: 8px;
  right: 8px;
}
.live-streamer {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 4px 8px;
  background: linear-gradient(to top, rgba(0, 0, 0, 0.7), transparent);
  color: #fff;
  font-size: 12px;
  display: flex;
  align-items: center;
}
.live-card-title {
  font-weight: 600;
  margin-bottom: 6px;
  height: 44px;
  line-height: 22px;
}
.text-ellipsis-2 {
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
}
.live-card-meta {
  font-size: 12px;
  opacity: 0.75;
  margin-bottom: 8px;
}
</style>
