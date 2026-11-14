import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import type { Request, Response, NextFunction } from "express";
import session from "express-session";

interface Product {
  id: number;
  title: string;
  artist: string;
  category: string;
  price: number;
  price_display: string;
  size: string;
  image: string;
  description: string;
}

interface CartItem extends Product {
  quantity: number;
}

interface Order {
  reference: string;
  name: string;
  email: string;
  payment_method: string;
  payment_status: string;
  total: number;
  items: CartItem[];
}

declare module "express-session" {
  interface SessionData {
    cart?: Record<string, number>;
    order?: Order;
    flashes?: string[];
  }
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || "3000") || 3000;
const BTC_WALLET_ADDRESS =
  process.env.BTC_WALLET_ADDRESS ||
  "bc1qexamplewalletreplacewithyourwalletaddress1234567890";
const BTC_USD_PRICE = Number(process.env.BTC_USD_PRICE || "68000") || 68000;
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
  "Drawings",
  "Mixed Media",
  "Fine Art Prints",
];

function getBtcWalletAddress(): string {
  return process.env.BTC_WALLET_ADDRESS || BTC_WALLET_ADDRESS;
}

function calculateBtcAmount(usdTotal: number): number {
  if (usdTotal <= 0) {
    return 0.0;
  }
  return Number((Number(usdTotal) / BTC_USD_PRICE).toFixed(8));
}

function getProductById(productId: string | number): Product | undefined {
  return productLookup.get(String(productId));
}

function getCart(req: Request): Record<string, number> {
  const rawCart = req.session.cart;
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
}

function consumeFlashes(req: Request): string[] {
  const messages = req.session.flashes ?? [];
  req.session.flashes = [];
  return messages;
}

const app = express();
app.set("trust proxy", 1);
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use("/static", express.static(path.join(__dirname, "static")));
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

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
  if (req.secure && req.session?.cookie) {
    req.session.cookie.sameSite = "none";
    req.session.cookie.secure = true;
  }
  res.locals.cart_count = getCartCount(req);
  res.locals.brand_name = "ART STUDIO";
  res.locals.formatCurrency = formatCurrency;
  next();
});

app.get("/", (_req: Request, res: Response) => {
  res.render("index", {
    categories,
    products,
    featured_collection: featuredCollection,
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
    featured_collection: [],
    search_query: query,
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

  req.session.cart = currentCart;
  res.redirect("/cart");
});

app.post("/add-to-cart", (req: Request, res: Response) => {
  const productId = String(req.body.product_id ?? "");
  const product = getProductById(productId);
  if (!product) {
    res.status(404).send("Not Found");
    return;
  }

  const parsed = Number.parseInt(String(req.body.quantity ?? "1"), 10);
  const quantity = Number.isNaN(parsed) ? 1 : parsed;

  if (quantity < 1 || quantity > 20) {
    pushFlash(req, "Please choose a quantity between 1 and 20.");
    res.redirect(`/product/${product.id}`);
    return;
  }

  const currentCart = getCart(req);
  let newQuantity = (currentCart[String(product.id)] ?? 0) + quantity;
  if (newQuantity > 20) {
    pushFlash(req, "A maximum of 20 of each artwork can be added to the cart.");
    newQuantity = 20;
  }
  currentCart[String(product.id)] = newQuantity;
  req.session.cart = currentCart;
  pushFlash(req, `${product.title} was added to your cart.`);
  res.redirect("/cart");
});

app.get("/checkout", (req: Request, res: Response) => {
  const cartItems = getCartItems(req);
  if (cartItems.length === 0) {
    pushFlash(req, "Your cart is empty.");
    res.redirect("/cart");
    return;
  }

  const { subtotal, shipping, total } = calculateTotals(cartItems);
  const btcTotal = calculateBtcAmount(total);
  res.render("checkout", {
    cart_items: cartItems,
    subtotal,
    shipping,
    total,
    btc_total: btcTotal,
    btc_wallet_address: getBtcWalletAddress(),
    btc_usd_price: BTC_USD_PRICE,
    messages: consumeFlashes(req),
  });
});

app.post("/checkout", (req: Request, res: Response) => {
  const cartItems = getCartItems(req);
  if (cartItems.length === 0) {
    pushFlash(req, "Your cart is empty.");
    res.redirect("/cart");
    return;
  }

  const { subtotal, shipping, total } = calculateTotals(cartItems);
  const name = String(req.body.name ?? "").trim();
  const email = String(req.body.email ?? "").trim();
  const paymentMethod = String(req.body.payment_method ?? "");

  const emailDomain = email.includes("@") ? email.split("@").pop() ?? "" : "";
  if (name.length < 2 || !email.includes("@") || !emailDomain.includes(".")) {
    pushFlash(req, "Please enter a valid name and email address.");
  } else if (paymentMethod !== "bitcoin" && paymentMethod !== "card") {
    pushFlash(req, "Please select a payment method.");
  } else {
    const order: Order = {
      reference: crypto.randomUUID().replace(/-/g, "").slice(0, 10).toUpperCase(),
      name,
      email,
      payment_method: paymentMethod,
      payment_status: "pending",
      total,
      items: cartItems,
    };
    req.session.order = order;
    req.session.cart = {};
    res.redirect("/checkout-success");
    return;
  }

  const btcTotal = calculateBtcAmount(total);
  res.render("checkout", {
    cart_items: cartItems,
    subtotal,
    shipping,
    total,
    btc_total: btcTotal,
    btc_wallet_address: getBtcWalletAddress(),
    btc_usd_price: BTC_USD_PRICE,
    messages: consumeFlashes(req),
  });
});

app.get("/checkout-success", (req: Request, res: Response) => {
  const order = req.session.order;
  if (!order) {
    res.redirect("/");
    return;
  }
  res.render("checkout_success", { order });
});

app.post("/clear-cart", (req: Request, res: Response) => {
  req.session.cart = {};
  pushFlash(req, "Your cart has been cleared.");
  res.redirect("/cart");
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`ART STUDIO server running on http://0.0.0.0:${PORT}`);
});
