import { chromium } from "playwright";
import { mkdir, writeFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { renderSlideHtml } from "@/lib/render/slides";
import { uploadPngToDrive } from "@/lib/server/google-drive";
import type { CopyDraft, ExportedAsset } from "@/types/workflow";

export async function exportSlides(workflowId: string, copyDraft: CopyDraft): Promise<ExportedAsset[]> {
  const baseDir = process.env.VERCEL ? join(tmpdir(), "k-black-music-magazine-app") : join(process.cwd(), "exports");
  const outputDir = join(baseDir, workflowId);
  await mkdir(outputDir, { recursive: true });
  let browser;

  try {
    browser = await chromium.launch({ headless: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Playwright 브라우저 실행 실패";
    throw new Error(
      `Playwright Chromium 실행에 실패했습니다. 필요하면 \`npx playwright install chromium\`를 먼저 실행해 주세요.\n\n${message}`,
    );
  }

  try {
    const assets: ExportedAsset[] = [];

    for (const [index, slide] of copyDraft.slides.entries()) {
      const page = await browser.newPage({ viewport: { width: 1080, height: 1350 }, deviceScaleFactor: 2 });
      const html = renderSlideHtml(copyDraft, slide, index);
      await page.setContent(html, { waitUntil: "domcontentloaded" });
      await page.evaluate(async () => {
        if ("fonts" in document) {
          // Wait for available local fonts to settle before screenshotting.
          await (document as Document & { fonts?: { ready: Promise<void> } }).fonts?.ready;
        }
      });
      const buffer = await page.screenshot({ type: "png" });
      await page.close();

      const fileName = `${String(index + 1).padStart(2, "0")}-${slide.id}.png`;
      const localPath = join(outputDir, fileName);
      await writeFile(localPath, buffer);

      let uploaded: { driveFileId?: string; driveWebViewLink?: string } | null = null;
      try {
        uploaded = await uploadPngToDrive(fileName, buffer);
      } catch {
        // Drive 업로드 실패해도 로컬 저장은 유지
      }
      assets.push({
        slideId: slide.id,
        fileName,
        localPath,
        driveFileId: uploaded?.driveFileId,
        driveWebViewLink: uploaded?.driveWebViewLink,
        previewDataUrl: `data:image/png;base64,${buffer.toString("base64")}`,
      });
    }

    return assets;
  } finally {
    await browser.close();
  }
}
