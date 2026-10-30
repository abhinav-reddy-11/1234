import { Link } from "react-router-dom";
import { Badge, Button } from "./ui";
import { formatINR } from "../services/api";

const CATEGORY_COLORS = {
  Electronics: "from-sky-100 to-indigo-100 text-indigo-700",
  "Home & Kitchen": "from-amber-50 to-orange-100 text-orange-700",
  Groceries: "from-lime-50 to-emerald-100 text-emerald-700",
  "Personal Care": "from-pink-50 to-rose-100 text-rose-700",
  Fashion: "from-violet-50 to-fuchsia-100 text-fuchsia-700",
};

export function ProductImage({ product, className = "h-36" }) {
  const color = CATEGORY_COLORS[product.category?.name] || "from-slate-50 to-slate-100 text-slate-600";
  const initials = product.name.split(" ").slice(0, 2).map((w) => w[0]).join("");
  return product.imageUrl ? (
    <img src={product.imageUrl} alt={product.name} className={`w-full rounded-lg object-cover ${className}`} />
  ) : (
    <div className={`flex w-full items-center justify-center rounded-lg bg-gradient-to-br text-3xl font-bold ${color} ${className}`}>
      {initials}
    </div>
  );
}

export function StockBadge({ stock }) {
  if (stock === undefined) return null;
  if (stock === 0) return <Badge color="red">Out of stock</Badge>;
  if (stock <= 5) return <Badge color="yellow">Only {stock} left</Badge>;
  return <Badge color="green">In stock ({stock})</Badge>;
}

export default function ProductCard({ product, onAdd, adding, inWishlist, onWishlist, comparing, onCompare }) {
  return (
    <div className="flex flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md">
      <Link to={`/products/${product._id}`}>
        <ProductImage product={product} />
      </Link>
      <div className="mt-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs text-slate-500">{product.category?.name}</p>
          <Link to={`/products/${product._id}`} className="block truncate font-semibold text-slate-900 hover:text-indigo-700">
            {product.name}
          </Link>
        </div>
        <button
          onClick={onWishlist}
          title={inWishlist ? "Remove from wishlist" : "Add to wishlist"}
          className={`text-xl leading-none ${inWishlist ? "text-rose-500" : "text-slate-300 hover:text-rose-400"}`}
        >
          ♥
        </button>
      </div>
      <p className="mt-1 text-lg font-bold text-slate-900">{formatINR(product.price)}</p>
      <div className="mt-1"><StockBadge stock={product.stock} /></div>
      <div className="mt-auto flex items-center justify-between gap-2 pt-4">
        <label className="flex cursor-pointer items-center gap-1.5 text-xs text-slate-600">
          <input type="checkbox" checked={comparing} onChange={onCompare} className="accent-indigo-600" /> Compare
        </label>
        <Button size="sm" onClick={onAdd} busy={adding} disabled={product.stock === 0}>Add to cart</Button>
      </div>
    </div>
  );
}
