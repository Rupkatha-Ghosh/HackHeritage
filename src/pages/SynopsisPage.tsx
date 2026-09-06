import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  motion,
  useMotionValueEvent,
  useScroll,
  useSpring,
  useTransform,
} from "motion/react";
import {
  Activity,
  Anchor,
  ArrowDown,
  ArrowRight,
  BookOpen,
  Compass,
  Globe,
  Layers,
  Radio,
  Satellite,
  ShieldCheck,
  SlidersHorizontal,
  Waves,
  Volume2,
  VolumeX,
} from "lucide-react";
import { ContourField } from "../components/ui/ContourField";
import { DepthMarker } from "../components/ui/DepthMarker";
import { Reveal } from "../components/ui/Reveal";
import { SpotlightCard } from "../components/ui/SpotlightCard";
import { GlassPanel } from "../components/ui/GlassPanel";
import { ShimmerText } from "../components/ui/ShimmerText";
import { SoundingNumber } from "../components/ui/SoundingNumber";
import { hydrophoneEngine } from "../services/hydrophoneAudio";
import { AttractButton } from "../components/ui/AttractButton";
import { Marquee } from "../components/ui/Marquee";
import { BentoGrid, BentoCell } from "../components/ui/BentoGrid";
import { TrackLine, TrackStep } from "../components/ui/TrackLine";
import { COASTAL_LOCATIONS } from "../data/coastalData";
import { IndianCoastalMap } from "../components/IndianCoastalMap";
import { createTimeline, stagger, withMotion } from "../lib/anime";
/* ---------------------------------------------------------------------------
   Content. Every threshold and authority below is drawn from the evidence
   corpus the running system actually retrieves.
   ------------------------------------------------------------------------ */

const LAUNCH_THRESHOLDS = [
  {
    value: 1.8,
    precision: 1,
    suffix: " m",
    label: "Significant wave height",
    note: "Above this, nearshore breakers capsize craft under 10 m",
    authority: "INCOIS",
  },
  {
    value: 14,
    precision: 0,
    suffix: " s",
    label: "Swell period",
    note: "Long-period swell on a calm-looking morning ends beach launching",
    authority: "INCOIS",
  },
  {
    value: 30,
    precision: 0,
    suffix: " kt",
    label: "Gust ceiling",
    note: "Squally gusts past this bar deep-sea ventures outright",
    authority: "IMD",
  },
  {
    value: 5,
    precision: 0,
    suffix: " nm",
    label: "Shelter radius",
    note: "Rough-to-very-rough seas confine small trawlers to this range",
    authority: "IMD",
  },
];

const AUTHORITIES = [
  {
    name: "INCOIS",
    doc: "Ocean State Forecast",
    detail:
      "Wave height and swell-surge thresholds for artisanal craft, refreshed on its own cycle.",
  },
  {
    name: "IMD",
    doc: "Cyclone & squall bulletins",
    detail:
      "Squally-wind staging and Douglas sea-state grading for the Bay of Bengal coastal strips.",
  },
  {
    name: "CMFRI",
    doc: "Potential fishing zones",
    detail:
      "Satellite thermal fronts and chlorophyll advisories — where the catch is, not whether it is safe.",
  },
  {
    name: "Indian Coast Guard",
    doc: "Safety-equipment SOP",
    detail:
      "Lifejackets, VHF Channel 16, AIS-140 transponders, flares. Mandatory beyond three nautical miles.",
  },
  {
    name: "IMO",
    doc: "SOLAS V / Reg. 34",
    detail:
      "Voyage planning against charts, tidal windows and alternate anchorages before proceeding to sea.",
  },
];

