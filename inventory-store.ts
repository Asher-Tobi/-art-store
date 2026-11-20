import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export type InventoryStatus = "available" | "sold";
export type AuthenticityStatus = "verified" | "pending_review" | "unverified";

export interface ProductProvenance {
  datePeriod: string;
  originAttribution: string;
  materialsMedium: string;
  markingsEdition: string;
  conditionNote: string;
  provenanceRecord: string;
}

export interface Product {
  id: number;
  inventory_id: string;
  title: string;
  artist: string;
  category: string;
  price: number;
  price_display: string;
  size: string;
  image: string;
  images?: string[];
  description: string;
  status: InventoryStatus;
  authenticity_status: AuthenticityStatus;
  authenticity_note: string;
  created_at: string;
  updated_at: string;
  sold_at?: string;
  sold_order_reference?: string;
  provenance?: ProductProvenance;
}

export interface SeedProductInput {
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

export interface PersistedOrderItem {
  id: number;
  inventory_id: string;
  title: string;
  artist: string;
  category: string;
  price: number;
  size: string;
  image: string;
  quantity: number;
}

export interface PersistedOrderRecord {
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
  payment_txid?: string;
  payment_received_btc?: string;
  payment_block_height?: number;
  created_at_ms?: number;
  subtotal: number;
  discount: number;
  shipping: number;
  shipping_method?: string;
  shipping_tier?: string;
  is_international?: boolean;
  has_furniture?: boolean;
  total: number;
  items: PersistedOrderItem[];
}

interface InventoryDatabaseFile {
  version: number;
  sequences: Record<string, number>;
  products: Product[];
  orders: PersistedOrderRecord[];
  consumed_txids?: Record<string, string>;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULT_DB_PATH = path.join(__dirname, "data", "inventory.json");

export const CATEGORY_CODES: Record<string, string> = {
  painting: "PA",
  paintings: "PA",
  prints: "PR",
  print: "PR",
  photography: "PH",
  sculpture: "SC",
  sculptures: "SC",
  furniture: "FU",
};

export const VALID_CATEGORIES = [
  "Painting",
  "Prints",
  "Photography",
  "Sculpture",
  "Furniture",
] as const;

export function normalizeCategoryName(category: string): string {
  const clean = String(category ?? "").trim().toLowerCase();
  if (clean === "painting" || clean === "paintings") return "Painting";
  if (clean === "print" || clean === "prints") return "Prints";
  if (clean === "photography") return "Photography";
  if (clean === "sculpture" || clean === "sculptures") return "Sculpture";
  if (clean === "furniture") return "Furniture";
  return String(category ?? "").trim() || "Painting";
}

export function getCategoryCode(category: string): string {
  const clean = String(category ?? "").trim().toLowerCase();
  if (CATEGORY_CODES[clean]) return CATEGORY_CODES[clean];
  const fallback = clean.replace(/[^a-z]/g, "").slice(0, 2).toUpperCase();
  return fallback.length === 2 ? fallback : "AR";
}

export function formatPriceDisplay(price: number): string {
  const rounded = Number(price.toFixed(2));
  if (Number.isInteger(rounded)) {
    return `$${rounded.toLocaleString("en-US")}`;
  }
  return `$${rounded.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export class InventoryStore {
  private dbPath: string;
  private sequences: Record<string, number> = {};
  private products: Product[] = [];
  private orders: PersistedOrderRecord[] = [];
  private consumedTxids: Record<string, string> = {};
  private byId = new Map<string, Product>();
  private byInventoryId = new Map<string, Product>();

  constructor(dbPath: string = DEFAULT_DB_PATH) {
    this.dbPath = dbPath;
  }

  private rebuildIndexes(): void {
    this.byId.clear();
    this.byInventoryId.clear();
    for (const item of this.products) {
      this.byId.set(String(item.id), item);
      if (item.inventory_id) {
        this.byInventoryId.set(item.inventory_id.toUpperCase(), item);
      }
    }
  }

  private saveToDisk(): void {
    const dir = path.dirname(this.dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const payload: InventoryDatabaseFile = {
      version: 1,
      sequences: this.sequences,
      products: this.products,
      orders: this.orders,
      consumed_txids: this.consumedTxids,
    };
    const tmpPath = `${this.dbPath}.${process.pid}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify(payload, null, 2), "utf8");
    fs.renameSync(tmpPath, this.dbPath);
  }

