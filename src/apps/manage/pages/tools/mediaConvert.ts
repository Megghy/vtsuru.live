// 音视频转换工具的纯逻辑：格式定义、预设、ffmpeg 命令构建。无副作用、无 Vue 依赖。

export type OutputFormat = 'mp4' | 'webm' | 'gif' | 'mp3' | 'm4a' | 'ogg' | 'opus' | 'wav'
export type OutputKind = 'video' | 'gif' | 'audio'
export type ChannelMode = 'keep' | 'mono' | 'stereo'
export type VideoCodec = 'h264' | 'h265'
export type RateMode = 'crf' | 'targetSize'
export type Rotate = 0 | 90 | 180 | 270

export interface FormatDef {
  value: OutputFormat
  label: string
  kind: OutputKind
  mime: string
}

export const formats: FormatDef[] = [
  { value: 'mp4', label: 'MP4 视频 (H.264/H.265)', kind: 'video', mime: 'video/mp4' },
  { value: 'webm', label: 'WebM 视频 (VP9/Opus)', kind: 'video', mime: 'video/webm' },
  { value: 'gif', label: 'GIF 动图', kind: 'gif', mime: 'image/gif' },
  { value: 'mp3', label: 'MP3 音频', kind: 'audio', mime: 'audio/mpeg' },
  { value: 'm4a', label: 'M4A 音频 (AAC)', kind: 'audio', mime: 'audio/mp4' },
  { value: 'ogg', label: 'OGG 音频 (Vorbis)', kind: 'audio', mime: 'audio/ogg' },
  { value: 'opus', label: 'Opus 音频', kind: 'audio', mime: 'audio/ogg' },
  { value: 'wav', label: 'WAV 音频 (无损)', kind: 'audio', mime: 'audio/wav' },
]

export const formatMap = new Map(formats.map(f => [f.value, f]))

export interface ConvertSettings {
  format: OutputFormat
  // 视频编码
  videoCodec: VideoCodec
  videoPreset: string
  rateMode: RateMode
  videoCrf: number
  targetSizeMb: number
  videoMaxWidth: number | null
  videoFps: number | null
  // 画面处理
  rotate: Rotate
  flipH: boolean
  flipV: boolean
  brightness: number
  contrast: number
  saturation: number
  sharpen: boolean
  deinterlace: boolean
  // 速度
  speed: number
  videoFadeIn: number
  videoFadeOut: number
  // 音频
  audioBitrate: number
  sampleRate: number | null
  channelMode: ChannelMode
  volume: number
  loudnorm: boolean
  audioFadeIn: number
  audioFadeOut: number
  highpass: number | null
  lowpass: number | null
  // GIF
  gifFps: number
  gifWidth: number
  gifLoop: boolean
  keepMetadata: boolean
}

export function defaultSettings(): ConvertSettings {
  return {
    format: 'mp4',
    videoCodec: 'h264',
    videoPreset: 'medium',
    rateMode: 'crf',
    videoCrf: 28,
    targetSizeMb: 10,
    videoMaxWidth: 1280,
    videoFps: null,
    rotate: 0,
    flipH: false,
    flipV: false,
    brightness: 0,
    contrast: 1,
    saturation: 1,
    sharpen: false,
    deinterlace: false,
    speed: 1,
    videoFadeIn: 0,
    videoFadeOut: 0,
    audioBitrate: 128,
    sampleRate: null,
    channelMode: 'keep',
    volume: 100,
    loudnorm: false,
    audioFadeIn: 0,
    audioFadeOut: 0,
    highpass: null,
    lowpass: null,
    gifFps: 15,
    gifWidth: 480,
    gifLoop: true,
    keepMetadata: false,
  }
}

export interface Preset {
  key: string
  label: string
  desc: string
  patch: Partial<ConvertSettings>
}

