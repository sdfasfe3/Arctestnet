import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { randomBytes } from 'node:crypto'
import { createPublicClient, getAddress, http, isAddress, isHash, parseAbiItem, parseEventLogs } from 'viem'
import { getChain, getUsdc } from '../src/onchain-facts'
import { AmountError, parseUsdc } from '../src/onchain-money'

const CHAIN_ID = 5042002
const COMPASS_KEY = 'Arc_Testnet'
const PORT = Number(process.env.PORT ?? 3001)
const DATA_DIR = new URL('../data/', import.meta.url).pathname
const DATA_FILE = `${DATA_DIR}invoices.json`
const MAX_BODY = 10_000

interface Invoice {
  id: string
  merchant: string
  title: string
  memo: string
  amountRaw: string
  status: 'open' | 'paid'
  createdAt: number
  paidAt?: number
  payer?: string
  txHash?: string
}

const chain = getChain(CHAIN_ID)
const usdc = getUsdc(CHAIN_ID)
if (!chain || !usdc) throw new Error('Arc Testnet facts are missing')
const USDC_ADDRESS = usdc.address.toLowerCase()

// Prefer the sandbox RPC proxy; fall back to the public RPC from the facts module.
const proxyChains = (process.env.RPC_PROXY_CHAINS || '').split(',')
const rpcUrl =
  process.env.RPC_PROXY_BASE_URL && proxyChains.indexOf(COMPASS_KEY) !== -1
    ? `${process.env.RPC_PROXY_BASE_URL}/api/rpc/${COMPASS_KEY}?_rpc_token=${process.env.RPC_PROXY_TOKEN}`
    : chain.rpcUrls[0]

const client = createPublicClient({ transport: http(rpcUrl) })
const transferEvent = parseAbiItem('event Transfer(address indexed from, address indexed to, uint256 value)')

// ---------- storage ----------
let invoices: Invoice[] = []
if (existsSync(DATA_FILE)) {
  try {
    invoices = JSON.parse(readFileSync(DATA_FILE, 'utf8')) as Invoice[]
  } catch {
    invoices = []
  }
}

function save() {
  mkdirSync(DATA_DIR, { recursive: true })
  const tmp = `${DATA_FILE}.tmp`
  writeFileSync(tmp, JSON.stringify(invoices, null, 2))
  renameSync(tmp, DATA_FILE)
}

// ---------- helpers ----------
function send(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { 'content-type': 'application/json' })
  res.end(JSON.stringify(body))
}

function readJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    let size = 0
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => {
      size += chunk.length
      if (size > MAX_BODY) {
        reject(new Error('Request too large'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      try {
        const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')
        resolve(typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : {})
      } catch {
        reject(new Error('Invalid JSON'))
      }
    })
    req.on('error', reject)
  })
}

const str = (value: unknown, max: number) => (typeof value === 'string' ? value.trim().slice(0, max) : '')
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function findReceipt(hash: `0x${string}`) {
  for (let i = 0; i < 8; i++) {
    try {
      return await client.getTransactionReceipt({ hash })
    } catch {
      await sleep(1000)
    }
  }
  return null
}

// ---------- handlers ----------
function createInvoice(body: Record<string, unknown>) {
  const merchant = str(body.merchant, 42)
  const title = str(body.title, 60)
  const memo = str(body.memo, 140)
  const amount = str(body.amount, 20)
  if (!isAddress(merchant)) return { status: 400, body: { error: 'Invalid merchant address' } }
  if (!title) return { status: 400, body: { error: 'Title is required' } }
  let amountRaw: bigint
  try {
    amountRaw = parseUsdc(amount)
  } catch (e) {
    return { status: 400, body: { error: e instanceof AmountError ? e.message : 'Invalid amount' } }
  }
  if (amountRaw <= 0n) return { status: 400, body: { error: 'Amount must be greater than zero' } }
  const invoice: Invoice = {
    id: randomBytes(6).toString('hex'),
    merchant: getAddress(merchant),
    title,
    memo,
    amountRaw: amountRaw.toString(),
    status: 'open',
    createdAt: Date.now(),
  }
  invoices.unshift(invoice)
  save()
  return { status: 201, body: invoice }
}

let confirming = false

async function confirmInvoice(id: string, body: Record<string, unknown>) {
  const invoice = invoices.find((i) => i.id === id)
  if (!invoice) return { status: 404, body: { error: 'Payment link not found' } }
  if (invoice.status === 'paid') return { status: 200, body: invoice }
  const txHash = str(body.txHash, 66)
  if (!isHash(txHash)) return { status: 400, body: { error: 'Invalid transaction hash' } }
  if (invoices.some((i) => i.txHash?.toLowerCase() === txHash.toLowerCase())) {
    return { status: 409, body: { error: 'This transaction already settled a payment link' } }
  }
  if (confirming) return { status: 429, body: { error: 'Verification in progress, retry shortly' } }
  confirming = true
  try {
    const receipt = await findReceipt(txHash)
    if (!receipt) return { status: 404, body: { error: 'Transaction not found onchain yet' } }
    if (receipt.status !== 'success') return { status: 422, body: { error: 'Transaction reverted' } }
    const logs = parseEventLogs({ abi: [transferEvent], logs: receipt.logs, eventName: 'Transfer' })
    const match = logs.find(
      (l) =>
        l.address.toLowerCase() === USDC_ADDRESS &&
        l.args.to.toLowerCase() === invoice.merchant.toLowerCase() &&
        l.args.value >= BigInt(invoice.amountRaw),
    )
    if (!match) return { status: 422, body: { error: 'No matching USDC transfer to the merchant in this transaction' } }
    invoice.status = 'paid'
    invoice.paidAt = Date.now()
    invoice.payer = getAddress(match.args.from)
    invoice.txHash = txHash
    save()
    return { status: 200, body: invoice }
  } finally {
    confirming = false
  }
}

const server = createServer((req, res) => {
  void (async () => {
    try {
      const url = new URL(req.url ?? '/', 'http://localhost')
      const parts = url.pathname.split('/').filter(Boolean)
      if (req.method === 'GET' && url.pathname === '/health') return send(res, 200, { ok: true })

      if (parts[0] === 'invoices') {
        if (req.method === 'GET' && parts.length === 1) {
          const merchant = url.searchParams.get('merchant') ?? ''
          if (!isAddress(merchant)) return send(res, 400, { error: 'Invalid merchant address' })
          const list = invoices.filter((i) => i.merchant.toLowerCase() === merchant.toLowerCase())
          return send(res, 200, list)
        }
        if (req.method === 'POST' && parts.length === 1) {
          const r = createInvoice(await readJson(req))
          return send(res, r.status, r.body)
        }
        if (req.method === 'GET' && parts.length === 2) {
          const invoice = invoices.find((i) => i.id === parts[1])
          return invoice ? send(res, 200, invoice) : send(res, 404, { error: 'Payment link not found' })
        }
        if (req.method === 'POST' && parts.length === 3 && parts[2] === 'confirm') {
          const r = await confirmInvoice(parts[1], await readJson(req))
          return send(res, r.status, r.body)
        }
      }
      send(res, 404, { error: 'Not found' })
    } catch (e) {
      send(res, 400, { error: e instanceof Error ? e.message : 'Bad request' })
    }
  })()
})

server.listen(PORT, () => console.log(`payments api listening on :${PORT} (rpc: ${rpcUrl.split('?')[0]})`))
