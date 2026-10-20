// ── controls.ts — Stable ids for every interactive control (data-control="<id>") ──
// Logged as control_pressed { control, screen, value? } or field_edited { control, screen, chars }.
// The same list is recorded in tests/fixtures/event-contract.json ("controls"); a test keeps the two
// equal and another fails if a rendered button, link or field has no registered id.
// Rename an id only together with the contract (it is what the analysis joins on).

export const CONTROLS = [
  // shell
  "skip_to_content", "nav_home", "nav_screen", "nav_how", "nav_contact",
  "tab_home", "tab_screen", "tab_how", "tab_contact",
  "help_replay_walkthrough", "header_feedback", "footer_your_data", "dialog_close",
  // home (landing)
  "home_try_demo", "home_how_it_works", "home_join_study", "home_start_demo", "home_feedback",
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
  // contact
  "contact_feedback", "contact_your_data", "contact_github",
  // how it works
  "how_replay_walkthrough", "how_registry_link", "how_try_it",
  // feedback
  "feedback_role", "feedback_useful", "feedback_section", "feedback_wrong", "feedback_would_use", "feedback_email", "feedback_submit", "feedback_screen_another",
  // reports
  "reports_sort", "reports_filter_status", "reports_filter_band", "reports_filter_industry", "reports_filter_role",
  "reports_clear_filters", "reports_open", "reports_empty_screen", "reports_clear", "reports_clear_cancel", "reports_clear_confirm", "reports_samples",
  // shell: "tab_reports" / "nav_reports"
  "nav_reports", "tab_reports",
  // walkthrough
  "walkthrough_next", "walkthrough_back", "walkthrough_skip", "walkthrough_done", "walkthrough_how_it_works", "walkthrough_resume",
  // study (registration, baseline condition, report study panel)
  "study_track_study", "study_track_field", "study_code_field", "study_role_chip", "study_idea_pick",
  "study_start", "study_continue_field",
  "baseline_conf_pre", "baseline_tool_field", "baseline_conf_post", "baseline_continue",
  "baseline_likert", "baseline_minutes_field", "baseline_open_field", "baseline_submit",
  "study_claim_agree", "study_claim_disagree", "study_objection_agree", "study_objection_disagree",
  "study_conf_post", "study_sources_0", "study_sources_1_2", "study_sources_3p",
  "study_survey_open", "study_survey_submit",
  // not found
  "notfound_home",
] as const;

export type ControlId = (typeof CONTROLS)[number];
const SET = new Set<string>(CONTROLS);
export const isControl = (id: string): id is ControlId => SET.has(id);
