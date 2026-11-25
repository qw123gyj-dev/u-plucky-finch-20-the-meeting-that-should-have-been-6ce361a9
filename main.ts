/**
 * The Meeting That Should Have Been an Email — deterministic entry picker.
 *
 * Bounty: write one line of at most 200 characters that makes a
 * meeting-that-should-have-been-an-email funny. A comedy judge
 * compares entries two at a time and keeps the line that lands
 * hardest, weighing (most important first):
 *
 *   1. On brief: one line, plainly a joke, unmistakably about a
 *      meeting that should have been an email.
 *   2. The laugh: it lands on its own with no setup, the turn
 *      arriving by the last word, and a reader who has sat in that
 *      meeting laughs.
 *   3. Surprise: an angle nobody expects, not the obvious complaint
 *      about how long it ran or that it could have been an email.
 *   4. Economy: every word earns its place in the single line, with
 *      no throat-clearing, no explaining and no second sentence.
 *   5. Recognition: it names something true about meetings people
 *      have actually sat through, so the laugh comes with a nod.
 * This program scores a hand-written field of candidate one-liners
 * against that brief, in the brief's own order, writes the winner
 * to $MAKEFUN_OUTPUT_DIR/entry.txt (fallback /output/entry.txt),
 * reads it back and verifies it byte-for-byte against every gate:
 * 1–200 characters, a single line, valid UTF-8, not only whitespace.
 *
 * Scoring is lexicographic, mirroring the judge's instruction to go
 * through the criteria in order and let the first difference decide.
 * Ties break criterion by criterion in the brief's order, then by
 * shorter length — length for its own sake does not count.
 * Three sharpening rules sit on top of the flat rubric:
 *
 *   - A line that only names the meeting (the invite, the agenda,
 *     the room) without turning it into a joke — no reversal, no
 *     absurdity, no punchline — is capped on the laugh. Naming the
 *     meeting is the setup, not the joke.
 *   - The obvious complaints are docked hard. The brief names them
 *     outright: how long the meeting ran, and that it could have
 *     been an email. A line whose punch IS one of those complaints
 *     loses laugh points and is capped on surprise, however it is
 *     dressed up. A line that quotes the complaint only to reverse
 *     it — the meeting deciding it should have been a meeting —
 *     is the opposite: a fresh turn on the cliche itself, and it
 *     earns a reversal bonus on surprise.
 *   - The turn must land in the last few words. A punchline buried
 *     in the middle is a line that fizzles; the surprise bonus only
 *     counts when the twist sits inside the final six words.
 *
 * Node 22+, standard library only, no network. Deterministic.
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/* ------------------------------------------------------------------ */
/* Candidates                                                          */
/* ------------------------------------------------------------------ */

/**
 * One hand-written candidate line. `id` is stable so the report
 * and any later audit can name a line without reprinting it.
 */
interface Candidate {
  id: string;
  text: string;
}

const CANDIDATES: Candidate[] = [
  {
    id: "meeting-decides-meeting",
    text: "We held a meeting to decide whether the meeting should have been an email, and after an hour the meeting decided it should have been a meeting.",
  },
  {
    id: "link-in-the-email",
    text: "The meeting started ten minutes late because nobody could find the link, which was in the email the meeting was about.",
  },
  {
    id: "take-this-offline",
    text: "The meeting ended with \u2018let\u2019s take this offline,\u2019 which is corporate for \u2018let\u2019s have this exact meeting again, but smaller.\u2019",
  },
  {
    id: "email-about-the-meeting",
    text: "We spent an hour in a meeting about the email nobody read, and the action item was to send another email about the meeting.",
  },
  {
    id: "quick-sync-setting",
    text: "The invite said \u2018quick sync\u2019 and lasted an hour, which is how I learned that \u2018quick\u2019 is a calendar setting, not a promise.",
  },
  {
    id: "agenda-for-agenda",
    text: "My calendar invited me to a meeting about a meeting, and the agenda was to agree on an agenda for the next meeting.",
  },
  {
    id: "unmute-third-time",
    text: "The meeting had no agenda, no decisions, and one triumph: everyone learned how to unmute themselves, again, for the third time this week.",
  },
  {
    id: "decision-already-made",
    text: "The invite arrived after the decision was made, so we spent an hour ratifying an email that had already been sent.",
  },
  {
    id: "circle-still-going",
    text: "Somebody screenshared a spreadsheet, scrolled straight past the answer, and said \u2018let\u2019s circle back\u2019 \u2014 the circle is still going.",
  },
  {
    id: "invite-apologized",
    text: "The meeting was so unnecessary that even the calendar invite apologized: \u2018sorry, I tried to be an email.\u2019",
  },
  {
    id: "book-club-snacks",
    text: "We booked a room, ordered lunch, and spent an hour reading the email together, out loud, like a book club with worse snacks.",
  },
  {
    id: "forty-five-minutes",
    text: "We spent forty-five minutes deciding who should send the email, and the email we sent said the meeting went well.",
  },
  {
    id: "only-question-followup",
    text: "The final slide said \u2018any questions?\u2019 and the only question was whether this could have been an email \u2014 the answer was a follow-up meeting.",
  },
  {
    id: "calendar-only-worker",
    text: "The meeting\u2019s only decision was to book a follow-up meeting, so the calendar is now the only attendee who actually works here.",
  },
  {
    id: "read-email-aloud",
    text: "Somebody shared their screen, read the email out loud, and asked if anyone had questions \u2014 nobody did, because we had all just read the email.",
  },
  {
    id: "meeting-outlived-project",
    text: "The recurring meeting outlived the project it was about, and now it meets every Tuesday to discuss a product nobody sells anymore.",
  },
  {
    id: "minutes-became-email",
    text: "The minutes were emailed out afterwards, so the meeting did become an email in the end \u2014 just an hour late, and worse.",
  },
];

