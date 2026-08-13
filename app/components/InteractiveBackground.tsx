"use client";

import { useEffect, useRef } from "react";

/* ── 원근 그리드 ─────────────────────────────────────────────── */
/** 수평선의 화면 세로 위치 비율. */
const HORIZON_RATIO = 0.33;
/** 가장 가까운 열이 화면 아래로 넘어가는 여유(px). */
const BOTTOM_OVERSCAN = 70;
/** 한 열 뒤로 갈 때 수평선까지의 거리가 줄어드는 비율. 원근 수축을 만든다.
 *  1에 가까울수록 화면 앞쪽까지 열이 촘촘하게 들어찬다. */
const ROW_SHRINK = 1.05;
/** 수평선에서 이보다 가까워지면 열 생성을 멈춘다(px).
 *  이 부근의 열은 점이 픽셀 단위로 뭉쳐 모아레만 만들고 비용은 가장 크다. */
const D_MIN = 44;
/** 수평선까지의 거리 대비 가로 간격 비율. 셀이 대략 정사각형이 되도록 맞춘다. */
const X_TO_Y = 0.042;
/** 먼 열이 과도하게 촘촘해지지 않도록 하는 최소 화면 간격(px). */
const MIN_STEP_PX = 6.5;

/* ── 파도 ────────────────────────────────────────────────────── */
/** 기본 파도의 위상 진행 속도(rad/s). 아주 느린 물결을 만든다. */
const BASE_SPEED = 0.26;
/** 완전히 여기된 점에 더해지는 위상 속도(rad/s). '휘리릭' 구간의 빠르기. */
const SPEED_BOOST = 5.4;
/** 수평선까지의 거리 대비 파도 진폭 비율. 가까운 점일수록 크게 출렁인다. */
const AMP_RATIO = 0.045;
/** 완전히 여기된 점의 진폭 배수. */
const AMP_BOOST = 3.4;
/** 파도의 공간 주파수. 단위는 '격자 한 칸'이라 값이 곧 이웃한 점 사이의 위상차다.
 *  작게 둘수록 파장이 길어져 인접한 점의 높이 차이가 줄고 하나의 면처럼 이어진다. */
const FREQ_X = 0.11;
const FREQ_Z = 0.1;

/* ── 마우스 여기(excitation) ──────────────────────────────────── */
/** 커서가 점을 흔드는 화면상 반경(px). */
const HOVER_RADIUS = 150;
/** 여기 상태가 1/e 로 잦아드는 시간(초). 커서가 지나간 뒤 되돌아가는 속도. */
const EXCITE_TAU = 0.62;
/** 이 값을 넘는 점은 조금 크고 진하게 강조한다. */
const EXCITE_HIGHLIGHT = 0.16;

/* ── 클릭 파티클 ─────────────────────────────────────────────── */
const PARTICLE_MIN = 3;
const PARTICLE_MAX = 5;
/** 파티클에 적용되는 중력(px/s²). */
const GRAVITY = 1150;
/** 동시에 살아 있을 수 있는 파티클 수 상한. */
const MAX_PARTICLES = 90;

/* ── 렌더링 ──────────────────────────────────────────────────── */
/** 점 색상(흑백). */
const DOT_RGB = "23, 23, 23";
/** 레티나에서 과도한 픽셀 처리를 막기 위한 DPR 상한. */
const MAX_DPR = 2;
/** 탭 복귀 등으로 프레임 간격이 튀었을 때의 상한(초). */
const MAX_DELTA = 0.05;

const TAU = Math.PI * 2;

/** 깊이가 같은 점들의 묶음. 원근 계산이 동일하므로 한 번에 그릴 수 있다. */
type Row = {
  /** 파도 높이가 0일 때의 화면 세로 위치. */
  baseY: number;
  /** 이웃한 점 사이의 화면 가로 간격. */
  stepX: number;
  /** 첫 번째 점의 화면 가로 위치. */
  firstX: number;
  /** 이 열의 파도 진폭(px). */
  amp: number;
  radius: number;
  alpha: number;
  /** 화면 x 좌표(미리 계산). */
  xs: Float32Array;
  /** 위치에 따라 고정된 위상항. */
  spatial: Float32Array;
  /** 점마다 누적되는 위상. 여기 상태일 때 더 빨리 흐른다. */
  phase: Float32Array;
  /** 0~1 여기 강도. */
  excite: Float32Array;
};

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  life: number;
  maxLife: number;
};

