export interface Env {
    KV: KVNamespace;
}

export default {
    async fetch(request: Request, env: Env): Promise<Response> {
        const url = new URL(request.url);
        if (url.pathname === '/set') {
            await env.KV.put('test', 'value');
            return new Response('Set');
        }
        if (url.pathname === '/get') {
            const value = await env.KV.get('test');
            return new Response(`Value: ${value}`);
        }
        return new Response('KV Worker');
    },
};
