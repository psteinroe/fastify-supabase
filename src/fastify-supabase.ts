import createError from "@fastify/error";
import type { JWT } from "@fastify/jwt";
import {
	SupabaseClient,
	SupabaseClientOptions,
	User,
	createClient,
} from "@supabase/supabase-js";
import type { FastifyRequest } from "fastify";
import fp from "fastify-plugin";

const AuthorizationTokenInvalidError = createError(
	"FST_SB_AUTHORIZATION_TOKEN_INVALID",
	"Authorization token is invalid",
	401
);

const NoUserDataFoundError = createError(
	"FST_SB_NO_USER_DATA_FOUND",
	"No user data found in the request. Make sure to run request.jwtVerify() before trying to access the user.",
	401
);

declare module "fastify" {
	export interface FastifyInstance {
		supabaseClient: SupabaseClient;
		jwt: JWT;
	}
	export interface FastifyRequest {
		_supabaseClient: SupabaseClient | null;
		supabaseClient: SupabaseClient;
		supabaseUser: User;
	}
}

export type FastifySupabasePluginOpts = {
	url: string;
	serviceKey: string;
	anonKey: string;
	options?: SupabaseClientOptions<"public">;
};

const fastifySupabase = fp<FastifySupabasePluginOpts>(
	async (fastify, opts, next) => {
		const { url, serviceKey, anonKey, options } = opts;

		const supabase = createClient(url, serviceKey, options);

		if (fastify.supabaseClient) {
			return next(
				new Error("fastify-supabase has already been registered")
			);
		}

		fastify.decorate("supabaseClient", supabase);

		fastify.decorateRequest("_supabaseClient", null);
		fastify.decorateRequest(
			"supabaseClient",
			{
				getter() {
					const req = this as unknown as FastifyRequest;

					if (req._supabaseClient) return req._supabaseClient;

					if (
						(req.user as { role?: string }).role === "service_role"
					) {
						req._supabaseClient = fastify.supabaseClient;
					} else if (
						(req.user as { role?: string }).role &&
						(req.user as { role?: string }).role !== "anon"
					) {
						const client = createClient(url, anonKey, {
							...options,
							auth: {
								...options?.auth,
								persistSession: false,
							},
							global: {
								...options?.global,
								headers: {
									...options?.global?.headers,
									Authorization: `Bearer ${fastify.jwt.lookupToken(
										req
									)}`,
								},
							},
						});
						req._supabaseClient = client as SupabaseClient;
					}

					if (!req._supabaseClient) {
						throw new AuthorizationTokenInvalidError();
					}

					return req._supabaseClient;
				},
			},
			["user"]
		);

		fastify.decorateRequest(
			"supabaseUser",
			{
				getter() {
					const req = this as unknown as FastifyRequest;

					if (!req.user) {
						throw new NoUserDataFoundError();
					}

					return req.user as User;
				},
			},
			["user"]
		);

		next();
	},
	{
		fastify: "4.x",
		name: "fastify-supabase",
		dependencies: ["@fastify/jwt"],
	}
);

export default fastifySupabase;
