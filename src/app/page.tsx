import { createClient } from "@/lib/supabase/server";

type Probe = { ok: boolean; detail: string };

// Hits the Data API with a table that does not exist. PostgREST answering
// "table not found" (PGRST205) proves the URL, the key and the Data API all
// work — without needing any schema in place yet.
async function probeSupabase(): Promise<Probe> {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  ) {
    return { ok: false, detail: "Faltan las variables de entorno." };
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from("__connectivity_probe__")
      .select("*")
      .limit(1);

    if (!error || error.code === "PGRST205") {
      return { ok: true, detail: "Data API responde correctamente." };
    }
    return { ok: false, detail: `${error.code ?? "error"}: ${error.message}` };
  } catch (e) {
    return { ok: false, detail: e instanceof Error ? e.message : String(e) };
  }
}

export default async function Home() {
  const probe = await probeSupabase();

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-8 px-6 py-16">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">ad-factory</h1>
        <p className="mt-2 text-sm text-black/60 dark:text-white/60">
          Habi · Next.js {"·"} Supabase {"·"} Vercel
        </p>
      </header>

      <section className="rounded-lg border border-black/10 p-5 dark:border-white/15">
        <div className="flex items-center gap-2.5">
          <span
            aria-hidden
            className={`size-2.5 rounded-full ${probe.ok ? "bg-emerald-500" : "bg-red-500"}`}
          />
          <h2 className="font-medium">
            Supabase: {probe.ok ? "conectado" : "sin conexión"}
          </h2>
        </div>
        <p className="mt-2 text-sm text-black/60 dark:text-white/60">
          {probe.detail}
        </p>
      </section>
    </main>
  );
}
