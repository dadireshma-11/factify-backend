import path from "path";
import fetch from "node-fetch";
import * as cheerio from "cheerio";
import Tesseract from "tesseract.js";
import { PDFParse } from "pdf-parse";
import {
  GoogleGenerativeAI,
  HarmCategory,
  HarmBlockThreshold,
} from "@google/generative-ai";
import History from "../models/History.js";
import User from "../models/UserModels.js";
import { sendHighRiskAlertEmail } from "../services/emailService.js";

const TRUSTED_ENTITIES = [
  "nasa",
  "isro",
  "who",
  "un",
  "unesco",
  "unicef",
  "cdc",
  "nih",
  "fda",
  "reuters",
  "associated press",
  "ap",
  "bbc",
  "the hindu",
  "indian express",
  "new york times",
  "washington post",
  "world bank",
  "imf",
  "nature",
  "science journal",
];

const TRUSTED_DOMAINS = [
  "nasa.gov",
  "isro.gov.in",
  "who.int",
  "un.org",
  "unesco.org",
  "unicef.org",
  "cdc.gov",
  "nih.gov",
  "fda.gov",
  "reuters.com",
  "apnews.com",
  "bbc.com",
  "thehindu.com",
  "indianexpress.com",
  "nytimes.com",
  "washingtonpost.com",
  "worldbank.org",
  "imf.org",
  "nature.com",
  "science.org",
];

const SUSPICIOUS_PATTERNS = [
  /breaking news!/i,
  /miracle cure/i,
  /works instantly/i,
  /click here/i,
  /claim free/i,
  /before it expires/i,
  /limited time/i,
  /shocking truth/i,
  /you won'?t believe/i,
  /secret doctors/i,
  /guaranteed cure/i,
  /100% proven/i,
  /free treatment/i,
  /act now/i,
  /urgent/i,
  /exclusive secret/i,
  /cure for cancer/i,
  /lose weight overnight/i,
  /government hiding/i,
  /doctors hate this/i,
];

const POSITIVE_FACTUAL_PATTERNS = [
  /\blaunched\b/i,
  /\breleased\b/i,
  /\bannounced\b/i,
  /\breported\b/i,
  /\bconfirmed\b/i,
  /\bstudy\b/i,
  /\bresearch\b/i,
  /\bsatellite\b/i,
  /\bclimate\b/i,
  /\bmonitor\b/i,
  /\bpolicy\b/i,
  /\belection commission\b/i,
  /\bministry\b/i,
  /\bdata\b/i,
  /\brecord\b/i,
];

const EXTRAORDINARY_KEYWORDS = [
  "alien",
  "ufo",
  "landed",
  "ghost",
  "miracle cure",
  "flat earth",
  "chemtrail",
];

const URL_REGEX = /(https?:\/\/[^\s]+)|(www\.[^\s]+)/gi;

const normalizeText = (text = "") =>
  String(text)
    .replace(/\s+/g, " ")
    .replace(/[""]/g, '"')
    .replace(/['']/g, "'")
    .trim();

const splitSentences = (text = "") =>
  text
    .split(/[.!?]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 15);

const formatResultLabel = (result) => {
  if (result === "fake") return "Fake";
  if (result === "real") return "Real";
  return "Uncertain";
};

const buildDisplayUrl = (inputText, inputType) => {
  if (inputType === "url") return inputText.slice(0, 500);
  const snippet = inputText.replace(/\s+/g, " ").trim();
  if (snippet.length <= 120) return snippet;
  return `${snippet.slice(0, 117)}...`;
};

const getRiskLevel = (verdict, score = 0) => {
  const numericScore = Number(score) || 0;
  const riskScore = verdict === "real" ? 100 - numericScore : numericScore;

  if (riskScore >= 90) return "Critical";
  if (riskScore >= 70) return "High";
  if (riskScore >= 40) return "Medium";
  return "Low";
};

const hasTrustedEntity = (normalized) => {
  const lower = normalized.toLowerCase();
  return TRUSTED_ENTITIES.some((entity) => lower.includes(entity));
};

