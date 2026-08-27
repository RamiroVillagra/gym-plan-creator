import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Square, Dumbbell, Save, Trash2, Search, X } from "lucide-react";
import { toast } from "sonner";

// ─── Editor interactivo del plano del gimnasio ──────────────────────────────
// Items sobre un lienzo SVG: se arrastran para mover, se redimensionan por la
// esquina, y se pueden agregar zonas o ejercicios. Se guarda como un JSON en
// la tabla `gym_map`.

type Item = {
  id: string;
  kind: "zone" | "exercise";
  x: number; y: number; w: number; h: number;
  label: string;
  exerciseId?: string;
};

const uid = () =>
  (globalThis.crypto?.randomUUID?.() ?? `id-${Date.now()}-${Math.random().toString(36).slice(2)}`);

// Croquis inicial (si no hay plano guardado): zonas 1/2 del dibujo en papel.
const seed = (): Item[] => [
  { id: uid(), kind: "zone", x: 180, y: 120, w: 110, h: 150, label: "1" },
  { id: uid(), kind: "zone", x: 300, y: 135, w: 80, h: 80, label: "2" },
  { id: uid(), kind: "zone", x: 395, y: 120, w: 105, h: 150, label: "1" },
  { id: uid(), kind: "zone", x: 510, y: 135, w: 80, h: 80, label: "2" },
  { id: uid(), kind: "zone", x: 600, y: 120, w: 140, h: 150, label: "1" },
  { id: uid(), kind: "zone", x: 460, y: 330, w: 280, h: 160, label: "1" },
  { id: uid(), kind: "zone", x: 600, y: 380, w: 80, h: 80, label: "2" },
];

// Color de una zona según su número (1 rojo, 2 azul, otro neutro)
const zoneColor = (label: string) =>
  label.trim() === "1" ? "hsl(var(--destructive))"
  : label.trim() === "2" ? "hsl(var(--primary))"
  : "hsl(var(--muted-foreground))";

