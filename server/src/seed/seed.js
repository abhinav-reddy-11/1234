// Demo data for RetailPulse AI. Run with:  npm run seed
// Add --skip-policies to seed everything except the RAG policy documents.
// WARNING: this wipes the existing data in the database first.
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import bcrypt from "bcrypt";
import mongoose from "mongoose";
import { connectDB } from "../config/db.js";
import {
  User, Store, Category, Product, Inventory, Order, PurchaseOrder,
  PolicyDocument, PolicyChunk, AuditLog,
} from "../models/index.js";
import { TIER_DISCOUNT_PERCENT } from "../utils/constants.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEMO_PASSWORD = "Demo@123";
const skipPolicies = process.argv.includes("--skip-policies");

const STORES = [
  { name: "RetailPulse Hyderabad", address: "Road No. 36, Jubilee Hills", city: "Hyderabad" },
  { name: "RetailPulse Warangal", address: "Hanamkonda Main Road", city: "Warangal" },
  { name: "RetailPulse Bengaluru", address: "100 Feet Road, Indiranagar", city: "Bengaluru" },
  { name: "RetailPulse Chennai", address: "T. Nagar, Usman Road", city: "Chennai" },
];

const CATEGORIES = ["Electronics", "Home & Kitchen", "Groceries", "Personal Care", "Fashion"];

// [name, category, price, tags, attributes]
const PRODUCTS = [
  ["Wireless Earbuds Pro", "Electronics", 2499, ["audio", "wireless", "bluetooth"], { battery: "30 hours", noiseCancelling: "Yes", warranty: "1 year" }],
  ["Bluetooth Speaker Mini", "Electronics", 1299, ["audio", "portable", "bluetooth"], { battery: "12 hours", waterproof: "IPX5", warranty: "1 year" }],
  ["Smartwatch Fit 2", "Electronics", 3999, ["fitness", "wearable"], { battery: "7 days", display: "1.4 inch AMOLED", warranty: "1 year" }],
  ["USB-C Fast Charger 33W", "Electronics", 899, ["charger", "accessories"], { power: "33W", ports: "1 USB-C", warranty: "6 months" }],
  ["Power Bank 20000mAh", "Electronics", 1799, ["charger", "portable"], { capacity: "20000 mAh", ports: "2 USB-A, 1 USB-C", warranty: "6 months" }],
  ["Non-Stick Frying Pan 26cm", "Home & Kitchen", 1199, ["cookware", "kitchen"], { material: "Aluminium", inductionReady: "Yes" }],
  ["Electric Kettle 1.5L", "Home & Kitchen", 1099, ["appliance", "kitchen"], { capacity: "1.5 L", power: "1500W", warranty: "1 year" }],
  ["Mixer Grinder 750W", "Home & Kitchen", 3499, ["appliance", "kitchen"], { jars: "3", power: "750W", warranty: "2 years" }],
  ["Steel Water Bottle 1L", "Home & Kitchen", 499, ["bottle", "eco-friendly"], { material: "Stainless steel", insulated: "Yes" }],
  ["Basmati Rice 5kg", "Groceries", 649, ["rice", "staples"], { weight: "5 kg", type: "Long grain" }],
  ["Cold Pressed Groundnut Oil 1L", "Groceries", 289, ["oil", "staples"], { volume: "1 L" }],
  ["Organic Green Tea 100 bags", "Groceries", 399, ["tea", "organic", "healthy"], { count: "100 bags" }],
  ["Mixed Dry Fruits 500g", "Groceries", 749, ["snacks", "healthy"], { weight: "500 g" }],
  ["Herbal Shampoo 340ml", "Personal Care", 349, ["hair", "herbal"], { volume: "340 ml", hairType: "All" }],
  ["Sunscreen SPF 50", "Personal Care", 499, ["skin", "sun-protection"], { volume: "50 ml", spf: "50" }],
  ["Electric Trimmer", "Personal Care", 1499, ["grooming", "electronics"], { battery: "60 min", warranty: "1 year" }],
  ["Cotton Casual Shirt", "Fashion", 999, ["men", "cotton", "casual"], { material: "100% cotton", fit: "Regular" }],
  ["Running Shoes Air", "Fashion", 2999, ["footwear", "sports", "running"], { type: "Running", sole: "EVA" }],
  ["Denim Jacket", "Fashion", 2199, ["women", "denim", "winter"], { material: "Denim", fit: "Relaxed" }],
  ["Canvas Backpack 25L", "Fashion", 1199, ["bags", "travel"], { capacity: "25 L", laptopSleeve: "15.6 inch" }],
];

// Deterministic "random" numbers so every seed run gives the same demo data.
let rngState = 42;
const rand = () => ((rngState = (rngState * 9301 + 49297) % 233280) / 233280);
const randInt = (min, max) => Math.floor(rand() * (max - min + 1)) + min;

