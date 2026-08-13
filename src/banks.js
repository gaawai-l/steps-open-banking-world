/**
 * Four simulated Hong Kong retail banks exposing the HKMA Open API phases 1 to 4.
 *
 * Phase 1 — product and service information
 * Phase 2 — customer acquisition
 * Phase 3 — account information
 * Phase 4 — transactions and payment initiation
 */

export const BANK_KEYS = ['s-hsbc', 's-scb', 's-dbs', 's-boc'];

export const BANKS = {
  's-hsbc': { name: 'S-HSBC Bank', mortgageRate: 3.38, cardCashback: 1.2 },
  's-scb': { name: 'S-Standard Chartered', mortgageRate: 3.25, cardCashback: 1.6 },
  's-dbs': { name: 'S-DBS Bank', mortgageRate: 3.45, cardCashback: 2.0 },
  's-boc': { name: 'S-Bank of China', mortgageRate: 3.19, cardCashback: 0.8 },
};

const accounts = {
  's-hsbc': { id: 'hk-hsbc-8841', type: 'savings', balance: 48250.75, currency: 'HKD' },
  's-scb': { id: 'hk-scb-2277', type: 'current', balance: 12980.40, currency: 'HKD' },
  's-dbs': { id: 'hk-dbs-6310', type: 'credit_card', balance: -4210.00, currency: 'HKD' },
  's-boc': { id: 'hk-boc-9052', type: 'savings', balance: 23110.10, currency: 'HKD' },
};

const creditLimits = { 's-dbs': 20000, 's-hsbc': 45000, 's-scb': 30000, 's-boc': 15000 };
const rewardPoints = { 's-dbs': 32000, 's-hsbc': 8400, 's-scb': 15200, 's-boc': 2600 };
const POINT_TO_HKD = 0.001;

const transactions = {
  's-hsbc': [
    { date: '2026-08-02', description: 'Supermarket', amount: -412.60 },
    { date: '2026-08-05', description: 'Payroll', amount: 28400.00 },
  ],
  's-scb': [{ date: '2026-08-04', description: 'Utilities', amount: -880.20 }],
  's-dbs': [{ date: '2026-08-09', description: 'Fine dining', amount: -1860.00 }],
  's-boc': [{ date: '2026-08-07', description: 'Transport', amount: -64.00 }],
};

/** Phase 4 merchant offers; the dining discount drives card selection at the POS. */
const cardOffers = {
  's-dbs': { merchantCategory: 'fine_dining', discountPercent: 15 },
  's-hsbc': { merchantCategory: 'fine_dining', discountPercent: 8 },
  's-scb': { merchantCategory: 'groceries', discountPercent: 5 },
  's-boc': { merchantCategory: 'transport', discountPercent: 3 },
};

const investmentProducts = {
  's-scb': [
    { code: 'SCB-FX-AUD', kind: 'foreign_currency', indicativeYield: 4.1 },
    { code: 'SCB-MF-GLOBAL', kind: 'mutual_fund', indicativeYield: 6.4 },
  ],
  's-hsbc': [{ code: 'HSBC-MF-ASIA', kind: 'mutual_fund', indicativeYield: 5.2 }],
  's-dbs': [{ code: 'DBS-TD-6M', kind: 'time_deposit', indicativeYield: 3.0 }],
  's-boc': [{ code: 'BOC-GOLD', kind: 'precious_metals', indicativeYield: 2.2 }],
};

const insurancePlans = Object.fromEntries(BANK_KEYS.map((bank) => [
  bank,
  [{ code: `${bank.toUpperCase()}-LIFE-1`, kind: 'life', annualPremium: 4800 }],
]));

/** Phase 1 loan catalogue, offered by every bank alongside deposits and investments. */
const loanCatalogue = Object.fromEntries(BANK_KEYS.map((bank) => [
  bank,
  [
    { code: `${bank.toUpperCase()}-PL`, kind: 'personal_loan', annualRate: Number((BANKS[bank].mortgageRate + 2.6).toFixed(2)) },
    { code: `${bank.toUpperCase()}-MTG`, kind: 'mortgage', annualRate: BANKS[bank].mortgageRate },
    { code: `${bank.toUpperCase()}-TAX`, kind: 'tax_loan', annualRate: Number((BANKS[bank].mortgageRate + 0.4).toFixed(2)) },
  ],
]));

