import fs from 'fs';
import path from 'path';
import { marked } from 'marked';
import puppeteer from 'puppeteer-core';

const workspaceRoot = process.cwd();
const markdownPath = path.join(workspaceRoot, 'HANDLEIDING-COZY-MOMENTS.md');
const pdfPath = path.join(workspaceRoot, 'HANDLEIDING-COZY-MOMENTS.pdf');

const candidateBrowsers = [
  process.env.PUPPETEER_EXECUTABLE_PATH,
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
].filter(Boolean);

const browserPath = candidateBrowsers.find((candidate) => fs.existsSync(candidate));

if (!browserPath) {
  throw new Error('Geen compatibele Chromium-browser gevonden. Stel PUPPETEER_EXECUTABLE_PATH in of installeer Edge/Chrome.');
}

if (!fs.existsSync(markdownPath)) {
  throw new Error(`Handleiding niet gevonden: ${markdownPath}`);
}

marked.setOptions({
  gfm: true,
  breaks: true,
});

const markdown = fs.readFileSync(markdownPath, 'utf8');
const renderedHtml = marked.parse(markdown);

const html = `
<!doctype html>
<html lang="nl">
  <head>
    <meta charset="utf-8" />
    <title>Cozy Moments Handleiding</title>
    <style>
      @page {
        size: A4;
        margin: 22mm 16mm 20mm 16mm;
      }

      :root {
        color-scheme: light;
        --text: #1f2937;
        --muted: #6b7280;
        --line: #d1d5db;
        --accent: #7b5a2e;
        --bg: #ffffff;
        --code-bg: #f5f5f0;
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

      main {
        width: 100%;
      }

      h1, h2, h3, h4 {
        color: #111827;
        page-break-after: avoid;
        break-after: avoid-page;
      }

      h1 {
        font-size: 25pt;
        letter-spacing: 0.02em;
        margin: 0 0 12pt;
        padding-bottom: 10pt;
        border-bottom: 2px solid var(--accent);
      }

      h2 {
        font-size: 18pt;
        margin: 22pt 0 10pt;
      }

      h3 {
        font-size: 13.5pt;
        margin: 16pt 0 8pt;
      }

      h4 {
        font-size: 11.5pt;
        margin: 12pt 0 6pt;
      }

      p, li {
        orphans: 3;
        widows: 3;
      }

      p {
        margin: 0 0 10pt;
      }

      ul, ol {
        margin: 0 0 12pt 18pt;
        padding: 0;
      }

      li {
        margin: 0 0 5pt;
      }

      hr {
        border: 0;
        border-top: 1px solid var(--line);
        margin: 18pt 0;
      }

      code {
        font-family: Consolas, "Courier New", monospace;
        background: var(--code-bg);
        border-radius: 4px;
        padding: 1px 4px;
        font-size: 0.92em;
      }

      pre {
        background: var(--code-bg);
        border: 1px solid #e5e7eb;
        border-radius: 10px;
        padding: 12px;
        overflow: hidden;
        white-space: pre-wrap;
        word-break: break-word;
        margin: 0 0 12pt;
        page-break-inside: avoid;
        break-inside: avoid-page;
      }

      pre code {
        background: transparent;
        padding: 0;
      }

      table {
        width: 100%;
        border-collapse: collapse;
        margin: 0 0 14pt;
        page-break-inside: avoid;
        break-inside: avoid-page;
      }

      th, td {
        border: 1px solid #d1d5db;
        padding: 7px 8px;
        text-align: left;
        vertical-align: top;
      }

      th {
        background: #f9fafb;
      }

      blockquote {
        margin: 0 0 12pt;
        padding: 8pt 12pt;
        border-left: 4px solid var(--accent);
        background: #faf7f2;
      }

      a {
        color: inherit;
        text-decoration: none;
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