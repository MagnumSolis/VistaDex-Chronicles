// ── cohort.js — Demo cohort shown on the dashboard. Hand-written demo data, not study data. ──
// Claim fields follow the POST /screen contract (source_urls, similarity 0–1).
// Statuses, reasoning and source paths were hand-written by the team and have NOT been
// re-checked; the UI labels them as demo data. Submitter names are fictional.

export const COHORT_IDEAS = [
  {
    id: "idea-01",
    name: "LegalAI for Startups",
    desc: "AI contract review with human lawyer backstop, < $200/month",
    submitter: "Arjun Mehta",
    category: "LegalTech",
    claims: [
      { claim: "No AI legal tool exists that combines LLM review with a human lawyer backstop under $200/month", type: "novelty", status: "contradicted", reasoning: "Atrium (shut down 2020, $75M raised) attempted exactly this model and failed on unit economics. Harvey AI and Robin AI currently offer similar positioning at comparable price points.", source_urls: ["techcrunch.com/atrium-shutdown", "harvey.ai/pricing", "robin.ai"] },
      { claim: "The legal-tech market is worth $27B globally", type: "market_size", status: "confirmed", reasoning: "Multiple reports (Grand View Research 2024, Allied Market Research) place the global legal tech market between $25B–$30B with 9% CAGR. The $27B figure is consistent.", source_urls: ["grandviewresearch.com/legal-tech-report", "alliedmarketresearch.com"] },
      { claim: "Big law firms cannot easily replicate this because their cost structure requires billing by hour", type: "defensibility", status: "disputed", reasoning: "Correct that hourly billing is central to law firm economics, but Big Law already has innovation arms and has invested in Clio, NetDocs, and iManage. The barriers are lower than implied.", source_urls: ["law.com/biglaw-innovation-report", "clio.com/funding"] }
    ],
    graveyard: [
      { id: "atrium", similarity: 0.91 },
      { id: "zirtual", similarity: 0.54 }
    ],
    objections: [
      { objection: "Atrium tried this with $75M and a world-class legal team and still couldn't solve unit economics. The claim that a smaller team can do this cheaper has no supporting evidence in the report.", severity: "high" },
      { objection: "Harvey AI and Clio have massive data moats and enterprise contracts. The idea assumes an open market that no longer exists.", severity: "high" },
      { objection: "The $200/month price point is speculative — the report hasn't verified the actual COGS for this model.", severity: "medium" }
    ]
  },
  {
    id: "idea-02",
    name: "ClimateTrack B2B",
    desc: "Scope 3 emissions tracking SaaS for mid-market supply chains",
    submitter: "Priya Sharma",
    category: "ClimaTech",
    claims: [
      { claim: "No affordable Scope 3 emissions tracking exists for mid-market companies (< $1B revenue)", type: "novelty", status: "disputed", reasoning: "Watershed, Persefoni, and Sweep serve this market. However, their pricing is enterprise-tier ($50K+/year). A true mid-market price point gap exists in the $5K–$15K/year band.", source_urls: ["watershed.com/pricing", "persefoni.com", "g2.com/categories/carbon-accounting"] },
      { claim: "SEC mandatory climate disclosure rules create a forcing function for all public companies", type: "market_size", status: "confirmed", reasoning: "SEC finalized climate disclosure rules in March 2024. All large accelerated filers must report Scope 1 & 2 by 2026; Scope 3 rules remain under legal challenge but the trend is clear.", source_urls: ["sec.gov/climate-disclosure-rules", "wsj.com/sec-esg-ruling"] },
      { claim: "Supply chain emissions data is fragmented and cannot be easily sourced from existing databases", type: "defensibility", status: "confirmed", reasoning: "CDP, EcoVadis, and MSCI ESG confirm that Scope 3 Category 1 (purchased goods) remains the hardest to measure; no unified database exists. This is a real, documented data gap.", source_urls: ["cdp.net/scope3-report", "ecoVadis.com/supplier-data"] }
    ],
    graveyard: [],
    objections: [
      { objection: "Watershed has raised $100M+ and is aggressively moving downmarket. The timing window may already be closing.", severity: "medium" },
      { objection: "SEC Scope 3 rules face legal challenges; if overturned, the forcing function disappears.", severity: "medium" },
      { objection: "Customer acquisition in compliance markets requires certified accountants to validate outputs — this cost hasn't been modelled.", severity: "low" }
    ]
  },
  {
    id: "idea-03",
    name: "ShortReel Studio",
    desc: "AI-native short-form video creation tool for solo creators",
    submitter: "Rohan Das",
    category: "Creator Tools",
    claims: [
      { claim: "No AI tool can automatically edit long-form content into platform-optimized short videos", type: "novelty", status: "contradicted", reasoning: "Opus Clip, Vidyo.ai, and Descript all do exactly this. Opus Clip specifically auto-generates viral clips with captions. This claim is demonstrably false.", source_urls: ["opus.pro", "vidyo.ai", "producthunt.com/opus-clip"] },
      { claim: "Short-form video market is growing at 40% annually", type: "market_size", status: "confirmed", reasoning: "Statista and eMarketer both report ~35-45% CAGR for short-form video ad revenue globally. The figure is consistent.", source_urls: ["statista.com/short-video-growth", "emarketer.com"] },
      { claim: "Solo creators cannot afford professional video editing services", type: "defensibility", status: "confirmed", reasoning: "Average professional video editing costs $500–$2000/video. 85% of solo creators have budgets under $500/month total for tools (Influencer Marketing Hub 2024 survey).", source_urls: ["influencermarketinghub.com/creator-survey-2024", "glassdoor.com/video-editor-salary"] }
    ],
    graveyard: [
      { id: "vine", similarity: 0.43 },
      { id: "meerkat", similarity: 0.38 }
    ],
    objections: [
      { objection: "The core novelty claim is factually wrong. Opus Clip has 1M+ users and series A funding. This is a crowded market, not a gap.", severity: "high" },
      { objection: "Platform dependency on TikTok/Instagram means a single algorithm change can eliminate the use case.", severity: "high" },
      { objection: "Creator tool retention is notoriously low — average DAU/MAU ratio is <15% across this category.", severity: "medium" }
    ]
  },
  {
    id: "idea-04",
    name: "MedNote AI",
    desc: "HIPAA-compliant AI scribe for solo-practice physicians",
    submitter: "Ananya Krishnan",
    category: "HealthTech",
    claims: [
      { claim: "Physicians spend 3+ hours daily on documentation — more than on patient care", type: "market_size", status: "confirmed", reasoning: "AMA 2024 Physician Work-Life survey confirms: physicians spend avg 2.6 hours/day on EHR/documentation, nearly matching direct patient care time.", source_urls: ["ama-assn.org/physician-burnout-survey", "nejm.org/documentation-burden"] },
      { claim: "No HIPAA-compliant AI medical scribe exists at under $100/month for solo practice", type: "novelty", status: "contradicted", reasoning: "Nabla Copilot ($119/month), Suki AI (starts ~$60/month), and Heidi Health (free tier) all target this segment explicitly. The claim is false.", source_urls: ["nabla.com/pricing", "suki.ai", "heidihealth.com"] },
      { claim: "EHR integration is a significant technical barrier that prevents competition from large vendors", type: "defensibility", status: "disputed", reasoning: "Epic and Cerner have both launched native AI ambient documentation (DAX Copilot, Dragon Ambient). The barrier argument is weakened by incumbent entry.", source_urls: ["epic.com/dax-integration", "nuance.com/dragon-ambient"] }
    ],
    graveyard: [],
    objections: [
      { objection: "Nuance DAX Copilot is embedded directly in Epic, the dominant EHR. Any standalone tool faces a severe distribution disadvantage.", severity: "high" },
      { objection: "HIPAA certification timelines and BAA negotiations with solo physicians add 6–18 months to sales cycles not reflected in the plan.", severity: "medium" },
      { objection: "Physician adoption of new tools historically requires clinical evidence of outcomes improvement, not just efficiency — this requires expensive trials.", severity: "medium" }
    ]
  },
  {
    id: "idea-05",
    name: "CarbonSwap Exchange",
    desc: "Peer-to-peer voluntary carbon credit marketplace on-chain",
    submitter: "Kiran Bose",
    category: "Web3 / GreenTech",
    claims: [
      { claim: "Blockchain eliminates double-counting in voluntary carbon markets", type: "novelty", status: "disputed", reasoning: "Toucan Protocol, KlimaDAO, and Verra's registry already use on-chain registries. The 2022 'crypto winter' effectively killed KlimaDAO's mechanism. The claim is technically plausible but market history contradicts the narrative.", source_urls: ["toucan.earth", "verra.org/blockchain-pilot", "wsj.com/klimadao-collapse"] },
      { claim: "Voluntary carbon market is worth $2B today and will reach $50B by 2030", type: "market_size", status: "contradicted", reasoning: "Voluntary carbon markets have contracted significantly — BNEF revised 2030 projections down to $10-20B due to Verra credit invalidation scandal and reduced corporate demand.", source_urls: ["bnef.com/carbon-market-2024", "ft.com/verra-scandal"] },
      { claim: "No existing peer-to-peer carbon marketplace exists without intermediary fees", type: "novelty", status: "contradicted", reasoning: "Xpansiv, CBL, and Toucan all offer direct or near-direct trading. Blockchain-based P2P carbon has been attempted multiple times since 2021.", source_urls: ["xpansiv.com", "cbl.global", "toucan.earth/marketplace"] }
    ],
    graveyard: [],
    objections: [
      { objection: "Both core novelty claims are factually false. The market already exists and the prior attempts (KlimaDAO, Toucan) have documented failure modes.", severity: "high" },
      { objection: "The market size projection used ($50B by 2030) has been downgraded by every major analyst since the Verra scandal. The bull case no longer has credible backing.", severity: "high" },
      { objection: "Crypto regulatory risk is not addressed. MiCA in EU and pending US legislation could make on-chain carbon trading legally complex.", severity: "high" }
    ]
  },
  {
    id: "idea-06",
    name: "CollegeCoach AI",
    desc: "AI-powered college application essay coaching for first-gen students",
    submitter: "Sana Mirza",
    category: "EdTech",
    claims: [
      { claim: "First-generation college applicants have significantly lower admission rates at selective institutions", type: "market_size", status: "confirmed", reasoning: "Harvard's Opportunity Insights data confirms first-gen students are underrepresented at top 12 schools at 4-6x lower rates than similarly qualified peers from high-income families.", source_urls: ["opportunityinsights.org/data", "nytimes.com/college-opportunity-gap"] },
      { claim: "Existing college coaching services average $5,000+ per student, inaccessible to low-income families", type: "market_size", status: "confirmed", reasoning: "National average for private college counselors is $3,500–$6,000/year per student (IECA 2024). Top-tier counselors charge $10,000+.", source_urls: ["ieca.net/counselor-pricing", "collegecounseling.org/survey"] },
      { claim: "No AI tool specifically focuses on first-generation student needs — financial aid navigation, essay authenticity, deadline tracking", type: "novelty", status: "disputed", reasoning: "Ivy.ai, AdmitHub, and Mia (Mainstay) serve college access markets. However, none explicitly position around first-gen essay coaching as a primary feature. A positioning gap may exist even if a technical gap doesn't.", source_urls: ["ivy.ai", "mainstay.com", "g2.com/college-counseling-software"] }
    ],
    graveyard: [],
    objections: [
      { objection: "Common App and College Board themselves are investing in free AI coaching tools, which would eliminate the target customer's willingness to pay.", severity: "medium" },
      { objection: "Title IV restrictions may limit AI-generated essay assistance — several universities have already added AI disclosure requirements to applications.", severity: "medium" },
      { objection: "Customer acquisition among first-gen students requires school or NGO partnerships, not direct-to-consumer ads — sales cycle is institutionally complex.", severity: "low" }
    ]
  },
  {
    id: "idea-07",
    name: "DronePath Logistics",
    desc: "Last-mile drone delivery coordination OS for suburban grocery",
    submitter: "Vikram Nair",
    category: "Logistics / Drone",
    claims: [
      { claim: "FAA Part 135 approval for beyond-visual-line-of-sight (BVLOS) drone delivery is now achievable for small operators", type: "defensibility", status: "disputed", reasoning: "Wing, Amazon Prime Air, and Zipline hold BVLOS approvals but the process took 4-6 years for each. No small operator has received full BVLOS approval. This is optimistic.", source_urls: ["faa.gov/bvlos-approvals", "dronelife.com/part135-status"] },
      { claim: "Suburban last-mile delivery cost is 30% higher than urban due to route density", type: "market_size", status: "confirmed", reasoning: "McKinsey Last Mile Logistics 2023 report confirms suburban delivery is 28-35% more expensive per parcel due to lower density. The figure is accurate.", source_urls: ["mckinsey.com/last-mile-2023"] },
      { claim: "No software platform exists to coordinate multiple operators in the same airspace", type: "novelty", status: "contradicted", reasoning: "NASA UTM (Unmanned Traffic Management), AirMap, and Altitude Angel all provide airspace coordination for drone fleets. The problem is being solved by incumbents with government backing.", source_urls: ["utm.arc.nasa.gov", "airmap.com", "altitudeangel.com"] }
    ],
    graveyard: [
      { id: "daqri", similarity: 0.48 }
    ],
    objections: [
      { objection: "The FAA approval claim is materially optimistic. Regulatory timelines for BVLOS are measured in years, not quarters. The business model cannot launch without this.", severity: "high" },
      { objection: "Amazon and Walmart are spending billions on exactly this and control the last-mile grocery relationships. There's no beachhead that avoids them.", severity: "high" },
      { objection: "Battery technology limits current drones to 3–5 kg payloads at <10 mile ranges, restricting the addressable grocery SKU set significantly.", severity: "medium" }
    ]
  },
  {
    id: "idea-08",
    name: "WorkflowGPT Enterprise",
    desc: "No-code AI workflow builder embedded inside Slack and Teams",
    submitter: "Aisha Rahman",
    category: "Enterprise SaaS",
    claims: [
      { claim: "No existing Slack/Teams app allows non-technical users to build multi-step AI workflows", type: "novelty", status: "contradicted", reasoning: "Zapier has a native Slack integration. Microsoft Copilot is embedded in Teams natively. Make.com (formerly Integromat), n8n, and Workato all do this. The claim is false.", source_urls: ["zapier.com/slack", "microsoft.com/copilot-teams", "make.com"] },
      { claim: "Enterprise workflow automation market is $10B by 2026", type: "market_size", status: "confirmed", reasoning: "Gartner and IDC both project the low-code/no-code workflow automation market at $13-15B by 2027. The $10B figure is conservative and plausible.", source_urls: ["gartner.com/workflow-automation", "idc.com/low-code-2026"] },
      { claim: "Existing tools require technical expertise to configure AI steps in workflows", type: "defensibility", status: "disputed", reasoning: "Zapier has significantly improved its no-code AI step builder since 2023. Microsoft Copilot Studio allows non-technical users to build custom Copilot agents. The gap has narrowed substantially.", source_urls: ["zapier.com/ai-steps", "microsoft.com/copilot-studio"] }
    ],
    graveyard: [
      { id: "springpad", similarity: 0.41 }
    ],
    objections: [
      { objection: "Microsoft literally owns Teams and has unlimited runway to add any feature this product offers, for free, to 320M Teams users. The platform risk is existential.", severity: "high" },
      { objection: "Zapier has 2M+ users and $140M ARR. Beating them on distribution inside their own integrated platforms is nearly impossible for a new entrant.", severity: "high" },
      { objection: "The novelty claim was not verified against Copilot Studio which launched in 2023 and does exactly this with no-code agents.", severity: "medium" }
    ]
  }
];

export const SAMPLE_IDEA = `We are building an AI-powered mental health journaling app that uses LLM analysis to detect early signs of depression and anxiety from journal entries, and automatically connects users to licensed therapists when risk thresholds are detected. 

No such tool currently exists that combines passive behavioral analysis with real-time therapist routing at under $30/month. The mental health app market is worth $5.8B globally and growing at 20% annually. Existing apps like Calm and Headspace only provide passive content — none proactively detect clinical-level risk. Our competitive moat is the AI classification model trained on 50,000 anonymized therapy session transcripts.`;
