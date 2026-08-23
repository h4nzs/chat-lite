// Copyright (c) 2026 [han]. All rights reserved.
// This file is part of NYX, licensed under the AGPL-3.0.
// For commercial licensing, contact [admin@nyx-app.my.id].
import { Router, Request, Response } from "express";

const router = Router();

// =========================================================
// RFC 9727 API Catalog — Automated API Discovery
// Returns a Linkset (RFC 9264) describing available APIs
// =========================================================
router.get("/api-catalog", (_req: Request, res: Response) => {
  res.type("application/linkset+json").json({
    linkset: [
      {
        anchor: "https://api.nyx-app.my.id",
        "service-doc": [
          { href: "https://nyx-app.my.id/api-docs" }
        ],
        "status": [
          { href: "https://api.nyx-app.my.id/health" }
        ]
      },
      {
        anchor: "https://api.nyx-app.my.id/api/auth",
        "service-doc": [
          { href: "https://nyx-app.my.id/api-docs" }
        ],
        "status": [
          { href: "https://api.nyx-app.my.id/health" }
        ]
      },
      {
        anchor: "https://api.nyx-app.my.id/api/users",
        "service-doc": [
          { href: "https://nyx-app.my.id/api-docs" }
        ],
        "status": [
          { href: "https://api.nyx-app.my.id/health" }
        ]
      },
      {
        anchor: "https://api.nyx-app.my.id/api/conversations",
        "service-doc": [
          { href: "https://nyx-app.my.id/api-docs" }
        ],
        "status": [
          { href: "https://api.nyx-app.my.id/health" }
        ]
      },
      {
        anchor: "https://api.nyx-app.my.id/api/messages",
        "service-doc": [
          { href: "https://nyx-app.my.id/api-docs" }
        ],
        "status": [
          { href: "https://api.nyx-app.my.id/health" }
        ]
      }
    ]
  });
});

// =========================================================
// OAuth 2.0 / OpenID Connect Discovery (RFC 8414)
// Describes the NYX authentication server metadata for AI agents
// =========================================================
router.get("/openid-configuration", (_req: Request, res: Response) => {
  res.json({
    issuer: "https://api.nyx-app.my.id",
    authorization_endpoint: "https://api.nyx-app.my.id/api/auth/login",
    token_endpoint: "https://api.nyx-app.my.id/api/auth/refresh",
    registration_endpoint: "https://api.nyx-app.my.id/api/auth/register",
    scopes_supported: ["openid", "profile"],
    response_types_supported: ["token"],
    grant_types_supported: [
      "password",
      "refresh_token"
    ],
    token_endpoint_auth_methods_supported: [
      "client_secret_post"
    ],
    subject_types_supported: ["public"],
    // Note: jwks_uri intentionally omitted — NYX uses HMAC-signed JWTs (not JWK),
    // and the JWT secret is never exposed. See API docs for auth details.
    service_documentation: "https://nyx-app.my.id/api-docs"
  });
});

// =========================================================
// OAuth 2.0 Authorization Server Metadata (RFC 8414)
// Alternative path for pure OAuth 2.0 (vs OpenID Connect)
// Includes agent_auth block for Auth.md registration flow
// =========================================================
router.get("/oauth-authorization-server", (_req: Request, res: Response) => {
  res.json({
    issuer: "https://api.nyx-app.my.id",
    authorization_endpoint: "https://api.nyx-app.my.id/api/auth/login",
    token_endpoint: "https://api.nyx-app.my.id/api/auth/refresh",
    registration_endpoint: "https://api.nyx-app.my.id/api/auth/register",
    scopes_supported: ["openid", "profile"],
    response_types_supported: ["token"],
    grant_types_supported: ["password", "refresh_token"],
    token_endpoint_auth_methods_supported: ["client_secret_post"],
    subject_types_supported: ["public"],
    service_documentation: "https://nyx-app.my.id/api-docs",
    agent_auth: {
      skill: "https://isitagentready.com/.well-known/agent-skills/auth-md/SKILL.md",
      register_uri: "https://app.nyx-app.my.id/register",
      identity_types_supported: ["identity_assertion"],
      identity_assertion: {
        assertion_types_supported: ["verified_email"],
        credential_types_supported: ["urn:ietf:params:oauth:token-type:access_token"],
        claim_uri: "https://api.nyx-app.my.id/api/users/me"
      }
    }
  });
});

