// The input stream. These are the ten things that happen to the accounts.
//
// Every event carries two dates. The booking day is when the bank found out.
// The value date is the day it counts for the balance. They are often the same,
// but E7 arrives on day 5 saying the money left on day 2, and that gap is the
// heart of this exercise.

import { Money } from './money.js';

export const EVENT_TYPES = Object.freeze({
  CREDIT: 'CREDIT',
  DEBIT: 'DEBIT',
  AUTHORIZATION: 'AUTHORIZATION',
  SETTLEMENT: 'SETTLEMENT',
  REVERSAL: 'REVERSAL',
});

const KNOWN = new Set(Object.values(EVENT_TYPES));

function required(spec, field) {
  if (spec[field] === undefined || spec[field] === null || spec[field] === '') {
    throw new Error(`Event ${spec.id ?? '(no id)'} is missing "${field}".`);
  }
  return spec[field];
}

function wholeDay(value, label, id) {
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`Event ${id} has an invalid ${label}: ${value}. Days are counted from 1.`);
  }
  return value;
}

/**
 * Build one event. The result is frozen, so once an event exists it can never
 * be edited. A mistake is corrected by adding a reversal, never by changing this.
 */
export function defineEvent(spec) {
  const id = required(spec, 'id');
  const type = required(spec, 'type');

  if (!KNOWN.has(type)) {
    throw new Error(`Event ${id} has unknown type "${type}".`);
  }

  const event = {
    id,
    type,
    account: required(spec, 'account'),
    bookedOn: wholeDay(required(spec, 'bookedOn'), 'booking day', id),
    valueDate: wholeDay(required(spec, 'valueDate'), 'value date', id),
    note: spec.note ?? '',
  };

  if (type !== EVENT_TYPES.REVERSAL) {
    const amount = required(spec, 'amount');
    if (!(amount instanceof Money)) {
      throw new Error(`Event ${id} must carry a Money amount.`);
    }
    if (!amount.isPositive()) {
      throw new Error(`Event ${id} must carry a positive amount. Direction comes from the type, not the sign.`);
    }
    event.amount = amount;
  }

  if (type === EVENT_TYPES.AUTHORIZATION || type === EVENT_TYPES.SETTLEMENT) {
    event.authId = required(spec, 'authId');
  }

  if (type === EVENT_TYPES.REVERSAL) {
    // Reversals point at an event id, not at an amount. Two identical debits on
    // the same day would otherwise be impossible to tell apart.
    event.reverses = required(spec, 'reverses');
  }

  if (type === EVENT_TYPES.CREDIT && spec.instalments !== undefined) {
    if (!Number.isInteger(spec.instalments) || spec.instalments < 1) {
      throw new Error(`Event ${id} has an invalid instalment count: ${spec.instalments}.`);
    }
    event.instalments = spec.instalments;
  }

  return Object.freeze(event);
}

export const credit = (spec) => defineEvent({ ...spec, type: EVENT_TYPES.CREDIT });
export const debit = (spec) => defineEvent({ ...spec, type: EVENT_TYPES.DEBIT });
export const authorization = (spec) => defineEvent({ ...spec, type: EVENT_TYPES.AUTHORIZATION });
export const settlement = (spec) => defineEvent({ ...spec, type: EVENT_TYPES.SETTLEMENT });
export const reversal = (spec) => defineEvent({ ...spec, type: EVENT_TYPES.REVERSAL });

/** True when the value date is earlier than the day the bank heard about it. */
export const isBackdated = (event) => event.valueDate < event.bookedOn;
