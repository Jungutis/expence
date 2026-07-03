import { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react';
import { categoriesApi } from '../services/api';
import type { CategoryDef } from '../types';
import { CATEGORY_META } from '../types';
import { useAuth } from './useAuth';

export interface CatMeta {
  label: string;
  emoji: string;
  dot: string;  // pagrindinė spalva
  soft: string; // šviesus fonas
}

interface CategoriesCtx {
  /** Aktyvios (nearchyvuotos) kategorijos, surikiuotos */
  cats: CategoryDef[];
  /** Visos, įskaitant archyvuotas — reikia istoriniams įrašams */
  all: CategoryDef[];
  loading: boolean;
  metaFor: (code: string) => CatMeta;
  refresh: () => Promise<void>;
}

const FALLBACK: CatMeta = { label: 'Kita', emoji: '📦', dot: '#8a8a85', soft: '#e4e2dc' };

// Fallback iš senojo CATEGORY_META, kol DB kategorijos dar nepakrautos
const legacyMeta = (code: string): CatMeta => {
  const m = CATEGORY_META[code];
  if (!m) return { ...FALLBACK, label: code };
  const dots: Record<string, string> = {
    MAISTAS: '#a04d2e', KURAS: '#4a6a8a', RUBAI: '#8a5258',
    NEBUTINOS: '#5b5a8c', BOLT_WOLT: '#2e6a7a', KITOS: '#a07d2e',
  };
  const softs: Record<string, string> = {
    MAISTAS: '#ecd0bf', KURAS: '#d4dde6', RUBAI: '#e8d2d4',
    NEBUTINOS: '#dadae6', BOLT_WOLT: '#d2e2e6', KITOS: '#eddfbc',
  };
  return { label: m.label, emoji: m.emoji, dot: dots[code] ?? FALLBACK.dot, soft: softs[code] ?? FALLBACK.soft };
};

const Ctx = createContext<CategoriesCtx>({
  cats: [], all: [], loading: true, metaFor: legacyMeta, refresh: async () => {},
});

export function CategoriesProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [all, setAll] = useState<CategoryDef[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const { categories } = await categoriesApi.list();
      setAll(categories);
    } catch { /* paliekam fallback */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (user) { setLoading(true); refresh(); }
    else { setAll([]); setLoading(false); }
  }, [user, refresh]);

  const value = useMemo<CategoriesCtx>(() => {
    const byCode = new Map(all.map(c => [c.code, c]));
    return {
      cats: all.filter(c => !c.archived),
      all,
      loading,
      metaFor: (code: string) => {
        const c = byCode.get(code);
        if (c) return { label: c.label, emoji: c.emoji, dot: c.color, soft: c.soft };
        return legacyMeta(code);
      },
      refresh,
    };
  }, [all, loading, refresh]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCategories() {
  return useContext(Ctx);
}
