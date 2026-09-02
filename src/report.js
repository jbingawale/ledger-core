// Turning a replay into something a person can read.
//
// One block per day. Each block answers four questions: what arrived, what it
// did to the balances, what fees were charged, and what went wrong.

const LINE = '='.repeat(74);
const THIN = '-'.repeat(74);

const pad = (text, width) => String(text).padEnd(width);
const right = (text, width) => String(text).padStart(width);

function renderArrivals(outcomes) {
  if (outcomes.length === 0) return ['  nothing arrived today'];

  return outcomes.map(({ event, outcome, detail }) => {
    const amount = event.amount ? event.amount.format() : '';
    const dated = event.valueDate === event.bookedOn ? '' : `value date day ${event.valueDate}`;
    return `  ${pad(event.id, 5)}${pad(event.type, 15)}${pad(event.account, 9)}${right(amount, 10)}  ${pad(outcome, 10)}${[dated, detail].filter(Boolean).join(', ')}`;
  });
}

function renderRewrites(account) {
  if (account.rewritten.length === 0) return [];

  return [
    `  earlier days rewritten by what arrived today:`,
    ...account.rewritten.map((change) => `    day ${change.day}: ${change.before.format()} becomes ${change.after.format()}`),
  ];
}

function renderAuthorizations(account) {
  if (account.authorizations.length === 0) return ['  authorisations       none'];

  return account.authorizations.map((auth, index) => {
    const label = index === 0 ? '  authorisations      ' : '                      ';
    return `${label} ${pad(auth.authId, 8)}${pad(auth.state, 10)}${auth.amount ? auth.amount.format() : ''}`;
  });
}

function renderInterest(account) {
  if (!account.interest) return [];

  const { daily, total } = account.interest;
  const earning = daily.filter((entry) => !entry.amount.isZero());

  if (total.isZero()) return ['  interest              nothing earned, no positive days'];

  return [
    `  interest capitalised ${total.format()} credited today`,
    ...earning.map((entry) => `    day ${entry.day} on ${right(entry.balance.format(), 10)} accrued ${entry.amount.format()}`),
    `    ${pad('', 8)}${right('accruals add up to', 27)} ${total.format()}`,
  ];
}

function renderAccount(account) {
  const fee = account.fees.length === 0
    ? 'none'
    : account.fees.map((f) => `${f.amount.negated().format()} for day ${f.day}, which closed at ${f.closingBalance.format()}`).join('; ');

  return [
    `  ${account.id} (${account.currency})`,
    ...renderRewrites(account),
    `  closing ledger balance ${right(account.closing.format(), 12)}`,
    `  holds                  ${right(account.held.format(), 12)}`,
    `  available balance      ${right(account.available.format(), 12)}`,
    `  overdraft fee          ${fee}`,
    ...renderAuthorizations(account),
    ...renderInterest(account),
  ];
}

function renderErrors(dayReport) {
  const errors = dayReport.accounts.flatMap((account) =>
    account.errors.map((error) => `  ${pad(error.sourceEvent, 6)}${account.id}  ${error.reason}`)
  );

  return errors.length === 0 ? ['  none'] : errors;
}

export function renderDay(dayReport) {
  const lines = [LINE, `DAY ${dayReport.day}`, LINE, '', 'events booked today', ...renderArrivals(dayReport.outcomes), ''];

  for (const account of dayReport.accounts) {
    lines.push(...renderAccount(account), '');
  }

  lines.push('errors', ...renderErrors(dayReport), '');
  return lines.join('\n');
}

export function renderSummary(result) {
  const last = result.days[result.days.length - 1];

  const lines = [LINE, 'END OF WINDOW', LINE, ''];

  for (const account of last.accounts) {
    const fees = result.days.flatMap((d) => d.accounts.find((a) => a.id === account.id).fees);
    const interest = account.interest ? account.interest.total : null;

    lines.push(
      `  ${account.id} (${account.currency})`,
      `  closing ledger balance ${right(account.closing.format(), 12)}`,
      `  overdraft fees charged ${right(fees.length, 12)}  on days ${fees.map((f) => f.day).join(', ') || 'none'}`,
      `  interest capitalised   ${right(interest ? interest.format() : 'none', 12)}`,
      ''
    );
  }

  lines.push(THIN, `  ledger records written ${right(result.ledger.size, 12)}`, '  nothing was ever edited or removed', '');
  return lines.join('\n');
}

export function renderRun(result) {
  return [...result.days.map(renderDay), renderSummary(result)].join('\n');
}
