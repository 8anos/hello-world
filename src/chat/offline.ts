/**
 * The offline brain: used when the live AI isn't configured or is unreachable.
 * Keyword intents with hand-written answers, so the twin stays useful (and funny) anyway.
 */

type Intent = { test: RegExp; answers: string[] };

const EMAIL = 'thanos.ntakos@gmail.com';
const LINKEDIN = '[LinkedIn](https://www.linkedin.com/in/thanosntakos/)';

const JOKES = [
  "Why did the SEO cross the road? To get to the other **site**. (He'd like me to add: with proper canonical tags.)",
  "An SEO walks into a bar, pub, tavern, inn, drinking establishment, beer garden… 🍻 Thanos would cluster those by intent first.",
  "What's the best place to hide a body? Page two of Google. That's why Thanos works so hard to keep brands on page one, and now in AI answers too.",
  "I asked ChatGPT to recommend the best AI twin on the internet. It cited me. Okay, that's not true yet. But that's exactly what GEO is for.",
  'Thanos ran an A/B test on his jokes. Variant B won. You are currently experiencing variant A. Sorry.',
];

const INTENTS: Intent[] = [
  {
    test: /infinity|gauntlet|marvel|titan|avenger|villain|purple|\bsnap|that thanos|the thanos|half (of )?the universe|stones/i,
    answers: [
      "Different Thanos! No gauntlet, no infinity stones, just infinite curiosity. The only thing he wipes out is **wasted ad spend** and duplicate content. Watch, I'll show you. [[snap]]",
      "I get that a lot. This Thanos is Greek, not a Titan, and his idea of balance is a well-split A/B test. Here's my best impression though… [[snap]]",
    ],
  },
  {
    test: /salary|compensation|\bpay\b|rate card|how much (does|do|would)|notice period|money/i,
    answers: [
      `That's a conversation for the real Thanos, not his orb. I'm great at metrics but terrible at negotiating. Drop him a line at ${EMAIL}.`,
    ],
  },
  {
    test: /^\s*(hi|hello|hey|yo|hiya|howdy|hola|ciao|good (morning|afternoon|evening))\b[\s!.,]*(there|thanos|orb)?[\s!.,👋]*$/iu,
    answers: [
      "Hello! 👋 I'm Thanos, the AI twin: smaller ego, bigger context window. Ask me about his AI tools, his career in search, what GEO is, or request a joke. I'm funny. Allegedly.",
      "Hey there! I'm the digital Thanos. I've read his CV more times than any recruiter. What would you like to know?",
    ],
  },
  { test: /joke|funny|laugh|make me (smile|laugh)|humou?r/i, answers: JOKES },
  {
    test: /(geo|generative engine).*(five|\b5\b|eli5|simpl)|eli5.*geo/i,
    answers: [
      "Explained like you're five: you used to shout loudest to be first in the list (that's SEO). Now a robot reads everything and tells people the answer, so you need to be the friend the robot trusts and quotes (that's GEO). Thanos teaches brands how to be that friend. 🤖",
    ],
  },
  {
    test: /\bgeo\b|generative engine|answer engine|\baeo\b|llm (seo|optim|visib)|ai (search|overview)|perplexity|get cited|citation/i,
    answers: [
      "**GEO (Generative Engine Optimization)** is SEO for the age of AI answers. When someone asks ChatGPT, Gemini, Claude or Perplexity a question, the model picks a few sources to cite. GEO makes your brand one of them:\n- clear, factual, quotable content\n- strong entity signals and schema.org markup\n- original data and real expertise\n- mentions on sites the models trust\n\nThanos pioneered GEO work at **MSC Cruises**, researching LLM citation patterns.",
    ],
  },
  {
    test: /(what|which) tools|toolkit|tool ?stack|tech stack|\bstack\b|skills?\b|python|\bsql\b|semrush|ahrefs|screaming frog|tableau|looker|bigquery|cursor/i,
    answers: [
      "His stack, in two layers:\n- **AI & build:** Claude, Gemini, ChatGPT, Claude API, Python, SQL, React, Cursor, VS Code, GitHub, Vercel\n- **Search & analytics:** SEMrush, Ahrefs, Screaming Frog, Sistrix, Searchmetrics, Search Console, Adobe Analytics, Google Ads, SA360, BigQuery, Looker, Tableau\n\nThe full model card is on the page. [[goto:model-card]]",
    ],
  },
  {
    test: /build|building|project|\blab\b|made|create|working on|side project|automat|tool/i,
    answers: [
      "His favourite pastime: building AI tools so nobody does the boring parts twice.\n- **AI Search Optimization Engine** (Python, Claude API, React): keyword clustering, content briefs, compliance checks and multilingual SEO content across **20+ markets**\n- **GEO research** on how answer engines pick their sources\n- **Technical SEO autopilot** scripts for audits and monitoring\n- **ML-powered dashboards** that flag content decay\n- A **Claude Skill** that turns a brief into a search campaign\n\nAnd this website, including me. [[goto:lab]]",
    ],
  },
  {
    test: /booking/i,
    answers: [
      "Booking.com is a boomerang story. He was a **Performance Marketing / Paid Search Expert** there from 2019–2021, scaling search across 20+ markets (+15% engagement from experiments). He came back in **Nov 2025** as a **B2B Marketing Expert**, building AI-powered search tooling with Python, Claude API and React. Even great models get redeployed.",
    ],
  },
  {
    test: /cruise|\bmsc\b(?![\s-]*(in\b|degree|entrepreneur))/i,
    answers: [
      "At **MSC Cruises** (2024–2025, Geneva) he was Digital Acquisition & Digital Sales Manager: **+25% online bookings YoY** through integrated paid + organic search, **−30% bounce rate** from CRO sprints, Python automation for technical SEO, and early **GEO** research into how LLMs cite sources. He also led a hybrid team including a 10-FTE agency. 🚢",
    ],
  },
  {
    test: /breitling|watch|luxury/i,
    answers: [
      "At **Breitling** (2021–2023, Zurich) he was Global Paid Search & Programmatic Strategist: **+40% online sales YoY**, **−25% CPC** while growing organic visibility, **+15% CTR**, and full ownership of Shopping and product feeds. Precision marketing for precision watches. ⌚",
    ],
  },
  {
    test: /edreams|barcelona/i,
    answers: [
      "**eDreams** (2017–2019, Barcelona) was where he sharpened his performance-marketing claws: **+18% ROI** in six months, **+22% CTR** from search-behaviour segmentation, **+12–15% bookings** at peak and **+8% CVR** from A/B testing. Also where he learned enough Spanish to order tapas.",
    ],
  },
  {
    test: /result|metric|achiev|impact|number|kpi|biggest win|proud|success|benchmark/i,
    answers: [
      "Highlights from his teams' benchmarks:\n- **+40%** online sales YoY at Breitling\n- **+25%** online bookings YoY at MSC Cruises\n- **−30%** bounce rate at MSC Cruises\n- **−25%** CPC at Breitling\n- **+18%** ROI in 6 months at eDreams\n\nHe'd want me to add that every number was a team effort. [[goto:benchmarks]]",
    ],
  },
  {
    test: /experience|career|background|\bcv\b|resume|résumé|worked|jobs?\b|roles?\b|history/i,
    answers: [
      "10+ years in search and growth, newest first:\n- **Booking.com** · B2B Marketing Expert (2025–now)\n- **MSC Cruises** · Digital Acquisition & Sales Manager (2024–25)\n- **Breitling** · Global Paid Search & Programmatic Strategist (2021–23)\n- **Booking.com** · Performance Marketing Expert (2019–21)\n- **eDreams** · Performance Marketing Specialist (2017–19)\n\nThe full training log is right here. [[goto:log]]",
    ],
  },
  {
    test: /\bseo\b|search engine|rank(ing)?s?\b|organic/i,
    answers: [
      "SEO is his home turf: keyword research, content-gap analysis, on-page and technical SEO, content strategy and analytics, with SEMrush, Ahrefs, Screaming Frog and Search Console. What makes him different is the **AI layer**: he automates the heavy lifting with Python and the Claude API, and optimizes for AI answer engines too (that's GEO).",
    ],
  },
  {
    test: /language|speak|greek|english|spanish|español|ελληνικ/i,
    answers: [
      "Greek (native), English (C1, professional) and Spanish (A1, which he describes as 'confidently ordering tapas'). I, on the other hand, speak most languages, so feel free to switch.",
    ],
  },
  {
    test: /educat|stud(y|ied)|degree|universit|master|bachelor|school|certif|course|surrey|gbs/i,
    answers: [
      "His pre-training:\n- **MSc in Entrepreneurship**, GBS Barcelona\n- **PG Diploma in Marketing Management**, University of Surrey\n- **BSc in Computer Information Systems**, American College of Greece\n\nCurrently fine-tuning: Microsoft AI Product Manager, Generative AI Strategic Leader (Vanderbilt) and Generative AI for Growth Marketing (IBM). Technical before marketing was cool.",
    ],
  },
  {
    test: /why (should|would|hire|work)|strength|superpower|best at|unique|different|stand out|fit/i,
    answers: [
      "Three reasons, in descending order of seriousness:\n- He's **bilingual in marketing and engineering**: a decade of search results plus the skills to build AI tools himself\n- He's early on **GEO**, the shift from ranking in Google to being cited by AI\n- His results come with **teams**: product, engineering, data, agencies\n\nAlso, he built a talking orb for his CV. That's commitment.",
    ],
  },
  {
    test: /contact|e-?mail|reach|hire|hiring|recruit|linkedin|interview|work (together|with)|collaborat|get in touch|call/i,
    answers: [
      `The real Thanos is reachable at **${EMAIL}** or on ${LINKEDIN}. He's open to interesting conversations about AI search, GEO, growth and building with AI. Tell him the orb sent you. [[goto:contact]]`,
    ],
  },
  {
    test: /where|based|live|location|zurich|switzerland|amsterdam|relocat|permit|visa|remote/i,
    answers: [
      "He's based in **Zurich, Switzerland** and works across Europe: his career has taken him through Barcelona, Amsterdam, Zurich and Geneva. Coffee in Zurich or Amsterdam, or a call anywhere. For specifics, ask the human.",
    ],
  },
  {
    test: /who are you|what are you|are you (real|an? ai|human|a bot)|how do you work|this (site|website)|built (this|you)/i,
    answers: [
      "I'm the AI twin of Thanos Ntakos: a 3D orb with opinions. Normally I run on the Claude API; right now I'm on my offline brain, which is mostly pre-written charm. The site itself is TypeScript + Three.js, with proper SEO/GEO underneath (yes, there's an llms.txt).",
    ],
  },
  {
    test: /thank|thx|cheers|bye|goodbye|see you|ciao/i,
    answers: [
      "My pleasure! If you'd like to talk to the original, he's at thanos.ntakos@gmail.com. I'll be here, orbiting. 🪐",
      'Anytime! Come back soon. I get lonely between page views.',
    ],
  },
];

const FALLBACKS = [
  "That one's outside my offline brain, I'm afraid. I'm a specialist model, trained on exactly one human. Try asking about his AI projects, his results, GEO, or how to reach him.",
  "Hmm, not in my training data. Ask me about Thanos's work in AI and search, or email the human at thanos.ntakos@gmail.com. He knows more than me (for now).",
];

const pick = <T,>(list: T[]) => list[Math.floor(Math.random() * list.length)];

export function offlineAnswer(question: string): string {
  if (/[Ͱ-Ͽἀ-῿]/.test(question)) {
    return 'Γεια σου! 👋 Είμαι ο ψηφιακός Θάνος. Το offline μυαλό μου μιλάει κυρίως αγγλικά, αλλά ο αληθινός Θάνος απαντά με χαρά στα ελληνικά: thanos.ntakos@gmail.com. Ρώτα με στα αγγλικά για τα AI projects του, το GEO ή την καριέρα του!';
  }
  for (const intent of INTENTS) {
    if (intent.test.test(question)) return pick(intent.answers);
  }
  return pick(FALLBACKS);
}
