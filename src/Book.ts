import * as AccountService_ from './AccountService_';
import * as BalancesService_ from './BalancesService_';
import * as BookService_ from './BookService_';
import * as SavedQueryService_ from './SavedQueryService_';
import * as FileService_ from './FileService_';
import * as GroupService_ from './GroupService_';
import Account from './Account';
import Collection from './Collection';
import AccountsDataTableBuilder from './AccountsDataTableBuilder';
import BalancesDataTableBuilder from './BalancesDataTableBuilder';
import BalancesReport from './BalancesReport';
import BkperFile from './BkperFile';
import { normalizeName } from './Normalizer_';
import { DecimalSeparator, Permission } from './Enums';
import Group from './Group';
import Transaction from './Transaction';

/**
 *
 * A Book represents [General Ledger](https://en.wikipedia.org/wiki/General_ledger) for a company or business, but can also represent a [Ledger](https://en.wikipedia.org/wiki/Ledger) for a project or department
 *
 * It contains all [[Accounts]] where [[Transactions]] are recorded/posted;
 * 
 * @public
 */
export default class Book {

  private id: string
  private wrapped: bkper.Book;
  private accounts: Account[];
  private groups: Group[];
  private collection: Collection;
  private idAccountMap: any;
  private nameAccountMap: any;
  private idGroupMap: any;
  private nameGroupMap: any;
  private savedQueries: bkper.Query[];


  constructor(id: string, wrapped?: bkper.Book) {
    this.id = id;
    this.wrapped = wrapped;
  }

  /**
   * Same as bookId param
   */
  public getId(): string {
    return this.id;
  }

  /**
   * @return The name of this Book
   */
  public getName(): string {
    this.checkBookLoaded_();
    return this.wrapped.name;
  }

  /**
   * 
   * Sets the name of the Book.
   * 
   * @returns This Book, for chainning.
   */    
  public setName(name: string): Book {
    this.wrapped.name = name;
    return this;
  }
  
  /**
   * @return The number of fraction digits (decimal places) supported by this Book
   */
  public getFractionDigits(): number {
    this.checkBookLoaded_();
    return this.wrapped.fractionDigits;
  }

  /**
   * 
   * Sets the number of fraction digits (decimal places) supported by this Book
   * 
   * @returns This Book, for chainning.
   */     
  public setFractionDigits(fractionDigits: number): Book {
    this.wrapped.fractionDigits = fractionDigits;
    return this;
  }

  /**
   * @return The name of the owner of the Book
   */
  public getOwnerName(): string {
    this.checkBookLoaded_();
    return this.wrapped.ownerName;
  }

  private checkBookLoaded_(): void {
    if (this.wrapped == null) {
      this.loadBook_();
    }
  }

  private checkAccountsLoaded_(): void {
    if (this.wrapped == null || this.idAccountMap == null || this.idAccountMap == null) {
      this.loadBook_();
    }
  }

  private async loadBook_() {
    this.wrapped = await BookService_.loadBookWrapped(this.getId());
    this.configureGroups_(this.wrapped.groups);
    this.configureAccounts_(this.wrapped.accounts);
  }

  /**
   * @return The permission for the current user
   */
  public getPermission(): Permission {
    this.checkBookLoaded_();
    return this.wrapped.permission as Permission;
  }

  /** 
   * @return The collection of this book
   */
  public getCollection(): Collection {
    this.checkAccountsLoaded_();
    if (this.wrapped.collection != null && this.collection == null) {
      this.collection = new Collection(this.wrapped.collection);
    }
    return this.collection;
  }


  /**
   * @return The date pattern of the Book. Current: dd/MM/yyyy | MM/dd/yyyy | yyyy/MM/dd
   */
  public getDatePattern(): string {
    this.checkBookLoaded_();
    return this.wrapped.datePattern;
  }

  /**
   * 
   * Sets the date pattern of the Book. Current: dd/MM/yyyy | MM/dd/yyyy | yyyy/MM/dd
   * 
   * @returns This Book, for chainning.
   */    
  public setDatePattern(datePattern: string): Book {
    this.wrapped.datePattern = datePattern;
    return this;
  }  


 

