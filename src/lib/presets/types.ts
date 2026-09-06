import type { Ctx } from "../render/ctx";
import type { Scene } from "../render/scene";
import type { PresetCategory, SlideField } from "../types";

export interface Preset {
  id: string;
  name: string;
  category: PresetCategory;
  /** One line shown in the picker. */
  blurb: string;
  defaultPalette: string;
  /** Palette ids that suit this preset; the first is the default. */
  palettes: string[];
  /** Slide fields the content writer should populate for this preset. */
  needs: SlideField[];
  /** Structural instruction handed to the copywriter. */
  brief: string;
  /** [min, max] recommended slide count. */
  slideRange: [number, number];
  /** Safe margin override. */
  pad?: number;
  render(c: Ctx): Scene;
}

export type PresetId = string;
