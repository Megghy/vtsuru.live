<script setup lang="ts">
import { NButton, NFlex } from 'naive-ui';
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import BlockCard from '../BlockCard.vue'

const props = defineProps<{ blockProps: unknown, userInfo?: unknown, biliInfo?: unknown }>()

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

const framed = computed(() => {
  const v = propsObj.value.framed
  if (typeof v === 'boolean') return v
  return false
})

const backgrounded = computed(() => {
  const v = propsObj.value.backgrounded
  if (typeof v === 'boolean') return v
  return false
})

const buttonType = computed(() => {
  const v = propsObj.value.type
  if (v === 'primary' || v === 'info' || v === 'success' || v === 'warning' || v === 'error' || v === 'default') return v
  return 'primary'
})

const variant = computed<'solid' | 'secondary' | 'tertiary' | 'quaternary' | 'ghost'>(() => {
  const v = propsObj.value.variant
  if (v === 'secondary' || v === 'tertiary' || v === 'quaternary' || v === 'ghost' || v === 'solid') return v
  return 'solid'
})

const align = computed<'start' | 'center' | 'end'>(() => {
  const v = propsObj.value.align
  if (v === 'center' || v === 'end' || v === 'start') return v
  return 'start'
})

const fullWidth = computed(() => {
  const v = propsObj.value.fullWidth
  if (typeof v === 'boolean') return v
  return true
})

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
  <BlockCard :framed="framed" :backgrounded="backgrounded">
    <NFlex :justify="justify" :align="'center'" style="width: 100%">
      <NButton
        v-if="isBack || internalTarget"
        :type="buttonType as any"
        :secondary="variant === 'secondary'"
        :tertiary="variant === 'tertiary'"
        :quaternary="variant === 'quaternary'"
        :ghost="variant === 'ghost'"
        class="vtsuru-btn"
        :style="fullWidth ? 'width: 100%' : undefined"
        @click="handleClick"
      >
        {{ label }}
      </NButton>
      <NButton
        v-else
        tag="a"
        :type="buttonType as any"
        :secondary="variant === 'secondary'"
        :tertiary="variant === 'tertiary'"
        :quaternary="variant === 'quaternary'"
        :ghost="variant === 'ghost'"
        target="_blank"
        rel="noopener noreferrer"
        :href="externalHref"
        class="vtsuru-btn"
        :style="fullWidth ? 'width: 100%' : undefined"
      >
        {{ label }}
      </NButton>
    </NFlex>
  </BlockCard>
</template>

<style scoped>
.vtsuru-btn {
  border-radius: var(--vtsuru-page-radius);
  font-weight: 600;
  transition: transform 0.1s ease;
}

.vtsuru-btn:active {
  transform: scale(0.98);
}
</style>
