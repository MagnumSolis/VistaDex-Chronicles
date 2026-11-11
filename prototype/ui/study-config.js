// ── study-config.js — Visitor-facing wording and open team decisions (edit here, not in code) ──

// Bump whenever the visitor-facing UI or the telemetry changes (CLAUDE.md), and record it in
// tests/fixtures/event-contract.json. pilot-1 = vanilla UI; pilot-2 = first web/ UI (BITS F364 study);
// public-1 = two-edition revamp (public demo + pitch); public-2 = scores, structured input, Reports,
// landing page; study-1 to study-3 = F364 research instrumentation on the public demo (docs/STUDY-NOTES.md);
// study-4 = seq unique across tabs of one session; study-5 = study flow (both parts reachable and finished);
// study-6 = paired measures (condition start/end, one chatbot run id, confidence before the chatbot answer).
export const STUDY_VERSION = "2026-11-study-6";

// ── Open decisions for the team (not decided in code). Shown to participants as bracketed
// placeholders so an unfinished value can't go unnoticed. Replace before the study starts.
export const RETENTION_PERIOD = "12 months";
export const WITHDRAWAL_CONTACT = "vistadex.team@gmail.com"; // data requests and withdrawal problems

// ── Welcome: product transparency notice (public edition) ──
export const NOTICE = {
  recorded: "Every button press, and how long you spend on each screen, each report section and each walkthrough step.",
  identity: "Under a random session ID. No name, email address or IP address.",
  // TODO(team): confirm. Default: the idea text is NOT stored in usage records.
  ideaText: "The idea text you paste is not stored in these records; we only note how long it is.",
  ideaTextMock: "In this version the screening runs in your browser, so the idea text never leaves it.",
  ideaTextLive: "To make the report, the idea text is sent to our server. The server keeps a technical log of each screening (the claims it pulled out of your text and the sources it checked) so we can find bugs; deleting your session deletes those logs too.",
  reportsLocal: "Your reports, including the idea text, are saved in this browser only so you can find them on the Reports page. They are never uploaded; clear them there at any time.",
  // TODO(team): opt-out policy. Default: a visible "Use without recording" choice on Welcome.
  optOut: "Use without recording",
};

// ── Feedback form (public edition) ──
// TODO(team): final question wording. Set signedOff to true once the team has approved it.
export const FEEDBACK = {
  signedOff: false,
  role: { question: "What best describes you?", options: [["founder", "Founder"], ["investor", "Investor"], ["other", "Other"]] },
  useful: { question: "Was the report useful?", options: [["yes", "Yes"], ["partly", "Partly"], ["no", "No"], ["no_report", "I didn't run one"]] },
  section: { question: "Which section mattered most to you?", options: [["claims", "Claims"], ["graveyard", "Graveyard leads"], ["objections", "Objections"], ["legal", "Legal"], ["market", "Market"], ["none", "None of them"]] },
  wrong: { question: "What was wrong or missing?", hint: "Optional. Please don't include names or confidential information." },
  wouldUse: { question: "Would you use this?", options: [["yes", "Yes"], ["maybe", "Maybe"], ["no", "No"]] },
  email: { question: "Email, if we may follow up (optional)", hint: "Stored with these answers only, never with your usage records." },
};

export const CONSENT = {
  title: "Before you start: taking part in our study",
  paragraphs: [
    "VistaDex is a BITS F364 (Human-AI Interaction) course project. We are studying how people use an AI tool that checks startup ideas. VistaDex does not judge your idea — it shows evidence, and you make the decision.",
    "If you agree, we record: the full text of the idea you type (it is stored with your study data), the report VistaDex produces, your ratings (trust sliders, agree/disagree on each claim, a short survey), and timestamps of what you do on the report page (for example opening a claim's evidence, clicking a source link, viewing the objections, and how long the report is on screen).",
    "We do NOT record your name, email, IP address or device details. You get a random session code instead. Because the idea text itself is stored, please do not include names, contact details or confidential information in it.",
    `Taking part is voluntary. You can stop at any time, and you can withdraw: the "Withdraw & delete my data" button deletes your data from this browser and asks our server to delete it too. You can also download a copy of your data at any time. We keep the data for ${RETENTION_PERIOD} and then delete it. If the withdraw button does not work for you, contact ${WITHDRAWAL_CONTACT} with your session code.`,
    "If you choose not to take part, you can still use VistaDex. Nothing will be recorded.",
  ],
  agree: "I agree — take part",
  decline: "Use without taking part",
};

// Warning shown at the idea input. The second sentence is shown only to consenting participants.
export const INPUT_WARNING = {
  base: "Don't enter names, contact details or confidential information",
  stored: " — this text is saved for the study.",
  notStored: ".",
};

export const TRUST_PRE = {
  prompt: "Before using VistaDex: how much would you trust an AI tool to check the claims in a startup idea?",
  low: "Not at all",
  high: "Completely",
};

export const TRUST_POST = {
  prompt: "After using VistaDex: how much do you trust this tool's report on the idea you screened?",
  low: "Not at all",
  high: "Completely",
};

export const SCALE = { min: 1, max: 7 };

export const CLAIM_RATING = {
  prompt: "Do you agree with this status?",
  options: [
    { value: "agree", label: "Agree" },
    { value: "disagree", label: "Disagree" },
    { value: "unsure", label: "Unsure" },
  ],
};

// 1–7 agreement items (1 = strongly disagree, 7 = strongly agree).
// TODO(team): items are drafts — set signedOff to true once the team has approved them.
export const SURVEY = {
  signedOff: false,
  title: "A few last questions",
  likert: [
    { id: "useful", text: "The report was useful for judging this idea." },
    { id: "understandable", text: "It was easy to understand why each claim got its status." },
    { id: "evidence_clear", text: "I could easily check the evidence behind the claims." },
    { id: "in_control", text: "I felt that I, not the tool, made the final decision." },
    { id: "use_again", text: "I would use a tool like this again." },
  ],
  freeText: { id: "comments", text: "Anything else you want to tell us? (optional — please don't include names or contact details)" },
};