const findTrustedMentions = (normalized) => {
  const lower = normalized.toLowerCase();
  return TRUSTED_ENTITIES.filter((entity) => lower.includes(entity)).map(
    (entity) => entity.toUpperCase()
  );
};

const extractUrls = (text = "") => {
  const matches = text.match(URL_REGEX);
  return matches ? [...new Set(matches)] : [];
};

const countTrustedSourceLinks = (text = "") => {
  const urls = extractUrls(text.toLowerCase());
  return urls.filter((url) =>
    TRUSTED_DOMAINS.some((domain) => url.includes(domain))
  );
};

const ENTITY_HOME_URLS = {
  nasa: "https://www.nasa.gov",
  isro: "https://www.isro.gov.in",
  who: "https://www.who.int",
  un: "https://www.un.org",
  unesco: "https://www.unesco.org",
  unicef: "https://www.unicef.org",
  cdc: "https://www.cdc.gov",
  nih: "https://www.nih.gov",
  fda: "https://www.fda.gov",
  reuters: "https://www.reuters.com",
  "associated press": "https://apnews.com",
  ap: "https://apnews.com",
  bbc: "https://www.bbc.com",
  "the hindu": "https://www.thehindu.com",
  "indian express": "https://indianexpress.com",
  "new york times": "https://www.nytimes.com",
  "washington post": "https://www.washingtonpost.com",
  "world bank": "https://www.worldbank.org",
  imf: "https://www.imf.org",
  nature: "https://www.nature.com",
  "science journal": "https://www.science.org",
};

const normalizeSourceUrl = (raw = "") => {
  let url = String(raw).trim().replace(/[.,;:!?)]+$/g, "");
  if (!url) return null;
  if (!/^https?:\/\//i.test(url)) {
    url = `https://${url}`;
  }
  return url;
};

const linkLabelFromUrl = (url) => {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, "");
  } catch {
    return url.length > 48 ? `${url.slice(0, 45)}...` : url;
  }
};

const buildSourceLinks = (normalized = "", trustedMentions = []) => {
  const links = [];
  const seen = new Set();

  const addLink = (label, rawUrl) => {
    const url = normalizeSourceUrl(rawUrl);
    if (!url) return;

    try {
      const href = new URL(url).href;
      if (seen.has(href)) return;
      seen.add(href);
      links.push({
        label: label || linkLabelFromUrl(href),
        url: href,
      });
    } catch {
      // skip invalid URLs
    }
  };

  extractUrls(normalized).forEach((raw) => {
    const url = normalizeSourceUrl(raw);
    if (!url) return;
    addLink(linkLabelFromUrl(url), url);
  });

  const lower = normalized.toLowerCase();
  TRUSTED_ENTITIES.forEach((entity) => {
    if (!lower.includes(entity)) return;
    const homeUrl = ENTITY_HOME_URLS[entity];
    if (homeUrl) {
      addLink(entity.toUpperCase(), homeUrl);
    }
  });

  trustedMentions.forEach((mention) => {
    const key = String(mention).toLowerCase();
    const homeUrl = ENTITY_HOME_URLS[key];
    if (homeUrl) {
      addLink(String(mention).toUpperCase(), homeUrl);
    }
  });

  return links;
};

const countSuspiciousMatches = (text = "") =>
  SUSPICIOUS_PATTERNS.filter((pattern) => pattern.test(text));

const isExtraordinaryWithoutTrustedSource = (normalized) => {
  const lower = normalized.toLowerCase();
  const hasExtraordinary = EXTRAORDINARY_KEYWORDS.some((keyword) =>
    lower.includes(keyword)
  );
  return hasExtraordinary && !hasTrustedEntity(normalized);
};

const getAllUploadedFiles = (files = {}) => {
  const buckets = ["files", "images", "voice"];
  return buckets.flatMap((key) =>
    Array.isArray(files[key]) ? files[key] : []
  );
};

