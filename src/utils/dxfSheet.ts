/**
 * Mise en page de feuille pour l'export DXF : cadre ISO 5457, cartouche ISO 7200, tableau des coordonnées,
 * flèche nord et échelle graphique.
 *
 * Principe : le dessin reste en mètres, à sa place (les coordonnées UTM restent exploitables). C'est la FEUILLE qui est
 * positionnée autour de la parcelle, en unités du modèle : 1 mm papier = (dénominateur / 1000) m. Tracée à l'échelle 1:1
 * depuis le modèle de l'application de CAO, elle sort donc à la bonne échelle sur le format choisi.
 */

/** Le format DXF R12 est ASCII : translittération des accents et symboles. */
export const dxfAscii = (v: string): string =>
  v
    .replace(/\u00B0/g, 'o') // degré : « n° » -> « no »
    .replace(/[\u2010-\u2015\u2212]/g, '-') // tirets
    .replace(/[\u2018\u2019\u201A]/g, "'")
    .replace(/[\u201C\u201D\u00AB\u00BB]/g, '"')
    .replace(/\u2026/g, '...')
    .replace(/\u00D7/g, 'x')
    .replace(/\u0153/g, 'oe')
    .replace(/\u0152/g, 'OE')
    .normalize('NFKD')
    .replace(/[\u0300-\u036F]/g, '') // accents
    .replace(/[^\x20-\x7E]/g, '?');

/** Style de texte du dessin : Arial Narrow (arialn.ttf). */
export const TEXT_STYLE = 'ARIAL_NARROW';

export type SheetFormatName = 'A4' | 'A3' | 'A2' | 'A1' | 'A0';

export interface SheetFormat {
  name: SheetFormatName;
  w: number; // mm, paysage
  h: number;
}

export const SHEET_FORMATS: SheetFormat[] = [
  { name: 'A4', w: 297, h: 210 },
  { name: 'A3', w: 420, h: 297 },
  { name: 'A2', w: 594, h: 420 },
  { name: 'A1', w: 841, h: 594 },
  { name: 'A0', w: 1189, h: 841 },
];

/** Échelles normalisées (ISO 5455) complétées des échelles usuelles du cadastre (1:25, 1:250, 1:2500). */
export const STANDARD_SCALES = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 2500, 5000, 10000, 20000, 25000, 50000, 100000];

export const TB_W = 180; // largeur maximale du cartouche (ISO 7200)
export const TB_H = 62;
const PAD = 14; // marge de respiration autour du dessin (mm papier)
const MAX_AUTO_DEN = 500; // au-delà, on préfère passer au format supérieur

export interface BBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface SheetLayout {
  format: SheetFormat;
  scaleDen: number;
  /** mètres de modèle par millimètre papier */
  k: number;
  /** cadre (mm papier, origine = coin inférieur gauche de la feuille) */
  frame: { x0: number; y0: number; x1: number; y1: number };
  /** zone de dessin (au-dessus de la bande cartouche / tableau) */
  zone: { x0: number; y0: number; x1: number; y1: number };
  /** position du coin inférieur gauche de la feuille dans le repère du modèle (m) */
  origin: { x: number; y: number };
}

export function frameInsets(f: SheetFormat): { left: number; other: number } {
  // ISO 5457 : marge de classement de 20 mm à gauche ; bordure de 10 mm (A4–A2) ou 20 mm (A1–A0)
  return { left: 20, other: f.name === 'A0' || f.name === 'A1' ? 20 : 10 };
}

function frameOf(f: SheetFormat) {
  const { left, other } = frameInsets(f);
  return { x0: left, y0: other, x1: f.w - other, y1: f.h - other };
}

function fits(f: SheetFormat, den: number, bw: number, bh: number): boolean {
  const fr = frameOf(f);
  const k = den / 1000;
  const zw = fr.x1 - fr.x0 - 2 * PAD;
  const zh = fr.y1 - fr.y0 - TB_H - 2 * PAD;
  return bw / k <= zw && bh / k <= zh;
}

