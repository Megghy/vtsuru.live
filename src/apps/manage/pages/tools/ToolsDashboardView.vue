<script setup lang="ts">
import { ImagesOutline as NineGridIcon } from '@vicons/ionicons5' // Example Icon
import { NButton, NCard, NGrid, NGridItem, NIcon, NText } from 'naive-ui';
import { shallowRef } from 'vue'
import { useRouter } from 'vue-router'
import ManagePageHeader from '@/apps/manage/components/ManagePageHeader.vue'

const router = useRouter()

interface ToolDefinition {
  name: string
  displayName: string
  description: string
  routeName: string
  icon?: any // Using 'any' for icon component type for simplicity
}

const availableTools = shallowRef<ToolDefinition[]>([
  {
    name: 'DynamicNineGrid',
    displayName: '动态九图生成器',
    description: '快速创建用于B站动态的九宫格图片，支持自定义拼接。',
    routeName: 'ManageToolDynamicNineGrid',
    icon: NineGridIcon,
  },
  // Add more tools here as they are created
  // {
  //   name: 'AnotherTool',
  //   displayName: '另一个工具',
  //   description: '这是另一个很棒的工具。',
  //   routeName: 'ManageToolAnotherTool',
  //   icon: AnotherIconComponent,
  // },
])

function navigateToTool(routeName: string) {
  router.push({ name: routeName })
}
</script>

<template>
  <div class="tools-dashboard">
    <ManagePageHeader title="直播工具箱" subtitle="常用工具快捷入口" />

    <NGrid cols="1 s:2 m:3 l:4 xl:4 xxl:5" responsive="screen" :x-gap="12" :y-gap="12">
      <NGridItem v-for="tool in availableTools" :key="tool.name">
        <NCard
          size="small"
          :bordered="true"
          class="tool-card"
          @click="navigateToTool(tool.routeName)"
        >
          <div class="tool-card__icon">
            <NIcon v-if="tool.icon" :component="tool.icon" size="22" />
            <NIcon v-else :component="NineGridIcon" size="22" />
          </div>

          <div class="tool-card__main">
            <NText strong class="tool-card__title">
              {{ tool.displayName }}
            </NText>
            <NText depth="3" class="tool-card__desc">
              {{ tool.description }}
            </NText>
          </div>

          <div class="tool-card__action">
            <NButton type="primary" size="small" @click.stop="navigateToTool(tool.routeName)">
              打开
            </NButton>
          </div>
        </NCard>
      </NGridItem>
    </NGrid>
  </div>
</template>

<style scoped>
.tools-dashboard {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.tool-card {
  cursor: pointer;
  transition: border-color 0.15s ease, box-shadow 0.15s ease, transform 0.15s ease;
}

.tool-card:hover {
  transform: translateY(-1px);
}

.tool-card:deep(.n-card__content) {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.tool-card__icon {
  flex: none;
  width: 40px;
  height: 40px;
  border-radius: 10px;
  display: grid;
  place-items: center;
  border: 1px solid var(--n-border-color);
  background: var(--n-color-embedded);
}

.tool-card__main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.tool-card__title {
  font-size: 14px;
  line-height: 1.2;
}

.tool-card__desc {
  font-size: 12px;
  line-height: 1.4;
}

.tool-card__action {
  flex: none;
  display: flex;
  align-items: center;
}
</style>
