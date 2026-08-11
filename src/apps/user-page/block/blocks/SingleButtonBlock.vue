<script setup lang="ts">
import { NButton, NFlex } from 'naive-ui'
import { computed } from 'vue'
import { useRouter } from 'vue-router'

import BlockCard from '../BlockCard.vue'
import {
  buttonAppearanceClass,
  buttonAppearanceStyle,
  normalizeButtonAppearance,
} from '../buttonAppearance'
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

const buttonType = computed(() => {
  const v = propsObj.value.type
  if (v === 'primary' || v === 'info' || v === 'success' || v === 'warning' || v === 'error' || v === 'default')
    return v
  return 'default'
})

const variant = computed<'solid' | 'secondary' | 'tertiary' | 'quaternary' | 'ghost'>(() => {
  const v = propsObj.value.variant
  if (v === 'secondary' || v === 'tertiary' || v === 'quaternary' || v === 'ghost' || v === 'solid') return v
  return 'solid'
})

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
const naiveSize = computed(() => (appearance.value.size === 'sm' ? 'small' : appearance.value.size === 'lg' ? 'large' : 'medium'))

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

const justify = computed<'start' | 'center' | 'end'>(() => align.value)
</script>

<template>
  <BlockCard
    :framed="framed"
    :backgrounded="backgrounded"
  >
    <NFlex
      :justify="justify"
      align="center"
      style="width: 100%"
    >
      <NButton
        v-if="isBack || internalTarget"
        :type="buttonType as any"
        :size="naiveSize"
        :secondary="variant === 'secondary'"
        :tertiary="variant === 'tertiary'"
        :quaternary="variant === 'quaternary'"
        :ghost="variant === 'ghost'"
        :class="btnClass"
        :style="btnStyle"
        @click="handleClick"
      >
        {{ label }}
      </NButton>
      <NButton
        v-else
        tag="a"
        :type="buttonType as any"
        :size="naiveSize"
        :secondary="variant === 'secondary'"
        :tertiary="variant === 'tertiary'"
        :quaternary="variant === 'quaternary'"
        :ghost="variant === 'ghost'"
        target="_blank"
        rel="noopener noreferrer"
        :href="externalHref"
        :class="btnClass"
        :style="btnStyle"
      >
        {{ label }}
      </NButton>
    </NFlex>
  </BlockCard>
</template>
