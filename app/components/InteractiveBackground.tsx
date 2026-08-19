"use client";

import { useEffect, useRef } from "react";

/* ── 원근 그리드 ─────────────────────────────────────────────── */
/** 수평선의 화면 세로 위치 비율. 낮게 뜬 달을 담도록 아래로 내렸다. */
const HORIZON_RATIO = 0.55;
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

/* ── 파도 (심해 중력파) ──────────────────────────────────────── */
/** 심해 중력파의 분산 관계 ω = √(g·k) 에 쓰이는 중력 세기.
 *  파도를 되돌리는 복원력이 곧 중력이라, 이 상수 하나가 전체 리듬을 정한다.
 *  진행 속도를 손으로 정하지 않고 여기서 유도하므로 파장이 길수록 느긋하게,
 *  짧을수록 조급하게 움직인다 — 실제 바다가 그렇다. */
const GRAVITY_WAVE = 4.3;
/** 수평선까지의 거리 대비 파도 진폭 비율. 가까운 점일수록 크게 출렁인다. */
const AMP_RATIO = 0.062;
/** 완전히 여기된 점의 진폭 배수. */
const AMP_BOOST = 3.4;
/** 완전히 여기된 점에 더해지는 위상 속도(rad/s). 커서 근처에서 파도가 더 빨리 친다. */
const SPEED_BOOST = 2.6;
/** 1차 너울의 파수 벡터. 단위는 '격자 한 칸'이라 값이 곧 이웃한 점 사이의 위상차다.
 *  화면 전체에 큰 너울 한두 개만 남도록 극단적으로 낮춰 하나의 덩어리로 묶는다. */
const FREQ_X = 0.042;
const FREQ_Z = 0.04;
/** 2차 너울의 파수 벡터. 1차와 어긋난 방향으로 비스듬히 겹쳐,
 *  순수 사인파 한 장에서 오는 기계적인 규칙성을 깬다. */
const FREQ_X2 = -0.067;
const FREQ_Z2 = 0.058;
/** 전체 파고에서 1차 너울이 차지하는 비중(나머지는 2차). */
const SWELL_MIX = 0.68;

/** 각 너울의 파수 |k| 와, 거기서 유도한 각진동수 ω = √(g·k).
 *  둘의 주기가 정수비로 맞아떨어지지 않아 같은 무늬가 되풀이되지 않는다. */
const WAVE_K1 = Math.hypot(FREQ_X, FREQ_Z);
const WAVE_K2 = Math.hypot(FREQ_X2, FREQ_Z2);
const OMEGA1 = Math.sqrt(GRAVITY_WAVE * WAVE_K1);
const OMEGA2 = Math.sqrt(GRAVITY_WAVE * WAVE_K2);

/** 너울 위에 올라탄 잔물결의 파수 배수.
 *  너울만으로는 기둥 폭 전체의 위상차가 1rad 도 안 돼 수면이 통째로 명멸한다.
 *  촘촘한 자물결을 얹어야 점마다 다른 순간에 빛을 튕기며 쉼 없이 반짝인다.
 *  기존 위상항에 곱해 쓰므로 배열을 새로 들지 않는다. */
const RIPPLE_SCALE1 = 19;
const RIPPLE_SCALE2 = 29;
/** 잔물결도 같은 분산 관계를 따른다. 파장이 짧으니 저절로 더 빠르게 지나간다. */
const RIPPLE_OMEGA1 = Math.sqrt(GRAVITY_WAVE * WAVE_K1 * RIPPLE_SCALE1);
const RIPPLE_OMEGA2 = Math.sqrt(GRAVITY_WAVE * WAVE_K2 * RIPPLE_SCALE2);
/** 잔물결이 수면 높이에 보태는 비율. 반짝임이 주목적이라 크게 두지 않는다. */
const RIPPLE_AMP = 0.06;
/** 반사는 잔물결이 주도하고, 너울은 세기를 눌러 주는 포락선 역할만 한다.
 *  둘을 평균 내면 두 파가 함께 마루에 설 때만 밝아져 수면이 통째로 명멸한다.
 *  (실측: 평균 방식은 프레임의 64% 가 캄캄, 이 방식은 0%) */