const PIPELINE: TrackStep[] = [
  {
    agent: "Planner",
    title: "Read the question",
    role: "Works out what the question is actually asking — a craft type, a place, an hour — and which observations an honest answer needs.",
    emits: "A resolved intent and the list of agents to run",
  },
  {
    agent: "LocationTimeResolver",
    title: "Fix the position and the hour",
    role: "Turns “near Digha tomorrow morning” into coordinates, a depth, a nearest harbour and a bounded forecast window.",
    emits: "Latitude, longitude, region type, resolved time window",
  },
  {
    agent: "WeatherAgent",
    title: "Sound the atmosphere",
    role: "Pulls live wind speed and gusts, direction, visibility, precipitation and pressure for the fixed position.",
    emits: "Observed weather with its provider and timestamp",
    fallback: "The run is marked degraded — no figure is invented",
  },
  {
    agent: "OceanAgent",
    title: "Sound the water column",
    role: "Reads wave height, swell height and period, sea-surface temperature, current set and drift, and the tide phase.",
    emits: "Sea state, Douglas index, tide phase",
    fallback: "The run is marked degraded — no figure is invented",
  },
  {
    agent: "SatelliteAgent",
    title: "Find the most recent pass",
    role: "Searches the Copernicus Sentinel catalogue for the nearest recent acquisition over the position and reports its age.",
    emits: "Product identifiers, acquisition time, cloud cover",
    fallback: "Reported unavailable rather than simulated",
  },
  {
    agent: "RiskEngine",
    title: "Score the launch",
    role: "Runs a deterministic threshold engine alongside an XGBoost model, and attributes the score to the features that drove it.",
    emits: "Risk level, confidence, per-feature contributions",
    fallback: "Deterministic rules alone, flagged in the trace",
  },
  {
    agent: "GisAgent",
    title: "Draw the water",
    role: "Assembles hazard zones, precaution zones, safe corridors, port shelters and buoy stations as chart layers.",
    emits: "GeoJSON layers keyed to risk level",
  },
  {
    agent: "EvidenceRetrieval",
    title: "Find the rule that governs it",
    role: "Embeds the question with BGE-M3 and searches Qdrant for the passages and compliance rules that apply.",
    emits: "Ranked evidence with authority and compliance rule",
    fallback: "Lexical retrieval, and the trace says so",
  },
  {
    agent: "ResponseGrounding",
    title: "Write the advisory",
    role: "Composes the answer against the retrieved evidence, in the language the question was asked in, naming what is restricted and what is permitted.",
    emits: "Grounded advisory, craft restrictions, statutory notice",
  },
];

const BOUNDARIES = [
  {
    head: "The model is not validated for this coast",
    body: "The committed XGBoost model is explicitly flagged as unvalidated for the Indian coastal deployment domain. Every response carries that flag rather than burying it.",
  },
  {
    head: "Satellite means catalogue, not imagery analysis",
    body: "ORCA-X searches Copernicus Sentinel catalogue metadata and reports what passed overhead and when. It does not derive features from the pixels.",
  },
  {
    head: "Degraded runs announce themselves",
    body: "When a weather, ocean or retrieval provider fails, the response is marked degraded and the trace names the fallback. Synthetic telemetry is never substituted for a live measurement.",
  },
  {
    head: "It does not outrank the authorities",
    body: "ORCA-X is decision support. It does not supersede statutory warnings from INCOIS, IMD, the Maritime Rescue Coordination Centres or any competent authority.",
  },
];

/* ---------------------------------------------------------------------------
   Depth gauge — a fixed sounder readout tying scroll position to the metaphor
   ------------------------------------------------------------------------ */

const MAX_DEPTH = 1000;

