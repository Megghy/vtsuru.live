---
inclusion: manual
---
# 点歌系统

点歌系统是主要功能之一，允许观众在直播过程中通过弹幕、SuperChat或网页界面请求歌曲。

## 主要文件

- [src/views/open_live/LiveRequest.vue](mdc:src/views/open_live/LiveRequest.vue): 点歌系统的主要界面组件
- [src/views/obs/LiveRequestOBS.vue](mdc:src/views/obs/LiveRequestOBS.vue): 用于OBS的点歌系统显示组件

## 主要功能

- 支持多种点歌方式：弹幕、SuperChat、网页、手动添加
- 歌曲队列管理：等待、演唱中、已完成、已取消等状态管理
- 权限控制：可配置只允许舰长、提督、总督或粉丝牌用户点歌
- 冷却时间：可设置不同用户类型的点歌冷却时间
- OBS集成：提供适用于OBS的显示组件，可展示当前点歌队列
- 黑名单：可将特定用户加入黑名单

## 数据流

1. 接收来自直播平台的弹幕或SuperChat
2. 通过前缀识别点歌请求（如"点播"）
3. 根据规则验证请求是否有效
4. 将有效请求添加到点歌队列
5. 主播可以管理队列：开始演唱、标记完成、取消请求等
