"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function GraphPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to the new timeline page
    router.replace("/timeline");
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-zinc-500">Redirecting to Timeline...</p>
    </div>
  );
}
