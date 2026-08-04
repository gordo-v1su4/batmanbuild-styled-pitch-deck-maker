import { useRef, useEffect, useMemo } from "react";
import {
  Play, Pause, Upload, Music, Activity, Zap, Sliders,
  ChevronLeft, ChevronRight, Film, Loader2, Grid, RotateCcw,
} from "lucide-react";
import { SceneCard } from "./SceneCard";
import { detectTransients, drawWaveform, MARKER_DENSITY_LEVELS } from "../utils/audio";
import type { Scene, TimelineClip, AudioMarker } from "../types";

interface TimelineStepProps {
  timeline: TimelineClip[];
  setTimeline: (clips: TimelineClip[]) => void;
  generatedScenes: Scene[];
  setGeneratedScenes: (scenes: Scene[]) => void;
  currentTime: number;
  setCurrentTime: (t: number) => void;
  duration: number;
  setDuration: (d: number) => void;
  isPlaying: boolean;
  setIsPlaying: (v: boolean) => void;
  audioFile: File | null;
  setAudioFile: (f: File | null) => void;
  audioBuffer: AudioBuffer | null;
  setAudioBuffer: (b: AudioBuffer | null) => void;
  isDecoding: boolean;
  setIsDecoding: (v: boolean) => void;
  audioMarkers: AudioMarker[];
  setAudioMarkers: (m: AudioMarker[]) => void;
  markerDensity: string;
  setMarkerDensity: (d: string) => void;
  markerSensitivity: number;
  setMarkerSensitivity: (s: number) => void;
  accentHex: string;
  onRenderImage: (sceneId: string, prompt: string) => void;
  onGenerateAssets: () => void;
  isAIProcessing: boolean;
  generationStatus: string;
  onPrev: () => void;
}