export function chooseLayout(
  bbox: BBox,
  request: { format?: SheetFormatName | 'auto'; scale?: number | 'auto' } = {}
): SheetLayout {
  const bw = Math.max(bbox.maxX - bbox.minX, 1);
  const bh = Math.max(bbox.maxY - bbox.minY, 1);
  const wantFormat = request.format && request.format !== 'auto' ? SHEET_FORMATS.find((f) => f.name === request.format) : undefined;
  const wantScale = typeof request.scale === 'number' ? request.scale : undefined;

  const bestScaleFor = (f: SheetFormat) => STANDARD_SCALES.find((d) => fits(f, d, bw, bh));

  let format: SheetFormat;
  let den: number;
  if (wantFormat && wantScale) {
    format = wantFormat;
    den = wantScale;
  } else if (wantFormat) {
    format = wantFormat;
    den = bestScaleFor(format) ?? STANDARD_SCALES[STANDARD_SCALES.length - 1];
  } else if (wantScale) {
    den = wantScale;
    format = SHEET_FORMATS.find((f) => fits(f, den, bw, bh)) ?? SHEET_FORMATS[SHEET_FORMATS.length - 1];
  } else {
    format = SHEET_FORMATS[SHEET_FORMATS.length - 1];
    den = bestScaleFor(format) ?? STANDARD_SCALES[STANDARD_SCALES.length - 1];
    for (const f of SHEET_FORMATS) {
      const d = bestScaleFor(f);
      if (d !== undefined && d <= MAX_AUTO_DEN) {
        format = f;
        den = d;
        break;
      }
    }
  }

  const k = den / 1000;
  const frame = frameOf(format);
  const zone = { x0: frame.x0, y0: frame.y0 + TB_H, x1: frame.x1, y1: frame.y1 };
  const cxp = (zone.x0 + zone.x1) / 2;
  const cyp = (zone.y0 + zone.y1) / 2;
  const cx = (bbox.minX + bbox.maxX) / 2;
  const cy = (bbox.minY + bbox.maxY) / 2;
  return { format, scaleDen: den, k, frame, zone, origin: { x: cx - cxp * k, y: cy - cyp * k } };
}

// ---------------------------------------------------------------------------------------------------------------------
// Contenu du cartouche

export interface SheetInfo {
  title: string;
  client: string;
  location: string;
  planNumber: string;
  cadastralRef: string;
  areaText: string; // ex. "1525.50 m2  (15 a 25.50 ca)"
  systemText: string;
  drawnBy: string;
  checkedBy: string;
  date: string;
  revision: string;
  appVersion: string;
  coordHeaders: [string, string]; // ["X (m)", "Y (m)"] ou ["E (m)", "N (m)"]
  points: { name: string; x: number; y: number }[]; // coordonnées de dessin
}

export const SHEET_LAYERS: { name: string; color: number }[] = [
  { name: 'CADRE', color: 7 },
  { name: 'CARTOUCHE', color: 7 },
  { name: 'CARTOUCHE_TEXTE', color: 7 },
  { name: 'CARTOUCHE_LOGO', color: 5 },
  { name: 'GRILLE_REPERES', color: 8 },
  { name: 'TABLEAU_COORDONNEES', color: 7 },
  { name: 'ORIENTATION_ECHELLE', color: 7 },
];

type Emit = (code: number | string, val: number | string) => void;

/** Longueur « ronde » de l'échelle graphique. */
function niceLength(maxMeters: number): number {
  const steps = [0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 5000, 10000];
  let best = steps[0];
  for (const s of steps) if (s <= maxMeters) best = s;
  return best;
}

/** Estimation prudente de la largeur d'un texte (police STANDARD). */
const textWidth = (s: string, h: number) => s.length * h * 0.5;

function fitText(s: string, cellW: number, h: number, minH: number): { s: string; h: number } {
  let hh = h;
  while (hh > minH && textWidth(s, hh) > cellW) hh = Math.max(minH, +(hh - 0.5).toFixed(2));
  if (textWidth(s, hh) <= cellW) return { s, h: hh };
  const maxChars = Math.max(1, Math.floor(cellW / (hh * 0.5)) - 2);
  return { s: s.slice(0, maxChars) + '..', h: hh };
}

