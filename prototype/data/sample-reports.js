// ── sample-reports.js — 15 fixed sample ideas for the Reports page's "Sample reports" toggle ──
// Research, not output: every evidence item, competitor, Big Tech label and graveyard check below was read
// on the page at `url` on the date in `checked`, and every `quote` appears word for word on that page
// (tests/sample-reports.test.js checks the shape; the recheck script re-fetches each URL).
// Nothing here is a status, a score or a band: prototype/core/sample-reports.js derives those with the
// pipeline's own code (computeStatus, typeClaim, matchGraveyard, tamFromEvidence, deterministicObjections,
// finalizeReport). A claim with no evidence was not researched and stays unverified.
// The idea texts are invented sample ideas (they describe no real company); the evidence is real.

const C = "2026-10-20"; // date every page below was fetched and checked
const W = "https://en.wikipedia.org/wiki/";

const ev = (stance, url, quote) => ({ url, stance, quote, checked: C });
const no = ev.bind(null, "contradicts");
const yes = ev.bind(null, "supports");
const comp = (name, url, why_similar, quote) => ({ name, url, why_similar, quote, checked: C });
const label = (company, relation, url, reason, quote) => ({ company, relation, url, reason, quote, checked: C });

export const SAMPLE_CHECKED = C;

export const SAMPLE_IDEAS = [
  {
    id: "meeting-notes",
    input: { title: "MinuteMate", pitch: "An AI notetaker that joins video calls and writes the minutes.", problem: "Teams lose decisions made in video meetings because nobody writes them down.", solution: "A bot joins the call, transcribes the conversation and sends a summary with action items afterwards.", moat: "", industries: ["AI/ML", "SaaS/B2B"], role: "founder", markets: ["USA"] },
    claims: [
      { claim: "No existing tool transcribes video meetings automatically.", evidence: [
        no("https://otter.ai/", "Otter transcribes every meeting, turning it into searchable knowledge that powers your workflow."),
        no(W + "Otter.ai", "In January 2018, the company announced a partnership with Zoom Video Communications to transcribe video meetings post-conference."),
      ] },
      { claim: "None of the big video-call platforms offers built-in meeting transcription.", evidence: [
        no("https://support.microsoft.com/en-us/office/view-live-transcription-in-microsoft-teams-meetings-dc1a8f23-2e20-4684-885e-2152e06a4a8b", "When you record a meeting, transcription starts automatically."),
        no("https://support.google.com/meet/answer/12849897?hl=en", "Meeting transcripts are on by default for all Workspace editions except Google Workspace for Education with a student license, where meeting transcripts are off by default."),
      ] },
      { claim: "Sales teams will pay $20 per seat per month for automatic minutes.", evidence: [] },
    ],
    competitors: [comp("Otter.ai", W + "Otter.ai", "Transcription software for meeting notes.", "Otter.ai, Inc. is an American transcription software company based in Mountain View, California.")],
    competitor_search: { queries: ["Otter.ai"], pages: ["https://otter.ai/", W + "Otter.ai"] },
    big_tech: {
      companies_checked: ["Alphabet/Google", "Microsoft"],
      labels: [
        label("Alphabet/Google", "direct", "https://support.google.com/meet/answer/12849897?hl=en", "Google Meet records meeting transcripts.", "Use Transcripts with Google Meet"),
        label("Alphabet/Google", "adjacent", W + "Google_Meet", "Google Meet is a video-call product.", "Google Meet is available to Android and iOS devices, as well a web application."),
        label("Microsoft", "direct", "https://support.microsoft.com/en-us/office/view-live-transcription-in-microsoft-teams-meetings-dc1a8f23-2e20-4684-885e-2152e06a4a8b", "Teams meetings have live transcripts.", "Start, stop, and download live transcripts in Microsoft Teams meetings"),
        label("Microsoft", "adjacent", W + "Microsoft_Teams", "Teams is a collaboration platform with meetings.", "Microsoft Teams is a team collaboration platform developed by Microsoft as part of the Microsoft 365 suite."),
      ],
    },
  },
  {
    id: "short-video",
    input: { title: "SnackReel", pitch: "Premium short-form shows made for phones, 5 to 10 minutes per episode.", problem: "Commuters want quality entertainment that fits a short ride on a phone screen.", solution: "A subscription mobile streaming app of studio-produced short episodes shot for vertical viewing.", moat: "Exclusive deals with established studios.", industries: ["Media/Creator"], role: "investor", markets: ["USA", "EU"] },
    claims: [
      { claim: "No platform offers short vertical videos for phones at scale.", evidence: [
        no(W + "YouTube_Shorts", "YouTube Shorts are short form vertical videos that have a duration of up to three minutes, and has various features for user interaction."),
        no("https://www.failory.com/cemetery/quibi", "Yet, TikTok usage was growing during the pandemic, and presumably, TikTok relies on mobile usage just as much as Quibi."),
      ] },
      { claim: "Commuters will pay a monthly subscription for short premium shows.", evidence: [
        no(W + "Quibi", "It launched in April 2020, but shut down in December 2020 after falling short of its subscriber projections."),
      ] },
      { claim: "Exclusive studio deals make the catalogue hard to copy.", evidence: [
        no(W + "Quibi", "Quibi did not own the rights to any of their programming"),
      ] },
    ],
    competitors: [
      comp("TikTok", W + "TikTok", "Short-form mobile video at very large scale.", "In July 2020, TikTok, excluding Douyin, reported close to 800 million monthly active users worldwide after less than four years of existence."),
      comp("YouTube Shorts", W + "YouTube_Shorts", "Short vertical videos inside YouTube.", "YouTube Shorts is the short-form section of the American online video-sharing platform YouTube."),
    ],
    competitor_search: { queries: ["TikTok", "YouTube Shorts"], pages: [W + "TikTok", W + "YouTube_Shorts", "https://www.failory.com/cemetery/quibi"] },
    big_tech: {
      companies_checked: ["Alphabet/Google"],
      labels: [label("Alphabet/Google", "direct", W + "YouTube_Shorts", "YouTube Shorts was built to compete in short video.", "YouTube's main intent in the creation of YouTube Shorts in 2019 was to compete with TikTok, an online video platform for short clips.")],
    },
  },
  {
    id: "meditation",
    input: { title: "StillPoint", pitch: "Guided meditation and sleep stories in one calm app.", problem: "Stressed people struggle to switch off and sleep.", solution: "A mobile app with guided meditations, breathing exercises and narrated sleep stories.", moat: "", industries: ["Healthtech", "Consumer"], role: "founder", markets: ["EU"] },
    claims: [
      { claim: "No app offers guided meditation and sleep stories together.", evidence: [
        no("https://www.calm.com/", "The #1 app for sleep, meditation and relaxation"),
        no(W + "Calm_(company)", "Calm produces meditation products, including guided meditations, a book, narrated Sleep Stories, and health and meditation videos."),
      ] },
      { claim: "Employers will buy meditation subscriptions for their staff.", evidence: [
        yes("https://www.headspace.com/", "Trusted by thousands of employers, health plans, and partners globally"),
        yes(W + "Calm_(company)", "Calm Health is the company's clinically oriented platform, which launched in 2022, and offers condition-specific mental health programs and integrates with healthcare providers and employers to support patients with anxiety, depression, and other health-related behavioral needs."),
      ] },
      { claim: "Users stay subscribed for more than a year.", evidence: [] },
    ],
    competitors: [
      comp("Calm", W + "Calm_(company)", "Meditation and sleep app.", "Calm.com, Inc., doing business as Calm, is an American software company based in San Francisco, California."),
      comp("Headspace", W + "Headspace_(company)", "Guided meditation app.", "Headspace offers guided meditation sessions through its mobile app and website."),
    ],
    competitor_search: { queries: ["Calm", "Headspace"], pages: ["https://www.calm.com/", W + "Calm_(company)", W + "Headspace_(company)", "https://www.headspace.com/"] },
  },
  {
    id: "remittance",
    input: { title: "HomeSend", pitch: "Send money from Europe to family in India at the real exchange rate.", problem: "Banks hide fees in poor exchange rates on international transfers.", solution: "An app that converts at the mid-market rate and shows the full fee before you send.", moat: "", industries: ["Fintech"], role: "founder", markets: ["EU", "India"] },
    claims: [
      { claim: "No service transfers money at the mid-market exchange rate.", evidence: [
        no("https://wise.com/", "Get the mid-market exchange rate every time"),
      ] },
      { claim: "Remittances to India are worth more than $100 billion a year.", evidence: [
        yes(W + "Remittances_to_India", "Remittances to India stood at US$125 billion in 2023, up from US$69 billion in 2017."),
        yes("https://www.worldbank.org/en/news/press-release/2024/06/26/remittances-slowed-in-2023-expected-to-grow-faster-in-2024", "Growth was driven by India, which saw a 7.5% increase to $120 billion, supported by strong labor markets in the United States and Europe."),
      ] },
      { claim: "Banks hide most of the transfer fee in the exchange rate.", evidence: [
        yes(W + "Wise_(company)", "He became aware that when sending money between Estonia and the UK, banks would typically deduct at least a 5% fee, and also remarked that most of the charge is hidden in the exchange rate."),
      ] },
      { claim: "Migrants will switch provider to save on fees.", evidence: [] },
    ],
    competitors: [comp("Wise", W + "Wise_(company)", "Cross-border money transfers.", "Wise Business allows businesses to perform cross-border money transfers.")],
    competitor_search: { queries: ["Wise"], pages: ["https://wise.com/", W + "Wise_(company)"] },
  },
  {
    id: "student-bank",
    input: { title: "CampusBank", pitch: "A mobile-only current account designed for university students.", problem: "Students find traditional bank branches and fees a poor fit for their lives.", solution: "An app-based account with budgeting pots, instant notifications and no monthly fee.", moat: "Partnerships with student unions.", industries: ["Fintech"], role: "accelerator", markets: ["EU"] },
    claims: [
      { claim: "App-only banks cannot win millions of customers.", evidence: [
        no(W + "Monzo", "As of May 2026, Monzo reported having more than 15.2 million customers and customer deposits exceeding £25 billion."),
        no("https://n26.com/en-eu", "We currently operate in 24 markets worldwide and have over 8 million customers."),
      ] },
      { claim: "No app-based bank holds a full banking licence.", evidence: [
        no(W + "Monzo", "Originally operating through a mobile app and a prepaid debit card, in April 2017 its UK banking licence restrictions were lifted, enabling it to offer a full current account."),
        no(W + "N26", "In July 2016, it re-branded as N26 Bank, after receiving a banking license they applied for 9 months prior by the German regulator BaFin."),
      ] },
      { claim: "Students will choose a bank through their student union.", evidence: [] },
    ],
    competitors: [
      comp("Monzo", W + "Monzo", "App-based bank in the UK.", "Monzo launched as part of a number of app-based challenger banks entering the UK market."),
      comp("N26", W + "N26", "App-based bank in Europe.", "N26 launched their banking product on October 20, 2014, in a private beta."),
    ],
    competitor_search: { queries: ["Monzo", "N26"], pages: [W + "Monzo", W + "N26", "https://n26.com/en-eu"] },
  },
  {
    id: "home-cleaning",
    input: { title: "TidyNow", pitch: "Book a vetted home cleaner in minutes from your phone.", problem: "Finding a reliable cleaner at short notice is hard in big Indian cities.", solution: "An on-demand home cleaning marketplace connecting customers with independent cleaners.", moat: "", industries: ["Consumer"], role: "founder", markets: ["India"] },
    claims: [
      { claim: "No company offers on-demand home services through an app in India.", evidence: [
        no(W + "Urban_Company", "In March 2025, Urban Company launched Insta Maids (later rebranded to Insta Help), a quick e-commerce service offering on-demand domestic help within 15 minutes in select areas of Mumbai."),
        no("https://www.urbancompany.com/", "Home services at your doorstep"),
      ] },
      { claim: "Cleaners will prefer working as independent contractors.", evidence: [] },
      { claim: "Customers will book a cleaner every week.", evidence: [] },
    ],
    competitors: [comp("Urban Company", W + "Urban_Company", "Home services booked through an app in India.", "As of March 2025, Urban Company reported having approximately 40,000 registered professionals globally.")],
    competitor_search: { queries: ["Urban Company"], pages: [W + "Urban_Company", "https://www.urbancompany.com/"] },
  },
  {
    id: "k12-tutoring",
    input: { title: "ClassBoost", pitch: "Live online tuition for school students in classes 1 to 12.", problem: "Many families cannot find good tutors near them.", solution: "A learning app with recorded lessons and live online tutoring sessions.", moat: "", industries: ["Edtech"], role: "investor", markets: ["India"] },
    claims: [
      { claim: "No app offers personalised learning programs for classes 1 to 12.", evidence: [
        no("https://www.byjus.com/", "Launched in 2015, BYJU'S offers highly personalised and effective learning programs for classes 1 - 12 (K-12), and aspirants of competitive exams like JEE, IAS etc."),
        no(W + "Byju%27s", "Byju's was an education tutoring app that ran on a freemium model, with free access to content limited for 15 days after the registration."),
      ] },
      { claim: "Large online tutoring companies in India are financially stable.", evidence: [
        no(W + "Byju%27s", "As of 2025, the company is under insolvency proceedings in India."),
      ] },
      { claim: "Parents will pay a yearly fee up front.", evidence: [] },
    ],
    competitors: [comp("Byju's", W + "Byju%27s", "K-12 learning and tutoring app in India.", "Byju's (stylised as BYJU'S) was an Indian multinational educational technology company, headquartered in Bengaluru.")],
    competitor_search: { queries: ["Byju's"], pages: ["https://www.byjus.com/", W + "Byju%27s"] },
  },
  {
    id: "language-tutor",
    input: { title: "ChatLingo", pitch: "An AI tutor that holds real conversations in the language you are learning.", problem: "Apps teach vocabulary but learners rarely get to practise speaking.", solution: "A chatbot tutor that talks with you and corrects your mistakes in short daily lessons.", moat: "", industries: ["Edtech", "AI/ML"], role: "founder", markets: ["USA", "EU"] },
    claims: [
      { claim: "No app teaches languages with gamified short daily lessons.", evidence: [
        no(W + "Duolingo", "The learning method incorporates gamification to motivate users with points, rewards and interactive lessons featuring spaced repetition."),
      ] },
      { claim: "Learners will pay for an ad-free tier.", evidence: [
        yes(W + "Duolingo", "The company follows a freemium model, where some content is provided for free with advertising, and users can pay for ad-free services which provide additional features."),
      ] },
      { claim: "AI conversation practice improves fluency faster than flashcards.", evidence: [] },
    ],
    competitors: [comp("Duolingo", W + "Duolingo", "Language-learning app with short daily lessons.", "Duolingo, Inc. is an American educational technology company that produces learning apps and provides language certification.")],
    competitor_search: { queries: ["Duolingo"], pages: [W + "Duolingo"] },
  },
  {
    id: "resale-fashion",
    input: { title: "Loop Closet", pitch: "A peer-to-peer marketplace for second-hand clothes.", problem: "Wardrobes are full of clothes nobody wears while new fashion piles up in landfill.", solution: "An app where people list, sell and ship their used clothing to buyers nearby.", moat: "", industries: ["E-commerce", "Consumer"], role: "accelerator", markets: ["EU"] },
    claims: [
      { claim: "No platform runs a large second-hand fashion marketplace in Europe.", evidence: [
        no(W + "Vinted", "Vinted is the leading second-hand fashion marketplace in Europe."),
        no("https://www.vinted.com/about", "1 simple idea now unites a community of millions"),
      ] },
      { claim: "A social, feed-style app attracts younger sellers.", evidence: [] },
      { claim: "Buyers trust peer-to-peer sellers enough to pay before seeing the item.", evidence: [] },
    ],
    competitors: [
      comp("Vinted", W + "Vinted", "Second-hand fashion marketplace in Europe.", "Vinted is the leading second-hand fashion marketplace in Europe."),
      comp("Depop", W + "Depop", "Second-hand clothing marketplace.", "In June 2021, Depop was acquired by Etsy for $1.6 billion in cash, making it Etsy's most expensive acquisition; however, Depop continues to operate as a standalone brand independent from Etsy."),
    ],
    competitor_search: { queries: ["Vinted", "Depop"], pages: [W + "Vinted", "https://www.vinted.com/about", W + "Depop"] },
  },
  {
    id: "home-solar",
    input: { title: "SunStack", pitch: "Rooftop solar with a home battery, sold as one subscription.", problem: "Homeowners want backup power and lower bills but find solar systems complex.", solution: "A bundled rooftop solar, microinverter and battery system installed and monitored for a monthly fee.", moat: "", industries: ["Climate/Energy"], role: "investor", markets: ["USA"] },
    claims: [
      { claim: "No company sells residential solar microinverters together with home batteries.", evidence: [
        no(W + "Enphase_Energy", "Enphase Energy, Inc. is an American energy technology company headquartered in Fremont, California, that develops and manufactures solar micro-inverters, battery energy storage, and EV charging stations primarily for residential customers."),
        no("https://www.enphase.com/", "IQ Battery 5P with FlexPhase Our most powerful battery yet."),
      ] },
      { claim: "Homeowners prefer a monthly subscription to buying the system.", evidence: [] },
      { claim: "Installers will partner with a new brand.", evidence: [] },
    ],
    competitors: [comp("Enphase Energy", W + "Enphase_Energy", "Residential solar microinverters and batteries.", "Enphase Energy, Inc. is an American energy technology company headquartered in Fremont, California, that develops and manufactures solar micro-inverters, battery energy storage, and EV charging stations primarily for residential customers.")],
    competitor_search: { queries: ["Enphase Energy"], pages: [W + "Enphase_Energy", "https://www.enphase.com/"] },
  },
  {
    id: "smart-ring",
    input: { title: "NightBand Ring", pitch: "A smart ring that tracks sleep, heart rate and temperature.", problem: "Wrist trackers are bulky to wear in bed.", solution: "A lightweight ring with sensors that measures sleep stages, heart rate and body temperature and shows them in an app.", moat: "Proprietary sensor algorithms.", industries: ["Deeptech/Hardware", "Healthtech"], role: "founder", markets: ["EU", "USA"] },
    claims: [
      { claim: "No company sells a smart ring for sleep tracking.", evidence: [
        no("https://www.ouraring.com/", "Smart Ring for Fitness, Stress, Sleep & Health."),
        no(W + "Oura_Health", "The fifth generation of the device was released in June 2026, at which point a total of 5.5 million Oura Rings had been sold."),
      ] },
      { claim: "A ring can measure body temperature during sleep.", evidence: [
        yes(W + "Oura_Health", "The Oura App allows users to track up to 50 biomarkers, including activity, body temperature, respiratory rate, sleep patterns, menstrual cycles, and heart rate and heart rate variability (as measured by RMSSD), among others."),
      ] },
      { claim: "Proprietary algorithms will be hard for rivals to replicate.", evidence: [] },
    ],
    competitors: [comp("Oura Ring", W + "Oura_Health", "Smart ring that tracks sleep.", "The fifth generation of the device was released in June 2026, at which point a total of 5.5 million Oura Rings had been sold.")],
    competitor_search: { queries: ["Oura"], pages: ["https://www.ouraring.com/", W + "Oura_Health"] },
  },
  {
    id: "food-sharing",
    input: { title: "ShareShelf", pitch: "An app for giving away spare food to neighbours.", problem: "Households and shops throw away edible food every day.", solution: "Neighbours post surplus food in the app and people nearby collect it for free.", moat: "", industries: ["Consumer", "Climate/Energy"], role: "accelerator", markets: ["EU"] },
    claims: [
      { claim: "No app connects neighbours to share spare food.", evidence: [
        no("https://www.olioapp.com/", "Browse free food from your local shops and discover things your neighbours are giving away for free – books, toys, toiletries and more!"),
        no(W + "Olio_(app)", "It does this by connecting neighbours with spare food or household items to others nearby who wish to pick up those items."),
      ] },
      { claim: "Supermarkets will donate surplus food through the app.", evidence: [
        yes(W + "Olio_(app)", "For example, some supermarket chains in the UK, including Tesco, the Midcounties Co-operative, Morrisons, Sainsbury's and Iceland have piloted Olio as an 'online food bank' to donate food and to reduce their waste."),
      ] },
      { claim: "Volunteers will collect food from shops for free.", evidence: [
        yes("https://www.olioapp.com/", "Volunteer to collect surplus food from local businesses, share it with people nearby – and keep some for yourself as a thank you!"),
      ] },
    ],
    competitors: [comp("Olio", "https://www.olioapp.com/", "Food-sharing app for neighbours.", "Join 9 million Olio-ers worldwide")],
    competitor_search: { queries: ["Olio"], pages: ["https://www.olioapp.com/", W + "Olio_(app)"] },
  },
  {
    id: "connected-juicer",
    input: { title: "PressPod", pitch: "A WiFi-connected juicer that presses single-serve produce packs.", problem: "Fresh juice at home is messy and time-consuming.", solution: "A connected juicer press with proprietary juice packs delivered by subscription.", moat: "Patented press and pack design.", industries: ["Consumer", "Deeptech/Hardware"], role: "founder", markets: ["USA"] },
    claims: [
      { claim: "A press is needed to get the juice out of produce packs.", evidence: [
        no(W + "Juicero", "The company attracted significant negative media attention when consumers and journalists discovered that its juice packets could be squeezed just as easily by hand as by the company's expensive juicer."),
        no("https://www.failory.com/cemetery/juicero", "The company received one last blow when Bloomberg News published a video proving that simply by hand squeezing the packets you could obtain a full glass of juice and that the $700 machine was really useless."),
      ] },
      { claim: "Pack subscriptions give recurring revenue.", evidence: [] },
      { claim: "The press design is hard to copy.", evidence: [] },
    ],
  },
  {
    id: "virtual-assistants",
    input: { title: "DeskAide", pitch: "Remote personal assistants for busy founders, booked by the hour.", problem: "Small-company executives spend hours on scheduling and admin.", solution: "A service matching executives with remote assistants who handle email, calendars and travel.", moat: "", industries: ["SaaS/B2B"], role: "investor", markets: ["USA"] },
    claims: [
      { claim: "Founders will pay by the hour for a remote assistant.", evidence: [] },
      { claim: "Assistants can be hired as contractors rather than employees.", evidence: [
        yes(W + "Zirtual", "Zirtual hires VAs as independent contractors."),
      ] },
      { claim: "Demand for remote admin help is growing.", evidence: [] },
    ],
  },
  {
    id: "blood-test",
    input: { title: "DropTest", pitch: "Lab blood tests from a single finger-prick drop, done at the pharmacy.", problem: "Blood tests mean needles, clinic visits and days of waiting.", solution: "A compact device in pharmacies runs a panel of blood tests from a few drops and sends results to your phone.", moat: "", industries: ["Healthtech", "Deeptech/Hardware"], role: "founder", markets: ["USA", "India"] },
    claims: [
      { claim: "A few drops of blood are enough to run many lab tests quickly and accurately.", evidence: [
        no(W + "Theranos", "The company falsely claimed that it had devised blood tests that could be performed rapidly and accurately while requiring very small amounts of blood, all using compact automated devices that the company had developed."),
      ] },
      { claim: "Pharmacies will host testing devices in their stores.", evidence: [] },
      { claim: "Regulators will approve the device within 2 years.", evidence: [] },
    ],
  },
];

