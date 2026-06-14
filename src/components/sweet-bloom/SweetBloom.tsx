import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import "./styles.css";
// @ts-ignore - plain JS data module
import { I18N, ING_ICON_SVG, EXTRAS_ICONS, CATEGORIES, DISHES as RAW_DISHES } from "./data.js";
import { useUnavailable, useCakeOverrides } from "./availability";
import { placeOrder } from "@/lib/orders.functions";

type Lang = "en" | "am" | "om";
type Screen = "home" | "payment";

type Dish = (typeof RAW_DISHES)[number];

function loc(dish: Dish, field: "name" | "sub", lang: Lang) {
  const key = field + lang.charAt(0).toUpperCase() + lang.slice(1);
  // @ts-ignore
  return dish[key] ?? dish[field + "EN"];
}

function t(lang: Lang, key: string): string {
  // @ts-ignore
  return I18N[lang]?.[key] ?? I18N.en[key] ?? key;
}
function tCat(lang: Lang, id: string): string {
  // @ts-ignore
  return I18N[lang]?.cats?.[id] ?? I18N.en.cats[id] ?? id;
}

function HTML({ html, as: Tag = "span" }: { html: string; as?: any }) {
  return <Tag dangerouslySetInnerHTML={{ __html: html }} />;
}

export default function SweetBloom() {
  const [lang, setLang] = useState<Lang>("en");
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [screen, setScreen] = useState<Screen>("home");
  const [category, setCategory] = useState<string>("all");
  const [availFilter, setAvailFilter] = useState<"all" | "available" | "out">("all");
  const [query, setQuery] = useState("");
  const [detail, setDetail] = useState<Dish | null>(null);
  const [langOpen, setLangOpen] = useState(false);
  const [loaderHidden, setLoaderHidden] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [cart, setCart] = useState<Record<number, number>>({});
  const [cartOpen, setCartOpen] = useState(false);
  const [custName, setCustName] = useState("");
  const [custPhone, setCustPhone] = useState("");
  const [custAddress, setCustAddress] = useState("");
  const catSectionRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const menuRef = useRef<HTMLDivElement>(null);
  const { isAvailable } = useUnavailable();
  const { applyOverride } = useCakeOverrides();
  const placeOrderFn = useServerFn(placeOrder);
  const [sending, setSending] = useState(false);
  const DISHES = useMemo(() => (RAW_DISHES as Dish[]).map((d) => applyOverride(d)), [applyOverride]);

  const MANAGER_TG = "selamina22";

  const cartCount = Object.values(cart).reduce((a, b) => a + b, 0);
  const cartItems = useMemo(
    () =>
      Object.entries(cart)
        .map(([id, qty]) => {
          const d = DISHES.find((x: Dish) => x.id === Number(id));
          return d ? { dish: d as Dish, qty } : null;
        })
        .filter(Boolean) as { dish: Dish; qty: number }[],
    [cart]
  );
  const cartTotal = cartItems.reduce((s, i) => s + i.dish.price * i.qty, 0);

  function addToCart(d: Dish) {
    setCart((c) => ({ ...c, [d.id]: (c[d.id] || 0) + 1 }));
  }
  function setQty(id: number, qty: number) {
    setCart((c) => {
      const n = { ...c };
      if (qty <= 0) delete n[id];
      else n[id] = qty;
      return n;
    });
  }
  function clearCart() {
    setCart({});
  }

  async function sendOrder() {
    if (!cartItems.length || sending) return;
    setSending(true);

    // 1) Save the order + push photos & details to the manager's Telegram (server-side)
    try {
      await placeOrderFn({
        data: {
          customer_name: custName,
          customer_phone: custPhone,
          customer_address: custAddress,
          items: cartItems.map(({ dish, qty }) => ({
            name: String(loc(dish, "name", lang)),
            qty,
            price: dish.price,
            img: dish.img && /^https?:\/\//i.test(dish.img) ? dish.img : null,
          })),
          total: cartTotal,
        },
      });
    } catch (err) {
      console.error("Place order failed", err);
    }

    // 2) Always open the Telegram chat with the order text as a fallback
    const lines: string[] = [];
    lines.push("🌸 *Selam Cake & Arts — New Order*");
    lines.push("");
    if (custName) lines.push(`👤 Name: ${custName}`);
    if (custPhone) lines.push(`📞 Phone: ${custPhone}`);
    if (custAddress) lines.push(`📍 Address: ${custAddress}`);
    lines.push("");
    lines.push("🧁 Items:");
    cartItems.forEach(({ dish, qty }) => {
      lines.push(`• ${loc(dish, "name", lang)} × ${qty} — ETB ${dish.price * qty}`);
    });
    lines.push("");
    lines.push(`💰 Total: ETB ${cartTotal}`);
    const text = lines.join("\n");
    const url = `https://t.me/${MANAGER_TG}?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank");
    setSending(false);
  }

  // theme & lang persistence
  useEffect(() => {
    const saved = (typeof localStorage !== "undefined" && localStorage.getItem("sb-theme")) as
      | "light"
      | "dark"
      | null;
    const prefers =
      typeof matchMedia !== "undefined" && matchMedia("(prefers-color-scheme:dark)").matches
        ? "dark"
        : "light";
    setTheme(saved || prefers);
    const sl = typeof localStorage !== "undefined" && localStorage.getItem("sb-lang");
    // @ts-ignore
    if (sl && I18N[sl]) setLang(sl as Lang);
    const tm = setTimeout(() => setLoaderHidden(true), 600);
    return () => clearTimeout(tm);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    try {
      localStorage.setItem("sb-theme", theme);
    } catch {}
  }, [theme]);

  useEffect(() => {
    try {
      localStorage.setItem("sb-lang", lang);
    } catch {}
  }, [lang]);

  // close lang menu on outside click
  useEffect(() => {
    const onDoc = () => setLangOpen(false);
    document.addEventListener("click", onDoc);
    return () => document.removeEventListener("click", onDoc);
  }, []);

  // close details on escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDetail(null);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // lock scroll while detail open
  useEffect(() => {
    document.body.style.overflow = detail ? "hidden" : "";
  }, [detail]);

  // scroll to top on screen change
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [screen]);

  const q = query.trim().toLowerCase();
  const filteredDishes = useMemo(() => {
    return DISHES.filter((d: Dish) => {
      if (q && !String(loc(d, "name", lang)).toLowerCase().includes(q)) return false;
      const av = isAvailable(d.id);
      // Hide out-of-stock cakes from customers by default.
      if (availFilter === "all" && !av) return false;
      if (availFilter === "available" && !av) return false;
      if (availFilter === "out" && av) return false;
      return true;
    });
  }, [query, lang, availFilter, isAvailable, DISHES]);

  const catsRef = useRef<HTMLDivElement>(null);

  function copy(val: string) {
    const finish = () => {
      setCopied(val);
      setTimeout(() => setCopied((c) => (c === val ? null : c)), 2000);
    };
    if (navigator.clipboard) navigator.clipboard.writeText(val).then(finish).catch(finish);
    else finish();
  }

  return (
    <>
      <div className={"loader" + (loaderHidden ? " hidden" : "")} id="loader" aria-hidden="true">
        <div className="loader-inner">
          <div className="loader-mark">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2a10 10 0 0 1 10 10c0 5.52-4.48 10-10 10S2 17.52 2 12" />
              <path d="M8 12c0-2.21 1.79-4 4-4s4 1.79 4 4" />
              <circle cx="12" cy="12" r="1.5" fill="white" stroke="none" />
            </svg>
          </div>
          <div className="loader-text">Selam Cake & Arts</div>
        </div>
      </div>

      <div className="app">
        <header className="topbar">
          <div className="brand">
            <div className="brand-mark">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10" />
                <path d="M12 8c0 0-2.5 1.5-2.5 4s2.5 4 2.5 4" />
                <path d="M12 8c0 0 2.5 1.5 2.5 4s-2.5 4-2.5 4" />
                <circle cx="12" cy="5" r="1" fill="white" stroke="none" />
              </svg>
            </div>
            <div className="brand-text">
              <span className="name">Selam Cake & Arts</span>
              <span className="tagline">Cake Boutique</span>
            </div>
          </div>
          <div className="top-actions">
            <div className={"lang" + (langOpen ? " open" : "")} onClick={(e) => e.stopPropagation()}>
              <button
                className="lang-btn"
                aria-haspopup="true"
                aria-expanded={langOpen}
                onClick={(e) => {
                  e.stopPropagation();
                  setLangOpen((o) => !o);
                }}
              >
                <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14" aria-hidden="true">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M3 12h18M12 3a14 14 0 010 18M12 3a14 14 0 000 18" />
                </svg>
                <span>{lang.toUpperCase()}</span>
              </button>
              <div className="lang-menu" role="menu">
                {([
                  ["en", "🇺🇸", "English"],
                  ["am", "🇪🇹", "አማርኛ (Amharic)"],
                  ["om", "🇪🇹", "Afaan Oromoo"],
                ] as const).map(([id, flag, label]) => (
                  <button
                    key={id}
                    className={lang === id ? "active" : ""}
                    onClick={(e) => {
                      e.stopPropagation();
                      setLang(id);
                      setLangOpen(false);
                    }}
                  >
                    <span className="lang-flag">{flag}</span> {label}
                  </button>
                ))}
              </div>
            </div>
            <button
              className="theme-toggle"
              aria-label="Toggle theme"
              onClick={() => setTheme((t) => (t === "light" ? "dark" : "light"))}
            />
          </div>
        </header>

        {/* HOME */}
        <section className={"screen" + (screen === "home" ? " active" : "")}>
          <div className="hero">
            <HTML as="h1" html={t(lang, "heroTitle")} />
            <p>{t(lang, "heroSub")}</p>
            <button
              className="order-now-btn"
              onClick={() => {
                menuRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
            >
              Order Now
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="16" height="16">
                <path d="M5 12h14M13 5l7 7-7 7" />
              </svg>
            </button>
          </div>
          <div className="search">
            <div className="search-field">
              <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18" aria-hidden="true">
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.5-3.5" />
              </svg>
              <input
                type="search"
                placeholder={t(lang, "searchPh")}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <button className="filter-btn" aria-label="Filter">
              <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20" aria-hidden="true">
                <line x1="4" y1="6" x2="20" y2="6" />
                <line x1="8" y1="12" x2="16" y2="12" />
                <line x1="11" y1="18" x2="13" y2="18" />
              </svg>
            </button>
          </div>
          <div className="avail-filter" role="tablist" aria-label="Availability filter">
            {([
              ["all", "All cakes"],
              ["available", "Available"],
              ["out", "Out of stock"],
            ] as const).map(([id, label]) => (
              <button
                key={id}
                role="tab"
                aria-selected={availFilter === id}
                className={"avail-pill" + (availFilter === id ? " active" : "") + (id === "out" ? " danger" : id === "available" ? " ok" : "")}
                onClick={() => setAvailFilter(id)}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="cats-wrapper">
            <div className="cats" ref={catsRef} role="tablist">
              <div className="cats-track">
                {CATEGORIES.map((cat: any) => {
                  const active = category === cat.id;
                  return (
                    <button
                      key={cat.id}
                      className={"cat" + (active ? " active" : "")}
                      role="tab"
                      aria-selected={active}
                      data-cat-id={cat.id}
                      onClick={() => {
                        setCategory(cat.id);
                        if (cat.id === "all") {
                          window.scrollTo({ top: 0, behavior: "smooth" });
                        } else {
                          catSectionRefs.current[cat.id]?.scrollIntoView({ behavior: "smooth", block: "start" });
                        }
                      }}
                    >
                      <div className="cat-bubble">
                        <img src={cat.img} alt={tCat(lang, cat.id)} draggable={false} />
                      </div>
                      <span>{tCat(lang, cat.id)}</span>
                    </button>
                  );
                })}
                {CATEGORIES.map((cat: any) => {
                  const active = category === cat.id;
                  return (
                    <button
                      key={cat.id + "-dup"}
                      className={"cat" + (active ? " active" : "")}
                      role="tab"
                      aria-selected={active}
                      data-cat-id={cat.id}
                      onClick={() => {
                        setCategory(cat.id);
                        if (cat.id === "all") {
                          window.scrollTo({ top: 0, behavior: "smooth" });
                        } else {
                          catSectionRefs.current[cat.id]?.scrollIntoView({ behavior: "smooth", block: "start" });
                        }
                      }}
                    >
                      <div className="cat-bubble">
                        <img src={cat.img} alt={tCat(lang, cat.id)} draggable={false} />
                      </div>
                      <span>{tCat(lang, cat.id)}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          <div ref={menuRef}>
            <div className="section-title">
              <h2>{t(lang, "popular")}</h2>
              <a href="#" onClick={(e) => e.preventDefault()}>
                {t(lang, "seeAll")}
              </a>
            </div>
            {filteredDishes.length === 0 ? (
              <div className="empty">
                <div className="empty-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="52" height="52">
                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                  </svg>
                </div>
                <p>No desserts found. Try a different search!</p>
              </div>
            ) : (
              CATEGORIES.filter((c: any) => c.id !== "all").map((cat: any) => {
                const catDishes = filteredDishes.filter((d: Dish) => d.cat === cat.id);
                if (!catDishes.length) return null;
                return (
                  <div key={cat.id} ref={(el) => { catSectionRefs.current[cat.id] = el; }} className="cat-section">
                    <h2 className="cat-section-title">{tCat(lang, cat.id)}</h2>
                    <div className="grid">
                      {catDishes.map((d: Dish) => {
                        const isCyan = d.cat === "wedding" || d.cat === "anniversary";
                        const available = isAvailable(d.id);
                        return (
                          <article
                            key={d.id}
                            className={"card" + (available ? "" : " unavailable")}
                            onClick={() => available && setDetail(d)}
                            aria-disabled={!available}
                          >
                            <span className={"badge" + (isCyan ? " cyan" : "")}>{d.tag}</span>
                            <div className="card-img">
                              <img src={d.img} alt={loc(d, "name", lang)} loading="lazy" />
                              {!available && <div className="sold-ribbon">SOLD OUT</div>}
                              <span
                                className={"status-mark " + (available ? "yes" : "no")}
                                aria-label={available ? "Available" : "Unavailable"}
                                title={available ? "Available" : "Unavailable"}
                              >
                                {available ? (
                                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="3"><path d="M5 12l5 5L20 7" /></svg>
                                ) : (
                                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="3"><path d="M6 6l12 12M18 6 6 18" /></svg>
                                )}
                              </span>
                            </div>
                            <h3>{loc(d, "name", lang)}</h3>
                            <p className="desc">{loc(d, "sub", lang)}</p>
                            <div className={"avail-label " + (available ? "ok" : "out")}>
                              {available ? "In stock" : "Currently unavailable"}
                            </div>
                            <div className="card-foot">
                              <div className="price">
                                <em>ETB </em>
                                {d.price}
                              </div>
                              <button
                                className="add-btn"
                                aria-label={available ? "Add to order" : "Unavailable — currently out of stock"}
                                title={available ? "Add to order" : "Unavailable — currently out of stock"}
                                disabled={!available}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (available) addToCart(d);
                                }}
                              >
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="14" height="14">
                                  <path d="M12 5v14M5 12h14" />
                                </svg>
                              </button>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>

        {/* PAYMENT */}
        <section className={"screen" + (screen === "payment" ? " active" : "")}>
          <div className="hero">
            <HTML as="h1" html={t(lang, "payTitle")} />
            <p>{t(lang, "paySub")}</p>
          </div>
          <div className="panel">
            <h3>{t(lang, "payHow")}</h3>
            <p>{t(lang, "payHowText")}</p>
            <div className="pay-list">
              <PayItem title={t(lang, "payCash")} subtitle="ETB" icon={
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="22" height="22"><rect x="2" y="6" width="20" height="14" rx="2" /><path d="M2 11h20" /></svg>
              } />
              <PayItem title="Commercial Bank" subtitle="CBE — Ethiopia" account="10001200000789" copied={copied} onCopy={copy} icon={
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="22" height="22"><path d="M3 21h18M4 21V10m16 11V10M8 21V14h8v7M2 10l10-7 10 7" /></svg>
              } />
              <PayItem title="Telebirr" subtitle="Ethio Telecom Mobile" account="09330000007" copied={copied} onCopy={copy} icon={
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="22" height="22"><rect x="5" y="2" width="14" height="20" rx="2" /><path d="M12 18h.01M9 7h6" /></svg>
              } accountLabel="Phone Number" />
              <PayItem title="Awash Bank" subtitle="Awash International Bank" account="0132456789001" copied={copied} onCopy={copy} icon={
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="22" height="22"><path d="M2 20h20M4 20V10m16 10V10M12 20V4M8 10V4M16 10V4M2 10h20" /></svg>
              } />
            </div>
          </div>
        </section>

      </div>

      {/* DETAILS OVERLAY */}
      <div
        className={"details" + (detail ? " open" : "")}
        role="dialog"
        aria-modal="true"
        aria-hidden={!detail}
        onClick={(e) => {
          if (e.target === e.currentTarget) setDetail(null);
        }}
      >
        {detail && (
          <div className="details-sheet">
            <div className="sheet-hero">
              <div className="sheet-grab"></div>
              <button className="close-btn" aria-label="Close" onClick={() => setDetail(null)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
              <div className="sheet-hero-content">
                <h2>{loc(detail, "name", lang)}</h2>
                <div className="sub">{loc(detail, "sub", lang)}</div>
                <div className="big-price">
                  <em>ETB </em>
                  <span>{detail.price}</span>
                </div>
              </div>
              <div className="hero-visual">
                <img src={detail.img} alt={loc(detail, "name", lang)} />
              </div>
            </div>
            <div className="details-body">
              <h3>{loc(detail, "name", lang)}</h3>
              <p className="description">{detail.descEN}</p>
              <div className="meta-row">
                <div className="chip">
                  <span className="dot">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="13" height="13">
                      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                    </svg>
                  </span>
                  <span>{t(lang, "chefSpecial")}</span>
                </div>
                <div className="chip">
                  <span className="dot">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="13" height="13">
                      <circle cx="12" cy="12" r="9" />
                      <polyline points="12 7 12 12 15 15" />
                    </svg>
                  </span>
                  <span>10–20 min</span>
                </div>
                <div className="chip">
                  <span className="dot">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="13" height="13">
                      <path d="M12 2a7 7 0 0 1 7 7c0 4-7 13-7 13S5 13 5 9a7 7 0 0 1 7-7z" />
                      <circle cx="12" cy="9" r="2.5" />
                    </svg>
                  </span>
                  <span>Fresh Daily</span>
                </div>
              </div>
              <div className="subhead">{t(lang, "ingredients")}</div>
              <ul className="ingredients">
                {detail.ingredients.map(([key, label]: [string, string], i: number) => (
                  <li key={i}>
                    <div
                      className="ing-icon"
                      dangerouslySetInnerHTML={{
                        // @ts-ignore
                        __html: ING_ICON_SVG[key] || ING_ICON_SVG.default,
                      }}
                    />
                    <span>{label}</span>
                  </li>
                ))}
              </ul>
              <div className="subhead">{t(lang, "extras")}</div>
              <ul className="ingredients">
                {EXTRAS_ICONS.map((ex: any, i: number) => (
                  <li key={i}>
                    <div className="ing-icon" dangerouslySetInnerHTML={{ __html: ex.icon }} />
                    <span>{ex.name}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>

      {/* FLOATING CART BAR */}
      {cartCount > 0 && !cartOpen && (
        <button className="cart-bar" onClick={() => setCartOpen(true)}>
          <span className="cart-bar-count">{cartCount}</span>
          <span className="cart-bar-label">View Order</span>
          <span className="cart-bar-total">
            <em>ETB </em>
            {cartTotal}
          </span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="16" height="16">
            <path d="M5 12h14M13 5l7 7-7 7" />
          </svg>
        </button>
      )}

      {/* CART / ORDER MODAL */}
      <div
        className={"details" + (cartOpen ? " open" : "")}
        role="dialog"
        aria-modal="true"
        aria-hidden={!cartOpen}
        onClick={(e) => {
          if (e.target === e.currentTarget) setCartOpen(false);
        }}
      >
        {cartOpen && (
          <div className="details-sheet">
            <div className="sheet-hero">
              <div className="sheet-grab"></div>
              <button className="close-btn" aria-label="Close" onClick={() => setCartOpen(false)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
              <div className="sheet-hero-content">
                <h2>Your Order</h2>
                <div className="sub">{cartCount} {cartCount === 1 ? "item" : "items"}</div>
                <div className="big-price">
                  <em>ETB </em>
                  <span>{cartTotal}</span>
                </div>
              </div>
            </div>
            <div className="details-body">
              {cartItems.length === 0 ? (
                <p className="description">Your order is empty. Add some treats!</p>
              ) : (
                <>
                  <div className="subhead">Items</div>
                  <ul className="cart-list">
                    {cartItems.map(({ dish, qty }) => (
                      <li key={dish.id} className="cart-item">
                        <img src={dish.img} alt={loc(dish, "name", lang)} />
                        <div className="cart-item-info">
                          <div className="cart-item-name">{loc(dish, "name", lang)}</div>
                          <div className="cart-item-price">
                            <em>ETB </em>
                            {dish.price * qty}
                          </div>
                        </div>
                        <div className="qty-ctrl">
                          <button onClick={() => setQty(dish.id, qty - 1)} aria-label="Decrease">−</button>
                          <span>{qty}</span>
                          <button onClick={() => setQty(dish.id, qty + 1)} aria-label="Increase">+</button>
                        </div>
                      </li>
                    ))}
                  </ul>

                  <div className="subhead">Your details</div>
                  <div className="order-form">
                    <input
                      type="text"
                      placeholder="Full name"
                      value={custName}
                      maxLength={100}
                      onChange={(e) => setCustName(e.target.value)}
                    />
                    <input
                      type="tel"
                      placeholder="Phone number"
                      value={custPhone}
                      maxLength={30}
                      onChange={(e) => setCustPhone(e.target.value)}
                    />
                    <textarea
                      placeholder="Delivery address"
                      value={custAddress}
                      maxLength={300}
                      rows={2}
                      onChange={(e) => setCustAddress(e.target.value)}
                    />
                  </div>

                  <div className="order-actions">
                    <button
                      className="send-btn"
                      disabled={!cartItems.length || sending}
                      onClick={() => {
                        sendOrder();
                      }}
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
                        <path d="M22 2 11 13" />
                        <path d="M22 2 15 22l-4-9-9-4 20-7z" />
                      </svg>
                      {sending ? "Sending…" : "Send Order via Telegram"}
                    </button>
                    <button className="clear-btn" onClick={clearCart}>Clear order</button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* BOTTOM NAV */}
      <nav className="nav">
        {(
          [
            ["home", "navHome", <svg key="h" className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="19" height="19"><path d="M3 11l9-8 9 8v10a2 2 0 01-2 2h-4v-7h-6v7H5a2 2 0 01-2-2z" /></svg>],
            ["payment", "navPay", <svg key="p" className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="19" height="19"><rect x="2" y="6" width="20" height="13" rx="2" /><path d="M2 11h20M7 16h4" /></svg>],
          ] as const
        ).map(([id, key, icon]) => (
          <button key={id} className={screen === id ? "active" : ""} onClick={() => setScreen(id as Screen)}>
            {icon}
            <span className="label">{t(lang, key)}</span>
          </button>
        ))}
      </nav>
    </>
  );
}

function PayItem({
  title,
  subtitle,
  icon,
  account,
  accountLabel = "Account Number",
  copied,
  onCopy,
}: {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  account?: string;
  accountLabel?: string;
  copied?: string | null;
  onCopy?: (v: string) => void;
}) {
  const isCopied = !!account && copied === account;
  return (
    <div className="pay-item">
      <div className="pay-item-header">
        <div className="pay-icon-badge">{icon}</div>
        <div>
          <div className="pay-item-title">{title}</div>
          <div className="pay-item-sub">{subtitle}</div>
        </div>
      </div>
      {account && (
        <div className="pay-item-account">
          <div>
            <div className="pay-account-label">{accountLabel}</div>
            <div className="pay-account-num">{account}</div>
          </div>
          <button
            className={"copy-btn" + (isCopied ? " copied" : "")}
            onClick={() => onCopy?.(account)}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="13" height="13">
              <rect x="9" y="9" width="13" height="13" rx="2" />
              <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
            </svg>
            {isCopied ? " Copied!" : " Copy"}
          </button>
        </div>
      )}
    </div>
  );
}