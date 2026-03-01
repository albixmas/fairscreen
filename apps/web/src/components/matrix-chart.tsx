"use client";

import React, { useState, useCallback, useMemo, useRef } from "react";
import { getZoneColor, getZoneLabel } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface MatrixPoint {
  id: string;
  name: string;
  x: number;
  y: number;
  zone: string;
  hiringZonePass: boolean;
}

export interface MatrixBin {
  x: number;
  y: number;
  count: number;
  zones: Record<string, number>;
}

export interface AxisCutoffs {
  strongYes: number;
  yes: number;
  maybe: number;
}

export interface MatrixChartProps {
  points: MatrixPoint[];
  bins: MatrixBin[];
  useDensity: boolean;
  axisCutoffs: AxisCutoffs;
  width?: number;
  height?: number;
  onPointClick?: (id: string) => void;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const MARGIN = { top: 28, right: 28, bottom: 56, left: 64 };
const AXIS_MAX = 25;
const TICKS = [0, 5, 10, 15, 20, 25];
const POINT_RADIUS = 5.5;
const BIN_SIZE = 2;

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function dominantZone(zones: Record<string, number>): string {
  let best = "NO";
  let bestCount = 0;
  for (const [zone, count] of Object.entries(zones)) {
    if (count > bestCount) {
      bestCount = count;
      best = zone;
    }
  }
  return best;
}

/** Light zone background fill */
function zoneAreaFill(zone: string): string {
  switch (zone) {
    case "STRONG_YES":
      return "rgba(5, 150, 105, 0.04)";
    case "YES":
      return "rgba(16, 185, 129, 0.04)";
    case "MAYBE":
      return "rgba(245, 158, 11, 0.04)";
    case "NO":
      return "rgba(239, 68, 68, 0.03)";
    default:
      return "transparent";
  }
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function MatrixChart({
  points,
  bins,
  useDensity,
  axisCutoffs,
  width = 720,
  height = 560,
  onPointClick,
}: MatrixChartProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoveredPoint, setHoveredPoint] = useState<MatrixPoint | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  const plotW = width - MARGIN.left - MARGIN.right;
  const plotH = height - MARGIN.top - MARGIN.bottom;

  /** Map data coordinate to SVG pixel position */
  const scaleX = useCallback(
    (v: number) => MARGIN.left + (v / AXIS_MAX) * plotW,
    [plotW],
  );
  const scaleY = useCallback(
    (v: number) => MARGIN.top + plotH - (v / AXIS_MAX) * plotH,
    [plotH],
  );

  /* ---------- cutoff lines ---------- */
  const cutoffValues = useMemo(
    () => [axisCutoffs.strongYes, axisCutoffs.yes, axisCutoffs.maybe],
    [axisCutoffs],
  );

  /* ---------- zone background rects (9 regions) ---------- */
  const zoneRects = useMemo(() => {
    const { strongYes, yes, maybe } = axisCutoffs;
    const thresholdsX = [0, maybe, yes, strongYes, AXIS_MAX];
    const thresholdsY = [0, maybe, yes, strongYes, AXIS_MAX];
    const rects: { x: number; y: number; w: number; h: number; zone: string }[] = [];

    for (let xi = 0; xi < thresholdsX.length - 1; xi++) {
      for (let yi = 0; yi < thresholdsY.length - 1; yi++) {
        const minLevelX = xi; // 0=below-maybe, 1=maybe, 2=yes, 3=strongYes
        const minLevelY = yi;
        const level = Math.min(minLevelX, minLevelY);
        const zone =
          level === 3
            ? "STRONG_YES"
            : level === 2
              ? "YES"
              : level === 1
                ? "MAYBE"
                : "NO";

        const x1 = scaleX(thresholdsX[xi]);
        const x2 = scaleX(thresholdsX[xi + 1]);
        const y1 = scaleY(thresholdsY[yi + 1]);
        const y2 = scaleY(thresholdsY[yi]);

        rects.push({
          x: x1,
          y: y1,
          w: x2 - x1,
          h: y2 - y1,
          zone,
        });
      }
    }
    return rects;
  }, [axisCutoffs, scaleX, scaleY]);

  /* ---------- zone labels positioned in the large corners ---------- */
  const zoneLabels = useMemo(() => {
    const { strongYes, yes, maybe } = axisCutoffs;
    return [
      {
        label: "Strong Yes",
        x: scaleX((strongYes + AXIS_MAX) / 2),
        y: scaleY((strongYes + AXIS_MAX) / 2),
        color: "#059669",
      },
      {
        label: "Yes",
        x: scaleX((yes + strongYes) / 2),
        y: scaleY((yes + strongYes) / 2),
        color: "#10b981",
      },
      {
        label: "Maybe",
        x: scaleX((maybe + yes) / 2),
        y: scaleY((maybe + yes) / 2),
        color: "#f59e0b",
      },
      {
        label: "No",
        x: scaleX(maybe / 2),
        y: scaleY(maybe / 2),
        color: "#ef4444",
      },
    ];
  }, [axisCutoffs, scaleX, scaleY]);

  /* ---------- mouse handlers ---------- */
  const handleMouseMove = useCallback(
    (e: React.MouseEvent, point: MatrixPoint) => {
      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      setTooltipPos({
        x: e.clientX - rect.left + 12,
        y: e.clientY - rect.top - 10,
      });
      setHoveredPoint(point);
    },
    [],
  );

  const handleMouseLeave = useCallback(() => {
    setHoveredPoint(null);
  }, []);

  /* ------------------------------------------------------------------ */
  /*  Render                                                             */
  /* ------------------------------------------------------------------ */

  return (
    <div className="relative select-none">
      <svg
        ref={svgRef}
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="overflow-visible"
      >
        {/* ---- Zone background shading ---- */}
        {zoneRects.map((r, i) => (
          <rect
            key={`zone-bg-${i}`}
            x={r.x}
            y={r.y}
            width={r.w}
            height={r.h}
            fill={zoneAreaFill(r.zone)}
          />
        ))}

        {/* ---- Subtle grid lines ---- */}
        {TICKS.map((t) => (
          <React.Fragment key={`grid-${t}`}>
            <line
              x1={scaleX(t)}
              y1={scaleY(0)}
              x2={scaleX(t)}
              y2={scaleY(AXIS_MAX)}
              stroke="#e5e7eb"
              strokeWidth={0.5}
            />
            <line
              x1={scaleX(0)}
              y1={scaleY(t)}
              x2={scaleX(AXIS_MAX)}
              y2={scaleY(t)}
              stroke="#e5e7eb"
              strokeWidth={0.5}
            />
          </React.Fragment>
        ))}

        {/* ---- Cutoff dashed lines ---- */}
        {cutoffValues.map((v, i) => (
          <React.Fragment key={`cutoff-${i}`}>
            {/* Vertical */}
            <line
              x1={scaleX(v)}
              y1={scaleY(0)}
              x2={scaleX(v)}
              y2={scaleY(AXIS_MAX)}
              stroke="#94a3b8"
              strokeWidth={1}
              strokeDasharray="6 4"
              opacity={0.6}
            />
            {/* Horizontal */}
            <line
              x1={scaleX(0)}
              y1={scaleY(v)}
              x2={scaleX(AXIS_MAX)}
              y2={scaleY(v)}
              stroke="#94a3b8"
              strokeWidth={1}
              strokeDasharray="6 4"
              opacity={0.6}
            />
          </React.Fragment>
        ))}

        {/* ---- Zone labels ---- */}
        {zoneLabels.map((lbl) => (
          <text
            key={lbl.label}
            x={lbl.x}
            y={lbl.y}
            textAnchor="middle"
            dominantBaseline="central"
            fill={lbl.color}
            fontSize={12}
            fontWeight={600}
            opacity={0.35}
            style={{ pointerEvents: "none", userSelect: "none" }}
          >
            {lbl.label}
          </text>
        ))}

        {/* ---- Plot border ---- */}
        <rect
          x={MARGIN.left}
          y={MARGIN.top}
          width={plotW}
          height={plotH}
          fill="none"
          stroke="#d1d5db"
          strokeWidth={1}
          rx={2}
        />

        {/* ---- X-axis ticks & labels ---- */}
        {TICKS.map((t) => (
          <g key={`x-tick-${t}`}>
            <line
              x1={scaleX(t)}
              y1={scaleY(0)}
              x2={scaleX(t)}
              y2={scaleY(0) + 5}
              stroke="#94a3b8"
              strokeWidth={1}
            />
            <text
              x={scaleX(t)}
              y={scaleY(0) + 18}
              textAnchor="middle"
              fill="#64748b"
              fontSize={11}
              fontWeight={500}
            >
              {t}
            </text>
          </g>
        ))}

        {/* ---- Y-axis ticks & labels ---- */}
        {TICKS.map((t) => (
          <g key={`y-tick-${t}`}>
            <line
              x1={scaleX(0) - 5}
              y1={scaleY(t)}
              x2={scaleX(0)}
              y2={scaleY(t)}
              stroke="#94a3b8"
              strokeWidth={1}
            />
            <text
              x={scaleX(0) - 10}
              y={scaleY(t)}
              textAnchor="end"
              dominantBaseline="central"
              fill="#64748b"
              fontSize={11}
              fontWeight={500}
            >
              {t}
            </text>
          </g>
        ))}

        {/* ---- X-axis label ---- */}
        <text
          x={MARGIN.left + plotW / 2}
          y={height - 8}
          textAnchor="middle"
          fill="#334155"
          fontSize={12}
          fontWeight={600}
          letterSpacing={0.3}
        >
          Educational Readiness
        </text>

        {/* ---- Y-axis label ---- */}
        <text
          x={16}
          y={MARGIN.top + plotH / 2}
          textAnchor="middle"
          fill="#334155"
          fontSize={12}
          fontWeight={600}
          letterSpacing={0.3}
          transform={`rotate(-90, 16, ${MARGIN.top + plotH / 2})`}
        >
          Career &amp; Leadership Readiness
        </text>

        {/* ---- Data: density bins ---- */}
        {useDensity &&
          bins.map((bin, i) => {
            const zone = dominantZone(bin.zones);
            const opacity = Math.min(bin.count / 10, 1) * 0.7 + 0.1;
            const bw = (BIN_SIZE / AXIS_MAX) * plotW;
            const bh = (BIN_SIZE / AXIS_MAX) * plotH;
            return (
              <rect
                key={`bin-${i}`}
                x={scaleX(bin.x - BIN_SIZE / 2)}
                y={scaleY(bin.y + BIN_SIZE / 2)}
                width={bw}
                height={bh}
                rx={4}
                fill={getZoneColor(zone)}
                opacity={opacity}
                className="transition-opacity duration-200"
              />
            );
          })}

        {/* ---- Data: individual dots ---- */}
        {!useDensity &&
          points.map((pt) => (
            <circle
              key={pt.id}
              cx={scaleX(pt.x)}
              cy={scaleY(pt.y)}
              r={hoveredPoint?.id === pt.id ? POINT_RADIUS + 2 : POINT_RADIUS}
              fill={getZoneColor(pt.zone)}
              opacity={hoveredPoint && hoveredPoint.id !== pt.id ? 0.3 : 0.8}
              stroke={
                pt.hiringZonePass
                  ? "#1e40af"
                  : hoveredPoint?.id === pt.id
                    ? "#fff"
                    : "transparent"
              }
              strokeWidth={pt.hiringZonePass ? 2 : hoveredPoint?.id === pt.id ? 2 : 0}
              className="cursor-pointer transition-all duration-150"
              onMouseMove={(e) => handleMouseMove(e, pt)}
              onMouseLeave={handleMouseLeave}
              onClick={() => onPointClick?.(pt.id)}
            />
          ))}
      </svg>

      {/* ---- Floating tooltip ---- */}
      {hoveredPoint && (
        <div
          className="absolute pointer-events-none bg-white/95 backdrop-blur-sm rounded-xl shadow-float border border-border/50 px-4 py-3 z-50"
          style={{
            left: tooltipPos.x,
            top: tooltipPos.y,
            transform: "translate(0, -100%)",
          }}
        >
          <p className="text-[13px] font-semibold text-foreground leading-tight">
            {hoveredPoint.name}
          </p>
          <div className="mt-1.5 flex items-center gap-3">
            <span className="text-[11px] text-muted-foreground">
              Edu{" "}
              <span className="font-semibold text-foreground">
                {hoveredPoint.x.toFixed(1)}
              </span>
            </span>
            <span className="text-[11px] text-muted-foreground">
              Career{" "}
              <span className="font-semibold text-foreground">
                {hoveredPoint.y.toFixed(1)}
              </span>
            </span>
          </div>
          <div className="mt-1.5 flex items-center gap-2">
            <span
              className="inline-block w-2 h-2 rounded-full"
              style={{ backgroundColor: getZoneColor(hoveredPoint.zone) }}
            />
            <span className="text-[11px] font-medium" style={{ color: getZoneColor(hoveredPoint.zone) }}>
              {getZoneLabel(hoveredPoint.zone)}
            </span>
            {hoveredPoint.hiringZonePass && (
              <span className="text-[10px] font-semibold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-md">
                HZ Pass
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