/** Émet toutes les entités de la feuille (cadre, cartouche, tableau, flèche nord, échelle graphique). */
export function emitSheet(emit: Emit, layout: SheetLayout, info: SheetInfo): void {
  const { k, origin, frame, zone, format } = layout;
  const X = (px: number) => (origin.x + px * k).toFixed(4);
  const Y = (py: number) => (origin.y + py * k).toFixed(4);
  const H = (mm: number) => (mm * k).toFixed(4);

  const polyline = (layer: string, pts: [number, number][], closed: boolean, widthMm = 0) => {
    emit(0, 'POLYLINE');
    emit(8, layer);
    emit(66, 1);
    emit(70, closed ? 1 : 0);
    if (widthMm > 0) {
      emit(40, H(widthMm));
      emit(41, H(widthMm));
    }
    for (const [px, py] of pts) {
      emit(0, 'VERTEX');
      emit(8, layer);
      emit(10, X(px));
      emit(20, Y(py));
      emit(30, 0);
    }
    emit(0, 'SEQEND');
    emit(8, layer);
  };
  const rect = (layer: string, x0: number, y0: number, x1: number, y1: number, w = 0) =>
    polyline(layer, [[x0, y0], [x1, y0], [x1, y1], [x0, y1]], true, w);
  const line = (layer: string, x0: number, y0: number, x1: number, y1: number, w = 0) => polyline(layer, [[x0, y0], [x1, y1]], false, w);
  const text = (layer: string, s: string, px: number, py: number, hMm: number, align: 'l' | 'c' | 'r' = 'l') => {
    if (!s) return;
    emit(0, 'TEXT');
    emit(8, layer);
    emit(10, X(px));
    emit(20, Y(py));
    emit(30, 0);
    emit(40, H(hMm));
    emit(1, s);
    if (align !== 'l') {
      emit(72, align === 'c' ? 1 : 2);
      emit(11, X(px));
      emit(21, Y(py));
      emit(31, 0);
    }
  };
  const circle = (layer: string, px: number, py: number, rMm: number) => {
    emit(0, 'CIRCLE');
    emit(8, layer);
    emit(10, X(px));
    emit(20, Y(py));
    emit(30, 0);
    emit(40, H(rMm));
  };

  // 1. Feuille, cadre, repères de centrage et de zones (ISO 5457)
  rect('CADRE', 0, 0, format.w, format.h, 0);
  rect('CADRE', frame.x0, frame.y0, frame.x1, frame.y1, 0.7);
  const midX = (frame.x0 + frame.x1) / 2;
  const midY = (frame.y0 + frame.y1) / 2;
  line('CADRE', midX, 0, midX, frame.y0 + 5, 0.5);
  line('CADRE', midX, format.h, midX, frame.y1 - 5, 0.5);
  line('CADRE', 0, midY, frame.x0 + 5, midY, 0.5);
  line('CADRE', format.w, midY, frame.x1 - 5, midY, 0.5);

  const nx = 2 * Math.max(1, Math.round((frame.x1 - frame.x0) / 100));
  const ny = 2 * Math.max(1, Math.round((frame.y1 - frame.y0) / 100));
  const zw = (frame.x1 - frame.x0) / nx;
  const zh = (frame.y1 - frame.y0) / ny;
  const { left, other } = frameInsets(format);
  for (let i = 0; i <= nx; i++) {
    const x = frame.x0 + i * zw;
    if (i > 0 && i < nx) {
      line('GRILLE_REPERES', x, frame.y0, x, frame.y0 - 5);
      line('GRILLE_REPERES', x, frame.y1, x, frame.y1 + 5);
    }
    if (i < nx) {
      text('GRILLE_REPERES', String(i + 1), x + zw / 2, frame.y1 + other / 2 - 1.75, 3.5, 'c');
      text('GRILLE_REPERES', String(i + 1), x + zw / 2, frame.y0 - other / 2 - 1.75, 3.5, 'c');
    }
  }
  for (let j = 0; j < ny; j++) {
    const y = frame.y1 - j * zh; // lettres de haut en bas
    if (j > 0) {
      line('GRILLE_REPERES', frame.x0, y, frame.x0 - 5, y);
      line('GRILLE_REPERES', frame.x1, y, frame.x1 + 5, y);
    }
    const letter = String.fromCharCode(65 + (j % 26));
    text('GRILLE_REPERES', letter, frame.x0 - left / 2, y - zh / 2 - 1.75, 3.5, 'c');
    text('GRILLE_REPERES', letter, frame.x1 + other / 2, y - zh / 2 - 1.75, 3.5, 'c');
  }

  // 2. Cartouche (ISO 7200), collé en bas à droite du cadre
  const tx0 = frame.x1 - TB_W;
  const ty0 = frame.y0;
  const rows = { r5: [0, 6], r4: [6, 18], r3: [18, 30], r2: [30, 42], r1: [42, 62] } as const;
  const ry = (r: readonly [number, number]) => [ty0 + r[0], ty0 + r[1]] as const;

  rect('CARTOUCHE', tx0, ty0, frame.x1, ty0 + TB_H, 0.7);
  for (const r of [rows.r5, rows.r4, rows.r3, rows.r2]) line('CARTOUCHE', tx0, ty0 + r[1], frame.x1, ty0 + r[1], 0.35);

  const cell = (r: readonly [number, number], xa: number, xb: number, label: string, value: string, vh = 3.5) => {
    const [yb, yt] = ry(r);
    text('CARTOUCHE_TEXTE', label, tx0 + xa + 1, yt - 2.8, 1.8);
    const f = fitText(value, xb - xa - 3, vh, 2.2);
    text('CARTOUCHE_TEXTE', f.s, tx0 + xa + 1.5, yb + 2.2, f.h);
  };
  const vsep = (r: readonly [number, number], xs: number[]) => {
    const [yb, yt] = ry(r);
    for (const x of xs) line('CARTOUCHE', tx0 + x, yb, tx0 + x, yt, 0.35);
  };

  // Ligne 1 : logo SEL + titre
  {
    const [yb, yt] = ry(rows.r1);
    vsep(rows.r1, [64]);
    const cx = tx0 + 11;
    const cy = (yb + yt) / 2;
    const s = 0.36;
    const hex: [number, number][] = [[24, 4], [44, 14], [44, 34], [24, 44], [4, 34], [4, 14]].map(([a, b]) => [cx + (a - 24) * s, cy - (b - 24) * s]);
    polyline('CARTOUCHE_LOGO', hex, true, 0.5);
    line('CARTOUCHE_LOGO', cx + (4 - 24) * s, cy - (14 - 24) * s, cx + (44 - 24) * s, cy - (34 - 24) * s);
    line('CARTOUCHE_LOGO', cx + (4 - 24) * s, cy - (34 - 24) * s, cx + (44 - 24) * s, cy - (14 - 24) * s);
    line('CARTOUCHE_LOGO', cx, cy + 20 * s, cx, cy - 20 * s);
    rect('CARTOUCHE_LOGO', cx - 8 * s, cy - 6 * s, cx + 8 * s, cy + 6 * s, 0.25);
    text('CARTOUCHE_LOGO', 'S.E.L.', cx, cy - 1.0, 2.2, 'c');
    text('CARTOUCHE_TEXTE', 'STRUCTURAL &', tx0 + 22, cy + 1.2, 4.2);
    text('CARTOUCHE_TEXTE', 'ENGINEERING LABS', tx0 + 22, cy - 4.2, 2.4);

    text('CARTOUCHE_TEXTE', 'TITRE DU PLAN', tx0 + 65.5, yt - 2.8, 1.8);
    const t = fitText(info.title, TB_W - 64 - 3, 7, 3.5);
    text('CARTOUCHE_TEXTE', t.s, tx0 + 66, yb + 8.5, t.h);
    text('CARTOUCHE_TEXTE', 'Plan de releve et de bornage de parcelle', tx0 + 66, yb + 3.2, 2.5);
  }
  // Ligne 2
  cell(rows.r2, 0, 70, 'MAITRE D\'OUVRAGE / PROPRIETAIRE', info.client);
  cell(rows.r2, 70, 135, 'LOCALISATION', info.location);
  cell(rows.r2, 135, 180, 'NUMERO DE PLAN', info.planNumber);
  vsep(rows.r2, [70, 135]);
  // Ligne 3
  cell(rows.r3, 0, 60, 'REFERENCE CADASTRALE', info.cadastralRef);
  cell(rows.r3, 60, 115, 'SUPERFICIE', info.areaText);
  cell(rows.r3, 115, 180, 'SYSTEME DE COORDONNEES', info.systemText, 3);
  vsep(rows.r3, [60, 115]);
  // Ligne 4
  cell(rows.r4, 0, 40, 'DESSINE PAR', info.drawnBy);
  cell(rows.r4, 40, 80, 'VERIFIE PAR', info.checkedBy);
  cell(rows.r4, 80, 110, 'DATE', info.date);
  cell(rows.r4, 110, 135, 'ECHELLE', `1:${layout.scaleDen}`);
  cell(rows.r4, 135, 150, 'FORMAT', format.name);
  cell(rows.r4, 150, 165, 'INDICE', info.revision);
  cell(rows.r4, 165, 180, 'FEUILLE', '1/1');
  vsep(rows.r4, [40, 80, 110, 135, 150, 165]);
  // Ligne 5 : mentions
  {
    const [yb] = ry(rows.r5);
    const note = `Arpentis v${info.appVersion} - unites : metres - surface par la formule de Gauss, controle de Heron - sans valeur legale sans visa d'un geometre assermente`;
    const f = fitText(note, TB_W - 3, 1.8, 1.5);
    text('CARTOUCHE_TEXTE', f.s, tx0 + 1.5, yb + 2.1, f.h);
  }

  // 3. Tableau des coordonnées (à gauche du cartouche, même bande)
  {
    const BW = 76;
    const colW = [22, 27, 27];
    const rowH = 4;
    const headH = 6;
    const perBlock = Math.floor((TB_H - headH) / rowH) - 1;
    let blocks = 0;
    while (tx0 - 2 - (blocks + 1) * BW - blocks * 2 >= frame.x0) blocks++;
    const cap = blocks * perBlock;
    for (let b = 0; b < blocks; b++) {
      const bx1 = tx0 - 2 - b * (BW + 2);
      const bx0 = bx1 - BW;
      const by0 = ty0;
      const by1 = ty0 + TB_H;
      const slice = info.points.slice(b * perBlock, (b + 1) * perBlock);
      if (slice.length === 0) continue;
      const bodyH = headH + slice.length * rowH + (b === blocks - 1 && info.points.length > cap ? rowH : 0);
      const top = by0 + Math.min(TB_H, bodyH);
      rect('TABLEAU_COORDONNEES', bx0, by0, bx1, top, 0.35);
      line('TABLEAU_COORDONNEES', bx0, top - headH, bx1, top - headH, 0.35);
      let cx = bx0;
      const heads = ['BORNE', info.coordHeaders[0], info.coordHeaders[1]];
      colW.forEach((w, i) => {
        if (i > 0) line('TABLEAU_COORDONNEES', cx, by0, cx, top, 0.25);
        text('TABLEAU_COORDONNEES', heads[i], cx + 1, top - headH + 1.8, 2.5);
        cx += w;
      });
      slice.forEach((p, r) => {
        const y = top - headH - (r + 1) * rowH + 1.2;
        const nm = fitText(p.name, colW[0] - 2, 2.5, 1.8);
        text('TABLEAU_COORDONNEES', nm.s, bx0 + 1, y, nm.h);
        text('TABLEAU_COORDONNEES', p.x.toFixed(2), bx0 + colW[0] + colW[1] - 1.5, y, 2.5, 'r');
        text('TABLEAU_COORDONNEES', p.y.toFixed(2), bx1 - 1.5, y, 2.5, 'r');
      });
      if (b === blocks - 1 && info.points.length > cap) {
        text('TABLEAU_COORDONNEES', `... + ${info.points.length - cap} bornes (voir export CSV)`, bx0 + 1, top - headH - (slice.length + 1) * rowH + 1.2, 2);
      }
    }
  }

  // 4. Flèche nord (coin supérieur droit de la zone de dessin)
  {
    const nxp = zone.x1 - 16;
    const nyp = zone.y1 - 20;
    circle('ORIENTATION_ECHELLE', nxp, nyp, 8);
    polyline('ORIENTATION_ECHELLE', [[nxp, nyp + 11], [nxp - 3, nyp - 6], [nxp, nyp - 3], [nxp + 3, nyp - 6]], true, 0.35);
    text('ORIENTATION_ECHELLE', 'N', nxp, nyp + 12.5, 3.5, 'c');
  }

  // 5. Échelle graphique (coin inférieur gauche de la zone de dessin)
  {
    const L = niceLength(60 * k); // ≤ 60 mm sur le papier
    const Lmm = L / k;
    const x0 = zone.x0 + 10;
    const y0 = zone.y0 + 10;
    rect('ORIENTATION_ECHELLE', x0, y0, x0 + Lmm, y0 + 2, 0.25);
    line('ORIENTATION_ECHELLE', x0 + Lmm / 2, y0, x0 + Lmm / 2, y0 + 2, 0.25);
    const fmt = (m: number) => (Number.isInteger(m) ? String(m) : m.toFixed(1));
    text('ORIENTATION_ECHELLE', '0', x0, y0 + 3, 2.5, 'c');
    text('ORIENTATION_ECHELLE', fmt(L / 2), x0 + Lmm / 2, y0 + 3, 2.5, 'c');
    text('ORIENTATION_ECHELLE', `${fmt(L)} m`, x0 + Lmm, y0 + 3, 2.5, 'c');
    text('ORIENTATION_ECHELLE', `Echelle graphique - 1:${layout.scaleDen}`, x0, y0 - 4, 2.5);
  }
}
