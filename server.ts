import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import type { Request, Response, NextFunction } from "express";
import session from "express-session";
import QRCode from "qrcode";
import {
  InventoryStore,
  VALID_CATEGORIES,
  normalizeCategoryName,
  getCategoryCode,
  type Product,
  type ProductProvenance,
  type SeedProductInput,
  type PersistedOrderRecord,
  type AuthenticityStatus,
  type InventoryStatus,
} from "./inventory-store.ts";

interface CartItem extends Product {
  quantity: number;
}

interface CheckoutOrder extends PersistedOrderRecord {
  delivery_instructions?: string;
  tax?: number;
  tax_note?: string;
  shipping_option?: string;
  estimated_delivery?: string;
  order_date?: string;
  payment_provider?: string;
  payment_provider_label?: string;
  payment_session_id?: string;
  verified_at?: string;
}

type Order = CheckoutOrder;

declare module "express-session" {
  interface SessionData {
    cart?: Record<string, number>;
    cartUpdatedAt?: number;
    cartId?: string;
    order?: Order;
    btcCheckoutStartedAt?: number;
    checkoutTokens?: string[];
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

function getPaymentGatewayConfig() {
  return {
    stripeSecretKey: (process.env.STRIPE_SECRET_KEY || "").trim(),
    stripeWebhookSecret: (process.env.STRIPE_WEBHOOK_SECRET || "").trim(),
    paypalClientId: (process.env.PAYPAL_CLIENT_ID || "").trim(),
    paypalClientSecret: (process.env.PAYPAL_CLIENT_SECRET || "").trim(),
    paypalMode:
      (process.env.PAYPAL_MODE || "sandbox").trim().toLowerCase() === "live"
        ? "live"
        : "sandbox",
    appBaseUrl: (process.env.APP_BASE_URL || "").trim(),
  };
}

const seedProducts: SeedProductInput[] = [
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
  {
    id: 23,
    title: "Blue & White Landscape Short Porcelain Tulipiere",
    artist: "Cobalt Guild",
    category: "Sculpture",
    price: 460.0,
    price_display: "$460",
    size: "23.5 x 7.5 x 7.5 in",
    image: "/static/images/tulipiere-1.jpg",
    images: [
      "/static/images/tulipiere-1.jpg",
      "/static/images/tulipiere-2.jpg",
      "/static/images/tulipiere-3.jpg",
      "/static/images/p23-detail-glaze.jpg",
    ],
    description:
      "Multi-tier Jingdezhen blue-and-white porcelain tulipiere crafted by Cobalt Guild in four interlocking sculptural sections with tubular floral spouts. Hand-painted underglaze cobalt motifs alternate between serene lakeside landscapes, sailboats, and classic floral scrollwork.",
  },
  {
    id: 24,
    title: "Upholstered Swivel Armchair",
    artist: "Bernhardt & Vella",
    category: "Furniture",
    price: 7622.5,
    price_display: "$7,622.50",
    size: "34.3 x 35.4 x 38.2 in",
    image: "/static/images/swivel-armchair-1.jpg",
    images: [
      "/static/images/swivel-armchair-1.jpg",
      "/static/images/swivel-armchair-2.jpg",
      "/static/images/swivel-armchair-3.jpg",
      "/static/images/swivel-armchair-4.jpg",
      "/static/images/swivel-armchair-5.jpg",
    ],
    description:
      "Italian neoclassical-inspired swivel armchair crafted in bentwood with a glossy bronze lacquer plinth base and upholstered in soft, velvet-like warm camel fabric. Designed with an enveloping deep seat and contoured backrest (16.9 in seat height).",
  },
  {
    id: 25,
    title: "Antique 19th Century English Leather Library Chair",
    artist: "English Victorian School",
    category: "Furniture",
    price: 1900.0,
    price_display: "$1,900",
    size: "39 x 24 x 32 in",
    image: "/static/images/english-library-chair-1.jpg",
    images: [
      "/static/images/english-library-chair-1.jpg",
      "/static/images/english-library-chair-2.jpg",
      "/static/images/english-library-chair-3.jpg",
      "/static/images/english-library-chair-4.jpg",
      "/static/images/english-library-chair-5.jpg",
      "/static/images/english-library-chair-6.jpg",
    ],
    description:
      "Circa 1880 English Victorian library armchair crafted with a solid hand-carved mahogany framework, contoured back, open scrolled arms, and ring-turned legs on signed period brass casters. Upholstered in original button-tufted olive green leather with brass nailhead trim and rich aged patina (17 in seat height).",
  },
  {
    id: 26,
    title: "MW02 x NEP Design Armchair — Limited Edition \"Interface(s)\"",
    artist: "MW Exclusive x NEP",
    category: "Furniture",
    price: 4913.15,
    price_display: "$4,913.15",
    size: "30.5 x 29.1 x 34.1 in",
    image: "/static/images/mw02-nep-armchair-1.jpg",
    images: [
      "/static/images/mw02-nep-armchair-1.jpg",
      "/static/images/mw02-nep-armchair-2.jpg",
      "/static/images/mw02-nep-armchair-3.jpg",
      "/static/images/mw02-nep-armchair-4.jpg",
      "/static/images/mw02-nep-armchair-5.jpg",
      "/static/images/mw02-nep-armchair-6.jpg",
    ],
    description:
      "Handcrafted in France, this signed and numbered limited-edition MW02 armchair created by MW Exclusive and French contemporary artist NEP pairs suspended tempered glass side panels housing original 'Interface(s)' street-art compositions with high-resilience HR40 cushions in green upholstery and stainless steel joinery (16.1 in seat height).",
  },
  {
    id: 27,
    title: "Pair of Art Deco Lounge Chairs in Teak & Cane",
    artist: "Style of Francis Jourdain",
    category: "Furniture",
    price: 3770.91,
    price_display: "$3,770.91",
    size: "29.5 x 23.2 x 30.3 in (Set of 2)",
    image: "/static/images/art-deco-lounge-chairs-1.jpg",
    images: [
      "/static/images/art-deco-lounge-chairs-1.jpg",
      "/static/images/art-deco-lounge-chairs-2.jpg",
      "/static/images/art-deco-lounge-chairs-3.jpg",
      "/static/images/art-deco-lounge-chairs-4.jpg",
      "/static/images/art-deco-lounge-chairs-5.jpg",
      "/static/images/art-deco-lounge-chairs-6.jpg",
    ],
    description:
      "Matched pair of circa 1930 Italian Art Deco lounge chairs in the style of Francis Jourdain, crafted in shellac-polished teak with geometric woven cane backs, ebonized feet, and professionally stabilized joinery preserving authentic period patina (13 in seat height).",
  },
  {
    id: 28,
    title: "Pair of Ebonised Tub Armchairs with Floral Upholstery",
    artist: "French Early 20th Century",
    category: "Furniture",
    price: 2847.22,
    price_display: "$2,847.22",
    size: "29.7 x 22.8 x 20.3 in (Set of 2)",
    image: "/static/images/ebonised-tub-armchairs-1.jpg",
    images: [
      "/static/images/ebonised-tub-armchairs-1.jpg",
      "/static/images/ebonised-tub-armchairs-2.jpg",
      "/static/images/ebonised-tub-armchairs-3.jpg",
      "/static/images/ebonised-tub-armchairs-4.jpg",
      "/static/images/ebonised-tub-armchairs-5.jpg",
      "/static/images/ebonised-tub-armchairs-6.jpg",
    ],
    description:
      "Matched pair of circa 1900 French tub armchairs featuring barrel-shaped backs flowing into carved ebonised wooden frames, curved front legs, and tapered rear legs, upholstered in woven floral tapestry fabric with decorative braid trim (16.9 in seat height).",
  },
  {
    id: 29,
    title: "Danube River, Sebins (Castle on the Danube)",
    artist: "Wenceslaus Hollar",
    category: "Prints",
    price: 300.0,
    price_display: "$300",
    size: "2.4 x 5.4 in (6.1 x 13.7 cm)",
    image: "/static/images/hollar-danube-etching-1.jpg",
    images: [
      "/static/images/hollar-danube-etching-1.jpg",
      "/static/images/hollar-danube-etching-2.jpg",
      "/static/images/hollar-danube-etching-3.jpg",
      "/static/images/hollar-danube-etching-4.jpg",
      "/static/images/hollar-danube-etching-5.jpg",
      "/static/images/hollar-danube-etching-6.jpg",
    ],
    description:
      "Original 17th-century etching (circa 1652–1677) by Wenceslaus Hollar (1607–1677), signed in the plate at lower left. Depicting Sebins Castle overlooking the Danube with a foreground passenger cabin boat; impressions from this series are held in the British Museum and Metropolitan Museum of Art (New Hollstein 2491, Pennington 779, Parthey 1295).",
  },
  {
    id: 30,
    title: "Ancient Bridge Views (Stay)",
    artist: "Stefanie Schneider",
    category: "Photography",
    price: 400.0,
    price_display: "$400",
    size: "7.9 x 7.9 in (20 x 20 cm)",
    image: "/static/images/stefanie-schneider-ancient-bridge-1.jpg",
    images: [
      "/static/images/stefanie-schneider-ancient-bridge-1.jpg",
    ],
    description:
      "2006 archival C-print derived from original Polaroid film by German contemporary photographer Stefanie Schneider, issued in an edition of 5 plus 2 Artist Proofs. Accompanied by certificate and signature label (Inventory #2192, unmounted 20 x 20 cm).",
  },
  {
    id: 31,
    title: "Burlesque Series, Delilah Right Red Hand III (Whoopee Club, London)",
    artist: "Richard Heeps",
    category: "Photography",
    price: 676.26,
    price_display: "$676.26",
    size: "24 x 36.6 in (61 x 93 cm)",
    image: "/static/images/richard-heeps-delilah-1.jpg",
    images: [
      "/static/images/richard-heeps-delilah-1.jpg",
      "/static/images/richard-heeps-delilah-2.jpg",
      "/static/images/richard-heeps-delilah-3.jpg",
      "/static/images/richard-heeps-delilah-4.jpg",
      "/static/images/richard-heeps-delilah-5.jpg",
      "/static/images/richard-heeps-delilah-6.jpg",
    ],
    description:
      "2003 photograph from British photographer Richard Heeps' acclaimed Burlesque Series, captured at London's Whoopee Club. Master-printed from the original negative in his Cambridge darkroom as a limited-edition gloss photographic print of 25, complete with signed and numbered Certificate of Authenticity.",
  },
  {
    id: 32,
    title: "\"The Calm\" — Wild Horses (Black & White)",
    artist: "Shane Russeck",
    category: "Photography",
    price: 520.0,
    price_display: "$520",
    size: "40 x 60 in (101.6 x 152.4 cm)",
    image: "/static/images/shane-russeck-calm-1.jpg",
    images: [
      "/static/images/shane-russeck-calm-1.jpg",
      "/static/images/shane-russeck-calm-2.jpg",
      "/static/images/shane-russeck-calm-3.jpg",
      "/static/images/shane-russeck-calm-4.jpg",
      "/static/images/shane-russeck-calm-5.jpg",
      "/static/images/shane-russeck-calm-6.jpg",
    ],
    description:
      "2018 large-scale monochrome archival pigment photograph of American wild mustangs by Shane Russeck, created during his cross-country Wild Life series. Unsigned open studio print measuring 40 x 60 inches.",
  },
  {
    id: 33,
    title: "Art Deco Patinated Bronze Flamingos (c. 1920s)",
    artist: "Alexandre Kéléty",
    category: "Sculpture",
    price: 5500.0,
    price_display: "$5,500",
    size: "13 x 19 x 2.8 in (33 x 48.3 x 7 cm)",
    image: "/static/images/kelety-bronze-flamingos-1.jpg",
    images: [
      "/static/images/kelety-bronze-flamingos-1.jpg",
      "/static/images/kelety-bronze-flamingos-2.jpg",
      "/static/images/kelety-bronze-flamingos-3.jpg",
      "/static/images/kelety-bronze-flamingos-4.jpg",
      "/static/images/kelety-bronze-flamingos-5.jpg",
    ],
    description:
      "Circa 1920 Art Deco patinated bronze sculpture of graceful flamingos mounted on a dark veined marble plinth by Hungarian-born Parisian sculptor Alexandre Kéléty (1874–1940), signed 'A. Kéléty' on the base.",
  },
  {
    id: 34,
    title: "16th/17th Century Spanish Renaissance Giltwood Angel Frieze Sculpture",
    artist: "Spanish Renaissance School",
    category: "Sculpture",
    price: 1591.76,
    price_display: "$1,591.76",
    size: "7.3 x 14 x 2.8 in (18.5 x 35.5 x 7 cm)",
    image: "/static/images/spanish-giltwood-angel-1.jpg",
    images: [
      "/static/images/spanish-giltwood-angel-1.jpg",
      "/static/images/spanish-giltwood-angel-2.jpg",
      "/static/images/spanish-giltwood-angel-3.jpg",
      "/static/images/spanish-giltwood-angel-4.jpg",
      "/static/images/spanish-giltwood-angel-5.jpg",
      "/static/images/spanish-giltwood-angel-6.jpg",
    ],
    description:
      "Rare circa 1580–1620 Spanish Golden Age hand-carved deep-relief giltwood frieze depicting a central cherub flanked by sweeping festoons and fruit clusters, retaining original polychrome pigments and aged water-gilding on a custom stepped black display stand.",
  },
  {
    id: 35,
    title: "19th-Century English Carved Walnut Barley Twist Bar Cabinet On Stand",
    artist: "English Victorian School",
    category: "Furniture",
    price: 2990.0,
    price_display: "$2,990",
    size: "47.5 x 43.5 x 18.5 in (120.7 x 110.5 x 47 cm)",
    image: "/static/images/english-walnut-cabinet-1.jpg",
    images: [
      "/static/images/english-walnut-cabinet-1.jpg",
      "/static/images/english-walnut-cabinet-2.jpg",
      "/static/images/english-walnut-cabinet-3.jpg",
      "/static/images/english-walnut-cabinet-4.jpg",
      "/static/images/english-walnut-cabinet-5.jpg",
      "/static/images/english-walnut-cabinet-6.jpg",
    ],
    description:
      "Circa 1880 English Jacobean-style carved walnut cabinet resting on a barley twist stand. Detailed with three front doors separated by sculpted caryatids, inlaid mother-of-pearl floral vases, lion masks, and raised paneled joinery suited for collectors' cabinets or luxury bar storage.",
  },
];

const categories: string[] = [
  "Paintings",
  "Prints",
  "Photography",
  "Sculpture",
  "Furniture",
];

type PaymentProviderId = "stripe" | "paypal";
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

interface PaymentProviderOption {
  id: PaymentProviderId;
  name: string;
  subtitle: string;
  configured: boolean;
  requirementsNote: string;
}

function getPaymentProviders(): PaymentProviderOption[] {
  const cfg = getPaymentGatewayConfig();
  return [
    {
      id: "stripe",
      name: "Credit or Debit Card (Stripe)",
      subtitle: "Visa, Mastercard, American Express · Hosted Checkout",
      configured: Boolean(cfg.stripeSecretKey),
      requirementsNote:
        "Pending merchant authorization and server-side STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET configuration.",
    },
    {
      id: "paypal",
      name: "PayPal Business Checkout",
      subtitle: "PayPal Account & Verified Funding · Hosted Approval",
      configured: Boolean(cfg.paypalClientId && cfg.paypalClientSecret),
      requirementsNote:
        "Pending merchant business authorization and server-side PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET configuration.",
    },
  ];
}

function hasMismatchedOrigin(req: Request): boolean {
  const originHeader = String(req.headers.origin || "").trim();
  if (!originHeader) return false;
  const hostHeader = String(
    req.headers["x-forwarded-host"] || req.headers.host || ""
  )
    .split(",")[0]
    .trim()
    .toLowerCase();
  if (!hostHeader) return false;
  try {
    const parsedOrigin = new URL(originHeader);
    return parsedOrigin.host.toLowerCase() !== hostHeader;
  } catch {
    return true;
  }
}

interface CheckoutTokenRecord {
  cid: string;
  createdAt: number;
  status: "open" | "processing" | "completed";
  orderReference?: string;
}

const checkoutIdempotencyStore = new Map<string, CheckoutTokenRecord>();

function issueCheckoutToken(req: Request, cid: string): string {
  const now = Date.now();
  for (const [key, entry] of checkoutIdempotencyStore.entries()) {
    if (now - entry.createdAt > 12 * 60 * 60 * 1000) {
      checkoutIdempotencyStore.delete(key);
    }
  }
  const token = crypto.randomUUID().replace(/-/g, "");
  checkoutIdempotencyStore.set(token, {
    cid,
    createdAt: now,
    status: "open",
  });
  const list = req.session.checkoutTokens ?? [];
  req.session.checkoutTokens = [...list.slice(-9), token];
  return token;
}

function getCheckoutTokenRecord(
  token: string,
  cid: string
): CheckoutTokenRecord | undefined {
  if (!token) return undefined;
  const rec = checkoutIdempotencyStore.get(token);
  if (!rec) return undefined;
  if (rec.cid && cid && rec.cid !== cid) return undefined;
  return rec;
}

const inventoryStore = new InventoryStore();

function getAllProducts(): Product[] {
  return inventoryStore.getAllProducts();
}

function getProductById(productId: string | number): Product | undefined {
  return inventoryStore.getProductById(productId);
}

const curatedProvenanceById: Record<number, ProductProvenance> = {
  4: {
    datePeriod: "Contemporary Original",
    originAttribution: "Studio of Paul Chang",
    materialsMedium: "Layered oil and mixed pigment on stretched canvas",
    markingsEdition: "Unique Original (1 of 1)",
    conditionNote: "Excellent studio condition; surface inspected prior to crating.",
    provenanceRecord: "Acquired directly from the artist's studio · Accompanied by signed ART STUDIO Certificate of Authenticity.",
  },
  5: {
    datePeriod: "Contemporary Edition",
    originAttribution: "Igor Vitomirov · Europe",
    materialsMedium: "Archival pigment fine art photograph on museum paper",
    markingsEdition: "Numbered Studio Edition",
    conditionNote: "Pristine archival condition.",
    provenanceRecord: "Direct studio edition · Accompanied by ART STUDIO Certificate of Authenticity.",
  },
  7: {
    datePeriod: "Contemporary Edition",
    originAttribution: "Emily Kent · North America",
    materialsMedium: "Archival fine art landscape photograph",
    markingsEdition: "Studio Archive Print",
    conditionNote: "Pristine archival condition.",
    provenanceRecord: "Direct studio provenance · Accompanied by ART STUDIO Certificate of Authenticity.",
  },
  8: {
    datePeriod: "Contemporary Original",
    originAttribution: "Studio of Suren Ter-Avakian",
    materialsMedium: "Oil and mineral pigment glazes on stretched canvas",
    markingsEdition: "Unique Original (1 of 1)",
    conditionNote: "Excellent studio condition; rich textured impasto intact.",
    provenanceRecord: "Direct studio acquisition · Accompanied by signed ART STUDIO Certificate of Authenticity.",
  },
  9: {
    datePeriod: "Contemporary Original",
    originAttribution: "Studio of Juan Alvarez",
    materialsMedium: "Oil on stretched canvas",
    markingsEdition: "Unique Original (1 of 1)",
    conditionNote: "Excellent studio condition.",
    provenanceRecord: "Direct studio acquisition · Accompanied by signed ART STUDIO Certificate of Authenticity.",
  },
  10: {
    datePeriod: "Contemporary Edition",
    originAttribution: "Atelier Luc Moreau · France",
    materialsMedium: "Dark patinated cast bronze on architectural plinth",
    markingsEdition: "Foundry Cast · Signed Atelier Edition",
    conditionNote: "Fine even patina across all four silhouettes.",
    provenanceRecord: "Acquired via atelier partnership · Accompanied by ART STUDIO Certificate of Authenticity.",
  },
  11: {
    datePeriod: "Contemporary Original",
    originAttribution: "Gregory Christeas · United States (Parallels Series)",
    materialsMedium: "Metallic and fluorescent acrylics on heavy stretched canvas",
    markingsEdition: "Unique Original · Parallels Series (1 of 1)",
    conditionNote: "Excellent unblemished canvas tension and metallic luster.",
    provenanceRecord: "Direct from the artist's Parallels Series studio archive · Includes signed Certificate of Authenticity.",
  },
  12: {
    datePeriod: "Contemporary Craft Edition",
    originAttribution: "Cozy Art Land Atelier",
    materialsMedium: "Frosted blue-rimmed blown glass, turned natural wood base, warm LED",
    markingsEdition: "Atelier Sculptural Lighting Edition",
    conditionNote: "New atelier condition; electrical hardware tested.",
    provenanceRecord: "Direct atelier sourcing · Accompanied by ART STUDIO Certificate of Authenticity.",
  },
  13: {
    datePeriod: "c. 1958 (Designed 1950)",
    originAttribution: "Hans J. Wegner (1914–2007) · Early Danish Production (Model GE225)",
    materialsMedium: "250m woven flag halyard cord, dark green lacquered & chromed steel frame, original wooden feet, leather headrest, sheepskin throw",
    markingsEdition: "Early 1958 Model GE225 Archival Example",
    conditionNote: "Well-preserved vintage patina on steel lacquer and wooden feet; halyard weave tension inspected and structurally sound.",
    provenanceRecord: "Sourced via vetted European modernist design archive · Full structural & period joinery inspection · Includes ART STUDIO Provenance Dossier & COA.",
  },
  14: {
    datePeriod: "2025",
    originAttribution: "Mary Ogochukwu · Nigeria",
    materialsMedium: "Acrylic on stretched canvas",
    markingsEdition: "Unique Original (1 of 1) · Dated 2025",
    conditionNote: "Excellent studio condition.",
    provenanceRecord: "Direct studio provenance · Accompanied by signed Certificate of Authenticity.",
  },
  15: {
    datePeriod: "1887 (Victorian Sporting Era)",
    originAttribution: "Albert Clark (1843–1928) · London, England",
    materialsMedium: "Oil on canvas in period ornate antique giltwood frame",
    markingsEdition: "Signed and dated '1887' by the artist",
    conditionNote: "Clean surface tension and historic craquelure appropriate to 1887 oil on canvas; antique gilt frame carefully conserved.",
    provenanceRecord: "Acquired from an established British historical sporting art specialist · Documented period attribution · Includes ART STUDIO COA.",
  },
  16: {
    datePeriod: "20th Century Grand Tour Tradition",
    originAttribution: "Italian School · Tuscany / Rome Workshop",
    materialsMedium: "Hand-carved veined white marble on custom black steel display stand",
    markingsEdition: "Unique Hand-Carved Stone Fragment",
    conditionNote: "Authentic weathered surface patina and natural stone veining intact; securely pinned to steel plinth.",
    provenanceRecord: "Vetted European antiquities & sculptural object dealer provenance · Accompanied by ART STUDIO Certificate of Authenticity.",
  },
  17: {
    datePeriod: "Contemporary Edition",
    originAttribution: "Nando Kallweit · Germany",
    materialsMedium: "Lost-wax cast patinated bronze from original carved oak body",
    markingsEdition: "Strictly Limited Edition of 25 · Numbered & Signed",
    conditionNote: "Mint foundry condition retaining tactile carved timber grain.",
    provenanceRecord: "Direct German studio & foundry provenance · Accompanied by numbered Certificate of Authenticity.",
  },
  18: {
    datePeriod: "19th Century (After Sassoferrato)",
    originAttribution: "Italian Old Master School · Rome / Central Italy",
    materialsMedium: "Oil on hand-woven linen canvas on original period stretcher",
    markingsEdition: "Unique 19th-Century Academic Oil Painting",
    conditionNote: "Even age craquelure and deep ultramarine pigment preservation consistent with 19th-century European linen works.",
    provenanceRecord: "Sourced from vetted European Old Master specialist dealer · Period canvas & stretcher verified · Includes ART STUDIO COA.",
  },
  19: {
    datePeriod: "2026",
    originAttribution: "Beth Barry · United States",
    materialsMedium: "Acrylic on stretched canvas",
    markingsEdition: "Unique Original (1 of 1) · 2026",
    conditionNote: "Mint contemporary condition.",
    provenanceRecord: "Acquired with Gallery Sitka provenance · Accompanied by ART STUDIO Certificate of Authenticity.",
  },
  20: {
    datePeriod: "2026",
    originAttribution: "Alex Garant · Canada",
    materialsMedium: "Oil on canvas in bespoke diamond hardwood floater frame",
    markingsEdition: "Unique Original · Signed 2026",
    conditionNote: "Mint exhibition condition.",
    provenanceRecord: "Created for 'Imaginary Menagerie' at Arch Enemy Arts · Full exhibition provenance & signed COA.",
  },
  21: {
    datePeriod: "2026",
    originAttribution: "Shiri Phillips · Contemporary Studio",
    materialsMedium: "Sculptural impasto acrylic on canvas in custom painted mauve frame",
    markingsEdition: "Unique Original · Signed on Frame Edge",
    conditionNote: "Mint exhibition condition; high-relief impasto peaks intact.",
    provenanceRecord: "Acquired with PxP Contemporary provenance · Accompanied by Certificate of Authenticity.",
  },
  22: {
    datePeriod: "2026",
    originAttribution: "Will Klemm · Austin, Texas, USA",
    materialsMedium: "Oil on canvas, custom framed (16 × 16 × 2 in overall)",
    markingsEdition: "Unique Original · Signed Lower Left",
    conditionNote: "Mint gallery condition.",
    provenanceRecord: "Acquired with Wally Workman Gallery provenance · Accompanied by Certificate of Authenticity.",
  },
  23: {
    datePeriod: "Contemporary Atelier",
    originAttribution: "Cobalt Guild · Jingdezhen, China",
    materialsMedium: "High-fired porcelain with hand-painted underglaze cobalt oxide",
    markingsEdition: "Four-Tier Interlocking Studio Porcelain",
    conditionNote: "Clean glaze and intact tubular floral spouts with zero hairlines.",
    provenanceRecord: "Direct Jingdezhen atelier provenance · Accompanied by ART STUDIO Certificate of Authenticity.",
  },
  24: {
    datePeriod: "Contemporary Collectible Design",
    originAttribution: "Studio Bernhardt & Vella · Milan, Italy",
    materialsMedium: "Curved bentwood shell, glossy bronze lacquer swivel plinth, velvet-touch camel upholstery",
    markingsEdition: "Authenticated Milanese Designer Seating",
    conditionNote: "Pristine upholstery and smooth balanced swivel mechanism.",
    provenanceRecord: "Sourced via authorized Italian luxury furniture partner · Accompanied by ART STUDIO Authenticity & Design Dossier.",
  },
  25: {
    datePeriod: "c. 1880 (High Victorian Era)",
    originAttribution: "English Victorian School · England",
    materialsMedium: "Solid hand-carved mahogany frame, olive button-tufted leather, brass nailheads, period brass casters",
    markingsEdition: "Unique 19th-Century Piece · Signed Period Brass Casters",
    conditionNote: "Honest aged patina to original olive leather and rich mahogany surface; turned legs, scrolled arms, and casters structurally sound.",
    provenanceRecord: "Acquired from a vetted British antique furniture dealer · Period timber, leather & caster hallmarks inspected · Includes ART STUDIO Provenance COA.",
  },
  26: {
    datePeriod: "Contemporary Limited Edition",
    originAttribution: "MW Exclusive x Street Artist NEP · Handcrafted in France",
    materialsMedium: "Suspended tempered art glass side panels, HR40 architectural green upholstery, brushed stainless steel joinery",
    markingsEdition: "Signed & Numbered Limited Edition 'Interface(s)'",
    conditionNote: "Gallery mint condition; glass panels and steel hardware inspected.",
    provenanceRecord: "Direct French design house provenance · Accompanied by signed edition Certificate of Authenticity.",
  },
  27: {
    datePeriod: "c. 1930 (Interwar Art Deco)",
    originAttribution: "Style of Francis Jourdain · Northern Italy / France",
    materialsMedium: "Shellac-polished teak framing, geometric woven cane backrests, ebonized feet",
    markingsEdition: "Matched Period Pair (Set of 2)",
    conditionNote: "Professionally stabilized vintage joinery with authentic 1930s shellac patina and taut woven cane panels.",
    provenanceRecord: "Sourced via vetted European Art Deco furniture specialist · Timber and joinery restoration log documented · Includes ART STUDIO COA.",
  },
  28: {
    datePeriod: "c. 1900 (Early 20th Century)",
    originAttribution: "French Atelier · France",
    materialsMedium: "Carved ebonised hardwood frames, woven floral tapestry upholstery, decorative braid trim",
    markingsEdition: "Matched Period Pair (Set of 2)",
    conditionNote: "Sound tapered frame construction with well-preserved ebonised finish and intact tapestry seating.",
    provenanceRecord: "Vetted French antiques trade provenance · Frame & upholstery condition verified · Includes ART STUDIO Provenance COA.",
  },
  29: {
    datePeriod: "c. 1652–1677 (17th Century)",
    originAttribution: "Wenceslaus Hollar (1607–1677) · Prague / Antwerp / London",
    materialsMedium: "Original copperplate etching on laid paper",
    markingsEdition: "Signed in the plate lower left · Cat. Refs: New Hollstein 2491, Pennington 779, Parthey 1295",
    conditionNote: "Crisp 17th-century plate impression on laid paper with strong architectural and riverine line clarity.",
    provenanceRecord: "Vetted Old Master prints dealer provenance · Catalogued against New Hollstein, Pennington & Parthey · Includes ART STUDIO Provenance COA.",
  },
  30: {
    datePeriod: "2006 (Printed from Expired Polaroid Film)",
    originAttribution: "Stefanie Schneider (b. 1968) · Germany / California",
    materialsMedium: "Archival C-print from Polaroid negative (Inventory #2192)",
    markingsEdition: "Limited Edition of 5 + 2 AP · Signed Certificate & Label",
    conditionNote: "Unmounted archival C-print stored flat in acid-free portfolio.",
    provenanceRecord: "Direct artist/gallery archive provenance · Accompanied by signed edition label & Certificate of Authenticity.",
  },
  31: {
    datePeriod: "2003 (Burlesque Series, Whoopee Club, London)",
    originAttribution: "Richard Heeps · Cambridge, England",
    materialsMedium: "Hand-printed gloss wet-darkroom color photograph from original medium-format negative",
    markingsEdition: "Limited Edition of 25 · Signed & Numbered COA",
    conditionNote: "Mint darkroom archival print.",
    provenanceRecord: "Cambridge darkroom studio provenance · Complete with signed & numbered Certificate of Authenticity.",
  },
  32: {
    datePeriod: "2018 (Wild Life Series)",
    originAttribution: "Shane Russeck (b. 1977) · Los Angeles, USA",
    materialsMedium: "Large-scale monochrome archival pigment photograph (40 × 60 in)",
    markingsEdition: "Open Studio Archival Edition (Unsigned)",
    conditionNote: "Pristine unframed exhibition print condition.",
    provenanceRecord: "Direct studio archive print · Accompanied by ART STUDIO Certificate of Authenticity.",
  },
  33: {
    datePeriod: "c. 1920s (French Art Deco)",
    originAttribution: "Alexandre Kéléty (1874–1940) · Budapest / Paris",
    materialsMedium: "Dark patinated cast bronze mounted on veined marble plinth",
    markingsEdition: "Signed 'A. Kéléty' on the bronze base",
    conditionNote: "Original interwar bronze patina intact; marble plinth cleanly preserved with natural mineral veining.",
    provenanceRecord: "Acquired from vetted European Art Deco sculpture specialist · Foundry signature verified · Includes ART STUDIO Provenance COA.",
  },
  34: {
    datePeriod: "c. 1580–1620 (Spanish Golden Age / Siglo de Oro)",
    originAttribution: "Spanish Renaissance Guild Workshop · Castile / Andalusia",
    materialsMedium: "Hand-carved deep-relief hardwood with original polychrome pigments and aged water-gilding on custom black plinth",
    markingsEdition: "Unique 16th/17th-Century Architectural Woodcarving",
    conditionNote: "Remarkable retention of original Renaissance bole, water-gilding, and polychrome surface; stable historic timber mounted on bespoke stand.",
    provenanceRecord: "Vetted European Renaissance sculpture specialist provenance · Conservation mount & material age verified · Includes ART STUDIO COA.",
  },
  35: {
    datePeriod: "c. 1880 (19th-Century Jacobean Revival)",
    originAttribution: "English Victorian School · England",
    materialsMedium: "Carved solid walnut casework, barley twist stand, sculpted caryatid pilasters, mother-of-pearl floral inlay",
    markingsEdition: "Unique 19th-Century Collector's Cabinet",
    conditionNote: "Rich walnut color and historic hand-carved relief detail intact; paneled doors, brass hardware, and barley twist stretchers structurally inspected.",
    provenanceRecord: "Vetted British antique cabinetmaking specialist provenance · Period walnut & mother-of-pearl inlay verified · Includes ART STUDIO Provenance COA.",
  },
};

inventoryStore.initialize(seedProducts, curatedProvenanceById);

function getProductProvenance(product: Product): ProductProvenance {
  return inventoryStore.getProvenance(product);
}

interface StoredCartEntry {
  items: Record<string, number>;
  updatedAt: number;
}

const CART_COOKIE_NAME = "art_studio_cart";
const cartStore = new Map<string, StoredCartEntry>();
const orderStore = new Map<string, Order>();
const orderByReference = new Map<string, Order>();
const pendingOrdersByReference = new Map<string, { order: Order; cid: string; token: string }>();
const flashStore = new Map<string, string[]>();

for (const savedOrder of inventoryStore.getOrders()) {
  orderByReference.set(savedOrder.reference, savedOrder);
}

const MEMPOOL_API_BASE =
  process.env.MEMPOOL_API_BASE || "https://mempool.space/api";

interface MempoolVout {
  scriptpubkey_address?: string;
  value?: number;
}

interface MempoolTx {
  txid: string;
  fee?: number;
  status?: {
    confirmed?: boolean;
    block_height?: number;
    block_time?: number;
  };
  vout?: MempoolVout[];
}

interface BitcoinListenerResult {
  status: "listening" | "partial" | "detected" | "confirmed" | "unavailable";
  address: string;
  mempoolApiUrl: string;
  expectedBtc: string;
  expectedSats: number;
  receivedBtc: string;
  receivedSats: number;
  txid: string | null;
  confirmed: boolean;
  blockHeight: number | null;
  txCount: number;
  checkedAt: string;
  message: string;
}

const mempoolTxCache = new Map<
  string,
  { txs: MempoolTx[]; fetchedAt: number }
>();

const consumedBitcoinTxids = new Map<string, string>(
  Object.entries(inventoryStore.getConsumedTxids())
);

async function fetchMempoolAddressTxs(
  address: string,
  forceRefresh = false
): Promise<{
  ok: boolean;
  txs: MempoolTx[];
  apiUrl: string;
}> {
  const cleanAddress = address.trim();
  const apiUrl = `${MEMPOOL_API_BASE}/address/${encodeURIComponent(cleanAddress)}/txs`;
  const now = Date.now();
  const cached = mempoolTxCache.get(cleanAddress);
  if (!forceRefresh && cached && now - cached.fetchedAt < 4000) {
    return { ok: true, txs: cached.txs, apiUrl };
  }

  try {
    const response = await fetch(apiUrl, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(6000),
    });
    if (!response.ok) {
      return { ok: false, txs: cached?.txs ?? [], apiUrl };
    }
    const parsed = (await response.json()) as unknown;
    const txs = Array.isArray(parsed) ? (parsed as MempoolTx[]) : [];
    mempoolTxCache.set(cleanAddress, { txs, fetchedAt: now });
    return { ok: true, txs, apiUrl };
  } catch {
    return { ok: false, txs: cached?.txs ?? [], apiUrl };
  }
}

async function checkBitcoinPaymentStatus(params: {
  address: string;
  expectedBtc: string | number;
  sinceMs?: number;
  forceRefresh?: boolean;
  orderReference?: string;
}): Promise<BitcoinListenerResult> {
  const address = params.address.trim();
  const expectedNum = Math.max(0, Number(params.expectedBtc) || 0);
  const expectedSats = Math.round(expectedNum * 1e8);
  const minAcceptedSats =
    expectedSats > 0 ? Math.max(1, Math.floor(expectedSats * 0.995)) : 1;
  const checkedAt = new Date().toISOString();

  if (!address) {
    return {
      status: "unavailable",
      address: "",
      mempoolApiUrl: "",
      expectedBtc: expectedNum.toFixed(8),
      expectedSats,
      receivedBtc: "0.00000000",
      receivedSats: 0,
      txid: null,
      confirmed: false,
      blockHeight: null,
      txCount: 0,
      checkedAt,
      message: "No Bitcoin address configured.",
    };
  }

  const { ok, txs, apiUrl } = await fetchMempoolAddressTxs(
    address,
    Boolean(params.forceRefresh)
  );
  if (!ok && txs.length === 0) {
    return {
      status: "unavailable",
      address,
      mempoolApiUrl: apiUrl,
      expectedBtc: expectedNum.toFixed(8),
      expectedSats,
      receivedBtc: "0.00000000",
      receivedSats: 0,
      txid: null,
      confirmed: false,
      blockHeight: null,
      txCount: 0,
      checkedAt,
      message: "Unable to reach Mempool.space right now. Retrying automatically.",
    };
  }

  const cutoffSec = params.sinceMs
    ? Math.floor(params.sinceMs / 1000) - 600
    : 0;

  const matchingTxs = txs
    .filter((tx) => {
      const claimedBy = consumedBitcoinTxids.get(tx.txid);
      return !claimedBy || claimedBy === params.orderReference;
    })
    .map((tx) => {
      const satsToAddr = (tx.vout ?? [])
        .filter((out) => out.scriptpubkey_address === address)
        .reduce((sum, out) => sum + Math.round(Number(out.value) || 0), 0);
      const isConfirmed = Boolean(tx.status?.confirmed);
      const blockTime = Number(tx.status?.block_time || 0);
      const isFresh =
        !cutoffSec || !isConfirmed || !blockTime || blockTime >= cutoffSec;
      return {
        txid: tx.txid,
        satsToAddr,
        isConfirmed,
        blockHeight: tx.status?.block_height ?? null,
        isFresh,
      };
    })
    .filter((entry) => entry.satsToAddr > 0 && entry.isFresh);

  if (matchingTxs.length === 0) {
    return {
      status: "listening",
      address,
      mempoolApiUrl: apiUrl,
      expectedBtc: expectedNum.toFixed(8),
      expectedSats,
      receivedBtc: "0.00000000",
      receivedSats: 0,
      txid: null,
      confirmed: false,
      blockHeight: null,
      txCount: txs.length,
      checkedAt,
      message: "Listening on Mempool.space for incoming BTC transaction...",
    };
  }

  const totalReceivedSats = matchingTxs.reduce(
    (sum, entry) => sum + entry.satsToAddr,
    0
  );
  const sufficientTx =
    matchingTxs.find((entry) => entry.satsToAddr >= minAcceptedSats) ||
    matchingTxs[0];
  const allConfirmed = matchingTxs.every((entry) => entry.isConfirmed);
  const settledSufficiently = totalReceivedSats >= minAcceptedSats;

  let status: BitcoinListenerResult["status"] = "partial";
  let message = `Partial transfer detected (${(totalReceivedSats / 1e8).toFixed(8)} BTC received of ${expectedNum.toFixed(8)} BTC expected).`;

  if (settledSufficiently && (sufficientTx.isConfirmed || allConfirmed)) {
    status = "confirmed";
    message = sufficientTx.blockHeight
      ? `Bitcoin payment confirmed on-chain (Block #${sufficientTx.blockHeight}).`
      : "Bitcoin payment confirmed on-chain.";
  } else if (settledSufficiently) {
    status = "detected";
    message =
      "Incoming Bitcoin transaction detected in Mempool (awaiting block confirmation).";
  }

  return {
    status,
    address,
    mempoolApiUrl: apiUrl,
    expectedBtc: expectedNum.toFixed(8),
    expectedSats,
    receivedBtc: (totalReceivedSats / 1e8).toFixed(8),
    receivedSats: totalReceivedSats,
    txid: sufficientTx.txid,
    confirmed: status === "confirmed",
    blockHeight: sufficientTx.blockHeight,
    txCount: txs.length,
    checkedAt,
    message,
  };
}

function getRequestBaseUrl(req: Request): string {
  const cfg = getPaymentGatewayConfig();
  if (cfg.appBaseUrl) {
    return cfg.appBaseUrl.replace(/\/+$/, "");
  }
  const proto =
    String(req.headers["x-forwarded-proto"] || "").split(",")[0].trim() ||
    (req.secure ? "https" : "http");
  const host =
    String(req.headers["x-forwarded-host"] || req.headers.host || `localhost:${PORT}`)
      .split(",")[0]
      .trim();
  return `${proto}://${host}`;
}

function finalizeVerifiedPaidOrder(
  req: Request,
  res: Response | null,
  order: Order,
  details: { provider: PaymentProviderId; sessionId: string; cid?: string; token?: string }
): Order {
  const existingPaid = orderByReference.get(order.reference);
  if (existingPaid && existingPaid.payment_status === "paid") {
    return existingPaid;
  }

  const nowIso = new Date().toISOString();
  const finalized: Order = {
    ...order,
    payment_status: "paid",
    payment_provider: details.provider,
    payment_provider_label:
      details.provider === "stripe"
        ? "Stripe Hosted Checkout (Verified)"
        : "PayPal Business Checkout (Verified)",
    payment_session_id: details.sessionId,
    verified_at: nowIso,
    order_date: order.order_date || nowIso,
  };

  orderByReference.set(finalized.reference, finalized);
  inventoryStore.saveOrder(finalized);
  inventoryStore.markProductsSold(
    finalized.items.map((item) => item.id),
    finalized.reference
  );

  const cid = details.cid || getRequestCartId(req);
  if (cid) {
    orderStore.set(cid, finalized);
  }
  req.session.order = finalized;

  if (details.token) {
    const rec = checkoutIdempotencyStore.get(details.token);
    if (rec) {
      rec.status = "completed";
      rec.orderReference = finalized.reference;
    }
  }
  pendingOrdersByReference.delete(finalized.reference);

  if (res) {
    saveCart(req, res, {});
  } else if (cid) {
    cartStore.set(cid, { items: {}, updatedAt: Date.now() });
  }

  return finalized;
}

async function createStripeCheckoutSession(params: {
  order: Order;
  baseUrl: string;
  cid: string;
}): Promise<{ ok: boolean; url?: string; sessionId?: string; error?: string }> {
  const { stripeSecretKey } = getPaymentGatewayConfig();
  if (!stripeSecretKey) {
    return { ok: false, error: "Stripe merchant key is not configured." };
  }

  const body = new URLSearchParams();
  body.set("mode", "payment");
  body.set("client_reference_id", params.order.reference);
  body.set("customer_email", params.order.email);
  body.set(
    "success_url",
    `${params.baseUrl}/api/payments/stripe/return?reference=${encodeURIComponent(params.order.reference)}&cid=${encodeURIComponent(params.cid)}&session_id={CHECKOUT_SESSION_ID}`
  );
  body.set(
    "cancel_url",
    `${params.baseUrl}/checkout?cid=${encodeURIComponent(params.cid)}&cancelled=1`
  );
  body.set("metadata[order_reference]", params.order.reference);

  const discountFactor =
    params.order.subtotal > 0 && params.order.discount > 0
      ? Math.max(0, (params.order.subtotal - params.order.discount) / params.order.subtotal)
      : 1;

  params.order.items.forEach((item, idx) => {
    const unitCents = Math.max(1, Math.round(item.price * discountFactor * 100));
    body.set(`line_items[${idx}][price_data][currency]`, "usd");
    body.set(
      `line_items[${idx}][price_data][product_data][name]`,
      `${item.title} (${item.inventory_id})`
    );
    body.set(`line_items[${idx}][price_data][unit_amount]`, String(unitCents));
    body.set(`line_items[${idx}][quantity]`, String(item.quantity));
  });

  if (params.order.shipping > 0) {
    const shipIdx = params.order.items.length;
    body.set(`line_items[${shipIdx}][price_data][currency]`, "usd");
    body.set(
      `line_items[${shipIdx}][price_data][product_data][name]`,
      params.order.shipping_method || "Fine Art Courier Shipping"
    );
    body.set(
      `line_items[${shipIdx}][price_data][unit_amount]`,
      String(Math.round(params.order.shipping * 100))
    );
    body.set(`line_items[${shipIdx}][quantity]`, "1");
  }

  try {
    const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${stripeSecretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
        "Idempotency-Key": `art-studio-${params.order.reference}`,
      },
      body: body.toString(),
      signal: AbortSignal.timeout(10000),
    });
    const data = (await response.json()) as {
      id?: string;
      url?: string;
      error?: { message?: string };
    };
    if (!response.ok || !data?.url || !data?.id) {
      return {
        ok: false,
        error: data?.error?.message || "Unable to initialize Stripe checkout session.",
      };
    }
    return { ok: true, url: data.url, sessionId: data.id };
  } catch {
    return { ok: false, error: "Unable to reach Stripe payment gateway." };
  }
}

