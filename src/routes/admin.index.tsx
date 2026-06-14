import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState, useCallback, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Cake, LayoutGrid, ShoppingBag, LogOut, Store,
  Boxes, CheckCircle2, XCircle, Tag, Plus, Pencil, Trash2, Upload, X,
  DollarSign, Building2, BarChart3, FileUp, TrendingUp, AlertCircle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { CostsSection, PremisesSection, SalesSection } from "@/components/sweet-bloom/AdminFinance";
import { listCosts, listPremises, getSalesAnalytics } from "@/lib/admin-finance.functions";
import "@/components/sweet-bloom/menu-admin.css";

export const Route = createFileRoute("/admin/")({
  head: () => ({ meta: [{ title: "Menu Management — Selam Cake & Arts" }] }),
  component: AdminDashboard,
});

const fmtBirr = (n: number) =>
  `Birr ${Number(n).toLocaleString("en-US", { maximumFractionDigits: 2 })}`;

type Section = "overview" | "orders" | "menu" | "costs" | "premises" | "sales";

type ShopItem = {
  id: string;
  name: string;
  sub: string;
  cat: string;
  price: number;
  img: string;
  available: boolean;
  sort_order: number;
};

const CATEGORIES = ["Fasting", "Kerestena", "Yeshemgelena", "Graduation", "Wedding", "Birthday", "Available Today"];

type OrderRow = {
  id: string;
  customer_name: string | null;
  customer_phone: string | null;
  customer_address: string | null;
  items: { name: string; qty: number; price: number; img?: string | null }[];
  total: number;
  status: string;
  created_at: string;
};

