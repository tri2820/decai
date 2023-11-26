import type { Stream } from "@libp2p/interface/connection";
import * as lp from "it-length-prefixed";
import map from "it-map";
import { pipe } from "it-pipe";
import { pushable } from 'it-pushable';
import { pack, unpack } from "msgpackr";
// import sharp from "sharp";
import { Message } from "./zkai";


export function createSendQueue(stream: Stream) {
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

export function handleIncomingMessages(stream: Stream, handler: (m: Message) => Promise<void>) {  
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
    
        handler(msg);
      }
    }
  );
}