  private syncSequenceFromExistingIds(): void {
    const pattern = /^AS-([A-Z]{2})-(\d{4})-(\d+)$/;
    for (const product of this.products) {
      if (!product.inventory_id) continue;
      const match = pattern.exec(product.inventory_id.toUpperCase());
      if (!match) continue;
      const key = `${match[1]}-${match[2]}`;
      const num = Number.parseInt(match[3], 10);
      if (Number.isFinite(num) && num > (this.sequences[key] ?? 0)) {
        this.sequences[key] = num;
      }
    }
  }

  public generateInventoryId(category: string, year?: number): string {
    const code = getCategoryCode(category);
    const targetYear =
      typeof year === "number" && Number.isFinite(year)
        ? Math.trunc(year)
        : new Date().getFullYear();
    const seqKey = `${code}-${targetYear}`;
    let nextNum = (this.sequences[seqKey] ?? 0) + 1;

    while (true) {
      const padded = String(nextNum).padStart(3, "0");
      const candidate = `AS-${code}-${targetYear}-${padded}`;
      if (!this.byInventoryId.has(candidate.toUpperCase())) {
        this.sequences[seqKey] = nextNum;
        return candidate;
      }
      nextNum += 1;
    }
  }

  public initialize(
    seedProducts: SeedProductInput[],
    seedProvenanceById: Record<number, ProductProvenance>
  ): void {
    let loaded: InventoryDatabaseFile | null = null;
    if (fs.existsSync(this.dbPath)) {
      try {
        const raw = fs.readFileSync(this.dbPath, "utf8");
        const parsed = JSON.parse(raw) as Partial<InventoryDatabaseFile>;
        if (parsed && Array.isArray(parsed.products)) {
          loaded = {
            version: typeof parsed.version === "number" ? parsed.version : 1,
            sequences:
              parsed.sequences && typeof parsed.sequences === "object"
                ? { ...parsed.sequences }
                : {},
            products: parsed.products,
            orders: Array.isArray(parsed.orders) ? parsed.orders : [],
            consumed_txids:
              parsed.consumed_txids && typeof parsed.consumed_txids === "object"
                ? { ...parsed.consumed_txids }
                : {},
          };
        }
      } catch (err) {
        console.error("Failed to read inventory.json, re-initializing cleanly:", err);
      }
    }

    const nowIso = new Date().toISOString();
    const defaultYear = 2026;

    if (loaded) {
      this.sequences = loaded.sequences;
      this.products = loaded.products.map((p) => ({
        ...p,
        category: normalizeCategoryName(p.category),
        status: p.status === "sold" ? "sold" : "available",
        authenticity_status:
          p.authenticity_status === "verified" ||
          p.authenticity_status === "pending_review" ||
          p.authenticity_status === "unverified"
            ? p.authenticity_status
            : "verified",
        authenticity_note:
          p.authenticity_note ||
          "Curatorial studio/dealer verification documented in ART STUDIO archive.",
        created_at: p.created_at || nowIso,
        updated_at: p.updated_at || nowIso,
      }));
      this.orders = loaded.orders;
      this.consumedTxids = loaded.consumed_txids || {};
      this.rebuildIndexes();
      this.syncSequenceFromExistingIds();
    }

    let changed = !loaded;

    // Ensure every seed product exists without overwriting existing customized data or resetting IDs
    for (const seed of seedProducts) {
      const existing = this.byId.get(String(seed.id));
      const defaultProvenance = seedProvenanceById[seed.id] ?? {
        datePeriod: "Curated Studio Work",
        originAttribution: seed.artist,
        materialsMedium: seed.category,
        markingsEdition: "Cataloged Archive Work",
        conditionNote: "Inspected prior to museum-grade crating.",
        provenanceRecord: "Documented studio or vetted dealer archive provenance.",
      };

      if (!existing) {
        const inventoryId = this.generateInventoryId(seed.category, defaultYear);
        const created: Product = {
          id: seed.id,
          inventory_id: inventoryId,
          title: seed.title,
          artist: seed.artist,
          category: normalizeCategoryName(seed.category),
          price: seed.price,
          price_display: seed.price_display,
          size: seed.size,
          image: seed.image,
          images: seed.images ? [...seed.images] : [seed.image],
          description: seed.description,
          status: "available",
          authenticity_status: "verified",
          authenticity_note:
            "Curatorial provenance and studio/dealer origin verified prior to archive cataloging.",
          created_at: nowIso,
          updated_at: nowIso,
          provenance: defaultProvenance,
        };
        this.products.push(created);
        this.byId.set(String(created.id), created);
        this.byInventoryId.set(created.inventory_id.toUpperCase(), created);
        changed = true;
      } else {
        if (!existing.inventory_id) {
          existing.inventory_id = this.generateInventoryId(
            existing.category || seed.category,
            defaultYear
          );
          this.byInventoryId.set(existing.inventory_id.toUpperCase(), existing);
          changed = true;
        }
        if (!existing.provenance) {
          existing.provenance = defaultProvenance;
          changed = true;
        }
      }
    }

    // Backfill any stray products lacking an inventory_id
    for (const prod of this.products) {
      if (!prod.inventory_id) {
        prod.inventory_id = this.generateInventoryId(prod.category, defaultYear);
        changed = true;
      }
    }

    this.rebuildIndexes();
    this.syncSequenceFromExistingIds();

    if (changed || !fs.existsSync(this.dbPath)) {
      this.saveToDisk();
    }
  }