  /**
   * @return The decimal separator of the Book
   */
  public getDecimalSeparator(): DecimalSeparator {
    this.checkBookLoaded_();
    return this.wrapped.decimalSeparator as DecimalSeparator;
  }

  /**
   * 
   * Sets the decimal separator of the Book
   * 
   * @returns This Book, for chainning.
   */    
  public setDecimalSeparator(decimalSeparator: DecimalSeparator): Book {
    this.wrapped.decimalSeparator = decimalSeparator;
    return this;
  }


  /**
   * @return The time zone of the Book
   */
  public getTimeZone(): string {
    this.checkBookLoaded_();
    return this.wrapped.timeZone;
  }

  /**
   * 
   * Sets the time zone of the Book
   * 
   * @returns This Book, for chainning.
   */    
  public setTimeZone(timeZone: string): Book {
    this.wrapped.timeZone = timeZone;
    return this;
  }

  /**
   * @return The time zone offset of the book, in minutes
   */
  public getTimeZoneOffset(): number {
    this.checkBookLoaded_();
    return this.wrapped.timeZoneOffset;
  }

  /**
   * @return The last update date of the book, in in milliseconds
   */
  public getLastUpdateMs(): number {
    this.checkBookLoaded_();
    return +this.wrapped.lastUpdateMs;
  }


  /**
   * Gets the custom properties stored in this Book
   */
  public getProperties(): {[key: string]: string} {
    this.checkBookLoaded_();
    return this.wrapped.properties != null ? {...this.wrapped.properties} : {};
  }

  /**
   * Gets the property value for given keys. First property found will be retrieved
   * 
   * @param keys The property key
   */
  public getProperty(...keys: string[]): string {
    this.checkBookLoaded_();

    for (let index = 0; index < keys.length; index++) {
      const key = keys[index];
      let value = this.wrapped.properties != null ? this.wrapped.properties[key] : null
      if (value != null && value.trim() != '') {
        return value;
      }
    }

    return null;
  }

  /**
   * Sets the custom properties of the Book
   * 
   * @param properties Object with key/value pair properties
   * 
   * @returns This Book, for chainning. 
   */
  public setProperties(properties: {[key: string]: string}): Book {
    this.wrapped.properties = {...properties};
    return this;
  }

  /**
   * Sets a custom property in the Book.
   * 
   * @param key The property key
   * @param value The property value
   * 
   * @returns This Book, for chainning. 
   */
  public setProperty(key: string, value: string): Book {
    if (key == null || key.trim() == '') {
      return this;
    }    
    this.checkBookLoaded_();
    if (this.wrapped.properties == null) {
      this.wrapped.properties = {};
    }
    this.wrapped.properties[key] = value;
    return this;
  }


  /**
   * Formats a date according to date pattern of the Book.
   * 
   * @param  date The date to format as string.
   * @param  timeZone The output timezone of the result. Default to script's timeZone
   * 
   * @return The date formated
   */
  public formatDate(date: Date, timeZone?: string): string {
    if (timeZone == null || timeZone.trim() == "") {
      timeZone = this.getTimeZone();
    }
    return Utils_.formatDate(date, this.getDatePattern(), timeZone);
  }


  /**
   * Formats a value according to [[DecimalSeparator]] and fraction digits of the Book.
   * 
   * @param value The value to be formatted.
   * 
   * @return The value formated
   */
  public formatValue(value: number): string {
    return Utils_.formatValue_(value, this.getDecimalSeparator(), this.getFractionDigits());
  }

  /**
   * Parse a value string according to [[DecimalSeparator]] and fraction digits of the Book.
   */
  public parseValue(value: string): number {
    return Utils_.parseValue(value, this.getDecimalSeparator());
  }


  /**
   * Rounds a value according to the number of fraction digits of the Book
   * 
   * @param value The value to be rounded
   * 
   * @returns The value rounded
   */
  public round(value: number): number {
    return Utils_.round(value, this.getFractionDigits());
  }

