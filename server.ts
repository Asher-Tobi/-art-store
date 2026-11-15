import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import type { Request, Response, NextFunction } from "express";
import session from "express-session";
import QRCode from "qrcode";

interface Product {
  id: number;
  title: string;
  artist: string;
  category: string;
  price: number;
  price_display: string;
  size: string;
  image: string;
  images?: string[];
  description: string;
}

interface CartItem extends Product {
  quantity: number;
}

interface Order {
  reference: string;
  name: string;
  email: string;
  phone: string;
  country: string;
  address: string;
  apartment: string;
  city: string;
  state: string;
  zip_code: string;
  payment_method: string;
  payment_symbol: string;
  payment_network: string;
  crypto_amount: string;
  wallet_address: string;
  qr_svg: string;
  payment_status: string;
  subtotal: number;
  discount: number;
  shipping: number;
  total: number;
  items: CartItem[];
}

declare module "express-session" {
  interface SessionData {
    cart?: Record<string, number>;
    cartUpdatedAt?: number;
    cartId?: string;
    order?: Order;
    flashes?: string[];
  }
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || "3000") || 3000;
const BTC_WALLET_ADDRESS =
  process.env.BTC_WALLET_ADDRESS ||
  "bc1qktk2z0wjfwfjj0psasspls8suj86ejr87ua9gu";
const ETH_WALLET_ADDRESS =
  process.env.ETH_WALLET_ADDRESS ||
  "0x120D139dB706614f71e470A97852679F6FaebcB7";
const SOL_WALLET_ADDRESS =
  process.env.SOL_WALLET_ADDRESS ||
  "X2ro74HaRbZ2XKDJ57yMmsKFD3CS4y9XFKtzSeQkCQ1";
const BTC_USD_PRICE = Number(process.env.BTC_USD_PRICE || "63389") || 63389;
const ETH_USD_PRICE = Number(process.env.ETH_USD_PRICE || "1740") || 1740;
const SOL_USD_PRICE = Number(process.env.SOL_USD_PRICE || "69") || 69;
const SECRET_KEY =
  process.env.SECRET_KEY || "local-development-key-change-before-deploy";

