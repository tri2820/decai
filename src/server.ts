import { createFromJSON } from '@libp2p/peer-id-factory'
import { CID } from 'multiformats/cid'
import { PROTOCOL_NAME } from './constants.js'
import { createLibp2p } from './libp2p.js'
import peerIdServerJson from './peer-id-server.js'
import { handleIncomingMessages } from './utils.js'
// import multihashing from 'multihashing-async'

import * as json from 'multiformats/codecs/json'
import { sha256 } from 'multiformats/hashes/sha2'

async function run () {
  // Create a new libp2p node with the given multi-address
  const idServer = await createFromJSON(peerIdServerJson);
  const server = await createLibp2p({
    peerId: idServer,
    addresses: {
      listen: ['/ip4/0.0.0.0/tcp/10333']
    }
  })
  

  // Log a message when a remote peer connects to us
  server.addEventListener('peer:connect', (evt) => {
    const remotePeer = evt.detail
    console.log('connected to: ', remotePeer.toString());

    setTimeout(async () => {
      // (server.services.pubsub as any).publish('model', new TextEncoder().encode('banana'))
      
      const bytes = json.encode({ hello: 'world' })
      const hash = await sha256.digest(bytes)
      const cid = CID.create(1, json.code, hash)
      console.log('debug I have', cid);
      server.contentRouting.provide(cid);
    }, 500);
  })

  // Handle messages for the protocol
  await server.handle(PROTOCOL_NAME, async ({ stream }) => {
    handleIncomingMessages(stream)
  })

  // Output listen addresses to the console
  console.log('Listener ready, listening on:')
  server.getMultiaddrs().forEach((ma) => {
    console.log(ma.toString())
  });


  // server.addEventListener('peer:discovery', function (evt: any) {
  //   console.log('found peer: ', evt)
  // });

  // console.log('init pubsub');
  // (server.services.pubsub as any).addEventListener('message', (message: any) => {
  //   console.log(`${message.detail.topic}:`, new TextDecoder().decode(message.detail.data))
  // });
  // (server.services.pubsub as any).subscribe('model');

  // setTimeout(() => {
  //   const cid = CID.parse('bagaaierasords4njcts6vs7qvdjfcvgnume4hqohf65zsfguprqphs3icwea');
  //   server.contentRouting.provide(cid);
  // }, 500)
}

run()
