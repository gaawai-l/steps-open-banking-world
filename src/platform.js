/**
 * API management and monetization platform.
 *
 * Covers the four platform capabilities the exercise names: a developer portal with a
 * sandbox, an API gateway enforcing OAuth tokens and rate limits, a monetization engine
 * that meters calls and computes tier billing plus partner revenue share, and compliance
 * monitoring that logs the consent lifecycle for HKMA reporting.
 */

const TSP_REGISTRY = new Map();
const TOKENS = new Map();
const CALL_LOG = [];
const CONSENT_LOG = [];
const RATE_WINDOW_MS = 60_000;

/** DDoS shield state: a one-second burst window and the block it triggers. */
const DDOS_WINDOW = new Map();
const DDOS_BLOCKS = new Map();
const DDOS_WINDOW_MS = 1_000;
const DDOS_BURST_THRESHOLD = 120;
const DDOS_BLOCK_MS = 60_000;

/**
 * Freemium and tiered access: phase 1 product data is free, while phase 3 account data
 * and phase 4 payment execution are charged per call at a tier-dependent rate.
 */
export const PRICING = {
  free: {
    monthlyFee: 0,
    rateLimitPerMinute: 30,
    perCall: { phase1: 0, phase2: 0.02, phase3: 0.05, phase4: 0.12 },
  },
  growth: {
    monthlyFee: 2500,
    rateLimitPerMinute: 300,
    perCall: { phase1: 0, phase2: 0.015, phase3: 0.035, phase4: 0.09 },
  },
  enterprise: {
    monthlyFee: 18000,
    rateLimitPerMinute: 3000,
    perCall: { phase1: 0, phase2: 0.008, phase3: 0.02, phase4: 0.05 },
  },
};

/** Revenue share paid back to a partner that originates an embedded product signup. */
export const REVENUE_SHARE = {
  affiliateCommissionRate: 0.15,
  baasLicenceMonthlyFee: 12000,
  baasTransactionShareRate: 0.004,
};

/** Pay-by-bank undercuts card acquiring, which is the merchant's reason to adopt it. */
export const MERCHANT_PRICING = { payByBankRate: 0.005, cardSchemeRate: 0.025 };

export function phaseOfPath(path) {
  if (path.includes('/payments/') || path.includes('/rewards/redeem')
    || path.includes('/investments/orders') || path.includes('/investments/trades')
    || path.includes('/merchant/')) return 'phase4';
  if (path.includes('/accounts/')) return 'phase3';
  if (path.includes('/applications/')) return 'phase2';
  return 'phase1';
}

/** Developer portal: register a Third-Party Service Provider and issue credentials. */
export function registerTsp(payload) {
  const name = String(payload.name || '').trim();
  if (!name) return { error: 'name is required' };
  const tier = PRICING[payload.tier] ? payload.tier : 'free';
  const clientId = `tsp_${slug(name)}`;
  const clientSecret = `sec_${slug(name)}_${TSP_REGISTRY.size + 1}`;
  TSP_REGISTRY.set(clientId, { clientId, clientSecret, name, tier, registeredAt: Date.now() });
  return { clientId, clientSecret, name, tier, ...PRICING[tier] };
}

export const listTsps = () => [...TSP_REGISTRY.values()]
  .map(({ clientSecret, ...rest }) => rest);

/**
 * Developer portal: the SDKs a registered TSP can pull to call these APIs, alongside the
 * sandbox. Each entry carries the install command and a ready-to-run snippet so a
 * developer does not have to hand-roll the OAuth exchange.
 */
export function sdkCatalogue() {
  return {
    sdks: [
      {
        language: 'javascript',
        package: '@hippo/open-api-sdk',
        install: 'npm install @hippo/open-api-sdk',
        snippet: "const client = new HippoOpenApi({ clientId, clientSecret });\n"
          + "await client.phase1.mortgageRates();",
      },
      {
        language: 'python',
        package: 'hippo-open-api',
        install: 'pip install hippo-open-api',
        snippet: 'client = HippoOpenApi(client_id, client_secret)\n'
          + 'client.phase3.account_balance("s-dbs")',
      },
      {
        language: 'java',
        package: 'io.hippo:open-api-sdk',
        install: 'implementation "io.hippo:open-api-sdk:1.4.0"',
        snippet: 'HippoOpenApi client = new HippoOpenApi(clientId, clientSecret);\n'
          + 'client.phase4().initiateFpsTransfer("s-hsbc", request);',
      },
    ],
    openApiSpecUrl: '/platform/openapi.json',
    postmanCollectionUrl: '/platform/postman-collection.json',
  };
}

