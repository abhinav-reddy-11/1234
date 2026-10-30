import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api } from "../services/api";
import { useAuth } from "./AuthContext";

// Customer-only shared state: stores list, selected store, cart count, compare list.
const ShopContext = createContext(null);

export function ShopProvider({ children }) {
  const { user } = useAuth();
  const [stores, setStores] = useState([]);
  const [storeId, setStoreIdState] = useState(localStorage.getItem("rp_store") || "");
  const [cartCount, setCartCount] = useState(0);
  const [compareIds, setCompareIds] = useState([]);

  useEffect(() => {
    api.get("/stores").then(({ stores }) => {
      setStores(stores);
      setStoreIdState((current) => (stores.some((s) => s._id === current) ? current : stores[0]?._id || ""));
    }).catch(() => {});
  }, []);

  const setStoreId = (id) => {
    localStorage.setItem("rp_store", id);
    setStoreIdState(id);
  };

  const refreshCart = useCallback(async () => {
    if (user?.role !== "customer") return;
    try {
      const { items } = await api.get("/cart");
      setCartCount(items.reduce((n, i) => n + i.quantity, 0));
    } catch {
      /* ignore */
    }
  }, [user]);

  useEffect(() => {
    refreshCart();
  }, [refreshCart]);

  const toggleCompare = (id) =>
    setCompareIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : ids.length >= 4 ? ids : [...ids, id]));

  const store = stores.find((s) => s._id === storeId);

  return (
    <ShopContext.Provider
      value={{ stores, store, storeId, setStoreId, cartCount, refreshCart, compareIds, toggleCompare, setCompareIds }}
    >
      {children}
    </ShopContext.Provider>
  );
}

export const useShop = () => useContext(ShopContext);
