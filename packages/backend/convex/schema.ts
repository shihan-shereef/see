import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// Multi-tenant: resources carry workspaceId. It is `optional` on pre-existing tables only so
// deploys don't fail validation against pre-migration rows; the function layer always sets it.
export default defineSchema({
  ...authTables,
  users: defineTable({
    name: v.optional(v.string()),
    image: v.optional(v.string()),
    email: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
    phone: v.optional(v.string()),
    phoneVerificationTime: v.optional(v.number()),
    isAnonymous: v.optional(v.boolean()),
    username: v.optional(v.string()),
    imageId: v.optional(v.id("_storage")),
  }).index("email", ["email"]),

  events: defineTable({
    workspaceId: v.optional(v.id("workspaces")),
    source: v.string(),
    type: v.string(),
    payload: v.any(),
    receivedAt: v.number(),
  })
    .index("by_received", ["receivedAt"])
    .index("by_workspace", ["workspaceId"]),

  jobs: defineTable({
    workspaceId: v.optional(v.id("workspaces")),
    userId: v.id("users"),
    kind: v.string(),
    status: v.string(),
    input: v.optional(v.any()),
    result: v.optional(v.any()),
    error: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_workspace", ["workspaceId"]),

  auditLogs: defineTable({
    workspaceId: v.optional(v.id("workspaces")),
    userId: v.id("users"),
    action: v.string(),
    meta: v.optional(v.any()),
    at: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_workspace", ["workspaceId"]),

  usage: defineTable({
    workspaceId: v.optional(v.id("workspaces")),
    userId: v.optional(v.id("users")),
    metric: v.string(),
    count: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user_metric", ["userId", "metric"])
    .index("by_workspace_metric", ["workspaceId", "metric"]),

  apiKeys: defineTable({
    workspaceId: v.optional(v.id("workspaces")),
    userId: v.id("users"),
    name: v.string(),
    prefix: v.string(),
    hash: v.string(),
    revoked: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_workspace", ["workspaceId"])
    .index("by_hash", ["hash"]),

  // Files (workspace-scoped). Stored in Convex file storage; row holds metadata.
  files: defineTable({
    workspaceId: v.id("workspaces"),
    userId: v.id("users"),
    name: v.string(),
    storageId: v.id("_storage"),
    size: v.number(),
    contentType: v.string(),
    createdAt: v.number(),
  }).index("by_workspace", ["workspaceId"]),

  workspaces: defineTable({
    name: v.string(),
    ownerId: v.id("users"),
    createdAt: v.number(),
  }),
  members: defineTable({
    workspaceId: v.id("workspaces"),
    userId: v.id("users"),
    role: v.string(),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_workspace", ["workspaceId"])
    .index("by_user_workspace", ["userId", "workspaceId"]),
  invites: defineTable({
    workspaceId: v.id("workspaces"),
    email: v.string(),
    role: v.string(),
    invitedBy: v.id("users"),
    accepted: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_email", ["email"]),

  notifications: defineTable({
    userId: v.id("users"),
    type: v.string(),
    title: v.string(),
    body: v.optional(v.string()),
    read: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_read", ["userId", "read"]),

  // Maintained counters so dashboard.stats is O(1) instead of scanning every row.
  counters: defineTable({
    workspaceId: v.id("workspaces"),
    metric: v.string(),
    value: v.number(),
  }).index("by_workspace_metric", ["workspaceId", "metric"]),

  seoAudits: defineTable({
    workspaceId: v.id("workspaces"),
    userId: v.id("users"),
    url: v.string(),
    score: v.number(),
    status: v.string(), // "pending" | "running" | "completed" | "failed"
    error: v.optional(v.string()),
    createdAt: v.number(),
    completedAt: v.optional(v.number()),

    // Core meta metrics
    title: v.optional(v.string()),
    titleLength: v.optional(v.number()),
    description: v.optional(v.string()),
    descriptionLength: v.optional(v.number()),

    // Heading counts & outline
    headings: v.optional(
      v.object({
        h1: v.array(v.string()),
        h2: v.array(v.string()),
        h3: v.array(v.string()),
        h4: v.array(v.string()),
        h5: v.array(v.string()),
        h6: v.array(v.string()),
      })
    ),

    // Social Graph
    ogTitle: v.optional(v.string()),
    ogDescription: v.optional(v.string()),
    ogImage: v.optional(v.string()),
    twitterCard: v.optional(v.string()),

    // Standard items
    hasViewport: v.boolean(),
    hasFavicon: v.boolean(),
    canonicalUrl: v.optional(v.string()),

    // Media & links
    totalImages: v.number(),
    imagesWithAlt: v.number(),
    imagesWithoutAlt: v.array(v.string()),
    totalLinks: v.number(),
    internalLinks: v.number(),
    externalLinks: v.number(),

    // Actionable list
    recommendations: v.array(
      v.object({
        category: v.string(), // "meta" | "headings" | "social" | "mobile" | "media" | "links"
        severity: v.string(), // "critical" | "warning" | "info"
        message: v.string(),
        suggestion: v.string(),
      })
    ),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_workspace_url", ["workspaceId", "url"]),
});
