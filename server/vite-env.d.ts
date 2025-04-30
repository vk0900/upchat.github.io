// Extend the Vite module types
import { type Server } from "http";
import { IncomingMessage, ServerResponse } from "http";

declare module "vite" {
  interface ServerOptions {
    middlewareMode?: boolean;
    hmr?: {
      server?: Server<typeof IncomingMessage, typeof ServerResponse>;
    };
    allowedHosts?: boolean | string[] | true;
  }
}