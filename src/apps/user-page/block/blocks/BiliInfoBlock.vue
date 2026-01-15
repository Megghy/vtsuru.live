<script setup lang="ts">
import type { UserInfo } from '@/api/api-models'
import { NAvatar, NButton, NFlex, NIcon, NText } from 'naive-ui'
import { computed } from 'vue'
import { HomeOutline, PeopleOutline, PlayCircleOutline, VideocamOutline } from '@vicons/ionicons5'
import BlockCard from '../BlockCard.vue'

interface BlockConfig {
  variant?: 'card' | 'compact'
  showAvatar?: boolean
  showName?: boolean
  showSign?: boolean
  showStats?: boolean
  showButtons?: boolean
  showLiveRoom?: boolean
  spaceUrl?: string
}

const props = defineProps<{
  blockProps: unknown
  userInfo?: UserInfo | undefined
  biliInfo?: any | undefined
}>()

const cfg = computed<BlockConfig>(() => {
  const o = (props.blockProps && typeof props.blockProps === 'object' && !Array.isArray(props.blockProps))
    ? (props.blockProps as any)
    : {}
  const variant = (o.variant === 'compact' || o.variant === 'card') ? o.variant : 'card'
  return {
    variant,
    showAvatar: typeof o.showAvatar === 'boolean' ? o.showAvatar : true,
    showName: typeof o.showName === 'boolean' ? o.showName : true,
    showSign: typeof o.showSign === 'boolean' ? o.showSign : true,
    showStats: typeof o.showStats === 'boolean' ? o.showStats : true,
    showButtons: typeof o.showButtons === 'boolean' ? o.showButtons : true,
    showLiveRoom: typeof o.showLiveRoom === 'boolean' ? o.showLiveRoom : true,
    spaceUrl: typeof o.spaceUrl === 'string' ? o.spaceUrl : '',
  }
})

const model = computed(() => {
  const info = props.biliInfo ?? {}
  const name = typeof info?.name === 'string' ? info.name : (typeof info?.uname === 'string' ? info.uname : '')
  const face = typeof info?.face === 'string' ? info.face : ''
  const sign = typeof info?.sign === 'string' ? info.sign : ''

  const fans = Number.isFinite(Number(info?.fans)) ? Number(info.fans) : null
  const following = Number.isFinite(Number(info?.attention)) ? Number(info.attention)
    : (Number.isFinite(Number(info?.friend)) ? Number(info.friend) : null)
  const videoCount = Number.isFinite(Number(info?.archive_count)) ? Number(info.archive_count)
    : (Number.isFinite(Number(info?.video)) ? Number(info.video) : null)

  const spaceUrl = cfg.value.spaceUrl?.trim().length
    ? cfg.value.spaceUrl.trim()
    : (props.userInfo?.biliId ? `https://space.bilibili.com/${props.userInfo.biliId}` : '')
  const liveRoomUrl = props.userInfo?.biliRoomId ? `https://live.bilibili.com/${props.userInfo.biliRoomId}` : ''

  const biliId = props.userInfo?.biliId ?? null
  return { name, face, sign, fans, following, videoCount, spaceUrl, liveRoomUrl, biliId }
})
</script>

