import { beforeEach, describe, expect, it } from 'vitest';
import { shareCardModel } from './shareCard';
import {
  CARD_HEIGHT, CARD_WIDTH, drawShareCard, renderShareCard, shareCardBlob,
} from './shareCardCanvas';

const model = shareCardModel({ habits: [], entries: [], badges: [], year: 2026, today: '2026-11-04' });

let textCalls: { text: string; x: number; y: number; font: string; fill: string }[] = [];
let pathCount = 0;

function fakeCtx(): CanvasRenderingContext2D {
  const ctx = {
    font: '', fillStyle: '', strokeStyle: '', lineWidth: 0,
    textAlign: 'left', textBaseline: 'alphabetic',
    clearRect() {},
    fillRect() {},
    createLinearGradient() { return { addColorStop() {} }; },
    createRadialGradient() { return { addColorStop() {} }; },
    beginPath() { pathCount++; },
    moveTo() {}, lineTo() {}, quadraticCurveTo() {}, closePath() {},
    fill() {}, stroke() {},
    fillText(value: string, x: number, y: number) {
      textCalls.push({ text: value, x, y, font: ctx.font, fill: ctx.fillStyle });
    },
  };
  return ctx as unknown as CanvasRenderingContext2D;
}

beforeEach(() => { textCalls = []; pathCount = 0; });

describe('drawShareCard (R2)', () => {
  it('draws the summary labels and values', () => {
    drawShareCard(fakeCtx(), model);
    const labels = textCalls.map((call) => call.text);
    expect(labels).toContain('2026');
    expect(labels).toContain('ACTIVE DAYS');
    expect(labels).toContain('PERFECT DAYS');
    expect(labels).toContain('COMPLETIONS');
    expect(labels).toContain('COMPLETION RATE');
    expect(labels).toContain('LONGEST STREAK');
    expect(labels).toContain('0 / 16 badges');
    expect(labels).toContain('Made with Habibit');
  });

  it('draws one rounded shape per panel and in-year heat cell only', () => {
    drawShareCard(fakeCtx(), model);
    const inYear = model.cells.filter((cell) => cell.inYear).length;
    // 4 stat panels + 1 streak band + one shape per in-year day.
    expect(pathCount).toBe(5 + inYear);
    expect(inYear).toBeLessThan(model.cells.length);   // grid padding is skipped
  });
});

describe('renderShareCard (R2)', () => {
  it('creates a 1080 × 1350 canvas and draws into it', async () => {
    const canvas = {
      width: 0, height: 0,
      getContext: () => fakeCtx(),
    } as unknown as HTMLCanvasElement;
    const doc = {
      createElement: () => canvas,
      fonts: { ready: Promise.resolve() },
    } as unknown as Document;

    const result = await renderShareCard(model, doc);
    expect(result).toBe(canvas);
    expect(canvas.width).toBe(CARD_WIDTH);
    expect(canvas.height).toBe(CARD_HEIGHT);
    expect(textCalls.map((call) => call.text)).toContain('2026');
  });

  it('fails loudly when the browser has no 2D context', async () => {
    const doc = {
      createElement: () => ({ width: 0, height: 0, getContext: () => null }),
      fonts: { ready: Promise.resolve() },
    } as unknown as Document;
    await expect(renderShareCard(model, doc)).rejects.toThrow("can't create the image");
  });
});

describe('shareCardBlob (R2)', () => {
  it('resolves with the PNG blob', async () => {
    const canvas = {
      toBlob: (cb: (blob: Blob | null) => void) =>
        cb(new Blob(['png'], { type: 'image/png' })),
    } as unknown as HTMLCanvasElement;
    await expect(shareCardBlob(canvas)).resolves.toBeInstanceOf(Blob);
  });

  it('rejects when the browser yields no blob', async () => {
    const canvas = {
      toBlob: (cb: (blob: Blob | null) => void) => cb(null),
    } as unknown as HTMLCanvasElement;
    await expect(shareCardBlob(canvas)).rejects.toThrow("can't create the image");
  });
});
