<script setup lang="ts">
import { ArrowUpRight, Coins, ExternalLink, Sparkles } from 'lucide-vue-next'
import { computed, useTemplateRef } from 'vue'
import { useRouter } from 'vue-router'

import { isLoggedIn } from '@/api/account'
import { Button } from '@/shared/ui/button'
import vtb from '@/svgs/ic_vtuber.svg'

import { EXTERNAL_LINKS } from './indexData'
import { lerp, useElementScrollProgress } from './useIndexMotion'

const props = defineProps<{
  isReduced: boolean
}>()

const emit = defineEmits<{
  openAudience: []
}>()

const router = useRouter()
const ctaCardEl = useTemplateRef<HTMLElement>('ctaCardEl')
const ctaScroll = useElementScrollProgress(ctaCardEl, {
  enterStartRatio: 1.0,
  enterEndRatio: 0.62,
})

// 收尾 CTA 卡片随滚入 3D 微微撑正展开
const ctaCardStyle = computed(() => {
  if (props.isReduced) return undefined
  const t = ctaScroll.easedEnter
  const scale = lerp(0.93, 1, t)
  const y = lerp(28, 0, t)
  const rx = lerp(7, 0, t)
  return {
    transform: `perspective(1200px) translate3d(0, ${y.toFixed(1)}px, 0) scale(${scale.toFixed(3)}) rotateX(${rx.toFixed(2)}deg)`,
    opacity: lerp(0.25, 1, t).toFixed(3),
  }
})

// 内部柔和斜光带随滚动从左向右横扫
const sheenStyle = computed(() => {
  if (props.isReduced) return undefined
  const x = lerp(-45, 55, ctaScroll.pass)
  return {
    transform: `translate3d(${x.toFixed(1)}%, 0, 0) skewX(-18deg)`,
  }
})
</script>

<template>
  <footer class="border-t border-border/75 bg-background/85 backdrop-blur-md">
    <!-- 轻量收尾行动带（随滚动 3D 撑正 + 光带横扫） -->
    <div class="mx-auto w-full max-w-[1320px] px-4 pt-14 pb-10 sm:px-6 lg:px-8">
      <div
        ref="ctaCardEl"
        class="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-r from-brand/14 via-card/95 to-pink-500/12 p-6 sm:p-8 will-change-transform"
        :style="ctaCardStyle"
      >
        <div
          class="pointer-events-none absolute inset-y-0 left-0 w-1/2 bg-gradient-to-r from-transparent via-brand/12 to-transparent will-change-transform"
          :style="sheenStyle"
          aria-hidden="true"
        />

        <div class="relative z-10 flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div class="max-w-xl">
            <h2 class="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
              准备好搭建你的下一场直播与主页了吗？
            </h2>
            <p class="mt-2 text-xs leading-relaxed text-muted-foreground sm:text-sm">
              无论是快速接通一个 OBS 倒计时挂件，还是从零拼装一整套含 OC 设定集、约稿价目与歌单的个人门户，随时都可以开始。
            </p>
          </div>

          <div class="flex flex-wrap items-center gap-2.5 shrink-0">
            <Button
              size="lg"
              class="gap-1.5"
              @click="router.push({ name: 'manage-index' })"
            >
              <Sparkles class="size-4" />
              {{ isLoggedIn ? '进入主播工作台' : '立即开始使用' }}
              <ArrowUpRight class="size-4" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              class="gap-1.5"
              @click="emit('openAudience')"
            >
              <Coins class="size-4 text-amber-500" />
              观众查积分
            </Button>
          </div>
        </div>
      </div>

      <!-- 结构化链接栏 -->
      <div class="mt-10 flex flex-col gap-6 border-t border-border/70 pt-8 md:flex-row md:items-center md:justify-between">
        <div class="flex items-center gap-3">
          <span class="flex size-8 items-center justify-center rounded-lg bg-brand/12 ring-1 ring-brand/25">
            <vtb class="size-5" />
          </span>
          <div>
            <div class="text-sm font-bold text-foreground">VTSURU.LIVE</div>
            <div class="text-xs text-muted-foreground">
              BY
              <a
                :href="EXTERNAL_LINKS.authorBili"
                target="_blank"
                rel="noreferrer"
                class="font-semibold text-foreground transition-colors hover:text-brand"
              >
                Megghy
              </a>
            </div>
          </div>
        </div>

        <nav
          aria-label="页脚链接"
          class="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground"
        >
          <button
            type="button"
            class="transition-colors hover:text-foreground"
            @click="router.push({ name: 'docs-index' })"
          >
            使用文档
          </button>
          <button
            type="button"
            class="transition-colors hover:text-foreground"
            @click="router.push({ name: 'live-directory' })"
          >
            直播与关注
          </button>
          <button
            type="button"
            class="transition-colors hover:text-foreground"
            @click="router.push('/@Megghy')"
          >
            示例主页
          </button>
          <a
            :href="EXTERNAL_LINKS.huanxing"
            target="_blank"
            rel="noreferrer"
            class="inline-flex items-center gap-1 transition-colors hover:text-foreground"
          >
            幻星平台
            <ExternalLink class="size-3 opacity-60" />
          </a>
          <a
            :href="EXTERNAL_LINKS.clientDocs"
            target="_blank"
            rel="noreferrer"
            class="inline-flex items-center gap-1 transition-colors hover:text-foreground"
          >
            客户端文档
            <ExternalLink class="size-3 opacity-60" />
          </a>
          <a
            :href="EXTERNAL_LINKS.clientRepo"
            target="_blank"
            rel="noreferrer"
            class="inline-flex items-center gap-1 transition-colors hover:text-foreground"
          >
            GitHub
            <ExternalLink class="size-3 opacity-60" />
          </a>
          <button
            type="button"
            class="transition-colors hover:text-foreground"
            @click="router.push({ name: 'about' })"
          >
            关于
          </button>
        </nav>
      </div>
    </div>
  </footer>
</template>