<template>
  <BlockCard :content-style="{ padding: 0 }">
    <div class="bili-card">
      <template v-if="cfg.variant === 'compact'">
        <div class="bili-compact">
          <NFlex align="center" justify="space-between" style="gap: 12px">
            <NFlex align="center" style="gap: 10px; min-width: 0">
              <NAvatar
                v-if="cfg.showAvatar && model.face"
                :src="model.face"
                round
                :size="34"
                :img-props="{ referrerpolicy: 'no-referrer' }"
              />
              <div class="bili-header-text">
                <NText v-if="cfg.showName && model.name" strong class="bili-name">
                  {{ model.name }}
                </NText>
                <NText depth="3" class="bili-sub">
                  Bilibili
                  <template v-if="model.biliId">
                    · @{{ model.biliId }}
                  </template>
                </NText>
              </div>
            </NFlex>

            <NFlex v-if="cfg.showButtons" align="center" style="gap: 8px; flex-shrink: 0">
              <NButton
                v-if="model.spaceUrl"
                size="tiny"
                class="action compact"
                secondary
                tag="a"
                target="_blank"
                rel="noopener noreferrer"
                :href="model.spaceUrl"
              >
                <template #icon>
                  <NIcon><HomeOutline /></NIcon>
                </template>
                主页
              </NButton>
              <NButton
                v-if="cfg.showLiveRoom && model.liveRoomUrl"
                size="tiny"
                class="action compact"
                secondary
                tag="a"
                target="_blank"
                rel="noopener noreferrer"
                :href="model.liveRoomUrl"
              >
                <template #icon>
                  <NIcon><PlayCircleOutline /></NIcon>
                </template>
                直播间
              </NButton>
            </NFlex>
          </NFlex>

          <NText v-if="cfg.showSign && model.sign" depth="3" style="display:block; margin-top: 10px; white-space: pre-wrap">
            {{ model.sign }}
          </NText>

          <div v-if="cfg.showStats" class="bili-stats compact">
            <div class="stat compact">
              <NIcon size="14" class="stat-icon">
                <PeopleOutline />
              </NIcon>
              <div class="stat-meta">
                <div class="stat-k">
                  粉丝
                </div>
                <div class="stat-v">
                  {{ model.fans ?? '--' }}
                </div>
              </div>
            </div>
            <div class="stat compact">
              <NIcon size="14" class="stat-icon">
                <HomeOutline />
              </NIcon>
              <div class="stat-meta">
                <div class="stat-k">
                  关注
                </div>
                <div class="stat-v">
                  {{ model.following ?? '--' }}
                </div>
              </div>
            </div>
            <div class="stat compact">
              <NIcon size="14" class="stat-icon">
                <VideocamOutline />
              </NIcon>
              <div class="stat-meta">
                <div class="stat-k">
                  视频
                </div>
                <div class="stat-v">
                  {{ model.videoCount ?? '--' }}
                </div>
              </div>
            </div>
          </div>
        </div>
      </template>

      <template v-else>
        <div class="bili-header">
          <NFlex align="center" style="gap: 10px; min-width: 0">
            <NAvatar
              v-if="cfg.showAvatar && model.face"
              :src="model.face"
              round
              :size="40"
              :img-props="{ referrerpolicy: 'no-referrer' }"
            />
            <div class="bili-header-text">
              <NText v-if="cfg.showName && model.name" strong class="bili-name">
                {{ model.name }}
              </NText>
              <NText depth="3" class="bili-sub">
                Bilibili
                <template v-if="model.biliId">
                  · @{{ model.biliId }}
                </template>
              </NText>
            </div>
          </NFlex>
        </div>

        <div v-if="cfg.showSign && model.sign" class="bili-sign">
          {{ model.sign }}
        </div>

        <div v-if="cfg.showStats" class="bili-stats">
          <div class="stat">
            <NIcon size="16" class="stat-icon">
              <PeopleOutline />
            </NIcon>
            <div class="stat-meta">
              <div class="stat-k">
                粉丝
              </div>
              <div class="stat-v">
                {{ model.fans ?? '--' }}
              </div>
            </div>
          </div>
          <div class="stat">
            <NIcon size="16" class="stat-icon">
              <HomeOutline />
            </NIcon>
            <div class="stat-meta">
              <div class="stat-k">
                关注
              </div>
              <div class="stat-v">
                {{ model.following ?? '--' }}
              </div>
            </div>
          </div>
          <div class="stat">
            <NIcon size="16" class="stat-icon">
              <VideocamOutline />
            </NIcon>
            <div class="stat-meta">
              <div class="stat-k">
                视频
              </div>
              <div class="stat-v">
                {{ model.videoCount ?? '--' }}
              </div>
            </div>
          </div>
        </div>

        <div v-if="cfg.showButtons" class="bili-actions">
          <NButton
            v-if="model.spaceUrl"
            class="action"
            secondary
            tag="a"
            target="_blank"
            rel="noopener noreferrer"
            :href="model.spaceUrl"
          >
            <template #icon>
              <NIcon><HomeOutline /></NIcon>
            </template>
            主页
          </NButton>
          <NButton
            v-if="cfg.showLiveRoom && model.liveRoomUrl"
            class="action"
            secondary
            tag="a"
            target="_blank"
            rel="noopener noreferrer"
            :href="model.liveRoomUrl"
          >
            <template #icon>
              <NIcon><PlayCircleOutline /></NIcon>
            </template>
            直播间
          </NButton>
        </div>
      </template>
    </div>
  </BlockCard>
</template>

<style scoped>
.bili-card {
  border-radius: var(--vtsuru-page-radius);
  overflow: hidden;
}

.bili-header {
  padding: 12px 14px;
}

.bili-header-text {
  min-width: 0;
}

.bili-name {
  display: block;
  font-size: 16px;
  line-height: 1.25;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.bili-sub {
  display: block;
  font-size: 13px;
  line-height: 1.25;
  margin-top: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.bili-sign {
  padding: 0 16px 16px;
  font-size: 13px;
  line-height: 1.6;
  color: var(--n-text-color-3);
  white-space: pre-wrap;
}

.bili-stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  padding: 4px 0;
  border-top: 1px solid var(--n-divider-color);
  border-bottom: 1px solid var(--n-divider-color);
}

.stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 12px 4px;
  text-align: center;
  transition: background-color 0.2s;
}
.stat:hover {
  background-color: var(--n-action-color);
}

.stat-icon {
  color: var(--n-text-color-3);
  margin-bottom: 2px;
}

.stat-meta {
  display: flex;
  flex-direction: column-reverse;
  align-items: center;
}

.stat-k {
  font-size: 12px;
  color: var(--n-text-color-3);
}

.stat-v {
  font-size: 15px;
  font-weight: 700;
  color: var(--n-text-color);
  line-height: 1.2;
}

.bili-actions {
  padding: 16px;
  display: grid;
  gap: 12px;
  grid-template-columns: 1fr 1fr;
}

.action {
  border-radius: var(--vtsuru-page-radius);
  font-weight: 600;
}

.action.compact {
  padding-left: 12px;
  padding-right: 12px;
}

.bili-compact {
  padding: 16px;
}

.bili-stats.compact {
  padding: 12px 0 0;
  border: 0;
  gap: 0;
}

.stat.compact {
  padding: 0;
  flex-direction: row;
  gap: 8px;
  align-items: center;
  justify-content: flex-start;
  text-align: left;
}
.stat.compact:hover {
  background: transparent;
}
.stat.compact .stat-meta {
  flex-direction: column;
  align-items: flex-start;
}
.stat.compact .stat-icon {
  margin-bottom: 0;
}
.stat.compact .stat-v {
  font-size: 14px;
}
.stat.compact .stat-k {
  font-size: 11px;
}
</style>