export function InteractiveBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const coarsePointer = window.matchMedia("(pointer: coarse)");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    let width = 0;
    let height = 0;
    let rows: Row[] = [];

    const particles: Particle[] = [];

    let pointerX = 0;
    let pointerY = 0;
    let pointerActive = false;

    let frameId = 0;
    let lastTime = 0;

    /** 원근 그리드를 뷰포트 크기에 맞춰 다시 만든다. */
    const buildRows = () => {
      const centerX = width / 2;
      const horizon = height * HORIZON_RATIO;
      // d = 수평선에서 화면 아래로 떨어진 거리. 원근 축소를 이 값 하나로 표현한다.
      const dNear = height + BOTTOM_OVERSCAN - horizon;
      // 월드 z 는 화면 거리의 역수에 비례한다. 뒤로 갈수록 간격이 좁아진다.
      const zUnit = 1 / (ROW_SHRINK - 1);
      const next: Row[] = [];

      for (let d = dNear; d >= D_MIN; d /= ROW_SHRINK) {
        // 먼 열이 픽셀 단위로 뭉치지 않도록 화면 간격에 하한을 둔다.
        const stepX = Math.max(d * X_TO_Y, MIN_STEP_PX);
        const half = Math.ceil((centerX + 24) / stepX);
        const count = half * 2 + 1;

        const xs = new Float32Array(count);
        const spatial = new Float32Array(count);
        const worldZ = zUnit * (dNear / d);
        // 간격에 하한이 걸린 열에서도 파도가 이어지도록 월드 x 를 역산한다.
        const worldPerPx = 1 / (d * X_TO_Y);

        for (let i = 0; i < count; i += 1) {
          const offset = (i - half) * stepX;
          xs[i] = centerX + offset;
          spatial[i] = offset * worldPerPx * FREQ_X + worldZ * FREQ_Z;
        }

        // 열이 끊기는 지점에서 정확히 0 이 되도록 맞춰, 경계가 선처럼 보이지 않게 한다.
        const fade = (d - D_MIN) / (dNear - D_MIN);
        next.push({
          baseY: horizon + d,
          stepX,
          firstX: xs[0],
          amp: d * AMP_RATIO,
          radius: Math.min(1.7, Math.max(0.45, d * 0.0032)),
          // 멀수록 옅게 깔려 수평선으로 자연스럽게 사라진다.
          alpha: 0.55 * fade ** 1.15,
          xs,
          spatial,
          phase: new Float32Array(count),
          excite: new Float32Array(count),
        });
      }

      rows = next;
    };

    /** 커서 반경 안의 점에 여기 상태를 주입한다. */
    const applyPointer = () => {
      if (!pointerActive) return;

      const radiusSq = HOVER_RADIUS * HOVER_RADIUS;

      for (let r = 0; r < rows.length; r += 1) {
        const row = rows[r];

        // 파도가 올라간 만큼 여유를 두고 열 전체를 먼저 걸러낸다.
        const maxLift = row.amp * (1 + AMP_BOOST);
        const dy = pointerY - row.baseY;
        if (Math.abs(dy) > HOVER_RADIUS + maxLift) continue;

        // 점 간격이 일정하므로 반경에 걸리는 인덱스 구간을 바로 구한다.
        const from = Math.max(
          0,
          Math.ceil((pointerX - HOVER_RADIUS - row.firstX) / row.stepX),
        );
        const to = Math.min(
          row.xs.length - 1,
          Math.floor((pointerX + HOVER_RADIUS - row.firstX) / row.stepX),
        );

        for (let i = from; i <= to; i += 1) {
          const dx = pointerX - row.xs[i];
          const distSq = dx * dx + dy * dy;
          if (distSq > radiusSq) continue;

          // 가운데일수록 강하게, 가장자리로 갈수록 부드럽게 잦아든다.
          const falloff = 1 - Math.sqrt(distSq) / HOVER_RADIUS;
          const eased = falloff * falloff * (3 - 2 * falloff);
          if (eased > row.excite[i]) row.excite[i] = eased;
        }
      }
    };

    const spawnParticles = (x: number, y: number) => {
      const count =
        PARTICLE_MIN +
        Math.floor(Math.random() * (PARTICLE_MAX - PARTICLE_MIN + 1));

      for (let i = 0; i < count; i += 1) {
        if (particles.length >= MAX_PARTICLES) break;

        // 위로 튀어 오르는 물방울: 위쪽으로 쏠린 속도에 좌우 흔들림을 더한다.
        const maxLife = 0.75 + Math.random() * 0.5;
        particles.push({
          x,
          y,
          vx: (Math.random() - 0.5) * 260,
          vy: -(300 + Math.random() * 260),
          radius: 1.6 + Math.random() * 1.9,
          life: maxLife,
          maxLife,
        });
      }
    };

    const updateParticles = (delta: number) => {
      for (let i = particles.length - 1; i >= 0; i -= 1) {
        const p = particles[i];
        p.life -= delta;

        if (p.life <= 0) {
          // 순서가 중요하지 않으므로 마지막 요소로 덮어써 O(1) 로 제거한다.
          particles[i] = particles[particles.length - 1];
          particles.pop();
          continue;
        }

        p.vy += GRAVITY * delta;
        p.x += p.vx * delta;
        p.y += p.vy * delta;
      }
    };

    const draw = (delta: number) => {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, width, height);

      applyPointer();

      // 여기 상태는 시간 기준으로 감쇠시켜 프레임 레이트와 무관하게 만든다.
      const decay = Math.exp(-delta / EXCITE_TAU);

      for (let r = 0; r < rows.length; r += 1) {
        const row = rows[r];
        const { xs, phase, excite, spatial, amp, radius, baseY } = row;
        const count = xs.length;

        const calmPath = new Path2D();
        const livePath = new Path2D();
        const liveRadius = radius * 1.6;
        let hasLive = false;

        for (let i = 0; i < count; i += 1) {
          const energy = excite[i];

          // 여기된 점일수록 위상이 빨리 흐르고 진폭이 커진다.
          const next = phase[i] + (BASE_SPEED + energy * SPEED_BOOST) * delta;
          phase[i] = next > TAU ? next - TAU : next;
          if (energy > 0) excite[i] = energy * decay;

          const y =
            baseY -
            Math.sin(phase[i] + spatial[i]) * amp * (1 + energy * AMP_BOOST);
          const x = xs[i];

          if (energy > EXCITE_HIGHLIGHT) {
            hasLive = true;
            livePath.moveTo(x + liveRadius, y);
            livePath.arc(x, y, liveRadius, 0, TAU);
          } else {
            calmPath.moveTo(x + radius, y);
            calmPath.arc(x, y, radius, 0, TAU);
          }
        }

        ctx.fillStyle = `rgba(${DOT_RGB}, ${row.alpha})`;
        ctx.fill(calmPath);

        if (hasLive) {
          ctx.fillStyle = `rgba(${DOT_RGB}, ${Math.min(1, row.alpha * 2.1)})`;
          ctx.fill(livePath);
        }
      }

      if (particles.length > 0) {
        updateParticles(delta);

        for (let i = 0; i < particles.length; i += 1) {
          const p = particles[i];
          const path = new Path2D();
          path.moveTo(p.x + p.radius, p.y);
          path.arc(p.x, p.y, p.radius, 0, TAU);
          ctx.fillStyle = `rgba(${DOT_RGB}, ${(p.life / p.maxLife) * 0.72})`;
          ctx.fill(path);
        }
      }
    };

    const render = (time: number) => {
      const delta = lastTime === 0 ? 0.016 : (time - lastTime) / 1000;
      lastTime = time;
      draw(Math.min(delta, MAX_DELTA));
      frameId = window.requestAnimationFrame(render);
    };

    const start = () => {
      window.cancelAnimationFrame(frameId);

      // 모션 최소화 설정에서는 애니메이션 없이 정지된 그리드만 그린다.
      if (reducedMotion.matches) {
        pointerActive = false;
        particles.length = 0;
        draw(0);
        return;
      }

      lastTime = 0;
      frameId = window.requestAnimationFrame(render);
    };

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;

      const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      buildRows();

      if (reducedMotion.matches) draw(0);
    };

    const handlePointerMove = (event: PointerEvent) => {
      // 터치/펜 입력과 coarse 포인터 기기에서는 기본 파도를 유지한다.
      if (event.pointerType !== "mouse") return;
      if (coarsePointer.matches || reducedMotion.matches) return;

      pointerX = event.clientX;
      pointerY = event.clientY;
      pointerActive = true;
    };

    const handlePointerDown = (event: PointerEvent) => {
      if (reducedMotion.matches) return;
      spawnParticles(event.clientX, event.clientY);
    };

    const releasePointer = () => {
      pointerActive = false;
    };

    resize();
    start();

    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", handlePointerMove, {
      passive: true,
    });
    window.addEventListener("pointerdown", handlePointerDown, {
      passive: true,
    });
    window.addEventListener("blur", releasePointer);
    document.addEventListener("mouseleave", releasePointer);
    reducedMotion.addEventListener("change", start);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("blur", releasePointer);
      document.removeEventListener("mouseleave", releasePointer);
      reducedMotion.removeEventListener("change", start);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10"
    />
  );
}
