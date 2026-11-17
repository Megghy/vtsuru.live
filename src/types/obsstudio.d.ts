export interface ObsStudioScene {
  name: string
  width: number
  height: number
}

export interface ObsStudioStatus {
  recording: boolean
  recordingPaused: boolean
  streaming: boolean
  replaybuffer: boolean
  virtualcam: boolean
}

export interface ObsStudioApi {
  pluginVersion?: string
  onVisibilityChange?: (visibility: boolean) => void
  onActiveChange?: (active: boolean) => void
  getCurrentScene?: (callback: (scene: ObsStudioScene) => void) => void
  getControlLevel?: (callback: (level: number) => void) => void
  getStatus?: (callback: (status: ObsStudioStatus) => void) => void
  setCurrentScene?: (sceneName: string) => void
  saveReplayBuffer?: () => void
  startRecording?: () => void
  stopRecording?: () => void
  pauseRecording?: () => void
  unpauseRecording?: () => void
  startStreaming?: () => void
  stopStreaming?: () => void
  startReplayBuffer?: () => void
  stopReplayBuffer?: () => void
  startVirtualcam?: () => void
  stopVirtualcam?: () => void
}

declare global {
  interface Window {
    obsstudio?: ObsStudioApi
  }
}
