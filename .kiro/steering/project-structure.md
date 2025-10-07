---
inclusion: manual
---
# 项目结构

该项目是一个基于Vue的直播辅助工具，主要用于管理直播相关功能，如点歌系统、弹幕互动等。

## 主要目录结构

- `src/`: 源代码目录
  - `api/`: API调用和模型定义
  - `assets/`: 静态资源文件
  - `client/`: 客户端相关组件和服务
  - `components/`: Vue组件
  - `composables/`: Vue组合式API函数
  - `data/`: 数据相关模块，包括聊天和弹幕客户端
  - `router/`: 路由配置
  - `store/`: 状态管理
  - `views/`: 页面视图组件
    - `open_live/`: 直播相关视图，包括点歌系统
    - `obs/`: OBS相关视图组件
- `public/`: 公共静态资源
- `plugins/`: 插件目录

## 主要功能模块

- 点歌系统：允许观众通过弹幕或SuperChat点歌
- 直播互动：弹幕互动和自动化操作
- OBS集成：为OBS提供overlays和组件