async function seed() {
  await connectDB();
  console.log("Clearing existing data...");
  await Promise.all(
    [User, Store, Category, Product, Inventory, Order, PurchaseOrder, PolicyDocument, PolicyChunk, AuditLog]
      .map((M) => M.deleteMany({}))
  );
  await Promise.all([User, Inventory, PolicyDocument].map((M) => M.syncIndexes()));

  const stores = await Store.insertMany(STORES);
  const categories = await Category.insertMany(CATEGORIES.map((name) => ({ name })));
  const categoryId = Object.fromEntries(categories.map((c) => [c.name, c._id]));

  const products = await Product.insertMany(
    PRODUCTS.map(([name, category, price, tags, attributes]) => ({
      name, category: categoryId[category], price, tags, attributes,
      description: `${name} – demo product for RetailPulse AI.`,
    }))
  );
  console.log(`Created ${stores.length} stores, ${categories.length} categories, ${products.length} products`);

  // Inventory: every product in every store. About 1 in 5 records starts at or below
  // its reorder level so managers see low-stock alerts in the demo.
  const inventory = [];
  for (const store of stores) {
    for (const product of products) {
      const reorderLevel = randInt(8, 15);
      const lowStock = rand() < 0.2;
      inventory.push({
        storeId: store._id,
        productId: product._id,
        reorderLevel,
        quantity: lowStock ? randInt(0, reorderLevel) : randInt(reorderLevel + 10, 80),
      });
    }
  }
  await Inventory.insertMany(inventory);
  console.log(`Created ${inventory.length} inventory records`);

  // Users
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const admin = await User.create({ name: "Asha Admin", email: "admin@retailpulse.demo", passwordHash, role: "admin" });
  const cities = ["hyderabad", "warangal", "bengaluru", "chennai"];
  const managers = await User.insertMany(
    stores.map((store, i) => ({
      name: `${STORES[i].city} Manager`,
      email: `manager.${cities[i]}@retailpulse.demo`,
      passwordHash, role: "manager", storeId: store._id,
    }))
  );
  const customers = await User.insertMany([
    { name: "Gauri Gold", email: "gold@retailpulse.demo", passwordHash, tier: "gold", totalEligibleSpend: 25400 },
    { name: "Suresh Silver", email: "silver@retailpulse.demo", passwordHash, tier: "silver", totalEligibleSpend: 8200 },
    { name: "Bhavya Bronze", email: "bronze@retailpulse.demo", passwordHash, tier: "bronze", totalEligibleSpend: 1200 },
  ]);
  console.log(`Created 1 admin, ${managers.length} managers, ${customers.length} customers`);

  // Past completed orders over the last 14 days, used as sales history for AI restock
  // suggestions. They don't change stock or spend (those are already set above).
  const orders = [];
  for (let i = 0; i < 60; i++) {
    const customer = customers[randInt(0, customers.length - 1)];
    const store = stores[randInt(0, stores.length - 1)];
    const picked = [...products].sort(() => rand() - 0.5).slice(0, randInt(1, 3));
    const items = picked.map((p) => {
      const quantity = randInt(1, 3);
      return { productId: p._id, name: p.name, price: p.price, quantity, lineTotal: p.price * quantity };
    });
    const subtotal = items.reduce((s, it) => s + it.lineTotal, 0);
    const discount = Math.round((subtotal * TIER_DISCOUNT_PERCENT[customer.tier]) / 100);
    const fulfilment = rand() < 0.6 ? "delivery" : "takeaway";
    const createdAt = new Date(Date.now() - randInt(1, 14) * 24 * 3600 * 1000);
    orders.push({
      customerId: customer._id, storeId: store._id, items, subtotal, discount,
      total: subtotal - discount, tierAtPurchase: customer.tier, fulfilment,
      deliveryAddress: fulfilment === "delivery" ? `Demo address, ${store.city}` : undefined,
      status: "completed",
      statusHistory: [{ status: "placed", at: createdAt }, { status: "completed", at: createdAt }],
      createdAt, updatedAt: createdAt,
    });
  }
  await Order.insertMany(orders, { timestamps: false });
  console.log(`Created ${orders.length} past orders (sales history)`);

  if (skipPolicies) {
    console.log("Skipped policy documents (--skip-policies).");
  } else {
    // Imported here so the rest of the seed works even before the AI layer is set up.
    const { ingestDocument, approveDocument } = await import("../services/rag/ingest.js");
    const policies = [
      { file: "return-policy.md", title: "Return and Refund Policy", tiers: ["bronze", "silver", "gold"] },
      { file: "delivery-policy.md", title: "Delivery and Takeaway Policy", tiers: ["bronze", "silver", "gold"] },
      { file: "membership-program.md", title: "Membership Program", tiers: ["bronze", "silver", "gold"] },
      { file: "gold-benefits.md", title: "Gold Member Benefits", tiers: ["gold"] },
      { file: "silver-benefits.md", title: "Silver Member Benefits", tiers: ["silver"] },
    ];
    console.log("Embedding policy documents (first run downloads the embedding model, ~25 MB)...");
    for (const p of policies) {
      const text = fs.readFileSync(path.join(__dirname, "policies", p.file), "utf8");
      const doc = await ingestDocument({
        title: p.title, fileName: p.file, text, appliesToTiers: p.tiers, uploadedBy: admin._id,
      });
      await approveDocument(doc._id, admin._id);
      console.log(`  ${p.title}: ${doc.chunkCount} chunks, approved`);
    }
  }

  console.log("\nDemo accounts (password for all: Demo@123)");
  console.log("  admin@retailpulse.demo");
  console.log("  manager.hyderabad@retailpulse.demo  (also .warangal / .bengaluru / .chennai)");
  console.log("  gold@retailpulse.demo | silver@retailpulse.demo | bronze@retailpulse.demo");
  await mongoose.disconnect();
}

seed().catch(async (err) => {
  console.error("Seed failed:", err);
  await mongoose.disconnect();
  process.exit(1);
});