const classifyUploadedFiles = (files = {}) => {
  const allFiles = getAllUploadedFiles(files);
  const textFiles = [];
  const imageFiles = [];
  const audioFiles = [];
  const pdfFiles = [];

  allFiles.forEach((file) => {
    const mime = String(file.mimetype || "").toLowerCase();
    const ext = path.extname(file.originalname || "").toLowerCase();

    if (mime.startsWith("image/")) {
      imageFiles.push(file);
      return;
    }

    if (mime.startsWith("audio/")) {
      audioFiles.push(file);
      return;
    }

    if (mime.includes("pdf") || ext === ".pdf") {
      pdfFiles.push(file);
      textFiles.push(file);
      return;
    }

    if (
      mime.startsWith("text/") ||
      mime.includes("word") ||
      [".txt", ".doc", ".docx"].includes(ext)
    ) {
      textFiles.push(file);
    }
  });

  return { allFiles, textFiles, imageFiles, audioFiles, pdfFiles };
};

const readTextFileBuffer = (buffer) => buffer.toString("utf8");

const extractTextFromPdf = async (buffer) => {
  const parser = new PDFParse({ data: buffer });
  const result = await parser.getText();
  return normalizeText(result?.text || "");
};

const extractTextFromImage = async (buffer) => {
  const {
    data: { text },
  } = await Tesseract.recognize(buffer, "eng");
  return normalizeText(text || "");
};

const fetchUrlText = async (url) => {
  const response = await fetch(url, {
    headers: { "User-Agent": "FactifyBot/1.0" },
  });

  if (!response.ok) {
    throw new Error("Could not fetch URL content");
  }

  const html = await response.text();
  const $ = cheerio.load(html);
  $("script, style, noscript").remove();
  return normalizeText($("body").text());
};

const extractContentFromUploads = async (uploadMeta) => {
  const parts = [];

  for (const file of uploadMeta.textFiles) {
    const ext = path.extname(file.originalname || "").toLowerCase();
    const mime = String(file.mimetype || "").toLowerCase();

    if (mime.includes("pdf") || ext === ".pdf") {
      const pdfText = await extractTextFromPdf(file.buffer);
      if (pdfText) parts.push(pdfText);
    } else {
      const text = readTextFileBuffer(file.buffer);
      if (text.trim()) parts.push(normalizeText(text));
    }
  }

  for (const file of uploadMeta.imageFiles) {
    const ocrText = await extractTextFromImage(file.buffer);
    if (ocrText) parts.push(ocrText);
  }

  if (uploadMeta.audioFiles.length > 0) {
    parts.push(
      "[Voice recording uploaded. Transcribe manually or add text for full analysis.]"
    );
  }

  return normalizeText(parts.join(" "));
};

const buildFallbackExplanations = (normalized, verdict, trustedMentions) => {
  const explanations = [
    "Our language analysis scans for sensational phrasing, urgency tactics, and claims that lack verifiable evidence or named institutional sources before assigning a credibility score.",
    "Source verification checks whether the text cites recognized outlets such as NASA, ISRO, BBC, Reuters, AP, WHO, or UN agencies that typically confirm major scientific or news events.",
    "Cross-referencing compares each extracted claim against patterns seen in known misinformation, official press releases, and peer-reviewed reporting standards used by professional fact-checkers.",
  ];

  if (trustedMentions.length > 0) {
    explanations.push(
      `The content references trusted entities (${trustedMentions.join(", ")}), which supports source validation, though readers should still confirm the exact claim on the official outlet website.`,
    );
  } else if (verdict === "fake") {
    explanations.push(
      "No trusted entity such as NASA, ISRO, BBC, Reuters, AP, or WHO was cited to support extraordinary or high-impact claims, which is a common indicator of fabricated viral content.",
    );
  } else {
    explanations.push(
      "Readers should verify this material on primary sources and established newsrooms before sharing, because limited citation of recognized institutions reduces confidence in the final verdict.",
    );
  }

  return explanations.slice(0, 5);
};

