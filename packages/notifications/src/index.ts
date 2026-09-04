import {OperationClient, type AetherClientConfig} from "@aetherplatform/core";
import {operations, type NotificationsOperations} from "./generated.js";

export * from "./generated.js";

export class NotificationsClient extends OperationClient<NotificationsOperations> {
  constructor(config: AetherClientConfig) {
    super(config, operations);
  }
}
