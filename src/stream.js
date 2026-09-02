// The six day window: the two accounts and the ten events, exactly as the
// brief lists them, in the order they are replayed.

import { Money } from './money.js';
import { credit, debit, authorization, settlement, reversal } from './events.js';

export const WINDOW_DAYS = 6;

export const ACCOUNTS = Object.freeze([
  Object.freeze({ id: 'ACC-001', currency: 'AED', opening: Money.of('AED', '0.00') }),
  Object.freeze({ id: 'ACC-002', currency: 'BHD', opening: Money.of('BHD', '0.000') }),
]);

const aed = (text) => Money.of('AED', text);
const bhd = (text) => Money.of('BHD', text);

export const EVENTS = Object.freeze([
  credit({ id: 'E1', account: 'ACC-001', amount: aed('1200.00'), bookedOn: 1, valueDate: 1 }),
  debit({ id: 'E2', account: 'ACC-001', amount: aed('950.00'), bookedOn: 1, valueDate: 1 }),
  authorization({ id: 'E3', account: 'ACC-001', authId: 'Auth-A', amount: aed('200.00'), bookedOn: 2, valueDate: 2 }),
  credit({ id: 'E4', account: 'ACC-001', amount: aed('400.00'), bookedOn: 3, valueDate: 3 }),
  settlement({ id: 'E5', account: 'ACC-001', authId: 'Auth-A', amount: aed('185.00'), bookedOn: 4, valueDate: 4 }),

  // Auth-Z has no authorisation anywhere in the stream. This one gets refused.
  settlement({ id: 'E6', account: 'ACC-001', authId: 'Auth-Z', amount: aed('180.00'), bookedOn: 4, valueDate: 4 }),

  // Arrives on day 5 but counts from day 2. This is what rewrites the week.
  debit({ id: 'E7', account: 'ACC-001', amount: aed('620.00'), bookedOn: 5, valueDate: 2 }),

  authorization({ id: 'E8', account: 'ACC-001', authId: 'Auth-B', amount: aed('90.00'), bookedOn: 5, valueDate: 5 }),
  reversal({ id: 'E9', account: 'ACC-001', reverses: 'E7', bookedOn: 6, valueDate: 2 }),

  credit({ id: 'E10', account: 'ACC-002', amount: bhd('10.000'), bookedOn: 5, valueDate: 5, instalments: 3 }),
]);

export const accountOf = (id) => ACCOUNTS.find((account) => account.id === id);
