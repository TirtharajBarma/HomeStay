import Link from "next/link";

export default function AdminNotFound() {
  return (
    <div className="min-h-screen bg-[#0B0F14] flex items-center justify-center p-6 text-slate-100">
      <div className="max-w-md w-full bg-[#121820] rounded-xl border border-slate-800/80 p-6 shadow-xl text-center space-y-4">
        <div className="w-10 h-10 rounded-lg bg-slate-800 border border-slate-700/80 text-slate-300 flex items-center justify-center mx-auto text-sm font-mono font-semibold">
          404
        </div>
        <div>
          <h2 className="text-sm font-semibold text-white">Desk not found</h2>
          <p className="text-xs text-slate-400 mt-1 leading-relaxed">
            The requested operations desk or administrative view does not exist.
          </p>
        </div>
        <Link
          href="/"
          className="inline-block w-full rounded-lg bg-[#1E7E4B] py-2 text-xs font-medium text-white hover:bg-[#259A5C] transition-colors cursor-pointer"
        >
          Return to operations console
        </Link>
      </div>
    </div>
  );
}
