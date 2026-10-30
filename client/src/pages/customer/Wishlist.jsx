import { Link } from "react-router-dom";
import { api, formatINR } from "../../services/api";
import { useApi } from "../../hooks/useApi";
import { useShop } from "../../context/ShopContext";
import { ProductImage } from "../../components/ProductCard";
import { Button, Card, EmptyState, ErrorBox, Loading, PageHeader } from "../../components/ui";

export default function Wishlist() {
  const { data, loading, error, reload } = useApi("/wishlist");
  const { refreshCart } = useShop();

  const remove = async (id) => { await api.post(`/wishlist/${id}`); reload(); };
  const moveToCart = async (id) => {
    await api.post("/cart", { productId: id, quantity: 1 });
    await api.post(`/wishlist/${id}`);
    await refreshCart();
    reload();
  };

  if (loading) return <Loading />;
  return (
    <div>
      <PageHeader title="Wishlist" />
      <ErrorBox message={error} onRetry={reload} />
      {data?.products.length === 0 ? (
        <EmptyState title="Your wishlist is empty" text="Tap the ♥ on any product to save it here." action={<Link to="/shop"><Button>Browse products</Button></Link>} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {data?.products.map((p) => (
            <Card key={p._id} className="p-4">
              <ProductImage product={p} className="h-28" />
              <Link to={`/products/${p._id}`} className="mt-2 block font-semibold hover:text-indigo-700">{p.name}</Link>
              <p className="font-bold">{formatINR(p.price)}</p>
              <div className="mt-3 flex gap-2">
                <Button size="sm" onClick={() => moveToCart(p._id)}>Move to cart</Button>
                <Button size="sm" variant="ghost" onClick={() => remove(p._id)}>Remove</Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
