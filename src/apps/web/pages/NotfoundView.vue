<script setup lang="ts">
import '@/apps/web/styles/web-page.css'
</script>

<template>
  <main class="web-center">
    <div class="web-page web-page--md">
      <UEmpty
        icon="i-lucide-file-question"
        title="404"
        description="页面不存在"
      >
        <UButton @click="$router.push({ name: 'index' })"> 返回首页 </UButton>
      </UEmpty>
    </div>
  </main>
</template>
