import type {ProgramStatus} from '@earendil-works/pi-tui';
import {ProcessTerminal} from '../pi-shared-modules.js';

/** Brand Pi's terminal identity without changing its status lifecycle or user settings. */
export class BkperTerminal extends ProcessTerminal {
    override setTitle(title: string): void {
        super.setTitle(title.replace(/^π - /, 'bkper - '));
    }

    override setProgramStatus(status: ProgramStatus): void {
        super.setProgramStatus(
            status.app === 'pi' ? {...status, app: 'bkper'} : status
        );
    }
}