/** Gateway: OAuth client-credentials token issuance. */
export function issueToken(payload) {
  const record = TSP_REGISTRY.get(String(payload.clientId || ''));
  if (!record || record.clientSecret !== payload.clientSecret) {
    return { error: 'invalid_client' };
  }
  const token = `tok_${record.clientId}_${TOKENS.size + 1}`;
  TOKENS.set(token, { clientId: record.clientId, issuedAt: Date.now(), calls: [] });
  return { accessToken: token, tokenType: 'Bearer', expiresIn: 3600, scope: 'phases:1-4' };
}

/**
 * Gateway: validate the bearer token and enforce the tier's rate limit before the call
 * reaches a bank endpoint. Returns null when the call is allowed.
 */
export function authorizeCall(authorizationHeader, path) {
  const token = String(authorizationHeader || '').replace(/^Bearer\s+/i, '');
  const session = TOKENS.get(token);
  if (!session) return { status: 401, body: { error: 'invalid_token' } };

  // DDoS protection runs ahead of the per-tier quota: a volumetric burst has to be shed
  // before it is metered, or the flood itself becomes a billable event.
  const shed = ddosShield(session.clientId);
  if (shed) return shed;

  const tsp = TSP_REGISTRY.get(session.clientId);
  const limit = PRICING[tsp.tier].rateLimitPerMinute;
  const now = Date.now();
  session.calls = session.calls.filter((at) => now - at < RATE_WINDOW_MS);
  if (session.calls.length >= limit) {
    return { status: 429, body: { error: 'rate_limit_exceeded', limitPerMinute: limit } };
  }
  session.calls.push(now);
  meterCall({ clientId: session.clientId, tier: tsp.tier, path });
  return null;
}

/**
 * Gateway: volumetric DDoS protection.
 *
 * Distinct from rate limiting, which shapes a paying client's normal traffic to its tier.
 * This sheds an attack: a burst far above any tier's ceiling trips a temporary block on
 * the source, so one hostile client cannot exhaust the gateway for everyone else.
 */
export function ddosShield(clientId, now = Date.now()) {
  const blockedUntil = DDOS_BLOCKS.get(clientId);
  if (blockedUntil && blockedUntil > now) {
    return {
      status: 429,
      body: {
        error: 'ddos_protection_triggered',
        retryAfterSeconds: Math.ceil((blockedUntil - now) / 1000),
      },
    };
  }
  const recent = (DDOS_WINDOW.get(clientId) ?? []).filter((at) => now - at < DDOS_WINDOW_MS);
  recent.push(now);
  DDOS_WINDOW.set(clientId, recent);
  if (recent.length > DDOS_BURST_THRESHOLD) {
    DDOS_BLOCKS.set(clientId, now + DDOS_BLOCK_MS);
    return {
      status: 429,
      body: {
        error: 'ddos_protection_triggered',
        burstSize: recent.length,
        thresholdPerSecond: DDOS_BURST_THRESHOLD,
        retryAfterSeconds: DDOS_BLOCK_MS / 1000,
      },
    };
  }
  return null;
}

/** Current DDoS shield state, surfaced on the platform's operations dashboard. */
export const ddosStatus = () => ({
  thresholdPerSecond: DDOS_BURST_THRESHOLD,
  blockDurationSeconds: DDOS_BLOCK_MS / 1000,
  blockedClients: [...DDOS_BLOCKS.entries()]
    .filter(([, until]) => until > Date.now())
    .map(([clientId, until]) => ({ clientId, retryAfterSeconds: Math.ceil((until - Date.now()) / 1000) })),
});

/** Monetization engine: meter one billable call. */
export function meterCall({ clientId, tier, path }) {
  const phase = phaseOfPath(path);
  CALL_LOG.push({ clientId, tier, phase, path, at: Date.now() });
}

