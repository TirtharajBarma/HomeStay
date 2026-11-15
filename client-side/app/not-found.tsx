import Link from "next/link";

import { Icon } from "@/components/icon";

export default function NotFound() {
  return (
    <main className="flex min-h-[70vh] items-center justify-center px-4 sm:px-6 py-16">
      <div className="max-w-lg text-center">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-primary-container/40 text-on-primary-container">
          <Icon name="explore_off" className="text-4xl" />
        </div>
        <p className="text-label-sm font-medium text-secondary">Trail not found</p>
        <h1 className="mt-2 font-display text-headline-lg font-medium text-primary">
          This path ends in the mountain mist.
        </h1>
        <p className="mt-3 text-body-md text-on-surface-variant leading-relaxed">
          The page you were looking for is not on this trail. The accommodations catalogue is a short walk back.
        </p>
        <Link
          href="/#accommodations"
          className="mt-8 inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-label-md font-medium text-on-primary transition-colors hover:bg-primary-container"
        >
          <Icon name="arrow_back" className="text-[16px]" />
          <span>Back to accommodations</span>
        </Link>
      </div>
    </main>
  );
}
