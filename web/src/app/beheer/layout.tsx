import { OfficeShell } from "@/components/office-shell";

export default function BeheerLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <OfficeShell>{children}</OfficeShell>;
}