  /**
   * Create [[Transactions]] on the Book, in batch. 
   */
  public batchCreateTransactions(transactions: Transaction[]): Transaction[] {
    let transactionPayloads: bkper.Transaction[] = [];
    transactions.forEach(tx => transactionPayloads.push(tx.wrapped))
    transactionPayloads = TransactionService_.createTransactionsBatch(this.getId(), transactionPayloads);
    transactions = Utils_.wrapObjects(new Transaction(), transactionPayloads);
    this.configureTransactions_(transactions);
    this.clearAccountsCache();
    return transactions;
  }


  /**
   * Trigger [Balances Audit](https://help.bkper.com/en/articles/4412038-balances-audit) async process.
   */
  public audit(): void {
    BookService_.audit(this);
  }


  /**
   * Resumes a transaction iteration using a continuation token from a previous iterator.
   * 
   * @param continuationToken continuation token from a previous transaction iterator
   * 
   * @return a collection of transactions that remained in a previous iterator when the continuation token was generated
   */
  public continueTransactionIterator(query: string, continuationToken: string): TransactionIterator {
    var transactionIterator = new TransactionIterator(this, query);
    transactionIterator.setContinuationToken(continuationToken);
    return transactionIterator;
  }


  configureTransactions_(transactions: Transaction[]) {
    for (var i = 0; i < transactions.length; i++) {
      this.configureTransaction_(transactions[i]);
    }
    return transactions;
  }


  private configureTransaction_(transaction: Transaction) {
    transaction.book = this;
    return transaction;
  }


  /**
   * Instantiate a new [[Transaction]]
   * 
   * Example:
   * 
   * ```js
   * var book = BkperApp.getBook("agtzfmJrcGVyLWhyZHITCxIGTGVkZ2VyGICAgIDggqALDA");
   * 
   * book.newTransaction()
   *  .setDate('2013-01-25')
   *  .setDescription("Filling tank of my truck")
   *  .from('Credit Card')
   *  .to('Gas')
   *  .setAmount(126.50)
   *  .create();
   * 
   * ```
   * 
   */
  public newTransaction(): Transaction {
    let transaction = Utils_.wrapObject(new Transaction(), {});
    this.configureTransaction_(transaction);
    return transaction;
  }

  /**
   * Instantiate a new [[Account]]
   * 
   * Example:
   * ```js
   * var book = BkperApp.getBook("agtzfmJrcGVyLWhyZHITCxIGTGVkZ2VyGICAgIDggqALDA");
   * 
   * book.newAccount()
   *  .setName('Some New Account')
   *  .setType('INCOMING')
   *  .addGroup('Revenue').addGroup('Salary')
   *  .setProperties({prop_a: 'A', prop_b: 'B'})
   *  .create();
   * ```
   */
  public newAccount(): Account {
    let account = Utils_.wrapObject(new Account(), {});
    account.setArchived(false);
    account.book = this;
    return account;
  }

  /**
   * Instantiate a new [[Group]]
   * 
   * Example:
   * ```js
   * var book = BkperApp.getBook("agtzfmJrcGVyLWhyZHITCxIGTGVkZ2VyGICAgIDggqALDA");
   * 
   * book.newGroup()
   *  .setName('Some New Group')
   *  .setProperty('key', 'value')
   *  .create();
   * ```
   */
  public newGroup(): Group {
    let group = Utils_.wrapObject(new Group(), {});
    group.book = this;
    return group;
  }

  /**
   * Gets all [[Accounts]] of this Book
   */
  public getAccounts(): Account[] {
    this.checkAccountsLoaded_();
    return this.accounts;
  }


  /**
   * Gets an [[Account]] object
   * 
   * @param idOrName The id or name of the Account
   * 
   * @returns The matching Account object
   */
  public getAccount(idOrName: string): Account {

    if (idOrName == null) {
      return null;
    }

    idOrName = idOrName + '';

    this.checkAccountsLoaded_();

    var account = this.idAccountMap[idOrName];
    if (account == null) {
      var normalizedIdOfName = normalizeName(idOrName);
      account = this.nameAccountMap[normalizedIdOfName];
    }

    return account;
  }


