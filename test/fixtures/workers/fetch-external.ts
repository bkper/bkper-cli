export default {
    async fetch(): Promise<Response> {
        return fetch('https://api.bkper.app/v5/books');
    },
};
