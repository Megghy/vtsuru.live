import { useAccount } from '@/api/account'
import { useVTsuruHub } from '@/store/useVTsuruHub'
import Peer, { DataConnection } from 'peerjs'
import { Ref, ref } from 'vue'

export interface ComponentsEventHubModel {
  IsMaster: boolean
  Token: string
}
export interface RTCData {
  Key: string
  Data: any
}

abstract class BaseRTCClient {
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

  protected events: {
    [key: string]: ((args: unknown) => void)[]
  } = {}

  abstract type: 'master' | 'slave'

  public on(eventName: string, listener: (args: unknown) => void) {
    eventName = eventName.toLowerCase()
    if (!this.events[eventName]) {
      this.events[eventName] = []
    }
    this.events[eventName].push(listener)
  }
  public off(eventName: string, listener: (args: unknown) => void) {
    if (this.events[eventName]) {
      const index = this.events[eventName].indexOf(listener)
      if (index > -1) {
        this.events[eventName].splice(index, 1)
      }
    }
  }
  public send(eventName: string, data: unknown) {
    this.connections.forEach((item) =>
      item.send({
        Key: eventName,
        Data: data
      })
    )
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
          { urls: 'stun:turn.suki.club' },
          {
            urls: 'turn:turn.suki.club',
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
  public processData(data: RTCData) {
    //console.log(data)
    if (data.Key == 'Heartbeat') return
    if (this.events[data.Key.toLowerCase()]) {
      this.events[data.Key].forEach((item) => item(data.Data))
    }
  }
  public async getAllRTC() {
    return (
      (await this.vhub.invoke<ComponentsEventHubModel[]>('GetOnlineRTC')) || []
    )
  }
  protected onConnectionClose(id: string) {
    this.connections = this.connections.filter((item) => item.peer != id)
    console.log(
      `[Components-Event] <${this.connections.length}> ${this.type == 'master' ? 'Slave' : 'Master'} 下线: ` +
        id
    )
  }

  public Init() {
    if (!this.isInited) {
      this.isInited = true
      this.connectRTC()
    }
    this.vhub.on('RTCOffline', (id: string) => this.onConnectionClose(id))
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
  public connectToMaster(token: string) {
    if (this.connections.some((conn) => conn.peer == token)) return
    const c = this.peer?.connect(token)
    c?.on('open', () => {
      this.connections.push(c)
      console.log(
        `[Components-Event] <${this.connections.length}> ==> Master 连接已建立: ` +
          token
      )
    })
    c?.on('data', (data) => this.processData(data as RTCData))
    c?.on('close', () => this.onConnectionClose(c.peer))
  }
  public Init() {
    super.Init()
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
        console.log(
          `[Components-Event] <${this.connections.length}> Slave 上线: ` +
            conn.peer
        )
      })
      conn.on('data', (data) => this.processData(data as RTCData))
      conn.on('error', (err) => console.error(err))
      conn.on('close', () => this.onConnectionClose(conn.peer))
    })
  }
  public Init() {
    return super.Init()
  }
}
