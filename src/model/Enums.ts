/**
 * The Periodicity of the query. It may depend on the level of granularity you write the range params.
 * 
 * @public
 */
export enum Periodicity {

  /**
   * Example: after:25/01/1983, before:04/03/2013, after:$d-30, before:$d, after:$d-15/$m 
   */
  DAILY = "DAILY",

  /**
   * Example: after:jan/2013, before:mar/2013, after:$m-1, before:$m
   */
  MONTHLY = "MONTHLY",

  /**
   * Example: on:2013, after:2013, $y
   */
  YEARLY = "YEARLY"
}

/**
 * Decimal separator of numbers on book
 * 
 * @public
 */
export enum DecimalSeparator {

  /**
   * ,
   */
  COMMA = "COMMA",

  /**
   * .
   */
  DOT = "DOT"
}


/**
 * Enum representing permissions of user in the Book
 * 
 * Learn more at [share article](https://help.bkper.com/en/articles/2569153-share-your-book-with-your-peers).
 * 
 * @public
 */

export enum Permission {

  /**
   * No permission
   */
  NONE = "NONE",

  /**
   * View transactions, accounts and balances.
   */
  VIEWER = "VIEWER",

  /**
   * Record and delete drafts only. Useful to collect data only
   */
  RECORDER = "RECORDER",

  /**
   * View transactions, accounts, record and delete drafts
   */
  POSTER = "POSTER",

  /**
   * Manage accounts, transactions, book configuration and sharing
   */
  EDITOR = "EDITOR",

  /**
   * Manage everything, including book visibility and deletion. Only one owner per book.
   */
  OWNER = "OWNER"
}

/**
 * Enum that represents account types.
 * 
 * @public
 */
export enum AccountType {

  /**
   * Asset account type
   */
  ASSET = "ASSET",

  /**
   * Liability account type
   */
  LIABILITY = "LIABILITY",

  /**
   * Incoming account type
   */
  INCOMING = "INCOMING",  

  /**
   * Outgoing account type
   */
  OUTGOING = "OUTGOING"
}

/**
 * Enum that represents balance types.
 * 
 * @public
 */
export enum BalanceType {

  /**
   * Total balance
   */
  TOTAL = "TOTAL",

  /**
   * Period balance
   */
  PERIOD = "PERIOD",

  /**
   * Cumulative balance
   */
  CUMULATIVE = "CUMULATIVE"
}

/**
 * Enum that represents queried balances of checked/unchecked transactions.
 * 
 * The type is obtained from parsing the **is:checked is:unchecked** query operator. 
 * 
 * @public
 */
export enum BalanceCheckedType {

  /**
   *  Balances of all transactions, no matter its checked or unchecked state.
   */
  FULL_BALANCE = "FULL_BALANCE",

  /**
   * Balances of is:checked transactions only.
   */
  CHECKED_BALANCE = "CHECKED_BALANCE",

  /**
   * Balances of is:unchecked transactions only.
   */
  UNCHECKED_BALANCE = "UNCHECKED_BALANCE"
}