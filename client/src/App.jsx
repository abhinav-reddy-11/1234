import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth, homePathFor } from "./context/AuthContext";
import ProtectedRoute from "./routes/ProtectedRoute";
import AppLayout from "./layouts/AppLayout";
import { Loading } from "./components/ui";

import Login from "./pages/auth/Login";
import Register from "./pages/auth/Register";

import Shop from "./pages/customer/Shop";
import ProductDetail from "./pages/customer/ProductDetail";
import Compare from "./pages/customer/Compare";
import Cart from "./pages/customer/Cart";
import MyOrders from "./pages/customer/MyOrders";
import Wishlist from "./pages/customer/Wishlist";
import Membership from "./pages/customer/Membership";
import Assistant from "./pages/customer/Assistant";

import ManagerDashboard from "./pages/manager/ManagerDashboard";
import Restock from "./pages/manager/Restock";

import OrdersBoard from "./pages/shared/OrdersBoard";
import InventoryPage from "./pages/shared/InventoryPage";
import PurchaseOrders from "./pages/shared/PurchaseOrders";

import AdminDashboard from "./pages/admin/AdminDashboard";
import Products from "./pages/admin/Products";
import Stores from "./pages/admin/Stores";
import Users from "./pages/admin/Users";
import Policies from "./pages/admin/Policies";
import PolicyTester from "./pages/admin/PolicyTester";
import AuditLogs from "./pages/admin/AuditLogs";

function Home() {
  const { user, loading } = useAuth();
  if (loading) return <Loading />;
  return <Navigate to={user ? homePathFor(user.role) : "/login"} replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      <Route element={<ProtectedRoute roles={["customer"]} />}>
        <Route element={<AppLayout />}>
          <Route path="/shop" element={<Shop />} />
          <Route path="/products/:id" element={<ProductDetail />} />
          <Route path="/compare" element={<Compare />} />
          <Route path="/cart" element={<Cart />} />
          <Route path="/orders" element={<MyOrders />} />
          <Route path="/wishlist" element={<Wishlist />} />
          <Route path="/membership" element={<Membership />} />
          <Route path="/assistant" element={<Assistant />} />
        </Route>
      </Route>

      <Route element={<ProtectedRoute roles={["manager"]} />}>
        <Route element={<AppLayout />}>
          <Route path="/manager" element={<ManagerDashboard />} />
          <Route path="/manager/orders" element={<OrdersBoard />} />
          <Route path="/manager/inventory" element={<InventoryPage />} />
          <Route path="/manager/restock" element={<Restock />} />
          <Route path="/manager/purchase-orders" element={<PurchaseOrders />} />
        </Route>
      </Route>

      <Route element={<ProtectedRoute roles={["admin"]} />}>
        <Route element={<AppLayout />}>
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin/orders" element={<OrdersBoard />} />
          <Route path="/admin/inventory" element={<InventoryPage />} />
          <Route path="/admin/purchase-orders" element={<PurchaseOrders />} />
          <Route path="/admin/products" element={<Products />} />
          <Route path="/admin/stores" element={<Stores />} />
          <Route path="/admin/users" element={<Users />} />
          <Route path="/admin/policies" element={<Policies />} />
          <Route path="/admin/policy-test" element={<PolicyTester />} />
          <Route path="/admin/audit" element={<AuditLogs />} />
        </Route>
      </Route>

      <Route path="*" element={<Home />} />
    </Routes>
  );
}
