import Link from "next/link";
import SiteNav from "@/components/SiteNav";
import { Arrow, SectionHead, Tick, Wordmark } from "@/components/ui";
import { ART_STYLES } from "@/lib/styles";

// Shot lengths (seconds) for the hero timeline — a 48-second short.
const TIMELINE = [4, 3, 5, 4, 3, 4, 5, 3, 4, 5, 4, 4];
const TINTS = ["bg-forest-tint", "bg-clay-tint", "bg-ochre-tint"];

const STEPS = [
  {
    title: "Storyboard",
    body: "Your story is split into quick 3–5 second shots, each with its line of narration and a framed, drawable moment.",
  },
  {
    title: "Cast",
    body: "Every recurring character is designed once on a reference sheet: face, hair, build and outfit, fixed.",
  },
  {
    title: "Shots",
    body: "Each shot is drawn with its characters' sheets attached, so they look the same from the first frame to the last.",
  },
  {
    title: "Voice",
    body: "A narrator reads every line. Silence is trimmed, and each image starts exactly when its words begin.",
  },
];

const STYLE_PANELS = ["bg-ochre-tint", "bg-clay-tint", "bg-forest-tint", "bg-card"];

const OUTPUT = [
  ["audio.mp3", "The full narration, one continuous track"],
  ["images/001_00m00s.png", "Every shot, named by the second it starts"],
  ["characters/", "The reference sheet for each character"],
  ["timeline.csv", "Start, end and duration for every shot"],
  ["readme.txt", "How to assemble it in CapCut in two minutes"],
];

function clock(sec: number) {
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
}