const products: Product[] = [
  {
    id: 4,
    title: "Biological Transformation",
    artist: "Paul Chang",
    category: "Painting",
    price: 2825.0,
    price_display: "$2,825",
    size: "32 x 40 in",
    image: "/static/images/3044136-HSC00001-7.jpg",
    description:
      "A richly layered figurative work that explores growth, memory, and mutation through vivid color and texture.",
  },
  {
    id: 5,
    title: "Morning Forest #2",
    artist: "Igor Vitomirov",
    category: "Photography",
    price: 1680.0,
    price_display: "$1,680",
    size: "39.4 x 27.6 in",
    image: "/static/images/8125999-IVGGQOPI-7.jpg",
    description:
      "A misty woodland photograph that captures quiet depth and atmosphere with a cinematic sense of stillness.",
  },
  {
    id: 7,
    title: "July Aspens",
    artist: "Emily Kent",
    category: "Photography",
    price: 904.0,
    price_display: "$904",
    size: "38 x 26 in",
    image: "/static/images/8702937-ICZMCJPJ-7.jpg",
    description:
      "A quiet landscape photograph with expressive natural contrast, ideal for collectors drawn to transparent light and serene compositions.",
  },
  {
    id: 8,
    title: "An Evening Walk",
    artist: "Suren Ter-Avakian",
    category: "Painting",
    price: 5480.0,
    price_display: "$5,480",
    size: "30 x 30 in",
    image: "/static/images/13158935-GALGXZVV-7.jpg",
    description:
      "An atmospheric painting that reads like a twilight memory, balancing earthy pigment with layered, reflective motion.",
  },
  {
    id: 9,
    title: "Grapes in a Teal Bowl",
    artist: "Juan Alvarez",
    category: "Painting",
    price: 1280.0,
    price_display: "$1,280",
    size: "24 x 24 in",
    image: "/assets/aistudio/12654265-ZLCJTDIX-7_95a7c268.jpg",
    description:
      "An expressive still-life painting pairing deep red grapes on the stem with a luminous teal ceramic bowl against muted slate and stone tones.",
  },
  {
    id: 10,
    title: "Figures in Stride",
    artist: "Luc Moreau",
    category: "Sculpture",
    price: 2450.0,
    price_display: "$2,450",
    size: "18 x 16 x 4 in",
    image: "/assets/aistudio/product_10_0fec4e65.jpg",
    description:
      "A dark patinated bronze figurative sculpture capturing four elongated silhouettes in synchronized motion, mounted on a minimalist plinth for contemporary interiors.",
  },
  {
    id: 11,
    title: "Atlantic Drift",
    artist: "Gregory Christeas",
    category: "Painting",
    price: 20000.0,
    price_display: "$20,000",
    size: "48 x 60 in",
    image: "/static/images/atlantic-drift.jpg",
    description:
      "An original abstract painting from the Parallels Series created with specialty metallic and fluorescent acrylics on stretched canvas, inspired by the shifting reflections and enduring rhythm of the Atlantic Ocean.",
  },
  {
    id: 12,
    title: "Mushroom Lamp No. 4",
    artist: "Cozy Art Land",
    category: "Sculpture",
    price: 161.0,
    price_display: "$161",
    size: "5.1 x 5.9 x 5.1 in",
    image: "/static/images/12649329-PYQGAIGQ-7.jpg",
    description:
      "Handcrafted sculptural table lamp combining frosted blue-rimmed glass, natural wood base, and warm LED illumination in an organic study of light and form.",
  },
  {
    id: 13,
    title: "Flag Halyard Lounge Chair (GE225)",
    artist: "Hans J. Wegner",
    category: "Furniture",
    price: 39700.0,
    price_display: "$39,700",
    size: "41.3 x 46.1 x 29.9 in",
    image: "/static/images/hans-wegner-ge225.jpg",
    images: [
      "/static/images/hans-wegner-ge225.jpg",
      "/static/images/hans-wegner-ge225-2.jpg",
      "/static/images/hans-wegner-ge225-3.jpg",
      "/static/images/hans-wegner-ge225-4.jpg",
      "/static/images/hans-wegner-ge225-5.jpg",
      "/static/images/hans-wegner-ge225-6.jpg",
      "/static/images/hans-wegner-ge225-7.jpg",
    ],
    description:
      "Early 1958 edition of Hans J. Wegner's iconic Flag Halyard lounge chair (Model GE225), woven from 250 meters of flag halyard rope over a dark green lacquered and chromed steel frame with original wooden feet, leather headrest, and sheepskin throw.",
  },
  {
    id: 14,
    title: "Memories in the Sand",
    artist: "Mary Ogochukwu",
    category: "Painting",
    price: 1450.0,
    price_display: "$1,450",
    size: "40 x 30 x 1 in",
    image: "/static/images/mary-ogochukwu-memories-sand.jpg",
    images: [
      "/static/images/mary-ogochukwu-memories-sand.jpg",
      "/assets/aistudio/mary_ogochuku_1_0984b425.webp",
      "/assets/aistudio/mary_ogochuku_2_0fbb5297.webp",
      "/assets/aistudio/mary_ogochuku_3_a44055b4.webp",
    ],
    description:
      "A unique 2025 contemporary figurative acrylic painting on canvas by Nigerian artist Mary Ogochukwu, capturing expressive warmth, movement, and sunlit memory. Accompanied by a Certificate of Authenticity.",
  },
  {
    id: 15,
    title: "Chestnut & Bay Horses in Landscape",
    artist: "Albert Clark",
    category: "Painting",
    price: 3313.67,
    price_display: "$3,313.67",
    size: "32 x 28 in",
    image: "/static/images/albert-clark-horses.jpg",
    images: [
      "/static/images/albert-clark-horses.jpg",
      "/assets/aistudio/Albert_Clark_1_ca56a519.webp",
      "/assets/aistudio/Albert_Clark_2_ccb70610.webp",
      "/assets/aistudio/Albert_Clark_3_99475c82.webp",
      "/assets/aistudio/Albert_Clark_4_b64061e7.webp",
    ],
    description:
      "Signed and dated 1887 oil on canvas by British Victorian sporting artist Albert Clark (1843–1928), depicting a chestnut and a bay horse standing face to face in an open English field, presented in an ornate antique gilt frame.",
  },
  {
    id: 16,
    title: "White Marble Italian Torso Sculpture",
    artist: "Italian School",
    category: "Sculpture",
    price: 2485.85,
    price_display: "$2,485.85",
    size: "5.9 x 13 x 3.2 in",
    image: "/static/images/white-marble-torso.jpg",
    images: [
      "/static/images/white-marble-torso.jpg",
      "/assets/aistudio/Unknown_1_d2a06c55.webp",
      "/assets/aistudio/Unknown_2_8c7f2d21.webp",
      "/assets/aistudio/Unknown_3_1958b1a2.webp",
      "/assets/aistudio/Unknown_4_c1695a32.webp",
    ],
    description:
      "Hand-carved 20th-century Italian Grand Tour classical torso in warm white marble with subtle natural veining and weathered patina, mounted upright on a minimalist black steel display stand.",
  },
  {
    id: 17,
    title: "Sina — Figurative Bronze Sculpture",
    artist: "Nando Kallweit",
    category: "Sculpture",
    price: 2516.0,
    price_display: "$2,516",
    size: "12.6 x 10.2 x 12.6 in",
    image: "/assets/aistudio/nano_3_5ed1d424.webp",
    images: [
      "/assets/aistudio/nano_3_5ed1d424.webp",
      "/assets/aistudio/nano_5_f49dbef6.webp",
      "/assets/aistudio/nano_4_5ec1329b.webp",
      "/assets/aistudio/nano_1_ce534eeb.webp",
    ],
    description:
      "Limited edition of 25 bronze sculpture by German sculptor Nando Kallweit. Cast using the traditional lost-wax method from an original hand-carved oak wood body, preserving subtle organic grain and tactile tool marks with poised, elongated figurative lines.",
  },
  {
    id: 18,
    title: "Madonna of Sorrows (After Sassoferrato)",
    artist: "Italian Old Master",
    category: "Painting",
    price: 2880.0,
    price_display: "$2,880",
    size: "29.5 x 25 in",
    image: "/assets/aistudio/master_1_7710b430.webp",
    images: [
      "/assets/aistudio/master_1_7710b430.webp",
      "/assets/aistudio/master_2_8106e766.webp",
      "/assets/aistudio/master_3_60695d30.webp",
      "/assets/aistudio/master_4_be88bc8f.webp",
      "/assets/aistudio/master_5_8a26db49.webp",
    ],
    description:
      "Fine antique 19th-century Italian Old Master oil painting on linen canvas after Giovanni Battista Salvi da Sassoferrato's renowned composition, depicting the Virgin Mary in serene devotional prayer draped in a deep ultramarine mantle with rich craquelure and original period stretcher.",
  },
];

