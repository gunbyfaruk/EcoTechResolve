# # EcoTechResolve

## Overview

EcoTechResolve is a Web3 project built on the Stacks blockchain using Clarity smart contracts. It enables users to submit immutable sustainability reports on tech-related complaints (e.g., e-waste from outdated devices, energy-inefficient gadgets, or unsustainable manufacturing practices). The platform incentivizes eco-friendly resolutions by rewarding contributors with cryptocurrency (STX or a custom ERC-20-like token on Stacks) for providing virtual guidance or in-person services that promote sustainability. Reports are stored immutably on-chain, ensuring transparency and tamper-proof records.

This project solves real-world problems such as:
- **E-waste proliferation**: By crowdsourcing sustainable repair, recycling, and upcycling solutions for tech devices.
- **Lack of incentives for green practices**: Rewards eco-friendly resolutions to encourage community participation in reducing carbon footprints from tech consumption.
- **Opacity in sustainability claims**: Immutable on-chain reports provide verifiable data for consumers, regulators, and companies to track and improve tech sustainability.
- **Access to expert help**: Facilitates virtual (e.g., online tutorials) or in-person (e.g., local repair workshops) services, bridging the gap for users in underserved areas.
- **Decentralized accountability**: Empowers users to hold tech companies accountable without relying on centralized authorities.

The system involves 6 core smart contracts written in Clarity, ensuring secure, decentralized operations on the Stacks network (secured by Bitcoin).

## How It Works

1. **Report Submission**: Users submit tech complaints as immutable reports (e.g., "My laptop battery is degrading quickly, contributing to e-waste").
2. **Resolution Proposals**: Community members propose eco-friendly solutions, specifying if it's virtual guidance (e.g., software optimization tips) or in-person services (e.g., battery replacement workshops).
3. **Verification and Voting**: Reports and resolutions are verified through community voting or oracle integration for real-world proof (e.g., photos of recycled parts).
4. **Rewards Distribution**: Upon successful resolution, rewards are automatically distributed in crypto to the resolver and optionally the reporter.
5. **Service Matching**: Users can browse and book services, with escrows ensuring fair exchanges.
6. **Analytics and Impact Tracking**: On-chain data allows querying sustainability metrics, like total e-waste diverted.

## Smart Contracts

The project consists of 6 Clarity smart contracts, each handling a specific aspect for modularity and security:

1. **ReportContract.clar**: Manages submission and storage of immutable sustainability reports.
   - Functions: `submit-report` (stores report with timestamp, user ID, complaint details), `get-report` (retrieves report by ID).
   - Data: Maps report IDs to structs containing description, category (e.g., e-waste, energy use), and status (open/resolved).
   - Ensures immutability by using read-only maps after submission.

2. **ResolutionContract.clar**: Handles proposal and acceptance of eco-friendly resolutions.
   - Functions: `propose-resolution` (links to a report ID, describes solution, specifies virtual/in-person), `accept-resolution` (by report owner).
   - Data: Maps resolution IDs to structs with proposal details, eco-impact score (e.g., estimated CO2 savings), and linked report.
   - Integrates with voting for community approval.

3. **RewardTokenContract.clar**: A fungible token contract (similar to SIP-010 standard on Stacks) for custom rewards.
   - Functions: `mint` (issues tokens to resolvers), `transfer` (moves tokens between users), `get-balance`.
   - Data: Token supply, balances map.
   - Tokens represent "EcoCredits" that can be redeemed for STX or used in the ecosystem.

4. **RewardDistributionContract.clar**: Automates reward payouts based on verified resolutions.
   - Functions: `claim-reward` (after resolution verification), `fund-pool` (adds STX/token to reward pool).
   - Data: Reward pool balance, claim history.
   - Uses oracles or multi-sig for verification to ensure eco-friendly outcomes.

5. **UserRegistryContract.clar**: Registers users and tracks reputations.
   - Functions: `register-user` (stores profile with skills, location for in-person services), `update-reputation` (based on successful resolutions).
   - Data: Maps principals to user structs (name, skills, reputation score).
   - Prevents spam by requiring minimal STX stake for registration.

6. **ServiceEscrowContract.clar**: Manages escrows for paid virtual or in-person services.
   - Functions: `create-escrow` (locks funds for a service), `release-escrow` (upon completion proof), `refund-escrow`.
   - Data: Escrow maps with amounts, parties, and timeouts.
   - Ensures trustless transactions for services like virtual consultations or on-site repairs.

These contracts interact via cross-contract calls in Clarity, ensuring atomicity where needed (e.g., resolution acceptance triggers reward minting).

## Tech Stack

- **Blockchain**: Stacks (for Clarity contracts, Bitcoin settlement).
- **Smart Contract Language**: Clarity (secure, decidable, no reentrancy issues).
- **Frontend (Suggested)**: React.js with @stacks/connect for wallet integration.
- **Backend (Optional)**: Node.js with Stacks.js library for API interactions.
- **Oracles**: Integrate with external oracles (e.g., via Stacks' Clarity extensions) for off-chain verification of eco-impacts.

## Installation and Deployment

### Prerequisites
- Install Stacks CLI: `npm install -g @stacks/cli`
- Set up a Stacks wallet (e.g., Hiro Wallet).
- Node.js and Yarn/NPM for any frontend.

### Steps
1. Clone the repository: `git clone https://github.com/yourusername/EcoTechResolve.git`
2. Navigate to the contracts directory: `cd contracts`
3. Deploy contracts to Stacks testnet:
   - Use `clarinet` tool: Install via `cargo install clarinet`.
   - Run `clarinet integrate` for local testing.
   - Deploy: `stx deploy ReportContract.clar --testnet` (repeat for each contract).
4. Set up cross-contract references (e.g., ResolutionContract calls ReportContract).
5. For production, deploy to mainnet and verify on Stacks Explorer.

### Testing
- Use Clarinet for unit tests: Each contract has test files (e.g., ReportContract.test.clar).
- Example test: Submit a report and propose a resolution, verify immutability.

## Usage Example

In Clarity console (via Clarinet):

```
(contract-call? 'SP123...ReportContract submit-report u1 "Laptop e-waste issue" "e-waste")
(contract-call? 'SP123...ResolutionContract propose-resolution u1 "Recycle battery virtually" true) ;; true for virtual
```

## Contributing

Fork the repo, create a branch, and submit a PR. Focus on enhancing eco-impact calculations or adding more categories.

## License

MIT License.