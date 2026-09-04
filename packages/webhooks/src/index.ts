import {OperationClient, type AetherClientConfig} from "@aetherplatform/core";
import {operations, type WebhooksOperations} from "./generated.js";

export * from "./generated.js";

export class WebhooksClient extends OperationClient<WebhooksOperations> {
  constructor(config: AetherClientConfig) {
    super(config, operations);
  }
}
