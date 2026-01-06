<script setup lang="ts">
import {
  NAvatar,
  NCard,
  NEmpty,
  NGrid,
  NGridItem,
  NIcon,
  NImage,
  NSkeleton,
  NSpace,
  NTag,
  NTime,
  NTooltip,
} from 'naive-ui'
import { ChatbubblesOutline, PeopleOutline, TimeOutline, WalletOutline } from '@vicons/ionicons5'

const props = defineProps<{
  loading: boolean
  lives: any[]
}>()
</script>

<template>
  <template v-if="props.loading">
    <NSkeleton text :repeat="6" />
  </template>

  <template v-else-if="props.lives.length === 0">
    <NEmpty description="暂无直播记录" />
  </template>

  <template v-else>
    <NGrid :x-gap="12" :y-gap="12" cols="1 600:2 1100:3" item-responsive>
      <NGridItem v-for="item in props.lives" :key="item.live.liveId">
        <NCard hoverable size="small" class="live-card">
          <template #cover>
            <div style="height: 140px; overflow: hidden; position: relative; background: #f5f5f5;">
              <NImage
                v-if="item.live.coverUrl"
                :src="item.live.coverUrl.includes('@') ? item.live.coverUrl : `${item.live.coverUrl}@140h`"
                object-fit="cover"
                :img-props="{ referrerpolicy: 'no-referrer' }"
                style="width: 100%; height: 100%;"
                preview-disabled
              />
              <div v-else style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; color: #ccc;">
                <NIcon size="48" :component="TimeOutline" />
              </div>
              <div style="position: absolute; top: 8px; right: 8px;">
                <NTag v-if="!item.live.isFinish" type="success" size="small">
                  LIVE
                </NTag>
                <NTag v-else type="default" :color="{ color: '#00000080' }" text-color="#fff" :bordered="false" size="small">
                  已结束
                </NTag>
              </div>
              <div style="position: absolute; bottom: 0; left: 0; right: 0; padding: 4px 8px; background: linear-gradient(to top, rgba(0,0,0,0.7), transparent); color: #fff; font-size: 12px; display: flex; align-items: center;">
                <NAvatar
                  v-if="item.streamer.faceUrl"
                  round
                  :size="20"
                  :src="item.streamer.faceUrl.includes('@') ? item.streamer.faceUrl : `${item.streamer.faceUrl}@20w`"
                  :img-props="{ referrerpolicy: 'no-referrer' }"
                  style="margin-right: 6px; border: 1px solid rgba(255,255,255,0.5);"
                />
                {{ item.streamer.name }}
              </div>
            </div>
          </template>

          <div class="live-card-title text-ellipsis-2">
            <NTooltip trigger="hover">
              <template #trigger>
                <span>{{ item.live.title }}</span>
              </template>
              {{ item.live.title }}
            </NTooltip>
          </div>

          <div class="live-card-meta">
            <div class="meta-row">
              <span class="area">{{ item.live.parentArea }} / {{ item.live.area }}</span>
            </div>
            <div class="meta-row time">
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
            <NSpace justify="space-between" size="small" style="font-size: 12px; opacity: 0.9;">
              <span title="营收">
                <NIcon :component="WalletOutline" style="vertical-align: -2px;" />
                {{ item.live.totalIncomeWithGuard.toFixed(0) }}
              </span>
              <span title="互动">
                <NIcon :component="PeopleOutline" style="vertical-align: -2px;" />
                {{ item.live.interactionCount }}
              </span>
              <span title="弹幕">
                <NIcon :component="ChatbubblesOutline" style="vertical-align: -2px;" />
                {{ item.live.danmakusCount }}
              </span>
            </NSpace>
          </template>
        </NCard>
      </NGridItem>
    </NGrid>
  </template>
</template>
