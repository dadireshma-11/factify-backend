import { GoogleGenerativeAI } from "@google/generative-ai";

const SENSATIONAL_PATTERNS =
  /\b(shocking|breaking|viral|secret|exclusive|bombshell|exposed|they don't want you to know|just in|urgent|unbelievable|you won't believe)\b/i;
const EXTRAORDINARY_CLAIM_PATTERNS =
  /\b(cure|miracle|instantly|guaranteed|100%|free money|click here|limited time)\b/i;
const EXTRAORDINARY_TOPIC_PATTERNS =
  /\b(aliens?|ufo'?s?|extraterrestrial|bigfoot|zombie(?:s)?|apocalypse|flat earth|chemtrails|illuminati|reptilian|time travel|immortal|antichrist|deepfake proof|vaccine (?:kills|changes|contains)|microchip(?:ped)?|mind control)\b/i;
const UNVERIFIED_EVENT_PATTERNS =
  /\b(landed|crash(?:ed)?|invad(?:e|ing|ed)|spotted (?:in|over|near)|discovered (?:in|on|near)|found alive|not dead|faked (?:his|her|their) death|government hiding|cover[- ]?up|they're hiding)\b/i;
const FAKE_INDICATOR_PATTERNS =
  /\b(fake news|hoax|conspiracy|deep state|mainstream media lies|wake up sheeple)\b/i;
const SCAM_PRIZE_PATTERNS =
  /\b(congratulations|congrats)\b.*\b(you(?:'ve| have)? won|winner|selected)\b|\b(you(?:'ve| have)? won)\b.*\b(prize|lottery|jackpot|cash|reward|rupees?|rs\.?|dollars?)\b|\bwon a lottery\b/i;
const UNSOLICITED_REWARD_PATTERNS =
  /\b(claim (?:your )?prize|cash prize|lottery (?:winner|prize)|selected (?:as )?winner|free (?:gift|reward|iphone|laptop)|inherit(?:ance)?|bank transfer pending|verify (?:your )?(?:bank|account|card|identity|details)|processing fee|pay (?:a )?fee to (?:claim|receive)|click here)\b/i;

const SCAM_INDICATOR_PATTERNS = [
  { pattern: /\bbreaking news\b/i, label: "Sensational 'breaking news' opener" },
  {
    pattern: /\b(?:you(?:'ve| have)? won|won a lottery)\b/i,
    label: "Unverified lottery / prize win claim",
  },
  { pattern: /\bclick here\b/i, label: "Clickbait call-to-action" },
  {
    pattern: /\bclaim (?:your )?prize\b/i,
    label: "Pressure to claim a prize",
  },
  {
    pattern: /\bverify (?:your )?(?:bank|account|card)\b/i,
    label: "Request to verify bank or account details (phishing risk)",
  },
  { pattern: /\burgent(?:ly)?\b/i, label: "Urgency pressure tactic" },
  { pattern: /\blimited time\b/i, label: "Artificial time pressure" },
  { pattern: /\bact now\b/i, label: "High-pressure 'act now' language" },
  { pattern: /\bshare (?:now|immediately)\b/i, label: "Viral share pressure" },
  { pattern: /\bforward (?:this|to)\b/i, label: "Chain-forwarding pressure" },
];
const FINANCIAL_BAIT_PATTERNS =
  /\b(\d{1,3}(?:,\d{3})+|\d{4,})\s*(?:cash|rupees?|rs\.?|dollars?|usd|inr|prize|reward)\b|\b(?:rs\.?|₹|\$)\s*\d{1,3}(?:,\d{3})+\b/i;

const KNOWN_TRUSTED_DOMAINS = [
  "bbc.com",
  "reuters.com",
  "apnews.com",
  "nytimes.com",
  "theguardian.com",
  "npr.org",
  "pbs.org",
  "who.int",
];

const KNOWN_SUSPICIOUS_PATTERNS = [
  /viralnews/i,
  /truth\d+/i,
  /realpatriot/i,
  /uncensored/i,
  /\.xyz$/i,
  /clickbait/i,
  /rumor/i,
];

const CREDIBLE_REPORTING_PATTERNS =
  /\b(according to (?:the )?|officials? (?:said|stated|confirmed)|researchers? (?:at|from)|study (?:found|shows|published|suggests)|scientists? (?:claim|said)|peer[- ]reviewed|published in|the (?:who|world health organization|un|cdc|fda)|data from|statistics show|minister (?:said|announced)|government (?:said|announced)|court (?:ruled|found)|economic data|inflation rate|interest rate|(?:reserve|central) bank (?:said|announced|released)|quarterly (?:financial )?report|released (?:updated )?.*?guidelines)\b/i;

const HEDGED_REPORTING_PATTERNS =
  /\b(possible|possibly|may|might|suggests?|preliminary|unconfirmed|no confirmation|not (?:yet )?confirmed|early (?:study|results)|needs?(?: more)? (?:study|research)|awaiting (?:peer )?review|not verified|could be|appears to)\b/i;

const SCIENTIFIC_REPORTING_PATTERNS =
  /\b(scientists?|researchers?|study (?:found|shows|suggests)|clinical trial|laboratory|university|medical (?:journal|research)|peer[- ]reviewed)\b/i;

const DISASTER_PREDICTION_PATTERNS =
  /\b(earthquake|tsunami|flood|hurricane|cyclone|tornado|wildfire|volcanic eruption|major disaster|storm surge|landslide)\b/i;

const HEDGED_DISASTER_REPORTING_PATTERNS =
  /\b(reports? suggest|might hit|could hit|may hit|expected (?:to|in)|predicted to|early seismic|early signs|seismic activity|threat of|warns? of)\b/i;

const CONFIRMED_DISASTER_PATTERNS =
  /\b(?:confirmed|official (?:warning|alert)|evacuation ordered|authorities confirmed|USGS confirmed|met office confirmed|government warned)\b/i;

const TRUSTED_MEDIA_MENTIONS = [
  { pattern: /\breuters\b/i, domain: "reuters.com" },
  { pattern: /\bassociated press\b/i, domain: "apnews.com" },
  { pattern: /\bBBC\b/i, domain: "bbc.com" },
  { pattern: /\bThe Guardian\b/i, domain: "theguardian.com" },
  { pattern: /\bNew York Times\b/i, domain: "nytimes.com" },
  { pattern: /\bNPR\b/i, domain: "npr.org" },
];

const OFFICIAL_TRUSTED_MENTIONS = [
  {
    pattern: /\bgovernment (?:said|announced|confirmed|released|approved)\b/i,
    label: "Government (official announcement)",
  },
  {
    pattern: /\bofficial (?:review|statement|report|notification|meeting)\b/i,
    label: "Official review / statement",
  },
  {
    pattern: /\bministry (?:said|announced|confirmed)\b/i,
    label: "Government ministry",
  },
  {
    pattern: /\b(?:cabinet|parliament|senate|congress) (?:said|announced|approved|passed)\b/i,
    label: "Legislative / cabinet announcement",
  },
  {
    pattern: /\b(?:police|court|election commission) (?:said|announced|confirmed)\b/i,
    label: "Public authority statement",
  },
  {
    pattern: /\b(?:USGS|met office|national weather service) confirmed\b/i,
    label: "Official agency (confirmed event)",
  },
  {
    pattern:
      /\b(?:the )?(?:reserve|central) bank (?:said|announced|released|published|confirmed)\b/i,
    label: "Central bank (official release)",
  },
  {
    pattern:
      /\b(?:federal reserve|RBI|Bank of England|ECB|Bank of Japan) (?:said|announced|released|published)\b/i,
    label: "Central bank (official release)",
  },
  {
    pattern: /\b(?:released|published) (?:updated )?(?:interest rate|monetary|financial|policy)/i,
    label: "Official policy / financial release",
  },
  {
    pattern: /\bquarterly (?:financial )?report\b/i,
    label: "Official periodic financial report",
  },
];

function extractDomains(text) {
  const urlPattern =
    /(?:https?:\/\/)?(?:www\.)?([a-zA-Z0-9-]+\.[a-zA-Z]{2,})(?:\/[^\s]*)?/gi;
  const domains = new Set();
  let match;

  while ((match = urlPattern.exec(text)) !== null) {
    domains.add(match[1].toLowerCase());
  }

  return [...domains];
}

function extractTrustedSources(text, domains) {
  const trusted = new Set();

  for (const domain of domains) {
    if (
      KNOWN_TRUSTED_DOMAINS.some(
        (known) => domain === known || domain.endsWith(`.${known}`)
      )
    ) {
      trusted.add(domain);
    }
  }

  for (const { pattern, domain } of TRUSTED_MEDIA_MENTIONS) {
    if (pattern.test(text)) {
      trusted.add(domain);
    }
  }

  for (const { pattern, label } of OFFICIAL_TRUSTED_MENTIONS) {
    if (pattern.test(text)) {
      trusted.add(label);
    }
  }

  if (SCIENTIFIC_REPORTING_PATTERNS.test(text)) {
    if (HEDGED_REPORTING_PATTERNS.test(text)) {
      trusted.add("Scientific study (awaiting confirmation)");
    } else {
      trusted.add("Scientific / research reporting");
    }
  }

  if (isHedgedDisasterReport(text)) {
    trusted.add("Early hazard report (unconfirmed)");
  }

  return [...trusted];
}

function isHedgedScientificReport(text) {
  return (
    SCIENTIFIC_REPORTING_PATTERNS.test(text) &&
    HEDGED_REPORTING_PATTERNS.test(text) &&
    !SCAM_PRIZE_PATTERNS.test(text) &&
    !UNSOLICITED_REWARD_PATTERNS.test(text)
  );
}

function isHedgedDisasterReport(text) {
  return (
    DISASTER_PREDICTION_PATTERNS.test(text) &&
    HEDGED_REPORTING_PATTERNS.test(text) &&
    HEDGED_DISASTER_REPORTING_PATTERNS.test(text) &&
    !CONFIRMED_DISASTER_PATTERNS.test(text) &&
    !SCAM_PRIZE_PATTERNS.test(text)
  );
}

function isHedgedUnverifiedReport(text) {
  return isHedgedScientificReport(text) || isHedgedDisasterReport(text);
}

function extractSuspiciousDomains(domains) {
  return domains.filter((domain) =>
    KNOWN_SUSPICIOUS_PATTERNS.some((pattern) => pattern.test(domain))
  );
}

function extractScamIndicators(text) {
  return SCAM_INDICATOR_PATTERNS.filter(({ pattern }) => pattern.test(text)).map(
    ({ label }) => label
  );
}

function countScamSignals(text) {
  return SCAM_INDICATOR_PATTERNS.filter(({ pattern }) => pattern.test(text)).length;
}

function splitIntoStatements(text) {
  return text
    .split(/(?<=[.!?])\s+|[.!?]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 5);
}

function isNewsClaim(statement) {
  const journalistic =
    /\b(claims?|reported|reports?|according to|alleged|said|announced|confirmed|released|approved|will|must|study|research|officials?|government|official|data shows|statistics?|policy|meeting|warns?|expects?|rose|fell|percent|scientists?|suggests?|possible|confirmation|diabetes|treatment|earthquake|seismic|region|activity|based on|might|soon|reserve bank|interest rate|guidelines|quarterly|financial)\b/i;
  const scamOrSensational =
    /\b(won|lottery|prize|verify|click here|breaking news|bank details?|share now|forward this|urgent|miracle|alien|fake|hoax)\b/i;
  const medicalClaim =
    /\b(cure|miracle)\b/i.test(statement) &&
    /\b(study|scientists?|research|possible|suggests?|no confirmation)\b/i.test(
      statement
    );

  return (
    journalistic.test(statement) ||
    scamOrSensational.test(statement) ||
    medicalClaim
  );
}

function countClaims(text) {
  const statements = splitIntoStatements(text);

  if (statements.length === 0) {
    return isNewsClaim(text.trim()) ? 1 : 0;
  }

  let total = 0;

  for (const statement of statements) {
    const clauses = statement
      .split(/\s+(?:after|and|while|but|although|following|based on|in its)\s+/i)
      .map((c) => c.trim())
      .filter((c) => c.length > 5);

    const parts = clauses.length > 0 ? clauses : [statement];
    total += parts.filter(isNewsClaim).length;
  }

  return total;
}

function extractSuspiciousSources(text, domains, riskScore, result) {
  const suspicious = new Set(extractSuspiciousDomains(domains));

  if (result !== "real" || riskScore >= 38) {
    for (const indicator of extractScamIndicators(text)) {
      suspicious.add(indicator);
    }
  }

  if (isHedgedDisasterReport(text)) {
    suspicious.add(
      "Unverified disaster prediction — verify with official geology / weather agency"
    );
  }

  return [...suspicious];
}

function computeRiskScore(text, domains, trustedSources, suspiciousSources) {

  let score = 12;

  const hasExtraordinaryTopic = EXTRAORDINARY_TOPIC_PATTERNS.test(text);
  const hasUnverifiedEvent = UNVERIFIED_EVENT_PATTERNS.test(text);
  const hasScamPrize = SCAM_PRIZE_PATTERNS.test(text);
  const hasUnsolicitedReward = UNSOLICITED_REWARD_PATTERNS.test(text);
  const hasFinancialBait = FINANCIAL_BAIT_PATTERNS.test(text);
  const hasCredibleReporting = CREDIBLE_REPORTING_PATTERNS.test(text);
  const hasHedgedReporting = HEDGED_REPORTING_PATTERNS.test(text);
  const hasScientificContext = SCIENTIFIC_REPORTING_PATTERNS.test(text);
  const isHedgedScience = isHedgedScientificReport(text);
  const isHedgedDisaster = isHedgedDisasterReport(text);

  if (SENSATIONAL_PATTERNS.test(text)) score += 18;
  if (isHedgedDisaster) score += 28;
  if (EXTRAORDINARY_CLAIM_PATTERNS.test(text)) {
    score += isHedgedScience ? 8 : 22;
  }
  if (hasExtraordinaryTopic) score += 28;
  if (hasExtraordinaryTopic && hasUnverifiedEvent) score += 20;
  if (hasUnverifiedEvent && !hasExtraordinaryTopic) score += 12;
  if (hasScamPrize) score += 32;
  if (hasUnsolicitedReward) score += 28;
  if (hasFinancialBait) score += 22;
  if (hasScamPrize && (hasUnsolicitedReward || hasFinancialBait)) score += 15;

  const scamSignalCount = countScamSignals(text);
  if (scamSignalCount >= 2) score += 12;
  if (scamSignalCount >= 4) score += 10;

  if (FAKE_INDICATOR_PATTERNS.test(text)) score += 25;
  if (/\bfake\b/i.test(text) && !/\b(fake news (?:detection|prevention|awareness))\b/i.test(text)) {
    score += 30;
  }
  if (
    text.length < 40 &&
    (hasExtraordinaryTopic ||
      SENSATIONAL_PATTERNS.test(text) ||
      hasScamPrize ||
      hasUnsolicitedReward)
  ) {
    score += 12;
  } else if (text.length < 80 && (hasScamPrize || hasFinancialBait)) {
    score += 10;
  }

  if (hasCredibleReporting) score -= 22;
  if (hasScientificContext) score -= 10;
  if (isHedgedScience) score -= 20;
  if (isHedgedDisaster) score -= 6;
  if (hasHedgedReporting && hasScientificContext) score -= 8;
  if (trustedSources.length > 0) score -= 18;
  if (suspiciousSources.length > 0) score += 15;
  if (
    domains.length === 0 &&
    !hasCredibleReporting &&
    trustedSources.length === 0 &&
    text.length > 60 &&
    !hasScamPrize &&
    !hasExtraordinaryTopic &&
    !isHedgedScience &&
    !isHedgedDisaster
  ) {
    score += 10;
  }

  return Math.min(98, Math.max(8, score));
}

function scoreToResult(riskScore) {
  if (riskScore >= 65) return "fake";
  if (riskScore >= 38) return "uncertain";
  return "real";
}

function finalizeAnalysis(text, aiResult = null) {
  const domains = extractDomains(text);
  const trustedSources = extractTrustedSources(text, domains);
  const claimsExtracted = countClaims(text);

  const domainSuspicious = extractSuspiciousDomains(domains);
  const heuristicRisk = computeRiskScore(
    text,
    domains,
    trustedSources,
    domainSuspicious
  );

  let result = scoreToResult(heuristicRisk);
  let riskScore = heuristicRisk;

  if (aiResult) {
    const aiLabel = String(aiResult.result || "").toLowerCase();
    const aiRisk = Math.min(100, Math.max(0, Number(aiResult.confidence) || 50));

    if (["fake", "real", "uncertain"].includes(aiLabel)) {
      result = aiLabel;
      riskScore = aiRisk;
    }

    if (result === "fake") {
      riskScore = Math.max(riskScore, heuristicRisk, 65);
    } else if (result === "real") {
      riskScore = Math.min(riskScore, heuristicRisk, 35);
    } else {
      riskScore = Math.round((riskScore + heuristicRisk) / 2);
      riskScore = Math.max(38, Math.min(64, riskScore));
    }
  }

  if (heuristicRisk >= 65) {
    result = "fake";
    riskScore = Math.max(riskScore, heuristicRisk);
  } else if (heuristicRisk <= 32 && result === "fake" && !SCAM_PRIZE_PATTERNS.test(text)) {
    result = scoreToResult(heuristicRisk);
    riskScore = heuristicRisk;
  }

  if (result === "real" && heuristicRisk >= 55) {
    result = "uncertain";
    riskScore = Math.max(38, heuristicRisk);
  }

  if (isHedgedScientificReport(text)) {
    result = "uncertain";
    riskScore = Math.max(42, Math.min(58, riskScore));
  }

  if (isHedgedDisasterReport(text)) {
    result = "uncertain";
    riskScore = Math.max(48, Math.min(62, Math.max(riskScore, 48)));
  }

  const suspiciousSources = extractSuspiciousSources(
    text,
    domains,
    riskScore,
    result
  );

  return {
    result,
    confidence: Math.round(riskScore),
    trustedSources,
    suspiciousSources,
    claimsExtracted,
    statementsAnalyzed: splitIntoStatements(text).length || 1,
  };
}

async function geminiAnalysis(text) {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel(
    { model: "gemini-1.0-pro" },
    { apiVersion: "v1" }
  );

  const prompt = `You are a fake news detection assistant. Classify misinformation risk for the content below.

Rules:
- Mark "fake" for scams (lottery wins, click-here prize claims, urgent bank verification), phishing, hoaxes, or sensational claims with no credible sourcing.
- Mark "real" only for factual reporting with plausible claims and/or credible outlets or official sources cited.
- Mark "uncertain" when verification is unclear.
- Analyze the FULL text — multiple sentences each add risk if they contain manipulation tactics.
- confidence is misinformation risk 0-100 (higher = more likely fake or scam).
- trustedSources: ONLY outlets/domains explicitly mentioned or linked in the content; use [] if none cited.
- suspiciousSources: ONLY suspicious domains mentioned or linked; use [] if none.
- claimsExtracted: number of distinct factual claims (use 0 if none).

Respond with ONLY valid JSON (no markdown) using this exact shape:
{
  "result": "fake" | "real" | "uncertain",
  "confidence": <number 0-100>,
  "trustedSources": [],
  "suspiciousSources": [],
  "claimsExtracted": 0
}

Content to analyze:
"""
${text.slice(0, 4000)}
"""`;

  const response = await model.generateContent(prompt);
  const rawText = response.response.text();
  const jsonMatch = rawText.match(/\{[\s\S]*\}/);

  if (!jsonMatch) {
    throw new Error("Gemini returned non-JSON response");
  }

  const parsed = JSON.parse(jsonMatch[0]);
  const result = String(parsed.result || "uncertain").toLowerCase();
  const validResults = ["fake", "real", "uncertain"];

  return {
    result: validResults.includes(result) ? result : "uncertain",
    confidence: Math.min(
      100,
      Math.max(0, Number(parsed.confidence) || 50)
    ),
    trustedSources: Array.isArray(parsed.trustedSources)
      ? parsed.trustedSources.map(String)
      : [],
    suspiciousSources: Array.isArray(parsed.suspiciousSources)
      ? parsed.suspiciousSources.map(String)
      : [],
    claimsExtracted: Math.max(0, Number(parsed.claimsExtracted) || 0),
  };
}

export async function analyzeContent(text) {
  if (!text || !text.trim()) {
    throw new Error("No content to analyze");
  }

  const trimmed = text.trim();

  if (process.env.GEMINI_API_KEY) {
    try {
      const aiResult = await geminiAnalysis(trimmed);
      return finalizeAnalysis(trimmed, aiResult);
    } catch (error) {
      console.error("Gemini analysis failed, using heuristic fallback:", error.message);
    }
  }

  return finalizeAnalysis(trimmed);
}

export function formatResultLabel(result) {
  const normalized = String(result || "").toLowerCase();
  if (normalized === "fake") return "Fake";
  if (normalized === "real") return "Real";
  return "Uncertain";
}

export function buildExplanations(text, analysis) {
  const explanations = [];

  if (SENSATIONAL_PATTERNS.test(text)) {
    explanations.push("Sensational or viral phrasing detected");
  }

  if (EXTRAORDINARY_CLAIM_PATTERNS.test(text)) {
    explanations.push(
      "Extraordinary claim language found without clear evidence"
    );
  }

  if (EXTRAORDINARY_TOPIC_PATTERNS.test(text)) {
    explanations.push(
      "Extraordinary or scientifically unverified topic detected (e.g. aliens, conspiracies)"
    );
  }

  if (
    UNVERIFIED_EVENT_PATTERNS.test(text) &&
    EXTRAORDINARY_TOPIC_PATTERNS.test(text)
  ) {
    explanations.push(
      "Sensational event claim with no credible sourcing pattern"
    );
  }

  if (isHedgedScientificReport(text)) {
    explanations.push(
      "Early scientific claim with hedged language — not yet confirmed"
    );
  }

  if (isHedgedDisasterReport(text)) {
    explanations.push(
      "Unconfirmed disaster prediction from early signals — verify with official agencies"
    );
  }

  if (SCAM_PRIZE_PATTERNS.test(text) || UNSOLICITED_REWARD_PATTERNS.test(text)) {
    explanations.push(
      "Prize or lottery scam language detected (unsolicited winnings)"
    );
  }

  if (FINANCIAL_BAIT_PATTERNS.test(text)) {
    explanations.push(
      "Specific cash amount used as bait without verification context"
    );
  }

  if (analysis.trustedSources?.length > 0) {
    explanations.push(
      `${analysis.trustedSources.length} trusted outlet(s) referenced in the content`
    );
  } else if (analysis.result === "real") {
    explanations.push("No named trusted outlets cited — verify with primary sources");
  } else {
    explanations.push("No trusted sources cited in the content");
  }

  if (analysis.suspiciousSources?.length > 0) {
    explanations.push(
      `${analysis.suspiciousSources.length} red flag(s) or suspicious pattern(s) identified`
    );
  } else if (analysis.result !== "real") {
    explanations.push("No verifiable publisher or outlet referenced");
  }

  if (analysis.statementsAnalyzed > 1) {
    explanations.push(
      `${analysis.statementsAnalyzed} statements analyzed in this text`
    );
  }

  if (analysis.result === "fake") {
    explanations.push("Strong misinformation signals detected by analysis");
  } else if (analysis.result === "uncertain") {
    explanations.push("Content lacks enough verification signals");
  } else {
    explanations.push("Content appears consistent with credible reporting patterns");
  }

  return explanations.slice(0, 4);
}

export function buildRewriteSuggestion(text, analysis) {
  if (analysis.result === "real") {
    return "This content aligns with credible reporting patterns. Share only after confirming with primary sources.";
  }

  if (analysis.result === "uncertain") {
    return "This claim needs verification. Check official outlets and fact-checkers before sharing.";
  }

  return "This content shows misinformation risk. Verify with trusted outlets such as Reuters, AP, or BBC before sharing.";
}

export function buildDisplayUrl(text, inputType) {
  if (inputType === "url") {
    return text.trim().slice(0, 500);
  }

  const snippet = text.trim().replace(/\s+/g, " ");
  if (snippet.length <= 120) {
    return snippet;
  }

  return `${snippet.slice(0, 117)}...`;
}