/** Monetization engine: compute a bill from metered volume plus the tier fee. */
export function billingStatement(clientId) {
  const tsp = TSP_REGISTRY.get(clientId);
  if (!tsp) return { error: 'unknown_client' };
  const pricing = PRICING[tsp.tier];
  const calls = CALL_LOG.filter((entry) => entry.clientId === clientId);
  const byPhase = { phase1: 0, phase2: 0, phase3: 0, phase4: 0 };
  for (const call of calls) byPhase[call.phase] += 1;
  const usageCharge = Object.entries(byPhase)
    .reduce((total, [phase, count]) => total + count * pricing.perCall[phase], 0);
  return {
    clientId,
    tier: tsp.tier,
    monthlyFee: pricing.monthlyFee,
    callsByPhase: byPhase,
    totalCalls: calls.length,
    usageCharge: Number(usageCharge.toFixed(4)),
    amountDue: Number((pricing.monthlyFee + usageCharge).toFixed(2)),
  };
}

/** Revenue sharing: an affiliate commission for an embedded product signup. */
export function settlePartnerRevenue(payload) {
  const productValue = Number(payload.productValue || 0);
  if (productValue <= 0) return { error: 'productValue must be positive' };
  const commission = Number((productValue * REVENUE_SHARE.affiliateCommissionRate).toFixed(2));
  return {
    partner: payload.partner || 'hippo-fintech',
    product: payload.product || 'embedded_credit_line',
    productValue,
    commissionRate: REVENUE_SHARE.affiliateCommissionRate,
    commission,
    status: 'settled',
  };
}

/** BaaS licensing: the recurring licence fee plus the transaction revenue share. */
export function baasLicenceInvoice(payload) {
  const volume = Number(payload.monthlyTransactionVolume || 0);
  const share = Number((volume * REVENUE_SHARE.baasTransactionShareRate).toFixed(2));
  return {
    partner: payload.partner || 'hippo-fintech',
    licenceFee: REVENUE_SHARE.baasLicenceMonthlyFee,
    monthlyTransactionVolume: volume,
    transactionShareRate: REVENUE_SHARE.baasTransactionShareRate,
    transactionShare: share,
    amountDue: Number((REVENUE_SHARE.baasLicenceMonthlyFee + share).toFixed(2)),
  };
}

/** Pay-by-bank pricing against card acquiring, for a merchant comparison. */
export function merchantFeeComparison(payload) {
  const amount = Number(payload.amount || 0);
  if (amount <= 0) return { error: 'amount must be positive' };
  const payByBank = Number((amount * MERCHANT_PRICING.payByBankRate).toFixed(2));
  const card = Number((amount * MERCHANT_PRICING.cardSchemeRate).toFixed(2));
  return {
    amount,
    payByBankRate: MERCHANT_PRICING.payByBankRate,
    payByBankFee: payByBank,
    cardSchemeRate: MERCHANT_PRICING.cardSchemeRate,
    cardSchemeFee: card,
    saved: Number((card - payByBank).toFixed(2)),
  };
}

/** eKYC: a paid per-call identity and account ownership verification. */
export function verifyIdentity(payload) {
  const name = String(payload.name || '').trim();
  const accountId = String(payload.accountId || '').trim();
  if (!name || !accountId) return { error: 'name and accountId are required' };
  return {
    verified: true,
    name,
    accountId,
    checks: { identity: 'match', accountOwnership: 'match', employment: 'verified' },
    feeCharged: 4.5,
  };
}

/** Compliance monitoring: record a consent lifecycle event for HKMA reporting. */
export function recordConsent(payload) {
  const event = {
    consentId: String(payload.consentId || `consent-${CONSENT_LOG.length + 1}`),
    subject: payload.subject || 'maria',
    tsp: payload.tsp || 'hippo-fintech',
    scope: payload.scope || 'accounts:read',
    action: ['granted', 'renewed', 'revoked', 'expired'].includes(payload.action)
      ? payload.action
      : 'granted',
    at: Date.now(),
  };
  CONSENT_LOG.push(event);
  return event;
}

export const consentLedger = () => [...CONSENT_LOG];

export function hasActiveConsent(scope) {
  const relevant = CONSENT_LOG.filter((entry) => entry.scope === scope);
  const latest = relevant[relevant.length - 1];
  return Boolean(latest && (latest.action === 'granted' || latest.action === 'renewed'));
}

