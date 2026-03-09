import fs from 'node:fs';
import path from 'node:path';
import { marked } from 'marked';
import puppeteer from 'puppeteer-core';

const workspaceRoot = process.cwd();
const markdownPath = path.join(workspaceRoot, 'ALGEMENE-VOORWAARDEN-COZY-MOMENTS.md');
const pdfPath = path.join(workspaceRoot, 'ALGEMENE-VOORWAARDEN-COZY-MOMENTS.pdf');

const candidateBrowsers = [
  process.env.PUPPETEER_EXECUTABLE_PATH,
  String.raw`C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe`,
  String.raw`C:\Program Files\Microsoft\Edge\Application\msedge.exe`,
  String.raw`C:\Program Files\Google\Chrome\Application\chrome.exe`,
  String.raw`C:\Program Files (x86)\Google\Chrome\Application\chrome.exe`,
].filter(Boolean);

const browserPath = candidateBrowsers.find((candidate) => fs.existsSync(candidate));

if (!browserPath) {
  throw new Error('Geen compatibele Chromium-browser gevonden. Stel PUPPETEER_EXECUTABLE_PATH in of installeer Edge/Chrome.');
}

if (!fs.existsSync(markdownPath)) {
  throw new Error(`Voorwaarden niet gevonden: ${markdownPath}`);
}

marked.setOptions({
  gfm: true,
  breaks: true,
});

const markdown = fs.readFileSync(markdownPath, 'utf8');
const renderedHtml = await marked.parse(markdown);

const html = `
<!doctype html>
<html lang="nl">
  <head>
    <meta charset="utf-8" />
    <title>Algemene Voorwaarden Cozy Moments</title>
    <style>
      @page {
        size: A4;
        margin: 20mm 16mm 18mm 16mm;
      }

      :root {
        color-scheme: light;
        --text: #1f2937;
        --muted: #6b7280;
        --line: #d1d5db;
        --accent: #7b5a2e;
        --bg: #ffffff;
        --soft: #faf7f2;
      }

      * {
        box-sizing: border-box;
      }

      body {
        margin: 0;
        color: var(--text);
        background: var(--bg);
        font-family: "Segoe UI", Arial, sans-serif;
        font-size: 11pt;
        line-height: 1.55;
      }

      h1, h2, h3 {
        color: #111827;
        page-break-after: avoid;
        break-after: avoid-page;
      }

      h1 {
        margin: 0 0 10pt;
        padding-bottom: 10pt;
        font-size: 24pt;
        border-bottom: 2px solid var(--accent);
        letter-spacing: 0.02em;
      }

      h2 {
        margin: 20pt 0 8pt;
        font-size: 16pt;
      }

      h3 {
        margin: 14pt 0 6pt;
        font-size: 12.5pt;
      }

      p {
        margin: 0 0 10pt;
      }

      ul {
        margin: 0 0 12pt 18pt;
        padding: 0;
      }

      li {
        margin: 0 0 5pt;
      }

      hr {
        border: 0;
        border-top: 1px solid var(--line);
        margin: 16pt 0;
      }

      strong {
        color: #111827;
      }

      blockquote {
        margin: 0 0 12pt;
        padding: 10pt 12pt;
        border-left: 4px solid var(--accent);
        background: var(--soft);
      }
    </style>
  </head>
  <body>
    <main>${renderedHtml}</main>
  </body>
</html>`;

const browser = await puppeteer.launch({
  executablePath: browserPath,
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});

try {
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'networkidle0' });
  await page.emulateMediaType('print');
  await page.pdf({
    path: pdfPath,
    format: 'A4',
    printBackground: true,
    preferCSSPageSize: true,
  });
} finally {
  await browser.close();
}

console.log(`PDF gegenereerd: ${pdfPath}`);