// 基于 WebCodecs (mediabunny) 的硬件加速转换引擎。
// 不支持的格式、滤镜或编码器会自动返回 null，由调用方无缝回退到 FFmpeg WASM。

import {
  ALL_FORMATS,
  type AudioCodec,
  BlobSource,
  BufferTarget,
  canEncodeAudio,
  canEncodeVideo,
  Conversion,
  ConversionCanceledError,
  type ConversionAudioOptions,
  type ConversionVideoOptions,
  Input,
  type InputAudioTrack,
  type InputVideoTrack,
  Mp4OutputFormat,
  OggOutputFormat,
  Output,
  type OutputFormat,
  Quality,
  type Rotation,
  UnsupportedInputFormatError,
  type VideoCodec as MbVideoCodec,
  WavOutputFormat,
  WebMOutputFormat,
} from 'mediabunny'

import {
  canStreamCopy,
  type ConvertSettings,
  effectiveDuration,
  formatMap,
  type OutputFormat as AppOutputFormat,
  positive,
  targetVideoBitrate,
  type TrimRange,
} from './mediaConvert'

export type ConvertEngine = 'webcodecs-hw' | 'webcodecs-sw' | 'webcodecs-copy' | 'ffmpeg'

export type AccelerationCapability = 'hardware' | 'software' | 'none'

export interface WebCodecsResult {
  blob: Blob
  engine: Exclude<ConvertEngine, 'ffmpeg'>
}

export interface WebCodecsTask {
  promise: Promise<WebCodecsResult | null>
  cancel: () => Promise<void>
}

export interface WebCodecsRunOptions {
  file: File
  settings: ConvertSettings
  trim: TrimRange
  srcDuration: number
  onProgress?: (progress: number) => void
}

const AAC_STANDARD_BITRATES = [96_000, 128_000, 160_000, 192_000]

export function isWebCodecsAvailable(): boolean {
  return typeof VideoEncoder !== 'undefined' && typeof VideoDecoder !== 'undefined'
}

export async function detectAccelerationCapability(): Promise<AccelerationCapability> {
  if (!isWebCodecsAvailable()) return 'none'
  const probe = { width: 1280, height: 720, quality: new Quality(0.5) }
  if (await canEncodeVideo('avc', { ...probe, hardwareAcceleration: 'prefer-hardware' })) {
    return 'hardware'
  }
  if (await canEncodeVideo('avc', { ...probe, hardwareAcceleration: 'no-preference' })) {
    return 'software'
  }
  return 'none'
}

/**
 * 返回需要回退 FFmpeg 的原因；返回 null 表示当前参数可由 WebCodecs 加速执行。
 */
export function getWebCodecsFallbackReason(s: ConvertSettings): string | null {
  if (!isWebCodecsAvailable()) return '当前浏览器不支持 WebCodecs'
  if (s.format === 'gif') return 'GIF 调色板编码由 FFmpeg 处理'
  if (s.format === 'mp3') return 'MP3 编码由 FFmpeg 处理'
  if (s.speed !== 1) return '倍速音画同步由 FFmpeg 处理'
  if (s.brightness !== 0 || s.contrast !== 1 || s.saturation !== 1) return '画面调色由 FFmpeg 处理'
  if (s.sharpen || s.deinterlace) return '锐化/去隔行滤镜由 FFmpeg 处理'
  if (s.videoFadeIn > 0 || s.videoFadeOut > 0) return '画面淡入淡出由 FFmpeg 处理'
  if (s.loudnorm || s.volume !== 100 || s.audioFadeIn > 0 || s.audioFadeOut > 0) {
    return '音频增益/淡入淡出由 FFmpeg 处理'
  }
  if (s.highpass !== null || s.lowpass !== null) return '音频滤波由 FFmpeg 处理'
  return null
}

function createOutputFormat(format: AppOutputFormat): OutputFormat | null {
  switch (format) {
    case 'mp4':
    case 'm4a':
      return new Mp4OutputFormat({ fastStart: 'in-memory' })
    case 'webm':
      return new WebMOutputFormat()
    case 'ogg':
    case 'opus':
      return new OggOutputFormat()
    case 'wav':
      return new WavOutputFormat()
    default:
      return null
  }
}

