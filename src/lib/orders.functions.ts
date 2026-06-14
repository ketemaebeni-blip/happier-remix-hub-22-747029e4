import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const OrderItemSchema = z.object({
  name: z.string().min(1).max(200),
  qty: z.number().int().min(1).max(999),
  price: z.number().min(0).max(1_000_000),
  img: z.string().url().max(2000).optional().nullable(),
});

const PlaceOrderSchema = z.object({
  customer_name: z.string().trim().max(100).optional().default(""),
  customer_phone: z.string().trim().max(30).optional().default(""),
  customer_address: z.string().trim().max(300).optional().default(""),
  items: z.array(OrderItemSchema).min(1).max(50),
  total: z.number().min(0).max(10_000_000),
});

type PlaceOrderInput = z.infer<typeof PlaceOrderSchema>;

function buildCaption(order: PlaceOrderInput): string {
  const lines: string[] = [];
  lines.push("🌸 Selam Cake & Arts — New Order");
  lines.push("");
  if (order.customer_name) lines.push(`👤 Name: ${order.customer_name}`);
  if (order.customer_phone) lines.push(`📞 Phone: ${order.customer_phone}`);
  if (order.customer_address) lines.push(`📍 Address: ${order.customer_address}`);
  lines.push("");
  lines.push("🧁 Items:");
  order.items.forEach((it) => {
    lines.push(`• ${it.name} × ${it.qty} — ETB ${it.price * it.qty}`);
  });
  lines.push("");
  lines.push(`💰 Total: ETB ${order.total}`);
  return lines.join("\n");
}

async function sendToTelegram(order: PlaceOrderInput) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return; // Telegram not configured — skip silently

  const api = (method: string) => `https://api.telegram.org/bot${token}/${method}`;
  const caption = buildCaption(order);

  // Collect valid photo URLs (https only — Telegram requires reachable URLs)
  const photos = order.items
    .map((it) => it.img)
    .filter((u): u is string => !!u && /^https:\/\//i.test(u));

  try {
    if (photos.length === 0) {
      await fetch(api("sendMessage"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text: caption }),
      });
      return;
    }

    if (photos.length === 1) {
      await fetch(api("sendPhoto"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, photo: photos[0], caption }),
      });
      return;
    }

    // Multiple photos: send in groups of 10, caption on the first photo of the first group
    for (let i = 0; i < photos.length; i += 10) {
      const chunk = photos.slice(i, i + 10);
      const media = chunk.map((url, idx) => ({
        type: "photo",
        media: url,
        ...(i === 0 && idx === 0 ? { caption } : {}),
      }));
      await fetch(api("sendMediaGroup"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, media }),
      });
    }
  } catch (err) {
    console.error("[orders] Telegram send failed", err);
  }
}

export const placeOrder = createServerFn({ method: "POST" })
  .inputValidator((input: PlaceOrderInput) => PlaceOrderSchema.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: order, error } = await supabaseAdmin
      .from("orders")
      .insert({
        customer_name: data.customer_name || null,
        customer_phone: data.customer_phone || null,
        customer_address: data.customer_address || null,
        items: data.items,
        total: data.total,
      })
      .select("id")
      .single();

    if (error) {
      console.error("[orders] insert failed", error);
      throw new Error("Could not save order");
    }

    await sendToTelegram(data);

    return { ok: true, id: order.id };
  });
