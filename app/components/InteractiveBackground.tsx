"use client";

import { useEffect, useRef } from "react";

/** 그리드 간격(px). 작을수록 선이 촘촘해진다. */
const GRID_SPACING = 34;
/** 선 하나의 길이(px). */
const LINE_LENGTH = 14;
/** 기본 선 색상. */
const LINE_COLOR = "#D1D5DB";
/** 커서 주변에서 강조되는 선 색상. */
const LINE_COLOR_NEAR = "#9CA3AF";
/** 이 반경(px) 안의 선을 강조 색으로 그린다. */
const HIGHLIGHT_RADIUS = 170;
/** 커서 추적 강도가 목표값으로 수렴하는 속도(0~1). */
const STRENGTH_EASING = 0.07;
/** 레티나에서 과도한 픽셀 처리를 막기 위한 DPR 상한. */
const MAX_DPR = 2;

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
    let cols = 0;
    let rows = 0;
    let offsetX = 0;
    let offsetY = 0;

    // 커서 위치와 추적 강도. strength 는 targetStrength 로 부드럽게 수렴하므로
    // 커서가 들어오고 나갈 때 기본 패턴과의 전환이 끊기지 않는다.
    let pointerX = 0;
    let pointerY = 0;
    let strength = 0;
    let targetStrength = 0;

    let frameId = 0;
    let startTime = 0;

    const draw = (elapsed: number) => {
      strength += (targetStrength - strength) * STRENGTH_EASING;

      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, width, height);

      ctx.lineWidth = 1;
      ctx.lineCap = "round";

      // 같은 색끼리 한 번에 stroke 하려고 두 경로에 나눠 담는다.
      const basePath = new Path2D();
      const nearPath = new Path2D();
      const half = LINE_LENGTH / 2;
      const highlightSq = HIGHLIGHT_RADIUS * HIGHLIGHT_RADIUS;
      const following = strength > 0.001;

      for (let row = 0; row < rows; row += 1) {
        const centerY = offsetY + row * GRID_SPACING;

        for (let col = 0; col < cols; col += 1) {
          const centerX = offsetX + col * GRID_SPACING;

          // 커서가 없을 때 유지되는 기본 패턴: 시간에 따라 흐르는 물결.
          const ambient =
            (Math.sin(centerX * 0.006 + elapsed * 0.7) +
              Math.cos(centerY * 0.006 + elapsed * 0.5)) *
            0.9;

          let angle = ambient;
          let distanceSq = Number.POSITIVE_INFINITY;

          if (following) {
            const dx = pointerX - centerX;
            const dy = pointerY - centerY;
            distanceSq = dx * dx + dy * dy;

            // 두 각도를 최단 회전 경로로 보간해 ±π 경계에서 튀지 않게 한다.
            const toPointer = Math.atan2(dy, dx);
            const delta = toPointer - ambient;
            const shortest = Math.atan2(Math.sin(delta), Math.cos(delta));
            angle = ambient + shortest * strength;
          }

          const endX = Math.cos(angle) * half;
          const endY = Math.sin(angle) * half;
          const path = distanceSq < highlightSq ? nearPath : basePath;

          path.moveTo(centerX - endX, centerY - endY);
          path.lineTo(centerX + endX, centerY + endY);
        }
      }

      ctx.strokeStyle = LINE_COLOR;
      ctx.stroke(basePath);
      ctx.strokeStyle = LINE_COLOR_NEAR;
      ctx.stroke(nearPath);
    };

    const render = (time: number) => {
      if (startTime === 0) startTime = time;
      draw((time - startTime) / 1000);
      frameId = window.requestAnimationFrame(render);
    };

    const start = () => {
      window.cancelAnimationFrame(frameId);

      // 모션 최소화 설정에서는 애니메이션 없이 정지된 패턴만 그린다.
      if (reducedMotion.matches) {
        strength = 0;
        targetStrength = 0;
        draw(0);
        return;
      }

      startTime = 0;
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

      // 뷰포트가 바뀌어도 그리드가 화면 중앙을 기준으로 정렬되도록 다시 계산한다.
      cols = Math.ceil(width / GRID_SPACING) + 1;
      rows = Math.ceil(height / GRID_SPACING) + 1;
      offsetX = (width - (cols - 1) * GRID_SPACING) / 2;
      offsetY = (height - (rows - 1) * GRID_SPACING) / 2;

      if (reducedMotion.matches) {
        draw(0);
      }
    };

    const handlePointerMove = (event: PointerEvent) => {
      // 터치/펜 입력과 coarse 포인터 기기에서는 기본 패턴을 유지한다.
      if (event.pointerType !== "mouse") return;
      if (coarsePointer.matches || reducedMotion.matches) return;

      pointerX = event.clientX;
      pointerY = event.clientY;
      targetStrength = 1;
    };

    const releasePointer = () => {
      targetStrength = 0;
    };

    resize();
    start();

    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", handlePointerMove, {
      passive: true,
    });
    window.addEventListener("blur", releasePointer);
    document.addEventListener("mouseleave", releasePointer);
    reducedMotion.addEventListener("change", start);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", handlePointerMove);
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
