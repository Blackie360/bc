import { readFileSync } from "node:fs";
import { join } from "node:path";
import { deflateSync, inflateSync } from "node:zlib";
import type { ProjectRecord } from "@/lib/project-record-types";
import { normalizeLinkOnnetOffnet, normalizeProjectServiceType } from "@/lib/projects-types";

type PdfObject = string | Buffer;

type PdfLogoImage = {
  width: number;
  height: number;
  rgb: Buffer;
  alpha?: Buffer;
};

let cachedLogoImage: PdfLogoImage | null = null;

function cleanPdfText(value: string | number | null | undefined) {
  return String(value ?? "")
    .replace(/[^\x20-\x7E]/g, "?")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function displayText(value: string | number | null | undefined, fallback = "Not recorded") {
  const text = String(value ?? "").trim();

  return text.length > 0 ? text : fallback;
}

function truncateText(value: string | number | null | undefined, maxLength: number) {
  const text = displayText(value);

  return text.length > maxLength ? `${text.slice(0, maxLength - 3)}...` : text;
}

function wrapText(value: string, maxLength = 82) {
  const words = value.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    const nextLine = currentLine ? `${currentLine} ${word}` : word;
    if (nextLine.length > maxLength && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = nextLine;
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines.length ? lines : [""];
}

function color([r, g, b]: readonly [number, number, number]) {
  return `${r} ${g} ${b}`;
}

function pdfText(
  text: string | number | null | undefined,
  x: number,
  y: number,
  options: {
    size?: number;
    font?: "F1" | "F2" | "F3";
    fill?: readonly [number, number, number];
  } = {},
) {
  const size = options.size ?? 11;
  const font = options.font ?? "F1";
  const fill = color(options.fill ?? [0.12, 0.16, 0.22]);

  return `BT ${fill} rg /${font} ${size} Tf ${x} ${y} Td (${cleanPdfText(displayText(text, ""))}) Tj ET`;
}

function pdfRect(
  x: number,
  y: number,
  width: number,
  height: number,
  options: {
    fill?: readonly [number, number, number];
    stroke?: readonly [number, number, number];
    lineWidth?: number;
  } = {},
) {
  const commands = ["q"];

  if (options.fill) {
    commands.push(`${color(options.fill)} rg`);
  }

  if (options.stroke) {
    commands.push(`${color(options.stroke)} RG`);
  }

  commands.push(`${options.lineWidth ?? 1} w`);
  commands.push(`${x} ${y} ${width} ${height} re`);
  commands.push(options.fill && options.stroke ? "B" : options.fill ? "f" : "S");
  commands.push("Q");

  return commands.join(" ");
}

function pdfRule(x: number, y: number, width: number, stroke: readonly [number, number, number]) {
  return `q ${color(stroke)} RG 1 w ${x} ${y} m ${x + width} ${y} l S Q`;
}

function paethPredictor(left: number, up: number, upperLeft: number) {
  const predictor = left + up - upperLeft;
  const leftDistance = Math.abs(predictor - left);
  const upDistance = Math.abs(predictor - up);
  const upperLeftDistance = Math.abs(predictor - upperLeft);

  if (leftDistance <= upDistance && leftDistance <= upperLeftDistance) {
    return left;
  }

  return upDistance <= upperLeftDistance ? up : upperLeft;
}

function unfilterPngScanlines({
  data,
  width,
  height,
  channels,
}: {
  data: Buffer;
  width: number;
  height: number;
  channels: number;
}) {
  const scanlineLength = width * channels;
  const output = Buffer.alloc(scanlineLength * height);
  let inputOffset = 0;

  for (let row = 0; row < height; row += 1) {
    const filter = data[inputOffset];
    inputOffset += 1;
    const rowOffset = row * scanlineLength;

    for (let column = 0; column < scanlineLength; column += 1) {
      const raw = data[inputOffset + column];
      const left = column >= channels ? output[rowOffset + column - channels] : 0;
      const up = row > 0 ? output[rowOffset + column - scanlineLength] : 0;
      const upperLeft =
        row > 0 && column >= channels
          ? output[rowOffset + column - scanlineLength - channels]
          : 0;

      switch (filter) {
        case 0:
          output[rowOffset + column] = raw;
          break;
        case 1:
          output[rowOffset + column] = (raw + left) & 0xff;
          break;
        case 2:
          output[rowOffset + column] = (raw + up) & 0xff;
          break;
        case 3:
          output[rowOffset + column] = (raw + Math.floor((left + up) / 2)) & 0xff;
          break;
        case 4:
          output[rowOffset + column] = (raw + paethPredictor(left, up, upperLeft)) & 0xff;
          break;
        default:
          throw new Error("Unsupported PNG filter type.");
      }
    }

    inputOffset += scanlineLength;
  }

  return output;
}

function readLiquidLogoForPdf(): PdfLogoImage {
  if (cachedLogoImage) {
    return cachedLogoImage;
  }

  const png = readFileSync(join(process.cwd(), "public", "liquid-logo.png"));
  const width = png.readUInt32BE(16);
  const height = png.readUInt32BE(20);
  const bitDepth = png[24];
  const colorType = png[25];

  if (bitDepth !== 8 || (colorType !== 2 && colorType !== 6)) {
    throw new Error("Liquid logo PNG must be an 8-bit RGB or RGBA image.");
  }

  const idatChunks: Buffer[] = [];
  let offset = 8;

  while (offset < png.length) {
    const length = png.readUInt32BE(offset);
    const type = png.toString("ascii", offset + 4, offset + 8);
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;

    if (type === "IDAT") {
      idatChunks.push(png.subarray(dataStart, dataEnd));
    }

    offset = dataEnd + 4;
  }

  const channels = colorType === 6 ? 4 : 3;
  const pixels = unfilterPngScanlines({
    data: inflateSync(Buffer.concat(idatChunks)),
    width,
    height,
    channels,
  });
  const rgb = Buffer.alloc(width * height * 3);
  const alpha = colorType === 6 ? Buffer.alloc(width * height) : undefined;

  for (let pixel = 0; pixel < width * height; pixel += 1) {
    const source = pixel * channels;
    const target = pixel * 3;

    rgb[target] = pixels[source];
    rgb[target + 1] = pixels[source + 1];
    rgb[target + 2] = pixels[source + 2];

    if (alpha) {
      alpha[pixel] = pixels[source + 3];
    }
  }

  cachedLogoImage = {
    width,
    height,
    rgb: deflateSync(rgb),
    alpha: alpha ? deflateSync(alpha) : undefined,
  };

  return cachedLogoImage;
}

function pdfImageCommand(name: string, x: number, y: number, width: number, height: number) {
  return `q ${width} 0 0 ${height} ${x} ${y} cm /${name} Do Q`;
}

function pdfImageObject(image: PdfLogoImage, smaskObjectId?: number) {
  const smask = smaskObjectId ? ` /SMask ${smaskObjectId} 0 R` : "";
  const header = [
    `<< /Type /XObject /Subtype /Image /Width ${image.width} /Height ${image.height}`,
    `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode${smask}`,
    `/Length ${image.rgb.length} >>\nstream\n`,
  ].join(" ");

  return Buffer.concat([Buffer.from(header, "utf8"), image.rgb, Buffer.from("\nendstream", "utf8")]);
}

function pdfAlphaMaskObject(image: PdfLogoImage) {
  if (!image.alpha) {
    return null;
  }

  const header = [
    `<< /Type /XObject /Subtype /Image /Width ${image.width} /Height ${image.height}`,
    `/ColorSpace /DeviceGray /BitsPerComponent 8 /Filter /FlateDecode`,
    `/Length ${image.alpha.length} >>\nstream\n`,
  ].join(" ");

  return Buffer.concat([Buffer.from(header, "utf8"), image.alpha, Buffer.from("\nendstream", "utf8")]);
}

function money(value: number) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(value);
}

function kes(value: number) {
  return `KES ${money(value)}`;
}

function usd(value: number) {
  return `USD ${money(value)}`;
}

function issuedAtLabel(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function aggregateCapacity(
  project: ProjectRecord,
  kind: "onnetCapacity" | "offnetCapacity",
) {
  const values = project.links
    .map((link) => link[kind]?.trim())
    .filter((value): value is string => Boolean(value));

  return values.length ? [...new Set(values)].join(", ") : "Not recorded";
}

function thirdPartyMrc(project: ProjectRecord) {
  return project.links
    .filter((link) => link.costSource === "3rd Party Quote")
    .reduce((total, link) => total + link.mrc, 0);
}

function totalProjectCost(project: ProjectRecord) {
  return project.totalNrc > 0 ? project.totalNrc : project.approvedBudget;
}

function exchangeRateLabel(project: ProjectRecord) {
  const exchangeRate = Number(project.exchangeRateKesUsd);

  return Number.isFinite(exchangeRate) && exchangeRate > 0
    ? exchangeRate.toLocaleString("en-US", { maximumFractionDigits: 2 })
    : "Not recorded";
}

export function certificateFileName(project: ProjectRecord) {
  const safeId = project.id.replace(/[^a-zA-Z0-9._-]/g, "-");
  return `BC Approval Certificate - ${safeId}.pdf`;
}

export function renderBcApprovalCertificatePdf(project: ProjectRecord) {
  const certificate = project.certificate;
  if (!certificate) {
    throw new Error("BC approval certificate has not been issued.");
  }
  const issuedCertificate = certificate;

  const pages: string[][] = [];
  let commands: string[] = [];
  let y = 760;
  const marginX = 48;
  const pageWidth = 612;
  const pageHeight = 792;
  const contentWidth = pageWidth - marginX * 2;
  const logoImage = readLiquidLogoForPdf();
  const logoDisplayWidth = 154;
  const logoDisplayHeight = Math.round((logoDisplayWidth * logoImage.height) / logoImage.width);

  const colors = {
    primary: [0.05, 0.14, 0.28] as const,
    accent: [0.1, 0.45, 0.72] as const,
    success: [0.1, 0.5, 0.3] as const,
    muted: [0.38, 0.44, 0.54] as const,
    border: [0.83, 0.87, 0.92] as const,
    surface: [0.96, 0.98, 1] as const,
    soft: [0.98, 0.99, 1] as const,
    white: [1, 1, 1] as const,
  };

  function startPage() {
    commands = [
      pdfRect(0, pageHeight - 92, pageWidth, 92, { fill: colors.primary }),
      pdfRect(marginX, pageHeight - 78, logoDisplayWidth + 12, logoDisplayHeight + 12, {
        fill: colors.white,
      }),
      pdfImageCommand(
        "Logo",
        marginX + 6,
        pageHeight - 72,
        logoDisplayWidth,
        logoDisplayHeight,
      ),
      pdfText("BUSINESS CASE APPROVAL CERTIFICATE", marginX + 186, pageHeight - 46, {
        size: 16,
        font: "F2",
        fill: colors.white,
      }),
      pdfText("Approval workflow handoff and commercial summary", marginX + 186, pageHeight - 66, {
        size: 9,
        fill: [0.78, 0.84, 0.92],
      }),
      pdfText(`Page ${pages.length + 1}`, pageWidth - 92, pageHeight - 46, {
        size: 9,
        fill: [0.78, 0.84, 0.92],
      }),
    ];
    y = pageHeight - 120;
    pages.push(commands);
  }

  function addFooter() {
    commands.push(pdfRule(marginX, 48, contentWidth, colors.border));
    commands.push(
      pdfText("This certificate confirms BC approval and handoff distribution.", marginX, 32, {
        size: 8,
        fill: colors.muted,
      }),
    );
    commands.push(
      pdfText(`Certificate ${issuedCertificate.id}`, pageWidth - 190, 32, {
        size: 8,
        fill: colors.muted,
      }),
    );
  }

  function ensureSpace(requiredHeight: number) {
    if (y - requiredHeight < 70) {
      addFooter();
      startPage();
    }
  }

  function sectionTitle(title: string) {
    ensureSpace(34);
    commands.push(pdfText(title, marginX, y, { size: 12, font: "F2", fill: colors.primary }));
    commands.push(pdfRule(marginX, y - 8, contentWidth, colors.border));
    y -= 28;
  }

  function fieldCard(
    label: string,
    value: string | number | null | undefined,
    x: number,
    cardY: number,
    width: number,
    height = 42,
  ) {
    commands.push(
      pdfRect(x, cardY - height, width, height, {
        fill: colors.white,
        stroke: colors.border,
        lineWidth: 0.7,
      }),
    );
    commands.push(
      pdfText(label.toUpperCase(), x + 10, cardY - 16, {
        size: 7,
        font: "F2",
        fill: colors.muted,
      }),
    );
    commands.push(
      pdfText(truncateText(value, width > 220 ? 48 : 28), x + 10, cardY - 32, {
        size: 10,
        font: "F2",
        fill: colors.primary,
      }),
    );
  }

  function twoColumnFields(items: Array<[string, string]>) {
    const gap = 12;
    const columnWidth = (contentWidth - gap) / 2;
    const rowHeight = 48;

    for (let index = 0; index < items.length; index += 2) {
      ensureSpace(rowHeight + 8);
      const rowY = y;
      const left = items[index];
      const right = items[index + 1];

      fieldCard(left[0], left[1], marginX, rowY, columnWidth);

      if (right) {
        fieldCard(right[0], right[1], marginX + columnWidth + gap, rowY, columnWidth);
      }

      y -= rowHeight;
    }

    y -= 8;
  }

  function summaryHero() {
    ensureSpace(116);
    commands.push(
      pdfRect(marginX, y - 104, contentWidth, 104, {
        fill: colors.surface,
        stroke: colors.border,
        lineWidth: 0.8,
      }),
    );
    commands.push(pdfText(project.customer, marginX + 18, y - 24, {
      size: 20,
      font: "F2",
      fill: colors.primary,
    }));
    commands.push(pdfText(`Project ${project.id}`, marginX + 18, y - 44, {
      size: 10,
      fill: colors.muted,
    }));
    commands.push(pdfText(`Issued ${issuedAtLabel(issuedCertificate.issuedAt)}`, marginX + 18, y - 62, {
      size: 9,
      fill: colors.muted,
    }));
    commands.push(
      pdfRect(pageWidth - 162, y - 42, 96, 24, {
        fill: colors.success,
      }),
    );
    commands.push(pdfText("APPROVED", pageWidth - 140, y - 34, {
      size: 10,
      font: "F2",
      fill: colors.white,
    }));
    commands.push(pdfText(`Opportunity ${issuedCertificate.salesforceOpportunityId}`, pageWidth - 220, y - 68, {
      size: 9,
      font: "F3",
      fill: colors.primary,
    }));
    y -= 126;
  }

  function renderLinkRows() {
    sectionTitle("BC Link Values");

    if (project.links.length === 0) {
      commands.push(pdfText("No link values recorded.", marginX, y, { size: 10, fill: colors.muted }));
      y -= 24;
      return;
    }

    for (const [index, link] of project.links.entries()) {
      ensureSpace(68);
      commands.push(
        pdfRect(marginX, y - 58, contentWidth, 58, {
          fill: colors.soft,
          stroke: colors.border,
          lineWidth: 0.7,
        }),
      );
      commands.push(
        pdfText(`${index + 1}. ${truncateText(link.linkName, 42)}`, marginX + 12, y - 18, {
          size: 10,
          font: "F2",
          fill: colors.primary,
        }),
      );
      commands.push(
        pdfText(
          `${normalizeProjectServiceType(link.service) ?? link.service} - ${link.technology} - ${
            link.onnetOffnet ? normalizeLinkOnnetOffnet(link.onnetOffnet) : "Unspecified"
          } - ${link.costSource ?? "No source"}`,
          marginX + 12,
          y - 34,
          { size: 8, fill: colors.muted },
        ),
      );
      commands.push(
        pdfText(
          `MRR ${kes(link.mrr)}   NRR ${kes(link.nrr)}   MRC ${kes(link.mrc)}   NRC ${kes(link.nrc)}`,
          marginX + 12,
          y - 50,
          { size: 8, font: "F2", fill: colors.primary },
        ),
      );
      commands.push(
        pdfText(
          `Onnet: ${link.onnetCapacity || "n/a"} | 3rd Party: ${link.offnetCapacity || "n/a"}`,
          marginX + 355,
          y - 50,
          { size: 8, fill: colors.muted },
        ),
      );
      y -= 68;
    }
  }

  function renderExecutiveSummary() {
    sectionTitle("Executive Summary");

    const lines = wrapText(project.projectExecutiveSummary || "No executive summary recorded.", 96);
    ensureSpace(lines.length * 14 + 18);
    commands.push(
      pdfRect(marginX, y - (lines.length * 14 + 18), contentWidth, lines.length * 14 + 18, {
        fill: colors.white,
        stroke: colors.border,
        lineWidth: 0.7,
      }),
    );

    lines.forEach((line, index) => {
      commands.push(pdfText(line, marginX + 12, y - 18 - index * 14, {
        size: 9,
        fill: colors.primary,
      }));
    });

    y -= lines.length * 14 + 34;
  }

  startPage();
  summaryHero();
  sectionTitle("Project Details");
  twoColumnFields([
    ["Salesforce Opportunity", issuedCertificate.salesforceOpportunityId],
    ["Business Case Type", project.type],
    ["Account Manager", project.accountManagerName],
    ["Contract Term", `${project.contractTermMonths} months`],
    ["Solutions Architect", project.solutionArchitectureName],
    ["Solutions Engineer", project.solutionEngineerName],
  ]);
  sectionTitle("Financial Approval Snapshot");
  twoColumnFields([
    ["Approved Budget", kes(project.approvedBudget)],
    ["Total Project Cost", kes(totalProjectCost(project))],
    ["CAPEX", kes(project.capex)],
    ["Subsidy", kes(project.subsidy)],
    ["IRR", `${project.irr}%`],
    ["Payback", `${project.payback} months`],
    ["TCV", usd(project.tcv ?? 0)],
    ["NRV", usd(project.nrv ?? 0)],
  ]);
  sectionTitle("BC Commercials Captured");
  twoColumnFields([
    ["NRR from Client", kes(project.totalNrr)],
    ["MRR", kes(project.totalMrr)],
    ["3rd Party MRC", kes(thirdPartyMrc(project))],
    ["Exchange Rate (KES/USD)", exchangeRateLabel(project)],
    ["Onnet Capacity - Mbps", aggregateCapacity(project, "onnetCapacity")],
    ["3rd Party Capacity - Mbps", aggregateCapacity(project, "offnetCapacity")],
  ]);
  renderLinkRows();
  sectionTitle("Distribution");
  twoColumnFields([
    ["Salesforce Upload Status", issuedCertificate.salesforceUploadStatus.toUpperCase()],
    ["Distributed To", issuedCertificate.distributedTo.join(", ")],
  ]);
  renderExecutiveSummary();
  addFooter();

  const pageContents = pages.map((pageCommands) => pageCommands.join("\n"));
  const logoObjectId = 6;
  const logoAlphaObject = pdfAlphaMaskObject(logoImage);
  const firstPageObjectId = logoAlphaObject ? 8 : 7;
  const pageObjects = pageContents.flatMap((content, index) => {
    const pageObjectId = firstPageObjectId + index * 2;
    const contentObjectId = pageObjectId + 1;

    return [
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R /F2 4 0 R /F3 5 0 R >> /XObject << /Logo ${logoObjectId} 0 R >> >> /Contents ${contentObjectId} 0 R >>`,
      `<< /Length ${Buffer.byteLength(content, "utf8")} >>\nstream\n${content}\nendstream`,
    ];
  });
  const pageKids = pageContents
    .map((_content, index) => `${firstPageObjectId + index * 2} 0 R`)
    .join(" ");
  const imageObjects: PdfObject[] = [
    pdfImageObject(logoImage, logoAlphaObject ? 7 : undefined),
    ...(logoAlphaObject ? [logoAlphaObject] : []),
  ];
  const objects: PdfObject[] = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    `<< /Type /Pages /Kids [${pageKids}] /Count ${pageContents.length} >>`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>",
    ...imageObjects,
    ...pageObjects,
  ];

  const pdfChunks: Buffer[] = [Buffer.from("%PDF-1.4\n", "utf8")];
  let pdfLength = pdfChunks[0].length;
  const offsets = [0];

  objects.forEach((object, index) => {
    const objectBuffer = Buffer.isBuffer(object) ? object : Buffer.from(object, "utf8");
    const header = Buffer.from(`${index + 1} 0 obj\n`, "utf8");
    const footer = Buffer.from("\nendobj\n", "utf8");

    offsets.push(pdfLength);
    pdfChunks.push(header, objectBuffer, footer);
    pdfLength += header.length + objectBuffer.length + footer.length;
  });

  const xrefOffset = pdfLength;
  const xref = [
    `xref\n0 ${objects.length + 1}\n`,
    "0000000000 65535 f \n",
    offsets
      .slice(1)
      .map((offset) => `${offset.toString().padStart(10, "0")} 00000 n \n`)
      .join(""),
    `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\n`,
    `startxref\n${xrefOffset}\n%%EOF\n`,
  ].join("");

  pdfChunks.push(Buffer.from(xref, "utf8"));

  return Buffer.concat(pdfChunks);
}