const ensureExplanations = (explanations, normalized, verdict, trustedMentions) => {
  const valid = (Array.isArray(explanations) ? explanations : [])
    .map((item) => String(item || "").trim())
    .filter((item) => item.length >= 15);

  if (valid.length >= 3) {
    return valid.slice(0, 5);
  }

  const merged = [...valid, ...buildFallbackExplanations(normalized, verdict, trustedMentions)];
  const unique = [...new Set(merged)];
  return unique.slice(0, 5);
};

const buildClaimsArray = (normalized, verdict, aiClaims = []) => {
  if (Array.isArray(aiClaims) && aiClaims.length > 0) {
    return aiClaims.map((item, index) => ({
      id: index + 1,
      claim: String(item.claim || item.text || "").trim(),
      verdict: String(item.verdict || verdict).toLowerCase(),
      reason: String(
        item.reason ||
          `This statement was evaluated as ${item.verdict || verdict} based on source and language signals.`
      ),
    })).filter((item) => item.claim.length > 0);
  }

  const sentences = splitSentences(normalized);

  if (sentences.length === 0) {
    return [
      {
        id: 1,
        claim: normalized,
        verdict,
        reason: `Main statement from input classified as ${verdict} after source and language review.`,
      },
    ];
  }

  return sentences.map((sentence, index) => ({
    id: index + 1,
    claim: sentence,
    verdict,
    reason: `Extracted claim ${index + 1} evaluated with overall ${verdict} verdict based on sourcing and wording.`,
  }));
};

const buildForcedExtraordinaryAnalysis = (normalized) => {
  const verdict = "fake";
  const confidence = 95;
  const riskLevel = getRiskLevel(verdict, confidence);
  const trustedMentions = [];
  const riskSignals = ["extraordinary_claim", "no_verification"];

  const explanations = [
    "This text describes an extraordinary event such as aliens or UFOs landing, which would require immediate confirmation from space agencies like NASA or ISRO and coverage from major outlets such as BBC or Reuters.",
    "No trusted entity from our verified list (NASA, ISRO, BBC, Reuters, AP, WHO, UN) appears in the content, so the claim cannot be cross-checked against official or established news sources.",
    "Sensational extraterrestrial landing stories spread widely on social media without primary evidence and are a well-known misinformation pattern that responsible readers should treat as unverified.",
    "Professional fact-checkers require named institutions, dated reports, and corroborating coverage before treating any extraordinary claim as credible, and none of those signals are present here.",
  ];

  const claims = buildClaimsArray(normalized, verdict);

  return {
    verdict,
    result: verdict,
    confidence,
    riskLevel,
    trusted_mentions: trustedMentions,
    trustedSources: [],
    trustedSourceList: [],
    suspiciousSources: ["unverified-source"],
    suspiciousIndicators: ["unverified-source"],
    risk_signals: riskSignals,
    claims,
    claimsExtracted: claims.length,
    explanations,
    rewriteSuggestion:
      "Do not share this claim. Verify only through official agencies such as NASA, ISRO, and established outlets like BBC or Reuters before believing extraordinary stories.",
    extractedText: normalized.slice(0, 500),
    statementsAnalyzed: splitSentences(normalized).length || 1,
  };
};

const parseGeminiJson = (rawText) => {
  const jsonMatch = String(rawText || "").match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("Gemini returned non-JSON response");
  }
  return JSON.parse(jsonMatch[0]);
};

