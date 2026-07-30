export class AudioFrameBuffer {
  private pending = new Uint8Array(0)

  constructor(
    private readonly frameSize: number,
    private readonly emit: (frame: Uint8Array) => void,
  ) {}

  append(chunk: Uint8Array) {
    const joined = new Uint8Array(this.pending.length + chunk.length)
    joined.set(this.pending)
    joined.set(chunk, this.pending.length)
    let offset = 0
    while (joined.length - offset >= this.frameSize) {
      this.emit(joined.slice(offset, offset + this.frameSize))
      offset += this.frameSize
    }
    this.pending = joined.slice(offset)
  }

  clear() {
    this.pending = new Uint8Array(0)
  }
}

export function pcmFrameSize(sampleRate: number) {
  return (sampleRate * 2) / 5
}

export function toBase64(bytes: Uint8Array) {
  let binary = ''
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000))
  }
  return btoa(binary)
}
