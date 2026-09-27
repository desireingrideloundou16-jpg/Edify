"use client";

import React, { useEffect, useRef, useState } from "react";
import { Loader2, Mic, Square } from "lucide-react";

const MAX_SECONDS = 60;

/** Decode any recorded audio and re-encode it as 16 kHz mono WAV (understood by every AI model). */
async function toWavBase64(blob: Blob): Promise<string> {
  const buf = await blob.arrayBuffer();
  const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const decodeCtx = new Ctx();
  const audio = await decodeCtx.decodeAudioData(buf);
  await decodeCtx.close();
  const rate = 16000;
  const offline = new OfflineAudioContext(1, Math.ceil(audio.duration * rate), rate);
  const src = offline.createBufferSource();
  src.buffer = audio;
  src.connect(offline.destination);
  src.start();
  const pcm = (await offline.startRendering()).getChannelData(0);
  const view = new DataView(new ArrayBuffer(44 + pcm.length * 2));
  const w = (o: number, s: string) => [...s].forEach((c, i) => view.setUint8(o + i, c.charCodeAt(0)));
  w(0, "RIFF");
  view.setUint32(4, 36 + pcm.length * 2, true);
  w(8, "WAVE");
  w(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, rate, true);
  view.setUint32(28, rate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  w(36, "data");
  view.setUint32(40, pcm.length * 2, true);
  for (let i = 0; i < pcm.length; i++) view.setInt16(44 + i * 2, Math.max(-1, Math.min(1, pcm[i])) * 0x7fff, true);
  const bytes = new Uint8Array(view.buffer);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

/**
 * Microphone button: records a voice note, then hands the WAV (base64) to onAudio.
 * Tap to start, tap again to stop (auto-stop after 60 s).
 */
export function VoiceNoteButton({ onAudio, busy, onError }: { onAudio: (wavBase64: string, seconds: number) => void; busy: boolean; onError: (msg: string) => void }) {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const timer = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const started = useRef(0);

  useEffect(() => () => {
    clearInterval(timer.current);
    recorder.current?.stream.getTracks().forEach((t) => t.stop());
  }, []);

  const stop = () => {
    clearInterval(timer.current);
    if (recorder.current?.state === "recording") recorder.current.stop();
  };

  const start = async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      onError("Votre navigateur ne permet pas l'enregistrement vocal.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      const rec = new MediaRecorder(stream);
      chunks.current = [];
      rec.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setRecording(false);
        const secs = (Date.now() - started.current) / 1000;
        if (secs < 1) {
          onError("Note trop courte : maintenez l'enregistrement au moins une seconde.");
          return;
        }
        try {
          onAudio(await toWavBase64(new Blob(chunks.current, { type: rec.mimeType })), secs);
        } catch {
          onError("L'enregistrement n'a pas pu être lu. Réessayez.");
        }
      };
      rec.start();
      recorder.current = rec;
      started.current = Date.now();
      setSeconds(0);
      setRecording(true);
      timer.current = setInterval(() => {
        const s = Math.floor((Date.now() - started.current) / 1000);
        setSeconds(s);
        if (s >= MAX_SECONDS) stop();
      }, 250);
    } catch {
      onError("Autorisez l'accès au micro dans votre navigateur pour dicter une note vocale.");
    }
  };

  if (busy) {
    return (
      <button type="button" className="edify-voice-btn is-busy" disabled title="L'IA analyse votre note vocale">
        <Loader2 className="w-4 h-4 animate-spin" />
      </button>
    );
  }
  return (
    <button
      type="button"
      className={`edify-voice-btn ${recording ? "is-recording" : ""}`}
      onClick={recording ? stop : start}
      title={recording ? "Arrêter et envoyer" : "Note vocale : dites ce que vous voulez, l'IA s'en occupe"}
      aria-label={recording ? "Arrêter l'enregistrement" : "Enregistrer une note vocale"}
      aria-pressed={recording}
    >
      {recording ? (
        <>
          <Square className="w-3.5 h-3.5" /> <span>{`0:${String(seconds).padStart(2, "0")}`}</span>
        </>
      ) : (
        <Mic className="w-4 h-4" />
      )}
    </button>
  );
}
