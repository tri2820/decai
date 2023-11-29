import * as wasmFunctions from "@ezkljs/engine/nodejs/ezkl.js";
import { createFromJSON } from "@libp2p/peer-id-factory";
import * as fs from "fs/promises";
import { CID } from "multiformats/cid";
import * as path from "path";
import { fileURLToPath } from "url";
import { PROTOCOL_NAME } from "../shared/constants.js";
import type { Message } from "../shared/decai.js";
import { createLibp2p } from "../shared/libp2p.js";
import { createSendQueue, handleIncomingMessages } from "../shared/utils.js";
import peerIdServerJson from "./peer-id-server.js";
import * as json from "multiformats/codecs/json";
import { sha256 } from "multiformats/hashes/sha2";

async function readDataFile(filePath: string): Promise<Uint8ClampedArray> {
  const buffer = await fs.readFile(filePath);
  return new Uint8ClampedArray(buffer.buffer);
}

async function run() {
  // Create a new libp2p listening for browser clients
  const idServer = await createFromJSON(peerIdServerJson);
  const server = await createLibp2p({
    peerId: idServer,
    addresses: {
      listen: ["/ip4/127.0.0.1/tcp/35067/ws"],
    },
  });

  // Log a message when a remote peer connects to us
  server.addEventListener("peer:connect", (evt) => {
    const remotePeer = evt.detail;
    console.log("connected to:", remotePeer.toString());

    // Here we just simply reannounce everytime a new peer connects to us
    setTimeout(async () => {
      const bytes = json.encode({
        model: "mnist",
      });
      const hash = await sha256.digest(bytes);
      const cid = CID.create(1, json.code, hash);
      console.log("provide:", cid);
      server.contentRouting.provide(cid);
    }, 1000);
  });

  // Handle messages for the protocol
  await server.handle(PROTOCOL_NAME, async ({ stream }) => {
    const sendQueue = createSendQueue(stream);
    const handler = async (message: Message) => {
      console.log("inferencing...");

      if (!message.inference_request) return;
      if (!message.inference_request.input.data) return;
      if (!message.inference_request.srs.data) return;
      if (!message.inference_request.proving_key.data) return;
      if (message.inference_request.model.id !== "mnist") return;

      // Load the model
      const __dirname = path.dirname(fileURLToPath(import.meta.url));
      const networkPath = path.join(
        __dirname,
        "..",
        "public",
        "network.compiled"
      );
      const mnist_circuit_ser = await readDataFile(networkPath);

      // Generate witness, which contains both the result and materials to generate proof
      const witness = wasmFunctions.genWitness(
        mnist_circuit_ser,
        message.inference_request.input.data
      );
      const witness_ser = new Uint8ClampedArray(witness.buffer);

      // Generate proof
      const proof = wasmFunctions.prove(
        witness_ser,
        message.inference_request.proving_key.data,
        mnist_circuit_ser,
        message.inference_request.srs.data
      );
      const proof_ser = new Uint8ClampedArray(proof.buffer);

      const response: Message = {
        inference_output: {
          task_id: message.inference_request.task_id,
          witness: {
            data: witness_ser,
          },
          proof: {
            data: proof_ser,
          },
        },
      };

      console.log("send back", response);
      sendQueue.push(response);
    };

    handleIncomingMessages(stream, handler);
  });

  // Output listen addresses to the console
  console.log("listener ready, listening on:");
  server.getMultiaddrs().forEach((ma) => {
    console.log(ma.toString());
  });
}

run();
