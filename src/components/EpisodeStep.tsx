import { useState, useEffect } from "react";
import { Sparkles, Loader2, Plus, Minus, Clapperboard } from "lucide-react";
import { SAVE_THE_CAT_BEATS } from "../constants/storyBeats";
import { callKimi } from "../utils/kimi";
import type { Episode, StoryBeatsMap } from "../types";

interface EpisodeStepProps {
  storyBeats: StoryBeatsMap;
  episodes: Episode[];
  setEpisodes: (eps: Episode[]) => void;
  visualStyle: string;
  isAIProcessing: boolean;
  setIsAIProcessing: (v: boolean) => void;
  generationStatus: string;
  setGenerationStatus: (s: string) => void;
  accentHex: string;
  onPrev: () => void;
  onNext: () => void;
}

const EPISODE_COLORS = [
  "from-[#1e293b] to-[#0a0a0b]",
  "from-[#1c1917] to-[#0a0a0b]",
  "from-[#0c1c1c] to-[#0a0a0b]",
  "from-[#1a1020] to-[#0a0a0b]",
  "from-[#1e1a0c] to-[#0a0a0b]",
  "from-[#0c1420] to-[#0a0a0b]",
  "from-[#1c0c14] to-[#0a0a0b]",
  "from-[#0c1c10] to-[#0a0a0b]",
];

function defaultEpisodes(count: number): Episode[] {
  const beatsPerEp = Math.ceil(SAVE_THE_CAT_BEATS.length / count);
  const eps: Episode[] = [];
  for (let i = 0; i < count; i++) {
    const beatIds = SAVE_THE_CAT_BEATS.slice(i * beatsPerEp, (i + 1) * beatsPerEp).map((b) => b.id);
    eps.push({
      id: `ep${i + 1}`,
      title: `EPISODE ${String(i + 1).padStart(2, "0")}`,
      synopsis: "",
      beatIds,
      color: EPISODE_COLORS[i % EPISODE_COLORS.length],
    });
  }
  return eps;
}

