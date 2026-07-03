import type { Metadata } from "next";
import FileExplorer from "./_components/FileExplorer";

export const metadata: Metadata = {
  title: "My Files",
  description: "Browse and manage your CloudBox files",
};

export default function FilesPage() {
  return (
    <div className="flex flex-col h-full">
      <FileExplorer />
    </div>
  );
}
