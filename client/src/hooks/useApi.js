import { useCallback, useEffect, useState } from "react";
import { api } from "../services/api";

// Loads data from a GET endpoint and tracks loading/error state.
// const { data, loading, error, reload } = useApi("/orders/my");
// Pass null as the path to skip loading (e.g. until a store is selected).
export function useApi(path) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(Boolean(path));
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    if (!path) return;
    setLoading(true);
    setError("");
    try {
      setData(await api.get(path));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [path]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { data, loading, error, reload, setData };
}

// Wraps an action (button click) with busy + error state.
export function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const run = async (fn) => {
    setBusy(true);
    setError("");
    try {
      return await fn();
    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, setError, run };
}
