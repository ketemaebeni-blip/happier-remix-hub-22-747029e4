import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Upload, FileDown, CheckCircle2, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { createCost, createPremises } from "@/lib/admin-finance.functions";
import "@/components/sweet-bloom/menu-admin.css";

export const Route = createFileRoute("/admin/import")({
  head: () => ({ meta: [{ title: "Bulk Import — Selam Cake Admin" }] }),
  component: BulkImportPage,
});

type Kind = "costs" | "premises";

const COST_HEADERS = ["item_name", "category", "cost_amount", "date_incurred", "notes"];
const PREMISES_HEADERS = ["expense_type", "amount", "billing_period", "due_date", "status", "paid_date", "notes"];

/** Minimal CSV parser — handles quoted fields, commas, and CRLF. */
function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let cur: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') inQuotes = false;
      else field += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ",") { cur.push(field); field = ""; }
      else if (c === "\n" || c === "\r") {
        if (c === "\r" && text[i + 1] === "\n") i++;
        cur.push(field); field = "";
        if (cur.some((v) => v.trim() !== "")) rows.push(cur);
        cur = [];
      } else field += c;
    }
  }
  if (field.length || cur.length) { cur.push(field); if (cur.some((v) => v.trim() !== "")) rows.push(cur); }
  return rows;
}

