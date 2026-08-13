/**
 * Open Banking & BaaS simulated world.
 *
 * One deployable application serving three roles behind internal routes:
 *   /            Hippo FinTech Wallet (Third-Party Service Provider)
 *   /pos.html    Fine dining merchant POS terminal
 *   /portal.html API management, developer portal and monetization platform
 *   /open-api/*  The four simulated banks' HKMA Open API (phases 1-4)
 *
 * Node standard library only, so the image builds with the network disabled.
 * Listens on $PORT (default 8080).
 */

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import * as banks from './src/banks.js';
import * as platform from './src/platform.js';
import * as wallet from './src/wallet.js';

const PORT = Number(process.env.PORT || 8080);
const PUBLIC_DIR = join(fileURLToPath(new URL('.', import.meta.url)), 'public');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
};

const BANK_ROUTE = /^\/open-api\/banks\/([a-z0-9-]+)(\/.*)?$/;

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

/** A domain result carrying `error` is a client error, not a server fault. */
const send = (res, result, okStatus = 200) =>
  sendJson(res, result && result.error ? 400 : okStatus, result);

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (chunks.length === 0) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    return {};
  }
}

async function serveStatic(res, pathname) {
  const relative = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  if (relative.includes('..')) return sendJson(res, 400, { error: 'bad_path' });
  try {
    const file = await readFile(join(PUBLIC_DIR, relative));
    res.writeHead(200, {
      'Content-Type': MIME[extname(relative)] || 'application/octet-stream',
      'Content-Length': file.length,
    });
    res.end(file);
  } catch {
    sendJson(res, 404, { error: 'not_found' });
  }
}

/** Bank Open API, phases 1 to 4, behind the gateway. */
function handleOpenApi(req, res, path, body) {
  // Gateway: OAuth token validation, rate limiting and call metering. Unauthenticated
  // access is allowed only for the free phase 1 product data, matching the pricing model.
  if (platform.phaseOfPath(path) !== 'phase1') {
    const rejection = platform.authorizeCall(req.headers.authorization, path);
    if (rejection) return sendJson(res, rejection.status, rejection.body);
  }

  if (req.method === 'GET' && path === '/open-api/banks') {
    return sendJson(res, 200, { banks: banks.listBanks() });
  }
  if (req.method === 'GET' && path === '/open-api/products/mortgage-rates') {
    return sendJson(res, 200, { mortgageRates: banks.mortgageRates() });
  }
  if (req.method === 'POST' && path === '/open-api/merchant/settlement') {
    return send(res, banks.merchantSettlement(body), 201);
  }
  if (req.method === 'POST' && path === '/open-api/merchant/working-capital') {
    return send(res, banks.workingCapitalOffer(body), 201);
  }

  const match = BANK_ROUTE.exec(path);
  if (!match) return sendJson(res, 404, { error: 'not_found' });
  const [, bank, rest = '/'] = match;
  if (!banks.knownBank(bank)) return sendJson(res, 404, { error: 'unknown_bank' });

  if (req.method === 'GET') {
    const routes = {
      '/products/deposits': banks.depositProducts,
      '/products/credit-cards': banks.creditCardOffers,
      '/products/investments': banks.investmentCatalogue,
      '/products/insurance': banks.insuranceCatalogue,
      '/accounts/balance': banks.accountBalance,
      '/accounts/transactions': banks.transactionHistory,
      '/accounts/reward-points': banks.rewardBalance,
    };
    const handler = routes[rest];
    if (!handler) return sendJson(res, 404, { error: 'not_found' });
    return sendJson(res, 200, handler(bank));
  }

  if (req.method === 'POST') {
    const routes = {
      '/applications/credit-card': banks.submitCreditCardApplication,
      '/applications/account': banks.openAccount,
      '/accounts/credit-limit-review': banks.reviewCreditLimit,
      '/payments/fps': banks.initiateFpsTransfer,
      '/payments/card-repayment': banks.cardRepayment,
      '/rewards/redeem': banks.redeemPoints,
      '/investments/orders': banks.purchaseInvestment,
      '/credit/embedded-line': banks.embeddedCreditLine,
      '/credit/bnpl': banks.bnplPlan,
    };
    const handler = routes[rest];
    if (!handler) return sendJson(res, 404, { error: 'not_found' });
    return send(res, handler(bank, body), 201);
  }
  return sendJson(res, 405, { error: 'method_not_allowed' });
}

