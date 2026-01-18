<script setup lang="ts">
import { NButton, NLayoutContent, NResult } from 'naive-ui';
import '@/apps/web/styles/web-page.css'
</script>

<template>
  <NLayoutContent class="web-center">
    <div class="web-page web-page--md">
      <NResult
        status="404"
        title="404"
        description="页面不存在"
      >
        <template #footer>
          <NButton
            type="primary"
            size="medium"
            @click="$router.push({ name: 'index' })"
          >
            返回首页
          </NButton>
        </template>
      </NResult>
    </div>
  </NLayoutContent>
</template>
