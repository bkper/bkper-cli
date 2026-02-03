export interface Env {
    API_KEY: string;
}

export default {
    async fetch(request: Request, env: Env): Promise<Response> {
        return new Response(`API Key: ${env.API_KEY}`);
    },
};
