# Decai

Decai (Decentralized AI) is a peer-to-peer application protocol designed for AI services. 

In the Decai network, participants are categorized as either clients, who request services, or servers, who provide them. The range of AI services varies from simple tasks such as image classification and text completion to more complex ones like chatbots and AI stock traders.

Decai employs zero-knowledge proofs (ZKP) to validate and confirm that a specific AI model has been executed with a given input to produce a certain output. This technology facilitates the creation of a completely decentralized and trustless network for AI services.

# How to run it
This section demonstrates how to execute the MNIST example in which the client sends an image to the server to be classified using a predetermined model. If the server operates with a different model, uses an alternative input, or fabricates the result, the client can detect these discrepancies.


```
git clone https://github.com/tri2820/decai
cd decai
npm i

# In terminal A, start a node server
npm run server

# In terminal B, start a browser client
npm run dev
```

## Client/server communication
The basic use case of Decai is clients sending inference request messages & and server sending inference output messages. We focus on providing a very simple & extensible schema to facilitate this.

**Example use case**: The client sends a request to a server for the output of the nanoGPT model with the prompt "What’s the best cookie recipe?". The server then returns the model output along with a proof that this output was indeed generated using that model with that specific prompt.

The design choices of the decai protocol are inspired by the Nostr protocol:
- Messages are serialized Javascript objects.
- The decai protocol delegates responsibilities (such as sending large files, handling payments, etc.) to other networks better suited for those tasks, serving primarily as a simple signaling network for AI applications.
- No specific transport protocol or serialization scheme is specified. In this repository, I simply use libp2p's websockets with MessagePack to serialize.

Messages are structurally defined. All message types can be found in the file `decai.d.ts`. For example, we support several methods for sending files between clients and servers, as seen in the type definitions:

```
type InferenceRequestMessage = {
  input: Data;
  ...
};

type Data = OneOf<{
  ipfs: {
    cid: string;
  };
  data: Uint8ClampedArray;
}>;
```

This means you can send data by uploading it to the IPFS network and then sending the CID, or by sending the data directly. If the protocol needs to support another method of data transmission, we can add it as another field. For instance, sending model weights can also be done by uploading to Hugging Face.

```
type Model = OneOf<{
  id: string;
  huggingface: {
    user: string;
    model: string;
  };
  ipfs: {
    cid: string;
  };
}>;
```


## Inference request & output
In the inference request message, `proving_key` is sent along and will be used by the server to generate `proof` - which can be used to verify that the model has been run with specified input and result in a particular output. `task_id` is the hash256 of the serialized message (all fields excluding `task_id`).

```
type InferenceRequestMessage = {
  task_id: string;
  input: Data;
  model: Model;
  proving_key: Data;
};
```

In the inference output message, the server sends back `witness` which contains the model's output, and `proof`. 
```
type InferenceOutputMessage = {
  task_id: string;
  witness: Data;
  proof: Data;
};
```

## Announce support model
To help clients on the network explore their AI services, servers write to the distributed hash table (DHT). For example, server can say that they provide content `bagaaiera7jcd7fclxuunr2ug6xtre6ousxggov463xkq5nhua6teayiflvgq` which is the shas256 hash of `{ model: "mnist" }` to say they serve MNIST model. 

This approach is extensible, since arbitrary properties of the services can be announced as JSON keys. For example, announcing a specific model could be done as `{model_weight: <sha256 of model weight>}`.

_Note: hashing to CID to announce is a limitation of libp2p-js, we could have used binary/json key to announce instead._

## Incentive & Payment

Since decai's proofs are computationally challenging, similar to Filecoin's proof-of-storage or Bitcoin's proof-of-work, we can create a currency based on this proof-of-AI-services and reward server nodes that provide high-quality inferences. This native currency could also be used to pay for inference requests.

Additionally, the decai protocol allows the use of other networks as payment methods: (1) The client requests an invoice, (2) the server returns the invoice, and (3) the client requests inference with an invoice_fulfilled field indicating payment has been made. The decai protocol can support a wide range of payment methods by simply extending the message fields. For example, payment through Bitcoin Lightning can be extended as follows:
```
// Client requests invoice
type InvoiceRequestMessage = {
  service: Service;
};

// Server sends back invoice saying let's pay with bitcoin
export type InvoiceMessage = {
  service: Service;
  invoice_id: string;
  invoice: {
    bitcoin_lightning: {
      lnurl: string;
      amount: number;
    };
    expired_at: number;
  };
};

// Client requests inference with invoice fulfilled
type InferenceRequestMessage = {
  task_id: string;
  input: Data;
  model: Model;
  srs: Data;
  invoice_fulfilled?: {
    invoice_id: string;
  };
};
```


This invoice signaling mechanism, while simple, can enable the provision of AI services in a 100% trustless environment using a smart escrow contract setup. A typical setup would be:
1. Both client and server agree that one inference is worth 0.1 BTC.
2. The server sends 0.1 BTC to the escrow contract, committing to serve as an inference endpoint.
3. The client sends 0.2 BTC to the escrow contract to initiate the transaction and sends an AgentServe message to the server with the model and input details.
4. The server sends back the output and proof.
5. The client verifies the proof.
6. If the proof is verified to be correct, the client sends a DONE message to the escrow contract, stating the transaction is complete. The contract then returns 0.1 BTC to the server and 0.1 BTC to the client.
7. If the proof is not correct, the client sends a MUTUAL_DESTRUCTION message to the escrow. The escrow then burns the 0.3 BTC. Neither the client nor the server receives anything.

This setup ensures both parties are better off when behaving honestly.


# Other use cases
ZKP proofs allow hiding pieces of information, so we can make the input private, or the model weights private. These proofs can be published thoughout the network (via PubSub or DHT) to prove certain properties of the service. For examples:
- A server proves that it possesses a state-of-the-art object detection model (e.g. scoring 85 on the COCO benchmark). The server keeps its model private, but clients can still be assured of the model's quality.
- A server verifies that it possesses an input that enhances or worsens model performance (evidence of quality of prompt engineering service). The server can keep the input private and sell to the highest bidder.

# Future work
1. Currently, the powers-of-tau SRS file, which is used for generating proofs, is downloaded by the client and sent to the server. This approach suffices for the client to ensure the server did not cheat. However, to assure the entire network that the proofs are trustworthy (and to prevent the client from colluding with the server in generating the mentioned native currency), we need an additional layer to verify that these SRS files are indeed downloaded from the powers-of-tau ceremony.
2. Generate private key is slow and host model file
3. Model hash ZKP
4. Implement more useful models, such as nanoGPT (at present, we only support the MNIST classification model).
5. Support additional ZKP algorithms/libraries (currently, only ezkl is supported).
