// ── controls.ts — Stable ids for every interactive control (data-control="<id>") ──
// Logged as control_pressed { control, screen, value? } or field_edited { control, screen, chars }.
// The same list is recorded in tests/fixtures/event-contract.json ("controls"); a test keeps the two
// equal and another fails if a rendered button, link or field has no registered id.
// Rename an id only together with the contract (it is what the analysis joins on).

export const CONTROLS = [
  // shell
  "skip_to_content", "nav_home", "nav_dashboard", "nav_screen", "nav_graveyard", "nav_how",
  "tab_dashboard", "tab_screen", "tab_graveyard", "tab_how",
  "help_replay_walkthrough", "header_feedback", "footer_your_data",
  // welcome
  "welcome_start_walkthrough", "welcome_skip", "welcome_no_recording", "welcome_continue", "welcome_start_recording",
  "welcome_delete_session", "welcome_delete_confirm", "welcome_delete_cancel", "welcome_how_it_works",
  // screen an idea
  "idea_title", "idea_pitch", "idea_problem", "idea_solution", "idea_moat", "form_error_link",
  "sample_load", "industry_toggle", "role_select", "market_toggle", "run_screening", "open_last_report",
  // running
  "run_cancel", "running_back_to_edit", "running_go_screen",
  // report
  "report_section_jump", "idea_text_toggle", "score_breakdown_toggle", "competitor_link", "big_tech_source_link", "sources_toggle", "source_link",
  "lead_source_link", "legal_registry_link", "legal_rule_source_link", "market_citation_link",
  "report_save_pdf", "report_screen_another", "report_feedback_prompt", "report_how_it_works", "report_empty_screen",
  // graveyard
  "graveyard_search", "graveyard_filter", "graveyard_entry_open", "graveyard_sheet_close", "graveyard_source_link", "graveyard_clear",
  // how it works
  "how_replay_walkthrough", "how_registry_link", "how_try_it",
  // feedback
  "feedback_role", "feedback_useful", "feedback_section", "feedback_wrong", "feedback_would_use", "feedback_email", "feedback_submit", "feedback_screen_another",
  // dashboard (pitch edition only: never logged, registered so the coverage test covers it)
  "dashboard_search", "dashboard_filter_status", "dashboard_filter_category", "dashboard_open_report", "dashboard_clear",
  // walkthrough
  "walkthrough_next", "walkthrough_back", "walkthrough_skip", "walkthrough_done", "walkthrough_how_it_works", "walkthrough_resume",
  // not found
  "notfound_home",
] as const;

export type ControlId = (typeof CONTROLS)[number];
const SET = new Set<string>(CONTROLS);
export const isControl = (id: string): id is ControlId => SET.has(id);