/** Hippo Wallet TSP workflows. */
function handleWallet(req, res, path, body) {
  if (req.method === 'GET' && path === '/api/rates') {
    return sendJson(res, 200, { rates: wallet.compareMortgageRates() });
  }
  if (req.method === 'GET' && path === '/api/accounts') {
    const result = wallet.aggregateAccounts();
    return sendJson(res, result.error ? 403 : 200, result);
  }
  if (req.method === 'GET' && path === '/api/wealth-advice') {
    const result = wallet.wealthAdvice();
    return sendJson(res, result.error ? 403 : 200, result);
  }
  if (req.method !== 'POST') return sendJson(res, 404, { error: 'not_found' });

  switch (path) {
    case '/api/consent/grant':
      return sendJson(res, 201, wallet.grantAccountConsent());
    case '/api/consent/revoke':
      return sendJson(res, 201, wallet.revokeAccountConsent());
    case '/api/applications':
      return sendJson(res, 200, { applications: wallet.applyForCreditCards(body.applicantName || 'Maria') });
    case '/api/pos/checkout':
      return sendJson(res, 200, wallet.posSmartDiscount(Number(body.amount || 0), body.merchantCategory));
    case '/api/credit-limit':
      return sendJson(res, 200, wallet.requestCreditLimitBoost(body.bank || 's-dbs', Number(body.requestedAmount || 0)));
    case '/api/split-bill':
      return sendJson(res, 200, wallet.splitBill(
        Number(body.amount || 0),
        Array.isArray(body.payers) && body.payers.length ? body.payers : ['s-hsbc', 's-boc'],
      ));
    case '/api/points/offset':
      return send(res, wallet.offsetWithPoints(body.bank || 's-dbs', Number(body.points || 0)));
    case '/api/roundup':
      return sendJson(res, 200, wallet.roundUpInvestment(Number(body.amount || 0), body.bank, body.productCode));
    case '/api/credit/embedded':
      return send(res, wallet.embeddedCredit(Number(body.amount || 0)), 201);
    case '/api/credit/bnpl':
      return send(res, wallet.bnpl(Number(body.amount || 0), Number(body.instalments || 3)), 201);
    case '/api/merchant/qr-payment':
      return sendJson(res, 201, wallet.qrTablePayment(Number(body.amount || 0), body.table));
    case '/api/merchant/working-capital':
      return send(res, wallet.workingCapital(Number(body.monthlyPosVolume || 0)), 201);
    default:
      return sendJson(res, 404, { error: 'not_found' });
  }
}

/** Developer portal, gateway administration, monetization and compliance. */
function handlePlatform(req, res, path, body, url) {
  if (req.method === 'GET') {
    switch (path) {
      case '/platform/catalogue':
        return sendJson(res, 200, { endpoints: platform.ENDPOINT_CATALOGUE });
      case '/platform/pricing':
        return sendJson(res, 200, {
          tiers: platform.PRICING,
          revenueShare: platform.REVENUE_SHARE,
          merchantPricing: platform.MERCHANT_PRICING,
        });
      case '/platform/tsps':
        return sendJson(res, 200, { tsps: platform.listTsps() });
      case '/platform/billing':
        return send(res, platform.billingStatement(url.searchParams.get('clientId') || ''));
      case '/platform/consents':
        return sendJson(res, 200, { consents: platform.consentLedger() });
      case '/platform/compliance-report':
        return sendJson(res, 200, platform.complianceReport());
      default:
        return sendJson(res, 404, { error: 'not_found' });
    }
  }
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'method_not_allowed' });

  switch (path) {
    case '/platform/tsps':
      return send(res, platform.registerTsp(body), 201);
    case '/platform/oauth/token':
      return send(res, platform.issueToken(body), 201);
    case '/platform/revenue-share':
      return send(res, platform.settlePartnerRevenue(body), 201);
    case '/platform/baas-invoice':
      return sendJson(res, 200, platform.baasLicenceInvoice(body));
    case '/platform/merchant-fees':
      return send(res, platform.merchantFeeComparison(body));
    case '/platform/ekyc/verify':
      return send(res, platform.verifyIdentity(body), 201);
    case '/platform/consents':
      return sendJson(res, 201, platform.recordConsent(body));
    default:
      return sendJson(res, 404, { error: 'not_found' });
  }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://localhost:${PORT}`);
  const path = url.pathname;
  try {
    if (path === '/health') return sendJson(res, 200, { status: 'ok' });
    const body = req.method === 'POST' ? await readBody(req) : {};
    if (path.startsWith('/open-api/')) return handleOpenApi(req, res, path, body);
    if (path.startsWith('/api/')) return handleWallet(req, res, path, body);
    if (path.startsWith('/platform/')) return handlePlatform(req, res, path, body, url);
    if (req.method === 'GET') return serveStatic(res, path);
    return sendJson(res, 404, { error: 'not_found' });
  } catch (error) {
    sendJson(res, 500, { error: String(error.message) });
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`open banking world listening on ${PORT}`);
});