export default function GymMapEditor() {
  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<null | {
    id: string; mode: "move" | "resize";
    startX: number; startY: number; origX: number; origY: number; origW: number; origH: number;
    moved: boolean;
  }>(null);

  const [items, setItems] = useState<Item[]>(seed());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mapId, setMapId] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [addingExercise, setAddingExercise] = useState(false);
  const [exSearch, setExSearch] = useState("");

  // Cargar plano guardado
  const { data: loaded } = useQuery({
    queryKey: ["gym-map"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("gym_map").select("id, data").order("updated_at", { ascending: false }).limit(1);
      if (error) throw error;
      return (data?.[0] ?? null) as { id: string; data: Item[] } | null;
    },
  });
  const appliedRef = useRef(false);
  useEffect(() => {
    if (appliedRef.current || loaded === undefined) return;
    appliedRef.current = true;
    if (loaded) {
      setMapId(loaded.id);
      if (Array.isArray(loaded.data) && loaded.data.length) setItems(loaded.data);
    }
  }, [loaded]);

  const { data: exercises } = useQuery({
    queryKey: ["exercises"],
    queryFn: async () => {
      const { data, error } = await supabase.from("exercises").select("id, name").order("name");
      if (error) throw error;
      return (data ?? []) as { id: string; name: string }[];
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      if (mapId) {
        const { error } = await (supabase as any).from("gym_map").update({ data: items, updated_at: new Date().toISOString() }).eq("id", mapId);
        if (error) throw error;
      } else {
        const { data, error } = await (supabase as any).from("gym_map").insert({ data: items }).select("id").single();
        if (error) throw error;
        if (data?.id) setMapId(data.id);
      }
    },
    onSuccess: () => { setDirty(false); toast.success("Plano guardado"); },
    onError: () => toast.error("No se pudo guardar el plano"),
  });

  // ── Coordenadas: cliente → SVG ──
  const toSvg = (clientX: number, clientY: number) => {
    const svg = svgRef.current!;
    const pt = svg.createSVGPoint();
    pt.x = clientX; pt.y = clientY;
    const m = svg.getScreenCTM();
    if (!m) return { x: clientX, y: clientY };
    const p = pt.matrixTransform(m.inverse());
    return { x: p.x, y: p.y };
  };

  const onItemPointerDown = (e: React.PointerEvent, id: string, mode: "move" | "resize") => {
    e.stopPropagation();
    svgRef.current?.setPointerCapture(e.pointerId);
    const it = items.find(i => i.id === id)!;
    const p = toSvg(e.clientX, e.clientY);
    dragRef.current = { id, mode, startX: p.x, startY: p.y, origX: it.x, origY: it.y, origW: it.w, origH: it.h, moved: false };
    setSelectedId(id);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const p = toSvg(e.clientX, e.clientY);
    const dx = p.x - d.startX, dy = p.y - d.startY;
    if (Math.abs(dx) > 1 || Math.abs(dy) > 1) d.moved = true;
    setItems(prev => prev.map(i => {
      if (i.id !== d.id) return i;
      if (d.mode === "move") return { ...i, x: Math.round(d.origX + dx), y: Math.round(d.origY + dy) };
      return { ...i, w: Math.max(30, Math.round(d.origW + dx)), h: Math.max(24, Math.round(d.origH + dy)) };
    }));
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (dragRef.current?.moved) setDirty(true);
    dragRef.current = null;
    svgRef.current?.releasePointerCapture?.(e.pointerId);
  };

  const addZone = () => {
    const it: Item = { id: uid(), kind: "zone", x: 120, y: 120, w: 90, h: 90, label: "1" };
    setItems(prev => [...prev, it]); setSelectedId(it.id); setDirty(true);
  };
  const addExerciseItem = (exId: string, exName: string) => {
    const it: Item = { id: uid(), kind: "exercise", x: 130, y: 130, w: 130, h: 44, label: exName, exerciseId: exId };
    setItems(prev => [...prev, it]); setSelectedId(it.id); setDirty(true);
    setAddingExercise(false); setExSearch("");
  };
  const updateItem = (id: string, patch: Partial<Item>) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, ...patch } : i)); setDirty(true);
  };
  const removeItem = (id: string) => {
    setItems(prev => prev.filter(i => i.id !== id));
    if (selectedId === id) setSelectedId(null);
    setDirty(true);
  };

  const selected = items.find(i => i.id === selectedId) ?? null;
  const exResults = (exercises ?? []).filter(e => e.name.toLowerCase().includes(exSearch.toLowerCase())).slice(0, 8);

  return (
    <div>
      <p className="text-muted-foreground mb-3 text-sm">
        Arrastrá las zonas y ejercicios para moverlos, tirá de la esquina para cambiar el tamaño,
        y agregá lo que necesites. Acordate de <span className="font-medium">Guardar</span>.
      </p>

      {/* Barra de herramientas */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <button onClick={addZone} className="inline-flex items-center gap-1.5 rounded-lg bg-secondary px-3 h-9 text-sm font-medium text-foreground hover:bg-muted transition-colors">
          <Square className="h-4 w-4" /> Agregar zona
        </button>
        <div className="relative">
          <button onClick={() => { setAddingExercise(v => !v); setExSearch(""); }} className="inline-flex items-center gap-1.5 rounded-lg bg-secondary px-3 h-9 text-sm font-medium text-foreground hover:bg-muted transition-colors">
            <Dumbbell className="h-4 w-4" /> Agregar ejercicio
          </button>
          {addingExercise && (
            <div className="absolute z-20 mt-1 w-64 bg-card border border-border rounded-lg shadow-lg overflow-hidden">
              <div className="flex items-center px-3 py-2 border-b border-border">
                <Search className="h-3.5 w-3.5 text-muted-foreground mr-2 shrink-0" />
                <input autoFocus value={exSearch} onChange={e => setExSearch(e.target.value)} placeholder="Buscar ejercicio..." className="h-7 flex-1 bg-transparent text-sm outline-none text-foreground placeholder:text-muted-foreground" />
                <button onClick={() => setAddingExercise(false)}><X className="h-4 w-4 text-muted-foreground" /></button>
              </div>
              <div className="max-h-52 overflow-y-auto">
                {!exResults.length ? (
                  <p className="text-xs text-muted-foreground px-3 py-2 text-center">Escribí para buscar…</p>
                ) : exResults.map(e => (
                  <button key={e.id} onClick={() => addExerciseItem(e.id, e.name)} className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-secondary transition-colors">
                    {e.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        <button
          onClick={() => save.mutate()}
          disabled={save.isPending || !dirty}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 h-9 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 ml-auto"
        >
          <Save className="h-4 w-4" /> {save.isPending ? "Guardando..." : dirty ? "Guardar" : "Guardado"}
        </button>
      </div>

      {/* Lienzo */}
      <div className="bg-card border border-border rounded-xl p-2 overflow-x-auto">
        <svg
          ref={svgRef}
          viewBox="0 0 1000 700"
          className="w-full h-auto touch-none select-none"
          style={{ minWidth: 640 }}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerDown={() => setSelectedId(null)}
        >
          {/* Grilla de fondo */}
          <defs>
            <pattern id="gmgrid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="hsl(var(--border))" strokeWidth="1" opacity="0.5" />
            </pattern>
          </defs>
          <rect x="0" y="0" width="1000" height="700" fill="url(#gmgrid)" />

          {items.map(it => {
            const isSel = it.id === selectedId;
            const color = it.kind === "zone" ? zoneColor(it.label) : "hsl(var(--primary))";
            return (
              <g key={it.id} onPointerDown={e => onItemPointerDown(e, it.id, "move")} style={{ cursor: "move" }}>
                <rect
                  x={it.x} y={it.y} width={it.w} height={it.h} rx={it.kind === "exercise" ? 8 : 3}
                  fill={it.kind === "exercise" ? "hsl(var(--primary) / 0.12)" : "transparent"}
                  stroke={color}
                  strokeWidth={isSel ? 3.5 : 2.5}
                />
                <text
                  x={it.x + it.w / 2} y={it.y + it.h / 2}
                  textAnchor="middle" dominantBaseline="central"
                  fontSize={it.kind === "zone" ? 26 : 13} fontWeight={700}
                  fill={color}
                  style={{ pointerEvents: "none" }}
                >
                  {it.label.length > 16 && it.kind === "exercise" ? it.label.slice(0, 15) + "…" : it.label}
                </text>
                {/* Handle de resize (esquina inferior derecha) */}
                {isSel && (
                  <rect
                    x={it.x + it.w - 9} y={it.y + it.h - 9} width={14} height={14} rx={2}
                    fill="hsl(var(--primary))" stroke="hsl(var(--card))" strokeWidth={2}
                    style={{ cursor: "nwse-resize" }}
                    onPointerDown={e => onItemPointerDown(e, it.id, "resize")}
                  />
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {/* Panel del item seleccionado */}
      {selected && (
        <div className="mt-3 flex items-end gap-2 flex-wrap bg-secondary/40 rounded-lg p-3">
          <div className="flex-1 min-w-[10rem]">
            <label className="text-[11px] font-medium text-muted-foreground block mb-1">
              {selected.kind === "zone" ? "Número / nombre de la zona" : "Etiqueta del ejercicio"}
            </label>
            <Input value={selected.label} onChange={e => updateItem(selected.id, { label: e.target.value })} className="h-9" />
          </div>
          {selected.kind === "zone" && (
            <div className="flex gap-1">
              {["1", "2"].map(n => (
                <button key={n} onClick={() => updateItem(selected.id, { label: n })}
                  className="h-9 w-9 rounded-lg border border-border text-sm font-bold hover:bg-secondary transition-colors"
                  style={{ color: zoneColor(n) }}>
                  {n}
                </button>
              ))}
            </div>
          )}
          <button onClick={() => removeItem(selected.id)} className="h-9 inline-flex items-center gap-1.5 rounded-lg border border-destructive/40 text-destructive px-3 text-sm font-medium hover:bg-destructive/10 transition-colors">
            <Trash2 className="h-4 w-4" /> Eliminar
          </button>
        </div>
      )}
    </div>
  );
}
