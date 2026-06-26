#!/usr/bin/env node

import { runAgentCommand } from '../commands/agent-command.js';

runAgentCommand(process.argv.slice(2)).catch(err => {
    console.error('Error running agent command:', err);
    process.exit(1);
});
