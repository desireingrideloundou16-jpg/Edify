"use client";

// Temporary tool page (not linked): renders marketing assets with the Edify engine.
//   /dev-renders                         → HD reference renders of every showcase pack
//   /dev-renders?mode=turntable&i=1&n=48 → 360° turntable frames (transparent PNG)
//   /dev-renders?mode=dieline&i=1        → flat artwork + die-line
//   /dev-renders?mode=ad&i=1&scene=podium → advertising visual
import React, { useEffect, useState } from "react";
import { ALL_CATALOG_SHAPES } from "@/lib/catalog/shapes";
import { SHOWCASE, loadShowcaseArt } from "@/components/landing/showcase";

export function DevRenders() {
  const [items, setItems] = useState<{ key: string; url: string; ms?: number }[]>([]);
  const [viewer, setViewer] = useState<React.ReactNode>(null);
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const mode = q.get("mode") ?? "refs";
    const index = Number(q.get("i") ?? 1);
    const push = (key: string, url: string, ms?: number) => setItems((prev) => (prev.some((p) => p.key === key) ? prev : [...prev, { key, url, ms }]));
    let cancelled = false;
    (async () => {
      const { renderShowcase } = await import("@/lib/three/thumbnails");
      const item = SHOWCASE[index];
      // &shape=<catalog id> renders another container with the same showcase artwork.
      const shape = ALL_CATALOG_SHAPES.find((s) => s.id === (q.get("shape") ?? item.shapeId))!;
      // &label=1 adds full label information (bilingual back panel, real EAN-13).
      const label = q.has("label")
        ? { ingredients: "Eau, fleurs d'hibiscus 12 %, sucre de canne, menthe / Water, hibiscus flowers 12%, cane sugar, mint", usage: "Bien agiter. Servir frais. / Shake well. Serve chilled.", barcode: "4006381333931", production: "2026-09-26", expiry: "2027-03-26", price: "1 500 FCFA", extra: "Fabriqué à Douala, Cameroun / Made in Douala, Cameroon" }
        : {};
      const design = { ...item.design, ...label, logo: null, art: await loadShowcaseArt(item) };
      if (mode === "turntable") {
        const n = Number(q.get("n") ?? 48);
        for (let f = 0; f < n && !cancelled; f++) {
          const from = q.has("from") ? Number(q.get("from")) : -0.5;
          const to = q.has("to") ? Number(q.get("to")) : -0.5 + Math.PI * 2;
          const url = await renderShowcase(shape, design, 900, from + (f / (q.has("to") ? n - 1 : n)) * (to - from));
          if (url) push(`f${String(f).padStart(3, "0")}`, url);
        }
      } else if (mode === "dieline") {
        const [{ flatLayout, BLEED_MM }, { renderFlatArtwork, drawDieline }, { loadDesignFonts }] = await Promise.all([
          import("@/lib/print/layout"),
          import("@/lib/print/artwork"),
          import("@/lib/artwork/draw"),
        ]);
        await loadDesignFonts(design);
        const layout = flatLayout({ model: shape.model ?? "box", lengthMm: shape.lengthMm, widthMm: shape.widthMm, heightMm: shape.heightMm });
        const k = 1400 / (layout.width + BLEED_MM * 2);
        const art = renderFlatArtwork(layout, design, k);
        drawDieline(art.getContext("2d")!, layout, k);
        push("dieline", art.toDataURL("image/png"));
      } else if (mode === "layouts") {
        // /dev-renders?mode=layouts&i=1 → every front layout with a motif, side by side
        const [{ LAYOUTS, MOTIFS }, { drawFace, loadDesignFonts }] = await Promise.all([import("@/lib/artwork/compose"), import("@/lib/artwork/draw")]);
        await loadDesignFonts(design);
        // &art=bissap → /dev-art/bissap.jpg, &style=flat, &badge=…, &origin=…
        let art: HTMLImageElement | null = null;
        if (q.get("art")) {
          art = new Image();
          art.src = `/dev-art/${q.get("art")}.jpg`;
          await art.decode().catch(() => (art = null));
        }
        const extras = { art, artStyle: q.get("style") ?? "flat", badge: q.get("badge") ?? "", origin: q.get("origin") ?? "" };
        const only = q.get("only")?.split(",");
        const list = LAYOUTS.filter((l) => !only || only.includes(l));
        const c = document.createElement("canvas");
        const W = 300, Hh = 420;
        c.width = W * 5;
        c.height = Hh * Math.ceil(list.length / 5);
        const ctx = c.getContext("2d")!;
        list.forEach((layout, k) => {
          const motif = q.has("motif") ? (q.get("motif") as typeof MOTIFS[number]) : MOTIFS[(k + 1) % MOTIFS.length];
          drawFace(ctx, (k % 5) * W, Math.floor(k / 5) * Hh, W - 8, Hh - 8, { ...design, ...extras, layout, motif, tagline: design.tagline || "Récolté à la main" }, "front");
        });
        push("layouts", c.toDataURL("image/png"));
      } else if (mode === "landing") {
        // Static landing assets: every showcase pack as a transparent WebP.
        const size = Number(q.get("size") ?? 720);
        for (let i = 0; i < SHOWCASE.length && !cancelled; i++) {
          const it = SHOWCASE[i];
          const sh = ALL_CATALOG_SHAPES.find((s) => s.id === it.shapeId);
          if (!sh) continue;
          const png = await renderShowcase(sh, { ...it.design, logo: null, art: await loadShowcaseArt(it) }, size, -0.45);
          if (!png) continue;
          const img = new Image();
          img.src = png;
          await img.decode();
          const c = document.createElement("canvas");
          c.width = c.height = size;
          c.getContext("2d")!.drawImage(img, 0, 0);
          push(`pack-${String(i).padStart(2, "0")}`, c.toDataURL("image/webp", 0.86));
        }
      } else if (mode === "scenes") {
        const { AD_DECORS } = await import("@/lib/three/adRender");
        const decor = AD_DECORS.find((x) => x.id === (q.get("decor") ?? "ingredients")) ?? AD_DECORS[0];
        document.body.dataset.prompts = JSON.stringify(SHOWCASE.map((it) => decor.prompt({ ...it.design, logo: null })));
      } else if (mode === "hd") {
        // /dev-renders?mode=hd&i=1&camera=hero&lighting=premium&size=1600&samples=48&bg=preset → HD render + time
        const { renderHD } = await import("@/lib/three/hdRender");
        const { loadDesignFonts } = await import("@/lib/artwork/draw");
        await loadDesignFonts(design);
        const size = Number(q.get("size") ?? 1600);
        const t0 = performance.now();
        const url = await renderHD({
          spec: { model: shape.model ?? "box", lengthMm: shape.lengthMm, widthMm: shape.widthMm, heightMm: shape.heightMm, material: shape.material },
          design,
          camera: (q.get("camera") ?? "hero") as "hero",
          lighting: (q.get("lighting") ?? "premium") as "premium",
          width: size,
          height: size,
          samples: q.has("samples") ? Number(q.get("samples")) : undefined,
          background: q.get("bg") ?? "preset",
          yaw: Number(q.get("yaw") ?? 0),
        });
        if (url) push("hd", url, Math.round(performance.now() - t0));
      } else if (mode === "viewer") {
        // /dev-renders?mode=viewer&i=1 → model build time + interactive viewer FPS (body data attributes)
        const { default: Viewer } = await import("@/components/workspace/Packaging3DViewer");
        const spec = { model: shape.model ?? "box", lengthMm: shape.lengthMm, widthMm: shape.widthMm, heightMm: shape.heightMm, material: shape.material };
        const { buildPackaging, disposeObject } = await import("@/lib/three/packagingModels");
        const b0 = performance.now();
        disposeObject(buildPackaging(spec, design));
        document.body.dataset.buildMs = String(Math.round(performance.now() - b0));
        setViewer(
          <div style={{ width: 800, height: 800 }}>
            <Viewer spec={spec} design={design} logoUrl={null} view="threeQuarter" lighting="studio" autoRotate />
          </div>
        );
        await new Promise<void>((ok) => {
          const wait = () => (document.querySelector("canvas") ? ok() : requestAnimationFrame(wait));
          wait();
        });
        await new Promise((ok) => setTimeout(ok, 1500));
        let frames = 0;
        const start = performance.now();
        await new Promise<void>((ok) => {
          const tick = () => (++frames, performance.now() - start < 4000 ? requestAnimationFrame(tick) : ok());
          requestAnimationFrame(tick);
        });
        document.body.dataset.fps = (frames / ((performance.now() - start) / 1000)).toFixed(1);
      } else if (mode === "ad") {
        const { renderAd } = await import("@/lib/three/adRender");
        const url = await renderAd({
          spec: { model: shape.model ?? "box", lengthMm: shape.lengthMm, widthMm: shape.widthMm, heightMm: shape.heightMm, material: shape.material },
          design,
          scene: (q.get("scene") as "podium") ?? "podium",
          format: (q.get("format") as "portrait") ?? "portrait",
          withCopy: q.get("copy") !== "0",
          seed: Number(q.get("seed") ?? 2),
          scale: Number(q.get("scale") ?? 0.75),
          backgroundUrl: q.get("bg"),
        });
        if (q.has("webp")) {
          const img = new Image();
          img.src = url;
          await img.decode();
          const c = document.createElement("canvas");
          c.width = img.width;
          c.height = img.height;
          c.getContext("2d")!.drawImage(img, 0, 0);
          push("ad", c.toDataURL("image/webp", 0.84));
        } else push("ad", url);
      } else {
        for (let i = 0; i < SHOWCASE.length && !cancelled; i++) {
          const it = SHOWCASE[i];
          const sh = ALL_CATALOG_SHAPES.find((s) => s.id === it.shapeId);
          if (!sh) continue;
          const packDesign = { ...it.design, logo: null, art: await loadShowcaseArt(it) };
          const t0 = performance.now();
          const png = await renderShowcase(sh, packDesign, 1024, -0.35);
          const ms = Math.round(performance.now() - t0);
          if (!png) continue;
          const img = new Image();
          img.src = png;
          await img.decode();
          const c = document.createElement("canvas");
          c.width = c.height = 1024;
          const ctx = c.getContext("2d")!;
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, 1024, 1024);
          ctx.drawImage(img, 0, 0);
          push(`pack-${String(i).padStart(2, "0")}`, c.toDataURL("image/jpeg", 0.95), ms);
        }
      }
      if (!cancelled) document.body.dataset.done = "1";
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      {viewer}
      {items.map((it) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={it.key} data-key={it.key} data-ms={it.ms} src={it.url} alt="" width={160} />
      ))}
    </div>
  );
}