  public getAllProducts(): Product[] {
    return this.products;
  }

  public getProductById(idOrInventoryId: string | number): Product | undefined {
    const key = String(idOrInventoryId ?? "").trim();
    if (!key) return undefined;
    return this.byId.get(key) || this.byInventoryId.get(key.toUpperCase());
  }

  public getProductByInventoryId(inventoryId: string): Product | undefined {
    const key = String(inventoryId ?? "").trim().toUpperCase();
    return key ? this.byInventoryId.get(key) : undefined;
  }

  public getProvenance(product: Product): ProductProvenance {
    return (
      product.provenance ?? {
        datePeriod: "Curated Studio Work",
        originAttribution: product.artist,
        materialsMedium: product.category,
        markingsEdition: "Cataloged Archive Work",
        conditionNote: "Inspected prior to museum-grade crating.",
        provenanceRecord:
          product.authenticity_status === "verified"
            ? "Verified studio or vetted dealer provenance on file."
            : "Assigned Inventory ID for archive tracking; authenticity verification pending curatorial review.",
      }
    );
  }

  public searchProducts(
    query: string,
    options?: { category?: string; status?: string; authenticity?: string }
  ): Product[] {
    const needle = String(query ?? "").trim().toLowerCase();
    const catFilter = String(options?.category ?? "").trim().toLowerCase();
    const statusFilter = String(options?.status ?? "").trim().toLowerCase();
    const authFilter = String(options?.authenticity ?? "").trim().toLowerCase();

    return this.products.filter((p) => {
      if (catFilter && catFilter !== "all" && p.category.toLowerCase() !== catFilter) {
        return false;
      }
      if (statusFilter && statusFilter !== "all" && p.status.toLowerCase() !== statusFilter) {
        return false;
      }
      if (
        authFilter &&
        authFilter !== "all" &&
        p.authenticity_status.toLowerCase() !== authFilter
      ) {
        return false;
      }
      if (!needle) return true;
      return (
        p.inventory_id.toLowerCase().includes(needle) ||
        p.title.toLowerCase().includes(needle) ||
        p.artist.toLowerCase().includes(needle) ||
        p.category.toLowerCase().includes(needle) ||
        String(p.id) === needle
      );
    });
  }

