import type { LucideIcon } from "lucide-react";

export interface StoryBeat {
  id: string;
  label: string;
  placeholder: string;
  description: string;
}

export type StoryBeatsMap = Record<string, string>;

export interface ImageData {
  base64: string;
  mimeType: string;
}

export interface CharacterDescription {
  name: string;
  description: string;
  role: string;
  distinctiveFeatures: string;
}

export interface Scene {
  id: string;
  beatId: string;
  beatTitle: string;
  title: string;
  variantType: string;
  prompt: string;
  color: string;
  icon: LucideIcon | null;
  duration: number;
  imageUrl: string | null;
  isRendering: boolean;
  episodeId?: string;
}

export interface TimelineClip extends Scene {
  instanceId: number;
  start: number;
  end: number;
}

export interface Episode {
  id: string;
  title: string;
  synopsis: string;
  beatIds: string[];
  color: string;
}

export interface AudioMarker {
  id: number;
  time: number;
  type: "auto" | "manual";
  strength: number;
}

export type StepId = "story" | "episode" | "generation" | "timeline";

export interface AccentColor {
  name: string;
  hex: string;
  ink: string;
}
