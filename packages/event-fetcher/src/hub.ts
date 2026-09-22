import { HubConnectionBuilder, HubConnectionState } from '@microsoft/signalr'
import { MessagePackHubProtocol } from '@microsoft/signalr-protocol-msgpack'

import type { EventHub } from './session'

export function createSignalRHub(url: string): EventHub {
  const connection = new HubConnectionBuilder()
    .withUrl(url)
    .withAutomaticReconnect()
    .withHubProtocol(new MessagePackHubProtocol())
    .build()

  return {
    get state() {
      return connection.state === HubConnectionState.Connected ? 'connected' : 'disconnected'
    },
    start: () => connection.start(),
    stop: () => connection.stop(),
    on: (method, handler) => {
      connection.on(method, handler)
    },
    send: (method, ...args) => connection.send(method, ...args),
    invoke: (method, ...args) => connection.invoke(method, ...args),
  }
}
