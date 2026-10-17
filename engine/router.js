import { issueTemplate } from './release.js';

/**
 * Only a tiny whitelist of non-technical intents is answered from static templates. EVERYTHING else, including
 * ambiguous messages, goes to the verified technical pipeline. There is no unrestricted-chat path.
 */
const TECH_HINT = /\b(ifrs|ias|standard|recogni[sz]|measure|revenue|lease|goodwill|consolidat|deferred|provision|impair|financial|account|sbr|acca|exam|syllabus|mark|question|ethic|disclos)\b/i;
const GREETING = /^\s*(hi|hello|hey|good (morning|afternoon|evening))[!. ]*$/i;
const PROGRESS = /^\s*(show |view )?(my )?(progress|stats|due (reviews|cards))\s*[?.!]*\s*$/i;
const HELP = /^\s*(help|how do i use (this|the app)|what can you do)\s*[?.!]*\s*$/i;

const TEMPLATES = {
  greeting: 'Hello. Choose a mode and ask a question. Technical answers are shown only when they pass evidence and verification checks; otherwise you will see what could not be verified.',
  progress: 'Open the Progress tab to see your mastery by syllabus area, recurring mistakes and reviews due.',
  help: 'Modes: Teach, First principles, Socratic, Test, Apply, Explain my mistake, Compare, Exam coach, Mark my answer, Challenge, Revision. All technical content is checked against approved sources.',
};

export function route(message) {
  const m = String(message ?? '');
  if (!TECH_HINT.test(m)) {
    for (const [name, re] of [['greeting', GREETING], ['progress', PROGRESS], ['help', HELP]]) {
      if (re.test(m)) return { kind: 'template', payload: issueTemplate({ template: name, text: TEMPLATES[name] }) };
    }
  }
  return { kind: 'technical' };
}
