import { useSearchParams } from "react-router-dom";

/** Search text replaces the current history entry; page navigation still pushes. */
export function useQueryValue(name: string, fallback = ""): [string, (value: string) => void] {
  const [params, setParams] = useSearchParams();
  const value = (params.get(name) ?? fallback).slice(0, 100);
  return [value, (next) => {
    setParams((current) => {
      const updated = new URLSearchParams(current);
      if (next && next !== fallback) updated.set(name, next);
      else updated.delete(name);
      return updated;
    }, { replace: true });
  }];
}
