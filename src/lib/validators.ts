import type { CaseQuestion, FormatIssue, Grade } from "./types";
import { answerRule, childPath, expectedValue, fieldNames, orderLetters, tokenLabels, type Rule } from "./answer-format";
type Obj = Record<string, unknown>;
const object = (v: unknown): v is Obj => !!v && typeof v === "object" && !Array.isArray(v);
export function equal(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((v, i) => equal(v, b[i]));
  if (object(a) && object(b)) return Object.keys(a).length === Object.keys(b).length && Object.keys(b).every(k => Object.hasOwn(a, k) && equal(a[k], b[k]));
  return a === b;
}
function received(value: unknown): string {
  const display = value === undefined ? "missing" : JSON.stringify(value);
  return display.length > 160 ? display.slice(0, 157) + "…" : display;
}
function issue(path: string, rule: Rule, value: unknown, message: string): FormatIssue {
  return { path: path || "Answer", received: received(value), message, expected: expectedValue(rule), ...(rule.allowedValues ? { allowedValues: rule.allowedValues } : {}) };
}
function check(rule: Rule, value: unknown, path: string, issues: FormatIssue[]) {
  const type = value === null ? "null" : Array.isArray(value) ? "array" : typeof value;
  if (!rule.types.includes(type) || (type === "number" && !Number.isFinite(value))) {
    issues.push(issue(path, rule, value, value === undefined ? "This field is missing." : "This value has the wrong type.")); return;
  }
  if (rule.allowedValues && !rule.allowedValues.some(v => v === value)) issues.push(issue(path, rule, value, "This value is not in the permitted set."));
  if (rule.properties && object(value)) {
    for (const key of Object.keys(value)) if (!Object.hasOwn(rule.properties, key)) issues.push(issue(childPath(path, key), rule, value[key], `Unexpected field. Remove it; permitted fields here are ${Object.keys(rule.properties).join(", ")}.`));
    for (const [key, child] of Object.entries(rule.properties)) check(child, Object.hasOwn(value, key) ? value[key] : undefined, childPath(path, key), issues);
  }
  if (rule.items && Array.isArray(value)) {
    if (value.length !== rule.items.length) issues.push(issue(path, rule, value, `This array has ${value.length} entries; it needs exactly ${rule.items.length}.`));
    rule.items.forEach((child, i) => { if (i < value.length) check(child, value[i], `${path}[${i}]`, issues); });
  }
}
function formatError(issues: FormatIssue[]): Grade {
  return { status: "FORMAT_ERROR", message: `Please fix ${issues.length === 1 ? "this field" : `these ${issues.length} fields or entries`} and submit again. Your answer has not been graded yet.`, issues };
}
export function validate(q: CaseQuestion, answer: string): Grade {
  let value: unknown;
  const issues: FormatIssue[] = [];
  if (q.validator === "field") {
    value = answer.trim();
    if (!fieldNames.includes(value as string)) issues.push({...issue("Answer", { types: ["string"], allowedValues: fieldNames }, value, "Reply with exactly one field name, without JSON or quotation marks."),expected:`Choose one: ${fieldNames.join(", ")}. Enter the name without quotation marks.`});
  } else if (q.validator === "tokens" || q.validator === "order") {
    const tokens = answer.split(",").map(t => t.trim());
    const isOrder = q.validator === "order", length = isOrder ? 5 : 3;
    const permitted = isOrder ? orderLetters : tokenLabels;
    if (tokens.length !== length) issues.push({ path: "Answer", received: `${tokens.length} comma-separated entries`, expected: `Use exactly ${length} comma-separated ${isOrder ? "letters" : "labels"}.`, allowedValues: permitted, message: "The number of entries is incorrect." });
    tokens.forEach((token, i) => {
      const path = `${isOrder ? "Event" : "Token"}[${i}]`;
      if (!permitted.includes(token)) issues.push({...issue(path, { types: ["string"], allowedValues: permitted }, token, "This entry is not one of the permitted labels."),expected:`Choose one: ${permitted.join(", ")}. Enter comma-separated entries without quotation marks.`});
      else if (isOrder && tokens.indexOf(token) !== i) issues.push({...issue(path, { types: ["string"], allowedValues: permitted }, token, "This letter is repeated. Use each of A–E exactly once."),expected:"Use each of A, B, C, D, E once, without quotation marks."});
    });
    value = tokens.join(", ");
  } else {
    try { value = JSON.parse(answer); }
    catch (error) {
      const parserMessage = error instanceof Error ? error.message : "Invalid JSON";
      const position = parserMessage.match(/position\s+(\d+)/i)?.[1];
      const before = position ? answer.slice(0, Number(position)) : null;
      const location = before === null ? "JSON syntax" : `JSON syntax (line ${before.split("\n").length}, column ${before.length - before.lastIndexOf("\n")})`;
      return formatError([{ path: location, received: "JSON could not be parsed", message: "Check double quotes, commas between fields, and matching braces or brackets.", expected: "Use the supplied JSON structure. Open ‘Allowed values for each field’ below for field names and permitted values." }]);
    }
    // Normalize tutor header names, never values. Preserve duplicate errors.
    if (q.validator === "tutor" && object(value) && object(value.Headers)) {
      const headers: Obj = {};
      for (const [key, entry] of Object.entries(value.Headers)) {
        const canonical = key.toLowerCase() === "authorization" ? "Authorization" : key.toLowerCase() === "content-type" ? "Content-Type" : key;
        if (Object.hasOwn(headers, canonical)) issues.push({ path: `Headers.${key}`, received: received(entry), message: "This header is supplied more than once with different capitalization.", expected: "Include Authorization and Content-Type exactly once each." });
        headers[canonical] = entry;
      }
      value = { ...value, Headers: headers };
    }
    check(answerRule(q), value, "", issues);
  }
  if (issues.length) return formatError(issues);
  return equal(value, q.golden_answer) ? { status: "PASS", message: "Correct. Your answer meets every rule for this case." } : { status: "INCORRECT", message: "Your answer has the right format, but it does not meet every rule for this case." };
}
export function demonstratedChange(before: boolean | null, after: boolean | null): -1 | 0 | 1 | null {
  return before === null || after === null ? null : before === after ? 0 : after ? 1 : -1;
}
