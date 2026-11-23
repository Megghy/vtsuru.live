<script setup lang="ts">
import { ArrowUpRight, Compass, ExternalLink } from 'lucide-vue-next'
import { computed } from 'vue'
import { useRouter } from 'vue-router'

import { ACCOUNT, isLoggedIn } from '@/api/account'
import { Button } from '@/shared/ui/button'

const props = withDefaults(
  defineProps<{
    title: string
    description?: string
    routeName?: string
    buttonText?: string
    href?: string
    useCurrentUserPage?: boolean
  }>(),
  {
    description: undefined,
    routeName: undefined,
    buttonText: '前往配置',
    href: undefined,
    useCurrentUserPage: false,
  },
)

const router = useRouter()

const userDisplayLabel = computed(() => {
  if (!props.useCurrentUserPage) return props.buttonText
  return isLoggedIn.value && ACCOUNT.value?.name ? `打开我的主页 (@${ACCOUNT.value.name})` : '登录并预览我的主页'
})

function handleAction() {
  if (props.href) {
    window.open(props.href, '_blank', 'noopener,noreferrer')
    return
  }
  if (props.useCurrentUserPage) {
    if (isLoggedIn.value && ACCOUNT.value?.name) {
      void router.push({ name: 'user-index', params: { id: ACCOUNT.value.name } })
    } else {
      void router.push({ name: 'manage-userPageBuilder' })
    }
    return
  }
  if (props.routeName) {
    void router.push({ name: props.routeName })
  }
}
</script>

<template>
  <div class="my-5 flex flex-col gap-3 rounded-lg border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
    <div class="min-w-0">
      <div class="flex items-center gap-2 text-sm font-semibold text-foreground">
        <Compass class="size-4 shrink-0 text-brand" />
        <span>{{ title }}</span>
      </div>
      <p
        v-if="description"
        class="mt-1 mb-0! text-xs leading-relaxed text-muted-foreground"
      >
        {{ description }}
      </p>
    </div>
    <Button
      class="shrink-0 gap-1.5"
      @click="handleAction"
    >
      <span>{{ userDisplayLabel }}</span>
      <ExternalLink
        v-if="href"
        class="size-3.5"
      />
      <ArrowUpRight
        v-else
        class="size-3.5"
      />
    </Button>
  </div>
</template>
