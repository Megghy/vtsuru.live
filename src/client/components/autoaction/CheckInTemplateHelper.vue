<template>
  <div class="checkin-template-helper">
    <TemplateHelper :placeholders="checkInPlaceholders" />
    <NAlert
      type="info"
      :show-icon="false"
      style="margin-top: 8px;"
    >
      <template #header>
        <div class="alert-header">
          <NIcon
            :component="Info24Filled"
            style="margin-right: 4px;"
          />
          签到模板可用变量列表
        </div>
      </template>
      <NDivider style="margin: 6px 0;" />
      <div class="placeholder-groups">
        <div class="placeholder-group">
          <div class="group-title">
            用户信息
          </div>          <div class="placeholder-item">
            <code>&#123;&#123;user.name&#125;&#125;</code> - 用户名称
          </div>
          <div class="placeholder-item">
            <code>&#123;&#123;user.uid&#125;&#125;</code> - 用户ID
          </div>
        </div>
        <div class="placeholder-group">
          <div class="group-title">
            签到信息
          </div>          <div class="placeholder-item">
            <code>&#123;&#123;checkin.points&#125;&#125;</code> - 基础签到积分
          </div>
          <div class="placeholder-item">
            <code>&#123;&#123;checkin.bonusPoints&#125;&#125;</code> - 早鸟额外积分 (普通签到为0)
          </div>
          <div class="placeholder-item">
            <code>&#123;&#123;checkin.totalPoints&#125;&#125;</code> - 总获得积分
          </div>
          <div class="placeholder-item">
            <code>&#123;&#123;checkin.isEarlyBird&#125;&#125;</code> - 是否是早鸟签到 (true/false)
          </div>
          <div class="placeholder-item">
            <code>&#123;&#123;checkin.cooldownSeconds&#125;&#125;</code> - 签到冷却时间(秒)
          </div>
          <div class="placeholder-item">
            <code>&#123;&#123;checkin.time&#125;&#125;</code> - 签到时间对象
          </div>
        </div>
      </div>
      <NDivider style="margin: 6px 0;" />
      <div class="placeholder-example">
        <div class="example-title">
          示例模板:
        </div>        <div class="example-item">
          普通签到: <code>&#123;&#123;user.name&#125;&#125; 签到成功！获得 &#123;&#123;checkin.totalPoints&#125;&#125; 积分。</code>
        </div>
        <div class="example-item">
          早鸟签到: <code>恭喜 &#123;&#123;user.name&#125;&#125; 完成早鸟签到！额外获得 &#123;&#123;checkin.bonusPoints&#125;&#125; 积分，共获得 &#123;&#123;checkin.totalPoints&#125;&#125; 积分！</code>
        </div>
        <div class="example-item">
          条件表达式: <code>&#123;&#123;js: checkin.isEarlyBird ? `恭喜 ${user.name} 获得早鸟奖励!` : `${user.name} 签到成功!`&#125;&#125; 获得 &#123;&#123;checkin.totalPoints&#125;&#125; 积分。</code>
        </div>
      </div>
    </NAlert>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { NAlert, NDivider, NIcon } from 'naive-ui';
import { Info24Filled } from '@vicons/fluent';
import TemplateHelper from './TemplateHelper.vue';

// 签到模板的特定占位符
const checkInPlaceholders = [
  { name: '{{user.name}}', description: '用户名称' },
  { name: '{{user.uid}}', description: '用户ID' },
  { name: '{{checkin.points}}', description: '基础签到积分' },
  { name: '{{checkin.bonusPoints}}', description: '早鸟额外积分 (普通签到为0)' },
  { name: '{{checkin.totalPoints}}', description: '总获得积分' },
  { name: '{{checkin.isEarlyBird}}', description: '是否是早鸟签到 (true/false)' },
  { name: '{{checkin.cooldownSeconds}}', description: '签到冷却时间(秒)' },
  { name: '{{checkin.time}}', description: '签到时间对象' }
];
</script>

<style scoped>
.checkin-template-helper {
  margin-bottom: 12px;
}

.alert-header {
  display: flex;
  align-items: center;
  font-weight: bold;
}

.placeholder-groups {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
}

.placeholder-group {
  flex: 1;
  min-width: 200px;
}

.group-title {
  font-weight: bold;
  margin-bottom: 6px;
  font-size: 14px;
}

.placeholder-item {
  margin-bottom: 4px;
  font-size: 13px;
}

.placeholder-item code {
  padding: 1px 4px;
  background-color: rgba(0, 0, 0, 0.05);
  border-radius: 3px;
  font-size: 12px;
}

.placeholder-example {
  margin-top: 8px;
}

.example-title {
  font-weight: bold;
  margin-bottom: 6px;
  font-size: 14px;
}

.example-item {
  margin-bottom: 4px;
  font-size: 13px;
}

.example-item code {
  display: block;
  padding: 4px 8px;
  background-color: rgba(0, 0, 0, 0.05);
  border-radius: 3px;
  margin-top: 2px;
  font-size: 12px;
  white-space: nowrap;
  overflow: auto;
}
</style>
