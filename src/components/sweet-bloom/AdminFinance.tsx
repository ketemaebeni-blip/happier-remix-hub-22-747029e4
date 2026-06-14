import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Plus, Pencil, Trash2, Save, X, DollarSign, Building2, BarChart3 } from "lucide-react";
import {
  listCosts, createCost, updateCost, deleteCost,
  listPremises, createPremises, updatePremises, deletePremises,
  getSalesAnalytics,
} from "@/lib/admin-finance.functions";

const fmtBirr = (n: number) =>
  `Birr ${Number(n || 0).toLocaleString("en-US", { maximumFractionDigits: 2 })}`;

const today = () => new Date().toISOString().slice(0, 10);

/* =============================================================
   1) OPERATIONAL COSTS
   ============================================================= */
type Cost = {
  id: string;
  item_name: string;
  category: "ingredients" | "packaging" | "miscellaneous";
  cost_amount: number;
  date_incurred: string;
  notes: string | null;
};

export function CostsSection() {
  const list = useServerFn(listCosts);
  const create = useServerFn(createCost);
  const update = useServerFn(updateCost);
  const remove = useServerFn(deleteCost);

  const [rows, setRows] = useState<Cost[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const [editing, setEditing] = useState<Partial<Cost> | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const res = await list({ data: filter === "all" ? {} : { category: filter } });
      setRows((res.costs ?? []) as Cost[]);
    } catch (e: any) { alert(e.message); }
    setLoading(false);
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [filter]);

  async function save() {
    if (!editing) return;
    try {
      const payload = {
        item_name: editing.item_name?.trim() || "",
        category: (editing.category || "ingredients") as Cost["category"],
        cost_amount: Number(editing.cost_amount) || 0,
        date_incurred: editing.date_incurred || today(),
        notes: editing.notes || null,
      };
      if (!payload.item_name) return alert("Item name required");
      if (editing.id) await update({ data: { id: editing.id, ...payload } });
      else await create({ data: payload });
      setEditing(null);
      load();
    } catch (e: any) { alert(e.message); }
  }

  async function del(id: string) {
    if (!confirm("Delete this cost entry?")) return;
    try { await remove({ data: { id } }); load(); } catch (e: any) { alert(e.message); }
  }

  const total = rows.reduce((s, r) => s + Number(r.cost_amount), 0);
  const byCat = rows.reduce((acc: Record<string, number>, r) => {
    acc[r.category] = (acc[r.category] || 0) + Number(r.cost_amount);
    return acc;
  }, {});

  return (
    <>
      <h1 className="ma-page-title">Cost Management</h1>
      <p className="ma-page-sub">Track ingredients, packaging, and miscellaneous operational costs.</p>

      <div className="ma-stats">
        <div className="ma-stat"><span className="ma-stat-icon"><DollarSign size={22} /></span>
          <span className="ma-stat-val">{fmtBirr(total)}</span><span className="ma-stat-label">Total</span></div>
        <div className="ma-stat"><span className="ma-stat-val">{fmtBirr(byCat.ingredients || 0)}</span>
          <span className="ma-stat-label">Ingredients</span></div>
        <div className="ma-stat"><span className="ma-stat-val">{fmtBirr(byCat.packaging || 0)}</span>
          <span className="ma-stat-label">Packaging</span></div>
        <div className="ma-stat"><span className="ma-stat-val">{fmtBirr(byCat.miscellaneous || 0)}</span>
          <span className="ma-stat-label">Misc.</span></div>
      </div>

      <section className="ma-card">
        <div className="ma-card-head">
          <h2>Costs</h2>
          <div style={{ display: "flex", gap: 8 }}>
            <select value={filter} onChange={(e) => setFilter(e.target.value)} className="ma-input">
              <option value="all">All categories</option>
              <option value="ingredients">Ingredients</option>
              <option value="packaging">Packaging</option>
              <option value="miscellaneous">Miscellaneous</option>
            </select>
            <button className="ma-add-btn" type="button"
              onClick={() => setEditing({ category: "ingredients", date_incurred: today(), cost_amount: 0 })}>
              <Plus size={16} /> Add Cost
            </button>
          </div>
        </div>

        <div className="ma-table-wrap">
          {loading ? <div className="ma-empty-state">Loading…</div> :
           rows.length === 0 ? <div className="ma-empty-state">No costs recorded yet.</div> : (
            <table className="ma-table">
              <thead><tr><th>Item</th><th>Category</th><th>Amount</th><th>Date</th><th>Notes</th><th></th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td><b>{r.item_name}</b></td>
                    <td><span className="ma-badge">{r.category}</span></td>
                    <td>{fmtBirr(r.cost_amount)}</td>
                    <td>{r.date_incurred}</td>
                    <td style={{ color: "#6b7280" }}>{r.notes || "—"}</td>
                    <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                      <button className="ma-icon-btn" onClick={() => setEditing(r)}><Pencil size={15} /></button>
                      <button className="ma-icon-btn danger" onClick={() => del(r.id)}><Trash2 size={15} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {editing && (
        <EditorModal title={editing.id ? "Edit cost" : "Add cost"} onClose={() => setEditing(null)} onSave={save}>
          <Field label="Item name">
            <input className="ma-input" value={editing.item_name || ""}
              onChange={(e) => setEditing({ ...editing, item_name: e.target.value })} />
          </Field>
          <Field label="Category">
            <select className="ma-input" value={editing.category || "ingredients"}
              onChange={(e) => setEditing({ ...editing, category: e.target.value as Cost["category"] })}>
              <option value="ingredients">Ingredients</option>
              <option value="packaging">Packaging</option>
              <option value="miscellaneous">Miscellaneous</option>
            </select>
          </Field>
          <Field label="Amount (Birr)">
            <input className="ma-input" type="number" min="0" step="0.01" value={editing.cost_amount ?? 0}
              onChange={(e) => setEditing({ ...editing, cost_amount: Number(e.target.value) })} />
          </Field>
          <Field label="Date">
            <input className="ma-input" type="date" value={editing.date_incurred || today()}
              onChange={(e) => setEditing({ ...editing, date_incurred: e.target.value })} />
          </Field>
          <Field label="Notes (optional)">
            <textarea className="ma-input" rows={2} value={editing.notes || ""}
              onChange={(e) => setEditing({ ...editing, notes: e.target.value })} />
          </Field>
        </EditorModal>
      )}
    </>
  );
}

/* =============================================================
   2) PREMISES EXPENSES
   ============================================================= */
type Premises = {
  id: string;
  expense_type: string;
  amount: number;
  billing_period: "one_time" | "weekly" | "monthly" | "quarterly" | "yearly";
  due_date: string;
  status: "paid" | "unpaid" | "overdue";
  paid_date: string | null;
  notes: string | null;
};

export function PremisesSection() {
  const list = useServerFn(listPremises);
  const create = useServerFn(createPremises);
  const update = useServerFn(updatePremises);
  const remove = useServerFn(deletePremises);

  const [rows, setRows] = useState<Premises[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const [editing, setEditing] = useState<Partial<Premises> | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const res = await list({ data: filter === "all" ? {} : { status: filter } });
      setRows((res.premises ?? []) as Premises[]);
    } catch (e: any) { alert(e.message); }
    setLoading(false);
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [filter]);

  async function save() {
    if (!editing) return;
    try {
      const payload = {
        expense_type: editing.expense_type?.trim() || "",
        amount: Number(editing.amount) || 0,
        billing_period: (editing.billing_period || "monthly") as Premises["billing_period"],
        due_date: editing.due_date || today(),
        status: (editing.status || "unpaid") as Premises["status"],
        paid_date: editing.paid_date || null,
        notes: editing.notes || null,
      };
      if (!payload.expense_type) return alert("Expense type required");
      if (editing.id) await update({ data: { id: editing.id, ...payload } });
      else await create({ data: payload });
      setEditing(null);
      load();
    } catch (e: any) { alert(e.message); }
  }

  async function togglePaid(r: Premises) {
    try {
      await update({ data: {
        id: r.id,
        status: r.status === "paid" ? "unpaid" : "paid",
        paid_date: r.status === "paid" ? null : today(),
      }});
      load();
    } catch (e: any) { alert(e.message); }
  }

  async function del(id: string) {
    if (!confirm("Delete this expense?")) return;
    try { await remove({ data: { id } }); load(); } catch (e: any) { alert(e.message); }
  }

  const totalUnpaid = rows.filter(r => r.status !== "paid").reduce((s, r) => s + Number(r.amount), 0);
  const totalPaid = rows.filter(r => r.status === "paid").reduce((s, r) => s + Number(r.amount), 0);

  return (
    <>
      <h1 className="ma-page-title">Premises Management</h1>
      <p className="ma-page-sub">Fixed shop costs: rent, electricity, water, internet, and more.</p>

      <div className="ma-stats">
        <div className="ma-stat"><span className="ma-stat-icon"><Building2 size={22} /></span>
          <span className="ma-stat-val">{rows.length}</span><span className="ma-stat-label">Entries</span></div>
        <div className="ma-stat"><span className="ma-stat-icon red"><DollarSign size={22} /></span>
          <span className="ma-stat-val">{fmtBirr(totalUnpaid)}</span><span className="ma-stat-label">Unpaid</span></div>
        <div className="ma-stat"><span className="ma-stat-icon green"><DollarSign size={22} /></span>
          <span className="ma-stat-val">{fmtBirr(totalPaid)}</span><span className="ma-stat-label">Paid</span></div>
      </div>

      <section className="ma-card">
        <div className="ma-card-head">
          <h2>Expenses</h2>
          <div style={{ display: "flex", gap: 8 }}>
            <select value={filter} onChange={(e) => setFilter(e.target.value)} className="ma-input">
              <option value="all">All status</option>
              <option value="unpaid">Unpaid</option>
              <option value="paid">Paid</option>
              <option value="overdue">Overdue</option>
            </select>
            <button className="ma-add-btn" type="button"
              onClick={() => setEditing({ billing_period: "monthly", due_date: today(), status: "unpaid", amount: 0 })}>
              <Plus size={16} /> Add Expense
            </button>
          </div>
        </div>

        <div className="ma-table-wrap">
          {loading ? <div className="ma-empty-state">Loading…</div> :
           rows.length === 0 ? <div className="ma-empty-state">No premises expenses recorded.</div> : (
            <table className="ma-table">
              <thead><tr><th>Type</th><th>Amount</th><th>Period</th><th>Due</th><th>Status</th><th></th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td><b>{r.expense_type}</b></td>
                    <td>{fmtBirr(r.amount)}</td>
                    <td>{r.billing_period}</td>
                    <td>{r.due_date}</td>
                    <td>
                      <button className={"ma-badge " + (r.status === "paid" ? "ok" : r.status === "overdue" ? "danger" : "warn")}
                        onClick={() => togglePaid(r)} type="button" title="Toggle paid/unpaid">
                        {r.status}
                      </button>
                    </td>
                    <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                      <button className="ma-icon-btn" onClick={() => setEditing(r)}><Pencil size={15} /></button>
                      <button className="ma-icon-btn danger" onClick={() => del(r.id)}><Trash2 size={15} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {editing && (
        <EditorModal title={editing.id ? "Edit expense" : "Add expense"} onClose={() => setEditing(null)} onSave={save}>
          <Field label="Expense type (e.g. Rent, Electricity)">
            <input className="ma-input" value={editing.expense_type || ""}
              onChange={(e) => setEditing({ ...editing, expense_type: e.target.value })} />
          </Field>
          <Field label="Amount (Birr)">
            <input className="ma-input" type="number" min="0" step="0.01" value={editing.amount ?? 0}
              onChange={(e) => setEditing({ ...editing, amount: Number(e.target.value) })} />
          </Field>
          <Field label="Billing period">
            <select className="ma-input" value={editing.billing_period || "monthly"}
              onChange={(e) => setEditing({ ...editing, billing_period: e.target.value as Premises["billing_period"] })}>
              <option value="one_time">One-time</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
              <option value="yearly">Yearly</option>
            </select>
          </Field>
          <Field label="Due date">
            <input className="ma-input" type="date" value={editing.due_date || today()}
              onChange={(e) => setEditing({ ...editing, due_date: e.target.value })} />
          </Field>
          <Field label="Status">
            <select className="ma-input" value={editing.status || "unpaid"}
              onChange={(e) => setEditing({ ...editing, status: e.target.value as Premises["status"] })}>
              <option value="unpaid">Unpaid</option>
              <option value="paid">Paid</option>
              <option value="overdue">Overdue</option>
            </select>
          </Field>
          <Field label="Notes (optional)">
            <textarea className="ma-input" rows={2} value={editing.notes || ""}
              onChange={(e) => setEditing({ ...editing, notes: e.target.value })} />
          </Field>
        </EditorModal>
      )}
    </>
  );
}

/* =============================================================
   3) SALES & VOLUME TRACKING
   ============================================================= */
type Bucket = { bucket: string; order_count: number; units_sold: number; revenue: number };
type Granularity = "day" | "week" | "month";

export function SalesSection() {
  const fetchAnalytics = useServerFn(getSalesAnalytics);
  const [granularity, setGranularity] = useState<Granularity>("day");
  const [days, setDays] = useState<number>(30);
  const [buckets, setBuckets] = useState<Bucket[]>([]);
  const [totals, setTotals] = useState({ order_count: 0, units_sold: 0, revenue: 0 });
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const from = new Date(Date.now() - days * 86400_000).toISOString();
      const to = new Date().toISOString();
      const res = await fetchAnalytics({ data: { granularity, from, to } });
      setBuckets((res.buckets ?? []) as Bucket[]);
      setTotals(res.totals);
    } catch (e: any) { alert(e.message); }
    setLoading(false);
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [granularity, days]);

  const max = useMemo(() => Math.max(1, ...buckets.map((b) => Number(b.revenue))), [buckets]);
  const fmtBucket = (s: string) => {
    const d = new Date(s);
    if (granularity === "month") return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
    if (granularity === "week") return "Week of " + d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  return (
    <>
      <h1 className="ma-page-title">Sales & Volume Tracking</h1>
      <p className="ma-page-sub">Aggregated sales totals by day, week, or month.</p>

      <div className="ma-stats">
        <div className="ma-stat"><span className="ma-stat-icon"><BarChart3 size={22} /></span>
          <span className="ma-stat-val">{totals.order_count}</span><span className="ma-stat-label">Orders</span></div>
        <div className="ma-stat"><span className="ma-stat-val">{totals.units_sold}</span>
          <span className="ma-stat-label">Units Sold</span></div>
        <div className="ma-stat"><span className="ma-stat-icon green"><DollarSign size={22} /></span>
          <span className="ma-stat-val">{fmtBirr(totals.revenue)}</span><span className="ma-stat-label">Revenue</span></div>
      </div>

      <section className="ma-card">
        <div className="ma-card-head">
          <h2>Trend</h2>
          <div style={{ display: "flex", gap: 8 }}>
            <select value={granularity} onChange={(e) => setGranularity(e.target.value as Granularity)} className="ma-input">
              <option value="day">By day</option>
              <option value="week">By week</option>
              <option value="month">By month</option>
            </select>
            <select value={days} onChange={(e) => setDays(Number(e.target.value))} className="ma-input">
              <option value={7}>Last 7 days</option>
              <option value={30}>Last 30 days</option>
              <option value={90}>Last 90 days</option>
              <option value={365}>Last 12 months</option>
            </select>
          </div>
        </div>

        {loading ? <div className="ma-empty-state">Loading…</div> :
         buckets.length === 0 ? <div className="ma-empty-state">No sales in this period.</div> : (
          <>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 180, padding: "16px 8px", borderBottom: "1px solid #eee" }}>
              {buckets.map((b) => (
                <div key={b.bucket} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                  <div style={{ fontSize: 11, color: "#6b7280" }}>{fmtBirr(Number(b.revenue))}</div>
                  <div title={`${b.order_count} orders, ${b.units_sold} units`}
                    style={{
                      width: "100%",
                      height: `${(Number(b.revenue) / max) * 140}px`,
                      background: "linear-gradient(180deg, #f472b6, #db2777)",
                      borderRadius: "6px 6px 0 0",
                      minHeight: 4,
                    }} />
                  <div style={{ fontSize: 10, color: "#6b7280", whiteSpace: "nowrap" }}>{fmtBucket(b.bucket)}</div>
                </div>
              ))}
            </div>

            <div className="ma-table-wrap" style={{ marginTop: 16 }}>
              <table className="ma-table">
                <thead><tr><th>Period</th><th>Orders</th><th>Units Sold</th><th>Revenue</th></tr></thead>
                <tbody>
                  {[...buckets].reverse().map((b) => (
                    <tr key={b.bucket}>
                      <td>{fmtBucket(b.bucket)}</td>
                      <td>{b.order_count}</td>
                      <td>{b.units_sold}</td>
                      <td><b>{fmtBirr(Number(b.revenue))}</b></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </>
  );
}

/* ============================================================= */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "block", marginBottom: 12 }}>
      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6, color: "#374151" }}>{label}</div>
      {children}
    </label>
  );
}

function EditorModal({
  title, children, onClose, onSave,
}: { title: string; children: React.ReactNode; onClose: () => void; onSave: () => void }) {
  return (
    <div role="dialog" aria-modal="true"
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 80, display: "grid", placeItems: "center", padding: 16 }}
      onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}
        style={{ background: "white", borderRadius: 14, maxWidth: 480, width: "100%", padding: 20, boxShadow: "0 20px 60px rgba(0,0,0,.2)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <h3 style={{ margin: 0, fontSize: 18 }}>{title}</h3>
          <button className="ma-icon-btn" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>
        {children}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 12 }}>
          <button className="ma-icon-btn" onClick={onClose} type="button">Cancel</button>
          <button className="ma-add-btn" onClick={onSave} type="button"><Save size={16} /> Save</button>
        </div>
      </div>
    </div>
  );
}
