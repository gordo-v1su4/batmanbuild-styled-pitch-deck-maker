import { Upload, Plus, Trash2, Sparkles, Edit3, Loader2 } from "lucide-react";
import { SAVE_THE_CAT_BEATS } from "../constants/storyBeats";
import { FILM_DIRECTOR_SYSTEM_INSTRUCTION_IMAGE } from "../constants";
import { fileToBase64 } from "../utils/helpers";
import { callGemini } from "../utils/api";
import { callKimi } from "../utils/kimi";
import { StoryBeatInput } from "./StoryBeatInput";
import type { CharacterDescription, ImageData, StoryBeatsMap } from "../types";

interface StoryStepProps {
  storyBeats: StoryBeatsMap;
  setStoryBeats: (beats: StoryBeatsMap) => void;
  visualStyle: string;
  setVisualStyle: (style: string) => void;
  inspirationImages: string[];
  setInspirationImages: (images: string[]) => void;
  referenceImageData: ImageData[];
  setReferenceImageData: (data: ImageData[]) => void;
  characterDescriptions: CharacterDescription[];
  setCharacterDescriptions: (chars: CharacterDescription[]) => void;
  isAIProcessing: boolean;
  setIsAIProcessing: (v: boolean) => void;
  generationStatus: string;
  setGenerationStatus: (s: string) => void;
  projectTitle: string;
  setProjectTitle: (t: string) => void;
  suggestedTitles: string[];
  setSuggestedTitles: (t: string[]) => void;
  showTitleOptions: boolean;
  setShowTitleOptions: (v: boolean) => void;
  accentHex: string;
  onNext: () => void;
}

