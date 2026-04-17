// Conservative PG-13 word list. Tune this list, don't add regex logic —
// fuzzy matching is trivially bypassed and users will just mod it out anyway.
// Matches are word-boundary anchored and case-insensitive; substrings inside
// longer words (e.g. "class" should not trip on "ass") do not match.
const BANNED_WORDS: readonly string[] = [
  "fuck",
  "fucker",
  "fucking",
  "shit",
  "bitch",
  "bastard",
  "asshole",
  "dick",
  "cunt",
  "piss",
  "cock",
  "slut",
  "whore",
  "retard",
  "nigger",
  "faggot",
  "tits",
  "twat",
  "wank",
  "pussy",
];

const PATTERN = new RegExp(`\\b(?:${BANNED_WORDS.join("|")})\\b`, "gi");

export function filterProfanity(text: string): string {
  return text.replace(PATTERN, (match) => "*".repeat(match.length));
}

export function getBannedWords(): readonly string[] {
  return BANNED_WORDS;
}
