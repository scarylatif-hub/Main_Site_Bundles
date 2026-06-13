import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    openapi: "3.0.3",
    info: {
      title: "SB Bundles Agent API",
      version: "1.0.0",
      description:
        "Agent integration endpoints for SB Bundles main site. Use X-API-KEY for all requests and Authorization Bearer Agent JWT for protected endpoints.",
    },
    servers: [
      {
        url: process.env.MASTER_SITE_URL ?? "https://sbbundles-main.vercel.app/",
      },
    ],
    components: {
      securitySchemes: {
        ApiKeyAuth: {
          type: "apiKey",
          in: "header",
          name: "x-api-key",
        },
        AgentJWT: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
    },
    paths: {
      "/api/agent/packages": {
        get: {
          summary: "Agent package list",
          security: [{ ApiKeyAuth: [] }],
          responses: {
            "200": {
              description: "Available data packages",
            },
            "401": {
              description: "Invalid or missing API key",
            },
          },
        },
      },
      "/api/agent/buy-data": {
        post: {
          summary: "Create an agent store order",
          security: [{ ApiKeyAuth: [], AgentJWT: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    recipient_msisdn: { type: "string" },
                    package_id: { type: ["string", "number"] },
                    network_id: { type: "number" },
                    provider_network_id: { type: "number" },
                    amount: { type: "number" },
                    payment_reference: { type: "string" },
                    email: { type: "string" },
                    customer_name: { type: "string" },
                  },
                  required: [
                    "recipient_msisdn",
                    "package_id",
                    "network_id",
                    "amount",
                    "payment_reference",
                  ],
                },
              },
            },
          },
          responses: {
            "200": { description: "Order created or already processed" },
            "400": { description: "Invalid request parameters" },
            "401": { description: "Invalid API key or JWT" },
            "402": { description: "Payment verification failed" },
            "502": { description: "Provider delivery failed" },
          },
        },
      },
      "/api/agent/orders": {
        get: {
          summary: "List agent store orders",
          security: [{ ApiKeyAuth: [], AgentJWT: [] }],
          responses: {
            "200": { description: "Orders for this agent store" },
            "401": { description: "Invalid API key or JWT" },
          },
        },
      },
      "/api/agent/earnings": {
        get: {
          summary: "Agent earnings summary",
          security: [{ ApiKeyAuth: [], AgentJWT: [] }],
          responses: {
            "200": { description: "Earnings data" },
            "401": { description: "Invalid API key or JWT" },
          },
        },
      },
      "/api/agent/customers": {
        get: {
          summary: "Agent store customers",
          security: [{ ApiKeyAuth: [], AgentJWT: [] }],
          responses: {
            "200": { description: "List of unique customers" },
            "401": { description: "Invalid API key or JWT" },
          },
        },
      },
      "/api/agent/profile": {
        get: {
          summary: "Agent store profile",
          security: [{ ApiKeyAuth: [], AgentJWT: [] }],
          responses: {
            "200": { description: "Store profile data" },
            "401": { description: "Invalid API key or JWT" },
          },
        },
      },
      "/api/agent/prices": {
        get: {
          summary: "Store-specific package prices",
          security: [{ ApiKeyAuth: [], AgentJWT: [] }],
          responses: {
            "200": { description: "Store package pricing" },
            "401": { description: "Invalid API key or JWT" },
          },
        },
      },
    },
  });
}
