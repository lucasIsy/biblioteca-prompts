import { describe, it, expect } from "vitest";
import { step, visibleWindow } from "../src/domain/navigation";

describe("step", () => {
  it("wrap", () => {
    expect(step(2, 5, 1, "wrap")).toBe(3);
    expect(step(4, 5, 1, "wrap")).toBe(0);
    expect(step(0, 5, -1, "wrap")).toBe(4);
    expect(step(0, 5, -12, "wrap")).toBe(3);
  });
  it("clamp", () => {
    expect(step(4, 5, 1, "clamp")).toBe(4);
    expect(step(0, 5, -1, "clamp")).toBe(0);
    expect(step(1, 5, 2, "clamp")).toBe(3);
  });
  it("lista vazia → -1; 1 item", () => {
    expect(step(0, 0, 1, "wrap")).toBe(-1);
    expect(step(0, 0, 1, "clamp")).toBe(-1);
    expect(step(0, 1, 1, "wrap")).toBe(0);
    expect(step(0, 1, -1, "clamp")).toBe(0);
  });
});

describe("visibleWindow", () => {
  it("meio da lista", () => {
    expect(visibleWindow(5, 20, 2)).toEqual([3, 4, 5, 6, 7]);
  });
  it("bordas dão a volta", () => {
    expect(visibleWindow(0, 10, 2)).toEqual([8, 9, 0, 1, 2]);
    expect(visibleWindow(9, 10, 2)).toEqual([7, 8, 9, 0, 1]);
  });
  it("lista curta não repete; vazia → []", () => {
    expect(visibleWindow(0, 3, 6).sort()).toEqual([0, 1, 2]);
    expect(visibleWindow(0, 1, 6)).toEqual([0]);
    expect(visibleWindow(0, 0, 6)).toEqual([]);
  });
});

import { cardSize, carouselRadius, carouselStep, cardBrightness, cardOpacity, relativeAngle, ringSlots, shortestDelta, springSettled, springStep, wheelSteps } from "../src/domain/navigation";

describe("geometria do carrossel", () => {
  it("passo mínimo de 11 cartas", () => {
    expect(carouselStep(4)).toBeCloseTo(360 / 11);
    expect(carouselStep(30)).toBe(12);
    expect(carouselRadius(30)).toBeGreaterThan(carouselRadius(11) - 1);
  });
  it("ângulo relativo é normalizado e frente = 0", () => {
    expect(relativeAngle(5, 5, 12)).toBe(0);
    expect(relativeAngle(0, 11, 12)).toBeCloseTo(30);
    expect(Math.abs(relativeAngle(6, 0, 12))).toBeCloseTo(180);
  });
  it("opacidade e brilho", () => {
    expect(cardOpacity(0)).toBe(1);
    expect(cardOpacity(120)).toBe(0);
    expect(cardBrightness(180)).toBe(0.3);
  });
  it("ringSlots: com poucos prompts, cada um fica na posição mais próxima da frente", () => {
    expect(ringSlots(0, 1, 6)).toEqual([{ k: 0, i: 0 }]);
    expect(ringSlots(0, 3, 6)).toEqual([{ k: 0, i: 0 }, { k: -1, i: 2 }, { k: 1, i: 1 }]);
    expect(ringSlots(5, 0, 6)).toEqual([]);
    expect(ringSlots(0, 20, 6)).toHaveLength(13);
  });
  it("caminho mais curto", () => {
    expect(shortestDelta(0, 11, 12)).toBe(-1);
    expect(shortestDelta(13, 2, 12)).toBe(1);
    expect(shortestDelta(3, 3, 12)).toBe(0);
  });
});


describe("mola do giro", () => {
  const run = (target: number, seconds: number, dt = 1 / 60) => {
    let s = { pos: 0, vel: 0 };
    const vels: number[] = [];
    for (let t = 0; t < seconds; t += dt) { s = springStep(s.pos, s.vel, target, dt); vels.push(s.vel); }
    return { s, vels };
  };
  it("chega ao alvo sem passar dele", () => {
    let s = { pos: 0, vel: 0 }, max = 0;
    for (let i = 0; i < 300; i++) { s = springStep(s.pos, s.vel, 1, 1 / 60); max = Math.max(max, s.pos); }
    expect(max).toBeLessThanOrEqual(1);
    expect(springSettled(s.pos, s.vel, 1)).toBe(true);
  });
  it("pico de velocidade ~0,31 s, como no vídeo", () => {
    const { vels } = run(1, 2);
    const peak = vels.indexOf(Math.max(...vels)) / 60;
    expect(peak).toBeGreaterThan(0.27);
    expect(peak).toBeLessThan(0.36);
  });
  it("dt grande não explode", () => {
    const s = springStep(0, 0, 5, 1);
    expect(s.pos).toBeGreaterThan(0);
    expect(s.pos).toBeLessThan(5);
  });
});

describe("wheelSteps", () => {
  it("um dente de mouse = 1 carta", () => {
    expect(wheelSteps(0, 100)).toEqual({ steps: 1, accum: 0 });
    expect(wheelSteps(0, -100)).toEqual({ steps: -1, accum: 0 });
  });
  it("touchpad acumula deltas pequenos", () => {
    let a = 0, steps = 0;
    for (let i = 0; i < 10; i++) { const r = wheelSteps(a, 25); a = r.accum; steps += r.steps; }
    expect(steps).toBe(2);
    expect(a).toBe(50);
  });
  it("modo linha", () => {
    expect(wheelSteps(0, 3, 1).steps).toBe(0);
    expect(wheelSteps(0, 4, 1).steps).toBe(1);
  });
});

describe("tamanho da carta", () => {
  it("acompanha a altura da janela entre 300 e 520 px", () => {
    expect(cardSize(800)).toEqual({ width: 338, height: 470 });
    expect(cardSize(500).height).toBe(300);
    expect(cardSize(1400).height).toBe(520);
  });
  it("raio escala com a largura da carta", () => {
    expect(carouselRadius(12, 500)).toBeCloseTo(carouselRadius(12) * 2);
  });
});