export function TimelineStep(props: TimelineStepProps) {
  const {
    timeline, setTimeline, generatedScenes,
    currentTime, setCurrentTime, duration, setDuration,
    isPlaying, setIsPlaying, audioFile, setAudioFile,
    audioBuffer, setAudioBuffer, isDecoding, setIsDecoding,
    audioMarkers, setAudioMarkers, markerDensity, setMarkerDensity,
    markerSensitivity, setMarkerSensitivity, accentHex,
    onRenderImage, onGenerateAssets, isAIProcessing, generationStatus, onPrev,
  } = props;

  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const startTimeRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isPlayingRef = useRef(false);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    if (audioBuffer && canvasRef.current) {
      drawWaveform(canvasRef.current, audioBuffer);
    }
  }, [audioBuffer]);

  useEffect(() => {
    if (!audioBuffer) return;
    const markers = detectTransients(audioBuffer, { sensitivity: markerSensitivity });
    setAudioMarkers(markers);
  }, [markerSensitivity]);

  const initAudioContext = () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAudioFile(file);
    setIsDecoding(true);
    setAudioMarkers([]);
    setTimeline([]);
    initAudioContext();
    const arrayBuffer = await file.arrayBuffer();
    try {
      const decoded = await audioContextRef.current!.decodeAudioData(arrayBuffer);
      setAudioBuffer(decoded);
      setDuration(decoded.duration);
    } catch {
      alert("Could not decode audio file.");
    } finally {
      setIsDecoding(false);
    }
  };

  const togglePlay = () => {
    initAudioContext();
    if (audioContextRef.current?.state === "suspended") audioContextRef.current.resume();
    if (isPlaying) stopAudio();
    else playAudio();
  };

  const playAudio = () => {
    const ctx = audioContextRef.current!;
    sourceNodeRef.current = ctx.createBufferSource();
    sourceNodeRef.current.buffer = audioBuffer;
    sourceNodeRef.current.connect(ctx.destination);
    sourceNodeRef.current.start(0, currentTime);
    startTimeRef.current = ctx.currentTime - currentTime;
    sourceNodeRef.current.onended = () => {
      if (!isPlayingRef.current) return;
      isPlayingRef.current = false;
      setIsPlaying(false);
      setCurrentTime(duration);
    };
    isPlayingRef.current = true;
    setIsPlaying(true);
    rafRef.current = requestAnimationFrame(updateTime);
  };

  const stopAudio = () => {
    if (sourceNodeRef.current) {
      sourceNodeRef.current.stop();
      sourceNodeRef.current = null;
    }
    isPlayingRef.current = false;
    setIsPlaying(false);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
  };

  const updateTime = () => {
    if (!isPlayingRef.current || !audioContextRef.current) return;
    const now = audioContextRef.current.currentTime - startTimeRef.current;
    if (now >= duration) {
      isPlayingRef.current = false;
      setIsPlaying(false);
      setCurrentTime(duration);
      return;
    }
    setCurrentTime(now);
    rafRef.current = requestAnimationFrame(updateTime);
  };

  const autoDetectBeats = () => {
    if (!audioBuffer) return;
    const detected = detectTransients(audioBuffer, { sensitivity: markerSensitivity });
    setAudioMarkers(detected);
  };

  const displayedMarkers = useMemo(() => {
    if (markerDensity === "all" || audioMarkers.length <= 2) return audioMarkers;
    const ratio = MARKER_DENSITY_LEVELS[markerDensity] ?? 1;
    const limit = Math.max(1, Math.round(audioMarkers.length * ratio));
    return [...audioMarkers]
      .sort((a, b) => b.strength - a.strength)
      .slice(0, limit)
      .sort((a, b) => a.time - b.time);
  }, [audioMarkers, markerDensity]);

  // Timeline timestamps
  let accumulatedTime = 0;
  const timelineWithTimestamps: TimelineClip[] = timeline.map((clip) => {
    const start = accumulatedTime;
    const end = start + clip.duration;
    accumulatedTime = end;
    return { ...clip, start, end };
  });

  const activeClip = timelineWithTimestamps.find((clip) => currentTime >= clip.start && currentTime < clip.end);
  const ActiveIcon = activeClip?.icon || Film;

  const groupedScenes: Record<string, Scene[]> = {};
  generatedScenes.forEach((scene) => {
    if (!groupedScenes[scene.beatTitle]) groupedScenes[scene.beatTitle] = [];
    groupedScenes[scene.beatTitle].push(scene);
  });

  const addToTimeline = (scene: Scene) => {
    setTimeline([...timeline, { ...scene, instanceId: Date.now(), start: 0, end: 0 }]);
  };

  const removeFromTimeline = (instanceId: number) => {
    setTimeline(timeline.filter((t) => t.instanceId !== instanceId));
  };

  const moveItem = (index: number, direction: "left" | "right") => {
    const newTimeline = [...timeline];
    if (direction === "left" && index > 0) {
      [newTimeline[index], newTimeline[index - 1]] = [newTimeline[index - 1], newTimeline[index]];
    } else if (direction === "right" && index < newTimeline.length - 1) {
      [newTimeline[index], newTimeline[index + 1]] = [newTimeline[index + 1], newTimeline[index]];
    }
    setTimeline(newTimeline);
  };

  const autoSync = () => {
    if (audioMarkers.length === 0 || timeline.length === 0) return;
    let markerIndex = 0;
    const synced = timeline.map((clip) => {
      if (markerIndex < audioMarkers.length) {
        const prevTime = markerIndex === 0 ? 0 : audioMarkers[markerIndex - 1].time;
        const nextTime = audioMarkers[markerIndex].time;
        const newDuration = Math.max(0.5, nextTime - prevTime);
        markerIndex++;
        return { ...clip, duration: parseFloat(newDuration.toFixed(2)) };
      }
      return clip;
    });
    setTimeline(synced);
  };

  return (
    <div className="h-full flex flex-col gap-3 px-4 py-4 md:px-6 md:py-4 overflow-hidden">
      {/* Top section: Preview + Assets */}
      <div className="flex-1 flex flex-col md:flex-row gap-3 min-h-0 overflow-hidden">
        {/* Preview Player */}
        <div className="md:w-[480px] md:max-w-[45%] shrink-0 flex flex-col gap-3">
          <div className="w-full aspect-video bg-[#0c0c0f] rounded-[10px] overflow-hidden border border-white/[0.08] relative flex flex-col shadow-[0_8px_40px_rgba(0,0,0,0.4)]">
            <div className="flex-1 relative flex items-center justify-center bg-[#0a0a0d] overflow-hidden">
              {activeClip ? (
                <div className="w-full h-full relative transition-all duration-500">
                  {activeClip.imageUrl ? (
                    <img src={activeClip.imageUrl} className="absolute inset-0 w-full h-full object-contain" alt="Preview" />
                  ) : (
                    <div className="flex items-center justify-center w-full h-full">
                      <ActiveIcon size={48} className="text-[#3a3f48]" />
                    </div>
                  )}
                  <div className="absolute bottom-6 left-0 right-0 flex flex-col items-center z-10 pointer-events-none">
                    <h3 className="text-[20px] md:text-[28px] font-[700] text-white tracking-[-0.02em] drop-shadow-md text-center px-4" style={{ fontFamily: "Archivo Narrow, sans-serif" }}>
                      {activeClip.title}
                    </h3>
                    {!activeClip.imageUrl && (
                      <p className="text-[#7a8089] text-[10px] mt-1 max-w-md text-center px-4 line-clamp-2">{activeClip.prompt}</p>
                    )}
                  </div>
                  <p className="absolute top-3 left-3 text-[#9aa0a8] font-mono text-[9px] bg-black/60 backdrop-blur px-2 py-0.5 rounded z-10 border border-white/10">PREVIEW</p>
                </div>
              ) : (
                <div className="text-center text-[#3f444d]">
                  <Film size={48} className="mx-auto mb-2 opacity-30" />
                  <p className="text-[12px]">Timeline Empty</p>
                  <p className="text-[10px] mt-1 text-[#2f3338]">Add scenes from the asset pool</p>
                </div>
              )}
            </div>

            {/* Player Controls */}
            <div className="h-12 bg-[#0c0c0f] border-t border-white/[0.06] flex items-center px-3 gap-3 shrink-0">
              <button
                onClick={togglePlay}
                disabled={!audioBuffer}
                className="w-7 h-7 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 transition-all shrink-0 disabled:opacity-30"
              >
                {isPlaying ? <Pause size={13} fill="black" /> : <Play size={13} fill="black" className="ml-0.5" />}
              </button>
              <div className="flex-1">
                <div className="text-[9px] text-[#5a616c] flex justify-between mb-1 font-mono">
                  <span>{currentTime.toFixed(1)}s</span>
                  <span>{duration.toFixed(1)}s</span>
                </div>
                <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{ width: `${(currentTime / (duration || 1)) * 100}%`, backgroundColor: accentHex }} />
                </div>
              </div>
            </div>
          </div>

          {/* Timeline clips bar */}
          <div className="flex-1 min-h-0 overflow-hidden">
            <div className="text-[10px] font-mono text-[#6c727c] uppercase tracking-wide mb-2 flex items-center justify-between">
              <span>TIMELINE • {timeline.length} CLIPS</span>
              <span className="text-[#5a616c]">{timeline.reduce((a, c) => a + c.duration, 0).toFixed(1)}s total</span>
            </div>
            <div className="overflow-x-auto overflow-y-hidden h-full custom-scrollbar-thin">
              <div className="flex gap-1 items-center min-h-[80px] pr-4">
                {timeline.length === 0 && (
                  <div className="w-full h-16 border border-dashed border-white/10 rounded-[6px] flex items-center justify-center text-[#3f444d] text-[11px]">
                    Drag scenes here to build your trailer
                  </div>
                )}
                {timelineWithTimestamps.map((clip, index) => {
                  const isClipActive = currentTime >= clip.start && currentTime < clip.end;
                  return (
                    <div key={clip.instanceId} className="relative group/clip shrink-0" style={{ width: `${Math.max(80, clip.duration * 30)}px` }}>
                      <SceneCard
                        scene={clip}
                        inTimeline
                        onRemove={removeFromTimeline}
                        isActive={isClipActive}
                        accentHex={accentHex}
                      />
                      <div className="absolute bottom-0 left-0 right-0 h-5 bg-[#0c0c0f] translate-y-full group-hover/clip:translate-y-0 transition-transform flex justify-between items-center px-1 z-20 rounded-b-[6px] border-x border-b border-white/10">
                        <button onClick={() => moveItem(index, "left")} className="p-0.5 text-[#5a616c] hover:text-white"><ChevronLeft size={9} /></button>
                        <button onClick={() => moveItem(index, "right")} className="p-0.5 text-[#5a616c] hover:text-white"><ChevronRight size={9} /></button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Asset Pool */}
        <div className="flex-1 h-full bg-[#0b0b0e] rounded-[10px] border border-white/[0.06] flex flex-col overflow-hidden min-w-0">
          <div className="p-3 border-b border-white/[0.06] bg-[#0c0c0f] flex justify-between items-center shrink-0">
            <h3 className="text-[10px] font-mono font-semibold uppercase tracking-wider text-[#9aa0a8] flex items-center gap-2">
              <Grid size={12} style={{ color: accentHex }} /> ASSETS
            </h3>
            <button
              onClick={onGenerateAssets}
              disabled={isAIProcessing}
              className="text-[9px] font-medium flex items-center gap-1 transition-colors px-2 py-1 rounded border disabled:opacity-40"
              style={{ color: accentHex, borderColor: `${accentHex}30`, backgroundColor: `${accentHex}10` }}
            >
              <RotateCcw size={9} /> Regenerate
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-4 custom-scrollbar-thin">
            {generatedScenes.length === 0 ? (
              <div className="text-center text-[#3f444d] py-12 flex flex-col items-center">
                {isAIProcessing ? (
                  <>
                    <Loader2 size={20} className="mb-2 opacity-50 animate-spin" style={{ color: accentHex }} />
                    <p className="text-[11px] text-[#5a616c]">{generationStatus}</p>
                  </>
                ) : (
                  <>
                    <Grid size={20} className="mb-2 opacity-30" />
                    <p className="text-[11px]">No assets generated</p>
                  </>
                )}
              </div>
            ) : (
              Object.keys(groupedScenes).map((beatTitle) => (
                <div key={beatTitle} className="space-y-2">
                  <h4 className="text-[9px] font-mono font-bold uppercase tracking-widest text-[#5a616c] border-b border-white/5 pb-1 flex items-center gap-1.5">
                    <span className="w-1 h-1 rounded-full" style={{ backgroundColor: accentHex }} />
                    {beatTitle}
                  </h4>
                  <div className="grid grid-cols-2 gap-2">
                    {groupedScenes[beatTitle].map((scene) => (
                      <SceneCard
                        key={scene.id}
                        scene={scene}
                        onAdd={addToTimeline}
                        onRenderImage={onRenderImage}
                        accentHex={accentHex}
                      />
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Bottom: Audio Timeline */}
      <div className="h-[160px] shrink-0 bg-[#0b0b0e] rounded-[10px] border border-white/[0.06] flex flex-col overflow-hidden">
        <div className="h-10 bg-[#0c0c0f] border-b border-white/[0.06] flex items-center px-3 justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-[5px] bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
              {isDecoding ? <Activity size={12} className="animate-spin" style={{ color: accentHex }} /> : <Music size={12} className="text-[#5a616c]" />}
            </div>
            <div className="flex flex-col">
              <span className="text-[9px] font-mono text-[#5a616c] uppercase tracking-wide">AUDIO</span>
              <span className="text-[11px] text-[#9aa0a8] truncate hidden md:block font-medium max-w-[200px]">{audioFile ? audioFile.name : "None"}</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 overflow-x-auto">
            <label className="cursor-pointer px-2.5 py-1.5 rounded-[5px] text-[10px] font-medium flex items-center gap-1.5 transition-all whitespace-nowrap border text-white" style={{ backgroundColor: `${accentHex}20`, borderColor: `${accentHex}30`, color: accentHex }}>
              <Upload size={11} /> Upload
              <input type="file" accept="audio/*,.mp3,.wav,.m4a,.aac,.ogg" className="hidden" onChange={handleFileUpload} />
            </label>
            <button
              onClick={autoDetectBeats}
              disabled={!audioBuffer}
              className="px-2.5 py-1.5 rounded-[5px] text-[10px] font-medium border border-white/10 text-[#f5a524] bg-[#f5a524]/10 flex items-center gap-1.5 disabled:opacity-40 whitespace-nowrap transition-all hover:bg-[#f5a524]/20"
            >
              <Zap size={11} /> Auto Beat
            </button>
            <button
              onClick={autoSync}
              disabled={!audioBuffer}
              className="px-2.5 py-1.5 rounded-[5px] text-[10px] font-medium border text-[#c9ccd1] bg-white/5 flex items-center gap-1.5 disabled:opacity-40 whitespace-nowrap transition-all hover:bg-white/10"
              style={{ borderColor: `${accentHex}30`, color: accentHex }}
            >
              <Sliders size={11} /> Sync
            </button>
            <div className="flex items-center gap-1.5 ml-1 pl-1.5 border-l border-white/10">
              <span className="text-[9px] font-mono text-[#5a616c]">SENS</span>
              <input
                type="range"
                min="0.3"
                max="0.95"
                step="0.05"
                value={markerSensitivity}
                onChange={(e) => setMarkerSensitivity(parseFloat(e.target.value))}
                className="slider-circle"
                style={{ ['--accent' as any]: accentHex }}
              />
              <span className="text-[9px] font-mono text-[#7a8089] w-7">{Math.round(markerSensitivity * 100)}%</span>
            </div>
            <div className="flex items-center gap-1 ml-1">
              <span className="text-[9px] font-mono text-[#5a616c]">DENSITY</span>
              <select
                value={markerDensity}
                onChange={(e) => setMarkerDensity(e.target.value)}
                className="bg-[#0c0c0f] text-[#9aa0a8] border border-white/10 rounded px-1.5 py-0.5 text-[9px] font-mono outline-none"
              >
                <option value="all">All</option>
                <option value="high">High</option>
                <option value="medium">Med</option>
                <option value="low">Low</option>
              </select>
            </div>
          </div>
        </div>

        {/* Waveform + markers */}
        <div className="flex-1 overflow-x-auto overflow-y-hidden relative bg-[#08080a] custom-scrollbar-thin">
          <div className="flex flex-col min-w-full p-2 gap-1.5 h-full">
            <div className="h-12 bg-[#0c0c0f] rounded-[6px] relative overflow-hidden border border-white/[0.06] shrink-0 min-w-full">
              <canvas ref={canvasRef} width={1000} height={48} className="w-full h-full block absolute inset-0 opacity-60" />
              {!audioBuffer && !isDecoding && (
                <div className="absolute inset-0 flex items-center justify-center text-[#3f444d] text-[9px] uppercase tracking-widest font-mono">Drop Audio File</div>
              )}
              {isDecoding && (
                <div className="absolute inset-0 flex items-center justify-center text-[#9aa0a8] text-[9px] uppercase tracking-widest animate-pulse font-mono">Decoding...</div>
              )}
              {displayedMarkers.map((m) => (
                <div
                  key={m.id}
                  className="absolute top-0 bottom-0 w-px z-10 pointer-events-none"
                  style={{ left: `${(m.time / (duration || 1)) * 100}%`, backgroundColor: `${accentHex}80` }}
                />
              ))}
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-white z-20 pointer-events-none"
                style={{ left: `${(currentTime / (duration || 1)) * 100}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Back button */}
      <div className="shrink-0 flex items-center justify-between">
        <button
          onClick={onPrev}
          className="h-8 px-4 rounded-[6px] text-[11px] font-medium text-[#c9ccd1] border border-white/10 hover:border-white/20 hover:text-white transition-all"
        >
          ← Back to Generation
        </button>
        <div className="text-[10px] font-mono text-[#5a616c]">
          {timeline.length} clips • {timeline.reduce((a, c) => a + c.duration, 0).toFixed(1)}s
        </div>
      </div>
    </div>
  );
}
