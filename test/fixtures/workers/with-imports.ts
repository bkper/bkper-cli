// Tests that cloudflare: and node: are externalized
// Note: These imports are for testing externalization - they won't resolve at build time
// but the plugin should mark them as external before resolution fails

// Value import from cloudflare:workers - will be externalized
import { DurableObjectState } from "cloudflare:workers";

// Value import from node:buffer - will be externalized
import { Buffer } from "node:buffer";

export default {
    async fetch(request: Request): Promise<Response> {
        // Reference the imports to prevent tree-shaking
        const hasState = typeof DurableObjectState !== "undefined";
        const hasBuffer = typeof Buffer !== "undefined";
        return new Response(`State: ${hasState}, Buffer: ${hasBuffer}`);
    }
};