const SWELL_ENVELOPE_FLOOR = 0.55;

/* ── 마우스 여기(excitation) ──────────────────────────────────── */
/** 커서가 점을 흔드는 화면상 반경(px). 넓을수록 한 번에 반응하는 덩어리가 커진다. */
const HOVER_RADIUS = 260;
/** 여기 상태가 목표치까지 차오르는 시정수(초). 급발진 대신 끈적하게 붙는다. */
const EXCITE_ATTACK = 0.18;
/** 여기 상태가 1/e 로 잦아드는 시간(초). 커서가 지나간 뒤 되돌아가는 속도. */
const EXCITE_TAU = 1.1;
/** 이 값을 넘는 점은 조금 크고 진하게 강조한다. */
const EXCITE_HIGHLIGHT = 0.22;
/** 커서가 흐트러뜨린 위상이 본래 파도로 되돌아가는 시정수(초).
 *  이 복원이 없으면 훑고 지나간 점마다 위상 오프셋이 영구히 남아,
 *  시간이 갈수록 파도의 결맞음이 깨지고 무작위 점 배열로 무너진다. */
const WOBBLE_TAU = 0.9;
/** 이보다 작아진 위상 흐트러짐은 0 으로 스냅해 잔여 드리프트를 끊는다. */
const WOBBLE_EPSILON = 1e-4;

/* ── 호버: 중력이 복원력인 감쇠 진동자 ───────────────────────── */
/** 커서가 들쑤신 물이 튀어오를 때의 파수. 너울보다 훨씬 짧아 빠르게 오르내린다. */
const BOB_K = 2.1;
/** 잔물결의 고유 각진동수. 너울과 똑같은 분산 관계에서 나온다. */
const BOB_OMEGA = Math.sqrt(GRAVITY_WAVE * BOB_K);
/** 감쇠비 ζ. 1 보다 한참 작아 여러 번 위아래로 넘실댄 뒤 잦아든다(부족감쇠). */
const BOB_DAMPING = 0.17;
/** 커서가 수면을 밀어올리는 가속도(px/s²). 평형점은 이 값을 ω² 로 나눈 높이다. */
const BOB_DRIVE = 250;
/** 변위와 속도가 모두 이보다 작아지면 0 으로 스냅해 잔떨림을 끊는다. */
const BOB_EPSILON = 0.02;

/* ── 밤바다 팔레트 ───────────────────────────────────────────── */
/** 화면 맨 위 천정. 거의 검은 남색. */
const SKY_TOP = "#04081a";
/** 수평선 부근 하늘. 달빛이 번져 한 단계 밝다. */
const SKY_HORIZON = "#1a3a68";
/** 수평선 바로 아래 먼 바다. */
const SEA_FAR = "#16294d";
/** 화면 앞쪽 바다. 가장 깊고 어둡다. */
const SEA_NEAR = "#080f22";

/* ── 광원(달) ────────────────────────────────────────────────── */
/** 달의 가로 위치 비율. */
const MOON_X_RATIO = 0.5;
/** 달 원반의 반지름(px). 아래 MOON_FULL_WIDTH 이상에서 쓰이는 기준값이다. */
const MOON_RADIUS = 260;
/** 달이 기준 크기를 그대로 쓰는 최소 뷰포트 폭(px).
 *  태블릿 이하로 좁아지면 폭에 비례해 줄여, 좁은 화면에서 하늘을 다 덮지 않게 한다.
 *  이 폭에서 배율이 정확히 1 이라 브레이크포인트에서 크기가 튀지 않는다. */
const MOON_FULL_WIDTH = 1024;
/** 원반이 수평선 뒤로 잠기는 비율(0~1). 0.5 면 정확히 반절이 가려진다.
 *  바다를 달보다 나중에 칠해서 가리므로, 이 값이 곧 그리는 순서를 정한다. */
const MOON_SUBMERGE = 0.44;
/** 원반 위쪽이 화면 밖으로 잘리지 않도록 남길 최소 여백(px). */
const MOON_MIN_GAP = 14;
/** 달무리가 퍼지는 반경 배수.
 *  원반이 커진 만큼 배수를 그대로 두면 후광이 화면을 통째로 덮어 밤이 사라진다. */
