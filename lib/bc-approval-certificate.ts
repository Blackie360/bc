import type { ProjectRecord } from "@/lib/project-record-types";

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
      pdfRect(marginX, pageHeight - 76, 54, 42, { fill: colors.accent }),
      pdfText("BC", marginX + 15, pageHeight - 62, {
        size: 18,
        font: "F2",
        fill: colors.white,
      }),
      pdfText("BUSINESS CASE APPROVAL CERTIFICATE", marginX + 70, pageHeight - 46, {
        size: 16,
        font: "F2",
        fill: colors.white,
      }),
      pdfText("Approval workflow handoff and commercial summary", marginX + 70, pageHeight - 66, {
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
          `${link.service} - ${link.technology} - ${link.onnetOffnet ?? "Unspecified"} - ${link.costSource ?? "No source"}`,
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
          `Onnet: ${link.onnetCapacity || "n/a"} | Offnet: ${link.offnetCapacity || "n/a"}`,
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
    ["Offnet Capacity - Mbps", aggregateCapacity(project, "offnetCapacity")],
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
  const pageObjects = pageContents.flatMap((content, index) => {
    const pageObjectId = 6 + index * 2;
    const contentObjectId = pageObjectId + 1;

    return [
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R /F2 4 0 R /F3 5 0 R >> >> /Contents ${contentObjectId} 0 R >>`,
      `<< /Length ${Buffer.byteLength(content, "utf8")} >>\nstream\n${content}\nendstream`,
    ];
  });
  const pageKids = pageContents
    .map((_content, index) => `${6 + index * 2} 0 R`)
    .join(" ");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    `<< /Type /Pages /Kids [${pageKids}] /Count ${pageContents.length} >>`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>",
    ...pageObjects,
  ];

  let pdf = "%PDF-1.4\n";
  const offsets = [0];

  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf, "utf8"));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });

  const xrefOffset = Buffer.byteLength(pdf, "utf8");
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  pdf += offsets
    .slice(1)
    .map((offset) => `${offset.toString().padStart(10, "0")} 00000 n \n`)
    .join("");
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\n`;
  pdf += `startxref\n${xrefOffset}\n%%EOF\n`;

  return Buffer.from(pdf, "utf8");
}
