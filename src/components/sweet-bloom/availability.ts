import { useEffect, useState, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { setCakeAvailability } from "@/lib/cake-admin.functions";

/** Hardcoded manager account — only this email is granted admin role on signup. */
export const ADMIN_EMAIL = "admin@selamcake.com";

/**
 * Subscribe to the cake_availability table (live).
 * Returns the set of unavailable cake IDs plus an admin-only setter.
 */
export function useUnavailable() {
  const [ids, setIds] = useState<number[]>([]);
  const setCakeAvailabilityFn = useServerFn(setCakeAvailability);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("cake_availability")
      .select("cake_id, available");
    if (error) {
      console.error("Load availability failed", error);
      return;
    }
    setIds((data ?? []).filter((r: any) => r.available === false).map((r: any) => r.cake_id));
  }, []);

  useEffect(() => {
    load();
    const channel = supabase
      .channel("cake_availability_changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "cake_availability" },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [load]);

  const setAvailable = useCallback(async (id: number, available: boolean) => {
    await setCakeAvailabilityFn({ data: { cake_id: id, available } });
    // Optimistically update local state and reload — realtime may be filtered
    // by column-level grants on updated_by, so we don't rely on it.
    setIds((prev) => {
      const has = prev.includes(id);
      if (available && has) return prev.filter((x) => x !== id);
      if (!available && !has) return [...prev, id];
      return prev;
    });
    await load();
  }, [load, setCakeAvailabilityFn]);

  return { unavailableIds: ids, setAvailable, isAvailable: (id: number) => !ids.includes(id) };
}

export type CakeOverride = {
  cake_id: number;
  name: string | null;
  category: string | null;
  price: number | null;
  image_url: string | null;
};

export type AvailabilityLogEntry = {
  id: string;
  cake_id: number;
  available: boolean;
  changed_by: string | null;
  changed_by_email: string | null;
  changed_at: string;
};

export function useAvailabilityLog(limit = 50) {
  const [entries, setEntries] = useState<AvailabilityLogEntry[]>([]);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("cake_availability_log")
      .select("id, cake_id, available, changed_by, changed_by_email, changed_at")
      .order("changed_at", { ascending: false })
      .limit(limit);
    if (error) {
      console.error("Load audit log failed", error);
      return;
    }
    setEntries((data ?? []) as AvailabilityLogEntry[]);
  }, [limit]);

  useEffect(() => {
    load();
    const channel = supabase
      .channel("cake_availability_log_changes")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "cake_availability_log" },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [load]);

  return { entries, reload: load };
}

export function useCakeOverrides() {
  const [overrides, setOverrides] = useState<Record<number, CakeOverride>>({});

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("cake_overrides")
      .select("cake_id, name, category, price, image_url");
    if (error) {
      console.error("Load overrides failed", error);
      return;
    }
    const map: Record<number, CakeOverride> = {};
    (data ?? []).forEach((r: any) => {
      map[r.cake_id] = r as CakeOverride;
    });
    setOverrides(map);
  }, []);

  useEffect(() => {
    load();
    const channel = supabase
      .channel("cake_overrides_changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "cake_overrides" },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [load]);

  const saveOverride = useCallback(
    async (cake_id: number, fields: { name?: string; category?: string; price?: number; image_url?: string }) => {
      const { data: u } = await supabase.auth.getUser();
      const payload: any = {
        cake_id,
        ...fields,
        updated_at: new Date().toISOString(),
        updated_by: u.user?.id ?? null,
      };
      const { error } = await supabase
        .from("cake_overrides")
        .upsert(payload, { onConflict: "cake_id" });
      if (error) {
        console.error("Save override failed", error);
        throw error;
      }
    },
    [],
  );

  function applyOverride<T extends { id: number; cat: string; nameEN: string; price: number; img: string }>(d: T): T {
    const o = overrides[d.id];
    if (!o) return d;
    return {
      ...d,
      cat: o.category ?? d.cat,
      nameEN: o.name ?? d.nameEN,
      price: o.price != null ? Number(o.price) : d.price,
      img: o.image_url ?? d.img,
    };
  }

  return { overrides, saveOverride, applyOverride };
}