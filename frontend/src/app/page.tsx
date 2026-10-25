"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { FullSpinner } from "@/components/ui";

export default function Home() {
  const { teacher, loading } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (!loading) router.replace(teacher ? "/dashboard" : "/login");
  }, [loading, teacher, router]);
  return <FullSpinner />;
}