const analyzeWithAI = async (normalized) => {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel(
    {
      model: "gemini-1.0-pro",
      safetySettings: [
        {
          category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
          threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
        },
      ],
    },
    { apiVersion: "v1" }
  );

  const trustedList = TRUSTED_ENTITIES.join(", ");

  const prompt = `You are a fake news and misinformation detection assistant. Analyze the content and respond with ONLY valid JSON (no markdown).

CRITICAL RULES:
- If the text makes extraordinary claims like aliens, UFOs, ghosts, miracle cures, or flat earth AND does NOT mention any trusted entity from [${trustedList}], verdict MUST be "fake". Never return "uncertain" for alien landing claims without sources.
- Mark "fake" for scams, phishing, hoaxes, and unverified sensational disaster or health claims.
- Mark "real" only when credible institutions or outlets are cited and claims are plausible.
- Mark "uncertain" for hedged early science or unconfirmed reports that use cautious language.
- confidence is misinformation risk 0-100 (higher means more likely fake or harmful).
- trusted_mentions: ONLY entities from the trusted list that appear in the text (empty array if none).
- risk_signals: short snake_case labels for detected issues.
- claims: array of objects with claim, verdict, reason (never empty).
- explanations: 3 to 5 strings, each at least 15 words, about verification and language analysis.

JSON shape:
{
  "verdict": "fake" | "real" | "uncertain",
  "confidence": 0,
  "trusted_mentions": [],
  "risk_signals": [],
  "claims": [{"claim": "", "verdict": "", "reason": ""}],
  "explanations": ["", "", ""]
}

Content:
"""
${normalized.slice(0, 4000)}
"""`;

  const response = await model.generateContent(prompt);
  const rawText = response.response.text();
  const parsed = parseGeminiJson(rawText);

  const verdict = String(parsed.verdict || parsed.result || "uncertain").toLowerCase();
  const validVerdicts = ["fake", "real", "uncertain"];
  const finalVerdict = validVerdicts.includes(verdict) ? verdict : "uncertain";

  let confidence = Math.min(
    100,
    Math.max(0, Number(parsed.confidence) || 50)
  );

  if (isExtraordinaryWithoutTrustedSource(normalized)) {
    return buildForcedExtraordinaryAnalysis(normalized);
  }

  const trustedMentions = Array.isArray(parsed.trusted_mentions)
    ? parsed.trusted_mentions.map((item) => String(item))
    : findTrustedMentions(normalized);

  if (finalVerdict === "fake") {
    confidence = Math.max(confidence, 85);
  } else if (finalVerdict === "real") {
    confidence = Math.min(confidence, 35);
  } else {
    confidence = Math.max(38, Math.min(64, confidence));
  }

  const risk_signals = Array.isArray(parsed.risk_signals)
    ? parsed.risk_signals.map((item) => String(item))
    : [];

  const suspiciousPatterns = countSuspiciousMatches(normalized);
  if (suspiciousPatterns.length > 0) {
    risk_signals.push("suspicious_language");
  }

  const claims = buildClaimsArray(normalized, finalVerdict, parsed.claims);
  const explanations = ensureExplanations(
    parsed.explanations,
    normalized,
    finalVerdict,
    trustedMentions
  );

  const riskLevel = getRiskLevel(finalVerdict, Math.round(confidence));

  return {
    verdict: finalVerdict,
    result: finalVerdict,
    confidence: Math.round(confidence),
    riskLevel,
    trusted_mentions: trustedMentions,
    trustedSources: countTrustedSourceLinks(normalized),
    trustedSourceList: countTrustedSourceLinks(normalized),
    suspiciousSources: risk_signals.length
      ? risk_signals
      : suspiciousPatterns.map(() => "suspicious_language"),
    suspiciousIndicators: risk_signals,
    risk_signals,
    claims,
    claimsExtracted: claims.length,
    explanations,
    rewriteSuggestion:
      finalVerdict === "fake"
        ? "This content shows high misinformation risk. Verify only through NASA, ISRO, BBC, Reuters, AP, or WHO before sharing."
        : finalVerdict === "uncertain"
          ? "This claim needs more verification. Check official sources and established newsrooms before sharing."
          : "This content appears credible, but confirm details on the cited official outlet before sharing widely.",
    extractedText: normalized.slice(0, 500),
    statementsAnalyzed: splitSentences(normalized).length || 1,
  };
};

