import * as wasmFunctions from "@ezkljs/engine/nodejs/ezkl.js"
import { createFromJSON } from '@libp2p/peer-id-factory'
import { PROTOCOL_NAME } from '../src/constants.js'
import { createLibp2p } from '../src/libp2p.js'
import peerIdServerJson from './peer-id-server.js'
import { createSendQueue, handleIncomingMessages } from '../src/utils.js'
import type { Message } from '../src/decai'
import * as fs from 'fs/promises'
import * as path from 'path';
import { fileURLToPath } from "url"

async function readDataFile(filePath: string): Promise<Uint8ClampedArray> {
  const buffer = await fs.readFile(filePath);
  return new Uint8ClampedArray(buffer.buffer);
}

async function run () {
  // Create a new libp2p listening for browser clients
  const idServer = await createFromJSON(peerIdServerJson);
  const server = await createLibp2p(
    {
      peerId: idServer,
      addresses: {
        listen: ['/ip4/127.0.0.1/tcp/35067/ws']
      }
    }
  )
  

  // Log a message when a remote peer connects to us
  server.addEventListener('peer:connect', (evt) => {
    const remotePeer = evt.detail
    console.log('connected to:', remotePeer.toString());

    // setTimeout(async () => {
    //   // (server.services.pubsub as any).publish('model', new TextEncoder().encode('banana'))
      
    //   const bytes = json.encode({ hello: 'world' })
    //   const hash = await sha256.digest(bytes)
    //   const cid = CID.create(1, json.code, hash)
    //   console.log('debug I have', cid);
    //   server.contentRouting.provide(cid);
    // }, 500);
  })

  // Handle messages for the protocol
  await server.handle(PROTOCOL_NAME, async ({ stream }) => {
    const sendQueue = createSendQueue(stream);
    const handler = async (message: Message) => {
      console.log('inferencing...')

      if (!message.inference_request) return;
      if (!message.inference_request.input.data) return
      if (!message.inference_request.srs.data) return;
      if (message.inference_request.model.id !== "mnist") return;
  
      // Load the model
      const __dirname = path.dirname(fileURLToPath(import.meta.url));
      const networkPath = path.join(__dirname, 'network.compiled');
      const mnist_circuit_ser = await readDataFile(networkPath);
  
      // Generate witness, which contains both the result and materials to generate proof
      const witness = wasmFunctions.genWitness(mnist_circuit_ser, message.inference_request.input.data);
      const witness_ser = new Uint8ClampedArray(witness.buffer);
  
      // Generate verifying key
      const vk = wasmFunctions.genVk(
        mnist_circuit_ser,
        message.inference_request.srs.data
      );
      const vk_ser = new Uint8ClampedArray(vk.buffer);
  
      // Generate proving key
      const pk = wasmFunctions.genPk(
        vk_ser,
        mnist_circuit_ser,
        message.inference_request.srs.data
      );
      const pk_ser = new Uint8ClampedArray(pk.buffer);
  
      // Generate proof
      const proof = wasmFunctions.prove(
        witness_ser,
        pk_ser,
        mnist_circuit_ser,
        message.inference_request.srs.data
      );
      const proof_ser = new Uint8ClampedArray(proof.buffer);
  
      const response = {
        inference_output: {
          task_id: message.inference_request.task_id,
          witness: {
            data: witness_ser,
          },
          proof: {
            data: proof_ser,
          },
          verifying_key: {
            data: vk_ser,
          },
        },
      }

      console.log('debug send back', response);
      sendQueue.push(response);
    };

    handleIncomingMessages(stream, handler);
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
