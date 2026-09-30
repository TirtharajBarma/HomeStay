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
          className="mt-8 inline-flex items-center gap-2 rounded-xl bg-primary-container px-4 sm:px-6 py-3.5 text-title-md text-on-primary transition-colors hover:bg-primary"
        >
          <Icon name="arrow_back" className="text-base" />
          Back to Accommodations
        </Link>
      </div>
    </main>
  );
}
