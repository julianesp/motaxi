// Middleware de Clerk desactivado — autenticación manejada por el propio backend
// import { clerkMiddleware } from "@clerk/nextjs/server";
// export const proxy = clerkMiddleware();

export function proxy() {}

export const config = {
  matcher: [],
};