/** Phase 3 drawn-down loans, the account-service data behind a loan detail enquiry. */
const drawnLoans = {
  's-hsbc': [{ loanId: 'hk-hsbc-mtg-01', kind: 'mortgage', outstanding: 2480000, annualRate: 3.38, remainingTermMonths: 244 }],
  's-scb': [{ loanId: 'hk-scb-pl-07', kind: 'personal_loan', outstanding: 68000, annualRate: 5.85, remainingTermMonths: 22 }],
  's-dbs': [{ loanId: 'hk-dbs-tax-03', kind: 'tax_loan', outstanding: 41000, annualRate: 3.85, remainingTermMonths: 9 }],
  's-boc': [{ loanId: 'hk-boc-pl-12', kind: 'personal_loan', outstanding: 15400, annualRate: 5.79, remainingTermMonths: 14 }],
};

/** Phase 3 in-force policies, the account-service data behind a policy detail enquiry. */
const heldPolicies = Object.fromEntries(BANK_KEYS.map((bank) => [
  bank,
  [{
    policyId: `${bank}-pol-2201`,
    kind: 'life',
    sumInsured: 1200000,
    annualPremium: 4800,
    renewalDate: '2027-03-01',
    status: 'in_force',
  }],
]));

export const knownBank = (bank) => Object.prototype.hasOwnProperty.call(BANKS, bank);

export const listBanks = () => BANK_KEYS.map((key) => ({ key, ...BANKS[key] }));

// --- Phase 1: product and service information -------------------------------------

/** Phase 1 product information; the wallet aggregates this across all four banks. */
export function mortgageRates() {
  return BANK_KEYS.map((key) => ({
    bank: key,
    name: BANKS[key].name,
    mortgageRate: BANKS[key].mortgageRate,
  }));
}

export function depositProducts(bank) {
  const rate = BANKS[bank].mortgageRate;
  return {
    bank,
    savingsRate: Number((rate - 2.4).toFixed(2)),
    timeDepositRate: Number((rate - 1.1).toFixed(2)),
    fxAccountRate: Number((rate - 1.8).toFixed(2)),
  };
}

export function creditCardOffers(bank) {
  return { bank, cashbackPercent: BANKS[bank].cardCashback, merchantOffer: cardOffers[bank] };
}

export const investmentCatalogue = (bank) => ({ bank, products: investmentProducts[bank] });
export const insuranceCatalogue = (bank) => ({ bank, plans: insurancePlans[bank] });
export const loanProducts = (bank) => ({ bank, loans: loanCatalogue[bank] });

// --- Phase 2: customer acquisition -------------------------------------------------

/** Phase 2 customer acquisition: a pre-filled application submitted by a TSP. */
export function submitCreditCardApplication(bank, payload) {
  const applicant = String(payload.applicantName || '').trim();
  if (!applicant) return { error: 'applicant_name is required' };
  return {
    bank,
    applicationId: `${bank}-cc-${hash(applicant)}`,
    status: 'received',
    product: 'credit_card',
    cashbackPercent: BANKS[bank].cardCashback,
  };
}

export function openAccount(bank, payload) {
  const applicant = String(payload.applicantName || '').trim();
  if (!applicant) return { error: 'applicant_name is required' };
  return {
    bank,
    applicationId: `${bank}-acct-${hash(applicant)}`,
    status: 'received',
    product: payload.product || 'savings',
  };
}

/** Phase 2 investment account setup, the entry point for the investment product line. */
export function openInvestmentAccount(bank, payload) {
  const applicant = String(payload.applicantName || '').trim();
  if (!applicant) return { error: 'applicant_name is required' };
  return {
    bank,
    applicationId: `${bank}-inv-${hash(applicant)}`,
    status: 'received',
    product: 'investment_account',
    riskProfile: payload.riskProfile || 'balanced',
  };
}

/** Phase 2 loan request, submitted with the applicant's declared income. */
export function submitLoanApplication(bank, payload) {
  const applicant = String(payload.applicantName || '').trim();
  const amount = Number(payload.amount || 0);
  if (!applicant) return { error: 'applicant_name is required' };
  if (amount <= 0) return { error: 'amount must be positive' };
  const product = loanCatalogue[bank].find((item) => item.kind === (payload.kind || 'personal_loan'));
  if (!product) return { error: 'unknown_loan_kind' };
  return {
    bank,
    applicationId: `${bank}-loan-${hash(applicant)}`,
    status: 'received',
    product: 'loan',
    kind: product.kind,
    requestedAmount: amount,
    indicativeAnnualRate: product.annualRate,
  };
}

/** Phase 2 insurance application for one of the bank's Phase 1 plans. */
export function submitInsuranceApplication(bank, payload) {
  const applicant = String(payload.applicantName || '').trim();
  if (!applicant) return { error: 'applicant_name is required' };
  const plan = insurancePlans[bank].find((item) => item.code === payload.planCode)
    ?? insurancePlans[bank][0];
  return {
    bank,
    applicationId: `${bank}-ins-${hash(applicant)}`,
    status: 'received',
    product: 'insurance',
    planCode: plan.code,
    annualPremium: plan.annualPremium,
  };
}