/* ------------------------------------------------------------------ */
/* Text features                                                       */
/* ------------------------------------------------------------------ */

/** Split a line into words on whitespace, dropping empties. */
function wordsOf(text: string): string[] {
  return text.split(/\s+/).filter((w) => w.length > 0);
}

/** Lower-cased words with surrounding punctuation stripped. */
function cleanWords(text: string): string[] {
  return wordsOf(text).map((w) =>
    w.toLowerCase().replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, ""),
  );
}

/** True when any of the given needles appears in the haystack. */
function containsAny(haystack: string, needles: string[]): boolean {
  const lower = haystack.toLowerCase();
  return needles.some((n) => lower.includes(n));
}

/** The last `n` words of the line, joined back into a string. */
function tailWords(text: string, n: number): string {
  return wordsOf(text).slice(-n).join(" ").toLowerCase();
}

/**
 * Meeting-specific features the brief's world is built from: the
 * invite, the agenda, the calendar, the screen share, the unmute
 * dance, the action item, the follow-up, the recurring slot.
 */
const MEETING_FEATURES = [
  "meeting",
  "email",
  "calendar invite",
  "invite",
  "agenda",
  "calendar",
  "screenshare",
  "screenshared",
  "shared their screen",
  "unmute",
  "action item",
  "follow-up meeting",
  "follow-up",
  "recurring meeting",
  "quick sync",
  "circle back",
  "take this offline",
  "booked a room",
  "spreadsheet",
  "final slide",
  "any questions",
  "decision",
];

/** Distinct meeting-specific features present in the line. */
function meetingFeatures(text: string): string[] {
  const lower = text.toLowerCase();
  // "meeting" alone does not count twice when a longer phrase
  // containing it also matches: keep the longer phrase and drop
  // the bare word.
  const found = MEETING_FEATURES.filter((f) => lower.includes(f));
  const dropped = new Set<string>();
  for (const f of found) {
    for (const g of found) {
      if (f !== g && g.includes(f)) dropped.add(f);
    }
  }
  return found.filter((f) => !dropped.has(f));
}

/**
 * Words that turn the meeting into a joke — a reversal, an
 * absurdity, a failure pinned on the meeting itself. A joke needs
 * a turn; a line that only describes the meeting neutrally is a
 * calendar entry, not a one-liner.
 */

const JOKE_MARKERS = [
  "decided it should have been a meeting",
  "apologized",
  "still going",
  "but smaller",
  "book club",
  "worse snacks",
  "calendar setting",
  "not a promise",
  "actually works here",
  "went well",
  "already been sent",
  "third time",
  "tried to be an email",
  "follow-up meeting",
  "nobody did",
  "nobody sells anymore",
  "outlived",
  "ratifying",
  "scrolled straight past",
  "read the email out loud",
  "became an email",
  "and worse",
];

/** How many joke markers the line carries. */
function jokeMarkerCount(text: string): number {
  const lower = text.toLowerCase();
  return JOKE_MARKERS.filter((m) => lower.includes(m)).length;
}

