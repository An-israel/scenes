/** Shown to signed-in accounts that aren't on the allowlist yet. */
export default function AccessPending({ email }: { email?: string | null }) {
  return (
    <div className="rounded-xl border border-line bg-ochre-tint p-10 sm:p-14">
      <p className="label mb-5">Early access</p>
      <h2 className="display max-w-2xl text-3xl sm:text-4xl">Your account is on the list.</h2>
      <p className="lede mt-5 max-w-xl">
        Scenes is invite-only while paid plans are being set up.
        {email ? (
          <>
            {" "}
            We&apos;ll open generation for <span className="text-forest">{email}</span> as soon as it&apos;s ready.
          </>
        ) : null}
      </p>
    </div>
  );
}
