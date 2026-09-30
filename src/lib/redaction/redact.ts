// Strips obvious sensitive patterns from pasted text before it is ever
// persisted or sent to the model. This is a heuristic first pass, not a
// guarantee -- the intake screen shows the user exactly what was caught so
// they can spot anything it missed before confirming.
//
// Important: redactionLog entries never contain the raw sensitive value,
// only a short snippet of surrounding context with the sensitive span
// itself replaced by its placeholder. Storing the original value in the
// log would defeat the point of redacting it from the text in the first
// place.

export type RedactionType = "ssn" | "ein" | "card" | "bank_account" | "password";

export interface RedactionEntry {
  type: RedactionType;
  placeholder: string;
  /** Surrounding text with the sensitive span replaced -- for the user to
   * verify the redaction was correct, never the raw sensitive value. */
  context: string;
}

export interface RedactionResult {
  redactedText: string;
  redactionLog: RedactionEntry[];
}

const CONTEXT_RADIUS = 24;

function luhnCheck(digits: string): boolean {
  let sum = 0;
  let shouldDouble = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let digit = Number(digits[i]);
    if (shouldDouble) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    shouldDouble = !shouldDouble;
  }
  return sum % 10 === 0;
}

interface Rule {
  type: RedactionType;
  pattern: RegExp;
  placeholder: string;
  /** Return false to skip this particular match (e.g. failed Luhn check). */
  validate?: (fullMatch: string) => boolean;
  /** Which capture group to redact -- defaults to the whole match (0). */
  group?: number;
}

const RULES: Rule[] = [
  {
    type: "ssn",
    pattern: /\b\d{3}-\d{2}-\d{4}\b/g,
    placeholder: "[REDACTED:SSN]",
  },
  {
    type: "ein",
    pattern: /\b\d{2}-\d{7}\b/g,
    placeholder: "[REDACTED:EIN]",
  },
  {
    // Loose digit-run match, gated by a Luhn check so it doesn't fire on
    // every 13-19 digit sequence (phone numbers, tracking numbers, etc).
    type: "card",
    pattern: /\b(?:\d[ -]?){13,19}\b/g,
    placeholder: "[REDACTED:CARD]",
    validate: (fullMatch) => {
      const digits = fullMatch.replace(/[ -]/g, "");
      return digits.length >= 13 && digits.length <= 19 && luhnCheck(digits);
    },
  },
  {
    type: "bank_account",
    pattern: /\b(?:account|acct|routing)\s*(?:number|no\.?|#)?\s*[:#-]?\s*(\d{6,17})\b/gi,
    placeholder: "[REDACTED:ACCOUNT]",
    group: 1,
  },
  {
    type: "password",
    pattern: /\b(?:password|pwd|passwd|pass)\s*[:=]\s*(\S+)/gi,
    placeholder: "[REDACTED:PASSWORD]",
    group: 1,
  },
];

interface RawMatch {
  type: RedactionType;
  placeholder: string;
  /** Offsets of the sensitive span to redact, in the ORIGINAL text. */
  start: number;
  end: number;
}

function findRawMatches(text: string): RawMatch[] {
  const matches: RawMatch[] = [];

  for (const rule of RULES) {
    rule.pattern.lastIndex = 0;
    let execResult: RegExpExecArray | null;

    while ((execResult = rule.pattern.exec(text)) !== null) {
      const fullMatch = execResult[0];

      if (rule.validate && !rule.validate(fullMatch)) {
        continue;
      }

      const targetIndex = rule.group ?? 0;
      const target = targetIndex === 0 ? fullMatch : execResult[targetIndex];
      if (target === undefined) continue;

      const targetOffsetInMatch = fullMatch.indexOf(target);
      const start = execResult.index + targetOffsetInMatch;
      matches.push({ type: rule.type, placeholder: rule.placeholder, start, end: start + target.length });
    }
  }

  matches.sort((a, b) => a.start - b.start);

  // Drop overlaps so the output-building pass below never has to reason
  // about two matches claiming the same span -- keep whichever starts
  // first.
  const nonOverlapping: RawMatch[] = [];
  let lastEnd = -1;
  for (const match of matches) {
    if (match.start >= lastEnd) {
      nonOverlapping.push(match);
      lastEnd = match.end;
    }
  }
  return nonOverlapping;
}

export function redact(text: string): RedactionResult {
  const matches = findRawMatches(text);
  const redactionLog: RedactionEntry[] = [];
  const outputParts: string[] = [];
  let cursor = 0;

  // Single left-to-right pass so every context slice is bounded by either
  // untouched safe text or an adjacent match's boundary -- it can never
  // cross into another match's raw span, unlike building context from the
  // pre-redaction string per-rule (which let one match's "after" context
  // leak a neighboring match's still-unredacted value).
  matches.forEach((match, i) => {
    const nextStart = matches[i + 1]?.start ?? text.length;

    outputParts.push(text.slice(cursor, match.start));

    const before = text
      .slice(Math.max(cursor, match.start - CONTEXT_RADIUS), match.start)
      .replace(/\s+/g, " ")
      .trim();
    const after = text
      .slice(match.end, Math.min(match.end + CONTEXT_RADIUS, nextStart))
      .replace(/\s+/g, " ")
      .trim();

    const context = [before && `…${before}`, match.placeholder, after && `${after}…`]
      .filter(Boolean)
      .join(" ");

    redactionLog.push({ type: match.type, placeholder: match.placeholder, context });

    outputParts.push(match.placeholder);
    cursor = match.end;
  });

  outputParts.push(text.slice(cursor));

  return { redactedText: outputParts.join(""), redactionLog };
}
