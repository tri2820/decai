import './style.css';

import init, * as wasmFunctions from "@ezkljs/engine/web/ezkl.js";
import { multiaddr } from '@multiformats/multiaddr';
import cv from "@techstark/opencv-js";
import { PROTOCOL_NAME } from './constants';
import { createLibp2p } from './libp2p';
import { createSendQueue, handleIncomingMessages } from './utils.ts';
import { Message } from "./zkai";

// await init();

const DOM = {
  digits : [...document.getElementsByClassName('digit')] as HTMLImageElement[],
  status: document.getElementById('status'),
  image_to_inference: document.getElementById('image_to_inference') as HTMLImageElement,
  inference_output: document.getElementById('inference_output')
}

const log = (...args: any[]) => {
  console.log(args);
  DOM.status!.innerText += args.map((a: any) => JSON.stringify(a)).join(' ') + '\n';
}

async function initClient () {
  //  Create a new libp2p node on localhost with a randomly chosen port
  const client = await createLibp2p()

  // Output this node's address
  log('Dialer ready, listening on:', client.peerId.toString())
  client.getMultiaddrs().forEach((ma) => {
    log(ma.toString())
  });

  client.addEventListener('peer:connect', async (evt) => {
    log('debug connected', evt)
  });

  //   client.addEventListener('peer:discovery', function (evt: any) {
  //     log('found peer: ', evt)
  //   });


  // Manually dial to the server
  const serverMa = multiaddr('/ip4/127.0.0.1/tcp/35067/ws/p2p/QmcrQZ6RJdpYuGvZqD5QEHAv6qX4BrQLJLQPQUrTrzdcgm')
  log(`Dialed on protocol: ${PROTOCOL_NAME}`)
  const stream = await client.dialProtocol(serverMa, PROTOCOL_NAME)
  const sendQueue = createSendQueue(stream);
  const handler = async (message: Message) => {
    await init(
      undefined,
      new WebAssembly.Memory({ initial: 20, maximum: 4096, shared: true }),
    )


    if (!message.inference_output) return;

    // Load the model settings
    const circuitFile = await fetch('/settings.json');
    const circuitSettingsBuffer = await circuitFile.arrayBuffer();
    const circuit_settings_ser = new Uint8ClampedArray(circuitSettingsBuffer);

    // Load the respective SRS file that we asked the server to use
    const srsFile = await fetch('/14.srs');
    const srsBuffer = await srsFile.arrayBuffer();
    const srs = new Uint8ClampedArray(srsBuffer);

    console.log('circuit_settings_ser', circuit_settings_ser)
    console.log('srs', srs)
    // Verify that the server used the model + input that we asked
    const verified = wasmFunctions.verify(
      message.inference_output.proof.data!,
      message.inference_output.verifying_key.data!,
      circuit_settings_ser,
      srs
    );
    console.log("verified", verified);

    // Decode the output from the witness
    const witness_des = wasmFunctions.deserialize(message.inference_output.witness.data!);
    const circuit_settings = wasmFunctions.deserialize(circuit_settings_ser);

    // Outputs contain probababilities of each digit class
    const outputs = witness_des.outputs.map((output: any, i: any) =>
      output.map((item: any) => {
        const x = wasmFunctions.serialize(item);
        return wasmFunctions.vecU64ToFloat(
          x,
          circuit_settings.model_output_scales[i]
        );
      })
    );
    console.log("outputs", outputs);

    // We are using MNIST so we try to get the predicted digit
    const predicted_digit = outputs.map((digits: number[]) => digits.reduce((iMax: number, x: number, i: number, arr: number[]) => x > arr[iMax] ? i : iMax,0))
    console.log('predicted digit', predicted_digit)

    // message.inference_output;
    // DOM.inference_output!.innerText = JSON.stringify();
  };
  handleIncomingMessages(stream, handler);
  

  DOM.digits.forEach(d => d.addEventListener('click', async () => {
    log('clicked', d.id);
    
    DOM.image_to_inference.src = d.src;


    let mat = cv.imread(d);
    let m = new cv.Mat();
    cv.cvtColor(mat, m, cv.COLOR_BGR2GRAY);

    const pixelArray = Float32Array.from(m.data).map((pixel) => pixel / 255);
    const inputData = { input_data: [Array.from(pixelArray)] };
    const data = wasmFunctions.serialize(inputData);

    const srsFile = await fetch('/14.srs');
    const srsBuffer = await srsFile.arrayBuffer();
    const srsData = new Uint8ClampedArray(srsBuffer);

    const task_id = '123-123-123';

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

    log('sending request to server');
    sendQueue.push(message);
    log('waiting for inference');
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