function targetAudioCodec(format: AppOutputFormat): AudioCodec {
  if (format === 'mp4' || format === 'm4a') return 'aac'
  if (format === 'webm' || format === 'opus') return 'opus'
  if (format === 'ogg') return 'vorbis'
  return 'pcm-s16'
}

// CRF 18（高画质）~ 36（高压缩）线性映射到 Mediabunny 0.85 ~ 0.05 质量区间
function crfToQuality(crf: number): number {
  const normalized = 0.85 - ((crf - 18) / (36 - 18)) * 0.8
  return Math.max(0.05, Math.min(0.95, normalized))
}

function toEven(n: number): number {
  return Math.max(2, Math.floor(n / 2) * 2)
}

async function resolveAudioQuality(
  codec: AudioCodec,
  bitrateKbps: number,
  numberOfChannels: number,
  sampleRate: number,
): Promise<Quality | undefined> {
  if (codec === 'pcm-s16') return undefined
  const targetBps = bitrateKbps * 1000
  if (codec !== 'aac') return new Quality({ bitrate: targetBps })

  const direct = new Quality({ bitrate: targetBps })
  if (await canEncodeAudio('aac', { numberOfChannels, sampleRate, quality: direct })) {
    return direct
  }

  // 部分系统 AAC 编码器仅接受标准码率档位，挑最接近的可用档位避免整条视频回退软编
  const sorted = AAC_STANDARD_BITRATES.toSorted((a, b) => Math.abs(a - targetBps) - Math.abs(b - targetBps))
  for (const bps of sorted) {
    const candidate = new Quality({ bitrate: bps })
    if (await canEncodeAudio('aac', { numberOfChannels, sampleRate, quality: candidate })) {
      return candidate
    }
  }
  return direct
}

function hasBlockingDiscard(conversion: Conversion): boolean {
  return conversion.discardedTracks.some(
    (d) => d.reason !== 'discarded_by_user' && d.reason !== 'max_track_count_of_type_reached',
  )
}

function buildTrimOption(trim: TrimRange): { start?: number; end?: number } | undefined {
  const start = positive(trim.start)
  const end = positive(trim.end)
  if (!start && end <= start) return undefined
  return {
    start: start || undefined,
    end: end > start ? end : undefined,
  }
}

