<template>
  <n-layout class="tools-dashboard">
    <n-layout-header bordered class="header">
      <n-h1 style="margin: 0; padding: 16px;">直播工具箱</n-h1>
    </n-layout-header>
    <n-layout-content style="padding: 24px;">
      <n-grid cols="1 s:2 m:3 l:4 xl:4 xxl:5" responsive="screen" :x-gap="16" :y-gap="16">
        <n-grid-item v-for="tool in availableTools" :key="tool.name">
          <n-card :title="tool.displayName" hoverable @click="navigateToTool(tool.routeName)">
            <template #cover v-if="tool.icon">
              <!-- Placeholder for an icon or image -->
              <div style="font-size: 48px; text-align: center; padding: 20px 0;">
                <n-icon :component="tool.icon" />
              </div>
            </template>
            {{ tool.description }}
             <template #action>
              <n-button type="primary" block @click.stop="navigateToTool(tool.routeName)">
                打开工具
              </n-button>
            </template>
          </n-card>
        </n-grid-item>
      </n-grid>
    </n-layout-content>
  </n-layout>
</template>

<script setup lang="ts">
import { shallowRef } from 'vue';
import { useRouter } from 'vue-router';
import { NLayout, NLayoutHeader, NLayoutContent, NGrid, NGridItem, NCard, NH1, NIcon, NButton } from 'naive-ui';
import { ImagesOutline as NineGridIcon } from '@vicons/ionicons5'; // Example Icon

const router = useRouter();

interface ToolDefinition {
  name: string;
  displayName: string;
  description: string;
  routeName: string;
  icon?: any; // Using 'any' for icon component type for simplicity
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
]);

const navigateToTool = (routeName: string) => {
  router.push({ name: routeName });
};
</script>

<style scoped>
.tools-dashboard {
  min-height: calc(100vh - 64px); /* Adjust based on your header/footer height */
}
.header {
  background-color: var(--card-color); /* Or your preferred header background */
}
.n-card {
  cursor: pointer;
  transition: transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out;
}
.n-card:hover {
  transform: translateY(-5px);
  box-shadow: var(--card-box-shadow-hover);
}
</style>