// Closure checks for the graveyard seed entries the sample ideas match (prototype/data/graveyard.js ids).
// A matched lead is shown only with one of these: the quote (word for word on the page) is shown as the
// cause of death, and year_closed is the year that page gives.
export const GRAVEYARD_CHECKS = {
  quibi: { url: W + "Quibi", year_closed: 2020, checked: C, quote: "It launched in April 2020, but shut down in December 2020 after falling short of its subscriber projections." },
  vine: { url: W + "Vine_(service)", year_closed: 2017, checked: C, quote: "Twitter officially shut down Vine on January 17, 2017, and the app's overall leftover function was discontinued a few months later." },
  homejoy: { url: W + "Homejoy", year_closed: 2015, checked: C, quote: "The company cited difficulties in maintaining profitability, as well as lawsuits over whether its workers are contractors or employees." },
  juicero: { url: W + "Juicero", year_closed: 2017, checked: C, quote: "In 2017, following slow sales, Juicero ceased operations and announced it was seeking a complete buyout." },
  zirtual: { url: "https://www.failory.com/cemetery/zirtual", year_closed: 2015, checked: C, quote: "When a supposedly agreed upon round of funds didn’t come through, Zirtual shut down overnight." },
  theranos: { url: W + "Theranos", year_closed: 2018, checked: C, quote: "After several years of struggle, lawsuits, and sanctions from CMS, what remained of the company was dissolved in September 2018." },
};