const featuredCollection: Product[] = [];

const allProducts: Product[] = [...products, ...featuredCollection];
const productLookup = new Map<string, Product>(
  allProducts.map((product) => [String(product.id), product])
);
const categories: string[] = [
  "Paintings",
  "Photography",
  "Sculpture",
  "Furniture",
  "Drawings",
  "Mixed Media",
];

type CryptoMethodKey = "bitcoin" | "ethereum" | "solana";

interface CryptoOptionPayload {
  key: CryptoMethodKey;
  label: string;
  symbol: string;
  icon: string;
  accentColor: string;
  network: string;
  walletAddress: string;
  usdPrice: number;
  amount: string;
  decimals: number;
  qrSvg: string;
}

let cachedCryptoPrices: {
  bitcoin: number;
  ethereum: number;
  solana: number;
  fetchedAt: number;
} | null = null;

async function getCryptoPrices(): Promise<{
  bitcoin: number;
  ethereum: number;
  solana: number;
}> {
  const now = Date.now();
  if (cachedCryptoPrices && now - cachedCryptoPrices.fetchedAt < 60_000) {
    return {
      bitcoin: cachedCryptoPrices.bitcoin,
      ethereum: cachedCryptoPrices.ethereum,
      solana: cachedCryptoPrices.solana,
    };
  }

  const fallback = {
    bitcoin: BTC_USD_PRICE,
    ethereum: ETH_USD_PRICE,
    solana: SOL_USD_PRICE,
  };

  try {
    const response = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana&vs_currencies=usd",
      { signal: AbortSignal.timeout(3000) }
    );
    if (!response.ok) {
      return fallback;
    }
    const data = (await response.json()) as {
      bitcoin?: { usd?: number };
      ethereum?: { usd?: number };
      solana?: { usd?: number };
    };
    const prices = {
      bitcoin: Number(data?.bitcoin?.usd) || fallback.bitcoin,
      ethereum: Number(data?.ethereum?.usd) || fallback.ethereum,
      solana: Number(data?.solana?.usd) || fallback.solana,
    };
    cachedCryptoPrices = { ...prices, fetchedAt: now };
    return prices;
  } catch {
    return fallback;
  }
}

function getCryptoWallets(): Record<CryptoMethodKey, string> {
  return {
    bitcoin: (process.env.BTC_WALLET_ADDRESS || BTC_WALLET_ADDRESS).trim(),
    ethereum: (process.env.ETH_WALLET_ADDRESS || ETH_WALLET_ADDRESS).trim(),
    solana: (process.env.SOL_WALLET_ADDRESS || SOL_WALLET_ADDRESS).trim(),
  };
}

function calculateCryptoAmount(
  usdTotal: number,
  usdPrice: number,
  decimals: number
): string {
  if (usdTotal <= 0 || usdPrice <= 0) {
    return (0).toFixed(decimals);
  }
  return (Number(usdTotal) / usdPrice).toFixed(decimals);
}

