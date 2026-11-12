# Arc Pay Links

Create USDC payment links and get paid on Arc Testnet. Share a link, the payer connects a wallet and pays, and the link flips to "Paid" once the payment is confirmed onchain.

Built with [Arc Studio](https://studio.arc.io)

## Tech stack

- React 18, Vite, TypeScript, Tailwind CSS
- wagmi, viem, ConnectKit (wallet and USDC transfers)
- Small Bun HTTP service for payment links and payment verification

## Development

Prerequisites: [Bun](https://bun.sh).

```bash
bun install
bun run server   # payments API on port 3001
bun run dev      # web app on port 5173 (proxies /api to the API)
```

Other commands: `bun run check` (lint and typecheck).

### Environment variables

- `RPC_PROXY_BASE_URL`, `RPC_PROXY_TOKEN`, `RPC_PROXY_CHAINS`: optional outside Arc Studio. When set, the API reads chain data through that proxy; otherwise it uses the public Arc Testnet RPC.
- `PORT`: optional, API port (default 3001).

Payment links are stored in `data/invoices.json`.