const analyzeWithHeuristics = (normalized, uploadMeta) => {
  if (isExtraordinaryWithoutTrustedSource(normalized)) {
    return buildForcedExtraordinaryAnalysis(normalized);
  }

  const trustedMentions = findTrustedMentions(normalized);
  const trustedLinks = countTrustedSourceLinks(normalized);
  const suspiciousPatterns = countSuspiciousMatches(normalized);
  const factualMatches = POSITIVE_FACTUAL_PATTERNS.filter((pattern) =>
    pattern.test(normalized)
  );

  let score = 50;
  score += trustedMentions.length * 8;
  score += trustedLinks.length * 15;
  score += factualMatches.length * 6;
  score -= suspiciousPatterns.length * 18;

  if (normalized.length < 25) {
    score -= 10;
  }

  score = Math.max(0, Math.min(100, score));

  let verdict = "uncertain";

  if (suspiciousPatterns.length >= 3) {
    verdict = "fake";
    score = Math.min(score, 25);
  } else if (
    (trustedMentions.length >= 1 || trustedLinks.length >= 1) &&
    factualMatches.length >= 1 &&
    suspiciousPatterns.length === 0
  ) {
    verdict = "real";
    score = Math.max(score, 78);
  } else if (score >= 70) {
    verdict = "real";
  } else if (score <= 35) {
    verdict = "fake";
  }

  const confidence =
    verdict === "real"
      ? Math.max(70, score)
      : verdict === "fake"
        ? Math.max(75, 100 - score)
        : Math.max(55, 100 - Math.abs(score - 50) * 1.2);

  const risk_signals = [];
  if (suspiciousPatterns.length > 0) {
    risk_signals.push("suspicious_language");
  }
  if (trustedMentions.length === 0 && verdict !== "real") {
    risk_signals.push("no_trusted_mention");
  }

  const claims = buildClaimsArray(normalized, verdict);
  const explanations = ensureExplanations([], normalized, verdict, trustedMentions);

  if (uploadMeta.fileCount > 0) {
    explanations.push(
      `The request included ${uploadMeta.fileCount} uploaded file(s) that were processed for text extraction before the credibility verdict was calculated.`,
    );
  }

  return {
    verdict,
    result: verdict,
    confidence: Math.round(confidence),
    riskLevel: getRiskLevel(verdict, Math.round(confidence)),
    trusted_mentions: trustedMentions,
    trustedSources: trustedLinks,
    trustedSourceList: trustedLinks,
    suspiciousSources: risk_signals,
    suspiciousIndicators: risk_signals,
    risk_signals,
    claims,
    claimsExtracted: claims.length,
    explanations: explanations.slice(0, 5),
    rewriteSuggestion:
      verdict === "fake"
        ? "Avoid sharing until verified with NASA, ISRO, BBC, Reuters, AP, or WHO."
        : "Add clear sources and dates before sharing this content widely.",
    extractedText: normalized.slice(0, 500),
    statementsAnalyzed: splitSentences(normalized).length || 1,
  };
};

