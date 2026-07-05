import type { Metadata } from "next";
import AdminAgents from "../_components/AdminAgents";

export const metadata: Metadata = { title: "Admin — Agents" };

export default function AdminAgentsPage() {
  return <AdminAgents />;
}
