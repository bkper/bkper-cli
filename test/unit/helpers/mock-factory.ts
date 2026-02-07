import { MockBkper, MockApp, AppData } from './mock-interfaces.js';

// Mock auth service
export const mockGetOAuthToken = async (): Promise<string> => 'mock-token';

// Legacy setup function - no longer needs Module interception since MCP was removed.
// Kept for backward compatibility with existing tests that call it.
export function setupMocks(): void {
    // No-op: the globalThis.__mockBkper pattern via setMockBkper() is sufficient
}

// Factory for creating MockBkper instances for apps listing
export function createMockBkperForApps(apps: AppData[]): MockBkper {
    return {
        setConfig: () => {},
        getApps: async (): Promise<MockApp[]> => {
            return apps.map((appData: AppData) => ({
                json: (): AppData => appData,
                getId: (): string | undefined => appData.id,
                getName: (): string | undefined => appData.name,
                isPublished: (): boolean => appData.published || false,
            }));
        },
    };
}

// Set the mock in the module system
export function setMockBkper(mockBkper: MockBkper) {
    // This function updates the global mock that will be used by tests
    // We'll use a global variable to store the current mock
    (globalThis as any).__mockBkper = mockBkper;
}