function AdminDashboard() {
  const nav = useNavigate();
  const [ready, setReady] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [section, setSection] = useState<Section>("overview");

  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [items, setItems] = useState<ShopItem[]>([]);
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [filterCat, setFilterCat] = useState<string>("All");
  const [filterAvail, setFilterAvail] = useState<"all" | "in" | "out">("all");
  const [editing, setEditing] = useState<ShopItem | null>(null);

  // KPI summary state (last 30 days)
  const [kpi, setKpi] = useState<{
    revenue: number; units: number; orderCount: number;
    costIngredients: number; costPackaging: number; costMisc: number; costTotal: number;
    unpaidPremises: number;
  } | null>(null);
  const fetchCosts = useServerFn(listCosts);
  const fetchPremises = useServerFn(listPremises);
  const fetchAnalytics = useServerFn(getSalesAnalytics);

  const loadKpi = useCallback(async () => {
    try {
      const fromISO = new Date(Date.now() - 30 * 86400_000).toISOString();
      const toISO = new Date().toISOString();
      const fromDate = fromISO.slice(0, 10);
      const toDate = toISO.slice(0, 10);
      const [sales, costsRes, premRes] = await Promise.all([
        fetchAnalytics({ data: { granularity: "day", from: fromISO, to: toISO } }),
        fetchCosts({ data: { from: fromDate, to: toDate } }),
        fetchPremises({ data: {} }),
      ]);
      const costs = (costsRes.costs ?? []) as { category: string; cost_amount: number }[];
      const premises = (premRes.premises ?? []) as { status: string; amount: number }[];
      const byCat = costs.reduce((a: Record<string, number>, c) => {
        a[c.category] = (a[c.category] || 0) + Number(c.cost_amount); return a;
      }, {});
      setKpi({
        revenue: Number(sales.totals?.revenue) || 0,
        units: Number(sales.totals?.units_sold) || 0,
        orderCount: Number(sales.totals?.order_count) || 0,
        costIngredients: byCat.ingredients || 0,
        costPackaging: byCat.packaging || 0,
        costMisc: byCat.miscellaneous || 0,
        costTotal: costs.reduce((s, c) => s + Number(c.cost_amount), 0),
        unpaidPremises: premises.filter(p => p.status !== "paid").reduce((s, p) => s + Number(p.amount), 0),
      });
    } catch (e: any) {
      console.error("KPI load failed", e);
    }
  }, [fetchAnalytics, fetchCosts, fetchPremises]);

  const loadOrders = useCallback(async () => {
    const { data, error } = await supabase
      .from("orders")
      .select("id, customer_name, customer_phone, customer_address, items, total, status, created_at")
      .order("created_at", { ascending: false });
    if (error) { console.error("Load orders failed", error); return; }
    setOrders((data ?? []) as OrderRow[]);
  }, []);

  const loadItems = useCallback(async () => {
    const { data, error } = await supabase
      .from("shop_items" as any)
      .select("id, name, sub, cat, price, img, available, sort_order")
      .order("cat", { ascending: true })
      .order("sort_order", { ascending: true });
    if (error) { console.error("Load shop items failed", error); return; }
    setItems(((data ?? []) as unknown) as ShopItem[]);
  }, []);

  async function toggleAvail(it: ShopItem) {
    setBusy((b) => ({ ...b, [it.id]: true }));
    setItems((arr) => arr.map((x) => x.id === it.id ? { ...x, available: !it.available } : x));
    const { error } = await supabase
      .from("shop_items" as any)
      .update({ available: !it.available })
      .eq("id", it.id);
    if (error) {
      alert("Update failed: " + error.message);
      setItems((arr) => arr.map((x) => x.id === it.id ? { ...x, available: it.available } : x));
    }
    setBusy((b) => ({ ...b, [it.id]: false }));
  }

  async function deleteItem(it: ShopItem) {
    if (!confirm(`Delete "${it.name}"? This cannot be undone.`)) return;
    const prev = items;
    setItems((arr) => arr.filter((x) => x.id !== it.id));
    const { error } = await supabase.from("shop_items" as any).delete().eq("id", it.id);
    if (error) { alert("Delete failed: " + error.message); setItems(prev); }
  }

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { nav({ to: "/admin/login" }); return; }
      const { data: roles } = await supabase
        .from("user_roles").select("role").eq("user_id", session.user.id);
      const admin = !!roles?.some((r: any) => r.role === "admin");
      setIsAdmin(admin);
      setReady(true);
      if (admin) { loadOrders(); loadItems(); loadKpi(); }
    })();
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!session) nav({ to: "/admin/login" });
    });
    return () => sub.subscription.unsubscribe();
  }, [nav, loadOrders, loadItems, loadKpi]);

  useEffect(() => {
    if (!isAdmin) return;
    const ch = supabase
      .channel("shop_items_admin")
      .on("postgres_changes", { event: "*", schema: "public", table: "shop_items" }, () => loadItems())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [isAdmin, loadItems]);

  useEffect(() => {
    if (!isAdmin) return;
    const channel = supabase
      .channel("orders_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => loadOrders())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [isAdmin, loadOrders]);

  if (!ready) return null;

  async function logout() {
    await supabase.auth.signOut();
    nav({ to: "/admin/login" });
  }

  if (!isAdmin) {
    return (
      <div className="ma-denied">
        <div className="box">
          <h1>Access denied</h1>
          <p>This account is read-only. Only the owner / manager can edit the menu.</p>
          <button className="ma-edit-btn" onClick={logout}>Sign out</button>
        </div>
      </div>
    );
  }

  const totalItems = items.length;
  const available = items.filter((i) => i.available).length;
  const soldOut = totalItems - available;
  const newOrders = orders.filter((o) => o.status === "new").length;

  const filteredItems = items.filter((it) => {
    if (filterCat !== "All" && it.cat !== filterCat) return false;
    if (filterAvail === "in" && !it.available) return false;
    if (filterAvail === "out" && it.available) return false;
    return true;
  });

  async function setOrderStatus(id: string, status: string) {
    setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, status } : o)));
    const { error } = await supabase.from("orders").update({ status }).eq("id", id);
    if (error) { alert("Could not update status: " + error.message); loadOrders(); }
  }

  const navItems: { id: Section; label: string; icon: any }[] = [
    { id: "overview", label: "Overview", icon: LayoutGrid },
    { id: "orders", label: "Orders", icon: ShoppingBag },
    { id: "menu", label: "Shop Items", icon: Tag },
    { id: "sales", label: "Sales Tracking", icon: BarChart3 },
    { id: "costs", label: "Costs", icon: DollarSign },
    { id: "premises", label: "Premises", icon: Building2 },
  ];

  return (
    <div className="ma-shell">
      <aside className="ma-sidebar">
        <div className="ma-logo">
          <span className="ma-logo-icon"><Cake size={22} /></span>
          <span>
            <b>Selam Cake</b>
            <span>&amp; Arts</span>
          </span>
        </div>

        <nav className="ma-nav">
          {navItems.map((it) => {
            const Icon = it.icon;
            return (
              <button
                key={it.id}
                className={"ma-nav-item" + (section === it.id ? " active" : "")}
                type="button"
                onClick={() => setSection(it.id)}
              >
                <Icon size={19} /> {it.label}
              </button>
            );
          })}
        </nav>

        <div className="ma-sidebar-foot">
          <Link to="/admin/import" className="ma-nav-item">
            <FileUp size={19} /> Bulk Import
          </Link>
          <Link to="/" className="ma-nav-item">
            <Store size={19} /> View Shop
          </Link>
          <button className="ma-nav-item" type="button" onClick={logout}>
            <LogOut size={19} /> Sign Out
          </button>
        </div>
      </aside>

      <main className="ma-main">
        {section === "overview" && (
          <>
            <h1 className="ma-page-title">Overview</h1>
            <p className="ma-page-sub">A quick snapshot of your shop today. Financial KPIs cover the last 30 days.</p>

            {/* Financial KPI cards */}
            <div className="ma-stats">
              <div className="ma-stat">
                <span className="ma-stat-icon green"><TrendingUp size={22} /></span>
                <span className="ma-stat-val">{kpi ? fmtBirr(kpi.revenue) : "—"}</span>
                <span className="ma-stat-label">Revenue (30d)</span>
              </div>
              <div className="ma-stat">
                <span className="ma-stat-icon"><BarChart3 size={22} /></span>
                <span className="ma-stat-val">{kpi ? kpi.units : "—"}</span>
                <span className="ma-stat-label">Units Sold (30d)</span>
              </div>
              <div className="ma-stat">
                <span className="ma-stat-icon"><DollarSign size={22} /></span>
                <span className="ma-stat-val">{kpi ? fmtBirr(kpi.costTotal) : "—"}</span>
                <span className="ma-stat-label">Total Costs (30d)</span>
              </div>
              <div className="ma-stat">
                <span className="ma-stat-val">{kpi ? fmtBirr(kpi.costIngredients) : "—"}</span>
                <span className="ma-stat-label">· Ingredients</span>
              </div>
              <div className="ma-stat">
                <span className="ma-stat-val">{kpi ? fmtBirr(kpi.costPackaging) : "—"}</span>
                <span className="ma-stat-label">· Packaging</span>
              </div>
              <div className="ma-stat">
                <span className="ma-stat-val">{kpi ? fmtBirr(kpi.costMisc) : "—"}</span>
                <span className="ma-stat-label">· Miscellaneous</span>
              </div>
              <div className="ma-stat">
                <span className="ma-stat-icon red"><AlertCircle size={22} /></span>
                <span className="ma-stat-val">{kpi ? fmtBirr(kpi.unpaidPremises) : "—"}</span>
                <span className="ma-stat-label">Unpaid Premises</span>
              </div>
            </div>

            {/* Inventory & order overview */}
            <div className="ma-stats">
              <div className="ma-stat">
                <span className="ma-stat-icon"><Boxes size={22} /></span>
                <span className="ma-stat-val">{totalItems}</span>
                <span className="ma-stat-label">Total Items</span>
              </div>
              <div className="ma-stat">
                <span className="ma-stat-icon green"><CheckCircle2 size={22} /></span>
                <span className="ma-stat-val">{available}</span>
                <span className="ma-stat-label">Available</span>
              </div>
              <div className="ma-stat">
                <span className="ma-stat-icon red"><XCircle size={22} /></span>
                <span className="ma-stat-val">{soldOut}</span>
                <span className="ma-stat-label">Sold Out</span>
              </div>
              <div className="ma-stat">
                <span className="ma-stat-icon"><ShoppingBag size={22} /></span>
                <span className="ma-stat-val">{orders.length}</span>
                <span className="ma-stat-label">Total Orders</span>
              </div>
              <div className="ma-stat">
                <span className="ma-stat-icon green"><ShoppingBag size={22} /></span>
                <span className="ma-stat-val">{newOrders}</span>
                <span className="ma-stat-label">New Orders</span>
              </div>
            </div>

            <section className="ma-card">
              <div className="ma-card-head">
                <h2>Recent Orders</h2>
                <button className="ma-add-btn" type="button" onClick={() => setSection("orders")}>
                  View all
                </button>
              </div>
              <div className="ma-table-wrap">
                {orders.length === 0 ? (
                  <div className="ma-empty-state">No orders yet.</div>
                ) : (
                  <table className="ma-table">
                    <thead>
                      <tr><th>Customer</th><th>Items</th><th>Total</th><th>Status</th></tr>
                    </thead>
                    <tbody>
                      {orders.slice(0, 5).map((o) => (
                        <tr key={o.id}>
                          <td><span className="ma-cake-name">{o.customer_name || "—"}</span></td>
                          <td>{o.items.reduce((s, i) => s + i.qty, 0)} item(s)</td>
                          <td><span className="ma-price">{fmtBirr(o.total)}</span></td>
                          <td><span className={"ma-order-status " + o.status}>{o.status}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </section>
          </>
        )}

        {section === "orders" && (
          <>
            <h1 className="ma-page-title">Orders</h1>
            <p className="ma-page-sub">Every order customers send from the shop.</p>
            <section className="ma-card">
              <div className="ma-card-head">
                <h2>All Orders ({orders.length})</h2>
                <button className="ma-add-btn" type="button" onClick={loadOrders}>Refresh</button>
              </div>
              <div className="ma-table-wrap">
                {orders.length === 0 ? (
                  <div className="ma-empty-state">No orders yet. They'll appear here in real time.</div>
                ) : (
                  <table className="ma-table">
                    <thead>
                      <tr>
                        <th>Customer</th><th>Items</th><th>Total</th><th>Placed</th><th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orders.map((o) => (
                        <tr key={o.id}>
                          <td>
                            <div className="ma-cake-name">{o.customer_name || "—"}</div>
                            <div style={{ fontSize: 13, color: "#9a8b7c" }}>{o.customer_phone || ""}</div>
                            {o.customer_address && (
                              <div style={{ fontSize: 12, color: "#9a8b7c" }}>📍 {o.customer_address}</div>
                            )}
                          </td>
                          <td>
                            <ul className="ma-order-items">
                              {o.items.map((it, i) => (
                                <li key={i}>{it.name} × {it.qty}</li>
                              ))}
                            </ul>
                          </td>
                          <td><span className="ma-price">{fmtBirr(o.total)}</span></td>
                          <td style={{ fontSize: 13, color: "#9a8b7c" }}>
                            {new Date(o.created_at).toLocaleString()}
                          </td>
                          <td>
                            <select
                              className="ma-status-select"
                              value={o.status}
                              onChange={(e) => setOrderStatus(o.id, e.target.value)}
                            >
                              <option value="new">New</option>
                              <option value="preparing">Preparing</option>
                              <option value="done">Done</option>
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </section>
          </>
        )}

        {section === "menu" && (
          <>
            <h1 className="ma-page-title">Shop Items</h1>
            <p className="ma-page-sub">Add, edit, upload photos, and toggle availability. Changes appear instantly on the shop.</p>

            <section className="ma-card">
              <div className="ma-card-head" style={{ flexWrap: "wrap", gap: 10 }}>
                <h2>Inventory ({filteredItems.length}/{items.length})</h2>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                  <select value={filterCat} onChange={(e) => setFilterCat(e.target.value)}
                    className="ma-status-select" style={{ minWidth: 140 }}>
                    <option value="All">All categories</option>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <select value={filterAvail} onChange={(e) => setFilterAvail(e.target.value as any)}
                    className="ma-status-select" style={{ minWidth: 130 }}>
                    <option value="all">All status</option>
                    <option value="in">Available</option>
                    <option value="out">Sold Out</option>
                  </select>
                  <button className="ma-add-btn" type="button" onClick={() => setEditing({
                    id: "", name: "", sub: "", cat: CATEGORIES[0], price: 0, img: "", available: true, sort_order: 100,
                  })}>
                    <Plus size={16} style={{ marginRight: 4 }} /> New Item
                  </button>
                </div>
              </div>
              <div className="ma-table-wrap">
                <table className="ma-table">
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th>Category</th>
                      <th>Price</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredItems.map((it) => {
                      const on = it.available;
                      const b = !!busy[it.id];
                      return (
                        <tr key={it.id}>
                          <td>
                            <div className="ma-cake-cell">
                              <img className="ma-thumb" src={it.img || "https://via.placeholder.com/60?text=%3F"} alt={it.name} loading="lazy" />
                              <div>
                                <div className="ma-cake-name">{it.name}</div>
                                <div style={{ fontSize: 12, color: "#9a8b7c", maxWidth: 320 }}>{it.sub}</div>
                              </div>
                            </div>
                          </td>
                          <td><span className="ma-cat-tag">{it.cat}</span></td>
                          <td><span className="ma-price">{fmtBirr(it.price)}</span></td>
                          <td>
                            <span style={{
                              display: "inline-block", fontSize: 11, fontWeight: 800, letterSpacing: ".06em",
                              textTransform: "uppercase", padding: "4px 10px", borderRadius: 999,
                              background: on ? "#dcfce7" : "#fee2e2", color: on ? "#047857" : "#b91c1c",
                            }}>
                              {on ? "Available" : "Sold Out"}
                            </span>
                          </td>
                          <td>
                            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                              <button
                                type="button"
                                className={"ma-switch" + (on ? " on" : "")}
                                role="switch"
                                aria-checked={on}
                                disabled={b}
                                aria-label={`Toggle availability for ${it.name}`}
                                onClick={() => toggleAvail(it)}
                              />
                              <button className="ma-add-btn" style={{ padding: "6px 10px" }} onClick={() => setEditing(it)} title="Edit">
                                <Pencil size={14} />
                              </button>
                              <button className="ma-add-btn" style={{ padding: "6px 10px", background: "#fee2e2", color: "#b91c1c", borderColor: "#fecaca" }} onClick={() => deleteItem(it)} title="Delete">
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}

        {section === "costs" && <CostsSection />}
        {section === "premises" && <PremisesSection />}
        {section === "sales" && <SalesSection />}
      </main>

      {editing && (
        <ItemEditor
          initial={editing}
          existingIds={items.map(i => i.id)}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); loadItems(); }}
        />
      )}
    </div>
  );
}

function ItemEditor({ initial, existingIds, onClose, onSaved }: {
  initial: ShopItem;
  existingIds: string[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const isNew = !initial.id;
  const [form, setForm] = useState<ShopItem>(initial);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function update<K extends keyof ShopItem>(k: K, v: ShopItem[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function uploadFile(file: File) {
    setUploading(true);
    try {
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const baseId = form.id || `item-${Date.now()}`;
      const path = `items/${baseId}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("cake-images").upload(path, file, {
        upsert: true, contentType: file.type || "image/jpeg",
      });
      if (upErr) { alert("Upload failed: " + upErr.message); return; }
      // Bucket is private — use a long-lived signed URL (10 years)
      const { data, error: sErr } = await supabase.storage.from("cake-images").createSignedUrl(path, 60 * 60 * 24 * 365 * 10);
      if (sErr || !data) { alert("Could not get image URL: " + (sErr?.message || "unknown")); return; }
      update("img", data.signedUrl);
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    if (!form.name.trim()) { alert("Name is required"); return; }
    if (!form.cat) { alert("Category is required"); return; }
    let id = form.id.trim();
    if (isNew) {
      if (!id) id = `itm-${Date.now()}`;
      if (existingIds.includes(id)) { alert("ID already exists, pick another"); return; }
    }
    setSaving(true);
    const payload = {
      id, name: form.name.trim(), sub: form.sub, cat: form.cat,
      price: Number(form.price) || 0, img: form.img,
      available: !!form.available, sort_order: Number(form.sort_order) || 0,
    };
    const { error } = isNew
      ? await supabase.from("shop_items" as any).insert(payload)
      : await supabase.from("shop_items" as any).update(payload).eq("id", initial.id);
    setSaving(false);
    if (error) { alert("Save failed: " + error.message); return; }
    onSaved();
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 500,
        background: "rgba(46,21,3,.55)", backdropFilter: "blur(8px)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#FDF6EE", borderRadius: 22, width: "100%", maxWidth: 560,
          maxHeight: "90dvh", overflow: "auto", boxShadow: "0 30px 80px rgba(0,0,0,.35)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 22px", borderBottom: "1px solid rgba(240,184,174,.4)" }}>
          <h2 style={{ fontWeight: 800, color: "#2E1503", fontSize: "1.15rem", margin: 0 }}>
            {isNew ? "New Shop Item" : "Edit Item"}
          </h2>
          <button onClick={onClose} aria-label="Close" style={{
            width: 36, height: 36, borderRadius: "50%", border: "none", cursor: "pointer",
            background: "#F9D9D3", display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <X size={16} />
          </button>
        </div>

        <div style={{ padding: 22, display: "grid", gap: 14 }}>
          <div style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: 14, alignItems: "start" }}>
            <div>
              <div style={{
                width: 120, height: 120, borderRadius: 16, overflow: "hidden",
                background: "#F9D9D3", display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                {form.img ? (
                  <img src={form.img} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  <span style={{ color: "#9a8b7c", fontSize: 12 }}>No image</span>
                )}
              </div>
              <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }}
                onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadFile(f); e.target.value = ""; }} />
              <button type="button" className="ma-add-btn" disabled={uploading}
                onClick={() => fileRef.current?.click()}
                style={{ marginTop: 8, width: 120, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                <Upload size={14} /> {uploading ? "Uploading…" : "Upload"}
              </button>
            </div>
            <div style={{ display: "grid", gap: 10 }}>
              <Field label="Name">
                <input value={form.name} onChange={(e) => update("name", e.target.value)} style={inp} />
              </Field>
              <Field label="Subtitle / description">
                <input value={form.sub} onChange={(e) => update("sub", e.target.value)} style={inp} />
              </Field>
              <Field label="Image URL (or upload)">
                <input value={form.img} onChange={(e) => update("img", e.target.value)} placeholder="https://..." style={inp} />
              </Field>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
            <Field label="Category">
              <select value={form.cat} onChange={(e) => update("cat", e.target.value)} style={inp}>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Price (Birr)">
              <input type="number" min={0} step="0.01" value={form.price}
                onChange={(e) => update("price", Number(e.target.value))} style={inp} />
            </Field>
            <Field label="Sort order">
              <input type="number" value={form.sort_order}
                onChange={(e) => update("sort_order", Number(e.target.value))} style={inp} />
            </Field>
          </div>

          {isNew && (
            <Field label="ID (optional — auto-generated if blank)">
              <input value={form.id} onChange={(e) => update("id", e.target.value)} placeholder="e.g. bday5" style={inp} />
            </Field>
          )}

          <label style={{ display: "flex", alignItems: "center", gap: 10, fontWeight: 600, color: "#2E1503" }}>
            <input type="checkbox" checked={form.available}
              onChange={(e) => update("available", e.target.checked)} />
            Available on shop
          </label>
        </div>

        <div style={{ padding: 18, borderTop: "1px solid rgba(240,184,174,.4)", display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button type="button" className="ma-add-btn" onClick={onClose}
            style={{ background: "white", color: "#2E1503" }}>Cancel</button>
          <button type="button" className="ma-add-btn" disabled={saving} onClick={save}>
            {saving ? "Saving…" : (isNew ? "Create item" : "Save changes")}
          </button>
        </div>
      </div>
    </div>
  );
}

const inp: React.CSSProperties = {
  width: "100%", padding: "10px 12px", borderRadius: 10,
  border: "1.5px solid rgba(240,184,174,.55)", fontFamily: "inherit",
  fontSize: ".88rem", outline: "none", background: "white", color: "#2E1503",
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "grid", gap: 4 }}>
      <span style={{ fontSize: 12, fontWeight: 700, color: "#9a8b7c", letterSpacing: ".04em", textTransform: "uppercase" }}>{label}</span>
      {children}
    </label>
  );
}