async function generateWalletQrSvg(
  scheme: string,
  address: string,
  amount: string
): Promise<string> {
  if (!address) {
    return "";
  }
  const uri =
    scheme === "ethereum"
      ? `ethereum:${address}`
      : `${scheme}:${address}?amount=${amount}`;
  try {
    return await QRCode.toString(uri, {
      type: "svg",
      margin: 1,
      width: 140,
      color: { dark: "#0f0f0f", light: "#ffffff" },
    });
  } catch {
    return "";
  }
}

async function buildCryptoOptions(
  usdTotal: number,
  prices: { bitcoin: number; ethereum: number; solana: number }
): Promise<Record<CryptoMethodKey, CryptoOptionPayload>> {
  const wallets = getCryptoWallets();
  const btcAmount = calculateCryptoAmount(usdTotal, prices.bitcoin, 8);
  const ethAmount = calculateCryptoAmount(usdTotal, prices.ethereum, 6);
  const solAmount = calculateCryptoAmount(usdTotal, prices.solana, 4);

  const [btcQr, ethQr, solQr] = await Promise.all([
    generateWalletQrSvg("bitcoin", wallets.bitcoin, btcAmount),
    generateWalletQrSvg("ethereum", wallets.ethereum, ethAmount),
    generateWalletQrSvg("solana", wallets.solana, solAmount),
  ]);

  return {
    bitcoin: {
      key: "bitcoin",
      label: "Bitcoin",
      symbol: "BTC",
      icon: "₿",
      accentColor: "#F7931A",
      network: "Bitcoin Network",
      walletAddress: wallets.bitcoin,
      usdPrice: prices.bitcoin,
      decimals: 8,
      amount: btcAmount,
      qrSvg: btcQr,
    },
    ethereum: {
      key: "ethereum",
      label: "Ethereum",
      symbol: "ETH",
      icon: "Ξ",
      accentColor: "#627EEA",
      network: "Ethereum Mainnet (ERC-20)",
      walletAddress: wallets.ethereum,
      usdPrice: prices.ethereum,
      decimals: 6,
      amount: ethAmount,
      qrSvg: ethQr,
    },
    solana: {
      key: "solana",
      label: "Solana",
      symbol: "SOL",
      icon: "◎",
      accentColor: "#9945FF",
      network: "Solana Mainnet",
      walletAddress: wallets.solana,
      usdPrice: prices.solana,
      decimals: 4,
      amount: solAmount,
      qrSvg: solQr,
    },
  };
}

function getProductById(productId: string | number): Product | undefined {
  return productLookup.get(String(productId));
}

interface StoredCartEntry {
  items: Record<string, number>;
  updatedAt: number;
}

const CART_COOKIE_NAME = "art_studio_cart";
const cartStore = new Map<string, StoredCartEntry>();
const orderStore = new Map<string, Order>();
const flashStore = new Map<string, string[]>();

function isValidCartId(value: unknown): value is string {
  return typeof value === "string" && /^[a-zA-Z0-9_-]{8,64}$/.test(value);
}

function isHttpsRequest(req: Request): boolean {
  const forwardedProto = String(req.headers["x-forwarded-proto"] || "")
    .split(",")[0]
    .trim()
    .toLowerCase();
  return Boolean(req.secure || forwardedProto === "https");
}

function parseCookies(req: Request): Record<string, string> {
  const header = req.headers.cookie;
  const result: Record<string, string> = {};
  if (!header) return result;
  for (const part of header.split(";")) {
    const eqIdx = part.indexOf("=");
    if (eqIdx <= 0) continue;
    const key = part.slice(0, eqIdx).trim();
    const rawVal = part.slice(eqIdx + 1).trim();
    if (!key) continue;
    try {
      result[key] = decodeURIComponent(rawVal);
    } catch {
      result[key] = rawVal;
    }
  }
  return result;
}

function signCartPayload(
  items: Record<string, number>,
  cid: string,
  updatedAt: number
): string {
  const json = JSON.stringify({ i: items, c: cid, t: updatedAt });
  const data = Buffer.from(json, "utf8").toString("base64url");
  const sig = crypto
    .createHmac("sha256", SECRET_KEY)
    .update(data)
    .digest("base64url");
  return `${data}.${sig}`;
}

function readSignedCartCookie(req: Request): {
  items: Record<string, number>;
  cid?: string;
  updatedAt: number;
} | null {
  const cookies = parseCookies(req);
  const raw = cookies[CART_COOKIE_NAME];
  if (!raw || typeof raw !== "string") return null;
  const dotIdx = raw.indexOf(".");
  if (dotIdx <= 0) return null;
  const data = raw.slice(0, dotIdx);
  const sig = raw.slice(dotIdx + 1);
  if (!data || !sig) return null;

  const expectedSig = crypto
    .createHmac("sha256", SECRET_KEY)
    .update(data)
    .digest("base64url");
  const sigBuf = Buffer.from(sig, "utf8");
  const expectedBuf = Buffer.from(expectedSig, "utf8");
  if (
    sigBuf.length !== expectedBuf.length ||
    !crypto.timingSafeEqual(sigBuf, expectedBuf)
  ) {
    return null;
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(data, "base64url").toString("utf8")
    ) as { i?: unknown; c?: unknown; t?: unknown };
    const items = sanitizeCart(parsed?.i);
    const cid = isValidCartId(parsed?.c) ? parsed.c : undefined;
    const updatedAt =
      typeof parsed?.t === "number" && Number.isFinite(parsed.t) ? parsed.t : 0;
    return { items, cid, updatedAt };
  } catch {
    return null;
  }
}

