import './style.css'
import { OneOf } from './zkai';

import { createFromJSON } from '@libp2p/peer-id-factory'
import { multiaddr } from '@multiformats/multiaddr'
import { CID } from 'multiformats/cid'
import { PROTOCOL_NAME } from './constants'
import { createLibp2p } from './libp2p'
import peerIdClientJson from './peer-id-client.ts'
import peerIdServerJson from './peer-id-server.ts'
// import { handleIncomingMessages } from './utils'
import type { Stream } from "@libp2p/interface/connection";
// import { randomUUID } from "crypto";
import * as lp from "it-length-prefixed";
import map from "it-map";
import { pipe } from "it-pipe";
import { pushable } from 'it-pushable';
import { pack, unpack } from "msgpackr";
import { Message, Result } from "./zkai";
import { Image } from 'image-js';
import * as wasmFunctions from "@ezkljs/engine/web/ezkl.js";
// import { readDataFile } from './utils.ts';

import * as fs from 'fs/promises';

export function queueToServer(stream: Stream) {
  const sendQueue = pushable({ objectMode: true });
  // process.stdin.setEncoding("utf8");

  // console.log('Send an image to MNIST network on the server peer')
  // console.log('Input a number from 0 to 9:')
  pipe(
    sendQueue,
    (source) => map(source, x => pack(x)),
    (source) => lp.encode(source),
    stream.sink
  );

  return sendQueue
}


let state : OneOf<{
  idling: {},
  predicting: {
    image: string
  }
}> = {
  idling: {}
};

const DOM = {
  digits : [...document.getElementsByClassName('digit')],
  status: document.getElementById('status')
}

const log = (...args: any[]) => {
  console.log(args);
  DOM.status!.innerText += args.map((a: any) => JSON.stringify(a)).join(' ') + '\n';
}

// In-memory storage for clients
const kv: {
  [task_id: string]: {
    srs_id: number;
  };
} = {};




async function initClient () {
  const idClient = await createFromJSON(peerIdClientJson);
  const idServer = await createFromJSON(peerIdServerJson);

//   // Create a new libp2p node on localhost with a randomly chosen port
  const client = await createLibp2p(
    {
      addresses: {
        listen: [
          // create listeners for incoming WebRTC connection attempts on on all
          // available Circuit Relay connections
          '/webrtc'
        ]
      }
    }
  )

//   // Output this node's address
  log('Dialer ready, listening on:', client.peerId.toString())
  client.getMultiaddrs().forEach((ma) => {
    log(ma.toString())
  });

  client.addEventListener('peer:connect', async (evt) => {
    log('debug connected', evt)
  });

// //   client.addEventListener('peer:discovery', function (evt: any) {
// //     log('found peer: ', evt)
// //   });



//   // Manually dial to the server
  const serverMa = multiaddr('/ip4/127.0.0.1/tcp/44235/ws/p2p/QmcrQZ6RJdpYuGvZqD5QEHAv6qX4BrQLJLQPQUrTrzdcgm')
  log(`Dialed on protocol: ${PROTOCOL_NAME}`)
  const stream = await client.dialProtocol(serverMa, PROTOCOL_NAME)
  log(stream)
  const q = queueToServer(stream);

  DOM.digits.forEach(d => d.addEventListener('click', async () => {
    const image = await Image.load(`/digits/${d.id}.jpg`);
    const buffer = image
    .grey()
    .resize({width: 200, height: 200})
    .rotate(30)
    .toBuffer();
    console.log('buffer', buffer);

    const pixelArray = Float32Array.from(buffer).map((pixel) => pixel / 255);
    const inputData = { input_data: [Array.from(pixelArray)] };
    const data = wasmFunctions.serialize(inputData);
    console.log('data', data);


    const task_id = '123-123-123'

  // // Remember that we use 14.srs file for this task, so we can use the same srs file to verify the output
  // kv[task_id] = {
  //   // For this MNIST model, we use the 14.srs file
  //   // Note: number 14 is the logrows in the model's settings.json file
  //   srs_id: 14,
  // };

    const srsFile = await fetch('/artifact/14.srs');
    const srsBuffer = await srsFile.arrayBuffer();
    const srsData = new Uint8ClampedArray(srsBuffer);
    // console.log('srsBinary', srsBinary);

    const message = {
      inference_request: {
        task_id,
        input: {
          data
        },
        model: {
          id: "mnist",
        },
        srs: {
          data: srsData
        },
      },
    };

    console.log(message);
    q.push(message);
    // state = {
    //     predicting: {
    //     image: d.id
    //   }
    // }
    // log(d.id)
  }))



  // MNIST_interactive(stream)
//   // handleIncomingMessages(stream);

//   const hcid = CID.parse('bagaaierasords4njcts6vs7qvdjfcvgnume4hqohf65zsfguprqphs3icwea');
//   const hproviders = client.contentRouting.findProviders(hcid)
//   for await (const evt of hproviders) {
//     log('found peer', evt)
//   }


// const cid = CID.parse('QmdfTbBqBPQ7VNxZEYEj14VmRuZBkqFbiwReogJgS1zR1n');  
// try {
//   const providers = client.contentRouting.findProviders(cid)
//   for await (const evt of providers) {
//     log('found peer', evt)
//   }
// } catch {
//   log('debug didnt find one')
// }


}

initClient();