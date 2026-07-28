<script setup lang="ts">
import type { ResponsePointGoodModel, UserInfo } from '@/api/api-models'
import { FunctionTypes, GoodsStatus } from '@/api/api-models'
import { OpenOutline, RefreshOutline, StorefrontOutline } from '@vicons/ionicons5'
import { NAlert, NButton, NEmpty, NIcon, NImage, NSpin, NTag } from 'naive-ui'
import { computed, onMounted, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { fetchPublicPointGoods } from '@/apps/user-page/api'
import { getEnabledUserFunctions } from '@/apps/user-page/featureNavigation'
import { useUserPageRuntimeQuery } from '@/apps/user-page/runtime/query'
import BlockCard from '../BlockCard.vue'

const props = defineProps<{ blockProps: unknown, userInfo?: UserInfo }>()
const values = computed<Record<string, unknown>>(() => props.blockProps && typeof props.blockProps === 'object' && !Array.isArray(props.blockProps) ? props.blockProps as Record<string, unknown> : {})
const count = computed(() => [3, 4, 5, 6].includes(Number(values.value.count)) ? Number(values.value.count) : 3)
const selection = computed(() => values.value.selection === 'available' ? 'available' : 'pinned')
const showDescription = computed(() => values.value.showDescription !== false)
const showStock = computed(() => values.value.showStock !== false)
const enabled = computed(() => getEnabledUserFunctions(props.userInfo).has(FunctionTypes.Point))
const query = useUserPageRuntimeQuery({
  key: () => `featured-goods:${props.userInfo?.id ?? 0}`,
  ttlMs: 60_000,
  loader: signal => fetchPublicPointGoods(props.userInfo!.id, { signal }),
})

function isSoldOut(item: ResponsePointGoodModel) {
  return item.subItems?.length ? item.subItems.every(subItem => subItem.count === 0) : item.count === 0
}

function price(item: ResponsePointGoodModel) {
  const prices = item.subItems?.length ? item.subItems.map(subItem => subItem.price) : [item.price]
  const min = Math.min(...prices)
  const max = Math.max(...prices)
  if (max <= 0) return '免费'
  return min === max ? `${min} 积分` : `${min} - ${max} 积分`
}

const goods = computed(() => (query.data.value ?? [])
  .filter(item => item.status === GoodsStatus.Normal)
  .toSorted((a, b) => selection.value === 'pinned'
    ? Number(b.isPinned) - Number(a.isPinned)
    : Number(isSoldOut(a)) - Number(isSoldOut(b)))
  .slice(0, count.value))

async function load(force = false) {
  if (!props.userInfo?.id || !enabled.value) {
    query.cancel()
    return
  }
  try { await query.execute(force) }
  catch (error) { console.error('用户页积分商品区块加载失败', error) }
}

onMounted(() => { void load() })
watch(() => [props.userInfo?.id, enabled.value] as const, () => { void load() })
</script>

<template>
  <BlockCard :framed="values.framed !== false" :backgrounded="values.backgrounded !== false">
    <template #header>
      <div class="goods-header">
        <span class="goods-heading"><NIcon><StorefrontOutline /></NIcon>精选积分商品</span>
        <RouterLink v-if="props.userInfo?.name" v-slot="{ navigate }" :to="{ name: 'user-goods', params: { id: props.userInfo.name } }" custom>
          <NButton text type="primary" size="small" @click="navigate">
            全部商品<template #icon>
              <NIcon><OpenOutline /></NIcon>
            </template>
          </NButton>
        </RouterLink>
      </div>
    </template>

    <NAlert v-if="!enabled" type="info" :show-icon="false">
      积分兑换未开放
    </NAlert>
    <NAlert v-else-if="query.status.value === 'error'" type="error" :show-icon="true">
      <div class="error-row">
        <span>积分商品加载失败</span><NButton size="small" secondary @click="load(true)">
          <template #icon>
            <NIcon><RefreshOutline /></NIcon>
          </template>重试
        </NButton>
      </div>
    </NAlert>
    <NSpin v-else :show="query.status.value === 'loading' || query.status.value === 'idle'" size="small">
      <NEmpty v-if="query.status.value === 'success' && !goods.length" size="small" description="暂无可展示商品" />
      <div v-else class="goods-grid">
        <RouterLink v-for="item in goods" :key="item.id" :to="{ name: 'user-goods', params: { id: props.userInfo?.name } }" class="goods-item">
          <div class="cover-wrap">
            <NImage v-if="item.cover?.path" :src="item.cover.path" object-fit="cover" preview-disabled lazy class="cover" />
            <div v-else class="cover-empty">
              <NIcon><StorefrontOutline /></NIcon>
            </div>
            <NTag v-if="isSoldOut(item)" class="stock-tag" type="default" size="small" :bordered="false">
              已售罄
            </NTag>
          </div>
          <div class="goods-copy">
            <strong>{{ item.name }}</strong>
            <p v-if="showDescription && item.description">
              {{ item.description }}
            </p>
            <div class="goods-meta">
              <span class="price">{{ price(item) }}</span><span v-if="showStock && !isSoldOut(item)" class="stock">{{ item.count == null || item.subItems?.length ? '有库存' : `剩余 ${item.count}` }}</span>
            </div>
          </div>
        </RouterLink>
      </div>
    </NSpin>
  </BlockCard>
</template>

<style scoped>
.goods-header, .goods-heading, .error-row, .goods-meta { display: flex; align-items: center; }
.goods-header, .error-row, .goods-meta { justify-content: space-between; gap: 12px; width: 100%; }
.goods-heading { gap: 7px; font-weight: 600; }
.goods-grid { container-type: inline-size; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
.goods-item { min-width: 0; overflow: hidden; border: 1px solid var(--vtsuru-border); border-radius: 6px; color: var(--vtsuru-fg); background: var(--vtsuru-bg-muted); text-decoration: none; transition: border-color .15s ease, background-color .15s ease; }
.goods-item:hover { border-color: var(--vtsuru-primary, #18a058); background: var(--vtsuru-bg-elevated); }
.cover-wrap { position: relative; aspect-ratio: 16 / 10; overflow: hidden; background: var(--vtsuru-bg-elevated); }
.cover, .cover :deep(img) { width: 100%; height: 100%; }
.cover :deep(img) { object-fit: cover; }
.cover-empty { display: grid; place-items: center; height: 100%; color: var(--vtsuru-fg-muted); font-size: 30px; }
.stock-tag { position: absolute; right: 7px; bottom: 7px; }
.goods-copy { display: grid; gap: 6px; padding: 10px; }
.goods-copy strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 14px; }
.goods-copy p { display: -webkit-box; overflow: hidden; margin: 0; color: var(--vtsuru-fg-muted); font-size: 12px; line-height: 1.5; -webkit-box-orient: vertical; -webkit-line-clamp: 2; }
.price { color: var(--vtsuru-primary, #18a058); font-size: 13px; font-weight: 700; }
.stock { color: var(--vtsuru-fg-muted); font-size: 11px; }
@container (max-width: 640px) { .goods-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@container (max-width: 380px) { .goods-grid { grid-template-columns: 1fr; } .goods-item { display: grid; grid-template-columns: 112px minmax(0, 1fr); } .cover-wrap { aspect-ratio: auto; min-height: 100px; } }
</style>
