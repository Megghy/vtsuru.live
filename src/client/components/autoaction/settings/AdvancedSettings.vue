<script setup lang="ts">
import { NSpace, NSwitch, NInputNumber, NInput, NCollapseItem } from 'naive-ui';
import { AutoActionItem, TriggerType } from '@/client/store/useAutoAction';
import { computed } from 'vue';

const props = defineProps({
  action: {
    type: Object as () => AutoActionItem,
    required: true
  }
});

// 根据触发类型判断是否显示用户过滤选项
const showUserFilter = computed(() => {
  return ![TriggerType.SCHEDULED].includes(props.action.triggerType);
});
</script>

<template>
  <NCollapse>
    <NCollapseItem
      v-if="showUserFilter"
      key="user-filter"
      title="用户过滤"
      class="settings-section"
    >
      <div>
        <NSpace
          key="user-filter-enabled"
          vertical
          class="settings-subsection"
        >
          <NSpace
            align="center"
            justify="space-between"
            style="width: 100%"
            class="setting-item"
          >
            <span>启用用户过滤:</span>
            <NSwitch v-model:value="action.triggerConfig.userFilterEnabled" />
          </NSpace>

          <template v-if="action.triggerConfig.userFilterEnabled">
            <NSpace
              key="require-medal"
              align="center"
              justify="space-between"
              style="width: 100%"
              class="setting-item"
            >
              <span>要求本房间勋章:</span>
              <NSwitch v-model:value="action.triggerConfig.requireMedal" />
            </NSpace>

            <NSpace
              key="require-captain"
              align="center"
              justify="space-between"
              style="width: 100%"
              class="setting-item"
            >
              <span>要求任意舰长:</span>
              <NSwitch v-model:value="action.triggerConfig.requireCaptain" />
            </NSpace>
          </template>
        </NSpace>
      </div>
    </NCollapseItem>

    <NCollapseItem
      key="cooldown"
      title="冷却控制"
      class="settings-section"
    >
      <div>
        <NSpace
          key="ignore-cooldown"
          align="center"
          justify="space-between"
          style="width: 100%"
          class="setting-item"
        >
          <span>忽略全局冷却:</span>
          <NSwitch v-model:value="action.ignoreCooldown" />
        </NSpace>

        <NSpace
          key="delay-seconds"
          align="center"
          justify="space-between"
          style="width: 100%"
          class="setting-item"
        >
          <span>延迟执行(秒):</span>
          <NInputNumber
            v-model:value="action.actionConfig.delaySeconds"
            :min="0"
            :max="600"
            style="width: 120px"
          />
        </NSpace>

        <NSpace
          key="cooldown-seconds"
          align="center"
          justify="space-between"
          style="width: 100%"
          class="setting-item"
        >
          <span>冷却时间(秒):</span>
          <NInputNumber
            v-model:value="action.actionConfig.cooldownSeconds"
            :min="0"
            :max="3600"
            style="width: 120px"
          />
        </NSpace>
      </div>
    </NCollapseItem>

    <NCollapseItem
      key="logical-expression"
      title="逻辑条件表达式"
      class="settings-section"
    >
      <div>
        <NSpace vertical>
          <p class="description">
            当表达式为真时才会执行此操作。可使用JS语法，例如: <code>user.guardLevel > 0 || gift.price > 10</code>
          </p>
          <NInput
            v-model:value="action.logicalExpression"
            type="textarea"
            placeholder="输入表达式，留空则始终为真"
            :autosize="{ minRows: 2, maxRows: 5 }"
          />
        </NSpace>
      </div>
    </NCollapseItem>

    <NCollapseItem
      key="custom-js"
      title="自定义JS执行"
      class="settings-section"
    >
      <div>
        <NSpace vertical>
          <p class="description">
            可访问 context, event, biliFunc, roomId 等变量
          </p>
          <NInput
            v-model:value="action.executeCommand"
            type="textarea"
            placeholder="输入要执行的JS代码"
            :autosize="{ minRows: 3, maxRows: 8 }"
          />
        </NSpace>
      </div>
    </NCollapseItem>
  </NCollapse>
</template>

<style scoped>
.settings-section {
  margin-bottom: 12px;
  position: relative;
}

.settings-subsection {
  position: relative;
}

.setting-item {
  padding: 4px 8px;
  border-radius: 4px;
}

.setting-item:hover {
  background-color: rgba(0, 0, 0, 0.02);
}

.description {
  margin-top: 8px;
  font-size: 13px;
  color: #999;
}

code {
  background-color: rgba(0, 0, 0, 0.06);
  padding: 2px 4px;
  border-radius: 4px;
  font-family: monospace;
}

/* 已移除所有动画相关样式 */
</style>
