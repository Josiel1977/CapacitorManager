export default function Loading() {
  return (
    <div className="flex min-h-[55vh] items-center justify-center" role="status" aria-live="polite">
      <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="h-6 w-48 animate-pulse rounded bg-slate-200" />
        <div className="mt-7 space-y-4">
          <div className="h-16 animate-pulse rounded-xl bg-slate-100" />
          <div className="h-16 animate-pulse rounded-xl bg-slate-100" />
          <div className="h-16 animate-pulse rounded-xl bg-slate-100" />
        </div>
        <p className="mt-6 text-center text-sm font-medium text-slate-500">Carregando a área selecionada…</p>
      </div>
    </div>
  );
}