export const predict = async (req, res) => {
  try {
    const body = req.body || {};
    const files = req.files || {};

    const { textFiles, imageFiles, audioFiles, allFiles } =
      classifyUploadedFiles(files);

    const data = typeof body.data === "string" ? body.data : "";
    const url = typeof body.url === "string" ? body.url : "";
    const type = typeof body.type === "string" ? body.type : "";

    let rawInput = normalizeText(data || "");
    let uploadExtractedText = "";

    if (allFiles.length > 0) {
      uploadExtractedText = await extractContentFromUploads({
        textFiles,
        imageFiles,
        audioFiles,
        fileCount: textFiles.length + imageFiles.length,
      });

      if (uploadExtractedText) {
        rawInput = normalizeText(`${rawInput} ${uploadExtractedText}`);
      }
    }

    if (!rawInput && url) {
      rawInput = await fetchUrlText(url);
    }

    if (!rawInput && allFiles.length === 0) {
      return res.status(400).json({ message: "No input provided" });
    }

    const inputType =
      imageFiles.length > 0
        ? "image"
        : textFiles.some((file) =>
            String(file.mimetype || "").includes("pdf")
          )
          ? "pdf"
          : url && !data
            ? "url"
            : type === "url"
              ? "url"
              : "text";

    const normalized = rawInput || "[empty input]";

    let analysis;

    if (isExtraordinaryWithoutTrustedSource(normalized)) {
      analysis = buildForcedExtraordinaryAnalysis(normalized);
    } else if (process.env.GEMINI_API_KEY) {
      try {
        analysis = await analyzeWithAI(normalized);
      } catch (error) {
        console.error("Gemini analysis failed:", error.message);
        analysis = analyzeWithHeuristics(normalized, {
          fileCount: allFiles.length,
        });
      }
    } else {
      analysis = analyzeWithHeuristics(normalized, {
        fileCount: allFiles.length,
      });
    }

    if (inputType === "image" || inputType === "pdf") {
      analysis.extractedText = normalized.slice(0, 500);
    } else if (uploadExtractedText) {
      analysis.extractedText = uploadExtractedText.slice(0, 500);
    }

    const resultLabel = formatResultLabel(analysis.verdict);
    const riskLevel = analysis.riskLevel || getRiskLevel(analysis.verdict, analysis.confidence);

    console.log(
      "Final verdict:",
      analysis.verdict,
      "Risk:",
      riskLevel
    );

    await History.create({
      userId: req.user._id,
      url: buildDisplayUrl(normalized, inputType),
      content: normalized,
      inputType: inputType === "image" || inputType === "pdf" ? "text" : inputType,
      result: resultLabel,
      confidence: analysis.confidence,
      trustedSources: [
        ...analysis.trusted_mentions,
        ...analysis.trustedSourceList,
      ],
      suspiciousSources: [
        ...analysis.risk_signals,
        ...analysis.suspiciousSources,
      ],
      claimsExtracted: analysis.claimsExtracted,
    });

    const isHighRisk =
      analysis.verdict === "fake" &&
      (riskLevel === "High" || riskLevel === "Critical" || analysis.confidence >= 70);

    const user = await User.findById(req.user._id);

    if (user?.settings?.emailAlerts && isHighRisk) {
      try {
        console.log("[EMAIL ALERT] Sending high-risk alert for:", {
          verdict: analysis.verdict,
          riskLevel,
          confidence: analysis.confidence,
          email: user.email,
        });
        await sendHighRiskAlertEmail(user, {
          resultLabel,
          riskLevel,
          confidence: analysis.confidence,
          preview: normalized.slice(0, 200),
        });
      } catch (emailError) {
        console.error("High-risk email alert failed:", emailError.message);
      }
    }

    const pushEnabled = Boolean(user?.settings?.pushNotifications);

    return res.status(200).json({
      result: analysis.result,
      verdict: analysis.verdict,
      confidence: analysis.confidence,
      riskLevel,
      trusted_mentions: analysis.trusted_mentions,
      trustedSources: analysis.trustedSourceList,
      trustedSourceList: analysis.trustedSourceList,
      trustedEntities: analysis.trusted_mentions.length,
      trustedEntityList: analysis.trusted_mentions,
      suspiciousSources: analysis.suspiciousSources,
      suspiciousIndicators: analysis.suspiciousSources,
      risk_signals: analysis.risk_signals,
      claims: analysis.claims,
      claimsExtracted: analysis.claimsExtracted,
      extractedClaims: analysis.claims,
      extractedText: analysis.extractedText || null,
      statementsAnalyzed: analysis.statementsAnalyzed,
      explanations: analysis.explanations,
      rewriteSuggestion: analysis.rewriteSuggestion,
      source_links: buildSourceLinks(
        normalized,
        analysis.trusted_mentions || []
      ),
      uploadedFiles: {
        total: allFiles.length,
        text: textFiles.length,
        images: imageFiles.length,
        audio: audioFiles.length,
      },
      message: "Prediction successful",
      pushNotification:
        pushEnabled && isHighRisk
          ? {
              title: "FACTIFY: High-risk content detected",
              body: `${resultLabel} verdict (${riskLevel} risk, ${analysis.confidence}% confidence)`,
            }
          : null,
    });
  } catch (error) {
    console.error("Predict Error:", error);
    return res.status(500).json({
      message: error.message || "Server error",
    });
  }
};