  public createProduct(input: {
    title: string;
    artist: string;
    category: string;
    price: number;
    size: string;
    image?: string;
    images?: string[];
    description: string;
    year?: number;
    authenticity_status?: AuthenticityStatus;
    authenticity_note?: string;
    provenance?: Partial<ProductProvenance>;
  }): Product {
    const normalizedCategory = normalizeCategoryName(input.category);
    const maxNumericId = this.products.reduce(
      (max, p) => (p.id > max ? p.id : max),
      0
    );
    const nextId = maxNumericId + 1;
    const inventoryId = this.generateInventoryId(normalizedCategory, input.year);
    const nowIso = new Date().toISOString();
    const primaryImage =
      String(input.image ?? "").trim() || "/static/images/london-gallery-1.jpg";
    const galleryImages =
      input.images && input.images.length ? input.images : [primaryImage];
    const authStatus: AuthenticityStatus =
      input.authenticity_status === "verified" ||
      input.authenticity_status === "unverified"
        ? input.authenticity_status
        : "pending_review";
    const defaultAuthNote =
      authStatus === "verified"
        ? "Curatorial provenance and attribution verified prior to listing."
        : "Cataloged with an ART STUDIO Inventory ID. Independent authenticity documentation is pending curatorial review.";

    const created: Product = {
      id: nextId,
      inventory_id: inventoryId,
      title: input.title.trim(),
      artist: input.artist.trim(),
      category: normalizedCategory,
      price: Number(Number(input.price).toFixed(2)),
      price_display: formatPriceDisplay(Number(input.price)),
      size: input.size.trim(),
      image: primaryImage,
      images: galleryImages,
      description: input.description.trim(),
      status: "available",
      authenticity_status: authStatus,
      authenticity_note: String(input.authenticity_note ?? "").trim() || defaultAuthNote,
      created_at: nowIso,
      updated_at: nowIso,
      provenance: {
        datePeriod:
          String(input.provenance?.datePeriod ?? "").trim() || "Cataloged Studio Work",
        originAttribution:
          String(input.provenance?.originAttribution ?? "").trim() || input.artist.trim(),
        materialsMedium:
          String(input.provenance?.materialsMedium ?? "").trim() || normalizedCategory,
        markingsEdition:
          String(input.provenance?.markingsEdition ?? "").trim() ||
          `Inventory Ref ${inventoryId}`,
        conditionNote:
          String(input.provenance?.conditionNote ?? "").trim() ||
          "Curatorial condition inspection recorded.",
        provenanceRecord:
          String(input.provenance?.provenanceRecord ?? "").trim() ||
          (authStatus === "verified"
            ? "Verified provenance documented in ART STUDIO catalog."
            : "Pending full provenance & authenticity documentation."),
      },
    };

    this.products.push(created);
    this.rebuildIndexes();
    this.saveToDisk();
    return created;
  }

