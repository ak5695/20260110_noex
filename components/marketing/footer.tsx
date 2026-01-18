import { Logo } from "@/components/marketing/logo";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export const Footer = () => {
  return (
    <div className="flex items-center w-full p-6 bg-background z-50 dark:bg-[#1F1F1F]">
      <Logo />
      <div className="md:ml-auto w-full justify-between md:justify-end flex items-center gap-x-2 text-muted-foreground">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/privacy">
            Privacy Policy
          </Link>
        </Button>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/terms">
            Terms & Conditions
          </Link>
        </Button>
      </div>
    </div>
  );
};
