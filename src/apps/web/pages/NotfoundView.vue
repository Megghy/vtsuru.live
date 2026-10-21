<script setup lang="ts">
import { Button } from '@/shared/ui/button'

import '@/apps/web/styles/web-page.css'
</script>

<template>
  <main class="web-center flex flex-col items-center justify-center min-h-[60vh] text-center p-6">
    <div class="web-page web-page--md flex flex-col items-center gap-4">
      <h1 class="text-7xl font-bold tracking-tight text-foreground">404</h1>
      <p class="text-muted-foreground text-sm">页面不存在</p>
      <Button
        size="default"
        class="mt-2"
        @click="$router.push({ name: 'index' })"
      >
        返回首页
      </Button>
    </div>
  </main>
</template>
