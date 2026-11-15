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
    images: [
      "/static/images/3044136-HSC00001-7.jpg",
      "/static/images/p4-detail-1.jpg",
      "/static/images/p4-detail-2.jpg",
      "/static/images/p4-detail-3.jpg",
    ],
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
    images: [
      "/static/images/8125999-IVGGQOPI-7.jpg",
      "/static/images/p5-detail-1.jpg",
      "/static/images/p5-detail-2.jpg",
      "/static/images/p5-detail-3.jpg",
    ],
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
    images: [
      "/static/images/8702937-ICZMCJPJ-7.jpg",
      "/static/images/p7-detail-1.jpg",
      "/static/images/p7-detail-2.jpg",
      "/static/images/p7-detail-3.jpg",
    ],
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
    images: [
      "/static/images/13158935-GALGXZVV-7.jpg",
      "/static/images/p8-detail-1.jpg",
      "/static/images/p8-detail-2.jpg",
      "/static/images/p8-detail-3.jpg",
    ],
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
    images: [
      "/assets/aistudio/12654265-ZLCJTDIX-7_95a7c268.jpg",
      "/static/images/p9-detail-1.jpg",
      "/static/images/p9-detail-2.jpg",
      "/static/images/p9-detail-3.jpg",
    ],
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
    images: [
      "/assets/aistudio/product_10_0fec4e65.jpg",
      "/static/images/p10-detail-1.jpg",
      "/static/images/p10-detail-2.jpg",
      "/static/images/p10-detail-3.jpg",
    ],
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
    images: [
      "/static/images/atlantic-drift.jpg",
      "/static/images/p11-detail-1.jpg",
      "/static/images/p11-detail-2.jpg",
      "/static/images/p11-detail-3.jpg",
    ],
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
    images: [
      "/static/images/12649329-PYQGAIGQ-7.jpg",
      "/static/images/p12-detail-1.jpg",
      "/static/images/p12-detail-2.jpg",
      "/static/images/p12-detail-3.jpg",
    ],
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
      "/static/images/mary-ogochukwu-1.jpg",
      "/static/images/mary-ogochukwu-2.jpg",
      "/static/images/mary-ogochukwu-3.jpg",
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
      "/static/images/albert-clark-1.jpg",
      "/static/images/albert-clark-2.jpg",
      "/static/images/albert-clark-3.jpg",
      "/static/images/albert-clark-4.jpg",
      "/static/images/albert-clark-5.jpg",
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
      "/static/images/white-marble-torso-1.jpg",
      "/static/images/white-marble-torso-2.jpg",
      "/static/images/white-marble-torso-3.jpg",
      "/static/images/white-marble-torso-4.jpg",
      "/static/images/white-marble-torso-5.jpg",
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
    image: "/static/images/nando-kallweit-sina-1.jpg",
    images: [
      "/static/images/nando-kallweit-sina-1.jpg",
      "/static/images/nando-kallweit-sina-2.jpg",
      "/static/images/nando-kallweit-sina-3.jpg",
      "/static/images/nando-kallweit-sina-4.jpg",
      "/static/images/nando-kallweit-sina-5.jpg",
      "/static/images/nando-kallweit-sina-6.jpg",
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
    image: "/static/images/madonna-sorrows-1.jpg",
    images: [
      "/static/images/madonna-sorrows-1.jpg",
      "/static/images/madonna-sorrows-2.jpg",
      "/static/images/madonna-sorrows-3.jpg",
      "/static/images/madonna-sorrows-4.jpg",
      "/static/images/madonna-sorrows-5.jpg",
      "/static/images/madonna-sorrows-6.jpg",
    ],
    description:
      "Fine antique 19th-century Italian Old Master oil painting on linen canvas after Giovanni Battista Salvi da Sassoferrato's renowned composition, depicting the Virgin Mary in serene devotional prayer draped in a deep ultramarine mantle with rich craquelure and original period stretcher.",
  },
  {
    id: 19,
    title: "Mexico in Reflection",
    artist: "Beth Barry",
    category: "Painting",
    price: 450.0,
    price_display: "$450",
    size: "14 x 11 in",
    image: "/static/images/beth-barry-mexico-reflection.jpg",
    images: [
      "/static/images/beth-barry-mexico-reflection.jpg",
      "/static/images/p19-detail-1.jpg",
      "/static/images/p19-detail-2.jpg",
      "/static/images/p19-detail-3.jpg",
    ],
    description:
      "Original 2026 acrylic painting on canvas by contemporary American artist Beth Barry, sourced with Gallery Sitka provenance. Gestural cerulean, emerald, and warm ochre brushwork captures shoreline light and water reflections across expressive canvas texture.",
  },
  {
    id: 20,
    title: "Swan Maiden",
    artist: "Alex Garant",
    category: "Painting",
    price: 1800.0,
    price_display: "$1,800",
    size: "28 x 28 in (Framed 29 x 29 in)",
    image: "/static/images/alex-garant-swan-maiden-1.jpg",
    images: [
      "/static/images/alex-garant-swan-maiden-1.jpg",
      "/static/images/alex-garant-swan-maiden-2.jpg",
      "/static/images/alex-garant-swan-maiden-3.jpg",
      "/static/images/p20-detail-sig.jpg",
    ],
    description:
      "Original 2026 oil on canvas by Canadian figurative artist Alex Garant, created for the Imaginary Menagerie exhibition at Arch Enemy Arts. Presented in a commanding diamond hardwood floater frame with signature layered double eyes and delicate white wing motifs against a cool slate-blue ground.",
  },
  {
    id: 21,
    title: "Structure",
    artist: "Shiri Phillips",
    category: "Painting",
    price: 245.0,
    price_display: "$245",
    size: "11 x 9 x 1 in (Framed)",
    image: "/static/images/shiri-phillips-structure-1.jpg",
    images: [
      "/static/images/shiri-phillips-structure-1.jpg",
      "/static/images/shiri-phillips-structure-2.jpg",
      "/static/images/shiri-phillips-structure-3.jpg",
      "/static/images/p21-detail-impasto.jpg",
    ],
    description:
      "Original 2026 framed acrylic painting on canvas by Shiri Phillips, sourced with PxP Contemporary provenance and signed along the custom mauve frame edge. Sculptural impasto strokes of sunlit yellow, emerald, plum, cerulean, and rose create a tactile geometric relief.",
  },
  {
    id: 22,
    title: "Red Sky",
    artist: "Will Klemm",
    category: "Painting",
    price: 1800.0,
    price_display: "$1,800",
    size: "12 x 12 x 1 in (Framed 16 x 16 x 2 in)",
    image: "/static/images/will-klemm-red-sky.jpg",
    images: [
      "/static/images/will-klemm-red-sky.jpg",
      "/static/images/p22-detail-1.jpg",
      "/static/images/p22-detail-2.jpg",
      "/static/images/p22-detail-3.jpg",
    ],
    description:
      "Original 2026 oil on canvas landscape by contemporary American painter Will Klemm, sourced with Wally Workman Gallery provenance and signed at lower left. Luminous crimson and amber sky glazes sweep above a sunlit golden horizon and quiet meadow treeline.",
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

interface TrustPageSection {
  heading: string;
  paragraphs: string[];
  bullets?: string[];
}

interface TrustPageConfig {
  slug: string;
  kicker: string;
  title: string;
  description: string;
  lead: string;
  highlights: Array<{ label: string; value: string }>;
  sections: TrustPageSection[];
}

interface SupportInquiry {
  reference: string;
  name: string;
  email: string;
  topic: string;
  referenceCode: string;
  message: string;
  createdAt: string;
}

const inquiryStore = new Map<string, SupportInquiry>();

const trustPages: Record<string, TrustPageConfig> = {
  shipping: {
    slug: "shipping",
    kicker: "Fine Art Logistics",
    title: "Shipping & Delivery",
    description:
      "Insured fine art courier delivery, museum-grade crating, and worldwide shipping timelines at ART STUDIO.",
    lead: "Every original painting, photograph, sculpture, and collectible design work is custom-packed by art handlers and shipped worldwide with full declared-value transit insurance.",
    highlights: [
      { label: "Orders $1,500+", value: "Complimentary Courier" },
      { label: "Transit Coverage", value: "100% Declared Value" },
      { label: "Tracking & Care", value: "Signature Required" },
    ],
    sections: [
      {
        heading: "Museum-Grade Crating & Packaging",
        paragraphs: [
          "All framed works, stretched canvases, stone sculptures, and design objects are prepared in-house or at the originating studio prior to carrier handover.",
        ],
        bullets: [
          "Paintings and framed works are wrapped in acid-free glassine paper, rigid corner protectors, high-density foam cushioning, and double-walled export cartons or custom timber crates.",
          "Marble, bronze, and glass sculptures ship in custom-molded cavity inserts suspended inside reinforced wood crating.",
          "Your signed Certificate of Authenticity travels inside a sealed archival sleeve accompanying the shipment.",
        ],
      },
      {
        heading: "International Dispatch & Customs",
        paragraphs: [
          "Orders are dispatched from our partner studios and gallery vaults across North America and Europe. Tracking credentials and courier airway bills are emailed immediately upon dispatch.",
          "Import duties, VAT, or local clearance fees outside the originating region are assessed by destination customs authorities and remain the responsibility of the recipient unless specified otherwise.",
        ],
      },
      {
        heading: "Delivery Inspection & Transit Claims",
        paragraphs: [
          "Please inspect the exterior crate or carton before signing with the courier. In the rare event of transit damage, note the condition on the delivery receipt and contact our Logistics Desk within 48 hours with photographs of both the packaging and artwork so our insurance team can resolve the claim promptly.",
        ],
      },
    ],
  },
  authenticity: {
    slug: "authenticity",
    kicker: "Curatorial Provenance",
    title: "Artwork Authenticity",
    description:
      "Provenance verification, signed Certificates of Authenticity, and condition guarantees for every work offered at ART STUDIO.",
    lead: "Every piece presented in our archive undergoes multi-point curatorial vetting to verify authorship, materials, edition status, and documented gallery or studio provenance.",
    highlights: [
      { label: "Documentation", value: "Signed COA Included" },
      { label: "Guarantee", value: "Lifetime Authenticity" },
      { label: "Origin", value: "Vetted Studios & Dealers" },
    ],
    sections: [
      {
        heading: "Provenance & Studio Verification",
        paragraphs: [
          "Contemporary works are acquired directly from independent artist studios or authorized primary galleries. Historical, modernist, and 19th-century works are sourced exclusively through established fine art dealers with documented chain of ownership.",
        ],
        bullets: [
          "Verification of artist signatures, dates, workshop marks, foundry stamps, or edition numbers.",
          "Condition assessment covering canvas tension, pigment stability, patina, and period framing.",
          "Direct studio or estate confirmation recorded prior to listing.",
        ],
      },
      {
        heading: "Certificate of Authenticity",
        paragraphs: [
          "Each acquisition includes a physical or registered Certificate of Authenticity detailing the artist, title, medium, dimensions, year, and provenance record, signed by the artist or gallery director.",
        ],
      },
      {
        heading: "Lifetime Authenticity Guarantee",
        paragraphs: [
          "ART STUDIO stands behind the attribution of every cataloged work. Should any independent accredited authority prove an attribution to be materially inaccurate, we guarantee a full refund of the purchase price upon return of the artwork in its delivered condition.",
        ],
      },
    ],
  },
  terms: {
    slug: "terms",
    kicker: "Acquisition Agreement",
    title: "Terms & Conditions",
    description:
      "Terms of sale, on-chain cryptocurrency settlement, 14-day collector inspection returns, and buyer protections at ART STUDIO.",
    lead: "These terms govern all acquisitions, reservations, and deliveries arranged through ART STUDIO.",
    highlights: [
      { label: "Settlement", value: "BTC · ETH · SOL" },
      { label: "Return Window", value: "14-Day Inspection" },
      { label: "Pricing Currency", value: "USD Equivalent" },
    ],
    sections: [
      {
        heading: "Original Works & Availability",
        paragraphs: [
          "Most artworks in our archive are one-of-a-kind originals or strictly limited editions. Adding a work to your shopping bag does not permanently reserve the piece until checkout is completed and on-chain settlement is initiated.",
        ],
      },
      {
        heading: "Cryptocurrency Payment & Rate Settlement",
        paragraphs: [
          "Checkout totals are calculated in USD and converted into Bitcoin (BTC), Ethereum (ETH), or Solana (SOL) using live market pricing at order confirmation. Sending the exact quoted cryptocurrency amount to your assigned deposit address completes settlement with zero intermediary card or wire holds.",
        ],
      },
      {
        heading: "14-Day Collector Return Policy",
        paragraphs: [
          "If an artwork is not suited to your space upon arrival, you may request a return authorization within 14 calendar days of courier delivery.",
        ],
        bullets: [
          "Returned works must remain in their exact delivered condition and be repacked in the original archival crating.",
          "Return courier & insurance arrangements are coordinated directly by our Logistics Desk.",
          "Once inspected and received at the originating studio or vault, refunds are issued promptly to your designated wallet or settlement address.",
        ],
      },
      {
        heading: "Copyright & Intellectual Property",
        paragraphs: [
          "Purchasing a physical artwork transfers ownership of the physical object and its Certificate of Authenticity. Reproduction, commercial licensing, and underlying copyright remain with the artist or rights holder unless separately agreed in writing.",
        ],
      },
    ],
  },
  "privacy-policy": {
    slug: "privacy-policy",
    kicker: "Collector Confidentiality",
    title: "Privacy Policy",
    description:
      "How ART STUDIO safeguards collector contact information, shipping coordinates, and session data.",
    lead: "Collector discretion is foundational to fine art acquisition. We collect only the details necessary to crate, insure, and deliver your artwork and never sell or rent personal records.",
    highlights: [
      { label: "Data Sharing", value: "Zero Ad Brokers" },
      { label: "Payment Privacy", value: "No Card Data Stored" },
      { label: "Cookies", value: "Essential Bag State Only" },
    ],
    sections: [
      {
        heading: "Information We Collect",
        paragraphs: [
          "When you place an order or submit an inquiry, we collect only the contact details and shipping coordinates required to coordinate insured fine art delivery and issue provenance documentation:",
        ],
        bullets: [
          "Full legal name, email address, and telephone number (required for courier scheduling and signature release).",
          "Delivery street address, city, region, and postal code.",
          "Order reference and selected artwork metadata.",
        ],
      },
      {
        heading: "Session & Shopping Bag Cookies",
        paragraphs: [
          "We use strictly necessary session and signed bag cookies (connect.sid and art_studio_cart) solely to keep items in your shopping bag across page visits. We do not deploy third-party advertising pixels or cross-site behavioral tracking.",
        ],
      },
      {
        heading: "On-Chain Payment Privacy",
        paragraphs: [
          "Because acquisitions are settled directly via Bitcoin, Ethereum, or Solana, ART STUDIO never collects, transmits, or stores credit card numbers, CVV codes, or bank account credentials.",
        ],
      },
      {
        heading: "Data Retention & Deletion Requests",
        paragraphs: [
          "You may request access to, correction of, or deletion of your contact and delivery records at any time by submitting a Privacy & Data Request on our Contact & Support page.",
        ],
      },
    ],
  },
  contact: {
    slug: "contact",
    kicker: "Collector Concierge",
    title: "Contact & Customer Support",
    description:
      "Contact ART STUDIO curatorial and logistics specialists for condition reports, shipping support, and collector inquiries.",
    lead: "Our curatorial and fine art logistics team is ready to assist with condition reports, framing questions, courier scheduling, or order support.",
    highlights: [
      { label: "Response SLA", value: "Under 24 Hours" },
      { label: "Studio Hours", value: "Mon–Fri · 9am–6pm EST" },
      { label: "Concierge", value: "Direct Specialist Desk" },
    ],
    sections: [
      {
        heading: "Frequently Requested Assistance",
        paragraphs: [
          "Before reaching out, you may also find immediate answers in our dedicated Shipping & Delivery, Artwork Authenticity, and Terms & Conditions guides in the sidebar.",
        ],
        bullets: [
          "Condition & Verso Photographs: Additional lighting or back-of-canvas photos can be supplied upon request prior to crating.",
          "Courier Rescheduling: Need a specific delivery window or white-glove placement? Include your order reference in the form above.",
          "Transit Claims: Contact logistics@artstudio.gallery within 48 hours of delivery with packaging and artwork photos.",
        ],
      },
    ],
  },
};

function renderTrustPage(
  req: Request,
  res: Response,
  slug: string,
  extra: {
    messages?: string[];
    form_values?: { name: string; email: string; topic: string; reference: string; message: string };
  } = {}
): void {
  const page = trustPages[slug];
  if (!page) {
    res.status(404).send("Not Found");
    return;
  }
  res.render("info", {
    page,
    messages: extra.messages ?? consumeFlashes(req),
    form_values: extra.form_values ?? null,
  });
}

app.get("/shipping", (req: Request, res: Response) => {
  renderTrustPage(req, res, "shipping");
});

app.get("/authenticity", (req: Request, res: Response) => {
  renderTrustPage(req, res, "authenticity");
});

app.get("/terms", (req: Request, res: Response) => {
  renderTrustPage(req, res, "terms");
});

app.get("/privacy-policy", (req: Request, res: Response) => {
  renderTrustPage(req, res, "privacy-policy");
});

app.get("/contact", (req: Request, res: Response) => {
  renderTrustPage(req, res, "contact");
});

app.post("/contact", (req: Request, res: Response) => {
  const name = String(req.body.name ?? "").trim();
  const email = String(req.body.email ?? "").trim();
  const topic = String(req.body.topic ?? "General Collector Inquiry").trim();
  const reference = String(req.body.reference ?? "").trim();
  const message = String(req.body.message ?? "").trim();

  const emailDomain = email.includes("@") ? email.split("@").pop() ?? "" : "";
  if (name.length < 2 || !email.includes("@") || !emailDomain.includes(".") || message.length < 5) {
    renderTrustPage(req, res, "contact", {
      messages: ["Please provide your name, a valid email address, and a brief inquiry message."],
      form_values: { name, email, topic, reference, message },
    });
    return;
  }

  const refCode = `INQ-${crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase()}`;
  inquiryStore.set(refCode, {
    reference: refCode,
    name,
    email,
    topic,
    referenceCode: reference,
    message,
    createdAt: new Date().toISOString(),
  });

  pushFlash(
    req,
    `Thank you, ${name}. Your inquiry (${refCode}) has been received by our Collector Concierge team, who will reply to ${email} within 1 business day.`
  );
  redirectWithSession(req, res, "/contact");
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`ART STUDIO server running on http://0.0.0.0:${PORT}`);
});