// --- Phase 3: account information --------------------------------------------------

/** Phase 3 account information; the basis for consolidated account aggregation. */
export function accountBalance(bank) {
  const account = accounts[bank];
  return {
    bank,
    accountId: account.id,
    type: account.type,
    balance: account.balance,
    currency: account.currency,
    creditLimit: creditLimits[bank],
  };
}

export const transactionHistory = (bank) => ({ bank, transactions: transactions[bank] });

export const rewardBalance = (bank) => ({
  bank,
  points: rewardPoints[bank],
  cashValue: Number((rewardPoints[bank] * POINT_TO_HKD).toFixed(2)),
});

/** Phase 3 loan details: outstanding balance, rate and remaining term per drawn loan. */
export const loanDetails = (bank) => ({ bank, loans: drawnLoans[bank] });

/** Phase 3 policy details: sum insured, premium and renewal date per in-force policy. */
export const policyDetails = (bank) => ({ bank, policies: heldPolicies[bank] });

/** Phase 3 investment holdings valued at the current indicative yield. */
export const investmentHoldings = (bank) => ({
  bank,
  holdings: investmentProducts[bank].map((product) => ({
    code: product.code,
    kind: product.kind,
    units: 100,
    marketValue: Number((100 * (10 + product.indicativeYield)).toFixed(2)),
  })),
});

/** Phase 3 + 4: automated credit limit review when a bill exceeds the current limit. */
export function reviewCreditLimit(bank, payload) {
  const requested = Number(payload.requestedAmount || 0);
  const current = creditLimits[bank];
  if (requested <= current) {
    return { bank, decision: 'no_increase_needed', creditLimit: current };
  }
  creditLimits[bank] = Number(Math.min(requested * 1.2, current * 2).toFixed(2));
  return { bank, decision: 'approved', previousLimit: current, creditLimit: creditLimits[bank] };
}

// --- Phase 4: transactions and payment initiation ----------------------------------

/** Phase 4 payment initiation over FPS; used for real-time bill splitting. */
export function initiateFpsTransfer(bank, payload) {
  const amount = Number(payload.amount || 0);
  if (amount <= 0) return { error: 'amount must be positive' };
  const account = accounts[bank];
  if (account.balance < amount) return { error: 'insufficient_funds' };
  account.balance = Number((account.balance - amount).toFixed(2));
  return {
    bank,
    paymentId: `fps-${bank}-${Math.round(amount * 100)}`,
    status: 'settled',
    amount,
    payee: payload.payee || 'merchant',
    remainingBalance: account.balance,
  };
}

/** Phase 4 reward point redemption converted into cash credit at checkout. */
export function redeemPoints(bank, payload) {
  const points = Number(payload.points || 0);
  const available = rewardPoints[bank];
  if (!Number.isInteger(points) || points <= 0 || points > available) {
    return { error: 'invalid_point_amount' };
  }
  rewardPoints[bank] = available - points;
  return {
    bank,
    redeemedPoints: points,
    cashCredit: Number((points * POINT_TO_HKD).toFixed(2)),
    remainingPoints: rewardPoints[bank],
  };
}

export function cardRepayment(bank, payload) {
  const amount = Number(payload.amount || 0);
  if (amount <= 0) return { error: 'amount must be positive' };
  const account = accounts[bank];
  account.balance = Number((account.balance + amount).toFixed(2));
  return { bank, status: 'settled', amount, outstandingBalance: account.balance };
}

/** Phase 4 fund purchase order; used to route spare change into a savings product. */
export function purchaseInvestment(bank, payload) {
  const amount = Number(payload.amount || 0);
  const code = String(payload.productCode || '');
  const product = investmentProducts[bank].find((item) => item.code === code);
  if (!product) return { error: 'unknown_product_code' };
  if (amount <= 0) return { error: 'amount must be positive' };
  return {
    bank,
    orderId: `inv-${bank}-${Math.round(amount * 100)}`,
    status: 'accepted',
    product,
    amount,
  };
}

