"use client";

import { useEffect, useState } from "react";

/** Client-side view of /api/me: null while loading. */
export function useMember() {
  const [me, setMe] = useState<{ email: string | null; allowed: boolean } | null>(null);
  useEffect(() => {
    fetch("/api/me")
      .then((r) => (r.ok ? r.json() : { email: null, allowed: false }))
      .then(setMe)
      .catch(() => setMe({ email: null, allowed: false }));
  }, []);
  return me;
}
