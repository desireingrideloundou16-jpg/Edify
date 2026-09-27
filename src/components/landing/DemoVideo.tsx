"use client";

import React, { useEffect, useRef, useState } from "react";
import { Pause, Play, Maximize2, Volume2, VolumeX } from "lucide-react";
import { useCopy, useLang } from "@/components/i18n/LangProvider";
import { filmLang } from "@/lib/i18n/config";

/**
 * Demo film in the visitor's language (French or English voice-over): plays muted when scrolled into
 * view (browsers block autoplay with sound), lighter file on small screens.
 */
export function DemoVideo() {
  const { lang } = useLang();
  const t = useCopy("site").video;
  const film = filmLang(lang);
  const ref = useRef<HTMLVideoElement>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);

  useEffect(() => {
    setSrc(`/landing/edify-demo-${film}${window.matchMedia("(max-width: 900px)").matches ? "-720" : ""}.mp4`);
  }, [film]);

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

  const toggleSound = () => {
    const v = ref.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
    // Unmuting restarts the film so the music lands on the first beat.
    if (!v.muted) { v.currentTime = 0; v.play().catch(() => {}); }
  };

  return (
    <figure className="lp-video">
      <div className="lp-browser-bar" aria-hidden="true"><span /><span /><span /><p>Edify · {t.demo}</p></div>
      <div className="lp-video-stage">
        <video
          ref={ref}
          src={src ?? undefined}
          poster={`/landing/edify-demo-poster-${film}.jpg`}
          muted
          loop
          playsInline
          preload="metadata"
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          aria-label={t.aria}
        />
        <button type="button" className={`lp-video-sound${muted ? "" : " is-on"}`} onClick={toggleSound} aria-pressed={!muted}>
          {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          {muted ? t.soundOff : t.soundOn}
        </button>
        <div className="lp-video-controls">
          <button type="button" onClick={toggle} aria-label={playing ? t.pause : t.play}>
            {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </button>
          <button type="button" onClick={() => ref.current?.requestFullscreen?.()} aria-label={t.fullscreen}>
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </figure>
  );
}
