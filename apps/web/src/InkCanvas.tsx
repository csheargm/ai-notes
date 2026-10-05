import type { InkPoint, InkStroke, InkTool } from "@ai-notes/notes";
import {
  Eraser,
  Highlighter,
  Pen,
  MousePointer2,
  Redo2,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";

type Props = {
  strokes: InkStroke[];
  onChange: (
    strokes: InkStroke[],
    size: { width: number; height: number },
  ) => void;
};

const WIDTH = 960;
const HEIGHT = 420;

function point(event: PointerEvent<SVGSVGElement>): InkPoint {
  const rect = event.currentTarget.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) / rect.width) * WIDTH,
    y: ((event.clientY - rect.top) / rect.height) * HEIGHT,
    pressure:
      event.pressure > 0
        ? event.pressure
        : event.pointerType === "mouse"
          ? 0.5
          : 0.35,
    timestamp: event.timeStamp,
  };
}

function pathData(points: InkPoint[]): string {
  if (!points.length) return "";
  if (points.length === 1) return `M ${points[0]!.x} ${points[0]!.y} l .1 .1`;
  return points.reduce(
    (path, item, index) => `${path}${index ? " L" : "M"} ${item.x} ${item.y}`,
    "",
  );
}

function hits(stroke: InkStroke, target: InkPoint): boolean {
  return stroke.points.some(
    (item) => Math.hypot(item.x - target.x, item.y - target.y) < 18,
  );
}

export function InkCanvas({ strokes, onChange }: Props) {
  const [tool, setTool] = useState<InkTool>("pen");
  const [draft, setDraft] = useState<InkStroke>();
  const [selectedId, setSelectedId] = useState<string>();
  const [history, setHistory] = useState<InkStroke[][]>([]);
  const [future, setFuture] = useState<InkStroke[][]>([]);
  const strokesRef = useRef(strokes);

  useEffect(() => {
    strokesRef.current = strokes;
  }, [strokes]);

  const commit = (next: InkStroke[]) => {
    setHistory((items) => [...items.slice(-49), strokesRef.current]);
    setFuture([]);
    strokesRef.current = next;
    onChange(next, { width: WIDTH, height: HEIGHT });
  };

  const undo = () => {
    const previous = history.at(-1);
    if (!previous) return;
    setHistory((items) => items.slice(0, -1));
    setFuture((items) => [strokesRef.current, ...items].slice(0, 50));
    strokesRef.current = previous;
    onChange(previous, { width: WIDTH, height: HEIGHT });
  };

  const redo = () => {
    const next = future[0];
    if (!next) return;
    setFuture((items) => items.slice(1));
    setHistory((items) => [...items, strokesRef.current].slice(-50));
    strokesRef.current = next;
    onChange(next, { width: WIDTH, height: HEIGHT });
  };

  const begin = (event: PointerEvent<SVGSVGElement>) => {
    if (event.pointerType === "touch" && event.width > 35 && event.height > 35)
      return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const nextPoint = point(event);
    if (tool === "select") {
      setSelectedId(
        [...strokesRef.current]
          .reverse()
          .find((stroke) => hits(stroke, nextPoint))?.id,
      );
      return;
    }
    if (tool === "eraser") {
      const next = strokesRef.current.filter(
        (stroke) => !hits(stroke, nextPoint),
      );
      if (next.length !== strokesRef.current.length) commit(next);
      return;
    }
    setDraft({
      id: `stroke_${crypto.randomUUID()}`,
      tool,
      color: tool === "highlighter" ? "#efd36b" : "#244b43",
      width: tool === "highlighter" ? 18 : 3.2,
      points: [nextPoint],
    });
  };

  const move = (event: PointerEvent<SVGSVGElement>) => {
    if (!(event.buttons & 1) && event.pointerType === "mouse") return;
    const nextPoint = point(event);
    if (tool === "eraser") {
      const next = strokesRef.current.filter(
        (stroke) => !hits(stroke, nextPoint),
      );
      if (next.length !== strokesRef.current.length) commit(next);
      return;
    }
    setDraft((current) =>
      current
        ? { ...current, points: [...current.points, nextPoint] }
        : current,
    );
  };

  const finish = () => {
    if (!draft) return;
    commit([...strokesRef.current, draft]);
    setDraft(undefined);
  };

  const rendered = useMemo(
    () => (draft ? [...strokes, draft] : strokes),
    [draft, strokes],
  );

  return (
    <section className="ink-section" aria-label="Handwriting canvas">
      <div className="ink-toolbar">
        <span>Ink</span>
        <div className="ink-tools">
          <button
            className={tool === "pen" ? "active" : ""}
            onClick={() => setTool("pen")}
            aria-label="Pen"
          >
            <Pen size={16} />
          </button>
          <button
            className={tool === "highlighter" ? "active" : ""}
            onClick={() => setTool("highlighter")}
            aria-label="Highlighter"
          >
            <Highlighter size={16} />
          </button>
          <button
            className={tool === "eraser" ? "active" : ""}
            onClick={() => setTool("eraser")}
            aria-label="Eraser"
          >
            <Eraser size={16} />
          </button>
          <button
            className={tool === "select" ? "active" : ""}
            onClick={() => setTool("select")}
            aria-label="Select stroke"
          >
            <MousePointer2 size={16} />
          </button>
          <span className="tool-divider" />
          <button
            disabled={!history.length}
            onClick={undo}
            aria-label="Undo ink"
          >
            <RotateCcw size={16} />
          </button>
          <button
            disabled={!future.length}
            onClick={redo}
            aria-label="Redo ink"
          >
            <Redo2 size={16} />
          </button>
          <button
            disabled={!selectedId && !strokes.length}
            onClick={() => {
              if (selectedId) {
                commit(
                  strokesRef.current.filter(
                    (stroke) => stroke.id !== selectedId,
                  ),
                );
                setSelectedId(undefined);
              } else commit([]);
            }}
            aria-label={selectedId ? "Delete selected stroke" : "Clear ink"}
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>
      <svg
        className={`ink-canvas tool-${tool}`}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        onPointerDown={begin}
        onPointerMove={move}
        onPointerUp={finish}
        onPointerCancel={finish}
        role="img"
        aria-label="Draw with mouse, touch, or Apple Pencil"
      >
        <defs>
          <pattern
            id="dots"
            width="24"
            height="24"
            patternUnits="userSpaceOnUse"
          >
            <circle cx="2" cy="2" r="1.2" fill="#d9ddd8" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#dots)" />
        {rendered.map((stroke) => (
          <path
            key={stroke.id}
            d={pathData(stroke.points)}
            fill="none"
            stroke={stroke.color}
            strokeWidth={
              stroke.width *
              Math.max(
                0.55,
                stroke.points.reduce((sum, item) => sum + item.pressure, 0) /
                  stroke.points.length,
              )
            }
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={stroke.tool === "highlighter" ? 0.48 : 1}
            style={
              stroke.id === selectedId
                ? { filter: "drop-shadow(0 0 5px #4b7b70)" }
                : undefined
            }
          />
        ))}
      </svg>
      <p className="ink-hint">
        Apple Pencil pressure and vector strokes are stored locally with this
        note.
      </p>
    </section>
  );
}