function writeSignedCartCookie(
  req: Request,
  res: Response,
  items: Record<string, number>,
  cid: string,
  updatedAt: number
): void {
  const token = signCartPayload(items, cid, updatedAt);
  const parts = [
    `${CART_COOKIE_NAME}=${encodeURIComponent(token)}`,
    "Path=/",
    "Max-Age=604800",
    "HttpOnly",
  ];
  if (isHttpsRequest(req)) {
    parts.push("SameSite=None", "Secure", "Partitioned");
  } else {
    parts.push("SameSite=Lax");
  }
  res.append("Set-Cookie", parts.join("; "));
}

function getRequestCartId(req: Request): string | undefined {
  const fromBody =
    req.body && typeof req.body === "object"
      ? (req.body as Record<string, unknown>).cid
      : undefined;
  if (isValidCartId(fromBody)) return fromBody;
  const fromQuery = req.query?.cid;
  if (isValidCartId(fromQuery)) return fromQuery;
  const fromHeader = req.headers["x-cart-id"];
  if (isValidCartId(fromHeader)) return fromHeader;
  const fromCookie = readSignedCartCookie(req)?.cid;
  if (isValidCartId(fromCookie)) return fromCookie;
  if (isValidCartId(req.session?.cartId)) return req.session.cartId;
  return undefined;
}

function ensureCartId(req: Request): string {
  const existing = getRequestCartId(req);
  if (existing) {
    req.session.cartId = existing;
    return existing;
  }
  const fresh = crypto.randomUUID().replace(/-/g, "");
  req.session.cartId = fresh;
  return fresh;
}

function sanitizeCart(rawCart: unknown): Record<string, number> {
  if (!rawCart || typeof rawCart !== "object" || Array.isArray(rawCart)) {
    return {};
  }

  const cleanCart: Record<string, number> = {};
  for (const [productId, rawQty] of Object.entries(rawCart)) {
    if (!getProductById(productId)) {
      continue;
    }
    const quantity = Number.parseInt(String(rawQty), 10);
    if (Number.isFinite(quantity) && quantity >= 1 && quantity <= 20) {
      cleanCart[String(productId)] = quantity;
    }
  }
  return cleanCart;
}

function getCart(req: Request): Record<string, number> {
  const candidates: Array<{
    items: Record<string, number>;
    updatedAt: number;
    hasItems: boolean;
  }> = [];

  if (req.session.cart !== undefined) {
    const items = sanitizeCart(req.session.cart);
    candidates.push({
      items,
      updatedAt: req.session.cartUpdatedAt ?? 0,
      hasItems: Object.keys(items).length > 0,
    });
  }

  const cid = getRequestCartId(req);
  if (cid && cartStore.has(cid)) {
    const entry = cartStore.get(cid)!;
    const items = sanitizeCart(entry.items);
    candidates.push({
      items,
      updatedAt: entry.updatedAt ?? 0,
      hasItems: Object.keys(items).length > 0,
    });
  }

  const cookieCart = readSignedCartCookie(req);
  if (cookieCart) {
    const items = sanitizeCart(cookieCart.items);
    candidates.push({
      items,
      updatedAt: cookieCart.updatedAt ?? 0,
      hasItems: Object.keys(items).length > 0,
    });
  }

  if (candidates.length === 0) {
    return {};
  }

  candidates.sort((a, b) => {
    if (b.updatedAt !== a.updatedAt) {
      return b.updatedAt - a.updatedAt;
    }
    return Number(b.hasItems) - Number(a.hasItems);
  });

  return candidates[0].items;
}

function saveCart(
  req: Request,
  res: Response,
  cart: Record<string, number>
): string {
  const cid = ensureCartId(req);
  const clean = sanitizeCart(cart);
  const updatedAt = Date.now();
  req.session.cart = clean;
  req.session.cartUpdatedAt = updatedAt;
  req.session.cartId = cid;
  cartStore.set(cid, { items: clean, updatedAt });
  writeSignedCartCookie(req, res, clean, cid, updatedAt);
  return cid;
}

function getCartCount(req: Request): number {
  return Object.values(getCart(req)).reduce((sum, qty) => sum + qty, 0);
}

