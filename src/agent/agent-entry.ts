#!/usr/bin/env node

import './pi-package-env.js'; // Must be first: Pi reads PI_PACKAGE_DIR while its modules load
import { runAgentCommand } from '../commands/agent-command.js';

runAgentCommand(process.argv.slice(2)).catch(err => {
    console.error('Error running agent command:', err);
    process.exit(1);
});