// 预设只覆盖关键参数，其余沿用当前设置。需要源为视频的预设标 videoOnly。
export const presets: (Preset & { videoOnly?: boolean })[] = [
  { key: 'compress', label: '压到最小', desc: 'H.264 高压缩，限制 720p', videoOnly: true, patch: { format: 'mp4', videoCrf: 30, videoMaxWidth: 1280, videoFps: 30, audioBitrate: 96 } },
  { key: 'mp3', label: '提取 MP3', desc: '从视频/音频提取 192k 音轨', patch: { format: 'mp3', audioBitrate: 192, keepMetadata: true } },
  { key: 'gif', label: '转 GIF', desc: '480px / 15fps 动图', videoOnly: true, patch: { format: 'gif', gifWidth: 480, gifFps: 15, gifLoop: true } },
  { key: 'normalize', label: '响度标准化', desc: '统一音量，转 M4A', patch: { format: 'm4a', loudnorm: true, volume: 100, audioBitrate: 192 } },
]

export interface TrimRange {
  start: number | null
  end: number | null
}

// 一次转换可能需要多条命令（GIF 两遍调色板），按顺序执行。
export interface CommandStep {
  args: string[]
}

function trimArgs(trim: TrimRange): { pre: string[], post: string[] } {
  const start = positive(trim.start)
  const end = positive(trim.end)
  return {
    pre: start ? ['-ss', String(start)] : [],
    post: end > start ? ['-t', String(end - start)] : [],
  }
}

// 截取/倍速后的有效输出时长，用于目标体积码率计算和淡出定位。
function effectiveDuration(srcDuration: number, trim: TrimRange, speed: number): number {
  const start = positive(trim.start)
  const end = positive(trim.end)
  const span = end > start ? end - start : srcDuration - start
  return Math.max(0.1, span / (speed || 1))
}

// atempo 单次仅支持 0.5~2.0，超出范围串联多段。
function atempoChain(speed: number): string[] {
  const steps: string[] = []
  let remaining = speed
  while (remaining > 2) { steps.push('atempo=2.0'); remaining /= 2 }
  while (remaining < 0.5) { steps.push('atempo=0.5'); remaining *= 2 }
  if (Math.abs(remaining - 1) > 0.001) steps.push(`atempo=${remaining.toFixed(3)}`)
  return steps
}

function audioFilterChain(s: ConvertSettings, outDuration: number): string[] {
  const f: string[] = []
  if (s.speed !== 1) f.push(...atempoChain(s.speed))
  if (s.highpass) f.push(`highpass=f=${s.highpass}`)
  if (s.lowpass) f.push(`lowpass=f=${s.lowpass}`)
  if (s.loudnorm) f.push('loudnorm')
  else if (s.volume !== 100) f.push(`volume=${(s.volume / 100).toFixed(2)}`)
  if (s.audioFadeIn > 0) f.push(`afade=t=in:st=0:d=${s.audioFadeIn}`)
  if (s.audioFadeOut > 0) f.push(`afade=t=out:st=${Math.max(0, outDuration - s.audioFadeOut).toFixed(2)}:d=${s.audioFadeOut}`)
  return f
}

function videoFilterChain(s: ConvertSettings, width: number | null, fps: number | null, outDuration: number): string[] {
  const f: string[] = []
  if (s.deinterlace) f.push('yadif')
  if (width) f.push(`scale='min(${width},iw)':-2`)
  if (fps) f.push(`fps=${fps}`)
  if (s.speed !== 1) f.push(`setpts=${(1 / s.speed).toFixed(4)}*PTS`)
  if (s.rotate === 90) f.push('transpose=1')
  else if (s.rotate === 270) f.push('transpose=2')
  else if (s.rotate === 180) f.push('transpose=1,transpose=1')
  if (s.flipH) f.push('hflip')
  if (s.flipV) f.push('vflip')
  if (s.brightness !== 0 || s.contrast !== 1 || s.saturation !== 1)
    f.push(`eq=brightness=${s.brightness}:contrast=${s.contrast}:saturation=${s.saturation}`)
  if (s.sharpen) f.push('unsharp=5:5:1.0')
  if (s.videoFadeIn > 0) f.push(`fade=t=in:st=0:d=${s.videoFadeIn}`)
  if (s.videoFadeOut > 0) f.push(`fade=t=out:st=${Math.max(0, outDuration - s.videoFadeOut).toFixed(2)}:d=${s.videoFadeOut}`)
  return f
}

