import fs from "fs";
import path from "path";
import mime from "mime-types";
import chokidar from "chokidar";

export interface ScanResult {
  path: string;
  name: string;
  size: string;
  isFolder: boolean;
  mimeType: string | null;
  updatedAt: string;
}

export function scanDirectory(dir: string, baseDir: string = dir): ScanResult[] {
  const results: ScanResult[] = [];
  if (!fs.existsSync(dir)) {
    return results;
  }

  const items = fs.readdirSync(dir);
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const relPath = path.relative(baseDir, fullPath).replace(/\\/g, "/");
    const standardizedPath = "/" + relPath;
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      results.push({
        path: standardizedPath,
        name: item,
        size: "0",
        isFolder: true,
        mimeType: null,
        updatedAt: stat.mtime.toISOString(),
      });
      // Recurse
      results.push(...scanDirectory(fullPath, baseDir));
    } else {
      results.push({
        path: standardizedPath,
        name: item,
        size: stat.size.toString(),
        isFolder: false,
        mimeType: mime.lookup(fullPath) || null,
        updatedAt: stat.mtime.toISOString(),
      });
    }
  }
  return results;
}

export function watchStorage(
  storageDir: string,
  onChange: (files: ScanResult[]) => void
) {
  // Ensure storage dir exists
  if (!fs.existsSync(storageDir)) {
    fs.mkdirSync(storageDir, { recursive: true });
  }

  console.log(`[Watcher] Watching directory: ${storageDir}`);

  let debounceTimeout: NodeJS.Timeout | null = null;

  const triggerSync = () => {
    if (debounceTimeout) clearTimeout(debounceTimeout);
    debounceTimeout = setTimeout(() => {
      try {
        const files = scanDirectory(storageDir);
        console.log(`[Watcher] Scan complete. Synchronizing ${files.length} items...`);
        onChange(files);
      } catch (err) {
        console.error("[Watcher] Error scanning directory:", err);
      }
    }, 1000); // 1 second debounce
  };

  const watcher = chokidar.watch(storageDir, {
    ignored: (filePath) => {
      const relPath = path.relative(storageDir, filePath);
      const parts = relPath.split(path.sep);
      return parts.some(part => part.startsWith('.') && part !== '.' && part !== '..');
    },
    persistent: true,
    ignoreInitial: true,
  });

  watcher
    .on("add", () => triggerSync())
    .on("change", () => triggerSync())
    .on("unlink", () => triggerSync())
    .on("addDir", () => triggerSync())
    .on("unlinkDir", () => triggerSync());

  // Trigger initial sync
  triggerSync();

  return {
    close: () => {
      if (debounceTimeout) clearTimeout(debounceTimeout);
      watcher.close();
    }
  };
}
