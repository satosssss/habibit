import type { ShareCardModel } from './shareCard';

export const CARD_WIDTH = 1080;
export const CARD_HEIGHT = 1350;

const M = 72;
const PANEL_H = 176;
const PANEL_GAP = 24;

// Share card spec R2: a fixed dark palette, deliberately independent of the
// app theme so the artifact reads the same on every feed. Literals live here
// (not in globals.css) because the canvas is not part of the themed DOM.
const COLORS = {
  bgTop: '#171009',
  bgBottom: '#0c0a08',
  fg: '#fff8f0',
  subtle: 'rgba(255,235,210,0.60)',
  accent: '#f59e0b',
  panel: 'rgba(255,255,255,0.06)',
  panelBorder: 'rgba(255,255,255,0.12)',
  empty: '#2b2119',
  heat: ['#2e2115', '#55350f', '#82500f', '#b06a0d', '#f59e0b'] as const,
};

const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const HEAT_CELL = 15;
const HEAT_GAP = 2;

function roundedPath(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, radius: number,
) {
  const r = Math.min(radius, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function panel(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  roundedPath(ctx, x, y, w, h, 26);
  ctx.fillStyle = COLORS.panel;
  ctx.fill();
  ctx.strokeStyle = COLORS.panelBorder;
  ctx.lineWidth = 2;
  ctx.stroke();
}

function text(
  ctx: CanvasRenderingContext2D,
  value: string, x: number, y: number, size: number, weight: number,
  color: string, align: CanvasTextAlign = 'left',
) {
  ctx.fillStyle = color;
  ctx.font = `${weight} ${size}px ${FONT}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(value, x, y);
}

/**
 * Share card spec R2: draws the whole card onto the supplied context. No DOM
 * access and no async work, so a recording fake can verify the output.
 */
export function drawShareCard(ctx: CanvasRenderingContext2D, model: ShareCardModel) {
  ctx.clearRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

  const bg = ctx.createLinearGradient(0, 0, 0, CARD_HEIGHT);
  bg.addColorStop(0, COLORS.bgTop);
  bg.addColorStop(1, COLORS.bgBottom);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

  const amber = ctx.createRadialGradient(CARD_WIDTH - 120, 60, 0, CARD_WIDTH - 120, 60, 560);
  amber.addColorStop(0, 'rgba(245,158,11,0.20)');
  amber.addColorStop(1, 'rgba(245,158,11,0)');
  ctx.fillStyle = amber;
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

  const teal = ctx.createRadialGradient(60, CARD_HEIGHT - 80, 0, 60, CARD_HEIGHT - 80, 520);
  teal.addColorStop(0, 'rgba(45,212,191,0.10)');
  teal.addColorStop(1, 'rgba(45,212,191,0)');
  ctx.fillStyle = teal;
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

  text(ctx, 'HABIBIT', M, 112, 30, 700, COLORS.subtle);
  text(ctx, 'YEAR IN REVIEW', CARD_WIDTH - M, 112, 22, 600, COLORS.accent, 'right');

  text(ctx, String(model.year), M, 310, 148, 800, COLORS.fg);
  text(ctx, 'A year of showing up.', M, 368, 34, 400, COLORS.subtle);

  const panelW = (CARD_WIDTH - 2 * M - PANEL_GAP) / 2;
  const gridTop = 430;
  const stats = [
    { value: String(model.activeDays), label: 'ACTIVE DAYS' },
    { value: String(model.perfectDays), label: 'PERFECT DAYS' },
    { value: String(model.completions), label: 'COMPLETIONS' },
    { value: `${model.ratePct}%`, label: 'COMPLETION RATE' },
  ];
  stats.forEach((stat, i) => {
    const x = M + (i % 2) * (panelW + PANEL_GAP);
    const y = gridTop + Math.floor(i / 2) * (PANEL_H + PANEL_GAP);
    panel(ctx, x, y, panelW, PANEL_H);
    text(ctx, stat.value, x + 28, y + 96, 58, 800, COLORS.fg);
    text(ctx, stat.label, x + 28, y + 146, 20, 600, COLORS.subtle);
  });

  const bandTop = 846;
  panel(ctx, M, bandTop, CARD_WIDTH - 2 * M, 120);
  text(ctx, 'LONGEST STREAK', M + 32, bandTop + 48, 20, 600, COLORS.subtle);
  text(ctx, `${model.longestStreak} days`, M + 32, bandTop + 96, 44, 800, COLORS.fg);
  text(ctx, `${model.earnedBadges} / ${model.totalBadges} badges`,
    CARD_WIDTH - M - 32, bandTop + 72, 26, 600, COLORS.accent, 'right');

  const columns = Math.ceil(model.cells.length / 7);
  const gridW = columns * HEAT_CELL + (columns - 1) * HEAT_GAP;
  // The grid is centred in the margins; the section label follows it so the
  // left edge of the label and the first column line up.
  const startX = M + (CARD_WIDTH - 2 * M - gridW) / 2;
  const startY = 1092;

  text(ctx, 'THE YEAR, DAY BY DAY', startX, 1032, 20, 600, COLORS.subtle);

  ctx.fillStyle = COLORS.subtle;
  ctx.font = `600 16px ${FONT}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  for (const month of model.months) {
    if (month.column >= columns) continue;
    ctx.fillText(month.label, startX + month.column * (HEAT_CELL + HEAT_GAP), 1078);
  }

  model.cells.forEach((cell, i) => {
    if (!cell.inYear) return;   // padding days around Jan 1 / Dec 31 stay blank
    const x = startX + Math.floor(i / 7) * (HEAT_CELL + HEAT_GAP);
    const y = startY + (i % 7) * (HEAT_CELL + HEAT_GAP);
    ctx.fillStyle = cell.level === 0 ? COLORS.empty : COLORS.heat[cell.level];
    roundedPath(ctx, x, y, HEAT_CELL, HEAT_CELL, 3);
    ctx.fill();
  });

  text(ctx, 'Made with Habibit', CARD_WIDTH / 2, 1290, 22, 500, COLORS.subtle, 'center');
}

/** Builds the fixed-size canvas and draws the card. */
export async function renderShareCard(
  model: ShareCardModel,
  doc: Document = document,
): Promise<HTMLCanvasElement> {
  const canvas = doc.createElement('canvas');
  canvas.width = CARD_WIDTH;
  canvas.height = CARD_HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error("This browser can't create the image.");
  // Web fonts are not used, but awaiting readiness keeps text from drawing with
  // a fallback face on the first open.
  await doc.fonts?.ready;
  drawShareCard(ctx, model);
  return canvas;
}

/** PNG blob for sharing/downloading; rejects when the browser yields nothing. */
export function shareCardBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("This browser can't create the image."));
    }, 'image/png');
  });
}
