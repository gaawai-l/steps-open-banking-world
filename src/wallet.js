/**
 * Hippo FinTech Wallet — the Third-Party Service Provider.
 *
 * Implements the eight simulated use cases from the exercise by calling the banks'
 * Open APIs and composing them into consumer workflows.
 */

import * as banks from './banks.js';
import * as platform from './platform.js';

const DINING_MERCHANT = 'italian-restaurant';

/** Use case 1 — Phase 1: compare mortgage rates across all four banks in one view. */
export function compareMortgageRates() {
  return [...banks.mortgageRates()].sort((a, b) => a.mortgageRate - b.mortgageRate);
}

/** Use case 2 — Phase 2: submit one pre-filled credit card application to every bank. */
export function applyForCreditCards(applicantName) {
  return banks.BANK_KEYS.map((bank) => ({
    bank,
    ...banks.submitCreditCardApplication(bank, { applicantName }),
  }));
}

/**
 * Use case 3 — Phase 3: consolidated balances and transaction history.
 * Consent is checked first: the exercise makes granting consent part of the flow, and
 * the compliance ledger has to be able to show it happened.
 */
export function aggregateAccounts() {
  if (!platform.hasActiveConsent('accounts:read')) {
    return { error: 'consent_required', scope: 'accounts:read' };
  }
  const accounts = banks.BANK_KEYS.map((bank) => ({
    ...banks.accountBalance(bank),
    transactions: banks.transactionHistory(bank).transactions,
  }));
  const total = accounts.reduce((sum, account) => sum + account.balance, 0);
  return { accounts, totalBalance: Number(total.toFixed(2)) };
}

export function grantAccountConsent() {
  return platform.recordConsent({ scope: 'accounts:read', action: 'granted' });
}

export function revokeAccountConsent() {
  return platform.recordConsent({ scope: 'accounts:read', action: 'revoked' });
}

/** Use case 5 — Phase 3 & 4: automated credit limit review when the bill exceeds it. */
export function requestCreditLimitBoost(bank, requestedAmount) {
  return banks.reviewCreditLimit(bank, { requestedAmount });
}

/** Use case 6 — Phase 4: split the bill with real-time FPS transfers from each payer. */
export function splitBill(totalAmount, payers) {
  const share = Number((totalAmount / payers.length).toFixed(2));
  const transfers = payers.map((bank) => ({
    bank,
    ...banks.initiateFpsTransfer(bank, { amount: share, payee: DINING_MERCHANT }),
  }));
  return { share, transfers };
}

/** Use case 7 — Phase 3 & 4: convert reward points into cash credit to offset the bill. */
export function offsetWithPoints(bank, points) {
  const balance = banks.rewardBalance(bank);
  const redemption = banks.redeemPoints(bank, { points });
  return { availableBefore: balance.points, ...redemption };
}

/** Use case 8 — Phase 4: round the bill up and route the spare change into a fund. */
export function roundUpInvestment(amount, bank = 's-scb', productCode = 'SCB-MF-GLOBAL') {
  const rounded = Math.ceil(amount / 10) * 10;
  const spareChange = Number((rounded - amount).toFixed(2));
  if (spareChange <= 0) return { spareChange: 0, order: null };
  return { spareChange, order: banks.purchaseInvestment(bank, { amount: spareChange, productCode }) };
}

/**
 * BaaS — contextual wealth advice: Phase 3 holdings drive a personalized savings and
 * investment recommendation, without the FinTech holding a banking licence.
 */
export function wealthAdvice() {
  if (!platform.hasActiveConsent('accounts:read')) {
    return { error: 'consent_required', scope: 'accounts:read' };
  }
  const holdings = banks.BANK_KEYS.map((bank) => banks.accountBalance(bank));
  const idleCash = holdings
    .filter((account) => account.type !== 'credit_card' && account.balance > 20000)
    .reduce((sum, account) => sum + (account.balance - 20000), 0);
  const catalogue = banks.investmentCatalogue('s-scb').products;
  const pick = [...catalogue].sort((a, b) => b.indicativeYield - a.indicativeYield)[0];
  return {
    basis: 'phase3_holdings',
    idleCash: Number(idleCash.toFixed(2)),
    recommendation: idleCash > 0
      ? { action: 'move_idle_cash', product: pick, suggestedAmount: Number((idleCash * 0.5).toFixed(2)) }
      : { action: 'hold', product: null, suggestedAmount: 0 },
  };
}

/** BaaS — an embedded white-label credit line presented as a Hippo product. */
export const embeddedCredit = (amount) => banks.embeddedCreditLine({ amount });

/** BaaS — Hippo BNPL instalments for a large bill, funded by S-DBS. */
export const bnpl = (amount, instalments) => banks.bnplPlan({ amount, instalments });

/** Merchant side — zero-friction embedded QR table payment. */
export function qrTablePayment(amount, table) {
  const settlement = banks.merchantSettlement({ amount, merchant: DINING_MERCHANT });
  const fees = platform.merchantFeeComparison({ amount });
  return {
    method: 'embedded_qr',
    table: table || 'T-12',
    terminalRentalAvoided: true,
    settlement,
    fees,
  };
}

/** Merchant side — pre-approved working capital from shared POS volume. */
export const workingCapital = (monthlyPosVolume) =>
  banks.workingCapitalOffer({ monthlyPosVolume });