  /**
   * Create [[Accounts]] on the Book, in batch.
   */
  public async batchCreateAccounts(accounts: Account[]): Promise<Account[]> {
    let accountsPayloads: bkper.Account[] = []
    for (const account of accounts) {
      accountsPayloads.push(account.wrapped);
    }
    if (accountsPayloads.length > 0) {
      let createdAccountsPlain = await AccountService_.createAccounts(this.getId(), accountsPayloads);
      let createdAccounts = Utils_.wrapObjects(new Account(), createdAccountsPlain);
      this.clearBookCache_();
      for (var i = 0; i < createdAccounts.length; i++) {
        var account = createdAccounts[i];
        account.book = this;
      }
      return createdAccounts;
    }
    return [];
  }



  private configureAccounts_(accounts: bkper.Account[]): void {
    this.accounts = Utils_.wrapObjects(new Account(), accounts);
    this.idAccountMap = new Object();
    this.nameAccountMap = new Object();
    for (var i = 0; i < this.accounts.length; i++) {
      var account = this.accounts[i];
      account.book = this;
      this.idAccountMap[account.getId()] = account;
      this.nameAccountMap[account.getNormalizedName()] = account;
    }
  }


  /**
   * Gets all [[Groups]] of this Book
   */
  public getGroups(): Group[] {
    this.checkAccountsLoaded_();
    return this.groups;
  }

  /**
   * Create [[Groups]] on the Book, in batch.
   */
  public async batchCreateGroups(groups: Group[]): Promise<Group[]> {
    if (groups.length > 0) {
      let groupsSave: bkper.Group[] = groups.map(g => { return g.wrapped });
      let createdGroupsPlain = await GroupService_.createGroups(this.getId(), groupsSave);
      let createdGroups = Utils_.wrapObjects(new Group(), createdGroupsPlain);
      this.clearBookCache_();

      for (var i = 0; i < createdGroups.length; i++) {
        var group = createdGroups[i];
        group.book = this;
      }

      return createdGroups;
    }
    return [];
  }

  clearAccountsCache() {
    this.idAccountMap = null;
    this.idGroupMap = null;
  }

  private clearBookCache_() {
    this.wrapped = null;
  }

  /**
   * Gets a [[Group]] object
   * 
   * @param idOrName The id or name of the Group
   * 
   * @returns The matching Group object
   */
  public getGroup(idOrName: string): Group {

    if (idOrName == null) {
      return null;
    }

    idOrName = idOrName + '';

    this.checkAccountsLoaded_();

    var group = this.idGroupMap[idOrName];
    if (group == null) {
      group = this.nameGroupMap[normalizeName(idOrName)];
    }

    return group;
  }

  private configureGroups_(groups: bkper.Group[]): void {
    this.groups = Utils_.wrapObjects(new Group(), groups);
    this.idGroupMap = new Object();
    this.nameGroupMap = new Object();
    for (var i = 0; i < this.groups.length; i++) {
      var group = this.groups[i];
      group.book = this;
      this.idGroupMap[group.getId()] = group;
      this.nameGroupMap[normalizeName(group.getName())] = group;
    }
  }


  /**
   * Gets all saved queries from this book
   */
  public async getSavedQueries(): Promise<{ id?: string, query?: string, title?: string }[]> {
    if (this.savedQueries == null) {
      this.savedQueries = await SavedQueryService_.getSavedQueries(this.getId());
    }
    return this.savedQueries;
  }

  /**
   * 
   * Create a [[BalancesReport]] based on query
   * 
   * @param query The balances report query
   */
  public async getBalancesReport(query: string): Promise<BalancesReport> {
    var balances = await BalancesService_.getBalances(this.getId(), query);
    return new BalancesReport(this, balances);
  }

