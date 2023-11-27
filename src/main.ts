import "./style.css";

import init, * as wasmFunctions from "@ezkljs/engine/web/ezkl";
import { multiaddr } from "@multiformats/multiaddr";
import * as cv from "@techstark/opencv-js";
import Chart from "chart.js/auto";
import { CID } from "multiformats/cid";
import { PROTOCOL_NAME } from "./constants";
import type { Message } from "./decai";
import { createLibp2p } from "./libp2p";
import { createSendQueue, handleIncomingMessages } from "./utils.ts";
import * as json from "multiformats/codecs/json";
import { sha256 } from "multiformats/hashes/sha2";

await init();

const DOM = {
  digits: [...document.getElementsByClassName("digit")] as HTMLImageElement[],
  status: document.getElementById("status") as HTMLImageElement,
  image_to_inference: document.getElementById(
    "image_to_inference"
  ) as HTMLImageElement,
  inference_label: document.getElementById(
    "inference_label"
  ) as HTMLImageElement,
  graph_parent: document.getElementById("graph_parent") as HTMLImageElement,
};

const log = (line: string) => {
  console.log(line);
  DOM.status.innerText += line + "\n";
};

let chart = new Chart(document.getElementById("graph") as any, {
  type: "bar",
  data: {
    labels: [] as string[],
    datasets: [],
  },
  options: {
    indexAxis: "y",
  },
});

const setInferenceResult = (verified: boolean, outputs: number[][]) => {
  // We are using MNIST so we try to get the predicted digit
  const predicted_digits = outputs.map((digits: number[]) =>
    digits.reduce(
      (iMax: number, x: number, i: number, arr: number[]) =>
        x > arr[iMax] ? i : iMax,
      0
    )
  );
  log(`server said that image is ${predicted_digits.at(0)}`);

  DOM.inference_label.innerText = `Inference result: image is digit ${predicted_digits.at(0)}, verified that server indeed used the input and model we requested: ${verified}`;

  DOM.graph_parent.style.display = "block";
  const data = outputs.at(0)!.map((v, i) => ({
    digit: `digit ${i}`,
    logit: v,
  }));

  chart.data.labels = data.map((row) => row.digit);
  chart.data.datasets = [
    {
      label: "Logits",
      data: data.map((row) => row.logit),
    },
  ];
  chart.update();
};

async function initClient() {
  //  Create a new libp2p node on localhost with a randomly chosen port
  const client = await createLibp2p();

  // Output this node's address
  log(`Dialer ready, listening on: ${client.peerId.toString()}`);
  client.getMultiaddrs().forEach((ma) => {
    log(ma.toString());
  });

  client.addEventListener("peer:connect", async (evt) => {
    log(`connected to peer ${evt.detail}`);
  });

  // Manually dial to the server
  const serverMultiAddr =
    "/ip4/127.0.0.1/tcp/35067/ws/p2p/QmcrQZ6RJdpYuGvZqD5QEHAv6qX4BrQLJLQPQUrTrzdcgm";
  const serverMa = multiaddr(serverMultiAddr);
  log(`Dialed server ${serverMultiAddr} on protocol: ${PROTOCOL_NAME}`);
  const stream = await client.dialProtocol(serverMa, PROTOCOL_NAME);
  const sendQueue = createSendQueue(stream);
  const handler = async (message: Message) => {
    if (!message.inference_output) return;

    // Load the model settings
    const circuitFile = await fetch("/settings.json");
    const circuitSettingsBuffer = await circuitFile.arrayBuffer();
    const circuit_settings_ser = new Uint8ClampedArray(circuitSettingsBuffer);

    // Load the respective SRS file that we asked the server to use
    const srsFile = await fetch("/14.srs");
    const srsBuffer = await srsFile.arrayBuffer();
    const srs = new Uint8ClampedArray(srsBuffer);

    // Verify that the server used the model + input that we asked
    const verified = wasmFunctions.verify(
      message.inference_output.proof.data!,
      message.inference_output.verifying_key.data!,
      circuit_settings_ser,
      srs
    );
    log(`verified: ${verified}`);

    // Decode the output from the witness
    const witness_des = wasmFunctions.deserialize(
      message.inference_output.witness.data!
    );
    const circuit_settings = wasmFunctions.deserialize(circuit_settings_ser);

    // Outputs contain probababilities of each digit class
    const outputs: number[][] = witness_des.outputs.map((output: any, i: any) =>
      output.map((item: any) => {
        const x = wasmFunctions.serialize(item);
        return wasmFunctions.vecU64ToFloat(
          x,
          circuit_settings.model_output_scales[i]
        );
      })
    );
    log(`outputs ${outputs}`);
    setInferenceResult(verified, outputs);
  };
  handleIncomingMessages(stream, handler);

  DOM.digits.forEach((d) =>
    d.addEventListener("click", async () => {
      log("clicked");
      DOM.inference_label.innerText = "Inferencing...";

      DOM.image_to_inference.src = d.src;

      let mat = cv.imread(d);
      let m = new cv.Mat();
      cv.cvtColor(mat, m, cv.COLOR_BGR2GRAY);

      const pixelArray = Float32Array.from(m.data).map((pixel) => pixel / 255);
      const inputData = { input_data: [Array.from(pixelArray)] };
      const data = wasmFunctions.serialize(inputData);

      const srsFile = await fetch("/14.srs");
      const srsBuffer = await srsFile.arrayBuffer();
      const srsData = new Uint8ClampedArray(srsBuffer);

      const task_id = "123-123-123";

      const message = {
        inference_request: {
          task_id,
          input: {
            data,
          },
          model: {
            id: "mnist",
          },
          srs: {
            data: srsData,
          },
        },
      };

      log("sent request to server");
      sendQueue.push(message);
      log("waiting for inference");
    })
  );


  // Searching for servers providing MNIST classification service
  const bytes = json.encode({ model: "mnist" });
  const hash = await sha256.digest(bytes);
  const cid = CID.create(1, json.code, hash);
  setTimeout(async () => {
    try {
      const hproviders = client.contentRouting.findProviders(cid );
      for await (const evt of hproviders) {
        log(`found peer providing ${cid}: ${evt.id}`);
      }
    } catch {
      log("debug didnt find one");
    }
  }, 1500);
}

initClient();
