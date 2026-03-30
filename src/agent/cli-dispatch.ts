export function shouldRunAgentCommand(argv: string[]): boolean {
    return argv[2] === 'agent';
}
