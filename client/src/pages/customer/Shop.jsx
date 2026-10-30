import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../services/api";
import { useApi } from "../../hooks/useApi";
import { useShop } from "../../context/ShopContext";
import ProductCard from "../../components/ProductCard";
import { Button, EmptyState, ErrorBox, Input, Loading, PageHeader, Select, SuccessBox } from "../../components/ui";

export default function Shop() {
  const { store, storeId, refreshCart, compareIds, toggleCompare } = useShop();
  const navigate = useNavigate();
  const [filters, setFilters] = useState({ search: "", category: "", sort: "name", minPrice: "", maxPrice: "" });
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [wishlist, setWishlist] = useState(new Set());
  const [addingId, setAddingId] = useState(null);
  const [notice, setNotice] = useState("");
  const [actionError, setActionError] = useState("");

  const { data: catData } = useApi("/categories");

  // Wait 300 ms after typing before searching.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(filters.search), 300);
    return () => clearTimeout(t);
  }, [filters.search]);

  const query = useMemo(() => {
    const p = new URLSearchParams({ sort: filters.sort, storeId });
    if (debouncedSearch) p.set("search", debouncedSearch);
    if (filters.category) p.set("category", filters.category);
    if (filters.minPrice) p.set("minPrice", filters.minPrice);
    if (filters.maxPrice) p.set("maxPrice", filters.maxPrice);
    return `/products?${p}`;
  }, [debouncedSearch, filters.category, filters.sort, filters.minPrice, filters.maxPrice, storeId]);

  const { data, loading, error, reload } = useApi(storeId ? query : null);

  useEffect(() => {
    api.get("/wishlist").then(({ products }) => setWishlist(new Set(products.map((p) => p._id)))).catch(() => {});
  }, []);

  const set = (k) => (e) => setFilters({ ...filters, [k]: e.target.value });

  const addToCart = async (product) => {
    setAddingId(product._id);
    setActionError("");
    try {
      const { items } = await api.get("/cart");
      const current = items.find((i) => i.product._id === product._id)?.quantity || 0;
      await api.post("/cart", { productId: product._id, quantity: current + 1 });
      await refreshCart();
      setNotice(`Added "${product.name}" to your cart.`);
      setTimeout(() => setNotice(""), 2500);
    } catch (err) {
      setActionError(err.message);
    } finally {
      setAddingId(null);
    }
  };

  const toggleWishlist = async (id) => {
    try {
      const { inWishlist } = await api.post(`/wishlist/${id}`);
      setWishlist((w) => { const n = new Set(w); inWishlist ? n.add(id) : n.delete(id); return n; });
    } catch (err) {
      setActionError(err.message);
    }
  };

  return (
    <div className="pb-20">
      <PageHeader title="Shop" subtitle={store ? `Showing live stock at ${store.name}, ${store.city}` : "Select a store to see availability"} />

      <div className="mb-6 grid gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <Input placeholder="Search products or tags (e.g. wireless, kitchen)" value={filters.search} onChange={set("search")} />
        </div>
        <Select value={filters.category} onChange={set("category")} aria-label="Category">
          <option value="">All categories</option>
          {catData?.categories.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
        </Select>
        <Select value={filters.sort} onChange={set("sort")} aria-label="Sort">
          <option value="name">Name (A–Z)</option>
          <option value="price_asc">Price: low to high</option>
          <option value="price_desc">Price: high to low</option>
          <option value="newest">Newest</option>
        </Select>
        <div className="flex gap-2">
          <Input type="number" min="0" placeholder="Min ₹" value={filters.minPrice} onChange={set("minPrice")} />
          <Input type="number" min="0" placeholder="Max ₹" value={filters.maxPrice} onChange={set("maxPrice")} />
        </div>
      </div>

      <SuccessBox message={notice} />
      <ErrorBox message={actionError || error} onRetry={error ? reload : undefined} />

      {loading ? (
        <Loading text="Loading products..." />
      ) : data?.products.length === 0 ? (
        <EmptyState title="No products found" text="Try a different search, category or price range." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {data?.products.map((p) => (
            <ProductCard
              key={p._id}
              product={p}
              adding={addingId === p._id}
              onAdd={() => addToCart(p)}
              inWishlist={wishlist.has(p._id)}
              onWishlist={() => toggleWishlist(p._id)}
              comparing={compareIds.includes(p._id)}
              onCompare={() => toggleCompare(p._id)}
            />
          ))}
        </div>
      )}

      {compareIds.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-4 py-3 shadow-lg backdrop-blur">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
            <span className="text-sm text-slate-600">
              {compareIds.length} product{compareIds.length > 1 ? "s" : ""} selected for comparison (2–4)
            </span>
            <Button disabled={compareIds.length < 2} onClick={() => navigate("/compare")}>Compare now</Button>
          </div>
        </div>
      )}
    </div>
  );
}
