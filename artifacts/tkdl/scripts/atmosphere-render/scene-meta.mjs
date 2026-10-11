/**
 * Workstream F1 — atmosphere render catalogue (no WebGL needed to read it).
 * `blend`: how the layer composites over a venue plate ("screen" = light on black, "normal" = alpha, "plate" = opaque backdrop).
 */
export const SCENE_META = {
  "light-beams": { kind: "light", blend: "screen", use: "Televised stage: coloured moving-head beams from two truss lines",
    render: { size: [1920, 1080], exposure: 1.0 } },
  "light-beams-major": { kind: "light", blend: "screen", use: "Major championship: white/gold symmetrical fan from a triple rig",
    render: { size: [1920, 1080], exposure: 1.0 } },
  "light-beams-palace": { kind: "light", blend: "screen", use: "The Palace: warm gold crown of beams and chandelier glow",
    render: { size: [1920, 1080], exposure: 1.0 } },
  "light-lamp": { kind: "light", blend: "screen", use: "Club: one warm shade over the oche, dust in the light", render: { size: [1920, 1080] } },
  "light-hall": { kind: "light", blend: "screen", use: "County & national halls: three overhead spots on a plain bar", render: { size: [1920, 1080] } },
  "light-floor": { kind: "light", blend: "screen", use: "Professional floor: receding cool LED strips over each board", render: { size: [1920, 1080] } },
  "spotlight": { kind: "light", blend: "screen", use: "Follow-spot and back light: walk-on, match introduction, winning moment", render: { size: [1920, 1080] } },
  "pyro": { kind: "light", blend: "screen", use: "Four stage-front gerb fountains (Major and Palace victories only)", render: { size: [1920, 1080], quality: 0.8 } },
  "confetti-silver": { kind: "celebration", blend: "normal", use: "Light silver/white confetti (national and televised stage wins)",
    render: { size: [1600, 900], alpha: true, accumulate: 12, quality: 0.8 } },
  "confetti-gold": { kind: "celebration", blend: "normal", use: "Dense gold and silver confetti (Major championship victory)",
    render: { size: [1280, 720], alpha: true, accumulate: 12, quality: 0.76 } },
  "tickertape-palace": { kind: "celebration", blend: "normal", use: "Gold ticker tape and confetti (World Championship victory only)",
    render: { size: [1280, 720], alpha: true, accumulate: 12, quality: 0.76 } },
  "palace-stage": { kind: "plate", blend: "plate", use: "The Palace (Alexandra Grand Hall): vaulted hall, rose window, galleries, table crowd, championship stage. Replaces the trophy-led venue photo for World Championship scenes.",
    focal: { x: 0.5, y: 0.52 }, stage: { x: 0.5, y: 0.6 }, render: { size: [2400, 1350], exposure: 1.15, supersample: 1.25, accumulate: 16, quality: 0.82 } },
  "neutral": { kind: "plate", blend: "plate", use: "Neutral broadcast studio for saves without event/venue metadata (claims no venue)",
    focal: { x: 0.5, y: 0.55 }, stage: { x: 0.5, y: 0.66 }, render: { size: [1920, 1080], exposure: 1.35, quality: 0.8 } },
  "grain": { kind: "texture", blend: "overlay", use: "Documentary chapters: tileable film grain and dust", render: { size: [512, 512], supersample: 1, quality: 0.7 } },
};