const MOON_GLOW_SCALE = 2.6;
/** 수면에 깔리는 달빛 기둥의 반경과 세로 확대 배율. */
const COLUMN_GLOW_RADIUS = 330;
/** 세로 확대 배율. 이 글로우는 배경에 미리 구워 두는 곧은 타원이라 굽이칠 수 없다.
 *  그래서 축이 아직 휘지 않은 수평선 부근만 받치고, 그보다 앞은 점이 길을 그리게 둔다. */
const COLUMN_GLOW_STRETCH = 2;

/* ── 윤슬(달빛 반사) ─────────────────────────────────────────── */
/** 달빛이 닿지 않는 점의 색. 바다에 잠긴 짙은 청색.
 *  차가운 물빛을 남겨 둬야 연노랑 반사광이 도드라진다. */
const DOT_DARK: [number, number, number] = [56, 94, 156];
/** 달빛을 정면으로 되쏘는 점의 색. 광원과 같은 #FFF08F 라야 반사로 읽힌다. */
const DOT_GLINT: [number, number, number] = [255, 240, 143];
/** 달빛 기둥의 기본 반폭(px)과, 화면 앞으로 올수록 벌어지는 비율.
 *  가까울수록 넓게 퍼져야 수면에 깔린 길처럼 보인다. */
const COLUMN_HALF_BASE = 170;
const COLUMN_SPREAD = 0.4;

/* ── 사행(蛇行): 구불구불한 빛의 길 ──────────────────────────── */
/* 실제 윤슬이 곧게 뻗지 않는 이유는, 너울이 수면을 좌우로 기울여
 * 빛을 되쏘는 자리가 옆으로 밀리기 때문이다. 그래서 점을 옮기는 대신
 * '기둥의 축'을 깊이에 따라 휘게 한다. 수면 격자는 그대로 두고
 * 밝아지는 자리만 움직이므로 물이 흐르지 않고 빛만 굽이친다.
 *
 * 굽이의 기준은 월드 좌표가 아니라 화면 깊이 d 다. 월드 z 는 원근으로
 * 눌려 화면 아래 절반이 좁은 구간에 몰리는 탓에, 그걸 쓰면 굽이가
 * 수평선 근처에만 뭉치고 정작 눈에 드는 앞쪽은 직선이 된다. */
/** 깊이에 대한 굽이의 공간 주파수. 화면 전체에 굽이 두세 개가 들어간다. */
const MEANDER_FREQ1 = 0.023;
const MEANDER_FREQ2 = 0.0141;
/** 굽이가 흘러가는 속도(rad/s). 너울과 같은 결로 느긋해야 물결처럼 읽힌다. */
const MEANDER_OMEGA1 = 0.26;
const MEANDER_OMEGA2 = 0.17;
/** 1차 굽이가 차지하는 비중. */
const MEANDER_MIX = 0.6;
/** 깊이 대비 축이 벗어나는 최대 폭의 비율.
 *  깊이에 비례시켜야 수평선에서는 0 으로 모여 길이 광원을 정확히 향한다. */
const MEANDER_RATIO = 0.42;
/** 마루가 빛을 되쏘는 예리함. 클수록 반짝임이 점처럼 또렷해진다. */
const GLINT_SHARPNESS = 1.9;
/** 반사광의 세기 배수. 마루가 최대로 서지 않아도 흰 점까지 닿게 밀어 올린다. */
const GLINT_GAIN = 1.75;
/** 기둥 한복판에 얹는 추가 세기. 도달 범위(가우시안)와 따로 두는 이유가 있다.
 *  폭만 넓히면 흐린 빛이 옆으로 퍼질 뿐 중앙이 더 밝아지지 않는다.
 *  세제곱한 항을 얹어 축 근처에만 몰아 줘야 한가운데가 도드라진다.
 *  (실측: 폭만 넓히면 밝은 점 12개/프레임, 이 항을 더하면 79개) */
