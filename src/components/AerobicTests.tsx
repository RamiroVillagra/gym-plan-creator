import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, FlaskConical } from "lucide-react";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";

// Tests aerobicos por alumno. El resultado varia segun el test: distancia (m),
// tiempo (seg) o velocidad (value + unit). Se carga desde Estadisticas (coach)
// y se ve tambien en el perfil del alumno (readOnly).

type Test = {
  id: string; test_date: string; name: string;
  result_type: "distancia" | "tiempo" | "velocidad"; value: number; unit: string | null; notes: string | null;
};

const fmtMetros = (v: number) =>
  v >= 1000 ? (v % 1000 === 0 ? `${v / 1000} km` : `${Math.floor(v / 1000)} km ${v % 1000} m`) : `${v} m`;
const fmtSeg = (v: number) =>
  v >= 60 ? (v % 60 === 0 ? `${v / 60} min` : `${Math.floor(v / 60)} min ${v % 60} s`) : `${v} s`;
const fmtResult = (t: Test) => {
  if (t.result_type === "distancia") return fmtMetros(t.value);
  if (t.result_type === "tiempo") return fmtSeg(t.value);
  return `${t.value} ${t.unit ?? "km/h"}`;
};

export default function AerobicTests({ clientId, readOnly = false }: { clientId: string; readOnly?: boolean }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [testDate, setTestDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [resultType, setResultType] = useState<"distancia" | "tiempo" | "velocidad">("distancia");
  const [km, setKm] = useState(""); const [m, setM] = useState("");
  const [min, setMin] = useState(""); const [seg, setSeg] = useState("");
  const [speed, setSpeed] = useState(""); const [speedUnit, setSpeedUnit] = useState("km/h");
  const [notes, setNotes] = useState("");

  const { data: tests, isLoading } = useQuery({
    queryKey: ["aerobic-tests", clientId],
    enabled: !!clientId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("aerobic_tests").select("*").eq("client_id", clientId).order("test_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Test[];
    },
  });

  const resetForm = () => {
    setName(""); setTestDate(format(new Date(), "yyyy-MM-dd")); setResultType("distancia");
    setKm(""); setM(""); setMin(""); setSeg(""); setSpeed(""); setSpeedUnit("km/h"); setNotes("");
  };

  const addTest = useMutation({
    mutationFn: async () => {
      const n = name.trim();
      if (!n) throw new Error("empty");
      let value = 0; let unit: string | null = null;
      if (resultType === "distancia") { value = (parseInt(km) || 0) * 1000 + (parseInt(m) || 0); unit = "m"; }
      else if (resultType === "tiempo") { value = (parseInt(min) || 0) * 60 + (parseInt(seg) || 0); unit = "seg"; }
      else { value = parseFloat(speed) || 0; unit = speedUnit; }
      const { error } = await (supabase as any).from("aerobic_tests").insert({
        client_id: clientId, test_date: testDate, name: n, result_type: resultType, value, unit, notes: notes.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["aerobic-tests", clientId] }); resetForm(); setOpen(false); toast.success("Test guardado"); },
    onError: (e: any) => { if (e?.message !== "empty") toast.error("No se pudo guardar el test"); },
  });

  const deleteTest = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("aerobic_tests").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["aerobic-tests", clientId] }); toast.info("Test eliminado"); },
    onError: () => toast.error("No se pudo eliminar"),
  });

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-center justify-between gap-2 mb-3">
        <h2 className="font-heading font-semibold text-foreground flex items-center gap-2">
          <FlaskConical className="h-5 w-5 text-sky-500" /> Tests aerobicos
        </h2>
        {!readOnly && (
          <button
            onClick={() => { setOpen(v => !v); if (!open) resetForm(); }}
            className="inline-flex items-center gap-1 rounded-lg bg-sky-500 text-white px-3 h-8 text-xs font-medium hover:bg-sky-500/90 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" /> {open ? "Cerrar" : "Agregar test"}
          </button>
        )}
      </div>

      {!readOnly && open && (
        <form onSubmit={e => { e.preventDefault(); addTest.mutate(); }} className="space-y-3 bg-secondary/30 rounded-lg p-3 mb-4">
          <div className="flex gap-2 flex-wrap">
            <div className="flex-1 min-w-[10rem]">
              <label className="text-[11px] font-medium text-muted-foreground block mb-1">Nombre del test</label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ej. Cooper, 1km, Test de campo" className="h-9" />
            </div>
            <div className="w-36">
              <label className="text-[11px] font-medium text-muted-foreground block mb-1">Fecha</label>
              <Input type="date" value={testDate} onChange={e => setTestDate(e.target.value)} className="h-9" />
            </div>
          </div>

          <div>
            <label className="text-[11px] font-medium text-muted-foreground block mb-1">Tipo de resultado</label>
            <div className="flex gap-1">
              {(["distancia", "tiempo", "velocidad"] as const).map(rt => (
                <button key={rt} type="button" onClick={() => setResultType(rt)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${resultType === rt ? "bg-sky-500 text-white" : "bg-secondary text-muted-foreground hover:text-foreground"}`}>
                  {rt}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[11px] font-medium text-muted-foreground block mb-1">Resultado</label>
            {resultType === "distancia" && (
              <div className="flex items-center gap-1.5">
                <Input type="number" min={0} value={km} onChange={e => setKm(e.target.value)} placeholder="0" className="h-9 w-20" />
                <span className="text-xs text-muted-foreground">km</span>
                <Input type="number" min={0} value={m} onChange={e => setM(e.target.value)} placeholder="0" className="h-9 w-20" />
                <span className="text-xs text-muted-foreground">m</span>
              </div>
            )}
            {resultType === "tiempo" && (
              <div className="flex items-center gap-1.5">
                <Input type="number" min={0} value={min} onChange={e => setMin(e.target.value)} placeholder="0" className="h-9 w-20" />
                <span className="text-xs text-muted-foreground">min</span>
                <Input type="number" min={0} value={seg} onChange={e => setSeg(e.target.value)} placeholder="0" className="h-9 w-20" />
                <span className="text-xs text-muted-foreground">seg</span>
              </div>
            )}
            {resultType === "velocidad" && (
              <div className="flex items-center gap-1.5">
                <Input type="number" step="0.1" min={0} value={speed} onChange={e => setSpeed(e.target.value)} placeholder="0" className="h-9 w-24" />
                <select value={speedUnit} onChange={e => setSpeedUnit(e.target.value)} className="h-9 rounded-lg border border-input bg-background px-2 text-sm text-foreground">
                  <option value="km/h">km/h</option>
                  <option value="m/s">m/s</option>
                </select>
              </div>
            )}
          </div>

          <div>
            <label className="text-[11px] font-medium text-muted-foreground block mb-1">Nota (opcional)</label>
            <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Observaciones..." className="h-9" />
          </div>

          <button type="submit" disabled={!name.trim() || addTest.isPending}
            className="w-full h-9 rounded-lg bg-sky-500 text-white text-sm font-medium hover:bg-sky-500/90 transition-colors disabled:opacity-50">
            Guardar test
          </button>
        </form>
      )}

      {isLoading ? (
        <p className="text-sm text-muted-foreground py-6 text-center">Cargando...</p>
      ) : !tests?.length ? (
        <p className="text-sm text-muted-foreground py-6 text-center">
          {readOnly ? "Todavia no tenes tests cargados." : "Sin tests cargados. Agrega el primero."}
        </p>
      ) : (
        <div className="divide-y divide-border/60">
          {tests.map(t => (
            <div key={t.id} className="flex items-center gap-3 py-2.5">
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="text-sm font-semibold text-foreground truncate">{t.name}</span>
                  <span className="text-[11px] text-muted-foreground shrink-0">{format(parseISO(t.test_date), "d MMM yyyy", { locale: es })}</span>
                </div>
                {t.notes && <p className="text-[11px] text-muted-foreground truncate">{t.notes}</p>}
              </div>
              <span className="text-sm font-bold text-sky-600 shrink-0">{fmtResult(t)}</span>
              {!readOnly && (
                <button onClick={() => deleteTest.mutate(t.id)} title="Eliminar" className="p-1 rounded-md hover:bg-secondary text-destructive transition-colors shrink-0">
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