function getCartItems(req: Request): CartItem[] {
  const items: CartItem[] = [];
  for (const [productId, quantity] of Object.entries(getCart(req))) {
    const product = getProductById(productId);
    if (product) {
      items.push({ ...product, quantity });
    }
  }
  return items;
}

function calculateTotals(cartItems: CartItem[]): {
  subtotal: number;
  shipping: number;
  total: number;
} {
  const subtotal = cartItems.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );
  const shipping = subtotal >= 1500 ? 0.0 : subtotal > 0 ? 65.0 : 0.0;
  return { subtotal, shipping, total: subtotal + shipping };
}

function formatCurrency(value: number): string {
  return Number(value).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function pushFlash(req: Request, message: string): void {
  if (!req.session.flashes) {
    req.session.flashes = [];
  }
  req.session.flashes.push(message);
  const cid = getRequestCartId(req);
  if (cid) {
    const existing = flashStore.get(cid) ?? [];
    existing.push(message);
    flashStore.set(cid, existing);
  }
}

function consumeFlashes(req: Request): string[] {
  const sessionFlashes = req.session.flashes ?? [];
  if (sessionFlashes.length > 0) {
    req.session.flashes = [];
  }
  const cid = getRequestCartId(req);
  const storeFlashes = cid ? flashStore.get(cid) ?? [] : [];
  if (cid && storeFlashes.length > 0) {
    flashStore.delete(cid);
  }
  return sessionFlashes.length > 0 ? sessionFlashes : storeFlashes;
}

function redirectWithSession(
  req: Request,
  res: Response,
  targetPath: string,
  cid?: string
): void {
  const activeCid = cid || getRequestCartId(req);
  const hasCartQuery = targetPath.includes("cid=");
  const url =
    activeCid && !hasCartQuery
      ? `${targetPath}${targetPath.includes("?") ? "&" : "?"}cid=${encodeURIComponent(activeCid)}`
      : targetPath;

  req.session.save(() => {
    res.redirect(url);
  });
}

const app = express();
app.set("trust proxy", true);
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use("/static", express.static(path.join(__dirname, "static")));
app.use(express.static(path.join(__dirname, "public")));
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

app.use((req: Request, res: Response, next: NextFunction) => {
  const forwardedProto = String(req.headers["x-forwarded-proto"] || "")
    .split(",")[0]
    .trim()
    .toLowerCase();
  const isHttps = req.secure || forwardedProto === "https";

  if (isHttps) {
    const origSetHeader = res.setHeader.bind(res);
    res.setHeader = ((
      name: string,
      value: number | string | readonly string[]
    ) => {
      if (name.toLowerCase() === "set-cookie") {
        const list = Array.isArray(value) ? value : [String(value)];
        const updated = list.map((cookieStr) => {
          if (!cookieStr.startsWith("connect.sid=")) return cookieStr;
          let nextCookie = cookieStr.replace(
            /;\s*SameSite=Lax/gi,
            "; SameSite=None"
          );
          if (!/;\s*SameSite=/i.test(nextCookie)) {
            nextCookie += "; SameSite=None";
          }
          if (!/;\s*Secure/i.test(nextCookie)) {
            nextCookie += "; Secure";
          }
          if (!/;\s*Partitioned/i.test(nextCookie)) {
            nextCookie += "; Partitioned";
          }
          return nextCookie;
        });
        return origSetHeader(name, updated);
      }
      return origSetHeader(name, value);
    }) as typeof res.setHeader;
  }
  next();
});

app.use(
  session({
    secret: SECRET_KEY,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: "auto",
      maxAge: 24 * 60 * 60 * 1000,
    },
  })
);

app.use((req: Request, res: Response, next: NextFunction) => {
  const cid = getRequestCartId(req);
  const resolvedCart = getCart(req);
  if (cid && !req.session.cartId) {
    req.session.cartId = cid;
  }
  res.locals.cart_count = Object.values(resolvedCart).reduce(
    (sum, qty) => sum + qty,
    0
  );
  res.locals.brand_name = "ART STUDIO";
  res.locals.formatCurrency = formatCurrency;
  res.locals.cid = cid ?? "";
  next();
});

app.get(["/", "/shop"], (req: Request, res: Response) => {
  const categoryFilter = String(req.query.category ?? "").trim();
  const artistFilter = String(req.query.artist ?? "").trim();
  let filtered = products;
  if (categoryFilter && categoryFilter.toLowerCase() !== "all") {
    filtered = filtered.filter(
      (p) => p.category.toLowerCase() === categoryFilter.toLowerCase()
    );
  }
  if (artistFilter && artistFilter.toLowerCase() !== "all") {
    filtered = filtered.filter(
      (p) => p.artist.toLowerCase() === artistFilter.toLowerCase()
    );
  }
  res.render("index", {
    categories,
    products: filtered,
    all_products: products,
    featured_collection: featuredCollection,
    active_category: categoryFilter || "All",
    active_artist: artistFilter || "All",
  });
});

