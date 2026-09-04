// Generated from the canonical Aether OpenAPI contract. Do not edit.
// Source: contracts/openapi/v1/notifications.yaml

export type JsonObject = EmailConfiguration;

export type SendNotificationRequest = { user_id: string; type: string; channels: Array<"push" | "sms" | "email" | "in_app">; title?: string; body?: string; template_slug?: string; template_data?: EmailConfiguration; locale?: string; data?: EmailConfiguration; phone?: string; email?: string; device_token?: string; platform?: string; };

export type QueuedNotification = { status: "queued"; message: string; notification_id: string; };

export type TemplateWrite = { slug: string; name: string; type?: string; locale?: string; version?: number; category?: string; push_title?: string; push_body?: string; email_subject?: string; email_html?: string; sms_body?: string; };

export type Template = (TemplateWrite) & ({ id: string; is_active: boolean; });

export type TemplateList = { templates: Array<Template>; };

export type TemplateVariables = { locale?: string; variables?: EmailConfiguration; };

export type TemplatePreviewRequest = (TemplateWrite) & (TemplateVariables);

export type TemplateTestRequest = (TemplateVariables) & ({ user_id: string; channels: Array<string>; });

export type TemplatePreview = { locale?: string; version?: number; push_title?: string; push_body?: string; email_subject?: string; email_html?: string; sms_body?: string; [key: string]: unknown; };

export type Resource = { id: string; [key: string]: unknown; };

export type ResourceList = { data?: Array<Resource>; [key: string]: unknown; };

export type ActionResult = EmailConfiguration;

export type Analytics = EmailConfiguration;

export type EmailConfiguration = { [key: string]: unknown; };

export interface NotificationsOperations {
  activateCampaign: {
    request: never;
    response: Resource;
    path: { id: string; };
    query: Record<string, never>;
  };
  archiveCampaign: {
    request: never;
    response: Resource;
    path: { id: string; };
    query: Record<string, never>;
  };
  cancelBroadcast: {
    request: never;
    response: EmailConfiguration;
    path: { id: string; };
    query: Record<string, never>;
  };
  completeCampaign: {
    request: never;
    response: Resource;
    path: { id: string; };
    query: Record<string, never>;
  };
  createBroadcast: {
    request: EmailConfiguration;
    response: Resource;
    path: Record<string, never>;
    query: Record<string, never>;
  };
  createCampaign: {
    request: EmailConfiguration;
    response: Resource;
    path: Record<string, never>;
    query: Record<string, never>;
  };
  createNotificationTemplate: {
    request: TemplateWrite;
    response: Template;
    path: Record<string, never>;
    query: Record<string, never>;
  };
  getBroadcast: {
    request: never;
    response: Resource;
    path: { id: string; };
    query: Record<string, never>;
  };
  getBroadcastAnalytics: {
    request: never;
    response: EmailConfiguration;
    path: { id: string; };
    query: Record<string, never>;
  };
  getCampaign: {
    request: never;
    response: Resource;
    path: { id: string; };
    query: Record<string, never>;
  };
  getChannelAnalytics: {
    request: never;
    response: EmailConfiguration;
    path: { channel: "push" | "sms" | "email" | "in_app"; };
    query: Record<string, never>;
  };
  getEmailConfiguration: {
    request: never;
    response: EmailConfiguration;
    path: Record<string, never>;
    query: Record<string, never>;
  };
  getEmailEvent: {
    request: never;
    response: Resource;
    path: { id: string; };
    query: Record<string, never>;
  };
  getNotificationAnalytics: {
    request: never;
    response: EmailConfiguration;
    path: Record<string, never>;
    query: Record<string, never>;
  };
  getNotificationTemplate: {
    request: never;
    response: Template;
    path: { slug: string; };
    query: Record<string, never>;
  };
  listBroadcasts: {
    request: never;
    response: ResourceList;
    path: Record<string, never>;
    query: Record<string, never>;
  };
  listCampaignExecutions: {
    request: never;
    response: ResourceList;
    path: { id: string; };
    query: Record<string, never>;
  };
  listCampaigns: {
    request: never;
    response: ResourceList;
    path: Record<string, never>;
    query: Record<string, never>;
  };
  listNotificationTemplates: {
    request: never;
    response: TemplateList;
    path: Record<string, never>;
    query: Record<string, never>;
  };
  pauseCampaign: {
    request: never;
    response: Resource;
    path: { id: string; };
    query: Record<string, never>;
  };
  previewNotificationTemplate: {
    request: TemplateVariables;
    response: TemplatePreview;
    path: { slug: string; };
    query: Record<string, never>;
  };
  previewNotificationTemplateBody: {
    request: TemplatePreviewRequest;
    response: TemplatePreview;
    path: Record<string, never>;
    query: Record<string, never>;
  };
  sendBroadcast: {
    request: never;
    response: EmailConfiguration;
    path: { id: string; };
    query: Record<string, never>;
  };
  sendEmail: {
    request: EmailConfiguration;
    response: EmailConfiguration;
    path: Record<string, never>;
    query: Record<string, never>;
  };
  sendNotification: {
    request: SendNotificationRequest;
    response: QueuedNotification;
    path: Record<string, never>;
    query: Record<string, never>;
  };
  testNotificationTemplate: {
    request: TemplateTestRequest;
    response: EmailConfiguration;
    path: { slug: string; };
    query: Record<string, never>;
  };
  updateCampaign: {
    request: EmailConfiguration;
    response: Resource;
    path: { id: string; };
    query: Record<string, never>;
  };
  updateEmailConfiguration: {
    request: EmailConfiguration;
    response: EmailConfiguration;
    path: Record<string, never>;
    query: Record<string, never>;
  };
  updateNotificationTemplate: {
    request: TemplateWrite;
    response: Template;
    path: { id: string; };
    query: Record<string, never>;
  };
}

