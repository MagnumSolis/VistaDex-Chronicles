// ── study-config.js — Wording for the BITS F364 study (edit here, not in code) ──

// Bump whenever the participant-facing UI changes (CLAUDE.md). pilot-1 = vanilla UI; pilot-2 = redesigned web/ UI.
export const STUDY_VERSION = "2026-10-pilot-2";

export const CONSENT = {
  title: "Before you start: taking part in our study",
  paragraphs: [
    "VistaDex is a BITS F364 (Human-AI Interaction) course project. We are studying how people use an AI tool that checks startup ideas. VistaDex does not judge your idea — it shows evidence, and you make the decision.",
    "If you agree, we record: the full text of the idea you type (it is stored with your study data), the report VistaDex produces, your ratings (trust sliders, agree/disagree on each claim, a short survey), and timestamps of what you do on the report page (for example opening a claim's evidence, clicking a source link, viewing the objections, and how long the report is on screen).",
    "We do NOT record your name, email, IP address or device details. You get a random session code instead. Because the idea text itself is stored, please do not include names, contact details or confidential information in it.",
    "Taking part is voluntary. You can stop at any time, and you can withdraw: the \"Withdraw & delete my data\" button deletes your data from this browser and asks our server to delete it too. You can also download a copy of your data at any time.",
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

// 1–7 agreement items (1 = strongly disagree, 7 = strongly agree). Draft — team to confirm.
export const SURVEY = {
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
