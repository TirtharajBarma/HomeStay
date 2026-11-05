import Link from "next/link";

import { Icon } from "@/components/icon";

export default function NotFound() {
  return (
    <main className="flex min-h-[70vh] items-center justify-center px-4 sm:px-6 py-16">
      <div className="max-w-lg text-center">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-primary-container/40 text-on-primary-container">
          <Icon name="explore_off" className="text-4xl" />
        </div>
        <p className="text-label-md uppercase tracking-widest text-secondary">Trail Not Found</p>
        <h1 className="mt-2 font-display text-headline-lg text-primary">
          This path ends in the wildflower meadow.
        </h1>
        <p className="mt-3 text-body-lg text-on-surface-variant">
          The page you were looking for has wandered off the estate path. The accommodations
          catalogue is a short walk back.
        </p>
        <Link
          href="/#accommodations"
          className="mt-8 inline-flex items-center gap-2 rounded-xl bg-primary-container px-4 sm:px-6 py-3.5 text-title-md text-on-primary transition-colors hover:bg-primary group"
        >
          <svg className="h-4 w-4 shrink-0 transition-transform group-hover:-translate-x-0.5" fill="none" viewBox="0 0 24 24" strokeWidth="2.2" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
          <span>Back to Accommodations</span>
        </Link>
      </div>
    </main>
  );
}
