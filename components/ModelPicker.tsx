"use client";

/**
 * Model chooser used by the onboarding wizard, "Pasang API key" modal and the
 * employee manager.
 *
 *  baseUrl + key terisi  → daftar model diambil OTOMATIS dari /v1/models
 *  kosong                → kolom nonaktif, tertulis "memuat model…"
 *
 * Kolom bisa diketik untuk menyaring daftar (bukan <select> native), jadi
 * penyedia dengan ratusan model tetap bisa dipakai. Tes koneksi baru boleh
 * jalan setelah model dipilih.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Loader2 } from "lucide-react";

export function ModelPicker({
  baseUrl,
  apiKey,
  value,
  onChange,
  onKeyHint,
}: {
  baseUrl: string;
  apiKey: string;
  value: string;
  onChange: (model: string) => void;
  /** pesan saat daftar model tidak bisa diambil */
  onKeyHint?: (text: string | null) => void;
}) {
  const [models, setModels] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  /** teks pencarian; null = kolom menampilkan model terpilih */
  const [query, setQuery] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  const ready = baseUrl.trim().length > 8 && apiKey.trim().length >= 16;

  // callers pass inline arrows; keep them in a ref so typing never refetches
  const latest = useRef({ onChange, onKeyHint, value });
  latest.current = { onChange, onKeyHint, value };

  const load = useCallback(async () => {
    setBusy(true);
    setNote(null);
    try {
      const res = await fetch("/api/agent/models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ baseUrl: baseUrl.trim(), apiKey: apiKey.trim() }),
      });
      const data = (await res.json()) as { ok?: boolean; models?: string[]; error?: string };
      if (!data.ok || !data.models?.length) {
        setModels([]);
        const text = data.error ?? "Penyedia tidak mengirim daftar model untuk key ini.";
        setNote(text);
        latest.current.onKeyHint?.(text);
        return;
      }
      setModels(data.models);
      latest.current.onKeyHint?.(null);
      // the previous choice may not exist on this provider anymore
      const current = latest.current.value;
      if (!current || !data.models.includes(current)) {
        latest.current.onChange(data.models.find((m) => /free|mini|flash/.test(m)) ?? data.models[0]);
      }
    } catch {
      setModels([]);
      const text = "Gagal mengambil daftar model dari penyedia.";
      setNote(text);
      latest.current.onKeyHint?.(text);
    } finally {
      setBusy(false);
      setLoaded(true);
    }
  }, [baseUrl, apiKey]);

  // debounce: the key field is typed one character at a time
  useEffect(() => {
    if (!ready) {
      setModels([]);
      setNote(null);
      setLoaded(false);
      return;
    }
    setBusy(true);
    const timer = window.setTimeout(() => void load(), 500);
    return () => window.clearTimeout(timer);
  }, [ready, load]);

  // klik di luar / Esc menutup daftar dan membuang teks pencarian
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) {
        setOpen(false);
        setQuery(null);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        setQuery(null);
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const filtered = useMemo(() => {
    const q = (query ?? "").trim().toLowerCase();
    if (!q) return models;
    return models.filter((m) => m.toLowerCase().includes(q));
  }, [models, query]);

  const pick = (m: string) => {
    onChange(m);
    setQuery(null);
    setOpen(false);
  };

  // Enter memilih hasil pertama yang cocok
  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && open && filtered.length) {
      e.preventDefault();
      pick(filtered[0]);
    }
  };

  const canType = ready && models.length > 0;
  const status = busy
    ? "memuat model…"
    : models.length
      ? `${models.length} model`
      : ready && loaded
        ? "tidak ada model"
        : "isi key dulu";

  return (
    <div ref={box} className="relative block text-[9px] font-bold uppercase tracking-wider text-slate-400">
      <label htmlFor="model-picker-input" className="flex items-center gap-1.5">
        Model <span className="text-rose-300">*</span>
        {busy && <Loader2 size={10} className="animate-spin text-cyan-300" />}
        <span className="ml-auto text-[8.5px] font-normal normal-case tracking-normal text-slate-500">
          {query ? `${filtered.length}/${models.length} cocok` : status}
        </span>
      </label>

      <div className="relative mt-1">
        <input
          id="model-picker-input"
          value={query ?? value}
          onChange={(e) => {
            if (!canType) return;
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => canType && setOpen(true)}
          onKeyDown={onKeyDown}
          disabled={busy || !models.length}
          placeholder={busy || !ready ? "memuat model…" : "cari model…"}
          spellCheck={false}
          autoComplete="off"
          className="w-full rounded-lg border border-white/10 bg-black/40 px-2.5 py-1.5 pr-7 font-mono text-[11px] font-normal normal-case tracking-normal text-slate-100 outline-none focus:border-amber-300/60 disabled:opacity-50"
        />
        {busy ? (
          <Loader2 size={11} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 animate-spin text-cyan-300" />
        ) : (
          <button
            type="button"
            tabIndex={-1}
            aria-label="Buka daftar model"
            onClick={() => {
              if (!canType) return;
              setOpen((o) => !o);
              setQuery(null);
            }}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:text-slate-100 disabled:opacity-40"
            disabled={!models.length}
          >
            <ChevronDown size={12} />
          </button>
        )}

        {open && canType && (
          <ul
            role="listbox"
            className="absolute z-50 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-white/10 bg-slate-950/98 p-1 shadow-2xl backdrop-blur"
          >
            {filtered.length === 0 && (
              <li className="px-2 py-1.5 text-[10px] font-normal normal-case tracking-normal text-slate-500">
                tidak ada model cocok
              </li>
            )}
            {filtered.map((m) => (
              <li key={m}>
                <button
                  type="button"
                  role="option"
                  aria-selected={m === value}
                  onClick={() => pick(m)}
                  className={`flex w-full items-center gap-1.5 rounded px-2 py-1 text-left font-mono text-[10.5px] font-normal normal-case tracking-normal transition hover:bg-white/10 ${
                    m === value ? "text-amber-200" : "text-slate-200"
                  }`}
                >
                  {m === value ? <Check size={10} className="shrink-0" /> : <span className="w-[10px] shrink-0" />}
                  <span className="truncate">{m}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {note && (
        <span className="mt-1 block text-[9px] font-normal normal-case tracking-normal text-amber-200/90">{note}</span>
      )}
    </div>
  );
}
