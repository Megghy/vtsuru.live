<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

import { getApiVtsuruGetIndexData } from '@/api/generated/vtsuru/vtsuru'
import { useBiliAuth } from '@/store/useBiliAuth'

import type { IndexDataModel } from './index/indexData'
import IndexAmbientBackdrop from './index/IndexAmbientBackdrop.vue'
import IndexFeatureBento from './index/IndexFeatureBento.vue'
import IndexFlagshipShowcase from './index/IndexFlagshipShowcase.vue'
import IndexFooter from './index/IndexFooter.vue'
import IndexHeader from './index/IndexHeader.vue'
import IndexHeroSection from './index/IndexHeroSection.vue'
import IndexObsWidgetsStrip from './index/IndexObsWidgetsStrip.vue'
import IndexStreamerShowcase from './index/IndexStreamerShowcase.vue'
import { useIndexParallax } from './index/useIndexMotion'

const router = useRouter()
const biliAuth = useBiliAuth()
const parallax = useIndexParallax()

const indexData = ref<IndexDataModel>()
const isLoadingData = ref(true)
const isRefreshingRooms = ref(false)
const hasLoadError = ref(false)

const streamers = computed(() => indexData.value?.streamers ?? [])
const liveCount = computed(() => streamers.value.filter((room) => room.isStreaming).length)
const userCount = computed(() => indexData.value?.userCount ?? 0)

async function openAudience() {
  await biliAuth.sessionReady
  void router.push({ name: biliAuth.isAuthed ? 'bili-user-points' : 'bili-auth' })
}

async function loadIndexData() {
  isRefreshingRooms.value = true
  hasLoadError.value = false
  try {
    const data = await getApiVtsuruGetIndexData()
    if (data.code !== 200) throw new Error(`Failed to load index data: ${data.code}`)
    indexData.value = data.data
  } catch {
    hasLoadError.value = true
  } finally {
    isLoadingData.value = false
    isRefreshingRooms.value = false
  }
}

onMounted(() => {
  void loadIndexData()
})
</script>

<template>
  <div class="relative isolate min-h-screen bg-background text-foreground selection:bg-brand/20 selection:text-foreground">
    <IndexAmbientBackdrop
      :scroll-y="parallax.scrollY.value"
      :scroll-progress="parallax.scrollProgress.value"
      :is-reduced="parallax.isReduced.value"
    />

    <IndexHeader
      :is-scrolled="parallax.isScrolled.value"
      :scroll-progress="parallax.scrollProgress.value"
      :active-section-id="parallax.activeSectionId.value"
      :live-count="liveCount"
    />

    <main class="relative z-10 overflow-x-clip">
      <IndexHeroSection
        :user-count="userCount"
        :live-count="liveCount"
        :exit-progress="parallax.heroExitProgress.value"
        :is-desktop="parallax.isDesktop.value"
        :is-reduced="parallax.isReduced.value"
        @open-audience="openAudience"
      />

      <IndexFlagshipShowcase
        :is-desktop="parallax.isDesktop.value"
        :is-reduced="parallax.isReduced.value"
      />

      <IndexObsWidgetsStrip
        :scroll-y="parallax.scrollY.value"
        :is-desktop="parallax.isDesktop.value"
        :is-reduced="parallax.isReduced.value"
      />

      <IndexFeatureBento
        :is-desktop="parallax.isDesktop.value"
        :is-reduced="parallax.isReduced.value"
      />

      <IndexStreamerShowcase
        :streamers="streamers"
        :is-loading="isLoadingData"
        :is-refreshing="isRefreshingRooms"
        :has-error="hasLoadError"
        :is-desktop="parallax.isDesktop.value"
        :is-reduced="parallax.isReduced.value"
        @refresh="loadIndexData"
      />
    </main>

    <IndexFooter
      class="relative z-10"
      :is-reduced="parallax.isReduced.value"
      @open-audience="openAudience"
    />
  </div>
</template>