export function startWebCodecsConvert(options: WebCodecsRunOptions): WebCodecsTask {
  let activeConversion: Conversion | null = null
  let canceled = false

  const cancel = async () => {
    canceled = true
    if (activeConversion) await activeConversion.cancel()
  }

  const promise = (async (): Promise<WebCodecsResult | null> => {
    const { file, settings, trim, srcDuration, onProgress } = options
    if (getWebCodecsFallbackReason(settings) !== null) return null

    const fmt = formatMap.get(settings.format)
    if (!fmt || !createOutputFormat(settings.format)) return null

    const input = new Input({
      source: new BlobSource(file),
      formats: ALL_FORMATS,
    })

    try {
      const trimOpt = buildTrimOption(trim)
      const tagsOpt = settings.keepMetadata ? undefined : {}

      // 优先尝试无损流拷贝快路径（不重编码）
      if (canStreamCopy(settings)) {
        const copyTarget = new BufferTarget()
        const copyOutput = new Output({ format: createOutputFormat(settings.format)!, target: copyTarget })
        const copyConv = await Conversion.init({
          input,
          output: copyOutput,
          tracks: 'primary',
          trim: trimOpt,
          tags: tagsOpt,
          copy: { mode: 'forced' },
          showWarnings: false,
        })
        if (copyConv.isValid && !hasBlockingDiscard(copyConv)) {
          if (canceled) throw new ConversionCanceledError()
          activeConversion = copyConv
          copyConv.onProgress = (p) => onProgress?.(p)
          await copyConv.execute()
          if (!copyTarget.buffer) return null
          return {
            blob: new Blob([copyTarget.buffer], { type: fmt.mime }),
            engine: 'webcodecs-copy',
          }
        }
      }

      const outDuration = effectiveDuration(srcDuration, trim, settings.speed)
      let usedHardwareVideo = false
      let encodedVideo = false

      const videoOption =
        fmt.kind === 'audio'
          ? ({ discard: true } satisfies ConversionVideoOptions)
          : async (track: InputVideoTrack): Promise<ConversionVideoOptions> => {
              const codec: MbVideoCodec =
                settings.format === 'webm' ? 'vp9' : settings.videoCodec === 'h265' ? 'hevc' : 'avc'
              const rotate: Rotation = settings.flipV ? (((settings.rotate + 180) % 360) as Rotation) : settings.rotate
              const flip = settings.flipV ? !settings.flipH : settings.flipH

              const [trackDisplayW, trackDisplayH] = await Promise.all([
                track.getDisplayWidth(),
                track.getDisplayHeight(),
              ])
              const swapped = rotate === 90 || rotate === 270
              const baseW = swapped ? trackDisplayH : trackDisplayW
              const baseH = swapped ? trackDisplayW : trackDisplayH
              const shouldScale = settings.videoMaxWidth !== null && baseW > settings.videoMaxWidth
              const width = shouldScale ? toEven(settings.videoMaxWidth!) : baseW % 2 !== 0 ? toEven(baseW) : undefined
              const probeW = width ?? toEven(baseW)
              const probeH = width ? toEven((baseH * width) / baseW) : toEven(baseH)

              const quality =
                settings.rateMode === 'targetSize'
                  ? new Quality({ bitrate: targetVideoBitrate(settings, outDuration) * 1000 })
                  : new Quality(crfToQuality(settings.videoCrf))

              const hwSupported = await canEncodeVideo(codec, {
                width: probeW,
                height: probeH,
                quality,
                frameRate: settings.videoFps ?? undefined,
                hardwareAcceleration: 'prefer-hardware',
              })
              encodedVideo = true
              usedHardwareVideo = hwSupported

              return {
                codec,
                width,
                frameRate: settings.videoFps ?? undefined,
                rotate,
                flip,
                allowTransformationMetadata: false,
                quality,
                hardwareAcceleration: hwSupported ? 'prefer-hardware' : 'no-preference',
                forceTranscode: true,
              }
            }

      const audioOption = async (track: InputAudioTrack): Promise<ConversionAudioOptions> => {
        const codec = targetAudioCodec(settings.format)
        const numberOfChannels = settings.channelMode === 'mono' ? 1 : settings.channelMode === 'stereo' ? 2 : undefined
        const sampleRate = settings.sampleRate ?? undefined
        const [srcChannels, srcSampleRate] = await Promise.all([track.getNumberOfChannels(), track.getSampleRate()])
        const quality = await resolveAudioQuality(
          codec,
          settings.audioBitrate,
          numberOfChannels ?? srcChannels,
          sampleRate ?? srcSampleRate,
        )
        return {
          codec,
          numberOfChannels,
          sampleRate,
          quality,
          forceTranscode: codec === 'pcm-s16' || quality !== undefined,
        }
      }

      const target = new BufferTarget()
      const output = new Output({ format: createOutputFormat(settings.format)!, target })
      const conversion = await Conversion.init({
        input,
        output,
        tracks: 'primary',
        video: videoOption,
        audio: audioOption,
        trim: trimOpt,
        tags: tagsOpt,
        showWarnings: false,
      })

      if (!conversion.isValid || hasBlockingDiscard(conversion)) return null
      if (canceled) throw new ConversionCanceledError()

      activeConversion = conversion
      conversion.onProgress = (p) => onProgress?.(p)
      await conversion.execute()

      if (!target.buffer) return null
      return {
        blob: new Blob([target.buffer], { type: fmt.mime }),
        engine: encodedVideo && usedHardwareVideo ? 'webcodecs-hw' : 'webcodecs-sw',
      }
    } catch (error) {
      if (error instanceof ConversionCanceledError || canceled) throw error
      if (error instanceof UnsupportedInputFormatError) return null
      // 浏览器解码/硬编在运行阶段拒收罕见编码配置时回退 FFmpeg
      console.warn('[MediaConvert] WebCodecs 回退 FFmpeg：', error)
      return null
    } finally {
      activeConversion = null
      input.dispose()
    }
  })()

  return { promise, cancel }
}
