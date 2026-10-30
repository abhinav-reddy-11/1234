import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useShop } from "../context/ShopContext";
import { TierBadge, Select } from "../components/ui";

const NAV = {
  customer: [
    ["/shop", "Shop"],
    ["/assistant", "AI Assistant"],
    ["/cart", "Cart"],
    ["/wishlist", "Wishlist"],
    ["/orders", "My Orders"],
    ["/membership", "Membership"],
  ],
  manager: [
    ["/manager", "Dashboard"],
    ["/manager/orders", "Orders"],
    ["/manager/inventory", "Inventory"],
    ["/manager/restock", "AI Restock"],
    ["/manager/purchase-orders", "Purchase Orders"],
  ],
  admin: [
    ["/admin", "Dashboard"],
    ["/admin/orders", "Orders"],
    ["/admin/inventory", "Inventory"],
    ["/admin/purchase-orders", "Purchase Orders"],
    ["/admin/products", "Products"],
    ["/admin/stores", "Stores"],
    ["/admin/users", "Users"],
    ["/admin/policies", "Policies"],
    ["/admin/policy-test", "Policy Assistant"],
    ["/admin/audit", "Audit Logs"],
  ],
};

export default function AppLayout() {
  const { user, logout } = useAuth();
  const shop = useShop();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const links = NAV[user.role];

  const navItem = ({ isActive }) =>
    `block rounded-lg px-3 py-2 text-sm font-medium transition ${
      isActive ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
    }`;

  return (
    <div className="min-h-screen md:flex">
      {/* Sidebar */}
      <aside className={`${open ? "block" : "hidden"} border-b border-slate-200 bg-white md:sticky md:top-0 md:block md:h-screen md:w-60 md:shrink-0 md:border-b-0 md:border-r`}>
        <div className="hidden items-center gap-2 px-5 py-5 md:flex">
          <img src="/favicon.svg" alt="" className="h-8 w-8" />
          <div>
            <p className="font-bold leading-tight text-slate-900">RetailPulse AI</p>
            <p className="text-xs capitalize text-slate-500">{user.role} portal</p>
          </div>
        </div>
        <nav className="space-y-1 px-3 pb-4 md:pb-0">
          {links.map(([to, label]) => (
            <NavLink key={to} to={to} end={to.split("/").length <= 2} className={navItem} onClick={() => setOpen(false)}>
              {label}
              {to === "/cart" && shop.cartCount > 0 && (
                <span className="ml-2 rounded-full bg-indigo-600 px-2 py-0.5 text-xs text-white">{shop.cartCount}</span>
              )}
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="min-w-0 flex-1">
        {/* Top bar */}
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur md:px-8">
          <button className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm md:hidden" onClick={() => setOpen(!open)}>
            Menu
          </button>
          <div className="flex items-center gap-3">
            {user.role === "customer" && shop.stores.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="hidden text-sm text-slate-500 sm:inline">Store</span>
                <div className="w-52">
                  <Select value={shop.storeId} onChange={(e) => shop.setStoreId(e.target.value)} aria-label="Select store">
                    {shop.stores.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
                  </Select>
                </div>
              </div>
            )}
            {user.role === "manager" && user.storeId && (
              <span className="text-sm text-slate-600">Store: <b>{user.storeId.name}</b></span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium text-slate-800">{user.name}</p>
              <p className="text-xs text-slate-500">{user.email}</p>
            </div>
            {user.role === "customer" && <TierBadge tier={user.tier} />}
            <button
              onClick={() => { logout(); navigate("/login"); }}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
            >
              Log out
            </button>
          </div>
        </header>

        <main className="mx-auto max-w-7xl px-4 py-6 md:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
