import { startHeartbeat } from '@/apps/client/services/heartbeat'

// 先启动本地保活，再加载业务模块；业务加载失败时主窗口仍能保持响应。
startHeartbeat()
void import('./main')
