import type { DataConnection } from 'peerjs'
import Peer from 'peerjs'
import { useVTsuruHub } from '@/store/useVTsuruHub'

export interface ComponentsEventHubModel {
  IsMaster: boolean
  Token: string
}
export interface RTCData {
  Key: string
  Data: any
}

export abstract class BaseRTCClient {
  constructor(user: string, pass: string) {
    this.user = user
    this.pass = pass
  }

  protected user: string
  protected pass: string
  protected vhub = useVTsuruHub()

  public isInited = false

  public peer?: Peer

  protected connections: DataConnection[] = []
  protected handledEvents: { [key: string]: string[] } = {}

  protected events: {
    [key: string]: ((args: any) => void)[]
  } = {}

  abstract type: 'master' | 'slave'

  protected abstract connectRTC(): void
  protected abstract processData(conn: DataConnection, data: RTCData): void

  public on(eventName: string, listener: (args: any) => void) {
    eventName = eventName.toLowerCase()
    if (!this.events[eventName]) {
      this.events[eventName] = []
    }
    this.events[eventName].push(listener)

    this.send('VTsuru.RTCEvent.On', eventName)
  }

  public off(eventName: string, listener: (args: any) => void) {
    if (this.events[eventName]) {
      const index = this.events[eventName].indexOf(listener)
      if (index > -1) {
        this.events[eventName].splice(index, 1)
      }
    }

    this.send('VTsuru.RTCEvent.Off', eventName)
  }

  public send(eventName: string, data: any) {
    this.connections.forEach((item) => {
      if (item && item.open) {
        item.send({
          Key: eventName,
          Data: data,
        })
      }
    })
  }

  protected onConnectionClose(id: string) {
    this.connections = this.connections.filter(item => item && item.peer != id)
    delete this.handledEvents[id]

    console.log(
      `[Components-Event] <${this.connections.length}> ${this.type == 'master' ? 'Slave' : 'Master'} 下线: ${
        id}`,
    )
  }

  public async Init() {
    if (!this.isInited) {
      this.isInited = true
      await this.vhub.on('RTCOffline', (...args: unknown[]) => {
        const id = args[0] as string
        this.onConnectionClose(id)
      })
      this.connectRTC()
    }
    return this
  }
}

export class SlaveRTCClient extends BaseRTCClient {
  constructor(user: string, pass: string) {
    super(user, pass)
  }

  type: 'slave' = 'slave' as const

  protected async getAllRTC(): Promise<ComponentsEventHubModel[]> {
    return await this.vhub.invoke<ComponentsEventHubModel[]>('GetOnlineRTC') || []
  }

  public async connectToAllMaster() {
    const masters = (await this.getAllRTC()).filter(
      (item: ComponentsEventHubModel) =>
        item.IsMaster
        && item.Token != this.peer.id
        && !this.connections.some(conn => conn.peer == item.Token),
    )
    masters.forEach((item: ComponentsEventHubModel) => {
      this.connectToMaster(item.Token)
      // console.log('[Components-Event] 正在连接到现有 Master: ' + item.Token)
    })
  }

  public connectToMaster(id: string) {
    if (this.connections.some(conn => conn.peer == id)) return
    const c = this.peer?.connect(id)
    c?.on('open', () => {
      this.connections.push(c)

      this.handledEvents[id] = []

      console.log(
        `[Components-Event] <${this.connections.length}> ==> Master 连接已建立: ${
          id}`,
      )
    })
    c?.on('error', err => console.error(err))
    c?.on('data', data => this.processData(c, data as RTCData))
    c?.on('close', () => this.onConnectionClose(c.peer))
  }

  protected connectRTC(): void {
    this.peer = new Peer()
    this.peer.on('open', (id) => {
      console.log('[Components-Event] Slave Peer ID:', id)
      this.vhub.send('RegisterRTC', false, id)
    })
    this.peer.on('error', err => console.error('[Components-Event] Slave Peer Error:', err))
  }

  protected processData(conn: DataConnection, data: RTCData): void {
    if (data.Key === 'VTsuru.RTCEvent.On') {
      if (!this.handledEvents[conn.peer]) {
        this.handledEvents[conn.peer] = []
      }
      if (!this.handledEvents[conn.peer].includes(data.Data)) {
        this.handledEvents[conn.peer].push(data.Data)
      }
    } else if (data.Key === 'VTsuru.RTCEvent.Off') {
      if (this.handledEvents[conn.peer]) {
        const index = this.handledEvents[conn.peer].indexOf(data.Data)
        if (index > -1) {
          this.handledEvents[conn.peer].splice(index, 1)
        }
      }
    } else {
      const eventName = data.Key.toLowerCase()
      if (this.events[eventName]) {
        this.events[eventName].forEach(listener => listener(data.Data))
      }
    }
  }

  public async Init() {
    await super.Init()
    this.vhub?.on('MasterOnline', (...args: unknown[]) => {
      const data = args[0] as string
      this.connectToMaster(data)
    })
    setTimeout(() => {
      this.connectToAllMaster()
    }, 500)
    setInterval(() => {
      this.connectToAllMaster()
    }, 30000)

    return this
  }
}
export class MasterRTCClient extends BaseRTCClient {
  constructor(user: string, pass: string) {
    super(user, pass)
  }

  type: 'master' = 'master' as const

  protected connectRTC(): void {
    this.peer?.on('connection', (conn) => {
      conn.on('open', () => {
        this.connections.push(conn)
        this.handledEvents[conn.peer] = []
        console.log(
          `[Components-Event] <${this.connections.length}> Slave 上线: ${
            conn.peer}`,
        )
      })
      conn.on('data', d => this.processData(conn, d as RTCData))
      conn.on('error', err => console.error(err))
      conn.on('close', () => this.onConnectionClose(conn.peer))
    })

    this.peer = new Peer()
    this.peer.on('open', (id) => {
      console.log('[Components-Event] Master Peer ID:', id)
      this.vhub.send('RegisterRTC', true, id)
    })
    this.peer.on('error', err => console.error('[Components-Event] Master Peer Error:', err))
  }

  protected processData(conn: DataConnection, data: RTCData): void {
    if (data.Key === 'VTsuru.RTCEvent.On') {
      if (!this.handledEvents[conn.peer]) {
        this.handledEvents[conn.peer] = []
      }
      if (!this.handledEvents[conn.peer].includes(data.Data)) {
        this.handledEvents[conn.peer].push(data.Data)
      }
    } else if (data.Key === 'VTsuru.RTCEvent.Off') {
      if (this.handledEvents[conn.peer]) {
        const index = this.handledEvents[conn.peer].indexOf(data.Data)
        if (index > -1) {
          this.handledEvents[conn.peer].splice(index, 1)
        }
      }
    } else {
      if (this.handledEvents[conn.peer]?.includes(data.Key.toLowerCase())) {
        conn.send(data)
      }
    }
  }

  public async Init() {
    return super.Init()
  }
}
