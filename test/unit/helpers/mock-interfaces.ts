// TypeScript interfaces for test data - matches official bkper-api-types exactly

// Group interface (referenced by Book and Account)
export interface Group {
    id?: string;
    name?: string;
    hidden?: boolean;
    properties?: { [name: string]: string };
}

// Collection interface (referenced by Book)
export interface Collection {
    id?: string;
    name?: string;
}

// Official Book interface from bkper-api-types
export interface BookData {
    accounts?: AccountData[];
    agentId?: string;
    autoPost?: boolean;
    closingDate?: string;
    collection?: Collection;
    createdAt?: string;
    datePattern?: string;
    decimalSeparator?: 'DOT' | 'COMMA';
    fractionDigits?: number;
    groups?: Group[];
    id?: string;
    lastUpdateMs?: string;
    lockDate?: string;
    name?: string;
    ownerName?: string;
    pageSize?: number;
    period?: 'MONTH' | 'QUARTER' | 'YEAR';
    periodStartMonth?:
        | 'JANUARY'
        | 'FEBRUARY'
        | 'MARCH'
        | 'APRIL'
        | 'MAY'
        | 'JUNE'
        | 'JULY'
        | 'AUGUST'
        | 'SEPTEMBER'
        | 'OCTOBER'
        | 'NOVEMBER'
        | 'DECEMBER';
    permission?: 'OWNER' | 'EDITOR' | 'POSTER' | 'RECORDER' | 'VIEWER' | 'NONE';
    properties?: { [name: string]: string };
    timeZone?: string;
    timeZoneOffset?: number;
    totalTransactions?: number;
    totalTransactionsCurrentMonth?: number;
    totalTransactionsCurrentYear?: number;
    visibility?: 'PUBLIC' | 'PRIVATE';
}

// Official Account interface from bkper-api-types
export interface AccountData {
    agentId?: string;
    archived?: boolean;
    balance?: string;
    createdAt?: string;
    credit?: boolean;
    groups?: Group[];
    hasTransactionPosted?: boolean;
    id?: string;
    name?: string;
    normalizedName?: string;
    permanent?: boolean;
    properties?: { [name: string]: string };
    type?: 'ASSET' | 'LIABILITY' | 'INCOMING' | 'OUTGOING';
}

// Official Transaction interface from bkper-api-types
export interface TransactionData {
    agentId?: string;
    agentLogo?: string;
    agentLogoDark?: string;
    agentName?: string;
    amount?: string;
    checked?: boolean;
    createdAt?: string;
    createdBy?: string;
    creditAccount?: AccountData;
    date?: string;
    dateFormatted?: string;
    dateValue?: number;
    debitAccount?: AccountData;
    description?: string;
    files?: any[];
    id?: string;
    posted?: boolean;
    properties?: { [name: string]: string };
    remoteIds?: string[];
    tags?: string[];
    trashed?: boolean;
    updatedAt?: string;
    urls?: string[];
}

// Official Balance interface from bkper-api-types (period-based balance data)
export interface BalanceData {
    cumulativeBalance?: string;
    cumulativeCredit?: string;
    cumulativeDebit?: string;
    day?: number;
    fuzzyDate?: number;
    month?: number;
    periodBalance?: string;
    periodCredit?: string;
    periodDebit?: string;
    year?: number;
}

// Group data interface for get_groups tool
export interface GroupData {
    id?: string;
    name?: string;
    type?: 'ASSET' | 'LIABILITY' | 'INCOMING' | 'OUTGOING';
    hidden?: boolean;
    permanent?: boolean;
    parent?: Group;
    properties?: { [name: string]: string };
}

// App data interface for apps list command
export interface AppData {
    id?: string;
    name?: string;
    description?: string;
    published?: boolean;
    installable?: boolean;
    connectable?: boolean;
    deprecated?: boolean;
    ownerName?: string;
    ownerEmail?: string;
    developerEmail?: string;
    website?: string | null;
    logoUrl?: string | null;
    events?: string[];
    webhookUrl?: string;
    webhookUrlDev?: string;
}

// Account Balance data (for account-specific balance queries)
export interface AccountBalanceData {
    account: AccountData;
    balance: string;
    cumulative: string;
}

// Mock interfaces for bkper-js library
export interface MockBook {
    json(): BookData;
    getAccounts?(): Promise<MockAccount[]>;
    getBalancesReport?(query?: string): Promise<MockBalanceReport>;
    listTransactions?(
        query?: string,
        limit?: number,
        cursor?: string
    ): Promise<MockTransactionIterator>;
    getGroups?(): Promise<MockGroup[]>;
    batchCreateTransactions?(transactions: MockTransaction[]): Promise<MockTransaction[]>;
}

export interface MockTransaction {
    json(): TransactionData;
}

export interface MockBalance {
    json(): BalanceData;
}

export interface MockDataTableBuilder {
    formatValues(format: boolean): MockDataTableBuilder;
    formatDates(format: boolean): MockDataTableBuilder;
    transposed(transposed: boolean): MockDataTableBuilder;
    raw(raw: boolean): MockDataTableBuilder;
    expanded(value: number): MockDataTableBuilder;
    type(balanceType: any): MockDataTableBuilder;
    hideNames(): MockDataTableBuilder;
    build(): any[][];
}

export interface MockAccountBalance {
    json(): AccountBalanceData;
    getAccount(): MockAccount | null;
    getGroup(): MockGroup | null;
    getName(): string;
    getPeriodBalance(): string;
    getCumulativeBalance(): string;
    createDataTable(): MockDataTableBuilder;
}

export interface MockGroup {
    getId(): string;
    getName(): string;
    getType(): string;
    isHidden(): boolean;
    isPermanent(): boolean;
    getParent(): MockGroup | null;
    getChildren(): MockGroup[];
    getProperties(): { [name: string]: string };
    json(): GroupData;
}

export interface MockAccount {
    json(): AccountData;
    getId(): string;
    getName(): string;
    getType(): string;
}

export interface MockBalanceReport {
    getBalances(): Promise<MockAccountBalance[]>;
    getBalancesContainers(): MockAccountBalance[];
    createDataTable(): MockDataTableBuilder;
}

export interface MockTransactionIterator {
    hasNext(): boolean;
    next(): MockTransaction[];
    getCursor(): string | undefined;
}

export interface MockApp {
    json(): AppData;
    getId(): string | undefined;
    getName(): string | undefined;
    isPublished(): boolean;
}

export interface MockBkper {
    setConfig: (config: any) => void;
    getBooks?(): Promise<MockBook[]>;
    getBook?(id: string): Promise<MockBook>;
    getApps?(): Promise<MockApp[]>;
}

// BkperMcpServer type helper
export type BkperMcpServerType = InstanceType<
    typeof import('../../../src/mcp/server.js').BkperMcpServer
>;
