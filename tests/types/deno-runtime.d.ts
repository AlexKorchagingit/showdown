/** Minimal type contract for APIs used by our Edge function; not a runtime shim. */
declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (request: Request) => Response | Promise<Response>): unknown;
};
