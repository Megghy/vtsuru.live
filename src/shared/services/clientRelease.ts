export type ClientPlatform = 'windows' | 'macos' | 'linux'
export type ClientArch = 'x64' | 'arm64' | 'universal'
export type ClientInstallerType = 'exe' | 'msi' | 'dmg' | 'appimage' | 'deb' | 'rpm'

export interface ClientReleaseAsset {
  name: string
  size: number
  sha256: string
  platform: ClientPlatform
  arch: ClientArch
  installerType: ClientInstallerType
  recommended: boolean
  url: string
  githubUrl: string
  proxyUrl?: string
}

export interface ClientReleaseManifest {
  version: string
  tag: string
  name: string
  publishedAt: string | null
  syncedAt: string | null
  notes: string
  releaseUrl: string
  assets: ClientReleaseAsset[]
}

export interface DetectedClientEnv {
  platform: ClientPlatform
  arch: ClientArch
  isMacUncertainArch: boolean
}

export const CLIENT_RELEASE_MANIFEST_URL = 'https://files.vtsuru.suki.club/client-downloads/release.json'
export const CLIENT_GITHUB_RELEASES_URL = 'https://github.com/Megghy/vtsuru-fetcher-client/releases/latest'
export const CLIENT_REPO_URL = 'https://github.com/Megghy/vtsuru-fetcher-client'
export const CLIENT_WEB_LOGIC_URL = 'https://github.com/Megghy/vtsuru.live/tree/master/src/apps/client'

export function detectClientEnvironmentSync(): DetectedClientEnv {
  if (typeof navigator === 'undefined') {
    return { platform: 'windows', arch: 'x64', isMacUncertainArch: false }
  }

  const ua = navigator.userAgent.toLowerCase()
  const navPlatform = (navigator.platform || '').toLowerCase()

  let platform: ClientPlatform = 'windows'
  if (navPlatform.includes('mac') || ua.includes('macintosh') || ua.includes('mac os')) {
    platform = 'macos'
  } else if (navPlatform.includes('linux') || (ua.includes('linux') && !ua.includes('android'))) {
    platform = 'linux'
  }

  let arch: ClientArch = 'x64'
  let isMacUncertainArch = false
  if (ua.includes('arm64') || ua.includes('aarch64')) {
    arch = 'arm64'
  } else if (platform === 'macos') {
    // Safari/Firefox 在 Apple Silicon 上同样暴露 MacIntel，无法同步区分架构
    arch = 'arm64'
    isMacUncertainArch = true
  }

  return { platform, arch, isMacUncertainArch }
}

export async function detectClientEnvironment(): Promise<DetectedClientEnv> {
  const base = detectClientEnvironmentSync()
  if (typeof navigator === 'undefined') return base

  const uaData = (
    navigator as Navigator & {
      userAgentData?: { getHighEntropyValues?: (hints: string[]) => Promise<{ architecture?: string }> }
    }
  ).userAgentData

  if (!uaData?.getHighEntropyValues) return base

  try {
    const info = await uaData.getHighEntropyValues(['architecture'])
    const archStr = (info.architecture || '').toLowerCase()
    if (archStr.includes('arm')) {
      return { ...base, arch: 'arm64', isMacUncertainArch: false }
    }
    if (archStr.includes('x86') || archStr.includes('amd64')) {
      return { ...base, arch: 'x64', isMacUncertainArch: false }
    }
  } catch {
    // 浏览器拒绝或不支持高熵提示时沿用同步判断
  }
  return base
}

export async function fetchClientRelease(): Promise<ClientReleaseManifest> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 10_000)

  try {
    const response = await fetch(CLIENT_RELEASE_MANIFEST_URL, {
      cache: 'no-cache',
      signal: controller.signal,
    })
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }
    const data = (await response.json()) as ClientReleaseManifest
    if (!data || !Array.isArray(data.assets) || data.assets.length === 0) {
      throw new Error('发行清单为空')
    }
    return data
  } finally {
    clearTimeout(timer)
  }
}

export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  let val = bytes
  let idx = 0
  while (val >= 1024 && idx < units.length - 1) {
    val /= 1024
    idx += 1
  }
  return `${val >= 100 || idx === 0 ? val.toFixed(0) : val.toFixed(1)} ${units[idx]}`
}

export function getPlatformLabel(platform: ClientPlatform): string {
  switch (platform) {
    case 'windows':
      return 'Windows'
    case 'macos':
      return 'macOS'
    case 'linux':
      return 'Linux'
  }
}

export function getArchLabel(arch: ClientArch): string {
  switch (arch) {
    case 'arm64':
      return 'ARM64 / Apple Silicon'
    case 'x64':
      return 'x64 (64 位)'
    case 'universal':
      return '通用'
  }
}

export function getInstallerLabel(asset: ClientReleaseAsset): string {
  switch (asset.installerType) {
    case 'exe':
      return 'Windows 安装程序 (.exe)'
    case 'msi':
      return 'MSI 企业安装包 (.msi)'
    case 'dmg':
      return asset.arch === 'arm64' ? 'Apple Silicon 镜像 (.dmg)' : 'Intel 芯片镜像 (.dmg)'
    case 'appimage':
      return '便携镜像 (.AppImage)'
    case 'deb':
      return 'Debian / Ubuntu (.deb)'
    case 'rpm':
      return 'Fedora / RHEL (.rpm)'
  }
}