export function EpisodeStep(props: EpisodeStepProps) {
  const {
    storyBeats, episodes, setEpisodes, visualStyle,
    isAIProcessing, setIsAIProcessing, generationStatus, setGenerationStatus,
    accentHex, onPrev, onNext,
  } = props;

  const [localEps, setLocalEps] = useState<Episode[]>(episodes.length > 0 ? episodes : defaultEpisodes(3));

  useEffect(() => {
    setEpisodes(localEps);
  }, [localEps]);

  const changeEpisodeCount = (delta: number) => {
    const newCount = Math.max(2, Math.min(8, localEps.length + delta));
    setLocalEps(defaultEpisodes(newCount));
  };

  const updateEpisode = (id: string, patch: Partial<Episode>) => {
    setLocalEps((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  };

  const autoBreakEpisodes = async () => {
    const hasContent = Object.values(storyBeats).some((v) => v.length > 0);
    if (!hasContent) return;
    setIsAIProcessing(true);
    setGenerationStatus("Breaking story into episodes...");

    try {
      const beatsWithContent = SAVE_THE_CAT_BEATS.filter((b) => (storyBeats[b.id] || "").length > 0);
      const prompt = `You are a TV series showrunner. Break this story into ${localEps.length} episodes for a limited series.

Story Beats:
${beatsWithContent.map((b, i) => `${i + 1}. ${b.label}: ${storyBeats[b.id]}`).join("\n")}

Return a JSON object with an "episodes" array. Each item:
{
  "title": "Episode title (e.g., 'Pilot', 'The Awakening', etc.)",
  "synopsis": "2-3 sentence synopsis of this episode",
  "beatIds": ["array of beat IDs from the story that belong to this episode"]
}

Available beat IDs: ${SAVE_THE_CAT_BEATS.map((b) => b.id).join(", ")}

Distribute ALL beats across ${localEps.length} episodes. Each beat goes to exactly one episode. Maintain story order.`;

      const result = await callKimi(prompt, "You are a TV series showrunner. Return strict JSON only.");
      if (result?.episodes) {
        const newEps: Episode[] = result.episodes.map((ep: any, i: number) => ({
          id: `ep${i + 1}`,
          title: ep.title || `EPISODE ${String(i + 1).padStart(2, "0")}`,
          synopsis: ep.synopsis || "",
          beatIds: ep.beatIds || [],
          color: EPISODE_COLORS[i % EPISODE_COLORS.length],
        }));
        setLocalEps(newEps);
      }
    } catch {
      alert("Failed to auto-break episodes. Try manually.");
    } finally {
      setIsAIProcessing(false);
    }
  };

  const moveBeat = (beatId: string, fromEpId: string, toEpId: string) => {
    setLocalEps((prev) =>
      prev.map((ep) => {
        if (ep.id === fromEpId) return { ...ep, beatIds: ep.beatIds.filter((b) => b !== beatId) };
        if (ep.id === toEpId) return { ...ep, beatIds: [...ep.beatIds, beatId] };
        return ep;
      })
    );
  };

  const unassignedBeats = SAVE_THE_CAT_BEATS.filter(
    (b) => !localEps.some((ep) => ep.beatIds.includes(b.id)) && (storyBeats[b.id] || "").length > 0
  );

  return (
    <div className="max-w-[920px] mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-8 border-b border-white/5 pb-6">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full border mb-3" style={{ backgroundColor: `${accentHex}12`, borderColor: `${accentHex}30` }}>
            <span className="w-1 h-1 rounded-full" style={{ backgroundColor: accentHex }} />
            <span className="text-[10px] font-mono text-white/90 tracking-wide">STEP 02 • EPISODES • SERIES BREAKDOWN</span>
          </div>
          <h1 className="text-[40px] sm:text-[56px] lg:text-[64px] font-[800] tracking-[-0.04em] leading-[0.85] text-white" style={{ fontFamily: "Archivo Narrow, sans-serif" }}>
            EPISODE BREAKDOWN
          </h1>
          <p className="text-[13px] text-[#7a8089] mt-3 max-w-md">Split your story beats into episodes. AI can suggest a breakdown, or arrange manually.</p>
        </div>
        <div className="hidden sm:flex flex-col items-end gap-2 pt-2">
          <div className="flex items-center gap-2">
            <button onClick={() => changeEpisodeCount(-1)} className="w-7 h-7 rounded-[5px] bg-white/5 border border-white/10 text-[#c9ccd1] hover:bg-white/10 flex items-center justify-center transition-all">
              <Minus size={14} />
            </button>
            <span className="text-[11px] font-mono text-white min-w-[24px] text-center">{localEps.length}</span>
            <button onClick={() => changeEpisodeCount(1)} className="w-7 h-7 rounded-[5px] bg-white/5 border border-white/10 text-[#c9ccd1] hover:bg-white/10 flex items-center justify-center transition-all">
              <Plus size={14} />
            </button>
          </div>
          <span className="text-[10px] font-mono text-[#5a616c]">EPISODES</span>
        </div>
      </div>

      {/* Action bar */}
      <div className="flex items-center gap-2 mb-6">
        <button
          onClick={autoBreakEpisodes}
          disabled={isAIProcessing}
          className="h-8 px-4 rounded-[6px] text-[12px] font-medium text-white flex items-center gap-2 transition-all disabled:opacity-40"
          style={{ backgroundColor: accentHex }}
        >
          <Sparkles size={14} /> Auto-Break Episodes
        </button>
        {isAIProcessing && (
          <div className="flex items-center gap-2 text-[11px] text-[#7a8089]">
            <Loader2 size={12} className="animate-spin" style={{ color: accentHex }} />
            {generationStatus}
          </div>
        )}
        <div className="flex-1" />
        <span className="text-[10px] font-mono text-[#5a616c]">{visualStyle}</span>
      </div>

      {/* Unassigned beats */}
      {unassignedBeats.length > 0 && (
        <div className="mb-4 rounded-[8px] bg-[#0f0f12] border border-[#f5a524]/20 p-3">
          <div className="text-[10px] font-mono text-[#f5a524] uppercase tracking-wide mb-2">UNASSIGNED BEATS • {unassignedBeats.length}</div>
          <div className="flex flex-wrap gap-2">
            {unassignedBeats.map((beat) => (
              <div key={beat.id} className="text-[10px] px-2 py-1 rounded bg-white/5 border border-white/10 text-[#9aa0a8]">
                {beat.label}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Episode cards */}
      <div className="space-y-4">
        {localEps.map((ep, epIdx) => {
          const epBeats = ep.beatIds
            .map((bid) => SAVE_THE_CAT_BEATS.find((b) => b.id === bid))
            .filter((b): b is NonNullable<typeof b> => b !== undefined);

          return (
            <div key={ep.id} className="rounded-[10px] bg-[#0b0b0e] border border-white/[0.06] overflow-hidden">
              {/* Episode header */}
              <div className={`bg-gradient-to-r ${ep.color} p-4 border-b border-white/[0.06]`}>
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-[6px] bg-black/40 border border-white/10 flex items-center justify-center shrink-0">
                    <Clapperboard size={18} className="text-white/70" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <input
                      value={ep.title}
                      onChange={(e) => updateEpisode(ep.id, { title: e.target.value })}
                      className="w-full bg-transparent text-[18px] font-[700] tracking-[-0.02em] text-white outline-none border-b border-transparent focus:border-white/15 transition-all"
                      style={{ fontFamily: "Archivo Narrow, sans-serif" }}
                      placeholder={`Episode ${epIdx + 1} title`}
                    />
                    <textarea
                      value={ep.synopsis}
                      onChange={(e) => updateEpisode(ep.id, { synopsis: e.target.value })}
                      rows={1}
                      className="w-full mt-1 bg-transparent text-[11px] text-[#9aa0a8] outline-none resize-none border-b border-transparent focus:border-white/10 transition-all placeholder:text-[#5a616c]"
                      placeholder="Episode synopsis..."
                    />
                  </div>
                  <div className="text-[10px] font-mono text-[#5a616c] shrink-0">
                    {String(epIdx + 1).padStart(2, "0")}<br />
                    {ep.beatIds.length} beats
                  </div>
                </div>
              </div>

              {/* Beat list — compact, inline */}
              <div className="p-2 space-y-px">
                {epBeats.length === 0 && (
                  <div className="text-[10px] text-[#5a616c] py-2 text-center">No beats assigned.</div>
                )}
                {epBeats.map((beat) => {
                  const content = storyBeats[beat.id] || "";
                  return (
                    <div key={beat.id} className="group flex items-center gap-2 px-2 py-1 rounded hover:bg-white/[0.03] transition-colors">
                      <span className="text-[9px] font-mono font-semibold shrink-0 w-32 truncate" style={{ color: accentHex }}>
                        {beat.label}
                      </span>
                      <p className="text-[10px] text-[#7a8089] leading-tight flex-1 truncate">
                        {content || <span className="text-[#3f444d] italic">No content</span>}
                      </p>
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        {localEps.filter((e) => e.id !== ep.id).map((otherEp) => (
                          <button
                            key={otherEp.id}
                            onClick={() => moveBeat(beat.id, ep.id, otherEp.id)}
                            className="text-[8px] font-mono w-4 h-4 rounded bg-white/5 hover:bg-white/10 text-[#6c727c] hover:text-white border border-white/10 transition-all flex items-center justify-center"
                            title={`Move to ${otherEp.title}`}
                          >
                            {localEps.indexOf(otherEp) + 1}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Add unassigned beats */}
              {unassignedBeats.length > 0 && (
                <div className="px-3 pb-3">
                  <div className="flex flex-wrap gap-1.5">
                    {unassignedBeats.map((beat) => (
                      <button
                        key={beat.id}
                        onClick={() => moveBeat(beat.id, "", ep.id)}
                        className="text-[9px] px-2 py-1 rounded bg-white/5 border border-white/10 text-[#6c727c] hover:text-white hover:border-white/20 flex items-center gap-1 transition-all"
                      >
                        <Plus size={9} /> {beat.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Navigation */}
      <div className="mt-8 flex items-center justify-between">
        <button
          onClick={onPrev}
          className="h-9 px-4 rounded-[6px] text-[12px] font-medium text-[#c9ccd1] border border-white/10 hover:border-white/20 hover:text-white transition-all"
        >
          ← Back to Story
        </button>
        <button
          onClick={onNext}
          className="h-9 px-5 rounded-[6px] text-[12px] font-medium text-white transition-all flex items-center gap-2"
          style={{ backgroundColor: accentHex }}
        >
          Continue to Generation →
        </button>
      </div>
    </div>
  );
}
