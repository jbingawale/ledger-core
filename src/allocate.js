// Splitting an amount without inventing or losing a unit.
//
// BHD 10.000 divided three ways is 3.3333... which does not exist in a currency
// with three decimal places. Rounding each part to 3.334 gives 10.002, so the
// books gain 0.002 out of nowhere.
//
// The fix is largest remainder. Give every part the floor value, then hand out
// the leftover units one at a time, biggest shortfall first. The total is
// sacred. The split is what bends.
//
// The same function serves the E10 instalments and the interest capitalisation,
// because underneath they are the same problem.

import { Money } from './money.js';

/**
 * Share an amount out in proportion to a list of weights.
 * The parts always add back to exactly the amount.
 *
 * @param {Money} amount what is being shared out
 * @param {number[]} weights one non negative whole number per part
 * @returns {Money[]}
 */
export function distribute(amount, weights) {
  if (!(amount instanceof Money)) {
    throw new Error('distribute expects a Money amount.');
  }
  if (!Array.isArray(weights) || weights.length === 0) {
    throw new Error('distribute needs at least one weight.');
  }
  for (const weight of weights) {
    if (!Number.isInteger(weight) || weight < 0) {
      throw new Error(`Weights must be non negative whole numbers, got ${weight}.`);
    }
  }

  const totalWeight = weights.reduce((a, b) => a + b, 0);
  if (totalWeight === 0) {
    throw new Error('Weights cannot all be zero, there would be nothing to share out.');
  }

  // Work on the size only and put the sign back at the end, so a negative
  // amount splits the same way a positive one does.
  const sign = amount.minor < 0 ? -1 : 1;
  const total = Math.abs(amount.minor);

  // Floor share for each part, and how much each part was short by.
  const shares = weights.map((weight) => Math.floor((total * weight) / totalWeight));
  const shortfalls = weights.map((weight) => (total * weight) % totalWeight);

  // Whatever the flooring left over, handed out one unit at a time.
  let leftover = total - shares.reduce((a, b) => a + b, 0);

  const order = shares
    .map((_, index) => index)
    .sort((a, b) => shortfalls[b] - shortfalls[a] || a - b);

  for (const index of order) {
    if (leftover === 0) break;
    shares[index] += 1;
    leftover -= 1;
  }

  return shares.map((share) => Money.fromMinor(amount.currency, sign * share));
}

/**
 * Split an amount into equal parts, as equal as the currency allows.
 * Ties go to the earliest part, so the answer is the same every run.
 *
 * @param {Money} amount
 * @param {number} parts
 * @returns {Money[]}
 */
export function splitEvenly(amount, parts) {
  if (!Number.isInteger(parts) || parts < 1) {
    throw new Error(`Cannot split into ${parts} parts.`);
  }
  return distribute(amount, new Array(parts).fill(1));
}
