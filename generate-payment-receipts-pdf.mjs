import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const workspaceRoot = process.cwd();

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

const receipts = [
  {
    htmlPath: path.join(workspaceRoot, 'BETALINGSBEWIJS-TEMPLATE-COZY-MOMENTS.html'),
    pdfPath: path.join(workspaceRoot, 'BETALINGSBEWIJS-TEMPLATE-COZY-MOMENTS.pdf'),
  },
  {
    htmlPath: path.join(workspaceRoot, 'BETALINGSBEWIJS-BUNDEL-DEAL-COZY-MOMENTS.html'),
    pdfPath: path.join(workspaceRoot, 'BETALINGSBEWIJS-BUNDEL-DEAL-COZY-MOMENTS.pdf'),
  },
];

for (const receipt of receipts) {
  if (!fs.existsSync(receipt.htmlPath)) {
    throw new Error(`HTML-bestand niet gevonden: ${receipt.htmlPath}`);
  }
}

const browser = await puppeteer.launch({
  executablePath: browserPath,
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});

try {
  for (const receipt of receipts) {
    const html = fs.readFileSync(receipt.htmlPath, 'utf8');
    const page = await browser.newPage();

    try {
      await page.setContent(html, { waitUntil: 'networkidle0' });
      await page.emulateMediaType('print');
      await page.pdf({
        path: receipt.pdfPath,
        format: 'A4',
        printBackground: true,
        preferCSSPageSize: true,
      });
      console.log(`PDF gegenereerd: ${receipt.pdfPath}`);
    } finally {
      await page.close();
    }
  }
} finally {
  await browser.close();
}