async function retrieveStripeCheckoutSession(sessionId: string): Promise<{
  ok: boolean;
  paid?: boolean;
  orderReference?: string;
  amountTotal?: number;
}> {
  const { stripeSecretKey } = getPaymentGatewayConfig();
  if (!stripeSecretKey || !sessionId) return { ok: false };
  try {
    const response = await fetch(
      `https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`,
      {
        headers: { Authorization: `Bearer ${stripeSecretKey}` },
        signal: AbortSignal.timeout(10000),
      }
    );
    if (!response.ok) return { ok: false };
    const data = (await response.json()) as {
      payment_status?: string;
      status?: string;
      amount_total?: number;
      client_reference_id?: string;
      metadata?: { order_reference?: string };
    };
    const paid =
      data.payment_status === "paid" &&
      (data.status === "complete" || !data.status);
    return {
      ok: true,
      paid,
      amountTotal: typeof data.amount_total === "number" ? data.amount_total : undefined,
      orderReference:
        data.metadata?.order_reference || data.client_reference_id || "",
    };
  } catch {
    return { ok: false };
  }
}

function verifyStripeWebhookSignature(
  rawBody: string,
  sigHeader: string,
  webhookSecret: string
): boolean {
  if (!rawBody || !sigHeader || !webhookSecret) return false;
  const parts = sigHeader.split(",").map((p) => p.trim());
  const timestamp = parts.find((p) => p.startsWith("t="))?.slice(2) || "";
  const signatures = parts
    .filter((p) => p.startsWith("v1="))
    .map((p) => p.slice(3));
  if (!timestamp || signatures.length === 0) return false;

  const expected = crypto
    .createHmac("sha256", webhookSecret)
    .update(`${timestamp}.${rawBody}`)
    .digest("hex");
  const expectedBuf = Buffer.from(expected, "utf8");
  return signatures.some((sig) => {
    const sigBuf = Buffer.from(sig, "utf8");
    return (
      sigBuf.length === expectedBuf.length &&
      crypto.timingSafeEqual(sigBuf, expectedBuf)
    );
  });
}

