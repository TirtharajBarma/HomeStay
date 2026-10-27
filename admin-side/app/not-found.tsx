import Link from "next/link";

export default function AdminNotFound() {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 text-slate-100">
      <div className="max-w-md w-full bg-slate-900 rounded-2xl border border-slate-800 p-8 shadow-2xl text-center space-y-5">
        <div className="w-14 h-14 rounded-full bg-slate-800 border border-slate-700 text-slate-400 flex items-center justify-center mx-auto text-2xl font-bold">
          404
        </div>
        <div>
          <h2 className="text-lg font-bold text-white">Desk Not Found</h2>
          <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
            The requested control desk or administration view does not exist in the Admin Tower.
          </p>
        </div>
        <Link
          href="/"
          className="inline-block w-full rounded-xl bg-emerald-600 py-2.5 text-xs font-bold text-white hover:bg-emerald-500 transition-colors cursor-pointer"
        >
          Return to Admin Tower
        </Link>
      </div>
    </div>
  );
}
