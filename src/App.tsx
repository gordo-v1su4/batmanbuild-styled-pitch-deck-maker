import { useState } from "react";
import {
  Film, Zap, Clapperboard, Layers, Activity,
  CheckCircle, ChevronRight,
} from "lucide-react";
import { SAVE_THE_CAT_BEATS, distributeReferenceImages } from "./constants/storyBeats";
import { CINEMATIC_QUALITY_TERMS } from "./constants";
import { callImagen } from "./utils/api";
import { callKimi } from "./utils/kimi";
import { StoryStep } from "./components/StoryStep";
import { EpisodeStep } from "./components/EpisodeStep";
import { GenerationStep } from "./components/GenerationStep";
import { TimelineStep } from "./components/TimelineStep";
import type {
  StepId, AccentColor, StoryBeatsMap, ImageData,
  CharacterDescription, Scene, Episode, TimelineClip, AudioMarker,
} from "./types";

const ACCENTS: AccentColor[] = [
  { name: "Indigo", hex: "#3a7bff", ink: "#c7ddff" },
  { name: "Cyan", hex: "#22b8cf", ink: "#a7f3ff" },
  { name: "Amber", hex: "#f5a524", ink: "#fed7aa" },
  { name: "Mint", hex: "#2ee6a6", ink: "#a7f3d0" },
];

const STEPS: { id: StepId; label: string; icon: typeof Film }[] = [
  { id: "story", label: "Story", icon: Zap },
  { id: "episode", label: "Episodes", icon: Clapperboard },
  { id: "generation", label: "Generation", icon: Layers },
  { id: "timeline", label: "Timeline", icon: Film },
];

const BEAT_GRADIENTS: Record<string, string> = {
  openingImage: "from-[#1e293b] to-[#0a0a0b]",
  themeStated: "from-[#1e293b] to-[#0a0a0b]",
  setup: "from-[#1c1917] to-[#0a0a0b]",
  catalyst: "from-[#1c1917] to-[#0a0a0b]",
  debate: "from-[#1c1917] to-[#0a0a0b]",
  breakIntoTwo: "from-[#1a1020] to-[#0a0a0b]",
  bStory: "from-[#1a1020] to-[#0a0a0b]",
  funAndGames: "from-[#1e1a0c] to-[#0a0a0b]",
  midpoint: "from-[#1e1a0c] to-[#0a0a0b]",
  badGuysCloseIn: "from-[#0c1420] to-[#0a0a0b]",
  allIsLost: "from-[#0c1420] to-[#0a0a0b]",
  darkNight: "from-[#0c1420] to-[#0a0a0b]",
  breakIntoThree: "from-[#1c0c14] to-[#0a0a0b]",
  finale: "from-[#1c0c14] to-[#0a0a0b]",
  finalImage: "from-[#0c1c10] to-[#0a0a0b]",
};

const BEAT_ICONS: Record<string, any> = {
  openingImage: Film, themeStated: Zap, setup: Activity, catalyst: Zap,
  debate: Layers, breakIntoTwo: ChevronRight, bStory: Film,
  funAndGames: Activity, midpoint: Zap, badGuysCloseIn: ChevronRight,
  allIsLost: Film, darkNight: Activity, breakIntoThree: Zap,
  finale: Clapperboard, finalImage: CheckCircle,
};

