<script setup lang="ts">
import { NButton, NCard, NDrawer, NDrawerContent, NEmpty, NForm, NFormItem, NGrid, NGridItem, NHeatmap, NIcon, NImage, NInput, NList, NListItem, NSelect, NSpin, NStatistic, NTag, NTime, NFlex } from 'naive-ui'
import { ChatbubblesOutline, PeopleOutline, TimeOutline, WalletOutline } from '@vicons/ionicons5'
import { watch } from 'vue'
import { useOrgContext } from '../composables/useOrgContext'
import type { useStreamerDetail } from '../composables/useOrgStreamers'
import { DEFAULT_COVER, formatDate, streamerStatusLabel, streamerStatusTagType } from '../utils'
import OrgUserAvatar from './OrgUserAvatar.vue'

const props = defineProps<{ detail: ReturnType<typeof useStreamerDetail> }>()
const emit = defineEmits<{ (e: 'saved'): void }>()

const { isOrgAdmin } = useOrgContext()
const d = props.detail

watch([() => d.show.value, () => d.selectedId.value], ([show, id]) => {
  if (show && id) d.load(true)
})
</script>

<template>
  <NDrawer v-model:show="d.show.value" placement="right" :width="520" :style="{ maxWidth: '92vw' }">
    <NDrawerContent>
      <template #header>
        <NFlex align="center" :wrap="false">
          <OrgUserAvatar :face-url="d.detail.value?.streamer.faceUrl" :size="40" />
          <NFlex vertical :size="0" style="min-width: 0;">
            <div style="font-weight: 600; line-height: 1.2;">
              {{ d.detail.value?.streamer.name || (d.selectedId.value ? `ID: ${d.selectedId.value}` : '主播详情') }}
            </div>
            <div style="font-size: 12px; opacity: .7;">
              ID: {{ d.detail.value?.streamer.id || d.selectedId.value || '-' }}
            </div>
          </NFlex>
          <NTag v-if="d.detail.value" :bordered="false" size="small" :type="streamerStatusTagType(d.detail.value.status)" style="margin-left: auto;">
            {{ streamerStatusLabel(d.detail.value.status) }}
          </NTag>
        </NFlex>
      </template>

      <NSpin :show="d.loading.value">
        <NEmpty v-if="!d.detail.value" description="暂无数据" />
        <template v-else>
          <NGrid :x-gap="12" :y-gap="12" :cols="2">
            <NGridItem>
              <NCard size="small" :bordered="false" class="stat-card">
                <NStatistic label="总收入" :value="d.detail.value.summary.totalIncomeWithGuard" :precision="2">
                  <template #prefix>
                    ¥
                  </template>
                </NStatistic>
              </NCard>
            </NGridItem>
            <NGridItem>
              <NCard size="small" :bordered="false" class="stat-card">
                <NStatistic label="直播时长" :value="d.detail.value.summary.totalLiveMinutes">
                  <template #suffix>
                    min
                  </template>
                </NStatistic>
              </NCard>
            </NGridItem>
            <NGridItem>
              <NCard size="small" :bordered="false" class="stat-card">
                <NStatistic label="互动" :value="d.detail.value.summary.totalInteractionCount" />
              </NCard>
            </NGridItem>
            <NGridItem>
              <NCard size="small" :bordered="false" class="stat-card">
                <NStatistic label="弹幕" :value="d.detail.value.summary.totalDanmakuCount" />
              </NCard>
            </NGridItem>
          </NGrid>

          <NCard title="直播时间热力图" size="small" :bordered="false" style="margin-top: 12px;">
            <NHeatmap :data="d.detail.value.heatmap" size="small" :tooltip="true">
              <template #tooltip="p">
                <div style="font-size: 12px;">
                  {{ formatDate(p.timestamp) }}
                  <template v-if="p.value != null">
                    : {{ p.value }} min
                  </template>
                </div>
              </template>
            </NHeatmap>
          </NCard>

          <NCard v-if="isOrgAdmin" title="主播设置" size="small" :bordered="false" style="margin-top: 12px;">
            <NForm label-placement="left" label-width="auto" size="small">
              <NFormItem label="状态">
                <NSelect
                  v-model:value="d.editStatus.value"
                  style="width: 180px"
                  :options="[{ label: 'Active', value: 1 }, { label: 'Removed', value: 3 }]"
                />
              </NFormItem>
              <NFormItem label="备注">
                <NInput v-model:value="d.editNote.value" type="textarea" :autosize="{ minRows: 2, maxRows: 4 }" placeholder="仅组织管理员可见" />
              </NFormItem>
              <NFormItem>
                <NButton type="primary" :loading="d.saving.value" @click="d.save(() => emit('saved'))">
                  保存
                </NButton>
              </NFormItem>
            </NForm>
          </NCard>

          <NCard title="直播记录" size="small" :bordered="false" style="margin-top: 12px;">
            <NEmpty v-if="d.lives.value.length === 0" description="暂无直播记录" />
            <NList v-else>
              <NListItem v-for="live in d.lives.value" :key="live.liveId">
                <NFlex :wrap="false" style="gap: 10px; width: 100%;">
                  <NImage
                    width="96"
                    height="54"
                    object-fit="cover"
                    :src="live.coverUrl"
                    :img-props="{ referrerpolicy: 'no-referrer' }"
                    :fallback-src="DEFAULT_COVER"
                    style="border-radius: var(--n-border-radius); overflow: hidden; flex: 0 0 auto;"
                  />
                  <NFlex vertical :size="2" style="min-width: 0; flex: 1;">
                    <div style="font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                      {{ live.title }}
                    </div>
                    <div style="font-size: 12px; opacity: .7;">
                      <NIcon :component="TimeOutline" style="vertical-align: -2px;" />
                      <NTime :time="live.startAt" format="yyyy-MM-dd HH:mm" />
                      <template v-if="live.stopAt">
                        - <NTime :time="live.stopAt" format="HH:mm" />
                      </template>
                    </div>
                    <NFlex style="margin-top: 4px; font-size: 12px; opacity: .85;" wrap>
                      <span title="营收">
                        <NIcon :component="WalletOutline" style="vertical-align: -2px;" /> {{ live.totalIncomeWithGuard.toFixed(0) }}
                      </span>
                      <span title="互动">
                        <NIcon :component="PeopleOutline" style="vertical-align: -2px;" /> {{ live.interactionCount }}
                      </span>
                      <span title="弹幕">
                        <NIcon :component="ChatbubblesOutline" style="vertical-align: -2px;" /> {{ live.danmakusCount }}
                      </span>
                    </NFlex>
                  </NFlex>
                </NFlex>
              </NListItem>
            </NList>
            <NFlex v-if="d.hasMore.value" justify="center" style="margin-top: 8px;">
              <NButton secondary :loading="d.loading.value" @click="d.loadMore">
                加载更多
              </NButton>
            </NFlex>
          </NCard>
        </template>
      </NSpin>
    </NDrawerContent>
  </NDrawer>
</template>

<style scoped>
.stat-card {
  border: 1px solid var(--n-border-color);
}
.stat-card:hover {
  border-color: var(--n-primary-color);
}
</style>