  /**
   * Create a [[BalancesDataTableBuilder]] based on a query, to create two dimensional Array representation of balances of [[Account]], [[Group]] or #hashtag
   * 
   * See [Query Guide](https://help.bkper.com/en/articles/2569178-search-query-guide) to learn more
   * 
   * @param query The balances report query
   * 
   * @return The balances data table builder
   * 
   * Example:
   * 
   * ```js
   * var book = BkperApp.getBook("agtzfmJrcGVyLWhyZHITCxIGTGVkZ2VyGICAgIDggqALDA");
   * 
   * var balancesDataTable = book.createBalancesDataTable("#rental #energy after:8/2013 before:9/2013").build();
   * ```
   */
  public async createBalancesDataTable(query: string): Promise<BalancesDataTableBuilder> {
    var balances = await BalancesService_.getBalances(this.getId(), query);
    return new BalancesReport(this, balances).createDataTable();
  }

  /**
   * Create a [[AccountsDataTableBuilder]], to build two dimensional Array representations of [[Accounts]] dataset.
   * 
   * @return Accounts data table builder.
   * 
   */
  public async createAccountsDataTable(): Promise<AccountsDataTableBuilder> {
    let accounts = this.getAccounts();
    return new AccountsDataTableBuilder(accounts);
  }


  /**
   * Create a [[TransactionsDataTableBuilder]] based on a query, to build two dimensional Array representations of [[Transactions]] dataset.
   * 
   * See [Query Guide](https://help.bkper.com/en/articles/2569178-search-query-guide) to learn more
   * 
   * @param query The flter query.
   * 
   * @return Transactions data table builder.
   * 
   * Example: 
   * 
   * ```js
   * var book = BkperApp.getBook("agtzfmJrcGVyLWhyZHITCxIGTGVkZ2VyGICAgIDggqALDA");
   * 
   * var transactionsDataTable = book.createTransactionsDataTable("account:'Bank' after:8/2013 before:9/2013").build();
   * ```
   */
  public createTransactionsDataTable(query?: string): TransactionsDataTableBuilder {
    var transactionIterator = this.getTransactions(query);
    return new TransactionsDataTableBuilder(transactionIterator);
  }

  /**
   * Get Book transactions based on a query.
   * 
   * See [Query Guide](https://help.bkper.com/en/articles/2569178-search-query-guide) to learn more
   *  
   * @param query The query string.
   * 
   * @return The Transactions result as an iterator.
   * 
   * Example:
   * 
   * ```js
   * var book = BkperApp.getBook("agtzfmJrcGVyLWhyZHITCxIGTGVkZ2VyGICAgIDggqALDA");
   *
   * var transactions = book.getTransactions("account:CreditCard after:28/01/2013 before:29/01/2013");
   *
   * while (transactions.hasNext()) {
   *  var transaction = transactions.next();
   *  Logger.log(transaction.getDescription());
   * }
   * ```
   */
  public getTransactions(query?: string): TransactionIterator {
    return new TransactionIterator(this, query);
  }

  /**
   * Retrieve a transaction by id
   */
  public getTransaction(id: string): Transaction {
    let wrapped = TransactionService_.getTransaction(this.getId(), id);
    let transaction = Utils_.wrapObject(new Transaction(), wrapped);
    this.configureTransaction_(transaction);
    return transaction;
  }

  /**
   * Instantiate a new [[BkperFile]]
   * 
   * Example:
   * ```js
   * var book = BkperApp.getBook("agtzfmJrcGVyLWhyZHITCxIGTGVkZ2VyGICAgIDggqALDA");
   * 
   * book.newFile()
   *  .setBlob(UrlFetchApp.fetch('https://bkper.com/images/index/integrations4.png').getBlob())
   *  .create();
   * ```
   */
  public newFile(): BkperFile {
    let file = Utils_.wrapObject(new BkperFile(), {});
    file.book = this;
    return file;
  }

  /** 
   * Retrieve a file by id
   */
  public async getFile(id: string): Promise<BkperFile> {
    let wrapped = await FileService_.getFile(this.getId(), id);
    let file = Utils_.wrapObject(new BkperFile(), wrapped);
    return file;
  }

  /**
   * Perform update Book, applying pending changes.
   */
  public async update(): Promise<Book> {
    this.wrapped = await BookService_.updateBook(this.getId(), this.wrapped);
    return this;
  }   

}