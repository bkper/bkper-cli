export default {
    async fetch(request: Request): Promise<Response> {
        return Response.json({
            authorization: request.headers.get('Authorization'),
            bkperOauthToken: request.headers.get('bkper-oauth-token'),
            bkperAgentId: request.headers.get('bkper-agent-id'),
            cookie: request.headers.get('Cookie'),
            customHeader: request.headers.get('x-app-header'),
        });
    },
};