/**
 * The two obvious complaints the brief warns against by name: how
 * long the meeting ran, and that it could have been an email. A
 * line whose punch IS one of those is predictable by definition —
 * most writers reach for these first, and the judge has heard them
 * ten thousand times.
 */
const OBVIOUS_PUNCHES = [
  "could have been an email",
  "should have been an email",
  "waste of time",
  "waste of an hour",
  "lasted two hours",
  "ran over by an hour",
  "dragged on",
];

/**
 * True when the line leans on an obvious complaint as its punch.
 * Quoting the complaint only to reverse it does not count: the
 * meeting deciding it should have been a meeting turns the cliche
 * into the joke instead of ending on it.
 */
function usesObviousPunch(text: string): boolean {
  const lower = text.toLowerCase();
  if (lower.includes("decided it should have been a meeting")) {
    return false;
  }
  if (lower.includes("the answer was a follow-up meeting")) {
    return false;
  }
  return containsAny(text, OBVIOUS_PUNCHES);
}

/**
 * Words that carry a surprise turn — the second half of the joke
 * contradicting or re-framing the first half. A turn only counts
 * when it lands late: the punch must sit inside the final six
 * words, otherwise the line peaks early and then keeps talking.
 */
const TWIST_WORDS = [
  "should have been a meeting",
  "meeting was about",
  "but smaller",
  "about the meeting",
  "not a promise",
  "next meeting",
  "third time this week",
  "already been sent",
  "still going",
  "be an email",
  "worse snacks",
  "went well",
  "follow-up meeting",
  "actually works here",
  "just read the email",
  "nobody sells anymore",
  "and worse",
];

/** True when a twist word appears inside the last six words. */
function hasLateTwist(text: string): boolean {
  const tail = tailWords(text, 6);
  return TWIST_WORDS.some((t) => tail.includes(t));
}

/** True when a twist word appears anywhere in the line at all. */
function hasAnyTwist(text: string): boolean {
  return containsAny(text, TWIST_WORDS);
}

/**
 * A second comic beat on top of the twist: an absurd escalation,
 * a personification pushed one step too far, a self-referential
 * loop closing on itself. One beat is a joke; two beats is a line
 * that lands twice on the first read.
 */

const COMIC_BEATS = [
  "decided it should have been a meeting",
  "apologized",
  "tried to be an email",
  "but smaller",
  "book club",
  "worse snacks",
  "calendar setting",
  "not a promise",
  "actually works here",
  "went well",
  "already been sent",
  "third time",
  "still going",
  "nobody sells anymore",
  "outlived",
  "ratifying",
  "scrolled straight past",
  "nobody did",
  "just read the email",
  "agenda for the next meeting",
  "and worse",
  "became an email",
];

/** How many second-beat markers the line carries. */
function comicBeatCount(text: string): number {
  const lower = text.toLowerCase();
  return COMIC_BEATS.filter((m) => lower.includes(m)).length;
}

/**
 * A line that only names the meeting without turning it into a
 * joke: it points at the invite / the agenda / the room and stops
 * there, offering no reversal, no absurdity, no punchline.
 */
function onlyNamesMeeting(text: string): boolean {
  const hasFeature = meetingFeatures(text).length > 0;
  const hasTurn =
    jokeMarkerCount(text) > 0 ||
    hasAnyTwist(text) ||
    /\b(but|so|which is|like a|then|and now)\b/i.test(text);
  return hasFeature && !hasTurn;
}

/* ------------------------------------------------------------------ */
/* Criterion scores (0–10 each, brief order)                           */
/* ------------------------------------------------------------------ */

interface Scores {
  /** C1: the line is a joke about a meeting that should have been an email. */
  onBrief: number;
  /** C2: the laugh — it lands on its own, turn by the last word. */
  laugh: number;
  /** C3: surprise — a fresh angle, not the obvious complaint. */
  surprise: number;
  /** C4: economy — every word earns its place. */
  economy: number;
  /** C5: recognition — names something true about real meetings. */
  recognition: number;
}

/**
 * C1 — On brief. The meeting named (5), the email named or clearly
 * implied (3), and a joke marker aiming the turn at the meeting
 * itself (2). A line missing the subject or the sting can never win
 * on later criteria.
 */
