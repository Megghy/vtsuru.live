import type { CustomHtmlProps } from './customHtmlContract'

export interface CustomCodeTemplate {
  key: string
  label: string
  source: string
}

const css = `
  body {
    padding: 24px;
  }
  main {
    max-width: 900px;
    margin: auto;
  }
  button,
  input {
    font: inherit;
    padding: 8px 12px;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    color: inherit;
    background: var(--popover);
  }
  button {
    cursor: pointer;
  }
  article {
    padding: 16px 0;
    border-bottom: 1px solid var(--border);
  }
  small {
    color: var(--muted-foreground);
  }
  img {
    width: 80px;
    border-radius: 50%;
  }
  nav {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }
`

export const CUSTOM_CODE_TEMPLATES: CustomCodeTemplate[] = [
  {
    key: 'profile',
    label: '完整个人主页',
    source: `<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

const ctx = ref<VtsuruPageContext | null>(null)
onMounted(async () => {
  ctx.value = await vtsuru.getContext()
})
const features = [
  ['songList', '歌单', 'songlist'],
  ['schedule', '日程', 'schedule'],
  ['questionBox', '提问箱', 'question-box'],
  ['checkInRanking', '签到榜', 'check-in-ranking'],
  ['pointGoods', '积分兑换', 'point-goods'],
  ['videoCollect', '视频征集', 'video-collect'],
]
const enabled = computed(() =>
  features.filter(([feature]) => ctx.value?.streamer.enabledFeatures.includes(feature)),
)
</script>
<template>
  <main v-if="ctx">
    <figure v-if="ctx.streamer.faceUrl"><img :src="ctx.streamer.faceUrl" alt="主播头像"></figure>
    <h1>{{ ctx.streamer.name }}</h1>
    <p>{{ ctx.streamer.bio }}</p>
    <p>{{ ctx.streamer.isStreaming ? '直播中' : '休息中' }}</p>
    <p v-if="ctx.bili?.fans ?? ctx.bili?.follower ?? ctx.bili?.follower_count">
      粉丝 {{ ctx.bili?.fans ?? ctx.bili?.follower ?? ctx.bili?.follower_count }}
    </p>
    <nav>
      <button v-for="[feature, label, target] in enabled" :key="feature" @click="vtsuru.navigate(target)">
        {{ label }}
      </button>
    </nav>
  </main>
</template>
<style>${css}</style>`,
  },
  {
    key: 'songs',
    label: '交互式歌单面板',
    source: `<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'

const keyword = ref('')
const total = ref(0)
const items = ref<VtsuruSong[]>([])
let sequence = 0
async function render() {
  const current = ++sequence
  const result = await vtsuru.getSongs({ keyword: keyword.value, limit: 100 })
  if (current !== sequence) return
  total.value = result.total
  items.value = result.items
}
watch(keyword, render)
onMounted(render)
</script>
<template>
  <main>
    <h1>歌单</h1>
    <input v-model="keyword" placeholder="搜索歌曲" aria-label="搜索歌曲">
    <p>{{ total }} 首歌曲</p>
    <section>
      <article v-for="song in items" :key="song.key">
        <button @click="vtsuru.requestSong(song.key)">{{ song.name }} · {{ song.author.join(' / ') }}</button>
      </article>
    </section>
  </main>
</template>
<style>${css}</style>`,
  },
  {
    key: 'schedule',
    label: '本周日程时间轴',
    source: `<script setup lang="ts">
import { onMounted, ref } from 'vue'

const weeks = ref<VtsuruScheduleWeek[]>([])
const reserves = ref<VtsuruReserve[]>([])
onMounted(async () => {
  const today = new Date()
  const thursday = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()))
  thursday.setUTCDate(thursday.getUTCDate() + 4 - (thursday.getUTCDay() || 7))
  const year = thursday.getUTCFullYear()
  const week = Math.ceil(((thursday.getTime() - Date.UTC(year, 0, 1)) / 86400000 + 1) / 7)
  const result = await vtsuru.getSchedule({ year, week })
  weeks.value = result.weeks
  reserves.value = result.reserves.filter((item) => item.year === year && item.week === week)
})
</script>
<template>
  <main>
    <h1>直播日程</h1>
    <section>
      <article v-for="week in weeks" :key="week.year + '-' + week.week">
        <h2>{{ week.year }} 年 · 第 {{ week.week }} 周</h2>
        <p v-for="(day, index) in week.days.flat()" :key="index">{{ [day.time, day.title, day.tag].filter(Boolean).join(' · ') }}</p>
      </article>
      <p v-for="reserve in reserves" :key="reserve.title">{{ reserve.title }} · {{ reserve.time }}</p>
      <p v-if="!weeks.length && !reserves.length">本周暂无日程</p>
    </section>
  </main>
</template>
<style>${css}</style>`,
  },
  {
    key: 'checkin',
    label: '签到榜与提问箱入口',
    source: `<script setup lang="ts">
import { onMounted, ref } from 'vue'

const ranking = ref<VtsuruRankingItem[]>([])
onMounted(async () => {
  const { totalRanking } = await vtsuru.getCheckInRanking({ count: 10 })
  ranking.value = totalRanking
})
</script>
<template>
  <main>
    <h1>签到榜</h1>
    <ol>
      <li v-for="item in ranking" :key="item.name">{{ item.name }} · {{ item.totalCheckInCount }}</li>
    </ol>
    <button @click="vtsuru.openQuestionBox()">向我提问</button>
  </main>
</template>
<style>${css}</style>`,
  },
]

export function applyCustomCodeTemplate(config: CustomHtmlProps, key: string) {
  const template = CUSTOM_CODE_TEMPLATES.find((item) => item.key === key)
  if (!template) throw new Error('Unknown custom code template')
  return { ...config, source: template.source }
}
