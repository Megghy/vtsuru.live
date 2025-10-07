---
inclusion: manual
---
# API集成

该项目使用多个API接口与后端服务和直播平台进行交互。

## 主要API模块

- [src/api/api-models.ts](mdc:src/api/api-models.ts): 定义了系统中使用的数据模型
- [src/api/query.ts](mdc:src/api/query.ts): 提供了API请求的基础函数
- [src/api/account.ts](mdc:src/api/account.ts): 账户管理相关API

## 数据模型

- `SongRequestInfo`: 点歌请求信息
- `DanmakuUserInfo`: 弹幕用户信息
- `EventModel`: 事件数据模型，用于处理弹幕、SC等事件
- `Setting_LiveRequest`: 点歌系统设置

## API请求类型

- `QueryGetAPI`: GET请求
- `QueryPostAPI`: POST请求
- `QueryPostAPIWithParams`: 带参数的POST请求

## 直播平台集成

系统集成了直播平台（如B站）的API，通过`useDanmakuClient()`获取直播间的弹幕、SC等数据。主要事件类型：

- `danmaku`: 弹幕事件
- `sc`: SuperChat事件

## 数据存储

系统使用`useStorage`进行本地数据存储，`useAccount`获取账户信息。远程数据通过API请求获取和更新。