export const operations = {
  activateCampaign: {
    method: "POST",
    path: "/v1/notifications/campaigns/{id}/activate",
    tokenProfiles: ["client_access_v1"],
    requiredCapability: "notifications:campaigns/{id}:manage",
    availability: ["sandbox","live"],
    idempotency: "unsupported",
    successStatuses: [200],
  },
  archiveCampaign: {
    method: "POST",
    path: "/v1/notifications/campaigns/{id}/archive",
    tokenProfiles: ["client_access_v1"],
    requiredCapability: "notifications:campaigns/{id}:manage",
    availability: ["sandbox","live"],
    idempotency: "unsupported",
    successStatuses: [200],
  },
  cancelBroadcast: {
    method: "POST",
    path: "/v1/notifications/broadcasts/{id}/cancel",
    tokenProfiles: ["client_access_v1"],
    requiredCapability: "notifications:broadcasts/{id}:manage",
    availability: ["sandbox","live"],
    idempotency: "unsupported",
    successStatuses: [200],
  },
  completeCampaign: {
    method: "POST",
    path: "/v1/notifications/campaigns/{id}/complete",
    tokenProfiles: ["client_access_v1"],
    requiredCapability: "notifications:campaigns/{id}:manage",
    availability: ["sandbox","live"],
    idempotency: "unsupported",
    successStatuses: [200],
  },
  createBroadcast: {
    method: "POST",
    path: "/v1/notifications/broadcasts",
    tokenProfiles: ["client_access_v1"],
    requiredCapability: "notifications:broadcasts/*:manage",
    availability: ["sandbox","live"],
    idempotency: "unsupported",
    successStatuses: [201],
  },
  createCampaign: {
    method: "POST",
    path: "/v1/notifications/campaigns",
    tokenProfiles: ["client_access_v1"],
    requiredCapability: "notifications:campaigns/*:manage",
    availability: ["sandbox","live"],
    idempotency: "unsupported",
    successStatuses: [201],
  },
  createNotificationTemplate: {
    method: "POST",
    path: "/v1/notifications/templates",
    tokenProfiles: ["client_access_v1"],
    requiredCapability: "notifications:templates/*:manage",
    availability: ["sandbox","live"],
    idempotency: "unsupported",
    successStatuses: [201],
  },
  getBroadcast: {
    method: "GET",
    path: "/v1/notifications/broadcasts/{id}",
    tokenProfiles: ["client_access_v1"],
    requiredCapability: "notifications:broadcasts/{id}:read",
    availability: ["sandbox","live"],
    idempotency: "not_applicable",
    successStatuses: [200],
  },
  getBroadcastAnalytics: {
    method: "GET",
    path: "/v1/notifications/analytics/broadcasts/{id}",
    tokenProfiles: ["client_access_v1"],
    requiredCapability: "notifications:analytics/*:read",
    availability: ["sandbox","live"],
    idempotency: "not_applicable",
    successStatuses: [200],
  },
  getCampaign: {
    method: "GET",
    path: "/v1/notifications/campaigns/{id}",
    tokenProfiles: ["client_access_v1"],
    requiredCapability: "notifications:campaigns/{id}:read",
    availability: ["sandbox","live"],
    idempotency: "not_applicable",
    successStatuses: [200],
  },
  getChannelAnalytics: {
    method: "GET",
    path: "/v1/notifications/analytics/channel/{channel}",
    tokenProfiles: ["client_access_v1"],
    requiredCapability: "notifications:analytics/*:read",
    availability: ["sandbox","live"],
    idempotency: "not_applicable",
    successStatuses: [200],
  },
  getEmailConfiguration: {
    method: "GET",
    path: "/v1/notifications/email/config",
    tokenProfiles: ["client_access_v1"],
    requiredCapability: "notifications:email-config/*:read",
    availability: ["sandbox","live"],
    idempotency: "not_applicable",
    successStatuses: [200],
  },
  getEmailEvent: {
    method: "GET",
    path: "/v1/notifications/email/events/{id}",
    tokenProfiles: ["client_access_v1"],
    requiredCapability: "notifications:email-events/{id}:read",
    availability: ["sandbox","live"],
    idempotency: "not_applicable",
    successStatuses: [200],
  },
  getNotificationAnalytics: {
    method: "GET",
    path: "/v1/notifications/analytics",
    tokenProfiles: ["client_access_v1"],
    requiredCapability: "notifications:analytics/*:read",
    availability: ["sandbox","live"],
    idempotency: "not_applicable",
    successStatuses: [200],
  },
  getNotificationTemplate: {
    method: "GET",
    path: "/v1/notifications/templates/{slug}",
    tokenProfiles: ["client_access_v1"],
    requiredCapability: "notifications:templates/{slug}:read",
    availability: ["sandbox","live"],
    idempotency: "not_applicable",
    successStatuses: [200],
  },
  listBroadcasts: {
    method: "GET",
    path: "/v1/notifications/broadcasts",
    tokenProfiles: ["client_access_v1"],
    requiredCapability: "notifications:broadcasts/*:read",
    availability: ["sandbox","live"],
    idempotency: "not_applicable",
    successStatuses: [200],
  },
  listCampaignExecutions: {
    method: "GET",
    path: "/v1/notifications/campaigns/{id}/executions",
    tokenProfiles: ["client_access_v1"],
    requiredCapability: "notifications:campaigns/{id}:read",
    availability: ["sandbox","live"],
    idempotency: "not_applicable",
    successStatuses: [200],
  },
  listCampaigns: {
    method: "GET",
    path: "/v1/notifications/campaigns",
    tokenProfiles: ["client_access_v1"],
    requiredCapability: "notifications:campaigns/*:read",
    availability: ["sandbox","live"],
    idempotency: "not_applicable",
    successStatuses: [200],
  },
  listNotificationTemplates: {
    method: "GET",
    path: "/v1/notifications/templates",
    tokenProfiles: ["client_access_v1"],
    requiredCapability: "notifications:templates/*:read",
    availability: ["sandbox","live"],
    idempotency: "not_applicable",
    successStatuses: [200],
  },
  pauseCampaign: {
    method: "POST",
    path: "/v1/notifications/campaigns/{id}/pause",
    tokenProfiles: ["client_access_v1"],
    requiredCapability: "notifications:campaigns/{id}:manage",
    availability: ["sandbox","live"],
    idempotency: "unsupported",
    successStatuses: [200],
  },
  previewNotificationTemplate: {
    method: "POST",
    path: "/v1/notifications/templates/{slug}/preview",
    tokenProfiles: ["client_access_v1"],
    requiredCapability: "notifications:templates/{slug}:read",
    availability: ["sandbox","live"],
    idempotency: "unsupported",
    successStatuses: [200],
  },
  previewNotificationTemplateBody: {
    method: "POST",
    path: "/v1/notifications/templates/preview",
    tokenProfiles: ["client_access_v1"],
    requiredCapability: "notifications:templates/*:read",
    availability: ["sandbox","live"],
    idempotency: "unsupported",
    successStatuses: [200],
  },
  sendBroadcast: {
    method: "POST",
    path: "/v1/notifications/broadcasts/{id}/send",
    tokenProfiles: ["client_access_v1"],
    requiredCapability: "notifications:broadcasts/{id}:manage",
    availability: ["sandbox","live"],
    idempotency: "unsupported",
    successStatuses: [202],
  },
  sendEmail: {
    method: "POST",
    path: "/v1/notifications/email/send",
    tokenProfiles: ["client_access_v1"],
    requiredCapability: "notifications:messages/*:send",
    availability: ["sandbox","live"],
    idempotency: "optional",
    successStatuses: [202],
  },
  sendNotification: {
    method: "POST",
    path: "/v1/notifications/messages",
    tokenProfiles: ["client_access_v1"],
    requiredCapability: "notifications:messages/*:send",
    availability: ["sandbox","live"],
    idempotency: "unsupported",
    successStatuses: [202],
  },
  testNotificationTemplate: {
    method: "POST",
    path: "/v1/notifications/templates/{slug}/test",
    tokenProfiles: ["client_access_v1"],
    requiredCapability: "notifications:templates/{slug}:manage",
    availability: ["sandbox","live"],
    idempotency: "unsupported",
    successStatuses: [200],
  },
  updateCampaign: {
    method: "PATCH",
    path: "/v1/notifications/campaigns/{id}",
    tokenProfiles: ["client_access_v1"],
    requiredCapability: "notifications:campaigns/{id}:manage",
    availability: ["sandbox","live"],
    idempotency: "unsupported",
    successStatuses: [200],
  },
  updateEmailConfiguration: {
    method: "PUT",
    path: "/v1/notifications/email/config",
    tokenProfiles: ["client_access_v1"],
    requiredCapability: "notifications:email-config/*:manage",
    availability: ["sandbox","live"],
    idempotency: "unsupported",
    successStatuses: [200],
  },
  updateNotificationTemplate: {
    method: "PUT",
    path: "/v1/notifications/templates/{id}",
    tokenProfiles: ["client_access_v1"],
    requiredCapability: "notifications:templates/{id}:manage",
    availability: ["sandbox","live"],
    idempotency: "unsupported",
    successStatuses: [200],
  },
} as const;
