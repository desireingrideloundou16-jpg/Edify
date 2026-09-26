"use client";

import React, { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useProjectStore } from "@/lib/store/projects";
import { Box } from "lucide-react";

function StudioNewContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const addProject = useProjectStore((s) => s.addProject);

  useEffect(() => {
    const view = searchParams?.get("view") || "2d";
    const newProj = addProject("Nouveau Projet", "reverse-tuck");
    router.replace(`/studio/${newProj.id}?view=${view}`);
  }, [addProject, router, searchParams]);

  return (
    <div className="h-full w-full flex flex-col items-center justify-center bg-studio-950 text-slate-300">
      <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-brand-600 to-violet-500 flex items-center justify-center shadow-2xl animate-pulse mb-4">
        <Box className="w-6 h-6 text-white" />
      </div>
      <p className="text-xs font-medium text-studio-400">
        Initialisation de votre gabarit packaging...
      </p>
    </div>
  );
}

export default function StudioNewPage() {
  return (
    <Suspense
      fallback={
        <div className="h-full w-full flex items-center justify-center bg-studio-950 text-studio-500 text-xs">
          Chargement...
        </div>
      }
    >
      <StudioNewContent />
    </Suspense>
  );
}