function scoreOnBrief(c: Candidate): number {
  let score = 0;
  if (containsAny(c.text, ["meeting"])) score += 5;
  if (containsAny(c.text, ["email"])) score += 3;
  if (jokeMarkerCount(c.text) >= 1) score += 2;
  return Math.min(10, score);
}

/**
 * C2 — Laugh. Full marks need a late twist plus a second comic
 * beat. A twist that lands early, or a line that only names the
 * meeting without turning it into a joke, is capped at 4. A line
 * leaning on one of the brief's obvious complaints loses 3.
 */
function scoreLaugh(c: Candidate): number {
  let score = 2; // every on-brief line gets a base for trying
  if (hasLateTwist(c.text)) score += 4;
  else if (hasAnyTwist(c.text)) score += 1; // twist exists, lands early
  if (comicBeatCount(c.text) >= 1) score += 2;
  if (jokeMarkerCount(c.text) >= 2) score += 2;
  if (usesObviousPunch(c.text)) score -= 3;
  if (onlyNamesMeeting(c.text)) score = Math.min(score, 4);
  return Math.max(0, Math.min(10, score));
}

/**
 * C3 — Surprise. Two points per distinct fresh angle, up to the
 * cap, plus 2 for a self-referential reversal — the line quoting
 * the obvious complaint only to turn it back on itself (the
 * meeting voting for meetings, the invite apologising for not
 * being an email, the meeting finally becoming an email, late
 * and worse). The obvious complaints cost 4 here as well as on
 * the laugh: a line built on them has no fresh angle at all.
 */
const FRESH_ANGLES = [
  "decided it should have been a meeting",
  "tried to be an email",
  "apologized",
  "but smaller",
  "book club",
  "worse snacks",
  "calendar setting",
  "not a promise",
  "actually works here",
  "went well",
  "already been sent",
  "third time",
  "still going",
  "nobody sells anymore",
  "outlived",
  "ratifying",
  "scrolled straight past",
  "nobody did",
  "just read the email",
  "agenda for the next meeting",
  "link, which was in the email",
  "became an email",
  "and worse",
];

/** The self-referential reversal phrases that earn the +2 bonus. */
const REVERSAL_PHRASES = [
  "decided it should have been a meeting",
  "tried to be an email",
  "did become an email",
  "the answer was a follow-up meeting",
];

function scoreSurprise(c: Candidate): number {
  const lower = c.text.toLowerCase();
  const angles = FRESH_ANGLES.filter((a) => lower.includes(a)).length;
  let score = Math.min(10, 2 + angles * 2);
  if (angles === 0) score = 2;
  if (REVERSAL_PHRASES.some((r) => lower.includes(r))) score += 2;
  if (usesObviousPunch(c.text)) score = Math.max(0, score - 4);
  return Math.min(10, score);
}

/**
 * C4 — Economy. Full marks under 130 characters, sliding down to
 * 6 at the 200 cap — length for its own sake does not count, and
 * a line that needs two breaths loses the room.
 */
function scoreEconomy(c: Candidate): number {
  const len = [...c.text].length;
  if (len <= 130) return 10;
  if (len <= 150) return 9;
  if (len <= 170) return 8;
  if (len <= 200) return 6;
  return 0;
}

/**
 * C5 — Recognition. Two points per distinct meeting-specific
 * feature, up to the cap, base 2 for naming the meeting at all.
 * The features are the nod: the unmute dance, the circle-back,
 * the take-this-offline, the follow-up meeting, the screen share
 * reading the email aloud.
 */
function scoreRecognition(c: Candidate): number {
  const features = meetingFeatures(c.text);
  let score = Math.min(10, 2 + features.length * 2);
  if (features.length === 0) score = 2;
  if (features.length === 1 && features[0] === "meeting") score = 4;
  return score;
}

/** Score a candidate on all five criteria, in the brief's order. */
function scoreCandidate(c: Candidate): Scores {
  return {
    onBrief: scoreOnBrief(c),
    laugh: scoreLaugh(c),
    surprise: scoreSurprise(c),
    economy: scoreEconomy(c),
    recognition: scoreRecognition(c),
  };
}

/* ------------------------------------------------------------------ */
/* Winner selection                                                    */
/* ------------------------------------------------------------------ */

/**
 * Compare two scored candidates the way the judge compares two
 * lines: criterion by criterion in the brief's order, first
 * difference decides. Only when all five criteria tie does the
 * shorter line win — it reads tighter, and the brief says length
 * for its own sake does not count.
 */