app.get("/api/cart", (req: Request, res: Response) => {
  const cid = getRequestCartId(req) ?? "";
  const cartItems = getCartItems(req);
  const { subtotal, shipping, total } = calculateTotals(cartItems);
  res.setHeader("Cache-Control", "no-store");
  res.json({
    cid,
    cart_count: getCartCount(req),
    items: cartItems,
    subtotal,
    shipping,
    total,
  });
});

app.get("/product/:product_id", (req: Request, res: Response) => {
  const rawId = String(req.params.product_id ?? "");
  if (!/^\d+$/.test(rawId)) {
    res.status(404).send("Not Found");
    return;
  }
  const product = getProductById(rawId);
  if (!product) {
    res.status(404).send("Not Found");
    return;
  }
  res.render("product", {
    product,
    messages: consumeFlashes(req),
  });
});

app.get("/search", (req: Request, res: Response) => {
  const query = String(req.query.q ?? "").trim();
  if (!query) {
    res.redirect("/");
    return;
  }
  const needle = query.toLowerCase();
  const results = allProducts.filter(
    (product) =>
      product.title.toLowerCase().includes(needle) ||
      product.artist.toLowerCase().includes(needle) ||
      product.category.toLowerCase().includes(needle)
  );
  res.render("index", {
    categories,
    products: results,
    all_products: products,
    featured_collection: [],
    search_query: query,
    active_category: "All",
    active_artist: "All",
  });
});

app.get("/cart", (req: Request, res: Response) => {
  const cartItems = getCartItems(req);
  const { subtotal, shipping, total } = calculateTotals(cartItems);
  res.render("cart", {
    cart_items: cartItems,
    subtotal,
    shipping,
    total,
    messages: consumeFlashes(req),
  });
});

app.post("/cart", (req: Request, res: Response) => {
  const action = String(req.body.action ?? "");
  const productId = String(req.body.product_id ?? "");
  const currentCart = getCart(req);
  const cid = ensureCartId(req);

  if (action === "remove") {
    delete currentCart[productId];
  } else if (action === "update") {
    const parsed = Number.parseInt(String(req.body.quantity ?? "1"), 10);
    const quantity = Number.isNaN(parsed) ? 1 : parsed;
    if (quantity <= 0) {
      delete currentCart[productId];
    } else if (quantity <= 20 && getProductById(productId)) {
      currentCart[productId] = quantity;
    } else {
      pushFlash(req, "Please choose a quantity between 1 and 20.");
    }
  }

  saveCart(req, res, currentCart);
  redirectWithSession(req, res, "/cart", cid);
});

app.post("/add-to-cart", (req: Request, res: Response) => {
  const productId = String(req.body.product_id ?? "");
  const product = getProductById(productId);
  if (!product) {
    res.status(404).send("Not Found");
    return;
  }

  const cid = ensureCartId(req);
  const parsed = Number.parseInt(String(req.body.quantity ?? "1"), 10);
  const quantity = Number.isNaN(parsed) ? 1 : parsed;

  if (quantity < 1 || quantity > 20) {
    pushFlash(req, "Please choose a quantity between 1 and 20.");
    redirectWithSession(req, res, `/product/${product.id}`, cid);
    return;
  }

  const currentCart = getCart(req);
  let newQuantity = (currentCart[String(product.id)] ?? 0) + quantity;
  if (newQuantity > 20) {
    pushFlash(req, "A maximum of 20 of each artwork can be added to the cart.");
    newQuantity = 20;
  }
  currentCart[String(product.id)] = newQuantity;
  saveCart(req, res, currentCart);
  pushFlash(req, `${product.title} was added to your cart.`);
  redirectWithSession(req, res, "/cart", cid);
});

app.get("/checkout", async (req: Request, res: Response) => {
  const cartItems = getCartItems(req);
  if (cartItems.length === 0) {
    pushFlash(req, "Your cart is empty.");
    redirectWithSession(req, res, "/cart");
    return;
  }

  const { subtotal, shipping, total } = calculateTotals(cartItems);
  const prices = await getCryptoPrices();
  const cryptoOptions = await buildCryptoOptions(total, prices);
  res.render("checkout", {
    cart_items: cartItems,
    subtotal,
    discount: 0,
    promo_code: "",
    shipping,
    total,
    selected_method: "bitcoin",
    crypto_options: cryptoOptions,
    form_values: {
      name: "",
      email: "",
      phone: "",
      country: "",
      address: "",
      apartment: "",
      city: "",
      state: "",
      zip_code: "",
    },
    messages: consumeFlashes(req),
  });
});