export function StoryStep(props: StoryStepProps) {
  const {
    storyBeats, setStoryBeats, visualStyle, setVisualStyle,
    inspirationImages, setInspirationImages, referenceImageData, setReferenceImageData,
    characterDescriptions, setCharacterDescriptions,
    isAIProcessing, setIsAIProcessing, generationStatus, setGenerationStatus,
    projectTitle: _projectTitle, setProjectTitle, suggestedTitles, setSuggestedTitles,
    showTitleOptions, setShowTitleOptions, accentHex, onNext,
  } = props;

  const handleInspirationUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).slice(0, 8);
    if (files.length === 0) return;

    try {
      setIsAIProcessing(true);
      setGenerationStatus(`Analyzing ${files.length} reference image(s)...`);

      const imageDataArray = await Promise.all(files.map(fileToBase64));
      setInspirationImages([...inspirationImages, ...files.map((f) => URL.createObjectURL(f))]);
      setReferenceImageData([...referenceImageData, ...imageDataArray]);

      const primaryImageData = imageDataArray[0];
      const prompt = `
        Analyze this input image carefully following the Gemini 3 Pro workflow:

        1. **INPUT IMAGE ANALYSIS:** Describe the subject, core action, setting, and existing composition.
        2. **CHARACTER IDENTIFICATION:** If the image contains characters, extract detailed descriptions for EACH character including:
           - Physical appearance (age, build, height, hair color/style, clothing, distinctive features, facial features)
           - Character role/archetype (hero, villain, supporting character, etc.)
           - Emotional state and expression
           - Any unique identifiers (scars, accessories, props, etc.)
        3. **STYLE IDENTIFICATION:** Identify its visual style (lighting, color palette, mood, film era, director influences).
        4. **STORY GENERATION:** Hallucinate a movie plot that this image would be a key scene in.
        5. **TRAILER STRUCTURE:** Generate a complete Save the Cat story structure (15 beats) for this plot.

        Return a JSON object with this schema:
        {
          "logic_engine": "Gemini 3 Pro",
          "input_image_analysis": { "subject": "string", "action": "string", "setting": "string", "composition": "string" },
          "characters": [{ "name": "string", "description": "detailed physical description", "role": "string", "distinctiveFeatures": "string" }],
          "visualStyle": "string",
          "story": { ${SAVE_THE_CAT_BEATS.map((b) => `"${b.id}": "string"`).join(", ")} }
        }

        Note: If no characters are present, return an empty array for "characters".
      `;

      const result = await callGemini(prompt, primaryImageData, FILM_DIRECTOR_SYSTEM_INSTRUCTION_IMAGE);
      if (result) {
        if (result.characters && result.characters.length > 0) {
          setCharacterDescriptions(result.characters);
        } else {
          setCharacterDescriptions([]);
        }
        setVisualStyle(result.visualStyle || "Cinematic");
        const newBeats: StoryBeatsMap = {};
        SAVE_THE_CAT_BEATS.forEach((beat) => {
          newBeats[beat.id] = result.story?.[beat.id] || "";
        });
        setStoryBeats({ ...storyBeats, ...newBeats });
      }
    } catch {
      alert("Failed to analyze image. Please try again.");
    } finally {
      setIsAIProcessing(false);
    }
  };

  const removeImage = (idx: number) => {
    setInspirationImages(inspirationImages.filter((_, i) => i !== idx));
    setReferenceImageData(referenceImageData.filter((_, i) => i !== idx));
  };

  const polishScript = async () => {
    const hasContent = Object.values(storyBeats).some((v) => v.length > 0);
    if (!hasContent) return;
    setIsAIProcessing(true);
    setGenerationStatus("Polishing Script...");

    try {
      const prompt = `Rewrite these story beats to be punchy, dramatic, and cinematic trailer narration following Save the Cat structure. Input Beats: ${JSON.stringify(storyBeats)} Return a JSON object with the same keys: ${SAVE_THE_CAT_BEATS.map((b) => b.id).join(", ")}.`;
      const result = await callKimi(prompt, "You are a world-class Film Director and screenwriter. Return strict JSON only.");
      if (result) {
        const polished: StoryBeatsMap = {};
        SAVE_THE_CAT_BEATS.forEach((beat) => {
          polished[beat.id] = result[beat.id] || storyBeats[beat.id] || "";
        });
        setStoryBeats(polished);
      }
    } catch {
      alert("Failed to polish script.");
    } finally {
      setIsAIProcessing(false);
    }
  };

  const generateTitles = async () => {
    const hasContent = Object.values(storyBeats).some((v) => v.length > 0);
    if (!hasContent) return;
    setIsAIProcessing(true);
    setGenerationStatus("Generating Titles...");

    try {
      const keyBeats = [storyBeats.openingImage, storyBeats.catalyst, storyBeats.midpoint, storyBeats.finale].filter(Boolean).join("\n");
      const prompt = `Generate 5 catchy, cinematic movie titles based on this plot summary: ${keyBeats} Return a JSON object with a 'titles' array of strings.`;
      const result = await callKimi(prompt, "You are a world-class Film Director and screenwriter. Generate creative movie titles. Return strict JSON only.");
      if (result?.titles) {
        setSuggestedTitles(result.titles);
        setShowTitleOptions(true);
      }
    } catch {
      alert("Failed to generate titles.");
    } finally {
      setIsAIProcessing(false);
    }
  };

  const hasContent = Object.values(storyBeats).some((v) => v.length > 0);

  return (
    <div className="max-w-[920px] mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-8 border-b border-white/5 pb-6">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full border mb-3" style={{ backgroundColor: `${accentHex}12`, borderColor: `${accentHex}30` }}>
            <span className="w-1 h-1 rounded-full" style={{ backgroundColor: accentHex }} />
            <span className="text-[10px] font-mono text-white/90 tracking-wide">STEP 01 • STORY • SAVE THE CAT</span>
          </div>
          <h1 className="text-[40px] sm:text-[56px] lg:text-[64px] font-[800] tracking-[-0.04em] leading-[0.85] text-white" style={{ fontFamily: "Archivo Narrow, sans-serif" }}>
            CONSTRUCT NARRATIVE
          </h1>
          <p className="text-[13px] text-[#7a8089] mt-3 max-w-md">Map out the key moments. Upload reference images for AI analysis, or write manually.</p>
        </div>
        <div className="hidden sm:block text-right text-[10px] font-mono text-[#5a616c] leading-relaxed pt-2">
          {visualStyle}<br />
          {characterDescriptions.length} characters<br />
          <span style={{ color: accentHex }}>{hasContent ? "Ready →" : "Awaiting input"}</span>
        </div>
      </div>

      {/* Title suggestions dropdown */}
      {showTitleOptions && suggestedTitles.length > 0 && (
        <div className="mb-6 rounded-[8px] bg-[#111116] border border-white/10 p-3">
          <div className="flex justify-between items-center mb-2 border-b border-white/5 pb-2">
            <span className="text-[10px] font-mono text-[#6c727c] uppercase tracking-wide">Suggested Titles</span>
            <button onClick={() => setShowTitleOptions(false)} className="text-[#5a616c] hover:text-white text-[10px]">✕</button>
          </div>
          <div className="space-y-0.5">
            {suggestedTitles.map((t, i) => (
              <button
                key={i}
                onClick={() => { setProjectTitle(t); setShowTitleOptions(false); }}
                className="block w-full text-left px-2.5 py-2 hover:bg-white/5 text-[12px] rounded-[4px] text-[#c9ccd1] transition-all font-medium"
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Reference Images Upload */}
      <div className="mb-8">
        <div className="text-[10px] font-mono text-[#6c727c] uppercase tracking-wide mb-3">REFERENCE IMAGES • UP TO 8</div>
        <div className="rounded-[10px] border border-dashed border-white/10 p-4 transition-all hover:border-white/20 bg-[#0b0b0e]">
          {inspirationImages.length === 0 ? (
            <label className="cursor-pointer flex flex-col items-center gap-3 text-[#5a616c] hover:text-white transition-colors py-6">
              <div className="p-3 rounded-full bg-white/5 border border-white/10">
                <Upload size={20} />
              </div>
              <div className="flex flex-col gap-0.5 text-center">
                <span className="text-[12px] font-medium text-[#9aa0a8]">Upload Reference Images</span>
                <span className="text-[10px] text-[#5a616c]">AI will analyze style, characters, and generate story beats</span>
              </div>
              <input type="file" accept="image/*" multiple className="hidden" onChange={handleInspirationUpload} />
            </label>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {inspirationImages.map((url, idx) => (
                  <div key={idx} className="relative aspect-video rounded-[6px] overflow-hidden border border-white/10 bg-[#0c0c0f]">
                    <img src={url} alt={`Reference ${idx + 1}`} className="w-full h-full object-cover" />
                    <button
                      onClick={() => removeImage(idx)}
                      className="absolute top-1 right-1 p-1 bg-[#ef4343]/80 hover:bg-[#ef4343] rounded text-white"
                    >
                      <Trash2 size={10} />
                    </button>
                    <div className="absolute bottom-1 left-1 bg-black/80 px-1.5 py-0.5 rounded text-[8px] font-mono text-[#9aa0a8]">
                      {idx + 1}/{inspirationImages.length}
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2">
                {inspirationImages.length < 8 && (
                  <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-[5px] text-[11px] text-[#c9ccd1] transition-all border border-white/10">
                    <Plus size={12} /> Add More ({inspirationImages.length}/8)
                    <input type="file" accept="image/*" multiple className="hidden" onChange={handleInspirationUpload} />
                  </label>
                )}
                {isAIProcessing && generationStatus.includes("Analyzing") && (
                  <div className="flex items-center gap-2 text-[11px] text-[#9aa0a8]">
                    <Loader2 size={12} className="animate-spin" style={{ color: accentHex }} />
                    {generationStatus}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Characters detected */}
      {characterDescriptions.length > 0 && (
        <div className="mb-8">
          <div className="text-[10px] font-mono text-[#6c727c] uppercase tracking-wide mb-3">CHARACTERS DETECTED • {characterDescriptions.length}</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {characterDescriptions.map((char, i) => (
              <div key={i} className="rounded-[6px] bg-[#0f0f12] border border-white/[0.08] p-3">
                <div className="text-[11px] font-medium text-white mb-1">{char.name || `Character ${i + 1}`}</div>
                <div className="text-[10px] text-[#7a8089] leading-snug">{char.description}</div>
                {char.distinctiveFeatures && (
                  <div className="text-[9px] font-mono text-[#5a616c] mt-1">Features: {char.distinctiveFeatures}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AI Action Bar */}
      <div className="flex items-center gap-2 mb-4">
        <button
          onClick={polishScript}
          disabled={isAIProcessing || !hasContent}
          className="h-7 px-3 rounded-[5px] text-[11px] font-medium flex items-center gap-1.5 transition-all disabled:opacity-40 border border-white/10 text-[#c9ccd1] hover:border-white/20 hover:text-white"
          style={{ backgroundColor: `${accentHex}15` }}
        >
          <Sparkles size={12} style={{ color: accentHex }} /> Polish Script
        </button>
        <button
          onClick={generateTitles}
          disabled={isAIProcessing || !hasContent}
          className="h-7 px-3 rounded-[5px] text-[11px] font-medium flex items-center gap-1.5 transition-all disabled:opacity-40 border border-white/10 text-[#c9ccd1] hover:border-white/20 hover:text-white bg-white/5"
        >
          <Edit3 size={12} /> Gen Titles
        </button>
        <div className="flex-1" />
        {isAIProcessing && (
          <div className="flex items-center gap-2 text-[10px] font-mono text-[#7a8089]">
            <Loader2 size={11} className="animate-spin" style={{ color: accentHex }} />
            {generationStatus}
          </div>
        )}
      </div>

      {/* Story Beats */}
      <div className="rounded-[10px] bg-[#0b0b0e] border border-white/[0.06] p-4 sm:p-5 space-y-4">
        {SAVE_THE_CAT_BEATS.map((beat) => (
          <StoryBeatInput
            key={beat.id}
            label={beat.label}
            description={beat.description}
            placeholder={beat.placeholder}
            value={storyBeats[beat.id] || ""}
            onChange={(v) => setStoryBeats({ ...storyBeats, [beat.id]: v })}
            accentHex={accentHex}
          />
        ))}
      </div>

      {/* Continue button */}
      <div className="mt-8 flex items-center justify-between">
        <div className="text-[10px] font-mono text-[#5a616c]">
          {Object.values(storyBeats).filter((v) => v.length > 0).length} / {SAVE_THE_CAT_BEATS.length} beats filled
        </div>
        <button
          onClick={onNext}
          disabled={!hasContent}
          className="h-9 px-5 rounded-[6px] text-[12px] font-medium text-white transition-all disabled:opacity-40 flex items-center gap-2"
          style={{ backgroundColor: accentHex }}
        >
          Continue to Episodes →
        </button>
      </div>
    </div>
  );
}
