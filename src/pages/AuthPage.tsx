import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (isLogin) {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) toast.error(error.message);
    } else {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName, role: "student" },
          emailRedirectTo: window.location.origin,
        },
      });
      if (error) {
        toast.error(error.message);
      } else {
        toast.success("Cuenta creada. Revisá tu email para confirmar.");
      }
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center p-4 overflow-hidden bg-background">

      {/* Ambient glow orbs — subtle depth, not distracting */}
      <div
        className="absolute top-1/4 left-1/3 w-[480px] h-[480px] rounded-full pointer-events-none"
        style={{ background: "radial-gradient(circle, hsl(var(--primary) / 0.07) 0%, transparent 70%)" }}
      />
      <div
        className="absolute bottom-1/4 right-1/4 w-[360px] h-[360px] rounded-full pointer-events-none"
        style={{ background: "radial-gradient(circle, hsl(var(--primary) / 0.05) 0%, transparent 70%)" }}
      />

      {/* Card */}
      <div className="w-full max-w-sm relative z-10 animate-scale-in">

        {/* Logo mark */}
        <div className="flex flex-col items-center gap-3 mb-8">
          <div className="relative">
            <div className="absolute inset-0 rounded-2xl bg-primary/20 blur-xl" />
            <div className="relative h-14 w-14 rounded-2xl bg-primary/12 border border-primary/25 flex items-center justify-center ring-1 ring-primary/15 ring-offset-1 ring-offset-background">
              <img src="/logo.png" alt="Delta App" className="h-8 w-8 object-contain" />
            </div>
          </div>
          <div className="text-center">
            <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground">
              Delta App
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5 font-data tracking-wider uppercase">
              Training Platform
            </p>
          </div>
        </div>

        {/* Form card */}
        <div className="relative bg-card border border-border/60 rounded-2xl p-6 shadow-card overflow-hidden">
          {/* Card top-light */}
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/8 to-transparent" />

          <h2 className="text-lg font-heading font-semibold mb-1 text-foreground">
            {isLogin ? "Iniciar Sesión" : "Crear Cuenta"}
          </h2>
          <p className="text-xs text-muted-foreground mb-6">
            {isLogin
              ? "Ingresá tus credenciales para continuar"
              : "Completá tus datos para registrarte"
            }
          </p>

          <form onSubmit={handleSubmit} className="space-y-3">
            {!isLogin && (
              <div className="space-y-1.5">
                <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                  Nombre completo
                </label>
                <Input
                  placeholder="Tu nombre"
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  required
                  className="bg-input/60 border-border/60 focus:border-primary/50 transition-colors"
                />
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                Email
              </label>
              <Input
                type="email"
                placeholder="tu@email.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className="bg-input/60 border-border/60 focus:border-primary/50 transition-colors"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                Contraseña
              </label>
              <Input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                minLength={6}
                className="bg-input/60 border-border/60 focus:border-primary/50 transition-colors"
              />
            </div>

            <Button
              type="submit"
              className="w-full mt-2 font-semibold tracking-wide shadow-glow-sm hover:shadow-glow transition-all duration-200"
              disabled={loading}
            >
              {loading ? "Cargando..." : isLogin ? "Entrar" : "Registrarse"}
            </Button>
          </form>

          <div className="mt-5 pt-4 border-t border-border/40">
            <button
              onClick={() => setIsLogin(!isLogin)}
              className="w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors font-medium"
            >
              {isLogin
                ? "¿No tenés cuenta? · Registrate"
                : "¿Ya tenés cuenta? · Iniciá sesión"
              }
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