const CORE_GAIN = 1.1;
/** 이 밝기를 넘는 점 뒤에 옅은 후광을 깔아 '빛나는' 느낌을 만든다. */
const BLOOM_LEVEL = 0.7;
/** 후광의 반지름 배수와 색. 옅게 여러 개가 겹쳐 은은하게 번진다. */
const BLOOM_SCALE = 3;
const BLOOM_COLOR = "rgba(255, 240, 143, 0.09)";
/** 달빛 밖 점의 기본 밝기(0~1). */
const AMBIENT_LIGHT = 0.19;
/** 밝은 점이 부풀어 보이는 정도. 반사광의 번짐을 흉내낸다. */
const GLINT_SWELL = 1.1;
/** 밝기를 몇 단계로 양자화할지. 단계마다 Path2D 로 묶어 한 번에 칠한다. */
const TONE_LEVELS = 7;

/** 밝기 단계별 색. 짙은 바다색에서 은백색으로 건너간다.
 *  열의 원근 감쇠는 색이 아니라 밝기 값 쪽에 곱하므로, 이 표를 모든 열이 함께 쓴다.
 *  덕분에 프레임마다 경로를 TONE_LEVELS 개만 만들면 된다. */
const TONES = Array.from({ length: TONE_LEVELS }, (_, t) => {
  const f = (t + 0.5) / TONE_LEVELS;
  const r = Math.round(DOT_DARK[0] + (DOT_GLINT[0] - DOT_DARK[0]) * f);
  const g = Math.round(DOT_DARK[1] + (DOT_GLINT[1] - DOT_DARK[1]) * f);
  const b = Math.round(DOT_DARK[2] + (DOT_GLINT[2] - DOT_DARK[2]) * f);
  // 밝은 단계일수록 가파르게 불투명해져 반짝임이 수면에서 튀어나온다.
  const a = Math.min(1, 0.12 + 1.7 * f ** 1.4);
  return `rgba(${r}, ${g}, ${b}, ${a.toFixed(3)})`;
});