export default function LandingPage() {
  let cursor = 0;
  const total = TIMELINE.reduce((a, b) => a + b, 0);

  return (
    <div className="min-h-screen">
      <SiteNav />

      {/* Hero */}
      <section className="page pb-20 pt-20 sm:pt-28">
        <p className="label mb-8">Story shorts · Consistent characters · Narrated — 30 to 60 seconds</p>
        <h1 className="display max-w-5xl text-[3.2rem] sm:text-[5.5rem] lg:text-[6.5rem]">
          Write a story. Get a short that <span className="text-clay">tells it.</span>
        </h1>
        <p className="lede mt-10 max-w-2xl">
          Scenes storyboards your story, designs its characters once, draws them the same in every shot, and
          narrates it from start to finish — ready to drop into your editor.
        </p>
        <div className="mt-12 flex flex-wrap items-center gap-8">
          <Link href="/login" className="btn-primary">
            Start a story
          </Link>
          <Link href="#how" className="link-arrow">
            See how it works <Arrow />
          </Link>
        </div>
      </section>

      {/* Timeline strip */}
      <section className="border-y border-line bg-card">
        <div className="page py-10">
          <div className="mb-4 flex items-center justify-between">
            <span className="label">Shots 01–{String(TIMELINE.length).padStart(2, "0")}</span>
            <span className="label">
              0:00 → {clock(total)}
            </span>
          </div>
          <div className="flex h-16 gap-1 overflow-hidden rounded-md">
            {TIMELINE.map((len, i) => {
              const start = cursor;
              cursor += len;
              return (
                <div
                  key={i}
                  style={{ flexGrow: len }}
                  className={`${TINTS[i % 3]} flex min-w-0 basis-0 flex-col justify-between px-2 py-1.5`}
                >
                  <span className="font-mono text-[10px] text-forest-soft">{String(i + 1).padStart(2, "0")}</span>
                  <span className="hidden font-mono text-[10px] text-forest-mute sm:block">{clock(start)}</span>
                </div>
              );
            })}
          </div>
          <svg viewBox="0 0 1200 28" preserveAspectRatio="none" className="mt-3 h-7 w-full text-forest-mute" aria-hidden="true">
            <path
              d="M0 14 H120 L128 6 L136 22 L144 14 H380 L388 4 L396 24 L404 14 H700 L706 8 L712 20 L718 14 H960 L968 5 L976 23 L984 14 H1200"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.2"
            />
          </svg>
        </div>
      </section>

      {/* Facts strip */}
      <section className="border-b border-line">
        <p className="page label py-7 leading-loose">
          3–5 s per shot <span className="px-2 text-clay">·</span> One reference sheet per character
          <span className="px-2 text-clay">·</span> 8 narrator voices <span className="px-2 text-clay">·</span> 9:16 or 16:9
          <span className="px-2 text-clay">·</span> Exact timestamps
        </p>
      </section>

      {/* How it works */}
      <section id="how" className="page scroll-mt-24 py-28">
        <SectionHead eyebrow="How it works — 01" title="From a paragraph to a finished short." />
        <div className="grid overflow-hidden rounded-xl border border-line bg-card sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s, i) => (
            <div
              key={s.title}
              className={`p-8 ${i > 0 ? "border-t border-line sm:border-t-0" : ""} ${
                i % 2 === 1 ? "sm:border-l" : ""
              } ${i >= 2 ? "sm:border-t lg:border-t-0" : ""} ${i > 0 ? "lg:border-l" : ""} border-line`}
            >
              <Tick className={i === 0 ? "bg-clay" : "bg-forest"} />
              <p className="label mb-3">Step {String(i + 1).padStart(2, "0")}</p>
              <h3 className="text-2xl font-semibold tracking-tight">{s.title}</h3>
              <p className="mt-4 leading-relaxed text-forest-soft">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Styles */}
      <section id="styles" className="scroll-mt-24 border-y border-line bg-ochre-tint/40 py-28">
        <div className="page">
          <SectionHead eyebrow="Art styles — 02" title="One look, locked for the whole story." />
          <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
            {ART_STYLES.map((s, i) => (
              <div key={s.id} className="overflow-hidden rounded-xl border border-line bg-card">
                <div className={`${STYLE_PANELS[i]} flex aspect-[4/3] items-end border-b border-line p-4 sm:p-6`}>
                  <span className="display text-4xl sm:text-5xl text-forest/90">{String(i + 1).padStart(2, "0")}</span>
                </div>
                <div className="p-4 sm:p-6">
                  <h3 className="text-lg font-semibold tracking-tight sm:text-xl">{s.label}</h3>
                  <p className="mt-2 text-sm text-forest-soft sm:text-base">{s.hint}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Output */}
      <section id="output" className="scroll-mt-24 bg-forest py-28 text-paper">
        <div className="page grid gap-16 lg:grid-cols-[1fr_1.2fr]">
          <div>
            <p className="label mb-5 text-paper/60">What you get — 03</p>
            <h2 className="display text-4xl text-paper sm:text-5xl lg:text-6xl">
              One download. <span className="text-ochre">Everything in order.</span>
            </h2>
            <p className="mt-8 max-w-md text-lg leading-relaxed text-paper/70">
              Import the folder, lay the frames on the audio, and you have your short. Every filename tells you
              where it goes.
            </p>
          </div>
          <ul className="divide-y divide-paper/15 border-y border-paper/15">
            {OUTPUT.map(([file, note]) => (
              <li key={file} className="flex flex-col gap-1 py-5 sm:flex-row sm:items-baseline sm:justify-between">
                <span className="font-mono text-sm text-ochre">{file}</span>
                <span className="text-paper/70">{note}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* CTA */}
      <section className="page py-28">
        <div className="rounded-xl border border-line bg-clay-tint p-10 sm:p-16">
          <p className="label mb-5">Get started</p>
          <h2 className="display max-w-3xl text-4xl sm:text-5xl">Your first short is a paragraph away.</h2>
          <p className="lede mt-6 max-w-2xl">
            Create an account, paste a story, and watch it get storyboarded, drawn and narrated.
          </p>
          <div className="mt-10 flex flex-wrap items-center gap-8">
            <Link href="/login" className="btn-primary">
              Create your account
            </Link>
            <Link href="/login" className="link-arrow">
              Already have an account? Sign in <Arrow />
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-line">
        <div className="page flex flex-wrap items-center justify-between gap-4 py-10">
          <Wordmark />
          <p className="label">© {new Date().getFullYear()} Scenes</p>
        </div>
      </footer>
    </div>
  );
}
