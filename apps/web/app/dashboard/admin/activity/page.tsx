import type { Metadata } from "next";
import AdminActivity from "../_components/AdminActivity";

export const metadata: Metadata = { title: "Admin — Activity" };

export default function AdminActivityPage() {
  return <AdminActivity />;
}
