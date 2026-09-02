// The ledger. A list that can only ever grow.
//
// Nothing here can be edited or removed. There is no update method and no
// delete method, and every record handed out is frozen. A mistake is fixed by
// adding a new record that cancels the old one, which is why the list gets
// longer even when money goes back where it came from.
//
// Refusals are recorded too. A trail that only shows what succeeded is not a
// trail, because you cannot tell a rejected settlement from one that never
// arrived.

import { Money } from './money.js';

export const RECORD_KINDS = Object.freeze({
  ENTRY: 'ENTRY',              // real money moved
  HOLD_OPENED: 'HOLD_OPENED',  // money set aside, balance untouched
  HOLD_CLOSED: 'HOLD_CLOSED',  // money released back
  REFUSAL: 'REFUSAL',          // something was asked for and turned down
});

/** Why an entry exists. Useful when reading the printed report. */
export const ENTRY_REASONS = Object.freeze({
  CREDIT: 'CREDIT',
  DEBIT: 'DEBIT',
  SETTLEMENT: 'SETTLEMENT',
  REVERSAL: 'REVERSAL',
  OVERDRAFT_FEE: 'OVERDRAFT_FEE',
  INTEREST: 'INTEREST',
});

export class Ledger {
  #records = [];

  #store(record) {
    const stored = Object.freeze({ seq: this.#records.length + 1, ...record });
    this.#records.push(stored);
    return stored;
  }

  /**
   * Record money actually moving. The amount is signed: money in is positive,
   * money out is negative.
   */
  post({ account, amount, valueDate, bookedOn, reason, sourceEvent, note = '' }) {
    if (!(amount instanceof Money)) {
      throw new Error('An entry must carry a Money amount.');
    }
    if (!Number.isInteger(valueDate) || !Number.isInteger(bookedOn)) {
      throw new Error('An entry needs a whole number value date and booking day.');
    }
    if (!ENTRY_REASONS[reason]) {
      throw new Error(`Unknown entry reason "${reason}".`);
    }
    return this.#store({
      kind: RECORD_KINDS.ENTRY,
      account,
      amount,
      valueDate,
      bookedOn,
      reason,
      sourceEvent,
      note,
    });
  }

  openHold({ account, authId, amount, day, sourceEvent }) {
    if (!(amount instanceof Money)) {
      throw new Error('A hold must carry a Money amount.');
    }
    return this.#store({ kind: RECORD_KINDS.HOLD_OPENED, account, authId, amount, day, sourceEvent });
  }

  closeHold({ account, authId, day, sourceEvent, note = '' }) {
    return this.#store({ kind: RECORD_KINDS.HOLD_CLOSED, account, authId, day, sourceEvent, note });
  }

  refuse({ account, day, sourceEvent, reason, authId, amount }) {
    if (!reason) {
      throw new Error('A refusal must say why.');
    }
    return this.#store({ kind: RECORD_KINDS.REFUSAL, account, day, sourceEvent, reason, authId, amount });
  }

  /** How many records exist. Only ever goes up. */
  get size() {
    return this.#records.length;
  }

  /** Everything, oldest first. The array is a frozen copy, so callers cannot add to the real one. */
  all() {
    return Object.freeze([...this.#records]);
  }

  #filter(kind, account) {
    return this.#records.filter((r) => r.kind === kind && (account === undefined || r.account === account));
  }

  entries(account) {
    return this.#filter(RECORD_KINDS.ENTRY, account);
  }

  holdsOpened(account) {
    return this.#filter(RECORD_KINDS.HOLD_OPENED, account);
  }

  holdsClosed(account) {
    return this.#filter(RECORD_KINDS.HOLD_CLOSED, account);
  }

  refusals(account) {
    return this.#filter(RECORD_KINDS.REFUSAL, account);
  }

  /** Records added on one day, whatever their value date. */
  bookedOn(day) {
    return this.#records.filter((r) => (r.bookedOn ?? r.day) === day);
  }
}
