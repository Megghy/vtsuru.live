---
inclusion: fileMatch
fileMatchPattern: ['*.vue']
---
# UI组件

项目使用Vue 3和Naive UI作为主要UI框架，采用组件化设计。

## 主要UI框架

- Vue 3: 使用`<script setup>`语法和组合式API
- Naive UI: 提供各种预设UI组件
- VueUse: 提供实用的组合式函数，如`useStorage`

## 常用组件

### Naive UI组件

项目广泛使用Naive UI组件：

- `NCard`: 卡片容器
- `NSpace`: 间距布局
- `NButton`: 按钮
- `NInput`: 输入框
- `NTabs`: 标签页
- `NDataTable`: 数据表格
- `NModal`: 模态框
- `NAlert`: 警告提示
- `NTag`: 标签
- `NIcon`: 图标容器

### 自定义组件

- [SongPlayer.vue](mdc:src/components/SongPlayer.vue): 歌曲播放器组件
- [LiveRequestOBS.vue](mdc:src/views/obs/LiveRequestOBS.vue): OBS点歌显示组件

## 状态管理

项目使用组合式API和本地存储管理状态：

- `ref`/`computed`: 响应式状态
- `useStorage`: 持久化存储
- `useAccount`: 账户状态管理

## UI设计模式

- 使用`NFlex`和`NCard`进行布局
- 通过`NTabs`组织不同功能区域
- 使用状态颜色区分不同状态（如等待中、处理中、已完成）
- 响应式设计适应不同屏幕尺寸