const DepthGauge: React.FC = () => {
  const { scrollYProgress } = useScroll();
  const smooth = useSpring(scrollYProgress, {
    stiffness: 80,
    damping: 24,
    restDelta: 0.001,
  });
  const depth = useTransform(smooth, [0, 1], [0, MAX_DEPTH]);
  const fillHeight = useTransform(smooth, (v) => `${v * 100}%`);
  const markerTop = useTransform(smooth, (v) => `calc(${v * 100}% - 3.5px)`);
  const [reading, setReading] = useState(0);

  useMotionValueEvent(depth, "change", (v) => setReading(Math.round(v)));

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed right-6 top-1/2 z-30 hidden -translate-y-1/2 flex-col items-end gap-3 xl:flex"
    >
      <span className="font-mono text-[10px] italic tabular-nums text-shoal">
        &minus;{reading.toLocaleString("en-IN")}&thinsp;m
      </span>
      <div className="relative h-52 w-px bg-shoal/15">
        <motion.div
          className="absolute inset-x-0 top-0 bg-gradient-to-b from-shoal to-buoy"
          style={{ height: fillHeight }}
        />
        <motion.span
          className="absolute -right-[3px] h-[7px] w-[7px] rotate-45 border border-buoy bg-abyssal"
          style={{ top: markerTop }}
        />
      </div>
      <span className="plate-label [writing-mode:vertical-rl]">Sounder</span>
    </div>
  );
};

/* ---------------------------------------------------------------------------
   Page
   ------------------------------------------------------------------------ */

interface SynopsisPageProps {
  onEnterConsole: () => void;
}

