// Like union type but can unpack & assign easily
export type OneOf<T> = {
  [K in keyof T]: { [_ in K]: T[K] } & { [_ in keyof Omit<T, K>]?: undefined };
}[keyof T];

export type Result<T> = OneOf<{
  error: {
    message: string;
  };
  data: T;
}>;

export type Data = OneOf<{
  ipfs: {
    cid: string;
  };
  data: Uint8ClampedArray;
}>;

export type Model = OneOf<{
  id: string;
  huggingface: {
    user: string;
    model: string;
  };
  ipfs: {
    cid: string;
  };
}>;

export type InferenceRequestMessage = {
  task_id: string;
  input: Data;
  model: Model;
  srs: Data;
  invoice_fulfilled?: {
    invoice_id: string;
  };
};

export type InferenceOutputMessage = {
  task_id: string;
  witness: Data;
  proof: Data;
  verifying_key: Data;
};

export type PrivateModelClaimMessage = {
  input: Data;
  output: Data;
  proof: Data;
};

export type PrivateInputClaimMessage = {
  model: Model;
  output: Data;
  proof: Data;
};

export type Service = "inference";

export type InvoiceRequestMessage = {
  service: Service;
};

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

export type Message = OneOf<{
  invoice_request: InvoiceRequestMessage;
  invoice: InvoiceMessage;
  private_input_claim: PrivateInputClaimMessage;
  private_model_claim: PrivateModelClaimMessage;
  inference_output: InferenceOutputMessage;
  inference_request: InferenceRequestMessage;
}>;