/** Phase 4 card purchase authorisation at a merchant terminal. */
export function cardPurchase(bank, payload) {
  const amount = Number(payload.amount || 0);
  if (amount <= 0) return { error: 'amount must be positive' };
  const account = accounts[bank];
  const exposure = Math.abs(Math.min(account.balance, 0)) + amount;
  if (exposure > creditLimits[bank]) {
    return { error: 'over_credit_limit', creditLimit: creditLimits[bank], required: exposure };
  }
  account.balance = Number((account.balance - amount).toFixed(2));
  return {
    bank,
    purchaseId: `pur-${bank}-${Math.round(amount * 100)}`,
    status: 'authorised',
    amount,
    merchant: payload.merchant || 'unknown',
    merchantCategory: payload.merchantCategory || 'general',
  };
}

/** Phase 4 securities trade: a buy or sell order against a listed instrument. */
export function securitiesTrade(bank, payload) {
  const side = payload.side === 'sell' ? 'sell' : 'buy';
  const quantity = Number(payload.quantity || 0);
  const symbol = String(payload.symbol || '').trim();
  if (!symbol) return { error: 'symbol is required' };
  if (!Number.isInteger(quantity) || quantity <= 0) return { error: 'invalid_quantity' };
  const price = Number((100 + (symbol.length * 7.5)).toFixed(2));
  return {
    bank,
    tradeId: `trd-${bank}-${quantity}-${symbol.toLowerCase()}`,
    status: 'executed',
    side,
    symbol,
    quantity,
    executedPrice: price,
    consideration: Number((price * quantity).toFixed(2)),
  };
}

/**
 * Phase 4 direct debit mandate: a recurring authorisation the payer grants once, which
 * later collections draw against without a fresh approval each cycle.
 */
export function directDebitMandate(bank, payload) {
  const amount = Number(payload.amountPerCycle || 0);
  const payee = String(payload.payee || '').trim();
  if (!payee) return { error: 'payee is required' };
  if (amount <= 0) return { error: 'amountPerCycle must be positive' };
  return {
    bank,
    mandateId: `ddm-${bank}-${hash(payee)}`,
    status: 'active',
    payee,
    amountPerCycle: amount,
    frequency: payload.frequency || 'monthly',
    nextCollectionDate: '2026-09-01',
  };
}

/**
 * Phase 4 direct debit settlement paid straight to the merchant, which is how the
 * restaurant avoids the two to three day card settlement delay.
 */
export function merchantSettlement(payload) {
  const amount = Number(payload.amount || 0);
  if (amount <= 0) return { error: 'amount must be positive' };
  return {
    settlementId: `stl-${Math.round(amount * 100)}`,
    status: 'settled',
    amount,
    merchant: payload.merchant || 'unknown',
    settlementDelayDays: 0,
  };
}

/**
 * Phase 4 working capital: the restaurant shares its POS transaction volume through the
 * API and receives a pre-approved business loan offer from S-DBS.
 */
export function workingCapitalOffer(payload) {
  const monthlyVolume = Number(payload.monthlyPosVolume || 0);
  if (monthlyVolume <= 0) return { error: 'monthlyPosVolume must be positive' };
  const limit = Number((monthlyVolume * 1.5).toFixed(2));
  return {
    bank: 's-dbs',
    product: 'working_capital_loan',
    status: 'pre_approved',
    monthlyPosVolume: monthlyVolume,
    approvedLimit: limit,
    annualRate: 6.8,
  };
}

/**
 * BaaS: an embedded white-label credit line issued by S-DBS and presented inside the
 * wallet, so the FinTech offers credit without holding a banking licence itself.
 */
export function embeddedCreditLine(payload) {
  const requested = Number(payload.amount || 0);
  if (requested <= 0) return { error: 'amount must be positive' };
  const approved = Number(Math.min(requested, 50000).toFixed(2));
  return {
    issuingBank: 's-dbs',
    brandedAs: 'Hippo Credit',
    product: 'white_label_credit_line',
    status: 'issued',
    approvedLimit: approved,
    licenceHolder: 'S-DBS Bank',
  };
}

/** BaaS: a Buy-Now-Pay-Later instalment plan for a large bill, funded by S-DBS. */
export function bnplPlan(payload) {
  const amount = Number(payload.amount || 0);
  const instalments = Number(payload.instalments || 3);
  if (amount <= 0) return { error: 'amount must be positive' };
  if (![3, 6, 12].includes(instalments)) return { error: 'unsupported_instalment_count' };
  const monthly = Number((amount / instalments).toFixed(2));
  return {
    fundingBank: 's-dbs',
    brandedAs: 'Hippo BNPL',
    product: 'buy_now_pay_later',
    status: 'approved',
    amount,
    instalments,
    monthlyPayment: monthly,
    annualRate: 0,
  };
}

function hash(value) {
  let total = 0;
  for (const char of value) total = (total * 31 + char.charCodeAt(0)) % 100000;
  return String(total).padStart(5, '0');
}
