import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import ThreeGlobe from "three-globe";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { feature } from "topojson-client";

type Location = {
  label: string;
  note?: string;
  coordinates: [number, number];
};

type Props = {
  locations: Location[];
};

export default function InteractiveGlobe({ locations }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const labelledLocations = useMemo(
    () =>
      locations.map((location, index) => ({
        ...location,
        id: `place-${index}`,
        pulseJitter: index,
      })),
    [locations],
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const tooltip = tooltipRef.current;
    let cleanupGlobe: (() => void) | null = null;
    let disposed = false;

    const startGlobe = () => {
      if (disposed || cleanupGlobe) return;
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 1000);
      const latLngToVector = (lat: number, lng: number, radius: number) => {
        const latRad = (lat * Math.PI) / 180;
        const lngRad = (lng * Math.PI) / 180;
        return new THREE.Vector3(
          radius * Math.cos(latRad) * Math.sin(lngRad),
          radius * Math.sin(latRad),
          radius * Math.cos(latRad) * Math.cos(lngRad),
        );
      };
      const initialView = latLngToVector(25, -22, 320);
      camera.position.copy(initialView);
      camera.lookAt(0, 0, 0);
      scene.add(camera);

      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.1));
      container.appendChild(renderer.domElement);

      const ambient = new THREE.AmbientLight(0xffffff, 0.95);
      scene.add(ambient);
      const directional = new THREE.DirectionalLight(0xffffff, 0.7);
      directional.position.set(140, 110, 200);
      scene.add(directional);

      const globe = new ThreeGlobe()
        .pointsData([])
        .ringsData([])
        .arcsData([
          { from: [49.4401, 7.7491], to: [51.5072, -0.1276] },
          { from: [49.4401, 7.7491], to: [48.8294, 8.9192] },
          { from: [49.4401, 7.7491], to: [-22.9068, -43.1729] },
        ])
        .arcStartLat((d: any) => d.from[0])
        .arcStartLng((d: any) => d.from[1])
        .arcEndLat((d: any) => d.to[0])
        .arcEndLng((d: any) => d.to[1])
        .arcStroke(0.2)
        .arcColor(() => "#2a9bb6")
        .arcDashLength(0.45)
        .arcDashGap(0.8)
        .arcDashAnimateTime(2400)
        .polygonsTransitionDuration(0);
      const globeMaterial = globe.globeMaterial() as THREE.MeshPhongMaterial;
      globeMaterial.color = new THREE.Color("#25506f");
      globeMaterial.emissive = new THREE.Color("#18364d");
      globeMaterial.emissiveIntensity = 0.2;
      globeMaterial.shininess = 0.35;
      globeMaterial.transparent = true;
      globeMaterial.opacity = 0.34;
      scene.add(globe);
      const markerGroup = new THREE.Group();
      const pulseGroup = new THREE.Group();
      scene.add(markerGroup);
      scene.add(pulseGroup);
      const markerMeshes: THREE.Mesh[] = [];
      const pulseMeshes: Array<{ mesh: THREE.Mesh; speed: number; offset: number }> = [];
      const markerGeometry = new THREE.SphereGeometry(0.95, 16, 16);
      const pulseGeometry = new THREE.RingGeometry(0.6, 0.95, 56);
      const pulseMaterials: THREE.MeshBasicMaterial[] = [];

      labelledLocations.forEach((location, index) => {
        const normal = latLngToVector(location.coordinates[0], location.coordinates[1], 1).normalize();
        const markerPosition = normal.clone().multiplyScalar(101.4);
        const pulsePosition = normal.clone().multiplyScalar(102.2);

        const marker = new THREE.Mesh(
          markerGeometry,
          new THREE.MeshBasicMaterial({ color: "#ff4f5f" }),
        );
        marker.position.copy(markerPosition);
        markerGroup.add(marker);
        markerMeshes.push(marker);

        const pulseMaterial = new THREE.MeshBasicMaterial({
          color: "#ff5f6e",
          transparent: true,
          opacity: 0.75,
          depthWrite: false,
          side: THREE.DoubleSide,
        });
        pulseMaterials.push(pulseMaterial);
        const pulse = new THREE.Mesh(
          pulseGeometry,
          pulseMaterial,
        );
        pulse.position.copy(pulsePosition);
        pulse.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
        pulseGroup.add(pulse);
        pulseMeshes.push({ mesh: pulse, speed: 0.78 + (index % 4) * 0.12, offset: index * 0.27 });
      });

      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enablePan = false;
      controls.enableDamping = false;
      controls.autoRotate = false;
      controls.minDistance = 88;
      controls.maxDistance = 380;
      controls.minPolarAngle = Math.PI * 0.2;
      controls.maxPolarAngle = Math.PI * 0.8;
      controls.target.set(0, 0, 0);
      controls.update();

      const markerVector = new THREE.Vector3();
      let inViewport = true;
      let interacting = false;
      let documentVisible = document.visibilityState === "visible";
      let lastRender = 0;
      const targetFrameMs = 1000 / 30;

      const visibilityObserver = new IntersectionObserver(
        (entries) => {
          inViewport = entries[0]?.isIntersecting ?? true;
        },
        { threshold: 0.02 },
      );
      visibilityObserver.observe(container);
      const handleVisibilityChange = () => {
        documentVisible = document.visibilityState === "visible";
      };
      document.addEventListener("visibilitychange", handleVisibilityChange);

      const handleMove = (event: PointerEvent) => {
        if (!tooltip) return;
        const rect = renderer.domElement.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        const globeRadius = 100.5;
        let best: { location: Location; sx: number; sy: number; distance: number } | null = null;

        for (const location of labelledLocations) {
          const lat = (location.coordinates[0] * Math.PI) / 180;
          const lng = (location.coordinates[1] * Math.PI) / 180;
          const worldX = globeRadius * Math.cos(lat) * Math.sin(lng);
          const worldY = globeRadius * Math.sin(lat);
          const worldZ = globeRadius * Math.cos(lat) * Math.cos(lng);
          markerVector.set(worldX, worldY, worldZ);
          globe.localToWorld(markerVector);
          markerVector.project(camera);
          if (markerVector.z > 1) continue;
          const sx = (markerVector.x * 0.5 + 0.5) * rect.width;
          const sy = (markerVector.y * -0.5 + 0.5) * rect.height;
          const distance = Math.hypot(sx - x, sy - y);
          if (!best || distance < best.distance) best = { location, sx, sy, distance };
        }

        const hovered = best;
        if (!hovered || hovered.distance > 22) {
          tooltip.style.opacity = "0";
          return;
        }
        const note = hovered.location.note
          ? `<br><span>${hovered.location.note.split("\n").join("<br>")}</span>`
          : "";
        tooltip.innerHTML = `${hovered.location.label}${note}`;
        tooltip.style.opacity = "1";
        tooltip.style.transform = `translate(${hovered.sx + 10}px, ${hovered.sy - 8}px)`;
      };

      renderer.domElement.addEventListener("pointermove", handleMove);
      renderer.domElement.addEventListener("pointerdown", () => {
        interacting = true;
      });
      renderer.domElement.addEventListener("pointerup", () => {
        interacting = false;
      });
      renderer.domElement.addEventListener("pointercancel", () => {
        interacting = false;
      });
      renderer.domElement.addEventListener("wheel", () => {
        interacting = true;
        window.setTimeout(() => {
          interacting = false;
        }, 140);
      });
      renderer.domElement.addEventListener("pointerleave", () => {
        interacting = false;
        if (tooltip) tooltip.style.opacity = "0";
      });

      const resize = () => {
        const size = Math.min(container.clientWidth, 430);
        renderer.setSize(size, size, false);
        camera.aspect = 1;
        camera.updateProjectionMatrix();
      };
      resize();
      window.addEventListener("resize", resize);

      const loadPolygons = async () => {
        try {
          const topo = await fetch("https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json").then((response) => response.json());
          if (disposed) return;
          const countries = feature(topo, topo.objects.countries) as any;
          globe
            .polygonsData(countries.features)
            .polygonAltitude(() => 0.004)
            .polygonCapColor(() => "rgba(194, 211, 223, 0.56)")
            .polygonSideColor(() => "rgba(159, 176, 189, 0.42)")
            .polygonStrokeColor(() => "rgba(209, 230, 246, 0.65)");
        } catch {
          // Keep globe usable even if polygon dataset fails to load.
        }
      };
      void loadPolygons();

      const animate = (now: number) => {
        if (disposed) return;
        if (!documentVisible || (!inViewport && !interacting)) {
          window.setTimeout(() => requestAnimationFrame(animate), 220);
          return;
        }
        if (now - lastRender < targetFrameMs) {
          requestAnimationFrame(animate);
          return;
        }
        lastRender = now;
        const distance = controls.getDistance();
        const normalized = Math.max(0, Math.min(1, (distance - 88) / (380 - 88)));
        const markerScale = 0.16 + normalized * 1.35;
        const pulseScaleBase = 0.34 + normalized * 1.95;
        markerMeshes.forEach((mesh) => {
          mesh.scale.setScalar(markerScale);
        });
        const t = now * 0.001;
        pulseMeshes.forEach(({ mesh, speed, offset }, idx) => {
          const cycle = (t * speed + offset) % 1;
          const spread = pulseScaleBase * (0.3 + cycle * 3.2);
          mesh.scale.setScalar(spread);
          const material = mesh.material as THREE.MeshBasicMaterial;
          material.opacity = Math.max(0, 0.92 * (1 - cycle)) * (0.9 - (idx % 3) * 0.14);
        });
        renderer.render(scene, camera);
        requestAnimationFrame(animate);
      };
      requestAnimationFrame(animate);

      cleanupGlobe = () => {
        visibilityObserver.disconnect();
        document.removeEventListener("visibilitychange", handleVisibilityChange);
        window.removeEventListener("resize", resize);
        renderer.domElement.removeEventListener("pointermove", handleMove);
        controls.dispose();
        markerGeometry.dispose();
        pulseGeometry.dispose();
        markerMeshes.forEach((mesh) => (mesh.material as THREE.Material).dispose());
        pulseMaterials.forEach((material) => material.dispose());
        renderer.dispose();
        scene.clear();
        container.innerHTML = "";
      };
    };
    const startHandler = () => startGlobe();
    window.addEventListener("hero-denoise-complete", startHandler, { once: true });
    const fallback = window.setTimeout(startGlobe, 1400);

    return () => {
      disposed = true;
      window.removeEventListener("hero-denoise-complete", startHandler);
      window.clearTimeout(fallback);
      cleanupGlobe?.();
    };
  }, [labelledLocations]);

  return (
    <div className="interactive-globe" ref={containerRef} aria-label="Interactive globe showing Jan Tauberschmidt's academic and professional locations">
      <div className="globe-tooltip" ref={tooltipRef} aria-hidden="true" />
    </div>
  );
}