function compareScored(
  a: { candidate: Candidate; scores: Scores },
  b: { candidate: Candidate; scores: Scores },
): number {
  const order: (keyof Scores)[] = [
    "onBrief",
    "laugh",
    "surprise",
    "economy",
    "recognition",
  ];
  for (const key of order) {
    if (a.scores[key] !== b.scores[key]) return b.scores[key] - a.scores[key];
  }
  const lenA = [...a.candidate.text].length;
  const lenB = [...b.candidate.text].length;
  if (lenA !== lenB) return lenA - lenB;
  return a.candidate.id.localeCompare(b.candidate.id);
}

/** Score every candidate, sort best first, and return the ranking. */
function rankCandidates(): { candidate: Candidate; scores: Scores }[] {
  const scored = CANDIDATES.map((candidate) => ({
    candidate,
    scores: scoreCandidate(candidate),
  }));
  scored.sort(compareScored);
  return scored;
}

/* ------------------------------------------------------------------ */
/* Gate verification                                                   */
/* ------------------------------------------------------------------ */

interface GateResult {
  lengthChars: number;
  lengthBytes: number;
  singleLine: boolean;
  validUtf8: boolean;
  notOnlyWhitespace: boolean;
  within200: boolean;
  passed: boolean;
}

/**
 * Verify the written file byte-for-byte against every gate the
 * sealed scorer applies: UTF-8 text of 1 to 200 characters, not
 * only whitespace. A single line means no newline characters
 * inside the entry (a trailing newline written by the file writer
 * is stripped before the check).
 */
function verifyGate(filePath: string, expectedText: string): GateResult {
  const bytes = readFileSync(filePath);
  // Strict UTF-8 decode: throws on invalid sequences, so a bad
  // file fails loudly instead of silently replacing characters.
  const decoded = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  const text = decoded.replace(/\n$/, "");
  const lengthChars = [...text].length;
  const result: GateResult = {
    lengthChars,
    lengthBytes: bytes.length,
    singleLine: !text.includes("\n") && !text.includes("\r"),
    validUtf8: true,
    notOnlyWhitespace: text.trim().length > 0,
    within200: lengthChars >= 1 && lengthChars <= 200,
    passed: false,
  };
  result.passed =
    result.singleLine &&
    result.validUtf8 &&
    result.notOnlyWhitespace &&
    result.within200 &&
    text === expectedText;
  return result;
}

/* ------------------------------------------------------------------ */
/* Main                                                                */
/* ------------------------------------------------------------------ */

function main(): void {
  const ranked = rankCandidates();

  console.log("Candidate ranking (criteria in the judge's order):");
  console.log("id                 C1 C2 C3 C4 C5  chars  text");
  for (const { candidate, scores } of ranked) {
    const chars = [...candidate.text].length;
    console.log(
      `${candidate.id.padEnd(18)} ${scores.onBrief}  ${scores.laugh}  ` +
        `${scores.surprise}  ${scores.economy}  ${scores.recognition}  ` +
        `${String(chars).padStart(5)}  ${candidate.text}`,
    );
  }

  const winner = ranked[0];
  console.log("");
  console.log(`Winner: ${winner.candidate.id}`);
  console.log(`Line: ${winner.candidate.text}`);
  console.log(
    `Scores: onBrief=${winner.scores.onBrief} laugh=${winner.scores.laugh} ` +
      `surprise=${winner.scores.surprise} economy=${winner.scores.economy} ` +
      `recognition=${winner.scores.recognition}`,
  );

  // Output dir is $MAKEFUN_OUTPUT_DIR, fallback /output/entry.txt.
  const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, "entry.txt");
  writeFileSync(outPath, winner.candidate.text + "\n", "utf8");
  console.log(`Wrote ${outPath}`);

  // Read it back and verify byte-for-byte against every gate.
  const gate = verifyGate(outPath, winner.candidate.text);
  console.log(
    `Gate: chars=${gate.lengthChars} bytes=${gate.lengthBytes} ` +
      `singleLine=${gate.singleLine} validUtf8=${gate.validUtf8} ` +
      `notOnlyWhitespace=${gate.notOnlyWhitespace} within200=${gate.within200} ` +
      `passed=${gate.passed}`,
  );
  if (!gate.passed) {
    console.error("GATE FAILED: entry.txt does not satisfy every gate.");
    process.exit(1);
  }
  console.log("Gate passed: entry is valid.");
}

main();
