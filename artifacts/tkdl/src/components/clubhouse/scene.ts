/**
 * The Clubhouse: one player's darts room in three.js. Everything in it is drawn from data the app already has
 * (honours, achievement tracks, career stats, rival). Items carry userData.info so a tap can show a detail card.
 */
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import type { Font } from "three/addons/loaders/FontLoader.js";
import { award } from "@/components/achievements-v2/model/league3d.js";
import { studioEnvironment } from "@/components/achievements-v2/model/trophies3d.js";
import { themeFor, type RoomTheme } from "./themes";

export type ClubInfo = { title: string; lines: string[] };
export type ClubData = {
  name: string;
  honours: { competition: string; seasonName: string; position: 1 | 2 | 3; team?: string }[];
  trophies: { id: string; tier: string; title: string; detail: string }[];
  chalk: { label: string; value: string }[];
  rival: { name: string; record: string } | null;
  walkon: { nickname: string; a: string; b: string } | null;
  /** CLUBHOUSE_ROOM theme key; null = the default pub room. */
  theme?: string | null;
  /** Months they helped hit a League Target or a Gaffer challenge (newest first): bunting along the back wall. */
  pennants?: { kind: "target" | "gaffer" | "squad"; month: string }[];
};

const PENNANT = { target: { colour: "#19c3c8", label: "TARGET", what: "League Target hit" },
  gaffer: { colour: "#ffd24a", label: "GAFFER", what: "Gaffer — challenge hit" }, squad: { colour: "#22c55e", label: "SQUAD", what: "Gaffer's challenge hit" } } as const;

function pennantTex(colour: string, label: string, month: string) {
  return canvasTex(256, 360, g => {
    g.clearRect(0, 0, 256, 360);
    g.beginPath(); g.moveTo(8, 8); g.lineTo(248, 8); g.lineTo(128, 352); g.closePath();
    const grd = g.createLinearGradient(0, 0, 256, 360); grd.addColorStop(0, colour); grd.addColorStop(1, "#0c0a12");
    g.fillStyle = grd; g.fill();
    g.lineWidth = 10; g.strokeStyle = "#f3efe0"; g.stroke();
    g.fillStyle = "#0c0a12"; g.fillRect(8, 8, 240, 34);
    g.fillStyle = "#f3efe0"; g.textAlign = "center"; g.font = "bold 52px Oswald, Arial"; g.fillText(label, 128, 96, 150);
    g.font = "bold 46px Oswald, Arial"; g.fillText(month, 128, 148, 120);
  });
}

const W = 7.2, D = 7, H = 4.2; // room size

