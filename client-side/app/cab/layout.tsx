import { CabHeader } from "@/components/cab/cab-header";
import { SiteFooter } from "@/components/site-footer";

export default function CabLayout({ children }: LayoutProps<"/cab">) {
  return (
    <>
      <CabHeader />
      <div className="flex-1">{children}</div>
      <SiteFooter />
    </>
  );
}
