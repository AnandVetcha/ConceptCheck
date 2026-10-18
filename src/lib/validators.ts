import type { CaseQuestion, Grade } from "./types";
type Obj = Record<string, unknown>;
const object = (v: unknown): v is Obj => !!v && typeof v === "object" && !Array.isArray(v);
const keys = (v: unknown, names: string[]): v is Obj => object(v) && Object.keys(v).length === names.length && names.every(k => Object.hasOwn(v, k));
const strings = (v: Obj) => Object.values(v).every(x => typeof x === "string");
const allowed = (v: unknown, list: string[]) => typeof v === "string" && list.includes(v);
export function equal(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((v,i) => equal(v,b[i]));
  if (object(a) && object(b)) return keys(a,Object.keys(b)) && Object.keys(b).every(k => equal(a[k],b[k]));
  return a === b;
}
export function validate(q: CaseQuestion, answer: string): Grade {
  let value: unknown;
  let valid = false;
  let hint = "Use the supplied JSON structure, field names, and permitted values.";
  switch (q.validator) {
    case "field":
      value = answer.trim(); valid = allowed(value,["Answer","LLM_key","Request_ID"]);
      hint = "Reply with exactly one field name: Answer, LLM_key, or Request_ID."; break;
    case "tokens": {
      const tokens = answer.split(",").map(t => t.trim());
      valid = tokens.length === 3 && tokens.every(t => allowed(t,["server","client","LLM_provider","user_question","LLM_response"]));
      value = tokens.join(", "); hint = "Use three comma-separated labels: <token1>, <token2>, <token3>."; break;
    }
    case "order": {
      const tokens = answer.split(",").map(t => t.trim());
      valid = tokens.length === 5 && new Set(tokens).size === 5 && tokens.every(t => /^[A-E]$/.test(t));
      value = tokens.join(", "); hint = "Reply with five comma-separated letters, using A–E exactly once."; break;
    }
    default: {
      try { value = JSON.parse(answer); } catch { return {status:"FORMAT_ERROR",message:"Enter valid JSON using the supplied structure. Use double quotes around keys and strings."}; }
      if (!object(q.golden_answer) || !keys(value,Object.keys(q.golden_answer))) break;
      const v = value;
      switch(q.validator) {
        case "placement": valid = Object.values(v).every(x => allowed(x,["Client","Remote_server","LLM_server"])); break;
        case "identity": valid = allowed(v.Compare_owner_with,["Server_verified_identity","Browser_claimed_identity"]) && [v.R1,v.R2,v.R3].every(x => allowed(x,["ALLOW","DENY"])); break;
        case "tutor": {
          hint = "Use the supplied JSON structure and fill every blank with a string.";
          if (!object(v.Headers)) break;
          const headers = Object.fromEntries(Object.entries(v.Headers).map(([k,val]) => [k.toLowerCase(),val]));
          valid = Object.keys(v.Headers).length === 2 && keys(headers,["authorization","content-type"]) && strings(headers) && typeof v.URL === "string" && typeof v.Method === "string" && keys(v.Body,["instruction","question"]) && strings(v.Body);
          if (valid) value = {...v, Headers:{Authorization:headers.authorization,"Content-Type":headers["content-type"]}};
          break;
        }
        case "weather":
          hint = "Use the supplied JSON structure. Use null without quotation marks when no value is required.";
          valid = typeof v.URL === "string" && typeof v.Method === "string" && keys(v.Query,["city"]) && typeof v.Query.city === "string" && [v.Authentication,v.Body].every(x => x === null || typeof x === "string" || object(x)); break;
        case "route": valid = [v.UI,v.Backend,v.Model].every(x => allowed(x,["Browser","Server","Model_provider"])) && Array.isArray(v.Question_route) && v.Question_route.length === 3 && v.Question_route.every(x => allowed(x,["UI","Backend","Model"])) && typeof v.Model_machine_remaining_RAM_GB === "number" && Number.isFinite(v.Model_machine_remaining_RAM_GB); break;
        case "responsibilities": valid = Object.values(v).every(x => allowed(x,["Browser","Backend_secret_storage","Backend_processing","Persistent_database"])); break;
        case "internal": valid = [v.Display_UI_and_collect_path,v.Validate_and_dispatch,v.Read_and_analyse_waveform,v.Keep_file_credentials].every(x => allowed(x,["Laptop_browser","VPN_backend","Internal_worker","Internal_secret_storage"])) && typeof v.Worker_remaining_RAM_GB === "number" && Number.isFinite(v.Worker_remaining_RAM_GB) && typeof v.Public_provider_can_reach_internal_file === "boolean" && typeof v.Policy_allows_raw_waveform_at_public_provider === "boolean"; break;
      }
    }
  }
  if (!valid) return {status:"FORMAT_ERROR",message:hint};
  return equal(value,q.golden_answer) ? {status:"PASS",message:"Correct. Your answer meets every rule for this case."} : {status:"INCORRECT",message:"Your answer has the right format, but it does not meet every rule for this case."};
}
export function demonstratedChange(before: boolean | null, after: boolean | null): -1 | 0 | 1 | null {
  return before === null || after === null ? null : before === after ? 0 : after ? 1 : -1;
}