function getPayPalApiBase(): string {
  return getPaymentGatewayConfig().paypalMode === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";
}

async function getPayPalAccessToken(): Promise<string | null> {
  const { paypalClientId, paypalClientSecret } = getPaymentGatewayConfig();
  if (!paypalClientId || !paypalClientSecret) return null;
  const auth = Buffer.from(`${paypalClientId}:${paypalClientSecret}`).toString(
    "base64"
  );
  try {
    const res = await fetch(`${getPayPalApiBase()}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { access_token?: string };
    return data.access_token || null;
  } catch {
    return null;
  }
}

async function createPayPalOrder(params: {
  order: Order;
  baseUrl: string;
  cid: string;
}): Promise<{ ok: boolean; approveUrl?: string; paypalOrderId?: string; error?: string }> {
  const token = await getPayPalAccessToken();
  if (!token) {
    return { ok: false, error: "PayPal merchant credentials are not configured." };
  }
  try {
    const res = await fetch(`${getPayPalApiBase()}/v2/checkout/orders`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "PayPal-Request-Id": `art-studio-${params.order.reference}`,
      },
      body: JSON.stringify({
        intent: "CAPTURE",
        purchase_units: [
          {
            reference_id: params.order.reference,
            custom_id: params.order.reference,
            amount: {
              currency_code: "USD",
              value: params.order.total.toFixed(2),
            },
          },
        ],
        payment_source: {
          paypal: {
            experience_context: {
              brand_name: "ART STUDIO",
              user_action: "PAY_NOW",
              return_url: `${params.baseUrl}/api/payments/paypal/return?reference=${encodeURIComponent(params.order.reference)}&cid=${encodeURIComponent(params.cid)}`,
              cancel_url: `${params.baseUrl}/checkout?cid=${encodeURIComponent(params.cid)}&cancelled=1`,
            },
          },
        },
      }),
      signal: AbortSignal.timeout(10000),
    });
    const data = (await res.json()) as {
      id?: string;
      links?: Array<{ rel?: string; href?: string }>;
      message?: string;
    };
    const approveLink = data.links?.find(
      (l) => l.rel === "payer-action" || l.rel === "approve"
    )?.href;
    if (!res.ok || !data.id || !approveLink) {
      return {
        ok: false,
        error: data?.message || "Unable to initialize PayPal checkout order.",
      };
    }
    return { ok: true, approveUrl: approveLink, paypalOrderId: data.id };
  } catch {
    return { ok: false, error: "Unable to reach PayPal gateway." };
  }
}

async function capturePayPalOrder(paypalOrderId: string): Promise<{
  ok: boolean;
  completed?: boolean;
}> {
  const token = await getPayPalAccessToken();
  if (!token || !paypalOrderId) return { ok: false };
  try {
    const res = await fetch(
      `${getPayPalApiBase()}/v2/checkout/orders/${encodeURIComponent(paypalOrderId)}/capture`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        signal: AbortSignal.timeout(10000),
      }
    );
    if (!res.ok) return { ok: false };
    const data = (await res.json()) as { status?: string };
    return { ok: true, completed: data.status === "COMPLETED" };
  } catch {
    return { ok: false };
  }
}

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

const FREE_SHIPPING_THRESHOLD = 1500;
const STANDARD_COURIER_FEE = 65;

type ShippingOptionId = "standard_insured" | "priority_air";

interface ShippingOptionItem {
  id: ShippingOptionId;
  title: string;
  description: string;
  cratingWindow: string;
  transitWindow: string;
  estimatedDelivery: string;
  fee: number;
  badgeText: string;
}

interface ShippingDetails {
  subtotal: number;
  discount: number;
  discountedSubtotal: number;
  shipping: number;
  tax: number;
  taxNote: string;
  total: number;
  freeShippingThreshold: number;
  amountForFreeShipping: number;
  qualifiesForFreeShipping: boolean;
  hasFurniture: boolean;
  hasSculpture: boolean;
  isInternational: boolean;
  country: string;
  shippingOption: ShippingOptionId;
  shippingOptions: ShippingOptionItem[];
  methodTitle: string;
  methodDescription: string;
  cratingWindow: string;
  transitWindow: string;
  estimatedDelivery: string;
  customsNotice: string;
  tierLabel: string;
}

function isDomesticCountry(country?: string): boolean {
  const normalized = String(country ?? "")
    .trim()
    .toLowerCase()
    .replace(/[.,]/g, "");
  if (!normalized) return true;
  return (
    normalized === "united states" ||
    normalized === "united states of america" ||
    normalized === "usa" ||
    normalized === "us"
  );
}

function normalizeShippingOption(raw?: string): ShippingOptionId {
  return String(raw ?? "").trim().toLowerCase() === "priority_air"
    ? "priority_air"
    : "standard_insured";
}

function calculateShippingDetails(
  cartItems: CartItem[],
  options?: { country?: string; discount?: number; shippingOption?: string }
): ShippingDetails {
  const subtotal = Number(
    cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0).toFixed(2)
  );
  const discount = Math.max(0, Number((options?.discount ?? 0).toFixed(2)));
  const discountedSubtotal = Number(Math.max(0, subtotal - discount).toFixed(2));
  const country = String(options?.country ?? "").trim();
  const isInternational = Boolean(country) && !isDomesticCountry(country);
  const hasFurniture = cartItems.some(
    (item) => item.category.toLowerCase() === "furniture"
  );
  const hasSculpture = cartItems.some(
    (item) => item.category.toLowerCase() === "sculpture"
  );
  const qualifiesForFreeShipping = subtotal >= FREE_SHIPPING_THRESHOLD;
  const standardFee =
    subtotal <= 0 ? 0.0 : qualifiesForFreeShipping ? 0.0 : STANDARD_COURIER_FEE;

  let standardTitle = "Insured Fine Art Courier Delivery";
  let standardDesc =
    "Custom-crated artwork handling via dedicated art courier with declared-value transit coverage and signature verification upon arrival.";
  let standardCrating = "2–4 business days archival crating";
  let standardTransit = "4–8 business days courier transit";
  let standardEstimate = "6–12 business days";

  let priorityTitle = "Priority Express Fine Art Courier";
  let priorityDesc =
    "Expedited archival crating and priority scheduled courier routing with direct signature release.";
  let priorityCrating = "1–2 business days priority crating";
  let priorityTransit = "2–3 business days express courier";
  let priorityEstimate = "3–5 business days";
  const priorityFee = subtotal <= 0 ? 0.0 : hasFurniture ? 195.0 : 125.0;

  if (hasFurniture && isInternational) {
    standardTitle = "International White-Glove Furniture Freight (Insured)";
    standardDesc =
      "ISPM-15 heat-treated custom timber crating and blanket-wrapped white-glove freight via specialist fine art carrier with export customs documentation and room-of-choice placement.";
    standardCrating = "3–5 business days ISPM-15 timber crating";
    standardTransit = "10–18 business days international freight";
    standardEstimate = "13–23 business days";

    priorityTitle = "Priority Air Crated Furniture Dispatch";
    priorityDesc =
      "Expedited ISPM-15 export crating and dedicated air freight routing with priority customs brokerage and scheduled inside delivery.";
    priorityCrating = "2–3 business days expedited crating";
    priorityTransit = "5–9 business days priority air freight";
    priorityEstimate = "7–12 business days";
  } else if (hasFurniture) {
    standardTitle = "White-Glove Furniture Delivery (Insured)";
    standardDesc =
      "Blanket-wrapped, custom-crated white-glove carrier delivery inside your room of choice with scheduled appointment and signature verification.";
    standardCrating = "3–5 business days custom crating";
    standardTransit = "5–10 business days domestic freight";
    standardEstimate = "8–15 business days";

    priorityTitle = "Expedited Dedicated White-Glove Courier";
    priorityDesc =
      "Priority crating and direct two-person dedicated climate-controlled van transport with scheduled room placement.";
    priorityCrating = "1–3 business days expedited crating";
    priorityTransit = "3–5 business days direct courier";
    priorityEstimate = "4–8 business days";
  } else if (isInternational && hasSculpture) {
    standardTitle = "International Insured Sculpture Courier";
    standardDesc =
      "Custom foam-cavity timber crating via international specialist art air courier with airway bill tracking and export customs paperwork.";
    standardCrating = "3–5 business days custom crating";
    standardTransit = "7–14 business days international air transit";
    standardEstimate = "10–19 business days";

    priorityTitle = "Priority Air Sculpture Express";
    priorityDesc =
      "Expedited foam-cavity timber crating with priority air cargo uplift and dedicated customs clearance coordination.";
    priorityCrating = "1–2 business days priority crating";
    priorityTransit = "3–5 business days priority air transit";
    priorityEstimate = "4–7 business days";
  } else if (isInternational) {
    standardTitle = "International Paintings & Prints Air Courier (Insured)";
    standardDesc =
      "Archival acid-free glassine wrapping inside rigid museum flat-pack or telescoping art cases via air courier with export customs paperwork.";
    standardCrating = "2–4 business days museum flat-packing";
    standardTransit = "5–10 business days international air";
    standardEstimate = "7–14 business days";

    priorityTitle = "Priority Air Museum Courier";
    priorityDesc =
      "Immediate archival flat-packing and priority international express air shuttle with full tracking and direct signature release.";
    priorityCrating = "1–2 business days priority flat-packing";
    priorityTransit = "3–5 business days express air";
    priorityEstimate = "4–7 business days";
  } else if (hasSculpture) {
    standardTitle = "Insured Fine Art & Sculpture Courier";
    standardDesc =
      "Custom foam-cavity crated handling via dedicated art courier with declared-value coverage and signature verification upon arrival.";
    standardCrating = "3–5 business days archival crating";
    standardTransit = "4–9 business days courier transit";
    standardEstimate = "7–14 business days";
  }

  const shippingOptions: ShippingOptionItem[] = [
    {
      id: "standard_insured",
      title: standardTitle,
      description: standardDesc,
      cratingWindow: standardCrating,
      transitWindow: standardTransit,
      estimatedDelivery: standardEstimate,
      fee: standardFee,
      badgeText: qualifiesForFreeShipping
        ? "Complimentary $1,500+"
        : "Standard Insured",
    },
    {
      id: "priority_air",
      title: priorityTitle,
      description: priorityDesc,
      cratingWindow: priorityCrating,
      transitWindow: priorityTransit,
      estimatedDelivery: priorityEstimate,
      fee: priorityFee,
      badgeText: "Expedited Air Dispatch",
    },
  ];

  const shippingOption = normalizeShippingOption(options?.shippingOption);
  const selectedOption =
    shippingOptions.find((opt) => opt.id === shippingOption) ||
    shippingOptions[0];
  const shipping = selectedOption.fee;

  const tax = 0.0;
  const taxNote = isInternational
    ? "Destination import duties & VAT collected locally by customs carrier if applicable"
    : "No gallery surcharge; applicable taxes assessed at final settlement";

  const customsNotice = isInternational
    ? "International shipments include export commercial invoices and fine art customs paperwork. Any local import duties, VAT, or destination customs clearance fees are determined by local authorities and settled by the recipient."
    : "Domestic courier dispatch includes full crating and scheduled signature confirmation upon arrival.";

  const total = Number((discountedSubtotal + shipping + tax).toFixed(2));
  const amountForFreeShipping =
    qualifiesForFreeShipping || subtotal <= 0
      ? 0
      : Number((FREE_SHIPPING_THRESHOLD - subtotal).toFixed(2));

  const tierLabel =
    selectedOption.id === "priority_air"
      ? `Expedited ($${formatCurrency(selectedOption.fee)})`
      : qualifiesForFreeShipping
      ? "Complimentary ($1,500+)"
      : "Standard Insured ($65.00)";

  return {
    subtotal,
    discount,
    discountedSubtotal,
    shipping,
    tax,
    taxNote,
    total,
    freeShippingThreshold: FREE_SHIPPING_THRESHOLD,
    amountForFreeShipping,
    qualifiesForFreeShipping,
    hasFurniture,
    hasSculpture,
    isInternational,
    country,
    shippingOption: selectedOption.id,
    shippingOptions,
    methodTitle: selectedOption.title,
    methodDescription: selectedOption.description,
    cratingWindow: selectedOption.cratingWindow,
    transitWindow: selectedOption.transitWindow,
    estimatedDelivery: selectedOption.estimatedDelivery,
    customsNotice,
    tierLabel,
  };
}

function calculateTotals(cartItems: CartItem[]): {
  subtotal: number;
  shipping: number;
  tax: number;
  total: number;
} {
  const details = calculateShippingDetails(cartItems);
  return {
    subtotal: details.subtotal,
    shipping: details.shipping,
    tax: details.tax,
    total: details.total,
  };
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
app.use(
  express.json({
    verify: (req, _res, buf) => {
      (req as Request & { rawBody?: string }).rawBody = buf.toString("utf8");
    },
  })
);

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
  res.locals.getArtistSlug = getArtistSlug;
  res.locals.primaryNavLinks = [
    { key: "All", label: "Shop All", href: "/" },
    { key: "Painting", label: "Paintings", href: "/?category=Painting" },
    { key: "Prints", label: "Prints", href: "/?category=Prints" },
    { key: "Photography", label: "Photography", href: "/?category=Photography" },
    { key: "Sculpture", label: "Sculpture", href: "/?category=Sculpture" },
    { key: "Furniture", label: "Furniture", href: "/?category=Furniture" },
    { key: "Artists", label: "Artists", href: "/artists" },
  ];
  res.locals.activeNav = "";
  next();
});

app.get(["/", "/shop"], (req: Request, res: Response) => {
  const categoryFilter = String(req.query.category ?? "").trim();
  const artistFilter = String(req.query.artist ?? "").trim();
  const catalog = getAllProducts();
  let filtered = catalog;
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
  const activeCategory = categoryFilter || "All";
  res.render("index", {
    categories,
    products: filtered,
    all_products: catalog,
    featured_collection: [],
    active_category: activeCategory,
    active_artist: artistFilter || "All",
    activeNav: activeCategory,
  });
});

app.get("/api/cart", async (req: Request, res: Response) => {
  const cid = getRequestCartId(req) ?? "";
  const cartItems = getCartItems(req);
  const country = String(req.query.country ?? "").trim();
  const shippingOption = String(req.query.shipping_option ?? "").trim();
  const rawPromo = String(req.query.promo_code ?? "").trim().toUpperCase();
  const baseTotals = calculateTotals(cartItems);
  const promoApplied = rawPromo === "ART10" || rawPromo === "COLLECTOR10";
  const discount = promoApplied ? Number((baseTotals.subtotal * 0.1).toFixed(2)) : 0;
  const details = calculateShippingDetails(cartItems, {
    country,
    discount,
    shippingOption,
  });
  const prices = await getCryptoPrices();
  const cryptoQuotes = {
    bitcoin: calculateCryptoAmount(details.total, prices.bitcoin, 8),
    ethereum: calculateCryptoAmount(details.total, prices.ethereum, 6),
    solana: calculateCryptoAmount(details.total, prices.solana, 4),
  };
  res.setHeader("Cache-Control", "no-store");
  res.json({
    cid,
    cart_count: getCartCount(req),
    items: cartItems,
    subtotal: details.subtotal,
    discount: details.discount,
    shipping: details.shipping,
    tax: details.tax,
    total: details.total,
    shipping_details: details,
    crypto_quotes: cryptoQuotes,
    crypto_prices: prices,
  });
});

app.post("/api/cart/update", (req: Request, res: Response) => {
  if (hasMismatchedOrigin(req)) {
    res.status(403).json({ ok: false, error: "Invalid request origin." });
    return;
  }
  const productId = String(req.body?.product_id ?? "").trim();
  const parsed = Number.parseInt(String(req.body?.quantity ?? "1"), 10);
  const quantity = Number.isNaN(parsed) ? 1 : parsed;
  const currentCart = getCart(req);

  if (quantity <= 0) {
    delete currentCart[productId];
  } else if (quantity <= 20 && getProductById(productId)) {
    currentCart[productId] = quantity;
  } else {
    res.status(400).json({
      ok: false,
      error: "Please choose a quantity between 1 and 20.",
    });
    return;
  }

  const cid = saveCart(req, res, currentCart);
  const cartItems = getCartItems(req);
  const details = calculateShippingDetails(cartItems);
  res.setHeader("Cache-Control", "no-store");
  res.json({
    ok: true,
    cid,
    cart_count: getCartCount(req),
    items: cartItems,
    subtotal: details.subtotal,
    discount: details.discount,
    shipping: details.shipping,
    tax: details.tax,
    total: details.total,
    shipping_details: details,
  });
});

app.post("/api/cart/remove", (req: Request, res: Response) => {
  if (hasMismatchedOrigin(req)) {
    res.status(403).json({ ok: false, error: "Invalid request origin." });
    return;
  }
  const productId = String(req.body?.product_id ?? "").trim();
  const currentCart = getCart(req);
  delete currentCart[productId];
  const cid = saveCart(req, res, currentCart);
  const cartItems = getCartItems(req);
  const details = calculateShippingDetails(cartItems);
  res.setHeader("Cache-Control", "no-store");
  res.json({
    ok: true,
    cid,
    cart_count: getCartCount(req),
    items: cartItems,
    subtotal: details.subtotal,
    discount: details.discount,
    shipping: details.shipping,
    tax: details.tax,
    total: details.total,
    shipping_details: details,
  });
});

app.get("/product/:product_id", (req: Request, res: Response) => {
  const rawId = String(req.params.product_id ?? "").trim();
  const isNumericId = /^\d+$/.test(rawId);
  const isInventoryId = /^AS-[A-Z]{2}-\d{4}-\d+$/i.test(rawId);
  if (!isNumericId && !isInventoryId) {
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
    provenance: getProductProvenance(product),
    activeNav: product.category,
    messages: consumeFlashes(req),
  });
});

app.get("/certificate/:identifier", (req: Request, res: Response) => {
  const identifier = String(req.params.identifier ?? "").trim();
  const product = getProductById(identifier);
  if (!product) {
    res.status(404).send("Artwork certificate record not found.");
    return;
  }
  res.render("certificate", {
    product,
    provenance: getProductProvenance(product),
    categoryCode: getCategoryCode(product.category),
    activeNav: "",
  });
});

app.get("/crypto-checkout", async (req: Request, res: Response) => {
  const cartItems = getCartItems(req);
  const shippingDetails = calculateShippingDetails(cartItems);
  const prices = await getCryptoPrices();
  const cryptoOptions = await buildCryptoOptions(shippingDetails.total, prices);
  res.render("crypto_checkout", {
    cart_items: cartItems,
    shipping_details: shippingDetails,
    crypto_options: cryptoOptions,
    prices,
    activeNav: "",
  });
});

app.get("/search", (req: Request, res: Response) => {
  const query = String(req.query.q ?? "").trim();
  if (!query) {
    res.redirect("/");
    return;
  }
  const results = inventoryStore.searchProducts(query);
  res.render("index", {
    categories,
    products: results,
    all_products: getAllProducts(),
    featured_collection: [],
    search_query: query,
    active_category: "All",
    active_artist: "All",
    activeNav: "All",
  });
});

app.get("/cart", (req: Request, res: Response) => {
  const cartItems = getCartItems(req);
  const shippingDetails = calculateShippingDetails(cartItems);
  res.render("cart", {
    cart_items: cartItems,
    subtotal: shippingDetails.subtotal,
    shipping: shippingDetails.shipping,
    total: shippingDetails.total,
    shipping_details: shippingDetails,
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
  if (product.status === "sold") {
    pushFlash(
      req,
      `${product.title} (${product.inventory_id}) has been acquired and is preserved in our sold archive.`
    );
    redirectWithSession(req, res, `/product/${product.id}`, cid);
    return;
  }

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
    pushFlash(req, "Your shopping bag is empty.");
    redirectWithSession(req, res, "/cart");
    return;
  }

  if (!req.session.btcCheckoutStartedAt) {
    req.session.btcCheckoutStartedAt = Date.now();
  }

  const cid = ensureCartId(req);
  const checkoutToken = issueCheckoutToken(req, cid);
  const shippingDetails = calculateShippingDetails(cartItems);
  const prices = await getCryptoPrices();
  const cryptoOptions = await buildCryptoOptions(shippingDetails.total, prices);

  const requestedMethod = String(req.query.method ?? "").trim().toLowerCase();
  const initialMethod =
    requestedMethod === "bitcoin" ||
    requestedMethod === "ethereum" ||
    requestedMethod === "solana" ||
    requestedMethod === "stripe" ||
    requestedMethod === "paypal"
      ? requestedMethod
      : requestedMethod === "card"
      ? "stripe"
      : "bitcoin";

  const messages = consumeFlashes(req);
  if (String(req.query.cancelled ?? "") === "1") {
    messages.push(
      "Payment authorization was cancelled before completion. No charge was made and your bag remains intact."
    );
  }

  req.session.save(() => {
    res.render("checkout", {
      cart_items: cartItems,
      subtotal: shippingDetails.subtotal,
      discount: 0,
      promo_code: "",
      shipping: shippingDetails.shipping,
      tax: shippingDetails.tax,
      total: shippingDetails.total,
      shipping_details: shippingDetails,
      shipping_option: shippingDetails.shippingOption,
      payment_providers: getPaymentProviders(),
      crypto_options: cryptoOptions,
      selected_method: initialMethod,
      selected_provider: initialMethod,
      checkout_token: checkoutToken,
      active_step: 1,
      btc_notice: null,
      form_values: {
        name: "",
        email: "",
        phone: "",
        country: "",
        state: "",
        city: "",
        zip_code: "",
        address: "",
        apartment: "",
        delivery_instructions: "",
        review_confirmed: false,
      },
      messages,
    });
  });
});

app.post("/checkout", async (req: Request, res: Response) => {
  if (hasMismatchedOrigin(req)) {
    res.status(403).send("Invalid request origin.");
    return;
  }

  const cartItems = getCartItems(req);
  const cid = ensureCartId(req);
  if (cartItems.length === 0) {
    pushFlash(req, "Your shopping bag is empty.");
    redirectWithSession(req, res, "/cart", cid);
    return;
  }

  const submittedToken = String(req.body.checkout_token ?? "").trim();
  const tokenRecord = getCheckoutTokenRecord(submittedToken, cid);

  const name = String(req.body.name ?? "").trim();
  const email = String(req.body.email ?? "").trim();
  const phone = String(req.body.phone ?? "").trim();
  const country = String(req.body.country ?? "").trim();
  const state = String(req.body.state ?? "").trim();
  const city = String(req.body.city ?? "").trim();
  const zipCode = String(req.body.zip_code ?? "").trim();
  const address = String(req.body.address ?? "").trim();
  const apartment = String(req.body.apartment ?? "").trim();
  const deliveryInstructions = String(req.body.delivery_instructions ?? "")
    .trim()
    .slice(0, 400);
  const shippingOption = normalizeShippingOption(
    String(req.body.shipping_option ?? "standard_insured")
  );
  const reviewConfirmed =
    String(req.body.review_confirmed ?? "") === "1" ||
    String(req.body.review_confirmed ?? "") === "true";

  const rawMethod = String(
    req.body.payment_method || req.body.payment_provider || "bitcoin"
  )
    .trim()
    .toLowerCase();
  const normalizedMethod = rawMethod === "card" ? "stripe" : rawMethod;
  const isCryptoMethod =
    normalizedMethod === "bitcoin" ||
    normalizedMethod === "ethereum" ||
    normalizedMethod === "solana";
  const isGatewayMethod =
    normalizedMethod === "stripe" || normalizedMethod === "paypal";

  const baseTotals = calculateTotals(cartItems);
  const rawPromo = String(req.body.promo_code ?? "").trim().toUpperCase();
  const promoApplied = rawPromo === "ART10" || rawPromo === "COLLECTOR10";
  const discount = promoApplied
    ? Number((baseTotals.subtotal * 0.1).toFixed(2))
    : 0;
  const shippingDetails = calculateShippingDetails(cartItems, {
    country,
    discount,
    shippingOption,
  });
  const providers = getPaymentProviders();
  const prices = await getCryptoPrices();
  const cryptoOptions = await buildCryptoOptions(shippingDetails.total, prices);

  const formValues = {
    name,
    email,
    phone,
    country,
    state,
    city,
    zip_code: zipCode,
    address,
    apartment,
    delivery_instructions: deliveryInstructions,
    review_confirmed: reviewConfirmed,
  };

  const renderAtStep = (
    step: number,
    errorMessages: string[],
    opts?: {
      tokenToUse?: string;
      btcNotice?: { title: string; body: string; amount?: string; address?: string } | null;
    }
  ) => {
    const freshToken = opts?.tokenToUse || issueCheckoutToken(req, cid);
    req.session.save(() => {
      res.render("checkout", {
        cart_items: cartItems,
        subtotal: baseTotals.subtotal,
        discount,
        promo_code: promoApplied ? rawPromo : "",
        shipping: shippingDetails.shipping,
        tax: shippingDetails.tax,
        total: shippingDetails.total,
        shipping_details: shippingDetails,
        shipping_option: shippingOption,
        payment_providers: providers,
        crypto_options: cryptoOptions,
        selected_method: normalizedMethod,
        selected_provider: normalizedMethod,
        checkout_token: freshToken,
        active_step: step,
        btc_notice: opts?.btcNotice ?? null,
        form_values: formValues,
        messages: errorMessages,
      });
    });
  };

  if (!tokenRecord) {
    renderAtStep(5, [
      "Your checkout session token expired or was already used. Please review your details and submit once.",
    ]);
    return;
  }

  if (tokenRecord.status === "processing") {
    renderAtStep(
      5,
      [
        "A submission for this checkout session is already being processed. Please wait rather than submitting twice.",
      ],
      { tokenToUse: submittedToken }
    );
    return;
  }

  if (tokenRecord.status === "completed" && tokenRecord.orderReference) {
    const existing = orderByReference.get(tokenRecord.orderReference);
    if (
      existing &&
      (existing.payment_status === "paid" ||
        existing.payment_status === "confirmed" ||
        existing.payment_status === "mempool")
    ) {
      redirectWithSession(
        req,
        res,
        `/checkout-success?reference=${encodeURIComponent(existing.reference)}`,
        cid
      );
      return;
    }
    renderAtStep(5, [
      "This checkout submission was already finalized. Please review your updated bag before starting another checkout.",
    ]);
    return;
  }

  const soldItems = cartItems.filter((item) => {
    const latest = getProductById(item.id);
    return !latest || latest.status === "sold";
  });
  if (soldItems.length > 0) {
    renderAtStep(4, [
      `The artwork "${soldItems[0].title}" (${soldItems[0].inventory_id}) is no longer available. Please remove it from your bag before continuing.`,
    ]);
    return;
  }

  const phoneDigits = phone.replace(/\D/g, "");
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);

  if (name.length < 2 || !emailValid || phoneDigits.length < 7) {
    renderAtStep(1, [
      "Step 1 (Customer Information): Please enter your full name, a valid email address, and a valid phone number.",
    ]);
    return;
  }

  if (
    country.length < 2 ||
    state.length < 2 ||
    city.length < 2 ||
    zipCode.length < 2 ||
    address.length < 4
  ) {
    renderAtStep(2, [
      "Step 2 (Delivery Information): Please complete country, state or region, city, postal code, and street address.",
    ]);
    return;
  }

  if (!reviewConfirmed) {
    renderAtStep(4, [
      "Step 4 (Order Review): Please confirm that you have reviewed your selected works, shipping method, and delivery address before proceeding to payment.",
    ]);
    return;
  }

  if (!isCryptoMethod && !isGatewayMethod) {
    renderAtStep(5, [
      "Step 5 (Payment): Please select a payment method (BTC, ETH, SOL, Card via Stripe, or PayPal).",
    ]);
    return;
  }

  // Handle Direct Cryptocurrency Settlement (BTC with Mempool Listener, ETH, SOL)
  if (isCryptoMethod) {
    const selectedCrypto = cryptoOptions[normalizedMethod as CryptoMethodKey];
    if (!selectedCrypto.walletAddress) {
      renderAtStep(5, [
        `${selectedCrypto.label} (${selectedCrypto.symbol}) wallet address is not configured yet.`,
      ]);
      return;
    }

    let verifiedBtcStatus: BitcoinListenerResult | null = null;
    if (selectedCrypto.key === "bitcoin") {
      verifiedBtcStatus = await checkBitcoinPaymentStatus({
        address: selectedCrypto.walletAddress,
        expectedBtc: selectedCrypto.amount,
        sinceMs: req.session.btcCheckoutStartedAt || Date.now(),
        forceRefresh: true,
      });

      if (
        verifiedBtcStatus.status !== "detected" &&
        verifiedBtcStatus.status !== "confirmed"
      ) {
        let btcNotice: {
          title: string;
          body: string;
          amount?: string;
          address?: string;
        };
        if (verifiedBtcStatus.status === "partial") {
          btcNotice = {
            title: "Partial Bitcoin Transfer Received",
            body: `We detected ${verifiedBtcStatus.receivedBtc} BTC so far. Please send the remaining balance below — your order confirmation slip will appear automatically once full payment arrives.`,
            amount: selectedCrypto.amount,
            address: selectedCrypto.walletAddress,
          };
        } else if (verifiedBtcStatus.status === "unavailable") {
          btcNotice = {
            title: "Verifying Network Connection",
            body: "Unable to reach Mempool.space at this moment. Please wait a few seconds and try again.",
          };
        } else {
          btcNotice = {
            title: "Awaiting Your Bitcoin Transfer",
            body: "No Bitcoin transfer has been detected yet. Please send the exact amount shown below — your order confirmation slip will appear automatically once your transfer is confirmed.",
            amount: selectedCrypto.amount,
            address: selectedCrypto.walletAddress,
          };
        }
        renderAtStep(5, [], { btcNotice });
        return;
      }
    }

    tokenRecord.status = "completed";
    const nowIso = new Date().toISOString();
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
      delivery_instructions: deliveryInstructions,
      payment_method: selectedCrypto.key,
      payment_symbol: selectedCrypto.symbol,
      payment_network: selectedCrypto.network,
      payment_provider: selectedCrypto.key,
      payment_provider_label: `${selectedCrypto.label} (${selectedCrypto.symbol})`,
      crypto_amount: selectedCrypto.amount,
      wallet_address: selectedCrypto.walletAddress,
      qr_svg: selectedCrypto.qrSvg,
      payment_status: "pending",
      created_at_ms: Date.now(),
      order_date: nowIso,
      subtotal: baseTotals.subtotal,
      discount,
      shipping: shippingDetails.shipping,
      tax: shippingDetails.tax,
      tax_note: shippingDetails.taxNote,
      shipping_option: shippingDetails.shippingOption,
      shipping_method: shippingDetails.methodTitle,
      shipping_tier: shippingDetails.tierLabel,
      estimated_delivery: shippingDetails.estimatedDelivery,
      is_international: shippingDetails.isInternational,
      has_furniture: shippingDetails.hasFurniture,
      total: shippingDetails.total,
      items: cartItems.map((item) => ({
        id: item.id,
        inventory_id: item.inventory_id,
        title: item.title,
        artist: item.artist,
        category: item.category,
        price: item.price,
        size: item.size,
        image: item.image,
        quantity: item.quantity,
      })),
    };

    if (verifiedBtcStatus) {
      order.payment_status =
        verifiedBtcStatus.status === "confirmed" ? "confirmed" : "mempool";
      order.verified_at = nowIso;
      if (verifiedBtcStatus.txid) {
        order.payment_txid = verifiedBtcStatus.txid;
        order.payment_received_btc = verifiedBtcStatus.receivedBtc;
        consumedBitcoinTxids.set(verifiedBtcStatus.txid, order.reference);
        inventoryStore.recordConsumedTxid(verifiedBtcStatus.txid, order.reference);
        if (verifiedBtcStatus.blockHeight) {
          order.payment_block_height = verifiedBtcStatus.blockHeight;
        }
      }
      req.session.btcCheckoutStartedAt = undefined;
    }

    tokenRecord.orderReference = order.reference;
    req.session.order = order;
    orderStore.set(cid, order);
    orderByReference.set(order.reference, order);
    inventoryStore.saveOrder(order);
    inventoryStore.markProductsSold(
      cartItems.map((item) => item.id),
      order.reference
    );
    saveCart(req, res, {});
    redirectWithSession(
      req,
      res,
      `/checkout-success?reference=${encodeURIComponent(order.reference)}`,
      cid
    );
    return;
  }

  // Handle Hosted Payment Gateways (Stripe / PayPal)
  const selectedProviderId = normalizedMethod as PaymentProviderId;
  const chosenProvider = providers.find((p) => p.id === selectedProviderId)!;
  if (!chosenProvider.configured) {
    renderAtStep(5, [
      `${chosenProvider.name} cannot process live charges yet because merchant credentials and business authorization are not configured on this server. No payment was taken, your order was not placed, and your shopping bag has been preserved.`,
    ]);
    return;
  }

  tokenRecord.status = "processing";

  const nowIso = new Date().toISOString();
  const draftOrder: Order = {
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
    delivery_instructions: deliveryInstructions,
    payment_method: selectedProviderId,
    payment_symbol: "USD",
    payment_network: chosenProvider.name,
    payment_provider: selectedProviderId,
    payment_provider_label: chosenProvider.name,
    crypto_amount: shippingDetails.total.toFixed(2),
    wallet_address: "",
    qr_svg: "",
    payment_status: "awaiting_provider_verification",
    created_at_ms: Date.now(),
    order_date: nowIso,
    subtotal: baseTotals.subtotal,
    discount,
    shipping: shippingDetails.shipping,
    tax: shippingDetails.tax,
    tax_note: shippingDetails.taxNote,
    shipping_option: shippingDetails.shippingOption,
    shipping_method: shippingDetails.methodTitle,
    shipping_tier: shippingDetails.tierLabel,
    estimated_delivery: shippingDetails.estimatedDelivery,
    is_international: shippingDetails.isInternational,
    has_furniture: shippingDetails.hasFurniture,
    total: shippingDetails.total,
    items: cartItems.map((item) => ({
      id: item.id,
      inventory_id: item.inventory_id,
      title: item.title,
      artist: item.artist,
      category: item.category,
      price: item.price,
      size: item.size,
      image: item.image,
      quantity: item.quantity,
    })),
  };

  pendingOrdersByReference.set(draftOrder.reference, {
    order: draftOrder,
    cid,
    token: submittedToken,
  });

  const baseUrl = getRequestBaseUrl(req);
  if (selectedProviderId === "stripe") {
    const stripeRes = await createStripeCheckoutSession({
      order: draftOrder,
      baseUrl,
      cid,
    });
    if (!stripeRes.ok || !stripeRes.url) {
      tokenRecord.status = "open";
      pendingOrdersByReference.delete(draftOrder.reference);
      renderAtStep(5, [
        stripeRes.error ||
          "Unable to initialize Stripe Checkout. No charge was made.",
      ]);
      return;
    }
    draftOrder.payment_session_id = stripeRes.sessionId;
    req.session.save(() => {
      res.redirect(303, stripeRes.url!);
    });
    return;
  }

  const paypalRes = await createPayPalOrder({
    order: draftOrder,
    baseUrl,
    cid,
  });
  if (!paypalRes.ok || !paypalRes.approveUrl) {
    tokenRecord.status = "open";
    pendingOrdersByReference.delete(draftOrder.reference);
    renderAtStep(5, [
      paypalRes.error ||
        "Unable to initialize PayPal Checkout. No charge was made.",
    ]);
    return;
  }
  draftOrder.payment_session_id = paypalRes.paypalOrderId;
  req.session.save(() => {
    res.redirect(303, paypalRes.approveUrl!);
  });
});

app.get("/api/bitcoin/listen", async (req: Request, res: Response) => {
  const ref = String(req.query.reference ?? "").trim().toUpperCase();
  const forceRefresh = req.query.refresh === "1";
  const cid = getRequestCartId(req);
  const order = ref
    ? orderByReference.get(ref) ||
      (req.session.order?.reference === ref ? req.session.order : undefined)
    : undefined;

  const btcWallet = getCryptoWallets().bitcoin;
  const expectedBtc =
    order && order.payment_method === "bitcoin"
      ? order.crypto_amount
      : String(req.query.expected_btc ?? "0");
  const address =
    order && order.payment_method === "bitcoin"
      ? order.wallet_address
      : btcWallet;

  const result = await checkBitcoinPaymentStatus({
    address,
    expectedBtc,
    sinceMs: order
      ? order.created_at_ms
      : req.session.btcCheckoutStartedAt || Date.now(),
    forceRefresh,
    orderReference: order?.reference,
  });

  if (order && order.payment_method === "bitcoin") {
    if (result.status === "confirmed") {
      order.payment_status = "confirmed";
    } else if (result.status === "detected") {
      order.payment_status = "mempool";
    } else if (result.status === "partial") {
      order.payment_status = "partial";
    }
    if (result.txid) {
      order.payment_txid = result.txid;
      order.payment_received_btc = result.receivedBtc;
      consumedBitcoinTxids.set(result.txid, order.reference);
      inventoryStore.recordConsumedTxid(result.txid, order.reference);
      if (result.blockHeight) {
        order.payment_block_height = result.blockHeight;
      }
    }
    orderByReference.set(order.reference, order);
    inventoryStore.saveOrder(order);
    if (cid) orderStore.set(cid, order);
    if (req.session.order?.reference === order.reference) {
      req.session.order = order;
    }
  }

  res.setHeader("Cache-Control", "no-store");
  res.json(result);
});

app.get("/api/payments/stripe/return", async (req: Request, res: Response) => {
  const reference = String(req.query.reference ?? "").trim().toUpperCase();
  const sessionId = String(req.query.session_id ?? "").trim();
  const cid = String(req.query.cid ?? getRequestCartId(req) ?? "").trim();

  const existing = orderByReference.get(reference);
  if (existing && existing.payment_status === "paid") {
    redirectWithSession(
      req,
      res,
      `/checkout-success?reference=${encodeURIComponent(existing.reference)}`,
      cid
    );
    return;
  }

  const pending = pendingOrdersByReference.get(reference);
  if (!pending || !sessionId) {
    pushFlash(
      req,
      "Unable to locate an active payment verification session. Please review checkout before retrying."
    );
    redirectWithSession(req, res, "/checkout", cid);
    return;
  }

  const verification = await retrieveStripeCheckoutSession(sessionId);
  if (
    verification.ok &&
    verification.paid &&
    verification.orderReference === reference
  ) {
    const paidOrder = finalizeVerifiedPaidOrder(req, res, pending.order, {
      provider: "stripe",
      sessionId,
      cid: pending.cid || cid,
      token: pending.token,
    });
    redirectWithSession(
      req,
      res,
      `/checkout-success?reference=${encodeURIComponent(paidOrder.reference)}`,
      pending.cid || cid
    );
    return;
  }

  pushFlash(
    req,
    "Stripe has not confirmed payment completion yet. Your order has not been marked paid."
  );
  redirectWithSession(req, res, "/checkout", cid);
});

app.post("/api/payments/stripe/webhook", (req: Request, res: Response) => {
  const { stripeWebhookSecret } = getPaymentGatewayConfig();
  if (!stripeWebhookSecret) {
    res.status(503).json({ ok: false, error: "Webhook secret not configured." });
    return;
  }
  const rawBody = (req as Request & { rawBody?: string }).rawBody || "";
  const sigHeader = String(req.headers["stripe-signature"] || "");
  if (!verifyStripeWebhookSignature(rawBody, sigHeader, stripeWebhookSecret)) {
    res.status(400).json({ ok: false, error: "Invalid Stripe signature." });
    return;
  }

  const event = req.body as {
    type?: string;
    data?: {
      object?: {
        id?: string;
        payment_status?: string;
        client_reference_id?: string;
        metadata?: { order_reference?: string };
      };
    };
  };

  if (
    event?.type === "checkout.session.completed" &&
    event.data?.object?.payment_status === "paid"
  ) {
    const ref = String(
      event.data.object.metadata?.order_reference ||
        event.data.object.client_reference_id ||
        ""
    )
      .trim()
      .toUpperCase();
    const pending = ref ? pendingOrdersByReference.get(ref) : undefined;
    if (pending) {
      finalizeVerifiedPaidOrder(req, null, pending.order, {
        provider: "stripe",
        sessionId: String(event.data.object.id || ""),
        cid: pending.cid,
        token: pending.token,
      });
    }
  }

  res.json({ received: true });
});

app.get("/api/payments/paypal/return", async (req: Request, res: Response) => {
  const reference = String(req.query.reference ?? "").trim().toUpperCase();
  const paypalToken = String(req.query.token ?? "").trim();
  const cid = String(req.query.cid ?? getRequestCartId(req) ?? "").trim();

  const existing = orderByReference.get(reference);
  if (existing && existing.payment_status === "paid") {
    redirectWithSession(
      req,
      res,
      `/checkout-success?reference=${encodeURIComponent(existing.reference)}`,
      cid
    );
    return;
  }

  const pending = pendingOrdersByReference.get(reference);
  if (!pending || !paypalToken) {
    pushFlash(
      req,
      "Unable to verify PayPal approval token. Your order has not been marked paid."
    );
    redirectWithSession(req, res, "/checkout", cid);
    return;
  }

  const capture = await capturePayPalOrder(paypalToken);
  if (capture.ok && capture.completed) {
    const paidOrder = finalizeVerifiedPaidOrder(req, res, pending.order, {
      provider: "paypal",
      sessionId: paypalToken,
      cid: pending.cid || cid,
      token: pending.token,
    });
    redirectWithSession(
      req,
      res,
      `/checkout-success?reference=${encodeURIComponent(paidOrder.reference)}`,
      pending.cid || cid
    );
    return;
  }

  pushFlash(
    req,
    "PayPal did not confirm payment completion. Your order has not been marked paid."
  );
  redirectWithSession(req, res, "/checkout", cid);
});

app.get("/checkout-success", async (req: Request, res: Response) => {
  const cid = getRequestCartId(req);
  const requestedRef = String(req.query.reference ?? "").trim().toUpperCase();
  const order =
    (requestedRef
      ? orderByReference.get(requestedRef) ||
        (inventoryStore.getOrderByReference(requestedRef) as Order | undefined)
      : undefined) ||
    req.session.order ||
    (cid ? orderStore.get(cid) : undefined);

  if (!order) {
    redirectWithSession(req, res, "/");
    return;
  }

  let btcListener: BitcoinListenerResult | null = null;
  if (order.payment_method === "bitcoin") {
    btcListener = await checkBitcoinPaymentStatus({
      address: order.wallet_address,
      expectedBtc: order.crypto_amount,
      sinceMs: order.created_at_ms,
      forceRefresh: order.payment_status !== "confirmed",
      orderReference: order.reference,
    });
    if (btcListener.status === "confirmed") {
      order.payment_status = "confirmed";
    } else if (btcListener.status === "detected") {
      order.payment_status = "mempool";
    }
    if (btcListener.txid) {
      order.payment_txid = btcListener.txid;
      order.payment_received_btc = btcListener.receivedBtc;
      consumedBitcoinTxids.set(btcListener.txid, order.reference);
      inventoryStore.recordConsumedTxid(btcListener.txid, order.reference);
      if (btcListener.blockHeight) {
        order.payment_block_height = btcListener.blockHeight;
      }
    }
    inventoryStore.saveOrder(order);

    if (
      order.payment_status !== "mempool" &&
      order.payment_status !== "confirmed"
    ) {
      pushFlash(
        req,
        `No Bitcoin transfer detected yet for ${order.crypto_amount} BTC. Please complete your BTC transfer before viewing your order confirmation slip.`
      );
      redirectWithSession(req, res, "/checkout", cid);
      return;
    }
  } else if (
    (order.payment_method === "stripe" || order.payment_method === "paypal") &&
    order.payment_status !== "paid"
  ) {
    pushFlash(
      req,
      "Order confirmation is only displayed after verified payment completion."
    );
    const hasCartItems = getCartItems(req).length > 0;
    redirectWithSession(req, res, hasCartItems ? "/checkout" : "/cart", cid);
    return;
  }

  res.render("checkout_success", { order, btcListener });
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

const newsletterSubscribers = new Map<
  string,
  { email: string; subscribedAt: string }
>();

const trustPages: Record<string, TrustPageConfig> = {
  shipping: {
    slug: "shipping",
    kicker: "Fine Art & Furniture Logistics",
    title: "Shipping & Delivery",
    description:
      "Insured fine art courier delivery, white-glove furniture crating, and complimentary worldwide shipping on orders $1,500+ at ART STUDIO.",
    lead: "Every original painting, photograph, print, sculpture, and collectible furniture piece ships worldwide via insured specialist art carriers—with complimentary insured courier delivery on all orders of $1,500 USD or more, including furniture and international destinations.",
    highlights: [
      { label: "Orders $1,500+", value: "Complimentary Worldwide" },
      { label: "Paintings & Prints", value: "Museum Flat-Pack Air" },
      { label: "Large Furniture", value: "ISPM-15 White-Glove" },
    ],
    sections: [
      {
        heading: "Paintings, Prints & Works on Paper vs. Large Furniture",
        paragraphs: [
          "International transit arrangements are tailored strictly to the physical medium, dimensions, and fragility of each acquisition rather than routed through standard parcel post.",
        ],
        bullets: [
          "Paintings, Prints & Framed Photographs (Domestic & International): Wrapped in acid-free glassine paper with rigid corner guards, archival foam boarding, and museum flat-pack cases or telescoping fine art crates dispatched via priority air shuttle (4–8 business days domestic; 5–10 business days international air).",
          "Sculptures & Historical Wood/Marble Objects: Stabilized inside custom-cut high-density foam cavities within reinforced wood crates (4–9 business days domestic; 7–14 business days international air courier).",
          "Large Vintage & Collectible Furniture: Dispatched inside ISPM-15 heat-treated export timber crates with blanket-wrapped white-glove freight, export customs clearance brokerage, and scheduled two-person inside room-of-choice placement (5–10 business days domestic; 10–18 business days international freight).",
          "Every signed Certificate of Authenticity travels inside a sealed archival sleeve accompanying the shipment.",
        ],
      },
      {
        heading: "International Dispatch & Customs Clearance",
        paragraphs: [
          "We ship worldwide to North America, the UK, Europe, Asia-Pacific, the Middle East, Africa, and Latin America. Airway bills, export invoices, and courier tracking credentials are issued immediately upon dispatch, with complimentary insured courier delivery applying internationally on orders $1,500+.",
          "Import duties, VAT, or local customs clearance fees assessed at the destination border remain the responsibility of the recipient unless separately arranged with our Logistics Desk prior to dispatch.",
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

app.post("/api/newsletter", (req: Request, res: Response) => {
  const email = String(req.body?.email ?? "").trim().toLowerCase();
  const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
  if (!isValid || email.length > 160) {
    res.status(400).json({
      ok: false,
      message: "Please enter a valid collector email address.",
    });
    return;
  }

  if (newsletterSubscribers.has(email)) {
    res.json({
      ok: true,
      alreadySubscribed: true,
      message: "This address is already registered on our private collector list.",
    });
    return;
  }

  newsletterSubscribers.set(email, {
    email,
    subscribedAt: new Date().toISOString(),
  });
  res.json({
    ok: true,
    alreadySubscribed: false,
    message: "Thank you — you are on the private collector list.",
  });
});

interface ArtistMilestone {
  year: string;
  detail: string;
}

interface ArtistProfile {
  slug: string;
  name: string;
  discipline: string;
  origin: string;
  era: string;
  tagline: string;
  biography: string[];
  quote?: string;
  milestones: ArtistMilestone[];
}

function slugifyArtistName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const artistProfiles: ArtistProfile[] = [
  {
    slug: "wenceslaus-hollar",
    name: "Wenceslaus Hollar",
    discipline: "Etching & Printmaking",
    origin: "Prague · London · Antwerp",
    era: "1607–1677",
    tagline:
      "Bohemian Baroque master etcher celebrated for encyclopedic topographical plates, architectural views, and delicate Danube and London copperplate sequences.",
    biography: [
      "Born in Prague in 1607, Wenceslaus Hollar (Václav Hollar) trained in Frankfurt under the renowned Swiss engraver and publisher Matthäus Merian before developing a remarkably fine, silver-toned etching line across Central Europe, Antwerp, and London.",
      "In 1636, Hollar entered the patronage of Thomas Howard, 14th Earl of Arundel, accompanying the English diplomat's embassies along the Rhine and Danube rivers. His intimate travel sketchbooks became the source for hundreds of crisp riverine, castle, and townscape etchings—including the Danube River sequence around Sebins.",
      "Settling in London prior to the English Civil War and working continuously until his death in 1677, Hollar produced nearly three thousand cataloged plates documenting costumes, natural history, European cities, and pre-Great Fire London. His impressions remain cornerstones of print rooms at the British Museum and the Metropolitan Museum of Art.",
    ],
    quote:
      "Topography rendered at miniature scale yet possessing the clarity and architectural authority of a panoramic survey.",
    milestones: [
      { year: "1607", detail: "Born in Prague, Kingdom of Bohemia." },
      { year: "1627–1635", detail: "Apprenticed in Matthäus Merian's workshop in Frankfurt; worked in Strasbourg and Cologne." },
      { year: "1636", detail: "Joined the Earl of Arundel's diplomatic journey down the Rhine and Danube rivers." },
      { year: "1644–1652", detail: "Worked in Antwerp printing major landscapes, still lifes, and Arundel collection plates." },
      { year: "1652–1677", detail: "Returned to London, executing topographical surveys and Danube river etchings prior to his burial at St Margaret's, Westminster." },
    ],
  },
  {
    slug: "hans-j-wegner",
    name: "Hans J. Wegner",
    discipline: "Modernist Furniture Design",
    origin: "Tønder & Copenhagen, Denmark",
    era: "1914–2007",
    tagline:
      "Pioneering Danish modernist architect and cabinetmaker whose over 500 chair designs united sculptural restraint with honest structural joinery.",
    biography: [
      "Trained originally as a cabinetmaker in his hometown of Tønder at age seventeen before studying at the Copenhagen School of Arts and Crafts, Hans Jørgensen Wegner approached furniture first through the discipline of the hand plane, chisel, and load-bearing joint.",
      "During the golden era of Danish Modernism in the late 1940s and 1950s, Wegner collaborated with masters such as Arne Jacobsen and Erik Møller and forged lifelong partnerships with workshops including Johannes Hansen and Getama. In 1950, he conceived the legendary Flag Halyard Chair (GE225)—a radical departure from heavy wood upholstery inspired while relaxing in shallow beach sand.",
      "Suspended from 250 meters of tightly tensioned flag halyard cord across a lacquered and chromed tubular steel frame, the GE225 demonstrated Wegner's rare ability to pair industrial rigor with organic tactile warmth, earning permanent inclusion in major design museums worldwide.",
    ],
    quote:
      "A chair should have no rear side; it should be beautiful from all sides and angles.",
    milestones: [
      { year: "1931", detail: "Completed cabinetmaker's apprenticeship in Tønder, Denmark." },
      { year: "1936–1938", detail: "Studied at the School of Arts and Crafts in Copenhagen." },
      { year: "1950", detail: "Designed the iconic Flag Halyard Lounge Chair (Model GE225) for Getama." },
      { year: "1958", detail: "Early production period of the lacquered-frame GE225 represented in the ART STUDIO archive." },
      { year: "1995", detail: "Hans J. Wegner Museum opened in his birthplace of Tønder." },
    ],
  },
  {
    slug: "albert-clark",
    name: "Albert Clark",
    discipline: "Victorian Sporting Painting",
    origin: "London, England",
    era: "1843–1928",
    tagline:
      "British Victorian equine and sporting painter renowned for naturalistic anatomical studies of thoroughbreds, carriage horses, and pastoral estates.",
    biography: [
      "Active in London throughout the late nineteenth and early twentieth centuries, Albert Clark belonged to a celebrated dynasty of British animal and sporting painters who chronicled equestrian life at its height.",
      "Working predominantly in oil on canvas, Clark focused on the quiet dignity and muscular poise of prized hunters, polo ponies, and carriage horses set within open hedgerows and meadow landscapes. Rather than theatrical hunting chases, his finest canvases favor still, observant side-profile and conversational groupings bathed in soft English daylight.",
      "His dated 1887 composition of chestnut and bay horses standing face-to-face exemplifies his signature balance of glossy coat modeling, crisp bridle detail, and tranquil rural atmosphere housed inside classic giltwood framing.",
    ],
    milestones: [
      { year: "1843", detail: "Born into an artistic London family specializing in animal portraiture." },
      { year: "1870s–1890s", detail: "Executed private estate commissions across London and the English counties." },
      { year: "1887", detail: "Signed and dated 'Chestnut & Bay Horses in Landscape' in oil on canvas." },
      { year: "1928", detail: "Left a lasting body of Victorian sporting works prized by British and international collectors." },
    ],
  },
  {
    slug: "alexandre-kelety",
    name: "Alexandre Kéléty",
    discipline: "Art Deco Sculpture",
    origin: "Budapest, Hungary · Paris, France",
    era: "1874–1940",
    tagline:
      "Hungarian-born Parisian Art Deco sculptor celebrated for patinated bronze animaliers, chryselephantine figures, and sleek geometric bases.",
    biography: [
      "Born in Budapest in 1874, Alexandre (Sándor) Kéléty moved to Paris after the First World War, establishing himself among the leading sculptors of the interwar French Art Deco movement. Studying under Imre Simay in Budapest and exhibiting actively at the Paris Salons during the 1920s and 1930s, he bridged academic modeling with Jazz Age stylization.",
      "Kéléty worked closely with prominent Parisian foundries and éditeurs d'art including Etling, Goldscheider, and Arthur Goldscheider's ateliers, translating dynamic movement into crisp silhouettes cast in patinated bronze, terracotta, and ivory.",
      "His circa 1920s study of wading flamingos captures the signature tension of Art Deco animalier sculpture—slender, rhythmic necks and feathered volumes poised cleanly above stepped, veined marble plinths.",
    ],
    milestones: [
      { year: "1874", detail: "Born in Budapest, Austria-Hungary." },
      { year: "1918–1920", detail: "Relocated to Paris and entered the interwar École de Paris sculptural circle." },
      { year: "1920s", detail: "Cast signed patinated bronze animalier sculptures on marble plinths, including the Art Deco Flamingos." },
      { year: "1925–1937", detail: "Exhibited works at Parisian Salons and international decorative arts expositions." },
    ],
  },
  {
    slug: "alex-garant",
    name: "Alex Garant",
    discipline: "Contemporary Figurative Oil",
    origin: "Notre-Dame-du-Lac, Quebec · Toronto, Canada",
    era: "Contemporary",
    tagline:
      "Canadian oil painter and pioneer of Contemporary Figurative Op-Art, known for hypnotic double-eyed portraiture and nostalgic allegory.",
    biography: [
      "Born in Notre-Dame-du-Lac, Quebec, Alex Garant began drawing at a young age and later studied visual arts at Notre-Dame-de-Foy in Quebec City before establishing her painting practice in Toronto.",
      "Following a transformative health turning point in 2012, Garant developed her unmistakable visual vocabulary: classic portraiture disrupted by doubled eyes, graphic symmetry, and layered optical vibration. Her canvases compel viewers to slow down and reconcile stillness with perceptual shimmer.",
      "Exhibited widely across North America and Europe—including major showcases at Arch Enemy Arts in Philadelphia—her 2026 oil painting 'Swan Maiden' pairs delicate feathered symbolism with serene slate-blue tonal glazes in a bespoke diamond floater frame.",
    ],
    milestones: [
      { year: "2001", detail: "Completed visual arts studies at Campus Notre-Dame-de-Foy, Quebec." },
      { year: "2012–2015", detail: "Originated her signature double-eye figurative optical painting language." },
      { year: "2016–2025", detail: "Solo and featured exhibitions across Toronto, New York, Los Angeles, London, and Philadelphia." },
      { year: "2026", detail: "Painted 'Swan Maiden' for the Imaginary Menagerie exhibition at Arch Enemy Arts." },
    ],
  },
  {
    slug: "stefanie-schneider",
    name: "Stefanie Schneider",
    discipline: "Analog & Polaroid Photography",
    origin: "Cuxhaven, Germany · Twentynine Palms, California",
    era: "b. 1968",
    tagline:
      "German photographic artist celebrated for dreamlike narrative sequences shot exclusively on expired instant Polaroid film in the Mojave Desert.",
    biography: [
      "Born in Cuxhaven, Germany in 1968, Stefanie Schneider studied photography and visual communication at Folkwang University of the Arts in Essen, absorbing a rigorous German photographic tradition before turning deliberately toward chance, chemical decay, and mythic Americana.",
      "Working predominantly in the arid expanses of Twentynine Palms, California, Schneider builds cinematic, unscripted vignettes using expired Polaroid SX-70 and Spectra stocks. Because aged emulsions drift unpredictably toward amber, crimson, and washed cobalt, each frame carries an irreproducible organic patina.",
      "Her intimate 2006 work 'Ancient Bridge Views (Stay)' translates that fleeting Polaroid alchemy into a luminous square archival C-print edition of 5 plus 2 Artist Proofs.",
    ],
    milestones: [
      { year: "1968", detail: "Born in Cuxhaven, Northern Germany." },
      { year: "1996", detail: "Graduated in Photography & Visual Communication from Folkwang University, Essen." },
      { year: "2000s", detail: "Established desert studio practice in Twentynine Palms using expired Polaroid instant films." },
      { year: "2006", detail: "Created 'Ancient Bridge Views (Stay)' in a strictly limited edition of 5 + 2 AP." },
    ],
  },
  {
    slug: "richard-heeps",
    name: "Richard Heeps",
    discipline: "Darkroom Photography",
    origin: "Cambridge, England",
    era: "Contemporary",
    tagline:
      "British darkroom photographer and printmaker whose unmanipulated medium-format negatives capture saturated mid-century Americana and London nightlife.",
    biography: [
      "Based in Cambridge, England, Richard Heeps has spent more than three decades championing traditional wet-darkroom color photography at a moment when digital retouching became ubiquitous.",
      "Working with vintage Hasselblad medium-format cameras and hand-printing every edition himself on gloss photographic paper directly from the original negative, Heeps preserves razor-sharp architectural and theatrical detail alongside rich, velvety shadow tones.",
      "His celebrated 2003 'Burlesque Series'—photographed backstage and onstage at London's storied Whoopee Club—documents contemporary cabaret with the poise, wit, and intimate lighting of classic British portraiture.",
    ],
    milestones: [
      { year: "1980s–1990s", detail: "Established independent wet-color darkroom practice in Cambridge, England." },
      { year: "2003", detail: "Photographed the acclaimed 'Burlesque Series' at London's Whoopee Club." },
      { year: "2010s–2026", detail: "Master-printed limited editions exhibited in London, New York, Paris, and international art fairs." },
    ],
  },
  {
    slug: "shane-russeck",
    name: "Shane Russeck",
    discipline: "Large-Format Monochrome Photography",
    origin: "Los Angeles, California, USA",
    era: "b. 1977",
    tagline:
      "American fine art photographer whose monumental black-and-white landscapes and wild mustang studies honor the raw stillness of the American West.",
    biography: [
      "Born in 1977 and working out of California, Shane Russeck turned from commercial visual production toward sweeping open-country expeditions across the American West, documenting wild horses, desert expanses, and mountain light on high-resolution monochrome.",
      "Drawing inspiration from classic twentieth-century landscape masters while printing on architectural forty-by-sixty-inch scales, Russeck strips away color distraction so gesture, dust, breath, and horizon line command the room.",
      "Created during his 2018 'Wild Life' field series, 'The Calm' captures free-roaming wild mustangs in an unhurried moment of quiet solidarity and tonal balance.",
    ],
    milestones: [
      { year: "1977", detail: "Born in the United States." },
      { year: "2015–2018", detail: "Embarked on cross-country photographic expeditions for the 'Wild Life' monochrome series." },
      { year: "2018", detail: "Captured and produced monumental 40 × 60 inch editions of 'The Calm — Wild Horses'." },
    ],
  },
  {
    slug: "nando-kallweit",
    name: "Nando Kallweit",
    discipline: "Wood & Lost-Wax Bronze Sculpture",
    origin: "Germany",
    era: "Contemporary",
    tagline:
      "German sculptor uniting hand-carved European oak originals with limited-edition lost-wax bronze casts of elongated, meditative figures.",
    biography: [
      "German contemporary sculptor Nando Kallweit works in the tactile dialogue between carved timber and cast bronze. Each sculpture begins slowly at the workbench as an original hand-carved oak wood figure shaped with gouges, adzes, and rasps.",
      "Once the wooden form achieves its quiet equilibrium, Kallweit casts strictly limited editions—typically 25 numbered bronzes—using the ancient lost-wax (cire perdue) foundry process. This technique faithfully records every subtle tool facet and organic timber grain directly into dark-patinated metal.",
      "His sculpture 'Sina' balances architectural restraint with fragile human poise, allowing slender limbs and calm posture to anchor intimate residential or gallery spaces.",
    ],
    milestones: [
      { year: "2000s", detail: "Developed signature wood-carving to lost-wax bronze casting studio workflow in Germany." },
      { year: "2010s–2025", detail: "Exhibited figurative bronze series across European galleries and collector salons." },
      { year: "Present", detail: "'Sina' cast in a strictly numbered edition of 25 bronze impressions." },
    ],
  },
  {
    slug: "paul-chang",
    name: "Paul Chang",
    discipline: "Contemporary Figurative Painting",
    origin: "Contemporary Studio",
    era: "Contemporary",
    tagline:
      "Contemporary figurative painter whose richly layered compositions investigate biological growth, memory, and chromatic transformation.",
    biography: [
      "Paul Chang's studio practice investigates the threshold where human figuration meets organic metamorphosis. Working on mid-to-large canvas formats, he builds surface depth through successive strata of opaque pigment, scumbled edges, and luminous color contrasts.",
      "Rather than freezing subjects in static portraiture, Chang treats form as an evolving biological system—suggesting cellular division, memory traces, and continuous adaptation across time.",
      "'Biological Transformation' (32 × 40 in) exemplifies his command of textured brushwork and emotional color temperature, offering collectors a resonant centerpiece steeped in vitality.",
    ],
    milestones: [
      { year: "Studio Practice", detail: "Focuses on layered figurative and organic-abstraction oil & mixed works on canvas." },
      { year: "Catalog Highlight", detail: "'Biological Transformation' acquired into the ART STUDIO permanent contemporary archive." },
    ],
  },
  {
    slug: "igor-vitomirov",
    name: "Igor Vitomirov",
    discipline: "Atmospheric Landscape Photography",
    origin: "Europe",
    era: "Contemporary",
    tagline:
      "Fine art photographer known for misty woodland compositions, muted northern palettes, and serene natural stillness.",
    biography: [
      "Working predominantly in quiet dawn hours across northern forests and mist-laden valleys, Igor Vitomirov approaches landscape photography as an exercise in patience and tonal restraint.",
      "By photographing into diffuse morning fog rather than harsh midday glare, he compresses cluttered woodland depths into delicate atmospheric planes where vertical tree trunks recede like ink washes on archival paper.",
      "'Morning Forest #2' showcases his contemplative visual rhythm—bringing calm acoustic quietness and spatial depth into contemporary interiors.",
    ],
    milestones: [
      { year: "Practice", detail: "Specializes in dawn atmospheric woodland photography on archival fine art substrates." },
      { year: "Catalog Highlight", detail: "'Morning Forest #2' (39.4 × 27.6 in) featured as a flagship work at ART STUDIO." },
    ],
  },
  {
    slug: "emily-kent",
    name: "Emily Kent",
    discipline: "Fine Art Landscape Photography",
    origin: "North America",
    era: "Contemporary",
    tagline:
      "Photographic artist drawn to high-altitude aspen groves, transparent natural light, and serene seasonal contrasts.",
    biography: [
      "Emily Kent focuses her lens on quiet architectural rhythms within the natural world—tracking how pale bark, slender branches, and dappled canopy light interact across changing seasons.",
      "With an understated eye for natural contrast rather than heavy post-processing, Kent's prints emphasize clarity, airiness, and fine botanical detail across wide horizontal frames.",
      "'July Aspens' exemplifies her serene sensibility, translating summer mountain light into a balanced study of vertical line and luminous shadow.",
    ],
    milestones: [
      { year: "Practice", detail: "Dedicated to quiet, high-clarity landscape and botanical photography." },
      { year: "Catalog Highlight", detail: "'July Aspens' (38 × 26 in) presented in the ART STUDIO photography archive." },
    ],
  },
  {
    slug: "suren-ter-avakian",
    name: "Suren Ter-Avakian",
    discipline: "Atmospheric Painting",
    origin: "Armenian Heritage · Contemporary Studio",
    era: "Contemporary",
    tagline:
      "Painter bridging textured earth pigments and twilight lyricism in square, memory-infused figurative and landscape canvases.",
    biography: [
      "Drawing from a rich painterly tradition steeped in warm mineral tones and expressive impasto, Suren Ter-Avakian composes atmospheric scenes that hover between lived observation and nocturnal recollection.",
      "Working in balanced square formats such as 30 × 30 inches, he layers veiled glazes over tactile underpainting so figures and architecture emerge gently through fading evening light.",
      "'An Evening Walk' captures his signature equilibrium between grounded earthy pigment and poetic, reflective motion.",
    ],
    milestones: [
      { year: "Practice", detail: "Produces original atmospheric oil and mixed-pigment paintings on canvas." },
      { year: "Catalog Highlight", detail: "'An Evening Walk' (30 × 30 in) curated for the ART STUDIO painting collection." },
    ],
  },
  {
    slug: "juan-alvarez",
    name: "Juan Alvarez",
    discipline: "Contemporary Still-Life Painting",
    origin: "Contemporary Studio",
    era: "Contemporary",
    tagline:
      "Painter of intimate contemporary still lifes pairing saturated fruit and glazed ceramics against quiet slate-toned grounds.",
    biography: [
      "Juan Alvarez revitalizes classical still-life painting through confident brushwork, tactile paint handling, and unexpected chromatic pairings.",
      "Avoiding photographic stiffness, Alvarez builds forms with decisive, visible strokes—allowing deep crimson clusters, cool ceramic reflections, and matte mineral backgrounds to vibrate naturally against one another.",
      "'Grapes in a Teal Bowl' demonstrates his refined instinct for intimate domestic subject matter elevated by painterly authority.",
    ],
    milestones: [
      { year: "Practice", detail: "Contemporary still-life and tonal study painter on stretched canvas." },
      { year: "Catalog Highlight", detail: "'Grapes in a Teal Bowl' (24 × 24 in) included in the ART STUDIO collection." },
    ],
  },
  {
    slug: "luc-moreau",
    name: "Luc Moreau",
    discipline: "Bronze Figurative Sculpture",
    origin: "France",
    era: "Contemporary",
    tagline:
      "Sculptor working in dark patinated bronze to distill collective human stride, rhythm, and elongated architectural silhouette.",
    biography: [
      "Working in the enduring French tradition of figurative bronze modeling, Luc Moreau reduces the human form to its essential kinetic geometry—capturing balance, forward lean, and shared momentum.",
      "By stripping away facial specificity in favor of slender proportions and hand-rubbed dark patinas, his multi-figure compositions read simultaneously as ancient processionals and crisp modernist silhouettes.",
      "'Figures in Stride' aligns four elongated forms along a clean plinth, generating rhythmic shadow play across minimalist interiors.",
    ],
    milestones: [
      { year: "Practice", detail: "Cast-bronze figurative sculptor focused on kinetic group compositions." },
      { year: "Catalog Highlight", detail: "'Figures in Stride' (18 × 16 × 4 in) offered in the ART STUDIO sculpture collection." },
    ],
  },
  {
    slug: "gregory-christeas",
    name: "Gregory Christeas",
    discipline: "Large-Scale Abstract Painting",
    origin: "United States",
    era: "Contemporary",
    tagline:
      "Contemporary abstract painter whose monumental 'Parallels Series' harnesses metallic and fluorescent pigments inspired by oceanic light.",
    biography: [
      "Gregory Christeas works at architectural scale—often forty-eight by sixty inches and beyond—to immerse viewers inside shifting fields of tidal motion and specular reflection.",
      "Incorporating specialty metallic and fluorescent acrylic pigments on heavy stretched canvas, his 'Parallels Series' responds dynamically to natural daylight and evening gallery illumination, shifting subtly as a collector moves across the room.",
      "'Atlantic Drift' translates the rhythmic swell and horizon shimmer of the North Atlantic into a commanding, museum-scaled abstract statement.",
    ],
    milestones: [
      { year: "Parallels Series", detail: "Developed signature multi-pigment metallic and fluorescent acrylic technique." },
      { year: "Catalog Highlight", detail: "'Atlantic Drift' (48 × 60 in) anchors the ART STUDIO large-format painting selection." },
    ],
  },
  {
    slug: "cozy-art-land",
    name: "Cozy Art Land",
    discipline: "Sculptural Lighting Atelier",
    origin: "Contemporary Craft Studio",
    era: "Contemporary",
    tagline:
      "Design workshop crafting intimate sculptural table lamps in frosted blown glass, turned timber, and warm ambient illumination.",
    biography: [
      "Cozy Art Land operates at the intersection of domestic sculpture and functional lighting—treating small tabletop lamps as luminous glass-and-wood vessels.",
      "Drawing from mid-century Scandinavian and Italian glassmaking forms, their 'Mushroom Lamp No. 4' pairs a frosted blue-rimmed diffuser with a turned natural wood base to cast soft, glare-free warmth across studies and reading tables.",
    ],
    milestones: [
      { year: "Atelier Focus", detail: "Handcrafted glass and timber accent lighting editions." },
      { year: "Catalog Highlight", detail: "'Mushroom Lamp No. 4' curated in the ART STUDIO sculptural objects selection." },
    ],
  },
  {
    slug: "mary-ogochukwu",
    name: "Mary Ogochukwu",
    discipline: "Contemporary Figurative Painting",
    origin: "Nigeria",
    era: "Contemporary",
    tagline:
      "Nigerian contemporary figurative painter capturing sunlit memory, expressive warmth, and lyrical movement on large canvas.",
    biography: [
      "Mary Ogochukwu belongs to a vibrant generation of contemporary West African figurative painters whose canvases celebrate everyday grace, sunlight, and emotional immediacy.",
      "Working boldly in acrylic on canvas with sunlit ochres, coastal blues, and tactile surface energy, Ogochukwu constructs scenes where human presence feels intimately connected to sand, air, and recollection.",
      "Completed in 2025, 'Memories in the Sand' exemplifies her luminous storytelling and ships directly with a signed Certificate of Authenticity.",
    ],
    milestones: [
      { year: "2025", detail: "Completed the original large-format canvas 'Memories in the Sand' (40 × 30 in)." },
      { year: "Collection", detail: "Represented in the ART STUDIO international contemporary painting archive." },
    ],
  },
  {
    slug: "italian-school",
    name: "Italian School",
    discipline: "Classical Marble Carving",
    origin: "Italy",
    era: "20th Century Grand Tour Tradition",
    tagline:
      "Italian stone-carving workshop continuing the Grand Tour tradition of classical fragmentary marble torsos with authentic hand-worked patina.",
    biography: [
      "Rooted in centuries of Tuscan and Roman stoneworking heritage, the 20th-century Italian School continued sculpting faithful fragmentary torsos after Hellenistic and High Renaissance antiquities for discerning private libraries and architectural galleries.",
      "Hand-carved from naturally veined white marble and lightly weathered to honor archaeological softness across musculature and drapery breaks, each torso transforms raw stone into timeless anatomical balance.",
      "Mounted cleanly upon a custom black steel display stand, this fragment brings classical Mediterranean gravity into modern living spaces.",
    ],
    milestones: [
      { year: "Grand Tour Lineage", detail: "Preserved traditional Italian chisel-work and marble patination techniques." },
      { year: "20th Century", detail: "Carved 'White Marble Italian Torso Sculpture' with bespoke black steel plinth." },
    ],
  },
  {
    slug: "italian-old-master",
    name: "Italian Old Master",
    discipline: "19th-Century Devotional Oil Painting",
    origin: "Italy",
    era: "19th Century (After Sassoferrato)",
    tagline:
      "Skilled 19th-century Italian academic copyist continuing the serene Baroque devotional tradition of Giovanni Battista Salvi da Sassoferrato.",
    biography: [
      "Throughout the eighteenth and nineteenth centuries, accomplished Italian academy painters studied and perpetuated Baroque devotional masterpieces by Giovanni Battista Salvi da Sassoferrato (1609–1685), whose 'Madonna of Sorrows' became one of Rome's most beloved images of quiet contemplation.",
      "Painted on hand-woven linen stretched over an original period stretcher, this antique work demonstrates the luminous ultramarine lapis-inspired drapery glazes, porcelain flesh transitions, and delicate network of age craquelure prized by collectors of historic European oil painting.",
    ],
    milestones: [
      { year: "1640s", detail: "Sassoferrato paints the celebrated Baroque archetype of the 'Madonna of Sorrows' in Rome." },
      { year: "19th Century", detail: "Executed on period linen canvas by an accomplished Italian Old Master studio painter." },
    ],
  },
  {
    slug: "beth-barry",
    name: "Beth Barry",
    discipline: "Contemporary Landscape & Coastal Acrylic",
    origin: "United States",
    era: "Contemporary",
    tagline:
      "Contemporary American painter with Gallery Sitka provenance whose gestural brushwork distills shoreline light and shimmering water reflections.",
    biography: [
      "Contemporary American painter Beth Barry works with expressive color velocity—capturing ephemeral reflections across coastal harbors, lakes, and tidal flats before light shifts away.",
      "Combining cerulean blues, emerald greens, and warm sunbaked ochres in decisive gestural strokes, Barry lets woven canvas texture breathe beneath translucent and opaque passages.",
      "Her 2026 canvas 'Mexico in Reflection' enters the ART STUDIO archive directly with Gallery Sitka provenance.",
    ],
    milestones: [
      { year: "Exhibition", detail: "Represented by Gallery Sitka across contemporary New England and coastal exhibitions." },
      { year: "2026", detail: "Completed 'Mexico in Reflection' (14 × 11 in acrylic on canvas)." },
    ],
  },
  {
    slug: "shiri-phillips",
    name: "Shiri Phillips",
    discipline: "Impasto Contemporary Painting",
    origin: "Contemporary Studio",
    era: "Contemporary",
    tagline:
      "Painter with PxP Contemporary provenance building tactile, sculptural impasto reliefs in radiant sunlit yellow, emerald, plum, and rose.",
    biography: [
      "Shiri Phillips treats acrylic pigment as a three-dimensional building material—layering thick palette-knife ridges and brush reliefs that physically cast shadows across the picture plane.",
      "With provenance from PxP Contemporary, Phillips frequently extends her palette onto custom-toned wood framing edges, erasing the rigid divide between painted surface and enclosure.",
      "Her 2026 work 'Structure' packs dense chromatic energy and tactile geometry into an intimate, jewel-like framed format.",
    ],
    milestones: [
      { year: "Curatorial Provenance", detail: "Exhibited and curated through PxP Contemporary." },
      { year: "2026", detail: "Completed 'Structure' (11 × 9 in framed acrylic with painted mauve frame edge)." },
    ],
  },
  {
    slug: "will-klemm",
    name: "Will Klemm",
    discipline: "Contemporary Oil Landscape",
    origin: "Austin, Texas, USA",
    era: "Contemporary",
    tagline:
      "American landscape painter with Wally Workman Gallery provenance whose glowing crimson and amber skies illuminate quiet meadow horizons.",
    biography: [
      "Working in Austin, Texas and long represented by the respected Wally Workman Gallery, Will Klemm paints quiet, emotionally resonant landscapes rooted in memory and atmospheric color.",
      "Rather than strict topographical realism, Klemm distills pastures, treelines, and twilight clouds into saturated oil glazes—allowing luminous crimson heavens and golden horizons to radiate warmth from modest, intimately scaled panels.",
      "'Red Sky' (2026) demonstrates his mastery of twilight color harmony, framed generously to frame its glowing horizon line.",
    ],
    milestones: [
      { year: "Representation", detail: "Longstanding artist roster member at Wally Workman Gallery, Austin." },
      { year: "2026", detail: "Completed 'Red Sky' (12 × 12 in oil on canvas, 16 × 16 in framed)." },
    ],
  },
  {
    slug: "cobalt-guild",
    name: "Cobalt Guild",
    discipline: "Jingdezhen Porcelain Sculpture",
    origin: "Jingdezhen, China",
    era: "Contemporary Atelier",
    tagline:
      "Porcelain studio rooted in Jingdezhen's imperial kiln lineage, crafting architectural multi-tier tulipieres in hand-painted underglaze cobalt.",
    biography: [
      "Drawing directly on over a millennium of high-fired porcelain mastery in Jingdezhen—historically China's imperial porcelain capital—Cobalt Guild produces multi-tiered architectural vessels inspired by 17th-century Dutch and Chinese export tulipieres.",
      "Each section is wheel-thrown and hand-assembled with tubular floral spouts before artists brush fine cobalt-oxide landscapes, sailboats, and classical scrollwork beneath clear vitreous glaze prior to high-temperature kiln firing.",
    ],
    milestones: [
      { year: "Heritage", detail: "Continues classic Jingdezhen underglaze cobalt blue-and-white ceramic craft." },
      { year: "Catalog Highlight", detail: "Four-tier 'Blue & White Landscape Short Porcelain Tulipiere' (23.5 in tall)." },
    ],
  },
  {
    slug: "bernhardt-and-vella",
    name: "Bernhardt & Vella",
    discipline: "Italian Contemporary Furniture Design",
    origin: "Milan, Italy",
    era: "Contemporary Studio",
    tagline:
      "Milan-based design duo founded by Ellen Bernhardt and Paola Vella, pairing Italian neoclassical curves with sensual contemporary materials.",
    biography: [
      "Founded in Milan in 2008 by Ellen Bernhardt and Paola Vella, Studio Bernhardt & Vella brings together German-Italian architectural discipline and poetic, residential softness.",
      "Collaborating with Italy's premier luxury furniture houses, the duo approaches seating and tables through sinuous bentwood silhouettes, warm lacquer finishes, and enveloping tactile upholstery.",
      "Their 'Upholstered Swivel Armchair' anchors neoclassical proportion upon a gleaming bronze lacquer swivel plinth wrapped in velvety camel fabric.",
    ],
    milestones: [
      { year: "2008", detail: "Ellen Bernhardt and Paola Vella establish Studio Bernhardt & Vella in Milan." },
      { year: "2010s–2026", detail: "Designed signature seating and residential collections unveiled at Salone del Mobile." },
    ],
  },
  {
    slug: "english-victorian-school",
    name: "English Victorian School",
    discipline: "19th-Century Cabinetmaking & Seating",
    origin: "London & English Midlands",
    era: "c. 1870–1890",
    tagline:
      "Master English Victorian workshops celebrated for solid mahogany library armchairs, Jacobean-revival carved walnut cabinetry, and heirloom joinery.",
    biography: [
      "During the high Victorian era of the 1870s and 1880s, master English cabinetmakers produced domestic furnishings built to endure for generations—uniting seasoned solid mahogany and walnut timbers with crisp lathe turning, hand carving, and cast brass hardware.",
      "Whether outfitting private gentlemen's libraries with deeply buttoned olive-leather reading chairs on stamped brass casters, or crafting revivalist carved walnut bar cabinets featuring mother-of-pearl inlay, caryatid pilasters, and barley-twist stands, these workshops defined architectural gravitas.",
      "Both pieces represented in the ART STUDIO archive preserve authentic nineteenth-century patina and time-honored mortise-and-tenon construction.",
    ],
    milestones: [
      { year: "c. 1880", detail: "Crafted button-tufted mahogany & olive leather Library Chair on period brass casters." },
      { year: "c. 1880", detail: "Executed Carved Walnut Barley Twist Bar Cabinet with inlaid mother-of-pearl vases and caryatids." },
    ],
  },
  {
    slug: "mw-exclusive-x-nep",
    name: "MW Exclusive x NEP",
    discipline: "Limited-Edition Collectible Design",
    origin: "France",
    era: "Contemporary",
    tagline:
      "French luxury furniture house MW Exclusive partnering with contemporary street artist NEP to merge sculptural glass seating with original urban art.",
    biography: [
      "French design house MW Exclusive specializes in architectural collector seating defined by suspended tempered-glass side planes and high-resilience ergonomic cushions framed in precision stainless steel joinery.",
      "For the signed and numbered 'Interface(s)' limited edition, MW Exclusive collaborated with French contemporary artist NEP—embedding original street-art graphic compositions directly within the structural glass panels to create functional collectible sculpture.",
    ],
    milestones: [
      { year: "Collaboration", detail: "MW Exclusive partnered with artist NEP in France on numbered 'Interface(s)' editions." },
      { year: "Craft", detail: "Combines suspended tempered art glass panels with HR40 cushioning and stainless steel hardware." },
    ],
  },
  {
    slug: "style-of-francis-jourdain",
    name: "Style of Francis Jourdain",
    discipline: "Interwar Art Deco Seating",
    origin: "Paris & Northern Italy",
    era: "c. 1930",
    tagline:
      "Interwar European Art Deco furniture atelier echoing Francis Jourdain's geometric clarity in shellac-polished teak and hand-woven cane.",
    biography: [
      "French architect, painter, and pioneering modernist designer Francis Jourdain (1876–1958) championed stripped-back geometric honesty during the 1920s and 1930s—rejecting heavy historicist ornament in favor of crisp wooden planes and airy proportions.",
      "Created circa 1930 in that refined interwar spirit, this matched pair of Art Deco lounge chairs pairs French-polished teak arms and ebonized feet with taut, architectural woven cane backrests designed for serene modern living.",
    ],
    milestones: [
      { year: "1919–1930", detail: "Francis Jourdain co-founds the Union des Artistes Modernes (UAM) in Paris." },
      { year: "c. 1930", detail: "Matched pair of teak and woven-cane Art Deco lounge chairs crafted in Northern Italy." },
    ],
  },
  {
    slug: "french-early-20th-century",
    name: "French Early 20th Century",
    discipline: "Belle Époque Atelier Seating",
    origin: "France",
    era: "c. 1900",
    tagline:
      "Turn-of-the-century French upholstery and ebonised wood workshops bridging late Belle Époque salons and early modern restraint.",
    biography: [
      "At the turn of the twentieth century in Paris and regional French cabinetmaking centers, small workshops continued producing intimate salon tub chairs featuring gently enveloping barrel backs and finely tapered legs.",
      "This matched circa 1900 pair contrasts sleek ebonised hardwood framing against rich woven floral tapestry textiles and braided trim—embodying the effortless grace of French interior rooms.",
    ],
    milestones: [
      { year: "c. 1900", detail: "Crafted matched pair of French ebonised wood barrel-back tub armchairs." },
      { year: "Preservation", detail: "Maintains historic curvilinear joinery and decorative woven floral tapestry upholstery." },
    ],
  },
  {
    slug: "spanish-renaissance-school",
    name: "Spanish Renaissance School",
    discipline: "Golden Age Polychrome Giltwood",
    origin: "Spain (Castile / Andalusia)",
    era: "c. 1580–1620",
    tagline:
      "Spanish Golden Age (Siglo de Oro) woodcarving and estofado gilding workshops producing architectural friezes, altarpieces, and carved cherub reliefs.",
    biography: [
      "During Spain's artistic Golden Age (Siglo de Oro) in the late sixteenth and early seventeenth centuries, specialized teams of master entalladores (woodcarvers), doradores (gilders), and encarnadores (flesh painters) collaborated in guild workshops to carve expressive polychrome reliefs.",
      "Deeply undercut from seasoned timber before receiving layers of bole clay, burnished water-gilding, and tempera pigments, these architectural friezes brought warmth and movement to ecclesiastical Choir stalls and noble chapels.",
      "Dating to circa 1580–1620, this giltwood angel frieze preserves authentic Renaissance water-gilding and aged polychrome flanking a serene central cherub.",
    ],
    milestones: [
      { year: "1580–1620", detail: "Hand-carved deep-relief angel and fruit-festoon frieze created in a Spanish Renaissance guild workshop." },
      { year: "Conservation", detail: "Mounted on a custom stepped black display stand preserving original polychrome and water-gilding." },
    ],
  },
];

const artistBySlug = new Map<string, ArtistProfile>(
  artistProfiles.map((profile) => [profile.slug, profile])
);
const artistSlugByName = new Map<string, string>(
  artistProfiles.map((profile) => [profile.name.toLowerCase(), profile.slug])
);

function getArtistSlug(artistName: string): string {
  const mapped = artistSlugByName.get(artistName.trim().toLowerCase());
  return mapped || slugifyArtistName(artistName);
}

app.get("/artists", (req: Request, res: Response) => {
  const catalog = getAllProducts();
  const enrichedArtists = artistProfiles.map((profile) => {
    const artistWorks = catalog.filter(
      (p) => p.artist.toLowerCase() === profile.name.toLowerCase()
    );
    const primaryWork = artistWorks[0];
    return {
      ...profile,
      categoryKey: primaryWork ? primaryWork.category : "Painting",
      featuredImage: primaryWork ? primaryWork.image : "/static/images/london-gallery-1.jpg",
      featuredTitle: primaryWork ? primaryWork.title : profile.name,
      worksCount: artistWorks.length,
    };
  });

  res.render("artists", {
    artists: enrichedArtists,
    activeNav: "Artists",
  });
});

app.get("/artists/:slug", (req: Request, res: Response) => {
  const slug = String(req.params.slug ?? "").trim().toLowerCase();
  const idx = artistProfiles.findIndex((a) => a.slug === slug);
  if (idx === -1) {
    res.status(404).send("Artist not found");
    return;
  }

  const profile = artistProfiles[idx];
  const works = getAllProducts().filter(
    (p) => p.artist.toLowerCase() === profile.name.toLowerCase()
  );
  const primaryWork = works[0];
  const prevProfile = idx > 0 ? artistProfiles[idx - 1] : null;
  const nextProfile = idx < artistProfiles.length - 1 ? artistProfiles[idx + 1] : null;

  res.render("artist", {
    artist: {
      ...profile,
      featuredImage: primaryWork ? primaryWork.image : "/static/images/london-gallery-1.jpg",
      featuredTitle: primaryWork ? primaryWork.title : profile.name,
    },
    works,
    prevArtist: prevProfile ? { slug: prevProfile.slug, name: prevProfile.name } : null,
    nextArtist: nextProfile ? { slug: nextProfile.slug, name: nextProfile.name } : null,
    activeNav: "Artists",
  });
});

// Admin & Inventory Management System
app.get("/admin/inventory", (req: Request, res: Response) => {
  const q = String(req.query.q ?? "").trim();
  const category = String(req.query.category ?? "all").trim();
  const status = String(req.query.status ?? "all").trim();
  const authenticity = String(req.query.authenticity ?? "all").trim();
  const editParam = String(req.query.edit ?? "").trim();

  const filteredProducts = inventoryStore.searchProducts(q, {
    category,
    status,
    authenticity,
  });
  const editingProduct = editParam ? getProductById(editParam) : undefined;

  res.render("admin_inventory", {
    products: filteredProducts,
    stats: inventoryStore.getStats(),
    orders: inventoryStore.getOrders(),
    categories: VALID_CATEGORIES,
    filters: { q, category, status, authenticity },
    editingProduct: editingProduct ?? null,
    editingProvenance: editingProduct ? getProductProvenance(editingProduct) : null,
    messages: consumeFlashes(req),
    activeNav: "",
  });
});

app.post("/admin/inventory/create", (req: Request, res: Response) => {
  const title = String(req.body.title ?? "").trim();
  const artist = String(req.body.artist ?? "").trim();
  const category = normalizeCategoryName(String(req.body.category ?? "Painting"));
  const price = Number.parseFloat(String(req.body.price ?? "0"));
  const size = String(req.body.size ?? "").trim();
  const description = String(req.body.description ?? "").trim();
  const image = String(req.body.image ?? "").trim();
  const yearRaw = Number.parseInt(String(req.body.year ?? ""), 10);
  const year = Number.isFinite(yearRaw) && yearRaw >= 2000 && yearRaw <= 2100 ? yearRaw : undefined;
  const rawAuth = String(req.body.authenticity_status ?? "pending_review").trim();
  const authStatus: AuthenticityStatus =
    rawAuth === "verified" || rawAuth === "unverified" ? rawAuth : "pending_review";
  const authNote = String(req.body.authenticity_note ?? "").trim();

  if (!title || !artist || !Number.isFinite(price) || price <= 0 || !size || !description) {
    pushFlash(req, "Please provide title, artist, valid price, dimensions, and description.");
    redirectWithSession(req, res, "/admin/inventory");
    return;
  }

  const created = inventoryStore.createProduct({
    title,
    artist,
    category,
    price,
    size,
    image,
    description,
    year,
    authenticity_status: authStatus,
    authenticity_note: authNote,
    provenance: {
      datePeriod: String(req.body.date_period ?? "").trim() || undefined,
      materialsMedium: String(req.body.materials_medium ?? "").trim() || undefined,
      markingsEdition: String(req.body.markings_edition ?? "").trim() || undefined,
      provenanceRecord: String(req.body.provenance_record ?? "").trim() || undefined,
    },
  });

  pushFlash(
    req,
    `Cataloged "${created.title}" with permanent Inventory ID ${created.inventory_id}.`
  );
  redirectWithSession(
    req,
    res,
    `/admin/inventory?q=${encodeURIComponent(created.inventory_id)}`
  );
});

app.post("/admin/inventory/:identifier/edit", (req: Request, res: Response) => {
  const identifier = String(req.params.identifier ?? "").trim();
  const existing = getProductById(identifier);
  if (!existing) {
    res.status(404).send("Artwork not found in inventory.");
    return;
  }

  const priceVal = Number.parseFloat(String(req.body.price ?? ""));
  const rawStatus = String(req.body.status ?? existing.status).trim();
  const statusVal: InventoryStatus = rawStatus === "sold" ? "sold" : "available";
  const rawAuth = String(req.body.authenticity_status ?? existing.authenticity_status).trim();
  const authStatus: AuthenticityStatus =
    rawAuth === "verified" || rawAuth === "unverified" ? rawAuth : "pending_review";

  const updated = inventoryStore.updateProduct(existing.id, {
    title: String(req.body.title ?? existing.title),
    artist: String(req.body.artist ?? existing.artist),
    category: String(req.body.category ?? existing.category),
    price: Number.isFinite(priceVal) && priceVal > 0 ? priceVal : existing.price,
    size: String(req.body.size ?? existing.size),
    image: String(req.body.image ?? existing.image),
    description: String(req.body.description ?? existing.description),
    status: statusVal,
    authenticity_status: authStatus,
    authenticity_note: String(req.body.authenticity_note ?? existing.authenticity_note),
    provenance: {
      datePeriod: String(req.body.date_period ?? "").trim() || undefined,
      originAttribution: String(req.body.origin_attribution ?? "").trim() || undefined,
      materialsMedium: String(req.body.materials_medium ?? "").trim() || undefined,
      markingsEdition: String(req.body.markings_edition ?? "").trim() || undefined,
      conditionNote: String(req.body.condition_note ?? "").trim() || undefined,
      provenanceRecord: String(req.body.provenance_record ?? "").trim() || undefined,
    },
  });

  if (updated) {
    pushFlash(
      req,
      `Saved updates to "${updated.title}". Permanent Inventory ID ${updated.inventory_id} preserved.`
    );
    redirectWithSession(
      req,
      res,
      `/admin/inventory?edit=${encodeURIComponent(updated.inventory_id)}`
    );
    return;
  }
  redirectWithSession(req, res, "/admin/inventory");
});

app.get("/api/inventory", (req: Request, res: Response) => {
  const q = String(req.query.q ?? "").trim();
  const category = String(req.query.category ?? "all").trim();
  const status = String(req.query.status ?? "all").trim();
  const authenticity = String(req.query.authenticity ?? "all").trim();
  const results = inventoryStore.searchProducts(q, { category, status, authenticity });
  res.setHeader("Cache-Control", "no-store");
  res.json({
    ok: true,
    stats: inventoryStore.getStats(),
    count: results.length,
    products: results,
    orders: inventoryStore.getOrders(),
  });
});

app.get("/api/inventory/:identifier", (req: Request, res: Response) => {
  const product = getProductById(String(req.params.identifier ?? ""));
  if (!product) {
    res.status(404).json({ ok: false, error: "Not Found" });
    return;
  }
  res.setHeader("Cache-Control", "no-store");
  res.json({
    ok: true,
    product,
    provenance: getProductProvenance(product),
  });
});

app.post("/api/inventory", (req: Request, res: Response) => {
  const title = String(req.body?.title ?? "").trim();
  const artist = String(req.body?.artist ?? "").trim();
  const category = normalizeCategoryName(String(req.body?.category ?? "Painting"));
  const price = Number(req.body?.price);
  const size = String(req.body?.size ?? "").trim();
  const description = String(req.body?.description ?? "").trim();
  const image = String(req.body?.image ?? "").trim();
  const rawYear = Number(req.body?.year);
  const year = Number.isFinite(rawYear) && rawYear >= 2000 && rawYear <= 2100 ? rawYear : undefined;
  const rawAuth = String(req.body?.authenticity_status ?? "pending_review").trim();
  const authStatus: AuthenticityStatus =
    rawAuth === "verified" || rawAuth === "unverified" ? rawAuth : "pending_review";

  if (!title || !artist || !Number.isFinite(price) || price <= 0 || !size || !description) {
    res.status(400).json({
      ok: false,
      error: "Missing or invalid required artwork fields (title, artist, price, size, description).",
    });
    return;
  }

  const created = inventoryStore.createProduct({
    title,
    artist,
    category,
    price,
    size,
    image,
    description,
    year,
    authenticity_status: authStatus,
    authenticity_note: String(req.body?.authenticity_note ?? "").trim(),
  });

  res.status(201).json({ ok: true, product: created });
});

app.patch("/api/inventory/:identifier", (req: Request, res: Response) => {
  const existing = getProductById(String(req.params.identifier ?? ""));
  if (!existing) {
    res.status(404).json({ ok: false, error: "Not Found" });
    return;
  }

  const rawPrice = req.body?.price !== undefined ? Number(req.body.price) : undefined;
  const rawStatus = req.body?.status;
  const rawAuth = req.body?.authenticity_status;

  const updated = inventoryStore.updateProduct(existing.id, {
    title: typeof req.body?.title === "string" ? req.body.title : undefined,
    artist: typeof req.body?.artist === "string" ? req.body.artist : undefined,
    category: typeof req.body?.category === "string" ? req.body.category : undefined,
    price: rawPrice !== undefined && Number.isFinite(rawPrice) && rawPrice > 0 ? rawPrice : undefined,
    size: typeof req.body?.size === "string" ? req.body.size : undefined,
    image: typeof req.body?.image === "string" ? req.body.image : undefined,
    description: typeof req.body?.description === "string" ? req.body.description : undefined,
    status: rawStatus === "sold" || rawStatus === "available" ? rawStatus : undefined,
    authenticity_status:
      rawAuth === "verified" || rawAuth === "pending_review" || rawAuth === "unverified"
        ? rawAuth
        : undefined,
    authenticity_note:
      typeof req.body?.authenticity_note === "string" ? req.body.authenticity_note : undefined,
  });

  res.json({ ok: true, product: updated });
});

app.get("/healthz", (_req: Request, res: Response) => {
  res.status(200).json({ ok: true });
});

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error("Express request error:", err);
  if (res.headersSent) return;
  res.status(500).send("Temporary studio server error. Please refresh the page.");
});

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled promise rejection:", reason);
});

process.on("uncaughtException", (err) => {
  console.error("Uncaught exception:", err);
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`ART STUDIO server running on http://0.0.0.0:${PORT}`);
});
