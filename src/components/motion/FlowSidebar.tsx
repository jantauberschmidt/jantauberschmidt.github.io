import { useEffect, useMemo, useRef, useState } from "react";

type Section = {
  id: string;
  label: string;
};

type Props = {
  sections: Section[];
};

const pathId = "flow-sidebar-path";
const viewBoxLeft = -250;
const viewBoxWidth = 520;
const viewBoxHeight = 1000;
const pathStart = -120;
const pathEnd = 1120;
const pathRange = pathEnd - pathStart;
const navTopPercent = 22;
const navRangePercent = 52;

function clamp(value: number) {
  return Math.min(1, Math.max(0, value));
}

export default function FlowSidebar({ sections }: Props) {
  const [active, setActive] = useState(sections[0]?.id ?? "");
  const [progress, setProgress] = useState(0);
  const [reduced, setReduced] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);
  const activePathRef = useRef<SVGPathElement>(null);
  const [particlePoint, setParticlePoint] = useState<{ x: number; y: number } | null>(null);
  const [xRadiusScale, setXRadiusScale] = useState(1);
  const reducedRef = useRef(false);
  const targetProgressRef = useRef(0);
  const displayedProgressRef = useRef(0);
  const progressFrameRef = useRef(0);
  const curveParams = useMemo(() => {
    const rand = (a: number, b: number) => a + Math.random() * (b - a);
    return {
      a1: rand(26, 42),
      a2: rand(10, 18),
      a3: rand(4, 9),
      f1: rand(1.8, 2.7),
      f2: rand(4.6, 6.2),
      f3: rand(8.2, 11.4),
      p1: rand(0, Math.PI * 2),
      p2: rand(0, Math.PI * 2),
      p3: rand(0, Math.PI * 2),
    };
  }, []);
  const pointAt = (progressValue: number) => {
    const y = pathStart + progressValue * pathRange;
    const base =
      Math.sin(progressValue * Math.PI * curveParams.f1 + curveParams.p1) * curveParams.a1 +
      Math.sin(progressValue * Math.PI * curveParams.f2 + curveParams.p2) * curveParams.a2 +
      Math.sin(progressValue * Math.PI * curveParams.f3 + curveParams.p3) * curveParams.a3;
    return { x: 58 + base, y };
  };

  const pathSamples = useMemo(() => Array.from({ length: 140 }, (_, index) => pointAt(index / 139)), [curveParams]);
  const path = useMemo(
    () => pathSamples.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(" "),
    [pathSamples],
  );
  const currentProgress = clamp(progress);
  const currentPoint = useMemo(() => {
    const cumulative = new Array<number>(pathSamples.length).fill(0);
    for (let i = 1; i < pathSamples.length; i += 1) {
      const dx = pathSamples[i].x - pathSamples[i - 1].x;
      const dy = pathSamples[i].y - pathSamples[i - 1].y;
      cumulative[i] = cumulative[i - 1] + Math.hypot(dx, dy);
    }
    const total = cumulative[cumulative.length - 1] || 1;
    const target = currentProgress * total;
    let i = 1;
    while (i < cumulative.length && cumulative[i] < target) i += 1;
    const i1 = Math.min(cumulative.length - 1, i);
    const i0 = Math.max(0, i1 - 1);
    const l0 = cumulative[i0];
    const l1 = cumulative[i1];
    const local = l1 > l0 ? (target - l0) / (l1 - l0) : 0;
    const p0 = pathSamples[i0];
    const p1 = pathSamples[i1];
    return {
      x: p0.x + (p1.x - p0.x) * local,
      y: p0.y + (p1.y - p0.y) * local,
    };
  }, [currentProgress, pathSamples]);
  const currentLabelY = ((navTopPercent + currentProgress * navRangePercent) / 100) * viewBoxHeight;
  const movingOffset = currentLabelY - currentPoint.y;
  const vectorRows = useMemo(() => Array.from({ length: 68 }, (_, index) => -0.85 + (index / 67) * 2.7), []);
  const vectorCols = useMemo(() => [-194, -154, -114, -74, -34, 6, 46, 86, 126], []);
  const arrowField = useMemo(
    () =>
      vectorRows.flatMap((rowProgress) => {
        const center = pointAt(rowProgress);
        const ahead = pointAt(Math.min(1, rowProgress + 0.018));
        const tangentX = ahead.x - center.x;
        const tangentY = ahead.y - center.y;

        return vectorCols.map((dx) => {
          const fieldX = 58 + dx;
          const fieldY = center.y;
          const contractX = center.x - fieldX;
          const rawX = tangentX * 0.2 + contractX * 0.14;
          const rawY = Math.max(8, tangentY * 0.08);
          const norm = Math.hypot(rawX, rawY) || 1;
          const length = 16;
          const unitX = rawX / norm;
          const unitY = rawY / norm;
          const endX = fieldX + unitX * length;
          const endY = fieldY + unitY * length;
          const headLength = 5.2;
          const headWidth = 3.8;
          const baseX = endX - unitX * headLength;
          const baseY = endY - unitY * headLength;
          const perpX = -unitY;
          const perpY = unitX;
          const head = `${endX.toFixed(1)},${endY.toFixed(1)} ${(baseX + perpX * headWidth).toFixed(1)},${(baseY + perpY * headWidth).toFixed(1)} ${(baseX - perpX * headWidth).toFixed(1)},${(baseY - perpY * headWidth).toFixed(1)}`;
          const fadeToContent = fieldX < -8 ? Math.max(0.03, (fieldX + 212) / 204) : 1;
          const opacity = (0.44 - Math.min(0.18, Math.abs(dx) / 900)) * fadeToContent;

          return (
            <g key={`${dx}-${rowProgress}`} opacity={opacity}>
              <path
                d={`M ${fieldX.toFixed(1)} ${fieldY.toFixed(1)} L ${endX.toFixed(1)} ${endY.toFixed(1)}`}
                fill="none"
                stroke="var(--accent-2)"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1"
              />
              <polygon points={head} fill="var(--accent-2)" />
            </g>
          );
        });
      }),
    [vectorCols, vectorRows, curveParams],
  );

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(media.matches);
    reducedRef.current = media.matches;
    const onMedia = () => {
      reducedRef.current = media.matches;
      setReduced(media.matches);
    };
    media.addEventListener("change", onMedia);
    let frame = 0;

    const setProgressTarget = (nextProgress: number) => {
      const next = clamp(nextProgress);
      targetProgressRef.current = next;

      if (reducedRef.current) {
        displayedProgressRef.current = next;
        setProgress(next);
        return;
      }

      if (progressFrameRef.current) return;

      const tick = () => {
        const delta = targetProgressRef.current - displayedProgressRef.current;
        if (Math.abs(delta) < 0.0015) {
          displayedProgressRef.current = targetProgressRef.current;
          progressFrameRef.current = 0;
          setProgress(displayedProgressRef.current);
          return;
        }

        displayedProgressRef.current += delta * 0.22;
        setProgress(displayedProgressRef.current);
        progressFrameRef.current = requestAnimationFrame(tick);
      };

      progressFrameRef.current = requestAnimationFrame(tick);
    };

    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const maxScroll = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
        const targets = sections
          .map((section, index) => {
            const element = document.getElementById(section.id);
            if (!element) return null;
            return {
              id: section.id,
              index,
              scrollY: Math.min(maxScroll, Math.max(0, element.offsetTop)),
            };
          })
          .filter((target): target is { id: string; index: number; scrollY: number } => Boolean(target))
          .sort((a, b) => a.scrollY - b.scrollY);

        if (targets.length === 0) {
          setActive(sections[0]?.id ?? "");
          setProgressTarget(0);
          return;
        }

        const currentScroll = window.scrollY;
        let activeId = targets[0].id;
        for (let i = 0; i < targets.length; i += 1) {
          const current = targets[i];
          const next = targets[i + 1];
          if (!next) {
            activeId = current.id;
            break;
          }
          if (currentScroll >= current.scrollY && currentScroll < next.scrollY) {
            activeId = current.id;
            break;
          }
        }
        setActive(activeId);

        if (targets.length === 1) {
          setProgressTarget(0);
          return;
        }

        if (currentScroll <= targets[0].scrollY) {
          setProgressTarget(0);
          return;
        }
        if (currentScroll >= targets[targets.length - 1].scrollY) {
          setProgressTarget(1);
          return;
        }

        let segmentIndex = 0;
        for (let i = 0; i < targets.length - 1; i += 1) {
          const a = targets[i];
          const b = targets[i + 1];
          if (currentScroll >= a.scrollY && currentScroll < b.scrollY) {
            segmentIndex = i;
            break;
          }
        }

        const segmentStart = targets[segmentIndex];
        const segmentEnd = targets[segmentIndex + 1];
        const local = clamp((currentScroll - segmentStart.scrollY) / Math.max(1, segmentEnd.scrollY - segmentStart.scrollY));
        const normalized = (segmentIndex + local) / (targets.length - 1);
        setProgressTarget(normalized);
      });
    };

    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);

    return () => {
      media.removeEventListener("change", onMedia);
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      cancelAnimationFrame(frame);
      cancelAnimationFrame(progressFrameRef.current);
      progressFrameRef.current = 0;
    };
  }, [sections]);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    const updateScale = () => {
      const rect = svg.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      const scaleX = rect.width / viewBoxWidth;
      const scaleY = rect.height / viewBoxHeight;
      setXRadiusScale(scaleY / scaleX);
    };

    updateScale();
    const observer = new ResizeObserver(updateScale);
    observer.observe(svg);
    window.addEventListener("resize", updateScale);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateScale);
    };
  }, []);

  useEffect(() => {
    const activePath = activePathRef.current;
    if (!activePath) return;
    const length = activePath.getTotalLength();
    const point = activePath.getPointAtLength(length * currentProgress);
    setParticlePoint({ x: point.x, y: point.y });
  }, [currentProgress, path]);

  return (
    <aside className="flow-sidebar" aria-label="Section progress">
      <svg ref={svgRef} className="flow-svg" viewBox={`${viewBoxLeft} 0 ${viewBoxWidth} ${viewBoxHeight}`} preserveAspectRatio="none" aria-hidden="true">
        <g transform={`translate(0 ${movingOffset})`}>
          {!reduced && <g className="flow-arrows">{arrowField}</g>}
          <path id={pathId} d={path} fill="none" stroke="var(--border)" strokeWidth="1.4" />
          <path ref={activePathRef} d={path} fill="none" stroke="var(--accent)" strokeWidth="1.8" pathLength={1} strokeDasharray={`${currentProgress} 1`} />
          {sections.map((section, index) => {
            const point = pointAt(sections.length <= 1 ? 0 : index / (sections.length - 1));
            return (
            <ellipse key={sections[index].id} cx={point.x} cy={point.y} rx={2.4 * xRadiusScale} ry="2.4" fill={active === sections[index].id ? "var(--accent)" : "var(--border)"} />
            );
          })}
          <ellipse cx={(particlePoint ?? currentPoint).x} cy={(particlePoint ?? currentPoint).y} rx={10 * xRadiusScale} ry="10" fill="none" stroke="var(--accent)" opacity="0.24" />
          <ellipse cx={(particlePoint ?? currentPoint).x} cy={(particlePoint ?? currentPoint).y} rx={5.2 * xRadiusScale} ry="5.2" fill="var(--accent)" />
        </g>
      </svg>
      <nav className="flow-labels">
        {sections.map((section, index) => {
          const labelY = sections.length <= 1 ? 0.5 : index / (sections.length - 1);

          return (
            <a
              key={section.id}
              className={active === section.id ? "active" : ""}
              href={`#${section.id}`}
              onClick={(event) => {
                event.preventDefault();
                const element = document.getElementById(section.id);
                if (!element) return;
                const maxScroll = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
                const targetY = Math.min(maxScroll, Math.max(0, element.offsetTop));
                window.scrollTo({ top: targetY, behavior: "smooth" });
                window.history.replaceState(null, "", `#${section.id}`);
              }}
              style={{
                top: `${navTopPercent + labelY * navRangePercent}%`,
              }}
            >
              <span className="flow-label-dot" aria-hidden="true" />
              {section.label}
            </a>
          );
        })}
      </nav>
    </aside>
  );
}
