import { redirect } from "next/navigation";

// Root page — redirects to login (will redirect to dashboard when auth exists)
export default function Home() {
  redirect("/login");
}
