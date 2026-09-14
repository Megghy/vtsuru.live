/**
 * 弹幕机样式预设定义 (单一真源)
 */

export interface DanmujiPreset {
  id: 'glass' | 'minimal' | 'anime' | 'transparent'
  name: string
  description: string
  css: string
}

// 基础透明骨架
const baseResetCss = `/* 基础透明与排版重置 */
yt-live-chat-renderer { background-color: transparent !important; }
yt-live-chat-ticker-renderer { background-color: transparent !important; box-shadow: none !important; }
yt-live-chat-author-chip #author-name { background-color: transparent !important; }
yt-live-chat-item-list-renderer #item-scroller { overflow: hidden !important; }
yt-live-chat-interact-message-renderer #content,
yt-live-chat-text-message-renderer #content,
yt-live-chat-membership-item-renderer #content { overflow: visible !important; }
yt-live-chat-header-renderer, yt-live-chat-message-input-renderer { display: none !important; }
yt-live-chat-interact-message-renderer[is-deleted],
yt-live-chat-text-message-renderer[is-deleted],
yt-live-chat-membership-item-renderer[is-deleted],
yt-live-chat-mode-change-message-renderer,
yt-live-chat-viewer-engagement-message-renderer,
yt-live-chat-restricted-participation-renderer { display: none !important; }
yt-live-chat-text-message-renderer a, yt-live-chat-membership-item-renderer a { text-decoration: none !important; }
`

export const DANMUJI_PRESETS: DanmujiPreset[] = [
  {
    id: 'glass',
    name: '毛玻璃气泡 (Modern Glass)',
    description: '现代半透明毛玻璃气泡，精致边框与柔和投影，适合各种游戏与杂谈直播',
    css: `${baseResetCss}
/* 毛玻璃气泡卡片风格 */
yt-live-chat-renderer * {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Microsoft YaHei", sans-serif;
}

yt-live-chat-text-message-renderer,
yt-live-chat-interact-message-renderer {
  background: rgba(15, 23, 42, 0.78) !important;
  backdrop-filter: blur(16px) !important;
  -webkit-backdrop-filter: blur(16px) !important;
  border: 1px solid rgba(255, 255, 255, 0.12) !important;
  border-radius: 12px !important;
  margin: 6px 4px !important;
  padding: 8px 12px !important;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4) !important;
  animation: danmaku-slide-in 0.3s cubic-bezier(0.16, 1, 0.3, 1) !important;
}

yt-live-chat-paid-message-renderer {
  border-radius: 12px !important;
  margin: 8px 4px !important;
  box-shadow: 0 6px 20px rgba(245, 158, 11, 0.3) !important;
  animation: danmaku-slide-in 0.3s cubic-bezier(0.16, 1, 0.3, 1) !important;
}

yt-live-chat-text-message-renderer #author-photo,
yt-live-chat-interact-message-renderer #author-photo {
  width: 26px !important;
  height: 26px !important;
  border-radius: 50% !important;
  border: 1.5px solid rgba(255, 255, 255, 0.3) !important;
  margin-right: 8px !important;
}

#author-name {
  color: #93c5fd !important;
  font-size: 14px !important;
  font-weight: 700 !important;
}

#message {
  color: #f8fafc !important;
  font-size: 15px !important;
  line-height: 1.4 !important;
}

@keyframes danmaku-slide-in {
  from { opacity: 0; transform: translateY(10px) scale(0.96); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}
`,
  },
  {
    id: 'transparent',
    name: '纯透明无底壳 (Transparent Overlay)',
    description: '去除任何背景容器，强化文字描边与发光阴影，专为主播贴自定义直播底框素材',
    css: `${baseResetCss}
/* 纯透明文字流 (主播素材专用) */
yt-live-chat-renderer * {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Microsoft YaHei", sans-serif;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.95), 0 0 8px rgba(0, 0, 0, 0.8), -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000 !important;
}

yt-live-chat-text-message-renderer,
yt-live-chat-interact-message-renderer {
  background: transparent !important;
  border: none !important;
  box-shadow: none !important;
  padding: 4px 2px !important;
  margin: 2px 0 !important;
}

yt-live-chat-text-message-renderer #author-photo,
yt-live-chat-interact-message-renderer #author-photo {
  width: 24px !important;
  height: 24px !important;
  border-radius: 50% !important;
  border: 1px solid rgba(255, 255, 255, 0.6) !important;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.6) !important;
  margin-right: 6px !important;
}

#author-name {
  color: #67e8f9 !important;
  font-size: 15px !important;
  font-weight: 800 !important;
}

#message {
  color: #ffffff !important;
  font-size: 16px !important;
  font-weight: 600 !important;
  line-height: 1.35 !important;
}
`,
  },
  {
    id: 'minimal',
    name: '极简通透字幕 (Minimal Text)',
    description: '极窄边框与微透底色，信息紧凑，高屏效',
    css: `${baseResetCss}
/* 极简通透字幕流 */
yt-live-chat-renderer * {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Microsoft YaHei", sans-serif;
}

yt-live-chat-text-message-renderer,
yt-live-chat-interact-message-renderer {
  background: rgba(0, 0, 0, 0.5) !important;
  backdrop-filter: blur(8px) !important;
  border-left: 3px solid #38bdf8 !important;
  border-radius: 0 6px 6px 0 !important;
  margin: 3px 0 !important;
  padding: 4px 8px !important;
}

#author-name {
  color: #7dd3fc !important;
  font-size: 13px !important;
  font-weight: 700 !important;
}

#message {
  color: #f1f5f9 !important;
  font-size: 14px !important;
}
`,
  },
  {
    id: 'anime',
    name: '二次元圆角气泡 (Anime Bubble)',
    description: '高饱和度活泼色调、圆润气泡感、适合二次元/VTuber 视觉风格',
    css: `${baseResetCss}
/* 二次元活泼气泡 */
yt-live-chat-renderer * {
  font-family: "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
}

yt-live-chat-text-message-renderer,
yt-live-chat-interact-message-renderer {
  background: rgba(255, 255, 255, 0.92) !important;
  border: 2px solid #fda4af !important;
  border-radius: 16px !important;
  margin: 6px 4px !important;
  padding: 8px 12px !important;
  box-shadow: 0 4px 12px rgba(244, 63, 94, 0.15) !important;
}

yt-live-chat-text-message-renderer #author-photo {
  width: 28px !important;
  height: 28px !important;
  border-radius: 50% !important;
  border: 2px solid #f43f5e !important;
  margin-right: 8px !important;
}

#author-name {
  color: #e11d48 !important;
  font-size: 14px !important;
  font-weight: 800 !important;
}

#message {
  color: #334155 !important;
  font-size: 15px !important;
  font-weight: 600 !important;
}
`,
  },
]

export const defaultDanmujiCss = DANMUJI_PRESETS[0].css
