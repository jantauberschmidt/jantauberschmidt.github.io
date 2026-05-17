import { useEffect, useState } from "react";

type Location = {
  label: string;
  note?: string;
  coordinates: [number, number];
};

type Props = {
  locations: Location[];
};

type GlobeComponent = typeof import("./InteractiveGlobe").default;

export default function DeferredGlobe({ locations }: Props) {
  const [Globe, setGlobe] = useState<GlobeComponent | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const module = await import("./InteractiveGlobe");
      if (!cancelled) setGlobe(() => module.default);
    };

    const onReady = () => {
      void load();
    };

    window.addEventListener("hero-denoise-complete", onReady, { once: true });
    const fallback = window.setTimeout(onReady, 1400);

    return () => {
      cancelled = true;
      window.removeEventListener("hero-denoise-complete", onReady);
      window.clearTimeout(fallback);
    };
  }, []);

  if (!Globe) {
    return <div className="interactive-globe interactive-globe-placeholder" aria-hidden="true" />;
  }

  return <Globe locations={locations} />;
}
