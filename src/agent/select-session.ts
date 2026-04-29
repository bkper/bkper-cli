import {
    SessionSelectorComponent,
    SessionManager,
    type SessionInfo,
} from '@mariozechner/pi-coding-agent';
import {
    ProcessTerminal,
    TUI,
} from '@mariozechner/pi-tui';

type ProgressCallback = (loaded: number, total: number) => void;

export async function selectSession(
    currentSessionsLoader: (onProgress?: ProgressCallback) => Promise<SessionInfo[]>,
    allSessionsLoader: (onProgress?: ProgressCallback) => Promise<SessionInfo[]>
): Promise<string | null> {
    return new Promise((resolve) => {
        const ui = new TUI(new ProcessTerminal());
        let resolved = false;

        const selector = new SessionSelectorComponent(
            currentSessionsLoader,
            allSessionsLoader,
            (path) => {
                if (!resolved) {
                    resolved = true;
                    ui.stop();
                    resolve(path);
                }
            },
            () => {
                if (!resolved) {
                    resolved = true;
                    ui.stop();
                    resolve(null);
                }
            },
            () => {
                ui.stop();
                process.exit(0);
            },
            () => ui.requestRender(),
            {showRenameHint: false}
        );

        ui.addChild(selector);
        ui.setFocus(selector.getSessionList());
        ui.start();
    });
}
