import { gossipsub } from '@chainsafe/libp2p-gossipsub'
import { noise } from '@chainsafe/libp2p-noise'
import { yamux } from '@chainsafe/libp2p-yamux'
import { kadDHT } from '@libp2p/kad-dht'
// import { mdns } from '@libp2p/mdns'
import { tcp } from '@libp2p/tcp'
import { webSockets } from '@libp2p/websockets'
import { Libp2pOptions, createLibp2p as create } from 'libp2p'
import { identifyService } from "libp2p/identify"


export async function createLibp2p (options: Libp2pOptions) {

  // // default is to use ipfs.io
  // const client = createIpfsHttpClient({
  //   // use default api settings
  //   protocol: 'https',
  //   port: 443,
  //   host: 'node0.delegate.ipfs.io'
  // })


  const defaults = {
    transports: [
      tcp(),
      webSockets()
    ],
    streamMuxers: [
      yamux()
    ],
    connectionEncryption: [
      noise()
    ],
    // peerDiscovery: [
    //   mdns()
    // ],  
    // peerRouting: [
    //   delegatedContentRouting(client)
    // ],  
    services: {
      identify: identifyService(),
      pubsub: gossipsub(),
      dht: kadDHT()
    },
    connectionManager: {
      maxConnections: Infinity,
      minConnections: 0
    }
  
    // options: {
      
    // }
  }

  return create({...defaults, ...options})
}
