import {OperationClient, type AetherClientConfig} from "@aetherplatform/core";
import {operations, type EventsOperations} from "./generated.js";

export * from "./generated.js";

export class EventsClient extends OperationClient<EventsOperations> {
  constructor(config: AetherClientConfig) {
    super(config, operations);
  }
}
