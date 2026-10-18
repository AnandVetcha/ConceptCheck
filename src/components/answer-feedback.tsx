import type { FormatField, Grade } from "@/lib/types";

export function AnswerFeedback({grade}:{grade:Grade}) {
  return <div id="answer-format-error" className="answer-feedback" role="alert" tabIndex={-1}>
    <h3>Check these fields before continuing</h3>
    <p>{grade.message}</p>
    {grade.issues?.map((item,i)=><div className="field-issue" key={`${item.path}-${i}`}>
      <strong><code>{item.path}</code></strong>
      <p>{item.message}</p>
      <p className="received-value">You entered: <code>{item.received}</code></p>
      <p>{item.expected}</p>
    </div>)}
    <p className="feedback-footnote">Array positions start at 0: [0] is the first entry, [1] the second, and [2] the third.</p>
  </div>;
}
export function AnswerFormatGuide({fields}:{fields:FormatField[]}) {
  if(!fields.length) return null;
  return <details id="answer-format-guide" className="answer-format-guide">
    <summary>Allowed values for each field</summary>
    <p>Choose the assignment using the question. This guide lists the accepted values and types, not the correct answers. [] means each entry in an array.</p>
    <div className="format-guide-scroll"><table><thead><tr><th>Field</th><th>What you can enter</th></tr></thead><tbody>
      {fields.map(field=><tr key={field.path}><td><code>{field.path}</code></td><td>{field.expected}{field.allowedValues && !field.expected.startsWith("Choose one:") && <div className="allowed-values">{field.allowedValues.map(value=><code key={String(value)}>{typeof value==="string"?value:JSON.stringify(value)}</code>)}</div>}</td></tr>)}
    </tbody></table></div>
  </details>;
}
