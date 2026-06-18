import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ConfirmOptions {
  title?: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** destructive (rojo) por defecto — usado para eliminaciones */
  destructive?: boolean;
}

type ConfirmFn = (options?: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn>(async () => false);

/**
 * Hook imperativo: `const confirm = useConfirm()` y luego
 * `if (await confirm({ title, description })) { ...acción... }`.
 * Devuelve true si el usuario confirma, false si cancela / cierra.
 */
export const useConfirm = () => useContext(ConfirmContext);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<ConfirmOptions>({});
  const resolver = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback<ConfirmFn>((opts = {}) => {
    setOptions(opts);
    setOpen(true);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  // Resuelve la promesa una sola vez (idempotente) y cierra el diálogo
  const settle = useCallback((result: boolean) => {
    setOpen(false);
    resolver.current?.(result);
    resolver.current = null;
  }, []);

  const isDestructive = options.destructive !== false;

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <AlertDialog open={open} onOpenChange={(o) => { if (!o) settle(false); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{options.title ?? "¿Estás seguro?"}</AlertDialogTitle>
            {options.description && (
              <AlertDialogDescription>{options.description}</AlertDialogDescription>
            )}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => settle(false)}>
              {options.cancelLabel ?? "Cancelar"}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => settle(true)}
              className={cn(isDestructive && buttonVariants({ variant: "destructive" }))}
            >
              {options.confirmLabel ?? "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ConfirmContext.Provider>
  );
}
