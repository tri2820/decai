import { createFromJSON } from '@libp2p/peer-id-factory'
import { multiaddr } from '@multiformats/multiaddr'
import { CID } from 'multiformats/cid'
import { PROTOCOL_NAME } from './constants'
import { createLibp2p } from './libp2p'
import peerIdClientJson from './peer-id-client.ts'
import peerIdServerJson from './peer-id-server.ts'
import { MNIST_interactive, handleIncomingMessages } from './utils'


const delay = (duration: number) => {
  return new Promise<void>((resolve) => {
    setTimeout(() => {
      resolve()
    }, duration)
  })
}

async function run () {
  const idClient = await createFromJSON(peerIdClientJson);
  const idServer = await createFromJSON(peerIdServerJson);

  // Create a new libp2p node on localhost with a randomly chosen port
  const client = await createLibp2p({
    peerId: idClient,
    addresses: {
      listen: ['/ip4/0.0.0.0/tcp/0']
    }
  })

  // Output this node's address
  console.log('Dialer ready, listening on:')
  client.getMultiaddrs().forEach((ma) => {
    console.log(ma.toString())
  });

  client.addEventListener('peer:connect', async (evt) => {
    console.log('debug connected', evt)
  });

//   client.addEventListener('peer:discovery', function (evt: any) {
//     console.log('found peer: ', evt)
//   });


  // Manually dial to the server
  const serverMa = multiaddr(`/ip4/127.0.0.1/tcp/10333/p2p/${idServer.toString()}`)
  console.log(`Dialed on protocol: ${PROTOCOL_NAME}`)
  const stream = await client.dialProtocol(serverMa, PROTOCOL_NAME)
  MNIST_interactive(stream)
  handleIncomingMessages(stream);


  // console.log('init pubsub');
  // (client.services.pubsub as any).addEventListener('message', (message: any) => {
  //   console.log(`${message.detail.topic}:`, new TextDecoder().decode(message.detail.data))
  // });
  // (client.services.pubsub as any).subscribe('model');


  // json { hello: 'world' }
  const hcid = CID.parse('bagaaierasords4njcts6vs7qvdjfcvgnume4hqohf65zsfguprqphs3icwea');
// const cid = CID.parse('QmYHzA8euDgUpNy3fh7JRwpPwt6jCgF35YTutYkyGGyr8f')
const hproviders = client.contentRouting.findProviders(hcid)
for await (const evt of hproviders) {
  console.log('found peer', evt)
}

await delay(3000);
const cid = CID.parse('QmdfTbBqBPQ7VNxZEYEj14VmRuZBkqFbiwReogJgS1zR1n');  
try {
  const providers = client.contentRouting.findProviders(cid)
  for await (const evt of providers) {
    console.log('found peer', evt)
  }
} catch {
  console.log('debug didnt find one')
}


}

run()
