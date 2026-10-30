import { Link } from "react-router-dom";
import { formatINR } from "../../services/api";
import { useApi } from "../../hooks/useApi";
import { useShop } from "../../context/ShopContext";
import { ProductImage } from "../../components/ProductCard";
import { Button, EmptyState, ErrorBox, Loading, PageHeader } from "../../components/ui";

export default function Compare() {
  const { compareIds, setCompareIds } = useShop();
  const { data, loading, error } = useApi(compareIds.length >= 2 ? `/products/compare?ids=${compareIds.join(",")}` : null);

  if (compareIds.length < 2) {
    return (
      <EmptyState title="Pick at least 2 products to compare" text="Tick “Compare” on products in the shop."
        action={<Link to="/shop"><Button>Go to shop</Button></Link>} />
    );
  }
  if (loading) return <Loading />;
  if (error) return <ErrorBox message={error} />;

  const products = data.products;
  const attrKeys = [...new Set(products.flatMap((p) => Object.keys(p.attributes || {})))];
  const cheapest = Math.min(...products.map((p) => p.price));

  const rows = [
    ["Category", (p) => p.category?.name],
    ["Price", (p) => <span className={p.price === cheapest ? "font-bold text-emerald-600" : ""}>{formatINR(p.price)}</span>],
    ["Total stock (all stores)", (p) => p.totalStock],
    ...attrKeys.map((k) => [k.replace(/([A-Z])/g, " $1"), (p) => p.attributes?.[k] ?? "—"]),
    ["Tags", (p) => p.tags?.join(", ")],
  ];

  return (
    <div>
      <PageHeader title="Compare products" actions={<Button variant="secondary" onClick={() => setCompareIds([])}>Clear comparison</Button>} />
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead>
            <tr>
              <th className="w-44 p-4" />
              {products.map((p) => (
                <th key={p._id} className="min-w-48 p-4 text-left align-top">
                  <ProductImage product={p} className="h-24" />
                  <Link to={`/products/${p._id}`} className="mt-2 block font-semibold text-slate-900 hover:text-indigo-700">{p.name}</Link>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map(([label, render]) => (
              <tr key={label}>
                <td className="p-4 font-medium capitalize text-slate-500">{label}</td>
                {products.map((p) => <td key={p._id} className="p-4">{render(p)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