export default function App() {
  const [currentStep, setCurrentStep] = useState<StepId>("story");
  const [accent, setAccent] = useState<AccentColor>(ACCENTS[0]);

  // Story state
  const [storyBeats, setStoryBeats] = useState<StoryBeatsMap>(() => {
    const beats: StoryBeatsMap = {};
    SAVE_THE_CAT_BEATS.forEach((b) => { beats[b.id] = ""; });
    return beats;
  });
  const [visualStyle, setVisualStyle] = useState("Cinematic, High Contrast");
  const [inspirationImages, setInspirationImages] = useState<string[]>([]);
  const [referenceImageData, setReferenceImageData] = useState<ImageData[]>([]);
  const [characterDescriptions, setCharacterDescriptions] = useState<CharacterDescription[]>([]);
  const [projectTitle, setProjectTitle] = useState("Untitled Project");
  const [suggestedTitles, setSuggestedTitles] = useState<string[]>([]);
  const [showTitleOptions, setShowTitleOptions] = useState(false);

  // Episode state
  const [episodes, setEpisodes] = useState<Episode[]>([]);

  // Generation state
  const [generatedScenes, setGeneratedScenes] = useState<Scene[]>([]);

  // Timeline state
  const [timeline, setTimeline] = useState<TimelineClip[]>([]);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [audioMarkers, setAudioMarkers] = useState<AudioMarker[]>([]);
  const [markerDensity, setMarkerDensity] = useState("all");
  const [markerSensitivity, setMarkerSensitivity] = useState(0.7);
  const [isDecoding, setIsDecoding] = useState(false);

  // AI state
  const [isAIProcessing, setIsAIProcessing] = useState(false);
  const [generationStatus, setGenerationStatus] = useState("");

  // --- Asset Generation ---
  const generateStyledAssets = async () => {
    const hasContent = Object.values(storyBeats).some((v) => v.length > 0);
    if (!hasContent) return;

    setIsAIProcessing(true);
    setGenerationStatus("Creating Shot List...");
    setCurrentStep("generation");

    try {
      const characterSection = characterDescriptions.length > 0
        ? `**CHARACTER CONSISTENCY (CRITICAL):**\nThe following characters must appear consistently across ALL scenes:\n${characterDescriptions.map((char, idx) => `${idx + 1}. ${char.name || `Character ${idx + 1}`}: ${char.description} (Role: ${char.role || "Unknown"}, Features: ${char.distinctiveFeatures || "None"})`).join("\n")}\n`
        : "";

      const imageDistribution = referenceImageData.length > 0
        ? distributeReferenceImages(referenceImageData, storyBeats)
        : {};

      const storyBeatsWithImages = SAVE_THE_CAT_BEATS
        .map((beat) => ({
          ...beat,
          content: storyBeats[beat.id] || "",
          referenceImages: (imageDistribution[beat.id] || []).length,
        }))
        .filter((beat) => beat.content.length > 0);

      const referenceImageContext = referenceImageData.length > 0
        ? `**REFERENCE IMAGES:** You have ${referenceImageData.length} reference image(s) that establish the world, style, action, and color palette.\n`
        : "";

      const prompt = `Generate cinematic scene descriptions for each story beat.
Visual Style: ${visualStyle}
${characterSection}
${referenceImageContext}
Story Beats:
${storyBeatsWithImages.map((beat, idx) => `${idx + 1}. ${beat.label}: ${beat.content}${beat.referenceImages > 0 ? ` (${beat.referenceImages} reference image(s) available)` : ""}`).join("\n")}

**IMAGE QUALITY:** All descriptions must be for hyper-realistic, cinematic film photography (ARRI Alexa, anamorphic lenses, film grain, professional color grading, volumetric lighting).

**VARIETY:** Mix macro detail shots and dynamic action shots. Each shot unique. Follow story progression.

Return JSON: { "scenes": [{ "beatId": "string", "beatTitle": "string", "variants": [{ "type": "Macro Detail", "description": "..." }, { "type": "Dynamic Action", "description": "..." }, { "type": "Establishing", "description": "..." }, { "type": "Character Focus", "description": "..." }] }] }`;

      const result = await callKimi(prompt, "You are a world-class Film Director and Cinematographer. Generate cinematic scene descriptions. Return strict JSON only.");

      if (result?.scenes) {
        const allScenes: Scene[] = [];
        result.scenes.forEach((sceneGroup: any, groupIdx: number) => {
          sceneGroup.variants.forEach((variant: any, varIdx: number) => {
            allScenes.push({
              id: `gen_${groupIdx}_${varIdx}`,
              beatId: sceneGroup.beatId,
              beatTitle: sceneGroup.beatTitle,
              title: `${sceneGroup.beatTitle} (${variant.type})`,
              variantType: variant.type,
              prompt: variant.description,
              color: BEAT_GRADIENTS[sceneGroup.beatId] || "from-[#1e293b] to-[#0a0a0b]",
              icon: BEAT_ICONS[sceneGroup.beatId] || Film,
              duration: 2 + Math.random() * 2,
              imageUrl: null,
              isRendering: false,
            });
          });
        });
        setGeneratedScenes(allScenes);

        // Auto-render first variants
        setGenerationStatus("Rendering Dailies...");
        const firstVariants = allScenes.filter((s) => s.variantType === "Establishing" || s.variantType === "Wide");
        for (const scene of firstVariants) {
          await handleRenderImage(scene.id, scene.prompt);
        }
      }
    } catch {
      fallbackGeneration();
    } finally {
      setIsAIProcessing(false);
    }
  };

  const fallbackGeneration = () => {
    const variants = ["Macro Detail", "Dynamic Action", "Establishing", "Character Focus"];
    const mockScenes: Scene[] = [];
    const beatsWithContent = SAVE_THE_CAT_BEATS.filter((beat) => (storyBeats[beat.id] || "").length > 0);

    beatsWithContent.forEach((beat) => {
      variants.forEach((v, idx) => {
        mockScenes.push({
          id: `mock_${beat.id}_${idx}`,
          beatId: beat.id,
          beatTitle: beat.label.replace(/^\d+\s*•\s*/, ""),
          title: `${beat.label.replace(/^\d+\s*•\s*/, "")} (${v})`,
          variantType: v,
          prompt: `A cinematic ${v} shot representing ${beat.label}. Style: ${visualStyle}`,
          color: BEAT_GRADIENTS[beat.id] || "from-[#1e293b] to-[#0a0a0b]",
          icon: BEAT_ICONS[beat.id] || Film,
          duration: 3,
          imageUrl: null,
          isRendering: false,
        });
      });
    });
    setGeneratedScenes(mockScenes);
  };

  const handleRenderImage = async (sceneId: string, prompt: string) => {
    setGeneratedScenes((prev) =>
      prev.map((s) => (s.id === sceneId ? { ...s, isRendering: true } : s))
    );

    try {
      const characterPrompt = characterDescriptions.length > 0
        ? characterDescriptions.map((char) => `${char.name || "Character"}: ${char.description}${char.distinctiveFeatures ? `, ${char.distinctiveFeatures}` : ""}`).join(". ") + ". "
        : "";

      const referencePrompt = referenceImageData.length > 0
        ? "Create the next shot in the sequence and world, hyper realistic cinematic and detailed film shot, the people are photorealistic, improve the image as if it is a live action film shot on an anamorphic lens with a film camera. Image should be either a macro or dynamic action shot that follows the same style, action, and color palette. Make each shot unique. "
        : "";

      const fullPrompt = `${referencePrompt}${characterPrompt}${prompt}, ${visualStyle}, ${CINEMATIC_QUALITY_TERMS}, consistent character appearance, unique shot composition`;
      const imageUrl = await callImagen(fullPrompt);

      setGeneratedScenes((prev) =>
        prev.map((s) => (s.id === sceneId ? { ...s, imageUrl, isRendering: false } : s))
      );
      setTimeline((prev) =>
        prev.map((s) => (s.id === sceneId ? { ...s, imageUrl } : s))
      );
    } catch {
      setGeneratedScenes((prev) =>
        prev.map((s) => (s.id === sceneId ? { ...s, isRendering: false } : s))
      );
    }
  };

  const currentStepIdx = STEPS.findIndex((s) => s.id === currentStep);

  return (
    <div className="h-[100dvh] bg-[#08080a] text-[#c9ccd1] flex flex-col overflow-hidden" style={{ fontFamily: "Geist, Inter, system-ui, sans-serif", fontSize: 13, lineHeight: 1.45 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Geist+Mono:wght@500;600&family=Archivo+Narrow:wght@700;800&display=swap');
        * { scrollbar-width: thin; scrollbar-color: #1f1f25 #08080a; }
        ::-webkit-scrollbar { height: 6px; width: 6px; }
        ::-webkit-scrollbar-thumb { background: #1f1f25; border-radius: 3px; }
        ::-webkit-scrollbar-thumb:hover { background: #2a2a33; }
        .custom-scrollbar-thin::-webkit-scrollbar { width: 4px; height: 4px; }
        .custom-scrollbar-thin::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar-thin::-webkit-scrollbar-thumb { background: #1f1f25; border-radius: 2px; }
        html { scroll-behavior: smooth; }
        button:focus { outline: none !important; }
        button:focus-visible { outline: none !important; }
        button:active { transform: scale(0.98); }
        input[type="range"].slider-circle {
          -webkit-appearance: none;
          appearance: none;
          width: 28px;
          height: 28px;
          border-radius: 50%;
          background: #1f1f25;
          border: 1px solid rgba(255,255,255,0.1);
          cursor: pointer;
          outline: none;
        }
        input[type="range"].slider-circle::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: var(--accent, #3a7bff);
          border: 1px solid rgba(255,255,255,0.2);
          margin-top: 7px;
        }
        input[type="range"].slider-circle::-moz-range-thumb {
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: var(--accent, #3a7bff);
          border: 1px solid rgba(255,255,255,0.2);
          border: none;
        }
        input[type="range"].slider-circle::-webkit-slider-runnable-track {
          background: transparent;
          height: 26px;
          border-radius: 50%;
        }
        input[type="range"].slider-circle::-moz-range-track {
          background: transparent;
          height: 26px;
          border-radius: 50%;
        }
      `}</style>

      {/* Topbar — 48px, Pindeck spec */}
      <div className="sticky top-0 z-40 h-12 border-b border-white/[0.06] bg-[#0c0c0f]/90 backdrop-blur-xl shrink-0">
        <div className="h-full max-w-[1400px] mx-auto px-4 flex items-center gap-4">
          {/* Logo */}
          <div className="flex items-center gap-2.5 shrink-0 mr-2">
            <div className="h-7 w-7 rounded-[8px] flex items-center justify-center text-white" style={{ backgroundColor: accent.hex }}>
              <Film size={14} />
            </div>
            <div className="leading-[1.15] hidden sm:block pr-1">
              <div className="text-[11px] font-semibold text-white tracking-tight" style={{ fontFamily: "Archivo Narrow, sans-serif" }}>
                TRAILERCRAFT
              </div>
              <div className="text-[9px] font-mono text-[#6c727c] tracking-wide mt-0.5">SERIES • STORY → EP → GEN → TIMELINE</div>
            </div>
          </div>

          {/* Divider */}
          <div className="h-5 w-px bg-white/10 hidden sm:block" />

          {/* Step Stepper */}
          <div className="flex items-center gap-1">
            {STEPS.map((step, i) => {
              const StepIcon = step.icon;
              const isActive = currentStep === step.id;
              const isComplete = currentStepIdx > i;
              return (
                <div key={step.id} className="flex items-center">
                  <button
                    onClick={() => setCurrentStep(step.id)}
                    className={`flex items-center gap-1.5 px-2.5 h-7 rounded-[5px] text-[11px] font-medium transition-colors ${
                      isActive
                        ? "text-white border border-white/20"
                        : isComplete
                        ? "text-[#9aa0a8] border border-transparent hover:border-white/10"
                        : "text-[#5a616c] border border-transparent hover:text-[#7a8089]"
                    }`}
                    style={isActive ? { backgroundColor: `${accent.hex}18` } : undefined}
                  >
                    <StepIcon size={12} style={isActive ? { color: accent.hex } : undefined} />
                    <span className="hidden md:inline">{step.label}</span>
                    <span className={`w-2.5 h-2.5 shrink-0 ${isComplete ? "opacity-100" : "opacity-0"}`}>
                      <CheckCircle size={10} className="text-[#2ee6a6]" />
                    </span>
                  </button>
                  {i < STEPS.length - 1 && (
                    <ChevronRight size={12} className="text-[#2a2a33] mx-0.5" />
                  )}
                </div>
              );
            })}
          </div>

          <div className="flex-1" />

          {/* Accent picker */}
          <div className="hidden md:flex items-center gap-1">
            <span className="text-[10px] font-mono text-[#6c727c] mr-1.5">ACCENT</span>
            {ACCENTS.map((a) => (
              <button
                key={a.hex}
                onClick={() => setAccent(a)}
                className="w-5 h-5 rounded-[4px] border transition-all relative"
                style={{
                  backgroundColor: a.hex,
                  borderColor: accent.hex === a.hex ? "white" : "#2a2a33",
                  boxShadow: accent.hex === a.hex ? `0 0 0 1px #0c0c0f, 0 0 0 3px ${a.hex}50` : "none",
                }}
                title={a.name}
              />
            ))}
          </div>

          {/* Project title */}
          <div className="hidden lg:flex items-center gap-2 text-[10px] font-mono px-2.5 py-1 rounded bg-[#111116] border border-white/10 text-[#8a8f98] max-w-[200px]">
            <span className="w-1 h-1 rounded-full shrink-0" style={{ backgroundColor: accent.hex }} />
            <span className="truncate">{projectTitle}</span>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-y-auto bg-[#08080a]">
        {currentStep === "story" && (
          <StoryStep
            storyBeats={storyBeats}
            setStoryBeats={setStoryBeats}
            visualStyle={visualStyle}
            setVisualStyle={setVisualStyle}
            inspirationImages={inspirationImages}
            setInspirationImages={setInspirationImages}
            referenceImageData={referenceImageData}
            setReferenceImageData={setReferenceImageData}
            characterDescriptions={characterDescriptions}
            setCharacterDescriptions={setCharacterDescriptions}
            isAIProcessing={isAIProcessing}
            setIsAIProcessing={setIsAIProcessing}
            generationStatus={generationStatus}
            setGenerationStatus={setGenerationStatus}
            projectTitle={projectTitle}
            setProjectTitle={setProjectTitle}
            suggestedTitles={suggestedTitles}
            setSuggestedTitles={setSuggestedTitles}
            showTitleOptions={showTitleOptions}
            setShowTitleOptions={setShowTitleOptions}
            accentHex={accent.hex}
            onNext={() => setCurrentStep("episode")}
          />
        )}

        {currentStep === "episode" && (
          <EpisodeStep
            storyBeats={storyBeats}
            episodes={episodes}
            setEpisodes={setEpisodes}
            visualStyle={visualStyle}
            isAIProcessing={isAIProcessing}
            setIsAIProcessing={setIsAIProcessing}
            generationStatus={generationStatus}
            setGenerationStatus={setGenerationStatus}
            accentHex={accent.hex}
            onPrev={() => setCurrentStep("story")}
            onNext={() => setCurrentStep("generation")}
          />
        )}

        {currentStep === "generation" && (
          <GenerationStep
            storyBeats={storyBeats}
            episodes={episodes}
            generatedScenes={generatedScenes}
            setGeneratedScenes={setGeneratedScenes}
            visualStyle={visualStyle}
            characterDescriptions={characterDescriptions}
            referenceImageData={referenceImageData}
            isAIProcessing={isAIProcessing}
            setIsAIProcessing={setIsAIProcessing}
            generationStatus={generationStatus}
            setGenerationStatus={setGenerationStatus}
            accentHex={accent.hex}
            onRenderImage={handleRenderImage}
            onGenerateAssets={generateStyledAssets}
            onPrev={() => setCurrentStep("episode")}
            onNext={() => setCurrentStep("timeline")}
          />
        )}

        {currentStep === "timeline" && (
          <TimelineStep
            timeline={timeline}
            setTimeline={setTimeline}
            generatedScenes={generatedScenes}
            setGeneratedScenes={setGeneratedScenes}
            currentTime={currentTime}
            setCurrentTime={setCurrentTime}
            duration={duration}
            setDuration={setDuration}
            isPlaying={isPlaying}
            setIsPlaying={setIsPlaying}
            audioFile={audioFile}
            setAudioFile={setAudioFile}
            audioBuffer={audioBuffer}
            setAudioBuffer={setAudioBuffer}
            isDecoding={isDecoding}
            setIsDecoding={setIsDecoding}
            audioMarkers={audioMarkers}
            setAudioMarkers={setAudioMarkers}
            markerDensity={markerDensity}
            setMarkerDensity={setMarkerDensity}
            markerSensitivity={markerSensitivity}
            setMarkerSensitivity={setMarkerSensitivity}
            accentHex={accent.hex}
            onRenderImage={handleRenderImage}
            onGenerateAssets={generateStyledAssets}
            isAIProcessing={isAIProcessing}
            generationStatus={generationStatus}
            onPrev={() => setCurrentStep("generation")}
          />
        )}
      </div>
    </div>
  );
}