function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void) {
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  draw(c.getContext("2d")!);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

function woodFloor(T: RoomTheme) {
  return canvasTex(1024, 1024, g => {
    for (let i = 0; i < 16; i++) {
      const y = i * 64, v = (i * 37) % 22;
      g.fillStyle = `rgb(${T.floor[0] + v + 30},${T.floor[1] + v + 12},${T.floor[2] + v - 10})`; g.fillRect(0, y, 1024, 64);
      for (let k = 0; k < 40; k++) { g.fillStyle = `rgba(30,15,5,${0.05 + Math.random() * 0.08})`; g.fillRect(Math.random() * 1024, y + Math.random() * 64, 80 + Math.random() * 200, 1 + Math.random() * 2); }
      g.fillStyle = "rgba(0,0,0,.45)"; g.fillRect(0, y, 1024, 2);
      const off = (i % 2) * 256; for (let x = off; x < 1024; x += 512) g.fillRect(x, y, 2, 64);
    }
  });
}

function wallTex(T: RoomTheme) {
  return canvasTex(512, 512, g => {
    const grd = g.createLinearGradient(0, 0, 0, 512); grd.addColorStop(0, T.wallTop); grd.addColorStop(1, T.wallBottom);
    g.fillStyle = grd; g.fillRect(0, 0, 512, 512);
    for (let x = 0; x < 512; x += 32) { g.fillStyle = T.stripe; g.fillRect(x, 0, 14, 512); }
  });
}

function boardTex() {
  const order = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];
  return canvasTex(1024, 1024, g => {
    const c = 512; g.fillStyle = "#0b0b0b"; g.beginPath(); g.arc(c, c, 510, 0, Math.PI * 2); g.fill();
    const rings: [number, number, boolean][] = [[400, 380, true], [380, 250, false], [250, 230, true], [230, 40, false]];
    for (let i = 0; i < 20; i++) {
      const a0 = (-90 - 9 + i * 18) * Math.PI / 180, a1 = a0 + 18 * Math.PI / 180;
      for (const [ro, ri, colour] of rings) {
        g.beginPath(); g.arc(c, c, ro, a0, a1); g.arc(c, c, ri, a1, a0, true); g.closePath();
        g.fillStyle = colour ? (i % 2 ? "#1f8a3c" : "#c8102e") : (i % 2 ? "#efe6cf" : "#151515"); g.fill();
        g.strokeStyle = "#b9b9b9"; g.lineWidth = 2; g.stroke();
      }
      const am = (a0 + a1) / 2; g.fillStyle = "#fff"; g.font = "bold 56px Oswald, Arial"; g.textAlign = "center"; g.textBaseline = "middle";
      g.fillText(String(order[i]), c + Math.cos(am) * 455, c + Math.sin(am) * 455);
    }
    g.beginPath(); g.arc(c, c, 40, 0, Math.PI * 2); g.fillStyle = "#1f8a3c"; g.fill();
    g.beginPath(); g.arc(c, c, 17, 0, Math.PI * 2); g.fillStyle = "#c8102e"; g.fill();
  });
}

function chalkTex(name: string, rows: { label: string; value: string }[]) {
  return canvasTex(1024, 640, g => {
    g.fillStyle = "#1b2a22"; g.fillRect(0, 0, 1024, 640);
    for (let k = 0; k < 900; k++) { g.fillStyle = `rgba(255,255,255,${Math.random() * 0.03})`; g.fillRect(Math.random() * 1024, Math.random() * 640, 3, 3); }
    g.fillStyle = "#f3efe0"; g.font = "bold 64px Oswald, Arial"; g.textAlign = "center"; g.fillText(name.toUpperCase(), 512, 92);
    g.fillRect(212, 116, 600, 3);
    g.font = "44px Oswald, Arial";
    rows.slice(0, 6).forEach((r, i) => {
      const y = 196 + i * 72; g.textAlign = "left"; g.fillStyle = "rgba(243,239,224,.75)"; g.fillText(r.label, 90, y);
      g.textAlign = "right"; g.fillStyle = "#ffe27a"; g.fillText(r.value, 934, y);
    });
  });
}

function plaqueTex(lines: [string, string, string], gold: boolean) {
  return canvasTex(512, 384, g => {
    const grd = g.createLinearGradient(0, 0, 0, 384); grd.addColorStop(0, gold ? "#3b2a08" : "#24242c"); grd.addColorStop(1, "#0e0c12");
    g.fillStyle = grd; g.fillRect(0, 0, 512, 384);
    g.strokeStyle = gold ? "#ffd24a" : "#b8bcc8"; g.lineWidth = 10; g.strokeRect(18, 18, 476, 348);
    g.textAlign = "center"; g.fillStyle = gold ? "#ffd24a" : "#dfe3ee";
    g.font = "bold 92px Oswald, Arial"; g.fillText(lines[0], 256, 150);
    g.font = "40px Oswald, Arial"; g.fillStyle = "#f3efe0"; g.fillText(lines[1], 256, 230);
    g.font = "32px Oswald, Arial"; g.fillStyle = "rgba(243,239,224,.7)"; g.fillText(lines[2], 256, 290);
  });
}

function neonTex(text: string, colour: string) {
  return canvasTex(1024, 256, g => {
    g.clearRect(0, 0, 1024, 256);
    g.font = "bold 150px Oswald, Arial"; g.textAlign = "center"; g.textBaseline = "middle";
    g.shadowColor = colour; g.shadowBlur = 40; g.fillStyle = colour; g.fillText(text, 512, 128);
    g.shadowBlur = 0; g.fillText(text, 512, 128);
    g.globalAlpha = 0.45; g.fillStyle = "#ffffff"; g.fillText(text, 512, 128); g.globalAlpha = 1;
  });
}

