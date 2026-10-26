#!/usr/bin/env node

import './pi-package-env.js'; // Must be first: Pi reads PI_PACKAGE_DIR while its modules load
import { runAgentCommand } from '../commands/agent-command.js';
import { reportAgentCommandError } from './startup-error.js';

runAgentCommand(process.argv.slice(2)).catch(err => {
    reportAgentCommandError(err);
    process.exit(1);
});