function applyAudioCodec(args: string[], s: ConvertSettings, outDuration: number) {
  if (s.format === 'mp3') args.push('-c:a', 'libmp3lame')
  else if (s.format === 'm4a' || s.format === 'mp4') args.push('-c:a', 'aac')
  else if (s.format === 'ogg') args.push('-c:a', 'libvorbis')
  else if (s.format === 'opus' || s.format === 'webm') args.push('-c:a', 'libopus')
  else if (s.format === 'wav') args.push('-c:a', 'pcm_s16le')

  if (s.format !== 'wav') args.push('-b:a', `${s.audioBitrate}k`)
  if (s.sampleRate) args.push('-ar', String(s.sampleRate))
  if (s.channelMode === 'mono') args.push('-ac', '1')
  if (s.channelMode === 'stereo') args.push('-ac', '2')

  const af = audioFilterChain(s, outDuration)
  if (af.length) args.push('-af', af.join(','))
}

// 目标体积 → 视频码率(kbps)：扣除音频占用，留 3% 容器余量。
function targetVideoBitrate(s: ConvertSettings, outDuration: number): number {
  const totalKbit = s.targetSizeMb * 8192
  const audioKbit = s.format === 'wav' ? 0 : s.audioBitrate * outDuration
  const videoKbit = (totalKbit - audioKbit) * 0.97
  return Math.max(64, Math.round(videoKbit / outDuration))
}

function applyVideoCodec(args: string[], s: ConvertSettings, outDuration: number) {
  if (s.format === 'webm') {
    args.push('-c:v', 'libvpx-vp9')
    if (s.rateMode === 'targetSize') args.push('-b:v', `${targetVideoBitrate(s, outDuration)}k`)
    else args.push('-crf', String(s.videoCrf), '-b:v', '0')
    return
  }
  args.push('-c:v', s.videoCodec === 'h265' ? 'libx265' : 'libx264', '-preset', s.videoPreset, '-pix_fmt', 'yuv420p', '-movflags', '+faststart')
  if (s.rateMode === 'targetSize') args.push('-b:v', `${targetVideoBitrate(s, outDuration)}k`)
  else args.push('-crf', String(s.videoCrf))
}

export function buildCommands(input: string, output: string, s: ConvertSettings, trim: TrimRange, srcDuration: number): CommandStep[] {
  const fmt = formatMap.get(s.format)
  const { pre, post } = trimArgs(trim)
  const meta = s.keepMetadata ? [] : ['-map_metadata', '-1']
  const outDuration = effectiveDuration(srcDuration, trim, s.speed)

  if (fmt.kind === 'gif') {
    const extra = videoFilterChain({ ...s, videoFadeIn: 0, videoFadeOut: 0 }, null, null, outDuration)
      .filter(x => !x.startsWith('scale') && !x.startsWith('fps'))
    const base = `fps=${s.gifFps},scale=${s.gifWidth}:-1:flags=lanczos`
    const chain = [base, ...extra].join(',')
    const palette = 'palette.png'
    return [
      { args: [...pre, '-i', input, ...post, '-vf', `${chain},palettegen=stats_mode=diff`, '-y', palette] },
      { args: [...pre, '-i', input, ...post, '-i', palette, '-lavfi', `${chain}[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=3`, '-loop', s.gifLoop ? '0' : '-1', '-y', output] },
    ]
  }

  const args = [...pre, '-i', input, ...post, ...meta]
  if (fmt.kind === 'audio') {
    args.push('-vn')
    applyAudioCodec(args, s, outDuration)
  } else {
    args.push('-map', '0:v:0', '-map', '0:a?')
    const vf = videoFilterChain(s, s.videoMaxWidth, s.videoFps, outDuration)
    if (vf.length) args.push('-vf', vf.join(','))
    applyVideoCodec(args, s, outDuration)
    applyAudioCodec(args, s, outDuration)
  }
  args.push('-y', output)
  return [{ args }]
}

export function positive(value: number | null): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0
}