const ord = (p: number) => (p === 1 ? "1st" : p === 2 ? "2nd" : "3rd");

export function buildClubhouse(el: HTMLElement, data: ClubData, font: Font | null, onPick: (info: ClubInfo | null) => void) {
  const T = themeFor(data.theme);
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  const w = el.clientWidth, h = el.clientHeight;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2)); renderer.setSize(w, h);
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0; renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  el.appendChild(renderer.domElement); renderer.domElement.style.touchAction = "none";

  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x08060c);
  scene.environment = studioEnvironment(renderer);
  const pickables: THREE.Object3D[] = [];
  const tag = (o: THREE.Object3D, info: ClubInfo) => { o.userData.info = info; pickables.push(o); };

  // Room shell
  const floorTex = woodFloor(T); floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping; floorTex.repeat.set(2, 2);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D), new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.6, metalness: 0.05 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
  const wt = wallTex(T); wt.wrapS = THREE.RepeatWrapping; wt.repeat.set(3, 1);
  const wallMat = new THREE.MeshStandardMaterial({ map: wt, roughness: 0.85 });
  const back = new THREE.Mesh(new THREE.PlaneGeometry(W, H), wallMat); back.position.set(0, H / 2, -D / 2); back.receiveShadow = true; scene.add(back);
  for (const sx of [-1, 1]) {
    const side = new THREE.Mesh(new THREE.PlaneGeometry(D, H), wallMat); side.position.set(sx * W / 2, H / 2, 0); side.rotation.y = -sx * Math.PI / 2; side.receiveShadow = true; scene.add(side);
  }
  // Wainscot + skirting
  const wood = new THREE.MeshStandardMaterial({ color: T.wood, roughness: 0.55 });
  const wain = new THREE.Mesh(new THREE.BoxGeometry(W, 1.1, 0.06), wood); wain.position.set(0, 0.55, -D / 2 + 0.03); wain.receiveShadow = true; scene.add(wain);
  const rail = new THREE.Mesh(new THREE.BoxGeometry(W, 0.06, 0.12), new THREE.MeshStandardMaterial({ color: T.rail, metalness: 0.7, roughness: 0.3 })); rail.position.set(0, 1.12, -D / 2 + 0.06); scene.add(rail);
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(W, D), new THREE.MeshStandardMaterial({ color: 0x0d0a10 })); ceil.rotation.x = Math.PI / 2; ceil.position.y = H; scene.add(ceil);

  // Lights
  scene.add(new THREE.AmbientLight(T.ambient, 0.25));
  const hemi = new THREE.HemisphereLight(0xffd9b0, 0x1a0a12, 0.35); scene.add(hemi);
  const spot = new THREE.SpotLight(T.spot, 60, 12, 0.5, 0.45, 1.4); spot.position.set(0, 3.9, -0.8); spot.target.position.set(0, 1.73, -D / 2); spot.castShadow = true; spot.shadow.mapSize.set(1024, 1024); scene.add(spot, spot.target);
  const warmL = new THREE.PointLight(T.warm, 14, 9, 1.6); warmL.position.set(-3.2, 3, -1.2); scene.add(warmL);
  const warmR = new THREE.PointLight(T.warm, 14, 9, 1.6); warmR.position.set(3.2, 3, -1.2); scene.add(warmR);

  // Dartboard, cabinet surround and oche
  const cab = new THREE.Mesh(new THREE.BoxGeometry(1.25, 1.25, 0.08), new THREE.MeshStandardMaterial({ color: 0x2a160b, roughness: 0.35 }));
  cab.position.set(0, 1.73, -D / 2 + 0.05); cab.castShadow = true; scene.add(cab);
  const board = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.46, 0.05, 64), [new THREE.MeshStandardMaterial({ color: 0x111111 }), new THREE.MeshStandardMaterial({ map: boardTex(), roughness: 0.8 }), new THREE.MeshStandardMaterial({ color: 0x111111 })]);
  board.rotation.x = Math.PI / 2; board.rotation.y = Math.PI; board.position.set(0, 1.73, -D / 2 + 0.12); board.castShadow = true; scene.add(board);
  tag(board, { title: "The board", lines: [`${data.name}'s board, lit for match night.`] });
  const oche = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.02, 0.05), new THREE.MeshStandardMaterial({ color: 0xffd24a, metalness: 0.8, roughness: 0.25 })); oche.position.set(0, 0.011, -D / 2 + 2.37); scene.add(oche);

  // Neon sign
  const neon = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.6), new THREE.MeshBasicMaterial({ map: neonTex("TKDL", T.neon), transparent: true, toneMapped: false }));
  neon.position.set(0, 3.15, -D / 2 + 0.02); scene.add(neon);
  const neonGlow = new THREE.PointLight(T.neonGlow, 4, 4, 2); neonGlow.position.set(0, 3.1, -D / 2 + 0.5); scene.add(neonGlow);

  // Trophy shelf (left of the board): the player's top achievement pieces in their metals
  const shelfMat = new THREE.MeshStandardMaterial({ color: 0x4a2c16, roughness: 0.45 });
  const shelfY = 1.45, shelfX = -1.95;
  const shelf = new THREE.Mesh(new THREE.BoxGeometry(1.95, 0.05, 0.36), shelfMat); shelf.position.set(shelfX, shelfY, -D / 2 + 0.22); shelf.castShadow = true; shelf.receiveShadow = true; scene.add(shelf);
  const shelf2 = shelf.clone(); shelf2.position.y = shelfY + 0.85; scene.add(shelf2);
  data.trophies.slice(0, 6).forEach((t, i) => {
    try {
      const obj = award(t.id, t.tier, font);
      const fit = (obj.userData.fit as number | undefined) ?? 1;
      obj.scale.setScalar(0.2 * fit);
      const row = i < 3 ? 0 : 1, col = i % 3;
      obj.position.set(shelfX - 0.62 + col * 0.62, (row === 0 ? shelfY : shelfY + 0.85) + 0.03 + 0.135 * (1 - fit) * 0, -D / 2 + 0.24);
      obj.rotation.y = 0.15 * (col - 1);
      scene.add(obj); tag(obj, { title: t.title, lines: [t.detail, `${t.tier.charAt(0)}${t.tier.slice(1).toLowerCase()}`] });
    } catch { /* a piece that fails to build is just left off */ }
  });
  if (!data.trophies.length) {
    const empty = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.5), new THREE.MeshBasicMaterial({ map: canvasTex(880, 200, g => { g.fillStyle = "rgba(243,239,224,.55)"; g.font = "48px Oswald, Arial"; g.textAlign = "center"; g.fillText("Trophies land here", 440, 110); }), transparent: true }));
    empty.position.set(shelfX, shelfY + 0.35, -D / 2 + 0.02); scene.add(empty);
  }

  // Honours plaques (right of the board)
  const honours = data.honours.slice(0, 6);
  honours.forEach((hn, i) => {
    const col = i % 3, row = Math.floor(i / 3);
    const pl = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.4, 0.04), [wood, wood, wood, wood, new THREE.MeshStandardMaterial({ map: plaqueTex([ord(hn.position), hn.competition, hn.seasonName], hn.position === 1), roughness: 0.5, metalness: 0.2 }), wood]);
    pl.position.set(1.35 + col * 0.6, 2.3 - row * 0.52, -D / 2 + 0.04); pl.castShadow = true; scene.add(pl);
    tag(pl, { title: `${ord(hn.position)} · ${hn.competition}`, lines: [hn.seasonName, ...(hn.team ? [hn.team] : [])] });
  });
  if (!honours.length) {
    const pl = new THREE.Mesh(new THREE.PlaneGeometry(2, 0.5), new THREE.MeshBasicMaterial({ map: canvasTex(800, 200, g => { g.fillStyle = "rgba(243,239,224,.55)"; g.font = "46px Oswald, Arial"; g.textAlign = "center"; g.fillText("Top-3 finishes hang here", 400, 110); }), transparent: true }));
    pl.position.set(1.95, 2.2, -D / 2 + 0.02); scene.add(pl);
  }

  // Chalkboard on the left wall
  const chalk = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.38, 0.05), [wood, wood, wood, wood, new THREE.MeshStandardMaterial({ map: chalkTex(data.name, data.chalk), roughness: 0.95 }), wood]);
  chalk.rotation.y = Math.PI / 2; chalk.position.set(-W / 2 + 0.04, 2.0, -2.1); scene.add(chalk);
  tag(chalk, { title: "The chalkboard", lines: data.chalk.map(r => `${r.label}: ${r.value}`) });

  // Rival frame on the right wall
  if (data.rival) {
    const rv = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.3, 0.05), [wood, wood, wood, wood, new THREE.MeshStandardMaterial({ map: canvasTex(440, 520, g => {
      g.fillStyle = "#16121c"; g.fillRect(0, 0, 440, 520); g.strokeStyle = "#ffd24a"; g.lineWidth = 12; g.strokeRect(14, 14, 412, 492);
      g.fillStyle = "#ff7aa8"; g.font = "bold 40px Oswald, Arial"; g.textAlign = "center"; g.fillText("RIVAL", 220, 90);
      g.fillStyle = "#2a2333"; g.beginPath(); g.arc(220, 220, 90, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#f3efe0"; g.font = "bold 110px Oswald, Arial"; g.fillText(data.rival!.name.charAt(0).toUpperCase(), 220, 258);
      g.font = "bold 50px Oswald, Arial"; g.fillText(data.rival!.name.toUpperCase(), 220, 390);
      g.fillStyle = "#ffd24a"; g.font = "44px Oswald, Arial"; g.fillText(data.rival!.record, 220, 456);
    }), roughness: 0.6 }), wood]);
    rv.rotation.y = -Math.PI / 2; rv.position.set(W / 2 - 0.04, 2.05, -2.6); scene.add(rv);
    tag(rv, { title: `Rival: ${data.rival.name}`, lines: [`Head to head: ${data.rival.record}`] });
  }

  // Framed shirt on the right wall: the player's walk-on nickname and colours
  {
    const wk = data.walkon;
    const tex = canvasTex(512, 600, g => {
      g.fillStyle = "#120f18"; g.fillRect(0, 0, 512, 600);
      const a = wk?.a ?? "#3a3644", b2 = wk?.b ?? "#6d6a7c";
      g.fillStyle = a; g.beginPath();
      g.moveTo(150, 90); g.lineTo(206, 70); g.quadraticCurveTo(256, 110, 306, 70); g.lineTo(362, 90); g.lineTo(450, 170); g.lineTo(400, 236); g.lineTo(366, 210);
      g.lineTo(366, 520); g.lineTo(146, 520); g.lineTo(146, 210); g.lineTo(112, 236); g.lineTo(62, 170); g.closePath(); g.fill();
      g.fillStyle = b2; g.fillRect(146, 250, 220, 26); g.fillRect(146, 290, 220, 10);
      g.fillStyle = "#fff"; g.textAlign = "center"; g.font = "bold 44px Oswald, Arial";
      g.fillText((wk?.nickname || data.name).toUpperCase().slice(0, 14), 256, 380);
      g.font = "bold 110px Oswald, Arial"; g.fillStyle = b2; g.fillText(data.name.charAt(0).toUpperCase(), 256, 490);
      g.strokeStyle = "#ffd24a"; g.lineWidth = 10; g.strokeRect(12, 12, 488, 576);
    });
    const shirt = new THREE.Mesh(new THREE.BoxGeometry(0.95, 1.12, 0.05), [wood, wood, wood, wood, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.55 }), wood]);
    shirt.rotation.y = -Math.PI / 2; shirt.position.set(W / 2 - 0.04, 2.0, -1.3); scene.add(shirt);
    tag(shirt, wk ? { title: `“${wk.nickname || data.name}”`, lines: ["Walk-on shirt, in their walk-on colours."] } : { title: "The shirt", lines: ["Set up a walk-on to put your nickname and colours on it."] });
  }

  // A high table and stools for the room's feel
  const tableTop = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.05, 40), wood); tableTop.position.set(2.6, 1.05, -1.95); tableTop.castShadow = true; scene.add(tableTop);
  const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.05, 12), new THREE.MeshStandardMaterial({ color: 0x1a1a1a, metalness: 0.8, roughness: 0.3 })); leg.position.set(2.6, 0.52, -1.95); scene.add(leg);
  const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.03, 30), leg.material); foot.position.set(2.6, 0.015, -1.95); scene.add(foot);

  // Challenge pennants: one per month they helped hit a League Target or a Gaffer challenge (earned only, never sold)
  const pennants = (data.pennants ?? []).slice(0, 12).reverse();
  if (pennants.length) {
    const lineY = 3.98, z = -D / 2 + 0.08, step = 0.56, span = pennants.length * step;
    const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, span + 0.4, 6), new THREE.MeshStandardMaterial({ color: 0xd8c8a0, roughness: 0.8 }));
    cord.rotation.z = Math.PI / 2; cord.position.set(0, lineY, z); scene.add(cord);
    pennants.forEach((p, i) => {
      const k = PENNANT[p.kind];
      const mLabel = new Date(`${p.month}-01T12:00:00Z`).toLocaleString("en-GB", { month: "short", year: "2-digit", timeZone: "UTC" }).toUpperCase();
      const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.48, 0.67), new THREE.MeshStandardMaterial({ map: pennantTex(k.colour, k.label, mLabel), transparent: true, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.85 }));
      flag.position.set(-span / 2 + step / 2 + i * step, lineY - 0.34, z + 0.01); flag.rotation.z = ((i * 37) % 7 - 3) * 0.012; scene.add(flag);
      tag(flag, { title: `${k.label === "GAFFER" ? "👑 " : ""}${new Date(`${p.month}-01T12:00:00Z`).toLocaleString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" })}`, lines: [k.what, "Earned, never bought."] });
    });
  }

  // Exclusive rooms get their own props
  if (data.theme === "shopfloor") {
    const sign = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.42, 0.04), [wood, wood, wood, wood, new THREE.MeshStandardMaterial({ roughness: 0.4, map: canvasTex(1024, 205, g => {
      g.fillStyle = "#0b3a8a"; g.fillRect(0, 0, 1024, 205); g.fillStyle = "#e11d2e"; g.fillRect(0, 0, 150, 205);
      g.fillStyle = "#fff"; g.font = "bold 110px Oswald, Arial"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("180", 75, 108);
      g.textAlign = "left"; g.font = "bold 84px Oswald, Arial"; g.fillText("AISLE · DARTS & FLIGHTS", 190, 108);
    }) }), wood]);
    sign.position.set(0, 3.55, -1.3); scene.add(sign);
    for (const sx of [-0.9, 0.9]) { const wire = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.65, 6), new THREE.MeshStandardMaterial({ color: 0xcfd6e0, metalness: 0.8 })); wire.position.set(sx, 4.0, -1.3); scene.add(wire); }
    tag(sign, { title: "The Shop Floor", lines: ["Unlocked by helping hit 9 League Targets.", "Never in the Store."] });
  }
  if (data.theme === "gaffer") {
    const easel = new THREE.Group();
    const boardMesh = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.9, 0.04), [wood, wood, wood, wood, new THREE.MeshStandardMaterial({ roughness: 0.6, map: canvasTex(640, 460, g => {
      g.fillStyle = "#f4f6f2"; g.fillRect(0, 0, 640, 460);
      g.strokeStyle = "#1f8a3c"; g.lineWidth = 6; g.strokeRect(24, 24, 592, 412); g.beginPath(); g.moveTo(320, 24); g.lineTo(320, 436); g.stroke();
      g.beginPath(); g.arc(320, 230, 70, 0, Math.PI * 2); g.stroke();
      g.fillStyle = "#c8102e"; g.font = "bold 56px Oswald, Arial"; for (const [x, y] of [[150, 140], [150, 330], [230, 235]]) g.fillText("X", x, y);
      g.fillStyle = "#0b3a8a"; for (const [x, y] of [[450, 140], [450, 330], [400, 235]]) { g.beginPath(); g.arc(x, y - 18, 22, 0, Math.PI * 2); g.lineWidth = 7; g.strokeStyle = "#0b3a8a"; g.stroke(); }
      g.strokeStyle = "#c8102e"; g.lineWidth = 5; g.setLineDash([14, 10]); g.beginPath(); g.moveTo(250, 215); g.quadraticCurveTo(330, 120, 420, 205); g.stroke(); g.setLineDash([]);
      g.fillStyle = "#151515"; g.font = "bold 40px Oswald, Arial"; g.fillText("THE PLAN: T20, T20, D16", 120, 418);
    }) }), wood]);
    boardMesh.position.set(0, 1.35, 0); easel.add(boardMesh);
    const legMat = new THREE.MeshStandardMaterial({ color: 0x2a1a0c, roughness: 0.6 });
    for (const [lx, lz, rz] of [[-0.5, 0.06, 0.1], [0.5, 0.06, -0.1], [0, -0.35, 0]] as const) {
      const legM = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.9, 8), legMat); legM.position.set(lx, 0.92, lz); legM.rotation.z = rz; if (lz < 0) legM.rotation.x = -0.2; easel.add(legM);
    }
    easel.position.set(1.25, 0, -2.3); easel.rotation.y = -0.25; scene.add(easel);
    tag(boardMesh, { title: "The Gaffer's Office", lines: ["Unlocked by being the Gaffer for 3 challenges that were hit.", "Never in the Store."] });
  }

  // Camera: stand at the oche-ish spot and look round the room
  const camera = new THREE.PerspectiveCamera(w / h < 0.8 ? 74 : 54, w / h, 0.1, 50);
  camera.position.set(0, 1.95, 3.3);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 1.75, -1.4); controls.enablePan = false; controls.enableDamping = true; controls.dampingFactor = 0.08;
  controls.minDistance = 2.2; controls.maxDistance = 4.8;
  controls.minPolarAngle = 1.2; controls.maxPolarAngle = 1.72;
  controls.minAzimuthAngle = -0.9; controls.maxAzimuthAngle = 0.9;
  controls.update();

  // Tap to inspect
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  let downAt = 0, downX = 0, downY = 0;
  const onDown = (e: PointerEvent) => { downAt = performance.now(); downX = e.clientX; downY = e.clientY; };
  const onUp = (e: PointerEvent) => {
    if (performance.now() - downAt > 350 || Math.hypot(e.clientX - downX, e.clientY - downY) > 8) return;
    const r = renderer.domElement.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects(pickables, true)[0];
    let o: THREE.Object3D | null = hit?.object ?? null;
    while (o && !o.userData.info) o = o.parent;
    onPick(o ? o.userData.info as ClubInfo : null);
  };
  renderer.domElement.addEventListener("pointerdown", onDown);
  renderer.domElement.addEventListener("pointerup", onUp);

  let frame = 0, disposed = false, t0 = performance.now();
  const loop = () => {
    if (disposed) return;
    const t = (performance.now() - t0) / 1000;
    neonGlow.intensity = 3.6 + Math.sin(t * 3.1) * 0.25 + (Math.random() < 0.01 ? -1.5 : 0);
    controls.update(); renderer.render(scene, camera); frame = requestAnimationFrame(loop);
  };
  loop();
  const onResize = () => { const W2 = el.clientWidth, H2 = el.clientHeight; renderer.setSize(W2, H2); camera.aspect = W2 / H2; camera.updateProjectionMatrix(); };
  window.addEventListener("resize", onResize);

  return () => {
    disposed = true; cancelAnimationFrame(frame); window.removeEventListener("resize", onResize); controls.dispose();
    renderer.domElement.removeEventListener("pointerdown", onDown); renderer.domElement.removeEventListener("pointerup", onUp);
    scene.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh) { m.geometry?.dispose(); for (const mat of ([] as THREE.Material[]).concat(m.material)) { for (const v of Object.values(mat)) if (v instanceof THREE.Texture) v.dispose(); mat.dispose(); } } });
    scene.environment?.dispose(); renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove();
  };
}
