import { describe, expect, mock, spyOn, test } from "bun:test";
import fastifyJWT from "@fastify/jwt";
import { SupabaseClient } from "@supabase/supabase-js";
import { createSigner } from "fast-jwt";
import Fastify from "fastify";
import fastifySupabase from "../src";

const JWT_SECRET = "super-secret-jwt-token-with-at-least-32-characters-long";
const SERVICE_ROLE_TOKEN =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSJ9.vI9obAHOGyVVKa3pD--kJlyxp-Z2zV9UUMAhKpNLAcU";
const ANON_TOKEN =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24ifQ.625_WdcF3KHqz5amU0x2X5WWHP-OEs_4qj0ssLNHzTs";
const signer = createSigner({ key: JWT_SECRET });
const USER_ROLE_TOKEN = signer({ role: "authenticated" });

declare module "fastify" {
  export interface FastifyRequest {
    supabaseClient: SupabaseClient;
  }
}

const createTestServer = () => {
  const fastify = Fastify();

  fastify.register(fastifyJWT, {
    secret: JWT_SECRET,
  });

  fastify.addHook("onRequest", async (request, reply) => {
    try {
      await request.jwtVerify();
    } catch (err) {
      reply.send(err);
    }
  });

  fastify.register(fastifySupabase, {
    url: "https://test.com",
    anonKey: ANON_TOKEN,
    serviceKey: SERVICE_ROLE_TOKEN,
  });

  return fastify;
};

describe("fastify-supabase", () => {
  test("register", async () => {
    const fastify = Fastify();

    fastify.register(fastifyJWT, {
      secret: JWT_SECRET,
    });

    fastify.register(fastifySupabase, {
      url: "https://test.com",
      anonKey: "anon-key",
      serviceKey: "service-key",
    });

    fastify.register(fastifySupabase, {
      url: "https://test.com",
      anonKey: "anon-key",
      serviceKey: "service-key",
    });

    // .rejects does not work in bun yet: https://github.com/oven-sh/bun/issues/5602
    // await expect(fastify.ready()).rejects.toBe(
    //     "fastify-supabase has already been registered"
    // );
    const spy = spyOn(fastify, "ready");
    try {
      await fastify.ready();
    } catch (err) {
      expect(err).toEqual(
        new Error("fastify-supabase has already been registered"),
      );
    }
    expect(spy).toHaveBeenCalledTimes(1);

    expect(fastify.supabaseClient).toBeTruthy();
  });

  test("service role", async () => {
    const tracker = mock(() => {
      // noop
    });

    const fastify = createTestServer();

    fastify.get("/methods", (request, reply) => {
      expect(request.supabaseClient).toEqual(fastify.supabaseClient);
      tracker();
      reply.send();
    });

    await fastify.inject({
      method: "get",
      url: "/methods",
      headers: {
        authorization: `Bearer ${SERVICE_ROLE_TOKEN}`,
      },
    });

    expect(tracker).toHaveBeenCalledTimes(1);
  });

  test("anon role", async () => {
    const tracker = mock(() => {
      // noop
    });

    const fastify = createTestServer();

    fastify.get("/methods", (request, reply) => {
      expect(() => request.supabaseClient).toThrow(
        "Authorization token is invalid",
      );
      tracker();
      reply.send();
    });

    await fastify.inject({
      method: "get",
      url: "/methods",
      headers: {
        authorization: `Bearer ${ANON_TOKEN}`,
      },
    });
    expect(tracker).toHaveBeenCalledTimes(1);
  });

  test("user role", async () => {
    const tracker = mock(() => {
      // noop
    });

    const fastify = createTestServer();

    fastify.get("/methods", (request, reply) => {
      // biome-ignore lint/complexity/useLiteralKeys: we want to make typescript happy
      expect(request.supabaseClient["supabaseKey"]).toEqual(USER_ROLE_TOKEN);
      tracker();
      reply.send();
    });

    await fastify.inject({
      method: "get",
      url: "/methods",
      headers: {
        authorization: `Bearer ${USER_ROLE_TOKEN}`,
      },
    });

    expect(tracker).toHaveBeenCalledTimes(1);
  });

  test("client cache", async () => {
    const tracker = mock(() => {
      // noop
    });

    const fastify = createTestServer();

    fastify.get("/methods", (request, reply) => {
      request._supabaseClient = "test" as unknown as SupabaseClient;
      // biome-ignore lint/suspicious/noExplicitAny: we want to make typescript happy
      expect(request.supabaseClient as any).toEqual("test");
      tracker();
      reply.send();
    });

    await fastify.inject({
      method: "get",
      url: "/methods",
      headers: {
        authorization: `Bearer ${USER_ROLE_TOKEN}`,
      },
    });
    expect(tracker).toHaveBeenCalledTimes(1);
  });
});
