import type { Metadata } from "next";
import AdminUsers from "../_components/AdminUsers";

export const metadata: Metadata = { title: "Admin — Users" };

export default function AdminUsersPage() {
  return <AdminUsers />;
}
