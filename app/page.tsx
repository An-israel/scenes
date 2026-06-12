import Link from "next/link";

export default function LandingPage() {
  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center px-6 text-center">
      <p className="mb-4 text-sm uppercase tracking-[0.3em] text-gold">SceneForge</p>
      <h1 className="text-4xl font-bold leading-tight sm:text-5xl">
        Script in. <span className="text-gold">Video asset pack</span> out.
      </h1>
      <p className="mt-6 max-w-xl text-lg text-white/60">
        Paste a script, pick a voice — get one narrated MP3 plus timestamped 2D cartoon scene
        images in a single ZIP. Drop it into CapCut and publish.
      </p>
      <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row">
        <Link href="/login" className="btn-gold px-8 text-base">
          Start forging
        </Link>
        <span className="text-sm text-white/40">Free — bring your own Gemini key</span>
      </div>
      <div className="mt-16 grid w-full grid-cols-1 gap-4 text-left sm:grid-cols-3">
        {[
          ["1. Split", "Gemini storyboards your script into visual beats."],
          ["2. Forge", "Every scene gets a voiced WAV and a cartoon frame in one locked style."],
          ["3. Assemble", "Exact timestamps from real audio. ZIP + timeline.csv, ready for CapCut."],
        ].map(([title, body]) => (
          <div key={title} className="card">
            <h3 className="font-semibold text-gold">{title}</h3>
            <p className="mt-2 text-sm text-white/60">{body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
