import type * as THREE from "three";
import type { Font } from "three/examples/jsm/loaders/FontLoader.js";
/** Builds one award piece (the same models the cabinet art was rendered from). */
export function award(id: string, tier: string, font: Font | null): THREE.Group;
export const PIECES: Record<string, { name: string; ry?: number; fit?: number; noPlinth?: boolean }>;
