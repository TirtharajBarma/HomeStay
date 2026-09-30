import { SiteFooter } from "@/components/site-footer";
import { CheckoutHeader, CheckoutProgress } from "@/components/site-header";

export default function CheckoutLayout({ children }: LayoutProps<"/checkout">) {
  return (
    <>
      <CheckoutHeader />
      <CheckoutProgress />
      <div className="flex-1">{children}</div>
      <SiteFooter />
    </>
  );
}
