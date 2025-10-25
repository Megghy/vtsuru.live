import { useAccount } from '@/api/account'
import { useVTsuruHub } from '@/store/useVTsuruHub'
import Peer, { DataConnection } from 'peerjs'

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
    const payload = { Key: eventName, Data: data }
    this.connections.forEach((item) => {
      if (item && item.open) {
        item.send(payload)
      }
    })
  }

  protected connectRTC() {
    //console.log('[Components-Event] 正在连接到 PeerJS 服务器...')
    this.peer = new Peer({
      host: 'peer.suki.club',
      port: 443,
      key: 'vtsuru',
      secure: true,
      config: {
        iceServers: [
          { urls: ['stun:turn.suki.club'] },
          {
            urls: ['turn:turn.suki.club'],
            username: this.user,
            credential: this.pass
          }
        ]
      }
      //debug: 3
    })

    this.peer?.on('open', async (id) => {
      console.log('[Components-Event] 已连接到 PeerJS 服务器: ' + id)
      this.vhub?.send('SetRTCToken', id, this.type == 'master')
    })
    this.peer?.on('error', (err) => {
      console.error(err)
    })
    this.peer?.on('close', () => {
      console.log('[Components-Event] PeerJS 连接已关闭')
    })
    this.peer?.on('disconnected', () => {
      console.log('[Components-Event] PeerJS 连接已断开')
      this.peer?.reconnect()
    })
  }
  public processData(conn: DataConnection, data: RTCData) {
    //console.log(data)
    if (data.Key == 'Heartbeat') {
      // 心跳
      return
    } else if (data.Key == 'VTsuru.RTCEvent.On') {
      // 添加事件
      this.handledEvents[conn.peer].push(data.Data)
    } else if (data.Key == 'VTsuru.RTCEvent.Off') {
      // 移除事件
      const i = this.handledEvents[conn.peer].indexOf(data.Data)
      if (i > -1) {
        this.handledEvents[conn.peer].splice(i, 1)
      }
    } else {
      const key = data.Key.toLowerCase()
      if (this.events[key]) {
        this.events[key].forEach((item) => item(data.Data))
      }
    }
  }
  public async getAllRTC() {
    return (
      (await this.vhub.invoke<ComponentsEventHubModel[]>('GetOnlineRTC')) || []
    )
  }
  protected onConnectionClose(id: string) {
    this.connections = this.connections.filter((item) => item.peer != id)
    delete this.handledEvents[id]

    console.log(
      `[Components-Event] <${this.connections.length}> ${this.type == 'master' ? 'Slave' : 'Master'} 下线: ` +
        id
    )
  }

  public async Init() {
    if (!this.isInited) {
      this.isInited = true
      await this.vhub.on('RTCOffline', (id: string) =>
        this.onConnectionClose(id)
      )
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
  public async connectToAllMaster() {
    const masters = (await this.getAllRTC()).filter(
      (item) =>
        item.IsMaster &&
        item.Token != this.peer!.id &&
        !this.connections.some((conn) => conn.peer == item.Token)
    )
    masters.forEach((item) => {
      this.connectToMaster(item.Token)
      //console.log('[Components-Event] 正在连接到现有 Master: ' + item.Token)
    })
  }
  public connectToMaster(id: string) {
    if (this.connections.some((conn) => conn.peer == id)) return
    const c = this.peer?.connect(id)
    c?.on('open', () => {
      this.connections.push(c)

      this.handledEvents[id] = []

      console.log(
        `[Components-Event] <${this.connections.length}> ==> Master 连接已建立: ` +
          id
      )
    })
    c?.on('error', (err) => console.error(err))
    c?.on('data', (data) => this.processData(c, data as RTCData))
    c?.on('close', () => this.onConnectionClose(c.peer))
  }
  public async Init() {
    await super.Init()
    this.vhub?.on('MasterOnline', (data: string) => this.connectToMaster(data))
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

  public connectRTC() {
    super.connectRTC()
    this.peer?.on('connection', (conn) => {
      conn.on('open', () => {
        this.connections.push(conn)
        this.handledEvents[conn.peer] = []
        console.log(
          `[Components-Event] <${this.connections.length}> Slave 上线: ` +
            conn.peer
        )
      })
      conn.on('data', (d) => this.processData(conn, d as RTCData))
      conn.on('error', (err) => console.error(err))
      conn.on('close', () => this.onConnectionClose(conn.peer))
    })
  }

  public Init() {
    return super.Init()
  }
}
