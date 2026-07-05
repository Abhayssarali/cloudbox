import type { Metadata } from "next";
import AdminOverview from "./_components/AdminOverview";

export const metadata: Metadata = {
  title: "Admin Overview",
  description: "Platform statistics and monitoring",
};

export default function AdminPage() {
  return <AdminOverview />;
}