/** Compliance monitoring: the regulatory metrics an HKMA report is built from. */
export function complianceReport() {
  const granted = CONSENT_LOG.filter((entry) => entry.action === 'granted').length;
  const revoked = CONSENT_LOG.filter((entry) => entry.action === 'revoked').length;
  return {
    consentsGranted: granted,
    consentsRevoked: revoked,
    activeConsents: Math.max(granted - revoked, 0),
    totalApiCalls: CALL_LOG.length,
    callsByPhase: CALL_LOG.reduce((acc, call) => {
      acc[call.phase] = (acc[call.phase] || 0) + 1;
      return acc;
    }, {}),
    registeredTsps: TSP_REGISTRY.size,
  };
}

/** Developer portal: the endpoint catalogue the sandbox renders and exercises. */
export const ENDPOINT_CATALOGUE = [
  { phase: 1, method: 'GET', path: '/open-api/products/mortgage-rates', summary: 'Mortgage rates across all four banks' },
  { phase: 1, method: 'GET', path: '/open-api/banks/{bank}/products/deposits', summary: 'Savings, time deposit and FX rates' },
  { phase: 1, method: 'GET', path: '/open-api/banks/{bank}/products/credit-cards', summary: 'Card cashback and merchant offers' },
  { phase: 1, method: 'GET', path: '/open-api/banks/{bank}/products/investments', summary: 'Retail fund and structured product terms' },
  { phase: 1, method: 'GET', path: '/open-api/banks/{bank}/products/insurance', summary: 'General and life plan details' },
  { phase: 1, method: 'GET', path: '/open-api/banks/{bank}/products/loans', summary: 'Personal loan, mortgage and tax loan terms' },
  { phase: 2, method: 'POST', path: '/open-api/banks/{bank}/applications/credit-card', summary: 'Card application' },
  { phase: 2, method: 'POST', path: '/open-api/banks/{bank}/applications/account', summary: 'Account opening' },
  { phase: 2, method: 'POST', path: '/open-api/banks/{bank}/applications/investment', summary: 'Investment account setup' },
  { phase: 2, method: 'POST', path: '/open-api/banks/{bank}/applications/loan', summary: 'Loan request' },
  { phase: 2, method: 'POST', path: '/open-api/banks/{bank}/applications/insurance', summary: 'Insurance application' },
  { phase: 3, method: 'GET', path: '/open-api/banks/{bank}/accounts/balance', summary: 'Account balance and credit limit' },
  { phase: 3, method: 'GET', path: '/open-api/banks/{bank}/accounts/transactions', summary: 'Transaction history' },
  { phase: 3, method: 'GET', path: '/open-api/banks/{bank}/accounts/reward-points', summary: 'Reward point balance' },
  { phase: 3, method: 'GET', path: '/open-api/banks/{bank}/accounts/loans', summary: 'Loan details: outstanding, rate and term' },
  { phase: 3, method: 'GET', path: '/open-api/banks/{bank}/accounts/investments', summary: 'Investment holdings and market value' },
  { phase: 3, method: 'GET', path: '/open-api/banks/{bank}/accounts/policies', summary: 'Policy details: sum insured and renewal' },
  { phase: 3, method: 'POST', path: '/open-api/banks/{bank}/accounts/credit-limit-review', summary: 'Automated credit limit evaluation' },
  { phase: 4, method: 'POST', path: '/open-api/banks/{bank}/payments/fps', summary: 'FPS transfer' },
  { phase: 4, method: 'POST', path: '/open-api/banks/{bank}/payments/card-repayment', summary: 'Card repayment' },
  { phase: 4, method: 'POST', path: '/open-api/banks/{bank}/payments/card-purchase', summary: 'Card purchase authorisation' },
  { phase: 4, method: 'POST', path: '/open-api/banks/{bank}/payments/direct-debit-mandate', summary: 'Direct debit mandate' },
  { phase: 4, method: 'POST', path: '/open-api/banks/{bank}/rewards/redeem', summary: 'Reward point redemption' },
  { phase: 4, method: 'POST', path: '/open-api/banks/{bank}/investments/orders', summary: 'Fund purchase order' },
  { phase: 4, method: 'POST', path: '/open-api/banks/{bank}/investments/trades', summary: 'Securities buy or sell trade' },
  { phase: 4, method: 'POST', path: '/open-api/merchant/settlement', summary: 'Direct debit merchant settlement' },
];

function slug(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
}
