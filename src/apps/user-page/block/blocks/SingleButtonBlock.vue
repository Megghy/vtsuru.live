<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'

import BlockCard from '../BlockCard.vue'
import { buttonAppearanceClass, buttonAppearanceStyle, normalizeButtonAppearance } from '../buttonAppearance'
import { isBlockPropertyAvailable } from '../propertyCapabilities'

import '../buttonAppearance.css'

const props = defineProps<{ blockProps: unknown; userInfo?: unknown; biliInfo?: unknown }>()

const propsObj = computed<Record<string, any>>(() => {
  if (!props.blockProps || typeof props.blockProps !== 'object' || Array.isArray(props.blockProps)) return {}
  return props.blockProps as any
})

const router = useRouter()

function slugOk(slug: string) {
  return /^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/.test(slug)
}

function getUserName() {
  const name = (props.userInfo as any)?.name
  return typeof name === 'string' ? name : ''
}

function getInternalPath(slug: string) {
  const userName = getUserName()
  if (!userName) return null
  if (slug === 'home') return `/@${userName}`
  if (!slugOk(slug)) return null
  return `/@${userName}/${slug}`
}

const label = computed(() => {
  const v = propsObj.value.label
  return typeof v === 'string' ? v : ''
})

const framed = computed(() => propsObj.value.framed === true)
const backgrounded = computed(() => propsObj.value.backgrounded === true)

const align = computed<'start' | 'center' | 'end'>(() => {
  if (!isBlockPropertyAvailable('button', propsObj.value, 'align')) return 'start'
  const v = propsObj.value.align
  if (v === 'center' || v === 'end' || v === 'start') return v
  return 'start'
})

const fullWidth = computed(() => propsObj.value.fullWidth === true)

const appearance = computed(() => normalizeButtonAppearance(propsObj.value))
const btnClass = computed(() => buttonAppearanceClass(appearance.value, fullWidth.value))
const btnStyle = computed(() => buttonAppearanceStyle(appearance.value))

const internalTarget = computed(() => {
  const v = propsObj.value.page
  if (typeof v !== 'string' || !v.trim().length) return null
  return getInternalPath(v.trim())
})

const isBack = computed(() => propsObj.value.back === true)

const externalHref = computed(() => {
  const v = propsObj.value.url
  return typeof v === 'string' ? v : 'https://'
})

function handleClick() {
  if (isBack.value) {
    router.back()
    return
  }
  if (internalTarget.value) {
    void router.push(internalTarget.value)
  }
}

const justifyClass = computed(() => {
  if (align.value === 'center') return 'justify-center'
  if (align.value === 'end') return 'justify-end'
  return 'justify-start'
})
</script>

<template>
  <BlockCard
    :framed="framed"
    :backgrounded="backgrounded"
  >
    <div
      class="flex items-center w-full"
      :class="justifyClass"
    >
      <button
        v-if="isBack || internalTarget"
        type="button"
        class="inline-flex items-center justify-center font-medium cursor-pointer"
        :class="btnClass"
        :style="btnStyle"
        @click="handleClick"
      >
        {{ label }}
      </button>
      <a
        v-else
        target="_blank"
        rel="noopener noreferrer"
        :href="externalHref"
        class="inline-flex items-center justify-center font-medium cursor-pointer"
        :class="btnClass"
        :style="btnStyle"
      >
        {{ label }}
      </a>
    </div>
  </BlockCard>
</template>
