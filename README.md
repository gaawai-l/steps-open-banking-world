# steps-open-banking-world

A simulated Open Banking & BaaS world for the HKMA four-phase exercise, delivered as one
deployable application. Roles are separated by internal routes rather than by services:

| Route | Role |
|---|---|
| `/` | Hippo FinTech Wallet — the Third-Party Service Provider |
| `/pos.html` | Fine dining merchant POS terminal |
| `/portal.html` | API management, developer portal and monetization platform |
| `/open-api/*` | The four simulated banks' Open API, phases 1-4 |

## Coverage

- **Phase 1** product and service information: mortgage rates, deposit and FX rates,
  credit card offers, investment products, insurance plans.
- **Phase 2** customer acquisition: credit card applications, account opening.
- **Phase 3** account information: balances, transaction history, reward points,
  automated credit limit review — behind an explicit consent grant.
- **Phase 4** transactions and payment initiation: FPS transfers, card repayment, reward
  redemption, fund purchase orders, merchant settlement.
- **The eight simulated use cases**: rate aggregation, one-click applications, account
  aggregation, POS smart discount, instant credit limit boost, bill splitting, point
  stacking, micro-wealth round-up investment.
- **BaaS**: white-label credit lines, Hippo BNPL, contextual wealth advice, zero-friction
  QR table payment, instant merchant settlement, POS-volume working capital loans.
- **Monetization**: freemium and tiered access with per-call metering, BaaS licensing,
  affiliate revenue share, eKYC pay-per-call, pay-by-bank merchant pricing.
- **API platform**: developer portal and sandbox, OAuth gateway with rate limiting,
  billing engine, consent ledger and HKMA compliance reporting.

## Run

Node standard library only; no dependencies to install.

    docker build -t steps-open-banking-world .
    docker run --rm -p 8080:8080 steps-open-banking-world

Listens on `$PORT` (default 8080).