// =========================================================
// OAuth Protected Resource Metadata (RFC 9728)
// Describes how agents can obtain tokens for this resource
// =========================================================
router.get("/oauth-protected-resource", (_req: Request, res: Response) => {
  res.json({
    resource: "https://nyx-app.my.id",
    authorization_servers: [
      "https://api.nyx-app.my.id"
    ],
    scopes_supported: [
      "openid",
      "profile"
    ],
    bearer_methods_supported: [
      "header",
      "cookie"
    ],
    resource_documentation: "https://nyx-app.my.id/api-docs"
  });
});

// =========================================================
// MCP Server Card (SEP-1649) — Model Context Protocol Discovery
// =========================================================
router.get("/mcp/server-card.json", (_req: Request, res: Response) => {
  res.json({
    schemaVersion: "0.1.0",
    serverInfo: {
      name: "NYX Chat API",
      version: "2.0.0"
    },
    // NOTE: There is intentionally NO server-side MCP transport endpoint.
    // WebMCP tools live CLIENT-side (web/src/main.tsx registers them via
    // navigator.modelContext), so agents reach NYX through the browser,
    // not through a remote MCP HTTP server. The previously advertised
    // https://api.nyx-app.my.id/api/ai/mcp never existed as a route.
    capabilities: {
      tools: {
        enabled: true,
        list: [
          {
            name: "send_message",
            description: "Send an encrypted message to a conversation",
            inputSchema: {
              type: "object",
              properties: {
                conversationId: { type: "string", description: "Target conversation ID" },
                content: { type: "string", description: "Message content" }
              },
              required: ["conversationId", "content"]
            }
          },
          {
            name: "list_conversations",
            description: "List all conversations for the authenticated user",
            inputSchema: {
              type: "object",
              properties: {
                limit: { type: "integer", description: "Max results", default: 20 }
              }
            }
          },
          {
            name: "get_messages",
            description: "Get messages from a conversation",
            inputSchema: {
              type: "object", 
              properties: {
                conversationId: { type: "string", description: "Conversation ID" },
                limit: { type: "integer", description: "Max messages", default: 50 }
              },
              required: ["conversationId"]
            }
          }
        ]
      },
      resources: {
        enabled: false
      },
      prompts: {
        enabled: false
      }
    },
    authentication: {
      type: "bearer-token",
      endpoint: "https://api.nyx-app.my.id/api/auth/login"
    }
  });
});

// =========================================================
// Agent Skills Discovery Index
// =========================================================
router.get("/agent-skills/index.json", (_req: Request, res: Response) => {
  res.json({
    $schema: "https://agentskills.io/schemas/index.json",
    version: "0.2.0",
    skills: [
      {
        name: "link-headers",
        type: "http-header",
        description: "Link response headers for agent discovery (RFC 8288)",
        url: "https://isitagentready.com/.well-known/agent-skills/link-headers/SKILL.md",
        sha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
      },
      {
        name: "content-signals",
        type: "robots-txt",
        description: "AI content usage preferences via Content-Signal directives",
        url: "https://isitagentready.com/.well-known/agent-skills/content-signals/SKILL.md",
        sha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
      },
      {
        name: "api-catalog",
        type: "well-known",
        description: "API catalog for automated API discovery (RFC 9727)",
        url: "https://isitagentready.com/.well-known/agent-skills/api-catalog/SKILL.md",
        sha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
      },
      {
        name: "oauth-discovery",
        type: "well-known",
        description: "OAuth/OIDC discovery metadata for agent authentication (RFC 8414)",
        url: "https://isitagentready.com/.well-known/agent-skills/oauth-discovery/SKILL.md",
        sha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
      },
      {
        name: "oauth-protected-resource",
        type: "well-known",
        description: "OAuth Protected Resource Metadata for agent authentication (RFC 9728)",
        url: "https://isitagentready.com/.well-known/agent-skills/oauth-protected-resource/SKILL.md",
        sha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
      },
      {
        name: "mcp-server-card",
        type: "well-known",
        description: "MCP Server Card for agent discovery",
        url: "https://isitagentready.com/.well-known/agent-skills/mcp-server-card/SKILL.md",
        sha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
      },
      {
        name: "markdown-negotiation",
        type: "content-negotiation",
        description: "Markdown for Agents: HTML responses as markdown when requested",
        url: "https://isitagentready.com/.well-known/agent-skills/markdown-negotiation/SKILL.md",
        sha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
      },
      {
        name: "auth-md",
        type: "well-known",
        description: "Auth.md metadata for agent registration",
        url: "https://isitagentready.com/.well-known/agent-skills/auth-md/SKILL.md",
        sha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
      },
      {
        name: "webmcp",
        type: "browser-api",
        description: "WebMCP tools exposed to AI agents via the browser (navigator.modelContext)",
        url: "https://isitagentready.com/.well-known/agent-skills/webmcp/SKILL.md",
        sha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
      }
    ]
  });
});

export default router;
