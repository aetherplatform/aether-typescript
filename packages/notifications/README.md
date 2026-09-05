# `@aetherplatform/notifications`

Typed server APIs for Aether notification sends and customer-managed templates,
broadcasts, campaigns, analytics, and email configuration.

```ts
import {NotificationsClient} from "@aetherplatform/notifications";

const notifications = new NotificationsClient({baseUrl, tokenProvider});
const templates = await notifications.request("listNotificationTemplates");
```

The package exposes 29 approved customer-facing operations. Partner-private
inbox, device-token, preference, and message-status routes are not included.
Sandbox account mode does not imply live provider delivery: the platform's
effect policy and configured provider environment remain authoritative.
