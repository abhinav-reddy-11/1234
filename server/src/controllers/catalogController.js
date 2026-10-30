import mongoose from "mongoose";
import { Store, Category, Product, Inventory } from "../models/index.js";
import { AppError } from "../utils/AppError.js";
import { requireFields } from "../utils/validate.js";
import { logAudit } from "../utils/audit.js";

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// ---------- Stores ----------

// GET /api/stores  (admins also see inactive stores)
export async function listStores(req, res) {
  const filter = req.user?.role === "admin" ? {} : { isActive: true };
  const stores = await Store.find(filter).sort({ name: 1 });
  res.json({ success: true, stores });
}

// POST /api/stores  (admin)
export async function createStore(req, res) {
  requireFields(req.body, ["name", "address", "city"]);
  const { name, address, city } = req.body;
  const store = await Store.create({ name, address, city });

  // A new store starts with zero stock for every product, so it appears everywhere.
  const products = await Product.find({}, "_id");
  await Inventory.insertMany(products.map((p) => ({ storeId: store._id, productId: p._id, quantity: 0 })));

  await logAudit(req.user._id, "STORE_CREATED", "Store", store._id, { name });
  res.status(201).json({ success: true, store });
}

// PATCH /api/stores/:id  (admin)
export async function updateStore(req, res) {
  const allowed = ["name", "address", "city", "isActive"];
  const updates = Object.fromEntries(Object.entries(req.body).filter(([k]) => allowed.includes(k)));
  const store = await Store.findByIdAndUpdate(req.params.id, updates, { returnDocument: "after", runValidators: true });
  if (!store) throw new AppError(404, "Store not found");
  await logAudit(req.user._id, "STORE_UPDATED", "Store", store._id, updates);
  res.json({ success: true, store });
}

// ---------- Categories ----------

export async function listCategories(req, res) {
  const categories = await Category.find().sort({ name: 1 });
  res.json({ success: true, categories });
}

export async function createCategory(req, res) {
  requireFields(req.body, ["name"]);
  const category = await Category.create({ name: req.body.name, description: req.body.description });
  await logAudit(req.user._id, "CATEGORY_CREATED", "Category", category._id, { name: category.name });
  res.status(201).json({ success: true, category });
}

export async function updateCategory(req, res) {
  const category = await Category.findByIdAndUpdate(
    req.params.id,
    { name: req.body.name, description: req.body.description },
    { returnDocument: "after", runValidators: true, omitUndefined: true }
  );
  if (!category) throw new AppError(404, "Category not found");
  res.json({ success: true, category });
}

// ---------- Products ----------

// GET /api/products?search=&category=&minPrice=&maxPrice=&sort=&storeId=
// With storeId, each product also gets that store's stock.
export async function listProducts(req, res) {
  const { search, category, minPrice, maxPrice, sort = "name", storeId } = req.query;

  const filter = { isActive: true };
  if (search) {
    const rx = new RegExp(escapeRegex(String(search).trim()), "i");
    filter.$or = [{ name: rx }, { tags: rx }];
  }
  if (category) filter.category = category;
  if (minPrice || maxPrice) {
    filter.price = {};
    if (minPrice) filter.price.$gte = Number(minPrice);
    if (maxPrice) filter.price.$lte = Number(maxPrice);
  }

  const sortOptions = {
    name: { name: 1 },
    price_asc: { price: 1 },
    price_desc: { price: -1 },
    newest: { createdAt: -1 },
  };

  const products = await Product.find(filter)
    .populate("category", "name")
    .sort(sortOptions[sort] || sortOptions.name)
    .lean();

  if (storeId) {
    if (!mongoose.isValidObjectId(storeId)) throw new AppError(400, "Invalid storeId");
    const stock = await Inventory.find({ storeId, productId: { $in: products.map((p) => p._id) } }).lean();
    const qtyByProduct = Object.fromEntries(stock.map((s) => [s.productId.toString(), s.quantity]));
    products.forEach((p) => (p.stock = qtyByProduct[p._id.toString()] ?? 0));
  }

  res.json({ success: true, count: products.length, products });
}

// GET /api/products/:id  — product + stock in every active store (for "compare stock").
export async function getProduct(req, res) {
  const product = await Product.findById(req.params.id).populate("category", "name").lean();
  if (!product) throw new AppError(404, "Product not found");

  const stock = await Inventory.find({ productId: product._id })
    .populate({ path: "storeId", select: "name city isActive" })
    .lean();
  product.availability = stock
    .filter((s) => s.storeId?.isActive)
    .map((s) => ({ storeId: s.storeId._id, storeName: s.storeId.name, city: s.storeId.city, quantity: s.quantity }));

  res.json({ success: true, product });
}

// GET /api/products/compare?ids=a,b,c  — up to 4 products side by side.
export async function compareProducts(req, res) {
  const ids = String(req.query.ids || "").split(",").filter(Boolean);
  if (ids.length < 2 || ids.length > 4) throw new AppError(400, "Select 2 to 4 products to compare");
  if (!ids.every((id) => mongoose.isValidObjectId(id))) throw new AppError(400, "Invalid product id");

  const products = await Product.find({ _id: { $in: ids } }).populate("category", "name").lean();
  const stock = await Inventory.aggregate([
    { $match: { productId: { $in: products.map((p) => p._id) } } },
    { $group: { _id: "$productId", totalStock: { $sum: "$quantity" } } },
  ]);
  const totals = Object.fromEntries(stock.map((s) => [s._id.toString(), s.totalStock]));
  products.forEach((p) => (p.totalStock = totals[p._id.toString()] ?? 0));

  res.json({ success: true, products });
}

// POST /api/products  (admin)
export async function createProduct(req, res) {
  requireFields(req.body, ["name", "category", "price"]);
  const { name, description, category, price, attributes, tags, imageUrl } = req.body;
  if (!(await Category.exists({ _id: category }))) throw new AppError(400, "Category does not exist");

  const product = await Product.create({ name, description, category, price, attributes, tags, imageUrl });

  // Create a zero-stock inventory record in every store.
  const stores = await Store.find({}, "_id");
  await Inventory.insertMany(stores.map((s) => ({ storeId: s._id, productId: product._id, quantity: 0 })));

  await logAudit(req.user._id, "PRODUCT_CREATED", "Product", product._id, { name, price });
  res.status(201).json({ success: true, product });
}

// PATCH /api/products/:id  (admin)
export async function updateProduct(req, res) {
  const allowed = ["name", "description", "category", "price", "attributes", "tags", "imageUrl", "isActive"];
  const updates = Object.fromEntries(Object.entries(req.body).filter(([k]) => allowed.includes(k)));
  const product = await Product.findByIdAndUpdate(req.params.id, updates, { returnDocument: "after", runValidators: true });
  if (!product) throw new AppError(404, "Product not found");
  await logAudit(req.user._id, "PRODUCT_UPDATED", "Product", product._id, updates);
  res.json({ success: true, product });
}
