// Money is stored as a whole number of the smallest unit, never as a decimal.
// 0.1 + 0.2 in JavaScript is 0.30000000000000004. Whole numbers never drift.
// AED 1,200.00 is 120000 fils. BHD 10.000 is 10000 fils. The decimal point is
// only put back when we print.

/** Decimal places per currency, from ISO 4217. */
export const CURRENCIES = Object.freeze({
  AED: Object.freeze({ code: 'AED', scale: 2 }),
  BHD: Object.freeze({ code: 'BHD', scale: 3 }),
});

function currencyOf(code) {
  const currency = CURRENCIES[code];
  if (!currency) {
    throw new Error(`Unknown currency "${code}". Known currencies are ${Object.keys(CURRENCIES).join(', ')}.`);
  }
  return currency;
}

/** An amount in one currency. Frozen, so every operation returns a new value. */
export class Money {
  /**
   * @param {string} code currency code, for example "AED"
   * @param {number} minor whole smallest units, for example 120000
   */
  constructor(code, minor) {
    const currency = currencyOf(code);

    if (!Number.isInteger(minor)) {
      throw new Error(`Money must be a whole number of ${code} minor units, got ${minor}.`);
    }
    if (!Number.isSafeInteger(minor)) {
      throw new Error(`Amount ${minor} is too large to be counted exactly.`);
    }

    this.currency = currency.code;
    this.scale = currency.scale;
    this.minor = minor;

    Object.freeze(this);
  }

  /** Build from text, for example "1,200.00". Numbers are refused, see below. */
  static of(code, text) {
    // A plain number arrives already rounded by the language, so there is
    // nothing left here to recover. Text keeps the exact value the user wrote.
    if (typeof text !== 'string') {
      throw new Error(
        `Money.of expects the amount as text, for example Money.of("${code}", "10.00"). ` +
        `If you already have whole minor units, use Money.fromMinor.`
      );
    }

    const currency = currencyOf(code);
    const cleaned = text.trim().replace(/,/g, '');
    const parts = /^(-)?(\d+)(?:\.(\d+))?$/.exec(cleaned);

    if (!parts) {
      throw new Error(`Cannot read "${text}" as an amount of ${code}.`);
    }

    const [, sign, whole, fraction = ''] = parts;

    // Refuse what the currency cannot hold. Rounding it here would hide the problem.
    if (fraction.length > currency.scale) {
      throw new Error(
        `${code} keeps ${currency.scale} decimal places, so "${text}" cannot be stored without losing part of it.`
      );
    }

    const minor = Number(`${whole}${fraction.padEnd(currency.scale, '0')}`);
    return new Money(code, sign ? -minor : minor);
  }

  /** Build from a count of the smallest units. */
  static fromMinor(code, minor) {
    return new Money(code, minor);
  }

  static zero(code) {
    return new Money(code, 0);
  }

  static sum(code, amounts) {
    return amounts.reduce((running, next) => running.plus(next), Money.zero(code));
  }

  /** AED and BHD are different units, like metres and pounds. Adding them is nonsense. */
  #sameCurrency(other) {
    if (!(other instanceof Money)) {
      throw new Error('Expected a Money value.');
    }
    if (other.currency !== this.currency) {
      throw new Error(`Cannot mix ${this.currency} and ${other.currency} in one calculation.`);
    }
    return other;
  }

  plus(other) {
    return new Money(this.currency, this.minor + this.#sameCurrency(other).minor);
  }

  minus(other) {
    return new Money(this.currency, this.minor - this.#sameCurrency(other).minor);
  }

  negated() {
    return new Money(this.currency, -this.minor);
  }

  /** Repeat this amount a whole number of times. */
  times(count) {
    if (!Number.isInteger(count)) {
      throw new Error(`Money can only be multiplied by a whole number, got ${count}.`);
    }
    return new Money(this.currency, this.minor * count);
  }

  isZero() {
    return this.minor === 0;
  }

  isNegative() {
    return this.minor < 0;
  }

  isPositive() {
    return this.minor > 0;
  }

  /** Minus one if smaller, zero if equal, plus one if larger. */
  compare(other) {
    const theirs = this.#sameCurrency(other).minor;
    return this.minor < theirs ? -1 : this.minor > theirs ? 1 : 0;
  }

  equals(other) {
    return other instanceof Money && other.currency === this.currency && other.minor === this.minor;
  }

  /** Just the amount, for example "1,200.00". */
  format() {
    const negative = this.minor < 0;
    const digits = String(Math.abs(this.minor)).padStart(this.scale + 1, '0');
    const whole = digits.slice(0, digits.length - this.scale);
    const fraction = digits.slice(digits.length - this.scale);
    const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    const body = this.scale === 0 ? grouped : `${grouped}.${fraction}`;
    return negative ? `-${body}` : body;
  }

  /** Amount with its currency, for example "AED 1,200.00". */
  toString() {
    return `${this.currency} ${this.format()}`;
  }
}