function downloadTemplate(kind: Kind) {
  const headers = kind === "costs" ? COST_HEADERS : PREMISES_HEADERS;
  const sample = kind === "costs"
    ? ["Flour (50kg)", "ingredients", "3200", new Date().toISOString().slice(0, 10), "weekly stock"]
    : ["Shop Rent", "25000", "monthly", new Date().toISOString().slice(0, 10), "unpaid", "", "main branch"];
  const csv = headers.join(",") + "\n" + sample.map((v) => /[,"\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v).join(",") + "\n";
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `${kind}-template.csv`; a.click();
  URL.revokeObjectURL(url);
}

function BulkImportPage() {
  const nav = useNavigate();
  const [ready, setReady] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [kind, setKind] = useState<Kind>("costs");
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState({ done: 0, ok: 0, fail: 0 });

  const createCostFn = useServerFn(createCost);
  const createPremisesFn = useServerFn(createPremises);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { nav({ to: "/admin/login" }); return; }
      const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", session.user.id);
      setIsAdmin(!!roles?.some((r: any) => r.role === "admin"));
      setReady(true);
    })();
  }, [nav]);

  function onFile(file: File) {
    setErrors([]);
    setProgress({ done: 0, ok: 0, fail: 0 });
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || "");
      const parsed = parseCSV(text);
      if (parsed.length < 2) { setErrors(["CSV must have a header row and at least one data row."]); setRows([]); return; }
      const headers = parsed[0].map((h) => h.trim().toLowerCase());
      const expected = kind === "costs" ? COST_HEADERS : PREMISES_HEADERS;
      const missing = expected.filter((h) => !["notes", "paid_date"].includes(h) && !headers.includes(h));
      if (missing.length) { setErrors([`Missing required columns: ${missing.join(", ")}`]); setRows([]); return; }
      const data = parsed.slice(1).map((r) => {
        const obj: Record<string, string> = {};
        headers.forEach((h, i) => { obj[h] = (r[i] ?? "").trim(); });
        return obj;
      });
      setRows(data);
    };
    reader.readAsText(file);
  }

  async function runImport() {
    if (!rows.length) return;
    setImporting(true);
    setProgress({ done: 0, ok: 0, fail: 0 });
    const failedRows: string[] = [];

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      try {
        if (kind === "costs") {
          await createCostFn({ data: {
            item_name: r.item_name,
            category: (r.category || "ingredients") as any,
            cost_amount: Number(r.cost_amount) || 0,
            date_incurred: r.date_incurred,
            notes: r.notes || null,
          } });
        } else {
          await createPremisesFn({ data: {
            expense_type: r.expense_type,
            amount: Number(r.amount) || 0,
            billing_period: (r.billing_period || "monthly") as any,
            due_date: r.due_date,
            status: (r.status || "unpaid") as any,
            paid_date: r.paid_date || null,
            notes: r.notes || null,
          } });
        }
        setProgress((p) => ({ done: p.done + 1, ok: p.ok + 1, fail: p.fail }));
      } catch (e: any) {
        failedRows.push(`Row ${i + 2}: ${e.message}`);
        setProgress((p) => ({ done: p.done + 1, ok: p.ok, fail: p.fail + 1 }));
      }
    }
    if (failedRows.length) setErrors(failedRows);
    setImporting(false);
  }

  if (!ready) return null;
  if (!isAdmin) {
    return (
      <div className="ma-denied"><div className="box">
        <h1>Access denied</h1>
        <p>Admin role required.</p>
      </div></div>
    );
  }

  const expected = kind === "costs" ? COST_HEADERS : PREMISES_HEADERS;

  return (
    <div className="ma-shell">
      <aside className="ma-sidebar">
        <Link to="/admin" className="ma-nav-item"><ArrowLeft size={18} /> Back to dashboard</Link>
      </aside>
      <main className="ma-main">
        <h1 className="ma-page-title">Bulk Import</h1>
        <p className="ma-page-sub">Upload a CSV (or Excel saved as CSV) to add many costs or premises expenses at once.</p>

        <section className="ma-card">
          <div className="ma-card-head">
            <h2>1. Choose data type</h2>
          </div>
          <div style={{ display: "flex", gap: 10, padding: "0 6px 14px" }}>
            <button type="button" className="ma-add-btn"
              style={{ background: kind === "costs" ? undefined : "white", color: kind === "costs" ? undefined : "#2a3d35" }}
              onClick={() => { setKind("costs"); setRows([]); setErrors([]); }}>
              Operational Costs
            </button>
            <button type="button" className="ma-add-btn"
              style={{ background: kind === "premises" ? undefined : "white", color: kind === "premises" ? undefined : "#2a3d35" }}
              onClick={() => { setKind("premises"); setRows([]); setErrors([]); }}>
              Premises Expenses
            </button>
            <button type="button" className="ma-icon-btn" onClick={() => downloadTemplate(kind)}>
              <FileDown size={15} /> Download template
            </button>
          </div>
          <div style={{ padding: "0 6px 14px", fontSize: 13, color: "#6b7280" }}>
            Required columns: <code>{expected.join(", ")}</code>
            {kind === "costs" && <div>• <b>category</b> must be one of: ingredients, packaging, miscellaneous</div>}
            {kind === "premises" && <>
              <div>• <b>billing_period</b>: one_time, weekly, monthly, quarterly, yearly</div>
              <div>• <b>status</b>: paid, unpaid, overdue</div>
            </>}
            <div>• Dates must be in <code>YYYY-MM-DD</code> format.</div>
          </div>
        </section>

        <section className="ma-card">
          <div className="ma-card-head"><h2>2. Upload CSV</h2></div>
          <div style={{ padding: "0 6px 14px" }}>
            <label className="ma-add-btn" style={{ display: "inline-flex", cursor: "pointer" }}>
              <Upload size={15} /> Choose CSV file
              <input type="file" accept=".csv,text/csv" style={{ display: "none" }}
                onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.currentTarget.value = ""; }} />
            </label>
            {rows.length > 0 && (
              <span style={{ marginLeft: 12, color: "#2a3d35" }}>
                {rows.length} row(s) ready to import.
              </span>
            )}
          </div>

          {errors.length > 0 && (
            <div style={{ padding: 14, background: "#fef2f2", color: "#b91c1c", borderRadius: 10, margin: "0 6px 14px", fontSize: 13 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 700, marginBottom: 6 }}>
                <AlertCircle size={15} /> Errors
              </div>
              {errors.slice(0, 20).map((e, i) => <div key={i}>• {e}</div>)}
              {errors.length > 20 && <div>… and {errors.length - 20} more</div>}
            </div>
          )}

          {rows.length > 0 && (
            <>
              <div className="ma-table-wrap" style={{ maxHeight: 320, overflow: "auto" }}>
                <table className="ma-table">
                  <thead><tr>{expected.map((h) => <th key={h}>{h}</th>)}</tr></thead>
                  <tbody>
                    {rows.slice(0, 50).map((r, i) => (
                      <tr key={i}>{expected.map((h) => <td key={h}>{r[h] || "—"}</td>)}</tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {rows.length > 50 && <div style={{ padding: 10, color: "#6b7280", fontSize: 12 }}>Showing first 50 of {rows.length} rows.</div>}

              <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 6px" }}>
                <button type="button" className="ma-add-btn" disabled={importing} onClick={runImport}>
                  {importing ? `Importing… ${progress.done}/${rows.length}` : `Import ${rows.length} row(s)`}
                </button>
                {progress.done > 0 && (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "#047857", fontWeight: 600 }}>
                    <CheckCircle2 size={16} /> {progress.ok} succeeded
                    {progress.fail > 0 && <span style={{ color: "#b91c1c", marginLeft: 8 }}>· {progress.fail} failed</span>}
                  </span>
                )}
              </div>
            </>
          )}
        </section>
      </main>
    </div>
  );
}