/* ── 렌더링 ──────────────────────────────────────────────────── */
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
  /** 달빛 기둥이 이 열에서 갖는 반폭(px). 앞쪽 열일수록 넓다. */
  columnHalf: number;
  /** 이 열에서 기둥 축이 좌우로 벗어날 수 있는 최대 폭(px). 수평선에서 0 에 수렴한다. */
  meanderAmp: number;
  /** 깊이에서 온 굽이의 고정 위상. 열마다 값이 달라 길이 S 자로 휜다. */
  meanderZ1: number;
  meanderZ2: number;
  /** 원근 감쇠(0~1). 밝기에 곱해 멀수록 수평선으로 사그라들게 한다. */
  fade: number;
  /** 화면 x 좌표(미리 계산). */
  xs: Float32Array;
  /** 위치에 따라 고정된 1차 너울의 위상항. */
  spatial: Float32Array;
  /** 위치에 따라 고정된 2차 너울의 위상항. */
  spatial2: Float32Array;
  /** 커서가 밀어낸 위상의 '일시적인' 오프셋. 여기 상태일 때 쌓이고 곧 0 으로 되돌아온다.
   *  누적기가 아니라 복원되는 변위라서, 커서가 지나간 뒤 점이 원래 파도에 다시 합류한다. */
  wobble: Float32Array;
  /** 중력 복원력을 받는 잔물결의 세로 변위(px). 위로 솟으면 양수. */
  bob: Float32Array;
  /** 그 변위의 속도(px/s). 진동자를 적분하려면 위치와 함께 들고 있어야 한다. */
  bobV: Float32Array;
  /** 0~1 여기 강도. */
  excite: Float32Array;
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

    let pointerX = 0;
    let pointerY = 0;
    let pointerActive = false;

    let frameId = 0;
    let lastTime = 0;

    // 파도의 위상은 점이 아니라 화면 전체가 하나씩 공유한다.
    // 모든 점이 같은 시계를 읽으므로 결맞음이 시간이 지나도 흐트러지지 않는다.
    let basePhase = 0;
    let basePhase2 = 0;
    let ripplePhase = 0;
    let ripplePhase2 = 0;
    let meanderPhase = 0;
    let meanderPhase2 = 0;

    // 배경 그라데이션은 뷰포트가 바뀔 때만 다시 만든다. 매 프레임 만들면 낭비다.
    let horizonY = 0;
    let moonX = 0;
    let moonY = 0;
    /** 기준 크기 대비 실제로 그려진 달의 배율. 달빛 기둥도 같은 배율을 따른다. */
    let moonScale = 1;
    let backdrop: HTMLCanvasElement | null = null;

    /** 밤하늘·바다·달을 오프스크린에 한 번만 그려 둔다.
     *  프레임마다 바뀌지 않는 그림이라, 매번 다시 칠하는 대신 통째로 복사한다. */
    const buildBackdrop = () => {
      horizonY = height * HORIZON_RATIO;
      moonX = width * MOON_X_RATIO;

      // 원반의 MOON_SUBMERGE 만큼이 수평선 아래로 내려가도록 중심을 잡는다.
      // 중심 = 수평선 - r·(1 - 2·잠김비율)  →  잠김 0.5 면 중심이 수평선과 겹친다.
      const sink = 1 - 2 * MOON_SUBMERGE;
      // 좁은 화면에서는 폭에 비례해 줄인다. 높이만 보던 기존 제한은 세로로 긴
      // 태블릿·모바일에서 걸리지 않아, 달이 화면 폭을 넘기는 것을 못 막았다.
      let moonR = MOON_RADIUS * Math.min(1, width / MOON_FULL_WIDTH);
      // 위쪽이 화면 밖으로 잘리면(하늘이 얕으면) 그만큼 더 줄인다.
      const maxR = (horizonY - MOON_MIN_GAP) / (1 + sink);
      if (moonR > maxR) moonR = maxR;
      moonR = Math.max(10, moonR);
      moonScale = moonR / MOON_RADIUS;
      moonY = horizonY - moonR * sink;

      const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
      const layer = backdrop ?? document.createElement("canvas");
      layer.width = Math.max(1, Math.floor(width * dpr));
      layer.height = Math.max(1, Math.floor(height * dpr));
      const bctx = layer.getContext("2d");
      if (!bctx) return;
      bctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      backdrop = layer;

      const sky = bctx.createLinearGradient(0, 0, 0, horizonY);
      sky.addColorStop(0, SKY_TOP);
      sky.addColorStop(1, SKY_HORIZON);
      bctx.fillStyle = sky;
      bctx.fillRect(0, 0, width, horizonY);

      // 달무리 → 원반 순으로 하늘 위에 먼저 얹는다. 후광은 원반 가장자리에서
      // 시작해야 원반 안쪽이 뿌옇게 뜨지 않는다.
      // 안쪽은 연노랑, 바깥으로 갈수록 밤하늘의 푸른빛으로 식는다.
      const glowR = moonR * MOON_GLOW_SCALE;
      const glow = bctx.createRadialGradient(moonX, moonY, moonR, moonX, moonY, glowR);
      glow.addColorStop(0, "rgba(255, 240, 143, 0.38)");
      glow.addColorStop(0.16, "rgba(230, 220, 152, 0.15)");
      glow.addColorStop(0.5, "rgba(112, 148, 210, 0.05)");
      glow.addColorStop(1, "rgba(96, 140, 210, 0)");
      bctx.fillStyle = glow;
      bctx.fillRect(moonX - glowR, moonY - glowR, glowR * 2, glowR * 2);

      bctx.fillStyle = "#fff08f";
      bctx.beginPath();
      bctx.arc(moonX, moonY, moonR, 0, TAU);
      bctx.fill();

      // 바다를 달보다 나중에 칠해, 수평선 아래로 내려간 원반을 덮어 가린다.
      // 수평선에서 화면 앞쪽으로 갈수록 깊고 어두워진다.
      const sea = bctx.createLinearGradient(0, horizonY, 0, height);
      sea.addColorStop(0, SEA_FAR);
      sea.addColorStop(1, SEA_NEAR);
      bctx.fillStyle = sea;
      bctx.fillRect(0, horizonY, width, height - horizonY);

      // 수면에 깔린 달빛 길. 원형 그라데이션을 세로로 늘여 기둥 모양으로 만든다.
      // 달 바로 아래는 연노랑, 앞으로 올수록 물빛에 섞여 푸르게 식는다.
      // 달이 줄면 수면에 깔리는 빛도 같이 줄어야 광원과 반사가 한 몸으로 읽힌다.
      const columnR = COLUMN_GLOW_RADIUS * moonScale;
      const column = bctx.createRadialGradient(0, 0, 0, 0, 0, columnR);
      column.addColorStop(0, "rgba(255, 240, 143, 0.40)");
      column.addColorStop(0.45, "rgba(158, 178, 220, 0.15)");
      column.addColorStop(1, "rgba(90, 132, 200, 0)");
      bctx.save();
      // 하늘로 새어 나가지 않도록 바다 영역으로 잘라낸다.
      bctx.beginPath();
      bctx.rect(0, horizonY, width, height - horizonY);
      bctx.clip();
      bctx.translate(moonX, horizonY);
      bctx.scale(1, COLUMN_GLOW_STRETCH);
      bctx.fillStyle = column;
      bctx.beginPath();
      bctx.arc(0, 0, columnR, 0, TAU);
      bctx.fill();
      bctx.restore();
    };

    /** 미리 그려 둔 밤바다를 통째로 복사한다. */
    const paintBackdrop = () => {
      if (backdrop) ctx.drawImage(backdrop, 0, 0, width, height);
      else {
        ctx.fillStyle = SEA_NEAR;
        ctx.fillRect(0, 0, width, height);
      }
    };

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
        const spatial2 = new Float32Array(count);
        const worldZ = zUnit * (dNear / d);
        // 간격에 하한이 걸린 열에서도 파도가 이어지도록 월드 x 를 역산한다.
        const worldPerPx = 1 / (d * X_TO_Y);

        for (let i = 0; i < count; i += 1) {
          const offset = (i - half) * stepX;
          const worldX = offset * worldPerPx;
          xs[i] = centerX + offset;
          spatial[i] = worldX * FREQ_X + worldZ * FREQ_Z;
          spatial2[i] = worldX * FREQ_X2 + worldZ * FREQ_Z2;
        }

        // 열이 끊기는 지점에서 정확히 0 이 되도록 맞춰, 경계가 선처럼 보이지 않게 한다.
        // 어두운 바다 위에서는 흰 점이 묻히기 쉬워, 흰 배경 때보다 감쇠를 완만하게 둔다.
        const fade = ((d - D_MIN) / (dNear - D_MIN)) ** 0.78;

        next.push({
          baseY: horizon + d,
          stepX,
          firstX: xs[0],
          amp: d * AMP_RATIO,
          // 반지름이 1px 밑으로 내려가면 안티에일리어싱에 먹혀 반짝임이 사라진다.
          radius: Math.min(2.2, Math.max(0.72, d * 0.0042)),
          columnHalf: (COLUMN_HALF_BASE + d * COLUMN_SPREAD) * moonScale,
          meanderAmp: d * MEANDER_RATIO,
          meanderZ1: d * MEANDER_FREQ1,
          meanderZ2: d * MEANDER_FREQ2,
          fade,
          xs,
          spatial,
          spatial2,
          wobble: new Float32Array(count),
          bob: new Float32Array(count),
          bobV: new Float32Array(count),
          excite: new Float32Array(count),
        });
      }

      rows = next;
    };

    /** 커서 반경 안의 점에 여기 상태를 주입한다. */
    const applyPointer = (delta: number) => {
      if (!pointerActive) return;

      const radiusSq = HOVER_RADIUS * HOVER_RADIUS;
      // 목표치로 곧장 튀지 않고 시정수만큼 차오르게 해 점성 있는 반응을 만든다.
      const attack = 1 - Math.exp(-delta / EXCITE_ATTACK);

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

          // 반경이 넓어진 만큼 smootherstep 으로 가장자리를 더 부드럽게 흘린다.
          const t = 1 - Math.sqrt(distSq) / HOVER_RADIUS;
          const eased = t * t * t * (t * (t * 6 - 15) + 10);
          const current = row.excite[i];
          if (eased > current) row.excite[i] = current + (eased - current) * attack;
        }
      }
    };

    const draw = (delta: number) => {
      paintBackdrop();

      applyPointer(delta);

      // 여기 상태는 시간 기준으로 감쇠시켜 프레임 레이트와 무관하게 만든다.
      const decay = Math.exp(-delta / EXCITE_TAU);
      // 흐트러진 위상도 같은 방식으로 0 을 향해 복원시킨다.
      const restore = Math.exp(-delta / WOBBLE_TAU);

      // 두 너울의 위상을 분산 관계에서 얻은 ω 로 각각 감아 둔다.
      // 한쪽에 배수를 곱해 쓰면 TAU 를 넘어 되감기는 순간 마루가 튀므로 따로 누적한다.
      basePhase += OMEGA1 * delta;
      if (basePhase > TAU) basePhase -= TAU;
      basePhase2 += OMEGA2 * delta;
      if (basePhase2 > TAU) basePhase2 -= TAU;
      ripplePhase += RIPPLE_OMEGA1 * delta;
      if (ripplePhase > TAU) ripplePhase -= TAU;
      ripplePhase2 += RIPPLE_OMEGA2 * delta;
      if (ripplePhase2 > TAU) ripplePhase2 -= TAU;
      meanderPhase += MEANDER_OMEGA1 * delta;
      if (meanderPhase > TAU) meanderPhase -= TAU;
      meanderPhase2 += MEANDER_OMEGA2 * delta;
      if (meanderPhase2 > TAU) meanderPhase2 -= TAU;

      // 진동자 계수는 프레임마다 같으므로 루프 밖에서 한 번만 구한다.
      const bobK = BOB_OMEGA * BOB_OMEGA;
      const bobC = 2 * BOB_DAMPING * BOB_OMEGA;

      // 밝기 단계별 경로는 화면 전체가 공유한다. 열마다 만들면 프레임당 수백 개가
      // 생기고 채우기 호출도 그만큼 늘어난다. 여기서는 프레임당 TONE_LEVELS 번이면 끝난다.
      const tonePaths: Path2D[] = [];
      const toneUsed: boolean[] = [];
      for (let t = 0; t < TONE_LEVELS; t += 1) {
        tonePaths.push(new Path2D());
        toneUsed.push(false);
      }
      // 가장 밝은 점들 뒤에 깔 후광. 경로 하나에 모아 한 번만 칠한다.
      const bloomPath = new Path2D();
      let hasBloom = false;

      for (let r = 0; r < rows.length; r += 1) {
        const row = rows[r];
        const {
          xs,
          wobble,
          bob,
          bobV,
          excite,
          spatial,
          spatial2,
          amp,
          radius,
          baseY,
          columnHalf,
          fade,
        } = row;
        const count = xs.length;
        const invColumnHalf = 1 / columnHalf;

        // 이 열에서 빛의 길이 지나는 자리. 깊이마다 달라 전체가 S 자로 굽는다.
        // 열 단위로 한 번만 구하면 되므로 점마다 계산할 필요가 없다.
        const axisX =
          moonX +
          (Math.sin(meanderPhase + row.meanderZ1) * MEANDER_MIX +
            Math.sin(meanderPhase2 + row.meanderZ2) * (1 - MEANDER_MIX)) *
            row.meanderAmp;

        for (let i = 0; i < count; i += 1) {
          const energy = excite[i];
          let offset = wobble[i];

          let springY = bob[i];
          let springV = bobV[i];

          if (energy > 0 || offset !== 0 || springY !== 0 || springV !== 0) {
            // 여기된 점은 위상이 앞질러 나가지만, 그 앞섬은 곧 0 으로 되감긴다.
            offset = (offset + energy * SPEED_BOOST * delta) * restore;
            wobble[i] = Math.abs(offset) < WOBBLE_EPSILON ? 0 : offset;

            // 감쇠 진동자: a = -ω²x - 2ζω·v + (커서가 밀어올리는 힘).
            // 복원항 -ω²x 가 중력이라, 커서가 떠난 뒤에도 평형점을 지나치며
            // 위아래로 몇 번 넘실대다 잦아든다. 속도부터 갱신하는 준음해법이라
            // MAX_DELTA 범위에서 안정적이다.
            const accel = energy * BOB_DRIVE - bobK * springY - bobC * springV;
            springV += accel * delta;
            springY += springV * delta;

            if (
              energy === 0 &&
              Math.abs(springY) < BOB_EPSILON &&
              Math.abs(springV) < BOB_EPSILON
            ) {
              springY = 0;
              springV = 0;
            }

            bob[i] = springY;
            bobV[i] = springV;

            if (energy > 0) excite[i] = energy * decay;
          }

          // 방향이 어긋난 두 너울을 겹쳐 마루가 매번 다른 자리에서 만나게 한다.
          const lift =
            Math.sin(basePhase + spatial[i] + offset) * SWELL_MIX +
            Math.sin(basePhase2 + spatial2[i] + offset) * (1 - SWELL_MIX);

          // 너울 위에 올라탄 잔물결. 위상항에 배수를 곱해 훨씬 촘촘한 파를 얻는다.
          const ripple =
            Math.sin(ripplePhase + spatial[i] * RIPPLE_SCALE1) * 0.5 +
            Math.sin(ripplePhase2 + spatial2[i] * RIPPLE_SCALE2) * 0.5;

          const y =
            baseY -
            (lift + ripple * RIPPLE_AMP) * amp * (1 + energy * AMP_BOOST) -
            springY;
          const x = xs[i];

          // 굽이친 축에서 얼마나 떨어졌는지. 축에서 멀어지면 가우시안으로 사그라든다.
          const dx = (x - axisX) * invColumnHalf;
          const band = Math.exp(-dx * dx);
          // 넓게 도달하는 항 + 축 근처에만 몰리는 항. 폭과 중앙 세기를 따로 잡는다.
          const litness = band + CORE_GAIN * band * band * band;
          // 달을 향해 기운 잔물결 면이 빛을 되쏜다. 점마다 위상이 크게 달라
          // 서로 다른 순간에 번쩍이므로 수면이 한 박자로 깜빡이지 않는다.
          // 너울은 그 세기를 눌러 주는 포락선으로만 작용한다.
          const envelope =
            SWELL_ENVELOPE_FLOOR +
            (1 - SWELL_ENVELOPE_FLOOR) * (lift > 0 ? lift : 0);
          const facet =
            ripple > 0 ? ripple ** GLINT_SHARPNESS * GLINT_GAIN * envelope : 0;
          // 커서가 휘저은 자리도 빛을 받은 것처럼 함께 밝아진다.
          let level = AMBIENT_LIGHT + litness * facet * (1 - AMBIENT_LIGHT);
          if (energy > EXCITE_HIGHLIGHT && energy > level) level = energy;
          // 원근 감쇠는 색이 아니라 밝기에 곱한다. 멀수록 어둡고 작게 잦아든다.
          level *= fade;
          if (level > 1) level = 1;

          const tone = (level * TONE_LEVELS) | 0;
          const slot = tone >= TONE_LEVELS ? TONE_LEVELS - 1 : tone;
          const dotR = radius * (1 + GLINT_SWELL * level);

          if (level > BLOOM_LEVEL) {
            hasBloom = true;
            const bloomR = dotR * BLOOM_SCALE;
            bloomPath.moveTo(x + bloomR, y);
            bloomPath.arc(x, y, bloomR, 0, TAU);
          }

          toneUsed[slot] = true;
          tonePaths[slot].moveTo(x + dotR, y);
          tonePaths[slot].arc(x, y, dotR, 0, TAU);
        }
      }

      // 후광을 먼저 깔고 그 위에 점을 얹어야, 또렷한 알갱이가 빛에 싸여 보인다.
      if (hasBloom) {
        ctx.fillStyle = BLOOM_COLOR;
        ctx.fill(bloomPath);
      }

      // 어두운 단계부터 칠해, 밝은 반짝임이 가장 위에 얹히게 한다.
      for (let t = 0; t < TONE_LEVELS; t += 1) {
        if (!toneUsed[t]) continue;
        ctx.fillStyle = TONES[t];
        ctx.fill(tonePaths[t]);
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

      buildBackdrop();
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

    const releasePointer = () => {
      pointerActive = false;
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
