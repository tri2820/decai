import { noise } from '@chainsafe/libp2p-noise'
import { yamux } from '@chainsafe/libp2p-yamux'
import { kadDHT } from '@libp2p/kad-dht'
import * as filters from '@libp2p/websockets/filters'
import { webSockets } from '@libp2p/websockets'
import { Libp2pOptions, createLibp2p as create } from 'libp2p'
import { identifyService } from "libp2p/identify"
import { webRTC } from '@libp2p/webrtc'

export async function createLibp2p (options?: Libp2pOptions) {
  const defaults = {
    transports: [
      webRTC(),
      webSockets({
        filter: filters.all
      })
    ],
    streamMuxers: [
      yamux()
    ],
    connectionEncryption: [
      noise()
    ],
    connectionGater: {
      denyDialMultiaddr: () => {
        return false
      }
    },
    services: {
      identify: identifyService(),
      dht: kadDHT()
    },
    connectionManager: {
      maxConnections: Infinity,
      minConnections: 0
    }
  }

  return create({...defaults, ...options})
}
