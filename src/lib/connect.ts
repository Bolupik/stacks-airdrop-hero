// @stacks/connect pulls in Lit web components that touch browser globals at
// import time. The SSR ternary is constant-folded so the server bundle never
// includes the module at all.
export function loadConnect(): Promise<typeof import("@stacks/connect")> {
  return import.meta.env.SSR
    ? Promise.reject(new Error("@stacks/connect is browser-only"))
    : import("@stacks/connect");
}
