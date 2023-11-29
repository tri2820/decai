# Decai - Decentralized AI

Decai is a peer-to-peer application protocol designed for AI services. It facilitates a network where participants are categorized as clients, who request services, or servers, who provide them. The services range from simple tasks like image classification and text completion to more complex applications such as chatbots and AI-driven stock trading algorithms.

At its core, Decai utilizes zero-knowledge proofs (ZKPs) to prove and verify the execution of a specific AI model with given inputs. This technology enables a fully decentralized and trustless environment for AI services.

## How to Run an Example
To demonstrate Decai's functionality, we'll use the MNIST example. Here, the client sends an image to a server for classification using a pre-determined model. The protocol ensures that any deviation in the model, input, or result by the server is detectable by the client.

```bash
# Clone the repository and install dependencies
git clone https://github.com/tri2820/decai
cd decai
npm install

# Start a node server in Terminal A
npm run server

# Launch a browser client in Terminal B
npm run dev
```
Generating verifying key & inferencing may take a few minutes. The demo video is `decai_demo.mp4` in this repo.

## Client/Server Communication
The primary use case for Decai involves clients sending inference requests and servers responding with inference outputs. 

**Example Use Case**: A client requests the `nanoGPT` model's output for the prompt "What’s the best cookie recipe?". The server responds with the output and a proof, verifying the model's use with that specific prompt.

Decai's design is inspired by the Nostr protocol:
- Messages are serialized JavaScript objects.
- The protocol delegates specific tasks (like handling large file transfers or payments) to networks better suited for these functions, mainly operating as a signaling network.
- There is no specific transport protocol or serialization scheme mandated. In this repository, we use libp2p's websocket and MessagePack for serialization.

The Decai protocol is designed to be simple yet extensible. For instance, the protocol supports multiple methods for file transmission. Data can be sent via IPFS by sharing the CID or directly as binary data. Additional methods can be integrated as needed simply by extending the message type with extra fields.

```typescript
type Data = OneOf<{
  data: Uint8ClampedArray;
  ipfs: {
    cid: string;
  };
  // Other ways of transfering data can be added as fields (e.g. https, hugging_face, ...)
}>;

type InferenceRequestMessage = {
  input: Data;
  // ...
};
```

## Inference Request and Output
In the inference request message, a `proving_key` is included, which the server uses to generate a `proof`. This proof verifies the model's execution with the specified input and output. The server also sends back `witness` which contains the model's output.

`task_id` is the hash256 of the serialized message (all fields excluding `task_id`), helping the client to verify.

```typescript
type InferenceRequestMessage = {
  task_id: string;
  input: Data;
  model: Model;
  proving_key: Data;
};

type InferenceOutputMessage = {
  task_id: string;
  witness: Data;
  proof: Data;
};
```

## Announcing Supported Models
Servers can announce their AI services on the network's distributed hash table (DHT).  For example, server can say that they provide content `bagaaiera7jcd7fclxuunr2ug6xtre6ousxggov463xkq5nhua6teayiflvgq` - the shas256 hash of `{ model: "mnist" }` - to say they serve MNIST classification service. 


This approach is extensible, since arbitrary properties of the service can be added as JSON keys. For example, announcing a specific model could be done as `{ model_weight: <sha256 of model weight> }`.

_Note: hashing to CID to announce is a limitation of libp2p-js, we could have used binary/json key to announce instead._

## Incentives and Payments
Decai's ZKP proof are computational challenges similar to Bitcoin's proof-of-work or Filecoin's proof-of-storage. This creates the potential for a native currency, rewarding servers for quality inferences. This currency could also facilitate payment for services. Having a native currency could significantly simplify the process for companies looking to establish partnerships with a large number of servers to provide near-the-edge AI services for their apps.

Other than that, the protocol can integrate various payment methods, like Bitcoin Lightning Network, through simple message field extensions:

1. Client requests invoice
```typescript
type InvoiceRequestMessage = {
  service: Service;
};
```

2. Server sends back invoice saying let's pay with bitcoin
```typescript
export type InvoiceMessage = {
  service: Service;
  invoice: {
    id: string;
    method: OneOf<{
        bitcoin_lightning: {
            lnurl: string;
            amount: number;
        };
        // Other payment method can be added here (e.g. paypal)
    }>
    expired_at: number;
  };
};
```
3. Client requests inference with invoice fulfilled
```typescript
type InferenceRequestMessage = {
  task_id: string;
  input: Data;
  model: Model;
  srs: Data;
  invoice_fulfilled?: {
    id: string;
  };
};
```
Pairing with a smart escrow contract setup, this would ensure both parties are better off when behaving honestly.

## Other Use Cases
ZKP proofs can hide certain information, allowing for private inputs or model weights while still publishing proofs network-wide (via PubSub or DHT) to verify service properties. For examples:
- A server proves that it possesses a state-of-the-art object detection model (e.g. scoring 85 on the COCO benchmark). The server keeps its model private, but clients can still be assured of the model's quality.
- A server verifies that it possesses an input that enhances or worsens model performance (evidence of quality of prompt engineering service). The server can keep the input private and sell to the highest bidder.

## Future Work
Several areas for future development include:
1. Current implementation generates proof that a specific model has been run. This means the client has to have access to the (heavy) model weights. We can solve this issue by generating proof of a model *with specific hash* has been run instead.
2. Implementing a verification layer for the powers-of-tau SRS files to prevent collusion in currency generation. 
3. Speeding up the generation of private keys.
4. Expanding support to more models, such as nanoGPT.
5. Incorporating additional ZKP algorithms and libraries.