  public updateProduct(
    idOrInventoryId: string | number,
    patch: {
      title?: string;
      artist?: string;
      category?: string;
      price?: number;
      size?: string;
      image?: string;
      description?: string;
      status?: InventoryStatus;
      authenticity_status?: AuthenticityStatus;
      authenticity_note?: string;
      provenance?: Partial<ProductProvenance>;
    }
  ): Product | undefined {
    const product = this.getProductById(idOrInventoryId);
    if (!product) return undefined;

    // IMMUTABLE: product.inventory_id is NEVER changed on edit!
    if (typeof patch.title === "string" && patch.title.trim()) {
      product.title = patch.title.trim();
    }
    if (typeof patch.artist === "string" && patch.artist.trim()) {
      product.artist = patch.artist.trim();
    }
    if (typeof patch.category === "string" && patch.category.trim()) {
      product.category = normalizeCategoryName(patch.category);
    }
    if (typeof patch.price === "number" && Number.isFinite(patch.price) && patch.price > 0) {
      product.price = Number(patch.price.toFixed(2));
      product.price_display = formatPriceDisplay(product.price);
    }
    if (typeof patch.size === "string" && patch.size.trim()) {
      product.size = patch.size.trim();
    }
    if (typeof patch.image === "string" && patch.image.trim()) {
      const nextImg = patch.image.trim();
      product.image = nextImg;
      if (!product.images || product.images.length === 0) {
        product.images = [nextImg];
      } else {
        product.images[0] = nextImg;
      }
    }
    if (typeof patch.description === "string" && patch.description.trim()) {
      product.description = patch.description.trim();
    }
    if (patch.status === "available" || patch.status === "sold") {
      product.status = patch.status;
      if (patch.status === "sold" && !product.sold_at) {
        product.sold_at = new Date().toISOString();
      } else if (patch.status === "available") {
        product.sold_at = undefined;
        product.sold_order_reference = undefined;
      }
    }
    if (
      patch.authenticity_status === "verified" ||
      patch.authenticity_status === "pending_review" ||
      patch.authenticity_status === "unverified"
    ) {
      product.authenticity_status = patch.authenticity_status;
    }
    if (typeof patch.authenticity_note === "string") {
      product.authenticity_note = patch.authenticity_note.trim();
    }
    if (patch.provenance) {
      const prev = this.getProvenance(product);
      product.provenance = {
        datePeriod: patch.provenance.datePeriod?.trim() || prev.datePeriod,
        originAttribution:
          patch.provenance.originAttribution?.trim() || prev.originAttribution,
        materialsMedium:
          patch.provenance.materialsMedium?.trim() || prev.materialsMedium,
        markingsEdition:
          patch.provenance.markingsEdition?.trim() || prev.markingsEdition,
        conditionNote: patch.provenance.conditionNote?.trim() || prev.conditionNote,
        provenanceRecord:
          patch.provenance.provenanceRecord?.trim() || prev.provenanceRecord,
      };
    }

    product.updated_at = new Date().toISOString();
    this.saveToDisk();
    return product;
  }

  public markProductsSold(productIds: number[], orderReference: string): void {
    const nowIso = new Date().toISOString();
    let changed = false;
    for (const id of productIds) {
      const product = this.byId.get(String(id));
      if (product) {
        product.status = "sold";
        product.sold_at = product.sold_at || nowIso;
        product.sold_order_reference = orderReference;
        product.updated_at = nowIso;
        changed = true;
      }
    }
    if (changed) {
      this.saveToDisk();
    }
  }

  public saveOrder(order: PersistedOrderRecord): void {
    const existingIdx = this.orders.findIndex(
      (o) => o.reference === order.reference
    );
    if (existingIdx >= 0) {
      this.orders[existingIdx] = order;
    } else {
      this.orders.unshift(order);
    }
    this.saveToDisk();
  }

  public getOrders(): PersistedOrderRecord[] {
    return this.orders;
  }

  public getOrderByReference(reference: string): PersistedOrderRecord | undefined {
    const ref = String(reference ?? "").trim().toUpperCase();
    return this.orders.find((o) => o.reference === ref);
  }

  public recordConsumedTxid(txid: string, orderReference: string): void {
    if (!txid) return;
    this.consumedTxids[txid] = orderReference;
    this.saveToDisk();
  }

  public getConsumedTxids(): Record<string, string> {
    return this.consumedTxids;
  }

  public getStats(): {
    total: number;
    available: number;
    sold: number;
    verified: number;
    pendingReview: number;
    sequences: Record<string, number>;
    byCategory: Record<string, number>;
  } {
    const byCategory: Record<string, number> = {};
    let available = 0;
    let sold = 0;
    let verified = 0;
    let pendingReview = 0;

    for (const p of this.products) {
      byCategory[p.category] = (byCategory[p.category] ?? 0) + 1;
      if (p.status === "sold") sold += 1;
      else available += 1;
      if (p.authenticity_status === "verified") verified += 1;
      else pendingReview += 1;
    }

    return {
      total: this.products.length,
      available,
      sold,
      verified,
      pendingReview,
      sequences: { ...this.sequences },
      byCategory,
    };
  }
}