app.post("/checkout", async (req: Request, res: Response) => {
  const cartItems = getCartItems(req);
  const cid = ensureCartId(req);
  if (cartItems.length === 0) {
    pushFlash(req, "Your cart is empty.");
    redirectWithSession(req, res, "/cart", cid);
    return;
  }

  const baseTotals = calculateTotals(cartItems);
  const rawPromo = String(req.body.promo_code ?? "").trim().toUpperCase();
  const promoApplied = rawPromo === "ART10" || rawPromo === "COLLECTOR10";
  const discount = promoApplied ? Number((baseTotals.subtotal * 0.1).toFixed(2)) : 0;
  const discountedSubtotal = Math.max(0, baseTotals.subtotal - discount);
  const shipping = discountedSubtotal >= 1500 ? 0.0 : discountedSubtotal > 0 ? 65.0 : 0.0;
  const total = Number((discountedSubtotal + shipping).toFixed(2));

  const prices = await getCryptoPrices();
  const cryptoOptions = await buildCryptoOptions(total, prices);

  const name = String(req.body.name ?? "").trim();
  const email = String(req.body.email ?? "").trim();
  const phone = String(req.body.phone ?? "").trim();
  const country = String(req.body.country ?? "").trim();
  const address = String(req.body.address ?? "").trim();
  const apartment = String(req.body.apartment ?? "").trim();
  const city = String(req.body.city ?? "").trim();
  const state = String(req.body.state ?? "").trim();
  const zipCode = String(req.body.zip_code ?? "").trim();
  const rawMethod = String(req.body.payment_method ?? "bitcoin");
  const isSupportedMethod =
    rawMethod === "bitcoin" ||
    rawMethod === "ethereum" ||
    rawMethod === "solana";

  const formValues = {
    name,
    email,
    phone,
    country,
    address,
    apartment,
    city,
    state,
    zip_code: zipCode,
  };

  const phoneDigits = phone.replace(/\D/g, "");
  const emailDomain = email.includes("@") ? email.split("@").pop() ?? "" : "";
  if (name.length < 2 || !email.includes("@") || !emailDomain.includes(".")) {
    pushFlash(req, "Please enter your full legal name and a valid email address.");
  } else if (phoneDigits.length < 6) {
    pushFlash(req, "Please enter a valid phone number.");
  } else if (
    country.length < 2 ||
    address.length < 3 ||
    city.length < 2 ||
    state.length < 2 ||
    zipCode.length < 2
  ) {
    pushFlash(
      req,
      "Please complete your country/region, street address, city, state, and ZIP/postal code."
    );
  } else if (!isSupportedMethod) {
    pushFlash(req, "Please select a cryptocurrency payment method (BTC, ETH, or SOL).");
  } else if (!cryptoOptions[rawMethod].walletAddress) {
    pushFlash(
      req,
      `${cryptoOptions[rawMethod].label} (${cryptoOptions[rawMethod].symbol}) wallet address is not configured yet.`
    );
  } else {
    const selected = cryptoOptions[rawMethod];
    const order: Order = {
      reference: crypto.randomUUID().replace(/-/g, "").slice(0, 10).toUpperCase(),
      name,
      email,
      phone,
      country,
      address,
      apartment,
      city,
      state,
      zip_code: zipCode,
      payment_method: selected.key,
      payment_symbol: selected.symbol,
      payment_network: selected.network,
      crypto_amount: selected.amount,
      wallet_address: selected.walletAddress,
      qr_svg: selected.qrSvg,
      payment_status: "pending",
      subtotal: baseTotals.subtotal,
      discount,
      shipping,
      total,
      items: cartItems,
    };
    req.session.order = order;
    orderStore.set(cid, order);
    saveCart(req, res, {});
    redirectWithSession(req, res, "/checkout-success", cid);
    return;
  }

  res.render("checkout", {
    cart_items: cartItems,
    subtotal: baseTotals.subtotal,
    discount,
    promo_code: promoApplied ? rawPromo : "",
    shipping,
    total,
    selected_method: isSupportedMethod ? rawMethod : "bitcoin",
    crypto_options: cryptoOptions,
    form_values: formValues,
    messages: consumeFlashes(req),
  });
});

app.get("/checkout-success", (req: Request, res: Response) => {
  const cid = getRequestCartId(req);
  const order = req.session.order || (cid ? orderStore.get(cid) : undefined);
  if (!order) {
    redirectWithSession(req, res, "/");
    return;
  }
  res.render("checkout_success", { order });
});

app.post("/clear-cart", (req: Request, res: Response) => {
  const cid = saveCart(req, res, {});
  pushFlash(req, "Your cart has been cleared.");
  redirectWithSession(req, res, "/cart", cid);
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`ART STUDIO server running on http://0.0.0.0:${PORT}`);
});
