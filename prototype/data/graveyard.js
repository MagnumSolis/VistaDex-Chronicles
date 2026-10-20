// ── graveyard.js — Graveyard seed set (mirrors the planned MongoDB schema) ──
// Provenance: entries and source URLs come from the original prototype (commit a8b2510,
// 2026-09-16). None has been checked against its source yet.
// source_verified: set to true only after a person has opened the source and confirmed it
// documents the closure. TODO(team): an inclusion rule (what counts as a failure) is pending.

export const GRAVEYARD_DB = [
  {
    id: "atrium",
    company_name: "Atrium",
    what_they_tried: "AI-powered legal services platform for startups, automating contract review and legal advice with human lawyer oversight",
    cause_of_death: "Unit economics — cost of human lawyer oversight made scaling impossible",
    cause_category: "unit-economics",
    year_closed: 2020,
    raised: "$75M",
    sources: ["https://techcrunch.com/2020/03/03/atrium-is-shutting-down/", "https://failory.com/cemetery/atrium"],
    source_verified: false
  },
  {
    id: "sprig",
    company_name: "Sprig",
    what_they_tried: "On-demand healthy meal delivery, restaurant-quality food cooked fresh and delivered within 20 minutes in San Francisco",
    cause_of_death: "Unit economics — cost of food prep, chefs, and last-mile delivery made profitability impossible at scale",
    cause_category: "unit-economics",
    year_closed: 2017,
    raised: "$56.7M",
    sources: ["https://techcrunch.com/2017/05/27/sprig-shutting-down/", "https://failory.com/cemetery/sprig"],
    source_verified: false
  },
  {
    id: "homejoy",
    company_name: "Homejoy",
    what_they_tried: "On-demand home cleaning marketplace connecting customers with independent cleaners, Uber-for-cleaning model",
    cause_of_death: "Regulation — worker misclassification lawsuits; cleaners demanded employee status",
    cause_category: "regulation",
    year_closed: 2015,
    raised: "$38M",
    sources: ["https://techcrunch.com/2015/07/31/homejoy-shuts-down/"],
    source_verified: false
  },
  {
    id: "quibi",
    company_name: "Quibi",
    what_they_tried: "Short-form mobile video streaming platform with premium Hollywood productions designed for 5–10 minute watch sessions",
    cause_of_death: "Bad timing & product-market fit — launched during COVID lockdowns when people weren't commuting; content consumed on TV not phones",
    cause_category: "timing",
    year_closed: 2020,
    raised: "$1.75B",
    sources: ["https://variety.com/2020/digital/news/quibi-shutting-down-1234809229/"],
    source_verified: false
  },
  {
    id: "juicero",
    company_name: "Juicero",
    what_they_tried: "WiFi-connected juicer for single-serve proprietary juice packs — the Nespresso of juice, requiring only their $400 machine + $8 packs",
    cause_of_death: "Competition — Bloomberg revealed packs could be squeezed by hand, eliminating the machine's value proposition overnight",
    cause_category: "competition",
    year_closed: 2017,
    raised: "$120M",
    sources: ["https://www.bloomberg.com/news/features/2017-04-19/silicon-valley-s-400-juicer-may-be-a-solution-to-problem-that-doesn-t-exist"],
    source_verified: false
  },
  {
    id: "theranos",
    company_name: "Theranos",
    what_they_tried: "Finger-prick blood testing platform claiming to run hundreds of lab tests from a single drop of blood, disrupting diagnostics",
    cause_of_death: "Fraud — technology didn't work as claimed; SEC and DOJ charges against founder",
    cause_category: "regulation",
    year_closed: 2018,
    raised: "$945M",
    sources: ["https://www.wsj.com/articles/theranos-has-struggled-with-blood-tests-1444881901"],
    source_verified: false
  },
  {
    id: "vine",
    company_name: "Vine",
    what_they_tried: "Short-form looping video social platform — 6-second videos, creator-first, pioneered the short-video format",
    cause_of_death: "Competition — Twitter ownership starved it of resources as Instagram Stories and Snapchat grew; creators migrated",
    cause_category: "competition",
    year_closed: 2017,
    raised: "Acquired by Twitter for ~$30M",
    sources: ["https://techcrunch.com/2016/10/27/vine-is-shutting-down/"],
    source_verified: false
  },
  {
    id: "yik-yak",
    company_name: "Yik Yak",
    what_they_tried: "Anonymous hyperlocal social network for college campuses — see posts from people within 5 miles, no accounts required",
    cause_of_death: "Regulation & competition — cyberbullying pressure from regulators; user base collapsed after adding usernames killed anonymity",
    cause_category: "regulation",
    year_closed: 2017,
    raised: "$73.5M",
    sources: ["https://techcrunch.com/2017/04/28/yik-yak-shuts-down/"],
    source_verified: false
  },
  {
    id: "rdio",
    company_name: "Rdio",
    what_they_tried: "Music streaming subscription service with clean design and social features — pre-Spotify US market entry",
    cause_of_death: "Competition — Spotify's superior catalogue deals and free tier made paid-only model unviable",
    cause_category: "competition",
    year_closed: 2015,
    raised: "$125.5M",
    sources: ["https://techcrunch.com/2015/11/23/rdio-shuts-down/"],
    source_verified: false
  },
  {
    id: "meerkat",
    company_name: "Meerkat",
    what_they_tried: "Live-streaming app tied to Twitter — broadcast live video to your Twitter followers in real time",
    cause_of_death: "Competition — Twitter acquired Periscope and cut off Meerkat's Twitter social graph access",
    cause_category: "competition",
    year_closed: 2016,
    raised: "$14.3M",
    sources: ["https://techcrunch.com/2016/09/30/meerkat-is-officially-dead/"],
    source_verified: false
  },
  {
    id: "zirtual",
    company_name: "Zirtual",
    what_they_tried: "US-based virtual assistant service staffing real human assistants for busy professionals and small businesses",
    cause_of_death: "Unit economics — cash burn from W2 employee model; overnight shutdown without warning to employees",
    cause_category: "unit-economics",
    year_closed: 2015,
    raised: "$5.5M",
    sources: ["https://techcrunch.com/2015/08/10/zirtual-shuts-down-overnight/"],
    source_verified: false
  },
  {
    id: "washio",
    company_name: "Washio",
    what_they_tried: "On-demand laundry and dry-cleaning pickup/delivery app — schedule a pickup and get clothes back the same day",
    cause_of_death: "Unit economics — last-mile logistics costs plus contractor wages made every order unprofitable",
    cause_category: "unit-economics",
    year_closed: 2016,
    raised: "$16.7M",
    sources: ["https://techcrunch.com/2016/08/30/washio-is-shutting-down/"],
    source_verified: false
  },
  {
    id: "springpad",
    company_name: "Springpad",
    what_they_tried: "Visual bookmarking and knowledge management app — save anything from the web, auto-enriched with metadata",
    cause_of_death: "Competition — Evernote and Pinterest dominated; failed to reach sustainable scale before runway ended",
    cause_category: "competition",
    year_closed: 2014,
    raised: "$8.5M",
    sources: ["https://techcrunch.com/2014/06/04/springpad-shuts-down/"],
    source_verified: false
  },
  {
    id: "google-plus",
    company_name: "Google+",
    what_they_tried: "Google's social networking platform competing with Facebook — circles, hangouts, photo sharing with 1B+ potential users",
    cause_of_death: "Competition — Facebook's network effects proved insurmountable; forced signups created hostile user base",
    cause_category: "competition",
    year_closed: 2019,
    raised: "Internal Google project",
    sources: ["https://techcrunch.com/2018/10/08/google-plus-is-dying/"],
    source_verified: false
  },
  {
    id: "daqri",
    company_name: "DAQRI",
    what_they_tried: "Enterprise augmented reality smart helmet for industrial workers — AR overlays for manufacturing, oil, construction",
    cause_of_death: "Timing — industrial AR market didn't mature fast enough; hardware costs remained too high for mass enterprise adoption",
    cause_category: "timing",
    year_closed: 2019,
    raised: "$275M",
    sources: ["https://techcrunch.com/2019/09/27/daqri-a-once-high-flying-ar-startup-is-shutting-down/"],
    source_verified: false
  },
  {
    id: "jawbone",
    company_name: "Jawbone",
    what_they_tried: "Wearable fitness trackers and Bluetooth speakers — early market leader in wristband health tracking before Apple Watch",
    cause_of_death: "Competition — Apple Watch and Fitbit destroyed the market; hardware margins couldn't sustain the business",
    cause_category: "competition",
    year_closed: 2017,
    raised: "$930M",
    sources: ["https://techcrunch.com/2017/07/06/jawbone-is-dead/"],
    source_verified: false
  },
  {
    id: "circa",
    company_name: "Circa",
    what_they_tried: "Mobile-first news summarization app delivering structured, bite-sized news atoms — the anti-longform news reader",
    cause_of_death: "Bad timing — Facebook Instant Articles and Apple News killed the independent news-aggregator model",
    cause_category: "timing",
    year_closed: 2015,
    raised: "$5M",
    sources: ["https://techcrunch.com/2015/06/01/circa-closes-down/"],
    source_verified: false
  },
  {
    id: "shyp",
    company_name: "Shyp",
    what_they_tried: "On-demand package pickup and shipping service — photograph your item, someone picks it up and ships it for you",
    cause_of_death: "Unit economics — labor cost of couriers plus carrier fees; expanded too fast to unprofitable cities",
    cause_category: "unit-economics",
    year_closed: 2018,
    raised: "$62.1M",
    sources: ["https://techcrunch.com/2018/03/27/shyp-is-shutting-down/"],
    source_verified: false
  }
];
