# Supabase Plugin for Fastify

A Fastify plugin to use authenticated Supabase clients in your API.

<a href="https://github.com/psteinroe/fastify-supabase/actions/workflows/ci.yml"><img src="https://github.com/psteinroe/fastify-supabase/actions/workflows/ci.yml/badge.svg?branch=main" alt="Latest build" target="\_parent"></a>
<a href="https://github.com/psteinroe/fastify-supabase"><img src="https://img.shields.io/github/stars/psteinroe/fastify-supabase.svg?style=social&amp;label=Star" alt="GitHub Stars" target="\_parent"></a>

## Installation

Install with your favorite package manager.

```bash
pnpm add @psteinroe/fastify-supabase
```

## Quick Start

First, register `@fastify/jwt` with your Supabase JWT secret. You can obtain it from Supabase Studio.

```ts
import fastifyJWT from "@fastify/jwt";

fastify.register(fastifyJWT, {
  secret: SUPABASE_JWT_SECRET,
});
```

Then, register the Supabase plugin.

```ts
import fastifySupabase from "@psteinroe/fastify-supabase";

fastify.register(fastifySupabase, {
  url: SUPABASE_URL,
  anonKey: SUPABASE_ANON_KEY,
  serviceKey: SUPABASE_SERVICE_KEY,
  // you can pass any `SupabaseClientOptions`
  options: {},
});
```

You can now access a `SupabaseClient` authenticated as the service role directly on the Fastify instance with `fastify.supabaseClient`.

To protect a route and use a user-authenticated `SupabaseClient`, create a `onRequest` route handler to verify the JWT. Note that this is a `@fastify/jwt` feature.

```ts
import { onRequestHookHandler } from "fastify";

export const verifyApiKey: onRequestHookHandler = async (request) => {
  await request.jwtVerify();
};
```

Now pass the hook to the route handler. You can now access either a client authenticated with the service role via the Fastify instance, or a user-authenticated client via the request. Thanks to `@fastify/jwt`, you can also access the Supabase `User` object on the request.

```ts
import { FastifyInstance } from "fastify";

import { verifyApiKey } from "../helpers/verify";

export default async function routes(fastify: FastifyInstance) {
  fastify.get("/health", {
    onRequest: [verifyApiKey],
    handler: async (request, reply) => {
      // authenticated as the user that is making the request
      const { data } = request.supabaseClient.from("article").select("*");

      // authenticated with service role
      const { data } = fastify.supabaseClient.from("article").select("*");

      // access the `User` object on the request
      const tenantId = request.user.app_metadata.tenantId;

      return reply.send("OK");
    },
  });
}
```

Thats it!

---

Fastify Supabase is created by [psteinroe](https://github.com/psteinroe).
Follow [@psteinroe](https://twitter.com/psteinroe) on Twitter for future project updates.
