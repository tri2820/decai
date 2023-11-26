import * as wasmFunctions from "@ezkljs/engine/nodejs/ezkl.js";
import type { Stream } from "@libp2p/interface/connection";
import { randomUUID } from "crypto";
import * as lp from "it-length-prefixed";
import map from "it-map";
import { pipe } from "it-pipe";
import { pushable } from 'it-pushable';
import { pack, unpack } from "msgpackr";
import sharp from "sharp";
import { Message, Result } from "./zkai";
import * as fs from 'fs/promises';


export async function readDataFile(filePath: string): Promise<Uint8ClampedArray> {
  // const filePath = path.join(__dirname, '..', 'public', 'data', example, filename);
  const buffer = await fs.readFile(filePath);
  return new Uint8ClampedArray(buffer.buffer);
}


// In-memory storage for clients
const kv: {
  [task_id: string]: {
    srs_id: number;
  };
} = {};

// Main function to handle messages
export async function handleMessage(message: Message): Promise<
  Result<{
    response?: Message;
  }>
> {

  // When receive an inference request
  // Run the model on that input, then return result and proof of inference
  if (message.inference_request) {
    if (!message.inference_request.input.data) {
      return {
        error: {
          message: "Implementation only supports input as raw data",
        },
      };
    }

    const input_ser = message.inference_request.input.data;

    if (!message.inference_request.srs.data) {
      return {
        error: {
          message: "Implementation only supports sending SRS file as raw data",
        },
      };
    }

    if (message.inference_request.model.id !== "mnist") {
      return {
        error: {
          message: "Implementation only supports MNIST network",
        },
      };
    }

    // Load the model
    const mnist_circuit_ser = await readDataFile("artifact/network.compiled");

    // Generate witness, which contains both the result and materials to generate proof
    const witness = wasmFunctions.genWitness(mnist_circuit_ser, input_ser);
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

    // Send back an inference output message
    return {
      data: {
        response: {
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
        },
      },
    };
  }

  // When receive an inference output message
  // Can just store it in the DB or show to client
  // Here we decode the inference output from the witness and print out the result
  if (message.inference_output) {
    // Load the model settings
    const circuit_settings_ser = await readDataFile("artifact/settings.json");
    // Load the respective SRS file that we asked the server to use
    const srs = await readDataFile(`artifact/${kv[message.inference_output.task_id].srs_id}.srs`);

    // Verify that the server used the model + input that we asked
    let verified = wasmFunctions.verify(
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

    return {
      data: {},
    };
  }

  return {
    data: {},
  };
}

const createExampleInferenceMessage = async (
  image_path: string
): Promise<Message> => {
  const task_id = randomUUID();

  // Remember that we use 14.srs file for this task, so we can use the same srs file to verify the output
  kv[task_id] = {
    // For this MNIST model, we use the 14.srs file
    // Note: number 14 is the logrows in the model's settings.json file
    srs_id: 14,
  };

  // Load the image and use it as input
  const buffer = await sharp(image_path)
    .greyscale()
    .resize(28, 28)
    .raw()
    .toBuffer();
  const pixelArray = Float32Array.from(buffer).map((pixel) => pixel / 255);
  const inputData = { input_data: [Array.from(pixelArray)] };
  const data = wasmFunctions.serialize(inputData);

  return {
    inference_request: {
      task_id,
      input: {
        data
      },
      model: {
        id: "mnist",
      },
      srs: {
        data: await readDataFile(`artifact/${kv[task_id].srs_id}.srs`),
      },
    },
  };
};


function createSendQueue(stream: Stream) {
  // Create a pushable iterable so we can push messages into to send back to the other peer
  const sendQueue = pushable({ objectMode: true });

  // When messages are pushed into queue, process them and send to the other peer
  pipe(
    sendQueue,
    (source) => map(source, x => pack(x)),
    (source) => lp.encode(source),
    stream.sink
  );

  return sendQueue
}

export function handleIncomingMessages(stream: Stream) {  
  const sendQueue = createSendQueue(stream);

  pipe(
    stream.source,
    // Decode length-prefixed data
    (source) => lp.decode(source),
    // Turn buffers into messages
    (source) => map(source, (buf) => unpack(buf.subarray())),
    // Sink function
    async function (source: AsyncGenerator<Message>) {
      for await (const msg of source) {
        console.log("Received message", msg);
        if (!msg) {
          continue;
        }
    
        const { data, error } = await handleMessage(msg);
        if (error) {
          console.error(error);
          continue;
        }
    
        if (!data.response) continue;
    
        // Reply to the other peer's messsages
        // Example: reply an inference request with an infenrece output
        sendQueue.push(data.response)
      }
    }
  );
}

export async function MNIST_interactive(stream: Stream) {
  process.stdin.setEncoding("utf8");

  console.log('Send an image to MNIST network on the server peer')
  console.log('Input a number from 0 to 9:')
  pipe(
    process.stdin,
    (source) =>
      map(source, async (string) => {
        const c = string[0];
        if (c < "0" || c > "9") {
          console.log("Input must be a digit (0-9). Try again.");
          return pack(null);
        }

        const imagePath = `artifact/digits/${c}.jpg`;
        console.log(`Sending image ${imagePath}`);
        const m = await createExampleInferenceMessage(imagePath);
        return pack(m);
      }),
    // Encode with length prefix (so receiving side knows how much data is coming)
    (source) => lp.encode(source),
    // Write to the stream (the sink)
    stream.sink
  );
}

export async function NANOGPT_interactive(){
  // TODO:
}