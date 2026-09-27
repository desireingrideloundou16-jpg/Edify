"use client";

import React, { useEffect, useRef, useState } from "react";
import { Pause, Play, Maximize2 } from "lucide-react";

/** Demo film: plays muted when scrolled into view, lighter file on small screens. */
export function DemoVideo() {
  const ref = useRef<HTMLVideoElement>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    setSrc(window.matchMedia("(max-width: 900px)").matches ? "/landing/edify-demo-720.mp4" : "/landing/edify-demo.mp4");
  }, []);

  useEffect(() => {
    const v = ref.current;
    if (!v || !src) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting && !reduced) v.play().catch(() => {});
        else v.pause();
      },
      { threshold: 0.35 }
    );
    io.observe(v);
    return () => io.disconnect();
  }, [src]);

  const toggle = () => {
    const v = ref.current;
    if (!v) return;
    if (v.paused) v.play().catch(() => {});
    else v.pause();
  };

  return (
    <figure className="lp-video">
      <div className="lp-browser-bar" aria-hidden="true"><span /><span /><span /><p>Edify · démo</p></div>
      <div className="lp-video-stage">
        <video
          ref={ref}
          src={src ?? undefined}
          poster="/landing/edify-demo-poster.jpg"
          muted
          loop
          playsInline
          preload="metadata"
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          aria-label="Démonstration d'Edify : de la description du produit au fichier d'impression"
        />
        <div className="lp-video-controls">
          <button type="button" onClick={toggle} aria-label={playing ? "Mettre en pause" : "Lire la vidéo"}>
            {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </button>
          <button type="button" onClick={() => ref.current?.requestFullscreen?.()} aria-label="Plein écran">
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </figure>
  );
}