export const SynopsisPage: React.FC<SynopsisPageProps> = ({ onEnterConsole }) => {
  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll();
  const fieldY = useTransform(scrollYProgress, [0, 1], ["0%", "12%"]);
  const fieldOpacity = useTransform(scrollYProgress, [0, 0.35, 1], [1, 0.7, 0.32]);
  const [isAudioActive, setIsAudioActive] = useState<boolean>(false);

  useEffect(() => {
    const unsubscribe = hydrophoneEngine.subscribe((active) => {
      setIsAudioActive(active);
    });
    return () => unsubscribe();
  }, []);

  const handleToggleAudio = () => {
    hydrophoneEngine.toggleAudio();
  };

  // The page-load sequence: the headline rises line by line, then the rail and
  // the actions settle in behind it. One orchestrated moment, not scattered effects.
  //
  // `useLayoutEffect`, not `useEffect`: the hero lines start at
  // `motion-safe:opacity-0`, so this has to claim them before the browser
  // paints. On `useEffect` the first frame would show a blank headline.
  useLayoutEffect(() => {
    const root = heroRef.current;
    if (!root) return;

    const lines = root.querySelectorAll<HTMLElement>("[data-hero-line]");
    const tail = root.querySelectorAll<HTMLElement>("[data-hero-tail]");

    return withMotion(
      () => {
        const tl = createTimeline({ defaults: { ease: "out(3)" } });
        tl.add(lines, {
          y: ["112%", "0%"],
          opacity: [0, 1],
          duration: 980,
          delay: stagger(110),
        }).add(
          tail,
          {
            y: [16, 0],
            opacity: [0, 1],
            duration: 720,
            delay: stagger(90),
          },
          "-=520",
        );
        return tl;
      },
      () => {
        [...lines, ...tail].forEach((node) => {
          node.style.opacity = "1";
          node.style.transform = "none";
        });
      },
    );
  }, []);

  const stations = Object.values(COASTAL_LOCATIONS).map(
    (loc) => `${loc.name} · ${loc.state ?? loc.country} · ${loc.depthMeters ?? "—"} m`,
  );

  return (
    <div className="relative min-h-screen overflow-x-clip bg-abyssal text-chartpaper">
      {/* Signature: one contour plate behind the whole descent. */}
      <motion.div
        style={{ y: fieldY, opacity: fieldOpacity }}
        className="fixed inset-0 z-0"
      >
        <ContourField className="h-full w-full" lines={28} />
      </motion.div>
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-0 bg-gradient-to-b from-abyssal/20 via-abyssal/55 to-abyssal"
      />

      <DepthGauge />

      {/* ---- Top rail ---------------------------------------------------- */}
      <header className="sticky top-0 z-40 border-b border-shoal/10 bg-abyssal/72 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3.5 sm:px-8">
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center border border-shoal/35 bg-shoal/10">
              <Waves className="h-4 w-4 text-shoal" />
            </span>
            <span className="font-display text-base font-bold tracking-tight">
              ORCA&#8209;X
            </span>
            <span className="hidden font-mono text-[10px] tracking-[0.2em] text-fathom sm:inline">
              OCEAN REASONING &amp; COLLABORATIVE AI
            </span>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={handleToggleAudio}
              title={isAudioActive ? "Mute hydrophone audio" : "Enable hydrophone ocean audio"}
              className={`flex items-center gap-2 rounded-full border px-3 py-1 font-mono text-[10px] uppercase tracking-[0.15em] transition-all ${
                isAudioActive
                  ? "border-shoal/60 bg-shoal/20 text-shoal shadow-sm shadow-shoal/30"
                  : "border-shoal/20 bg-shoal/5 text-fathom hover:border-shoal/40 hover:text-shoal"
              }`}
            >
              {isAudioActive ? (
                <>
                  <Volume2 className="h-3.5 w-3.5 text-shoal animate-pulse" />
                  <span>Hydrophone On</span>
                </>
              ) : (
                <>
                  <VolumeX className="h-3.5 w-3.5 text-fathom" />
                  <span>Hydrophone Off</span>
                </>
              )}
            </button>

            <button
              onClick={onEnterConsole}
              className="group flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-shoal transition-colors hover:text-buoy"
            >
              Live console
              <ArrowRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-1" />
            </button>
          </div>
        </div>
      </header>

      <main className="relative z-10">
        {/* ---- Hero ------------------------------------------------------ */}
        <section
          ref={heroRef}
          className="mx-auto max-w-6xl px-5 pb-16 pt-16 sm:px-8 sm:pb-24 sm:pt-24"
        >
          <div
            data-hero-tail
            className="mb-8 flex flex-wrap items-center gap-x-4 gap-y-2 motion-safe:opacity-0"
          >
            <span className="plate-label">Smart India Hackathon</span>
            <span aria-hidden="true" className="h-px w-8 bg-shoal/30" />
            <span className="flex items-center gap-2 font-mono text-[10px] tracking-[0.16em] text-shoal/75">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400/70" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
              </span>
              MARINE DECISION SUPPORT
            </span>
          </div>

          <h1 className="font-display text-[2.6rem] font-bold leading-[0.98] tracking-[-0.03em] sm:text-6xl lg:text-[5.25rem]">
            <span className="block overflow-hidden pb-1">
              <span data-hero-line className="block motion-safe:opacity-0">
                Every forecast this coast
              </span>
            </span>
            <span className="block overflow-hidden pb-1">
              <span data-hero-line className="block motion-safe:opacity-0">
                needs already exists.
              </span>
            </span>
            <span className="block overflow-hidden pb-1">
              <span data-hero-line className="block motion-safe:opacity-0">
                <ShimmerText>None of it arrives</ShimmerText>
              </span>
            </span>
            <span className="block overflow-hidden pb-1">
              <span data-hero-line className="block motion-safe:opacity-0">
                <ShimmerText>as an answer.</ShimmerText>
              </span>
            </span>
          </h1>

          <p
            data-hero-tail
            className="mt-8 max-w-2xl text-[15px] leading-relaxed text-slate-300 motion-safe:opacity-0 sm:text-base"
          >
            ORCA&#8209;X reads one question — asked in Bengali, Hindi, Tamil, Odia,
            Telugu or English — and answers it with a single decision: whether
            this craft can leave this harbour in this window. It sounds the live
            atmosphere and water column, scores the launch, and cites the
            authority whose rule governs the call.
          </p>

          <div
            data-hero-tail
            className="mt-10 flex flex-col gap-3 motion-safe:opacity-0 sm:flex-row sm:items-center sm:gap-4"
          >
            <AttractButton onClick={onEnterConsole}>
              Open the live console
              <ArrowRight className="h-3.5 w-3.5" />
            </AttractButton>
            <a
              href="#method"
              className="group inline-flex items-center justify-center gap-2.5 rounded-sm border border-shoal/25 px-7 py-3.5 font-mono text-[11px] uppercase tracking-[0.22em] text-shoal transition-colors duration-300 hover:border-shoal/60 hover:bg-shoal/5"
            >
              Follow the pipeline
              <ArrowDown className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-y-0.5" />
            </a>
          </div>

          {/* The four numbers that actually decide a launch. */}
          <div
            data-hero-tail
            className="mt-16 grid grid-cols-2 gap-px overflow-hidden border border-shoal/12 bg-shoal/8 motion-safe:opacity-0 lg:grid-cols-4"
          >
            {LAUNCH_THRESHOLDS.map((item) => (
              <div key={item.label} className="bg-abyssal/85 p-5">
                <div className="font-display text-3xl font-bold tracking-tight text-shoal sm:text-[2.4rem]">
                  <SoundingNumber
                    value={item.value}
                    precision={item.precision}
                    suffix={item.suffix}
                  />
                </div>
                <div className="mt-2 text-[12.5px] font-medium text-chartpaper">
                  {item.label}
                </div>
                <p className="mt-1.5 text-[11.5px] leading-snug text-fathom">
                  {item.note}
                </p>
                <span className="mt-3 inline-block font-mono text-[9.5px] tracking-[0.18em] text-buoy/80">
                  {item.authority}
                </span>
              </div>
            ))}
          </div>

          <p className="mt-4 max-w-2xl text-[12px] leading-relaxed text-fathom mb-12">
            These are the published limits, not our estimates. The work is
            getting them to the person standing on the sand at four in the
            morning.
          </p>

          {/* ---- Interactive Coastal Hub Surveillance Map (Option 2) ---- */}
          <div className="my-12">
            <IndianCoastalMap onSelectPort={() => onEnterConsole()} />
          </div>
        </section>

        {/* ---- Station rail ---------------------------------------------- */}
        <section className="border-y border-shoal/10 bg-abyssal/60 py-4">
          <Marquee items={stations} />
        </section>

        {/* ---- −12 m · The gap ------------------------------------------- */}
        <section className="mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-28">
          <Reveal>
            <DepthMarker depth={12} label="Where the problem begins" />
          </Reveal>

          <Reveal delay={0.08}>
            <h2 className="mt-9 max-w-3xl font-display text-3xl font-bold leading-[1.08] tracking-[-0.02em] sm:text-[2.75rem]">
              Nothing is missing. Everything is scattered.
            </h2>
          </Reveal>

          <Reveal delay={0.14}>
            <p className="mt-6 max-w-2xl text-[15px] leading-relaxed text-slate-300">
              Five authorities publish everything needed to keep a small craft
              alive off the Indian coast. They publish it in five formats, on
              five schedules, for five different readers — and none of those
              readers is one skipper deciding whether to launch in the next six
              hours.
            </p>
          </Reveal>

          <div className="mt-12 grid gap-3 lg:grid-cols-3">
            {[
              {
                icon: <BookOpen className="h-4 w-4" />,
                sheet: "Fragmentation",
                head: "Five sources, five formats",
                body: "An ocean-state forecast, a squall bulletin, a fishing-zone advisory, an equipment SOP and a voyage-planning regulation. Each authoritative. None of them speaks to the others.",
              },
              {
                icon: <Compass className="h-4 w-4" />,
                sheet: "Resolution",
                head: "Sea areas, not harbours",
                body: "A bulletin covers a sea area for a day. The decision is a specific launch, from a specific beach, inside a specific window — at a depth and tide the bulletin never mentions.",
              },
              {
                icon: <Globe className="h-4 w-4" />,
                sheet: "Language",
                head: "Published in English, as prose",
                body: "The coast this serves reads Bengali, Odia, Tamil, Telugu and Hindi. A threshold buried in an English PDF is not a warning; it is a document.",
              },
            ].map((card, i) => (
              <Reveal key={card.sheet} delay={0.06 * i}>
                <SpotlightCard className="h-full">
                  <div className="flex h-full flex-col p-6">
                    <div className="flex items-center justify-between">
                      <span className="plate-label">{card.sheet}</span>
                      <span className="text-shoal/70">{card.icon}</span>
                    </div>
                    <h3 className="mt-5 font-display text-xl font-semibold leading-tight">
                      {card.head}
                    </h3>
                    <p className="mt-3 text-[13.5px] leading-relaxed text-slate-300">
                      {card.body}
                    </p>
                  </div>
                </SpotlightCard>
              </Reveal>
            ))}
          </div>

          {/* The corpus, listed plainly — these are the documents in Qdrant. */}
          <Reveal delay={0.1}>
            <GlassPanel className="mt-3" ruled>
              <div className="p-6 sm:p-8">
                <span className="plate-label">
                  The corpus ORCA&#8209;X reconciles
                </span>
                <ul className="mt-6 divide-y divide-shoal/10">
                  {AUTHORITIES.map((a) => (
                    <li
                      key={a.name}
                      className="grid gap-1.5 py-4 sm:grid-cols-[9.5rem_11rem_1fr] sm:items-baseline sm:gap-5"
                    >
                      <span className="font-mono text-[11px] tracking-[0.14em] text-buoy">
                        {a.name}
                      </span>
                      <span className="hydrographic text-[13px] text-shoal">
                        {a.doc}
                      </span>
                      <span className="text-[13px] leading-relaxed text-slate-300">
                        {a.detail}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </GlassPanel>
          </Reveal>

          <Reveal delay={0.06}>
            <blockquote className="mt-14 max-w-3xl border-l-2 border-buoy/60 pl-6">
              <p className="font-display text-xl font-medium leading-[1.35] text-chartpaper sm:text-2xl">
                What capsizes a boat off Digha is rarely a cyclone anyone was
                warned about. It is a fourteen&#8209;second swell arriving under a
                clear sky, or wind turning against an ebbing tide.
              </p>
              <footer className="mt-4 text-[12px] text-fathom">
                Both conditions are published. Neither is legible in time.
              </footer>
            </blockquote>
          </Reveal>
        </section>

        {/* ---- −40 m · The instrument ------------------------------------ */}
        <section className="mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-28">
          <Reveal>
            <DepthMarker depth={40} label="What ORCA-X does" />
          </Reveal>

          <Reveal delay={0.08}>
            <h2 className="mt-9 max-w-3xl font-display text-3xl font-bold leading-[1.08] tracking-[-0.02em] sm:text-[2.75rem]">
              One question in. One decision out.
            </h2>
          </Reveal>

          <Reveal delay={0.14}>
            <p className="mt-6 max-w-2xl text-[15px] leading-relaxed text-slate-300">
              ORCA&#8209;X is a reconciliation layer, not another feed. Nine agents
              run against live providers, a risk engine and a retrieval index,
              and collapse the result into an advisory a skipper can act on —
              with every step of the reasoning left open to inspection.
            </p>
          </Reveal>

          <BentoGrid className="mt-12">
            <BentoCell
              sheet="Plate A"
              title="Ask in the language you think in"
              span={3}
              tall
              icon={<Globe className="h-4 w-4" />}
              delay={0}
            >
              <p>
                Bengali, Hindi, Tamil, Odia, Telugu and English. The answer comes
                back naming the craft types restricted and the craft types
                permitted, in the same language — not a table of figures to
                interpret.
              </p>
              <ul className="mt-5 flex flex-wrap gap-1.5">
                {["বাংলা", "हिन्दी", "தமிழ்", "ଓଡ଼ିଆ", "తెలుగు", "English"].map(
                  (lang) => (
                    <li
                      key={lang}
                      className="border border-shoal/20 px-2.5 py-1 font-mono text-[11px] text-shoal"
                    >
                      {lang}
                    </li>
                  ),
                )}
              </ul>
            </BentoCell>

            <BentoCell
              sheet="Plate B"
              title="Live observation, or an honest gap"
              span={3}
              tall
              icon={<Radio className="h-4 w-4" />}
              delay={0.06}
            >
              <p>
                Weather and marine conditions come from live providers; satellite
                passes from the Copernicus catalogue. When a provider fails,
                ORCA&#8209;X marks the run degraded and names the fallback in the
                trace.
              </p>
              <p className="mt-4 border-l-2 border-buoy/50 pl-4 text-[13px] text-amber-200/85">
                A synthetic wave height is never substituted for a measured one.
                An empty reading is safer than a confident guess.
              </p>
            </BentoCell>

            <BentoCell
              sheet="Plate C"
              title="A score you can take apart"
              span={2}
              icon={<Activity className="h-4 w-4" />}
              delay={0}
            >
              A deterministic threshold engine runs alongside an XGBoost model,
              and every score is broken back down into the features that drove
              it — wave height, gust, swell period, tide phase — with its weight
              shown.
            </BentoCell>

            <BentoCell
              sheet="Plate D"
              title="Grounded in the actual rule"
              span={2}
              icon={<BookOpen className="h-4 w-4" />}
              delay={0.06}
            >
              Questions are embedded with BGE&#8209;M3 and searched against the
              authority corpus in Qdrant. Advisories cite the document, the
              publication date and the compliance rule they rest on.
            </BentoCell>

            <BentoCell
              sheet="Plate E"
              title="Drawn on the water"
              span={2}
              icon={<Layers className="h-4 w-4" />}
              delay={0.12}
            >
              Hazard zones, precaution zones, safe corridors, port shelters and
              buoy stations are rendered as chart layers keyed to the current
              risk level — so the advisory has a geography.
            </BentoCell>

            <BentoCell
              sheet="Plate F"
              title="Ask what would have to change"
              span={3}
              icon={<SlidersHorizontal className="h-4 w-4" />}
              delay={0}
            >
              The what&#8209;if studio perturbs wind, swell and tide against the same
              engine, so a harbour master can find the exact condition that
              flips a launch from permitted to restricted — and how much margin
              is left.
            </BentoCell>

            <BentoCell
              sheet="Plate G"
              title="Watch it think"
              span={3}
              icon={<Satellite className="h-4 w-4" />}
              delay={0.06}
            >
              Every run publishes its own execution trace: which agent ran, how
              long it took, what it received, what it emitted and where it fell
              back. The reasoning is a first&#8209;class output, not a log file.
            </BentoCell>
          </BentoGrid>
        </section>

        {/* ---- −200 m · The track --------------------------------------- */}
        <section
          id="method"
          className="mx-auto max-w-6xl scroll-mt-20 px-5 py-20 sm:px-8 sm:py-28"
        >
          <Reveal>
            <DepthMarker depth={200} label="The pipeline, fix by fix" />
          </Reveal>

          <Reveal delay={0.08}>
            <h2 className="mt-9 max-w-3xl font-display text-3xl font-bold leading-[1.08] tracking-[-0.02em] sm:text-[2.75rem]">
              A plotted course from question to advisory.
            </h2>
          </Reveal>

          <Reveal delay={0.14}>
            <p className="mt-6 max-w-2xl text-[15px] leading-relaxed text-slate-300">
              Nine agents run in order, each one leaving a fix on the record. The
              console shows this same track live, with real durations — so an
              operator can see precisely where an answer came from, and where it
              had to compromise.
            </p>
          </Reveal>

          <TrackLine steps={PIPELINE} className="mt-14" />

          <Reveal>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-shoal/12 pt-6 font-mono text-[10.5px] tracking-[0.14em] text-fathom">
              <span>
                <span className="text-shoal">9</span> AGENTS
              </span>
              <span>
                <span className="text-shoal">4</span> SERVICES
              </span>
              <span>
                <span className="text-shoal">1024</span>&#8209;DIM EMBEDDINGS
              </span>
              <span>
                <span className="text-shoal">17</span> STATIONS
              </span>
              <span>
                <span className="text-shoal">6</span> LANGUAGES
              </span>
            </div>
          </Reveal>
        </section>

        {/* ---- −620 m · The limits -------------------------------------- */}
        <section className="mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-28">
          <Reveal>
            <DepthMarker depth={620} label="What it will not claim" />
          </Reveal>

          <Reveal delay={0.08}>
            <h2 className="mt-9 max-w-3xl font-display text-3xl font-bold leading-[1.08] tracking-[-0.02em] sm:text-[2.75rem]">
              The boundaries are part of the output.
            </h2>
          </Reveal>

          <Reveal delay={0.14}>
            <p className="mt-6 max-w-2xl text-[15px] leading-relaxed text-slate-300">
              A safety tool that hides its own limits is a hazard. ORCA&#8209;X
              surfaces these four through the workflow trace on every single run,
              so nobody mistakes an unavailable capability for a completed one.
            </p>
          </Reveal>

          <div className="mt-12 grid gap-3 sm:grid-cols-2">
            {BOUNDARIES.map((item, i) => (
              <Reveal key={item.head} delay={0.05 * i}>
                <div className="h-full rounded-sm border border-amber-500/18 bg-amber-950/12 p-6">
                  <div className="flex items-start gap-3">
                    <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-buoy" />
                    <h3 className="font-display text-lg font-semibold leading-tight text-amber-100">
                      {item.head}
                    </h3>
                  </div>
                  <p className="mt-3 pl-7 text-[13.5px] leading-relaxed text-slate-300">
                    {item.body}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* ---- −1000 m · Enter the console ------------------------------ */}
        <section className="mx-auto max-w-6xl px-5 pb-24 pt-6 sm:px-8 sm:pb-32">
          <Reveal>
            <GlassPanel className="relative overflow-hidden">
              <ContourField
                className="absolute inset-0 h-full w-full opacity-45"
                lines={16}
                soundings={false}
                seed={4408}
                animateIn={false}
              />
              <div className="relative px-6 py-16 text-center sm:px-12 sm:py-20">
                <DepthMarker
                  depth={1000}
                  label="Working depth"
                  className="justify-center [&>span:last-child]:hidden"
                />

                <h2 className="mx-auto mt-8 max-w-2xl font-display text-3xl font-bold leading-[1.05] tracking-[-0.025em] sm:text-5xl">
                  Put a real question to it.
                </h2>

                <p className="mx-auto mt-6 max-w-xl text-[14.5px] leading-relaxed text-slate-300">
                  The console opens on a live run against Digha and answers in
                  the language you pick. Every figure it shows is a measurement
                  or is marked as missing.
                </p>

                <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
                  <AttractButton onClick={onEnterConsole}>
                    Open the live console
                    <Anchor className="h-3.5 w-3.5" />
                  </AttractButton>
                </div>

                <p className="mx-auto mt-10 max-w-lg text-[11.5px] leading-relaxed text-fathom">
                  Requires the API on port 3000. Risk scoring and evidence
                  retrieval degrade gracefully and say so when the ML and RAG
                  services are not running.
                </p>
              </div>
            </GlassPanel>
          </Reveal>
        </section>
      </main>

      {/* ---- Statutory footer ------------------------------------------- */}
      <footer className="relative z-10 border-t border-shoal/12 bg-abyssal/85">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-5 py-8 sm:flex-row sm:items-start sm:justify-between sm:px-8">
          <div className="flex items-center gap-3">
            <Waves className="h-4 w-4 text-shoal" />
            <span className="font-display text-sm font-bold">ORCA&#8209;X</span>
            <span className="font-mono text-[10px] tracking-[0.16em] text-fathom">
              INCOIS · IMD · CMFRI · ICG · IMO
            </span>
          </div>
          <p className="max-w-xl text-[11.5px] leading-relaxed text-fathom sm:text-right">
            <strong className="text-slate-300">Statutory notice.</strong>{" "}
            ORCA&#8209;X is a decision&#8209;support system. It does not supersede
            warnings, advisories or instructions issued by INCOIS, the India
            Meteorological Department, the Maritime Rescue Coordination Centres
            or any other competent authority.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default SynopsisPage;
