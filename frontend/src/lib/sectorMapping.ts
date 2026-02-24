/**
 * Smart keyword-to-sector mapping.
 * Given any name/description string, returns the best matching sector name or null.
 */

const SECTOR_KEYWORDS: { sector: string; keywords: RegExp }[] = [
  {
    // Must be first — catches UAE IBFT refs, MOBN, ACH/wire transfers before anything else
    sector: "Internal Transfer",
    keywords: /\b(internal transfer|own account|ibft|mobn|mobile transfer|neft|rtgs|imps|upi transfer|self transfer|acc transfer|account transfer|between accounts|online transfer|internet banking transfer|e-transfer|wire transfer|wire to|wire from|ach transfer|bank transfer|zelle transfer)\b|^[0-9a-f]{8,}[\s\-]*[a-z]{0,3}$/i,
  },
  {
    sector: "Salary & Income",
    keywords: /\b(salary|payroll|wages|paycheck|direct deposit|stipend|commission payment|bonus credit|income credit|reimbursement|refund credit|dividend|profit share|allowance)\b/i,
  },
  {
    sector: "Transportation & Logistics",
    keywords: /transport(?:ation)?|logistics|\b(shipping|freight|delivery|cargo|courier|fleet|vehicle|truck|trucking|bus|rail|railway|airline|airport|aviation|port|harbor|warehouse|warehousing|supply chain|aramex|dhl|fedex|ups|dnata|empost|etihad|flydubai|airblue|movers|relocation|moving|taxi|cab|ride|transit|salik|rta|adnoc|enoc|eppco|careem|bolt|parking)\b/i,
    // Note: "network" intentionally excluded — it's too generic and overlaps with IT/telecom company names
  },
  {
    sector: "Food & Beverage",
    keywords: /\b(food|foods|beverage|restaurant|restaurants|cafe|cafeteria|cafetera|coffee|bakery|bakeries|catering|grocery|groceries|supermarket|dining|meals|meat|dairy|fruits|vegetables|juice|water|drink|drinks|snack|snacks|cocoa|sugar|spices|rawabi|carrefour|lulu|choithrams|spinney|spinneys|baqala|chaat|karak|starbucks|mcdonalds|kfc|pizza|burger|shawarma|kebab|sushi|halal|kitchen|eatery|diner|grill|buffet|canteen|talabat|zomato|deliveroo|mrsool|marsool|hunger station|jahez|noon food|ralphs|kroger|safeway|whole foods|trader joe|albertsons|publix|wegmans|harris teeter|moongoat|dutch bros|peets coffee|blue bottle|instacart|chipotle|panera|chick-fil-a|chickfila|taco bell|five guys|shake shack|doordash|grubhub|ubereats|uber eats|instacart)\b/i,
  },
  {
    sector: "Finance & Banking",
    keywords: /\b(bank fee|service charge|overdraft|annual fee|finance charge|late payment fee|forex|foreign exchange|uae exchange|al ansari|lulu exchange|wall street exchange|western union|moneygram|zelle|venmo|paypal|bank|banking|finance|financial|investment|insurance|credit|loan|capital|fund|asset|wealth|nbd|hsbc|barclays|citi|citibank|jpmorgan|chase|lloyds|bnp|paribas|deutsche|mashreq|adcb|fab|enbd|adib|dib|rakbank|interest|mortgage|leasing|brokerage|securities|dividend|equity|checkcard|ach debit|ach credit|pos purchase|direct debit|direct deposit|cash app|apple pay|google pay|samsung pay|atm withdrawal|cash withdrawal|tabby)\b/i,
  },
  {
    sector: "Technology",
    keywords: /\b(tech|technology|software|digital|computer|app|application|web|cloud|saas|platform|IT|system|network|cyber|data|analytics|ai|artificial|intelligence|machine|learning|coding|development|developer|programming|microsoft|google|apple|aws|azure|oracle|sap|salesforce|cisco|dell|hp|lenovo|ibm|intel|nvidia|hardware|server|hosting|database|api|automation)\b|amazon web services/i,
  },
  {
    sector: "Healthcare",
    keywords: /\b(health|healthcare|hospital|clinic|medical|medicine|pharma|pharmaceutical|doctor|physician|dentist|dental|nursing|nurse|therapy|therapist|laboratory|lab|diagnostic|radiology|surgery|surgical|optical|optic|wellness|rehabilitation|rehab|pharmacy|drug|drugs|covid|vaccine|daman|medcare|aster|apollo|thumbay|life|lifecare)\b/i,
  },
  {
    sector: "Education",
    keywords: /\b(education|educational|school|university|college|academy|institute|training|course|curriculum|tuition|learning|student|teacher|professor|lecture|seminar|workshop|certification|degree|diploma|campus|kindergarten|nursery|montessori|british|american|international|scholars|knowledge)\b/i,
  },
  {
    sector: "Travel & Tourism",
    keywords: /\b(travel|tourism|tourist|hotel|hotels|resort|resorts|holiday|holidays|vacation|tour|tours|airline|airlines|flight|booking|accommodation|villa|hostel|bnb|airbnb|tripadvisor|expedia|visa|passport|heritage|landmark|sightseeing|cruise)\b/i,
  },
  {
    sector: "Construction",
    keywords: /\b(construction|construct|builder|building|buildings|contractor|architecture|architect|civil|engineer|engineering|infrastructure|project|developer|developers|fit-out|fitout|renovation|renovation|interior|design|property|properties|real estate|realestate|contractor|plumbing|electrical|hvac|concrete|cement|steel|materials|scaffold)\b/i,
  },
  {
    sector: "Retail & Shopping",
    keywords: /\b(retail|retailer|shop|shopping|store|market|trading|trade|goods|merchandise|mall|outlet|ecommerce|e-commerce|wholesale|distributor|distribution|import|export|supplier|suppliers|vendor|procurement|purchase|products|amazon|walmart|target|costco|best buy|home depot|lowes|ikea|nordstrom|macys|tj maxx|tjmaxx|marshalls|ross|gap|old navy|forever 21|h&m|zara|uniqlo|noon|namshi)\b/i,
  },
  {
    sector: "Utilities",
    keywords: /\b(utility|utilities|electricity|electric|power|water|gas|fuel|energy|solar|telecom|telecommunication|telephone|mobile|internet|broadband|cable|satellite|dewa|addc|sewa|etisalat|du|tecom|wifi|network)\b/i,
  },
  {
    sector: "Marketing & Advertising",
    keywords: /\b(marketing|market|advertising|advertise|advertisement|ad|ads|agency|agencies|media|pr|public relations|branding|brand|campaign|promotion|promotions|digital marketing|social media|seo|content|creative|design|print|outdoor|billboard|influencer|event|events|exhibition|expo)\b/i,
  },
  {
    sector: "Manufacturing",
    keywords: /\b(manufacturing|manufacture|manufacturer|factory|factories|production|produce|assembly|assemble|plant|industrial|industry|fabrication|processing|machinery|equipment|equipment|tools|parts|components|raw material|materials)\b/i,
  },
  {
    sector: "Real Estate",
    keywords: /\b(real estate|property|properties|land|plot|apartment|villa|office|commercial|residential|lease|rent|rental|landlord|tenant|estate|mortgage|valuation|brokerage|agency|agent|aldar|emaar|damac|nakheel|meraas|sobha|azizi|bloom|masaar|development)\b/i,
  },
  {
    sector: "Professional Services",
    keywords: /\b(consulting|consultant|consultancy|advisory|audit|auditing|accounting|legal|lawyer|law|attorney|notary|hr|human resources|recruitment|staffing|manpower|outsource|outsourcing|management|strategy|research|survey|compliance|regulatory|governance|tax|taxation|vat|customs)\b/i,
  },
  {
    sector: "Entertainment & Media",
    keywords: /\b(entertainment|media|music|film|movie|cinema|production|broadcast|streaming|radio|television|tv|gaming|game|sport|sports|fitness|gym|recreation|leisure|fun|park|amusement|theater|theatre|art|gallery|museum|culture|event)\b/i,
  },
  {
    sector: "Agriculture",
    keywords: /\b(agriculture|agricultural|farming|farm|harvest|crop|crops|livestock|poultry|fishery|fisheries|aquaculture|irrigation|seeds|fertilizer|fertilisers|pesticide|greenhouse|organic|horticulture|dairy|cattle|land|soil|agri)\b/i,
  },
  {
    sector: "Legal Services",
    keywords: /\b(legal|law|lawyer|attorneys|court|litigation|arbitration|notary|compliance|contract|dispute|intellectual|patent|trademark|copyright|solicitor|barrister|chambers|advocate|judiciary|enforcement)\b/i,
  },
];

/**
 * Given a name or description, returns the best matched sector name.
 * Returns null if no keyword match is found.
 */
export function guessCategory(name: string | null | undefined): string | null {
  if (!name) return null;
  const text = name.trim();
  if (!text) return null;

  // ATM Withdrawal — always Finance & Banking regardless of any stored category
  if (/\batm\s+withdrawal\b/i.test(text)) return "Finance & Banking";

  // UPOS Purchase DD/MM/YYYY HH:MM Merchant — UAE POS prefix, classify by merchant name
  const uposMatch = text.match(/^upos\s+purchase\s+\d{1,2}\/\d{1,2}\/\d{2,4}\s+\d{2}:\d{2}\s+(.+)/i);
  if (uposMatch) {
    return guessCategory(uposMatch[1].trim()) || "Retail & Shopping";
  }

  // POS-DD/MM/YY-Merchant or POS-DD/MM/YYYY-Merchant — UAE POS date prefix
  const posDateMatch = text.match(/^pos[-_]\d{2}[\/\-]\d{2}[\/\-]\d{2,4}[-_](.+)/i);
  if (posDateMatch) {
    return guessCategory(posDateMatch[1].trim()) || "Retail & Shopping";
  }

  // Handle SQ * (Square payments) — categorize by the merchant after "SQ *"
  const sqMatch = text.match(/^SQ\s*\*\s*(.+)/i);
  if (sqMatch) {
    const merchantAfterSq = sqMatch[1].trim();
    const sqCat = guessCategory(merchantAfterSq);
    return sqCat || "Retail & Shopping";
  }

  for (const { sector, keywords } of SECTOR_KEYWORDS) {
    if (keywords.test(text)) {
      return sector;
    }
  }

  return null;
}

/**
 * Maps raw bank-imported category strings to proper sector names.
 * Bank imports use their own category labels which differ from our sector names.
 */
const RAW_CATEGORY_MAP: Record<string, string> = {
  // Internal/own-account transfers
  "internal transfer": "Internal Transfer",
  "own account transfer": "Internal Transfer",
  "ibft": "Internal Transfer",
  "mobn": "Internal Transfer",
  "mobn transfer": "Internal Transfer",
  "mobile transfer": "Internal Transfer",
  "online transfer": "Internal Transfer",
  "transfer between accounts": "Internal Transfer",

  // Income
  "salary & income": "Salary & Income",
  "salary": "Salary & Income",
  "income": "Salary & Income",
  "payroll": "Salary & Income",
  "direct deposit": "Salary & Income",

  // Food
  "food & dining": "Food & Beverage",
  "food and dining": "Food & Beverage",
  "dining": "Food & Beverage",
  "restaurants": "Food & Beverage",
  "groceries": "Food & Beverage",

  // Transport
  "transportation": "Transportation & Logistics",
  "transport": "Transportation & Logistics",
  "travel": "Travel & Tourism",

  // Shopping
  "shopping & retail": "Retail & Shopping",
  "shopping": "Retail & Shopping",
  "retail": "Retail & Shopping",

  // Finance
  "banking & finance": "Finance & Banking",
  "banking and finance": "Finance & Banking",
  "atm & cash withdrawals": "Finance & Banking",
  "atm": "Finance & Banking",
  "cash withdrawals": "Finance & Banking",
  "finance": "Finance & Banking",

  // Entertainment
  "entertainment": "Entertainment & Media",

  // Utilities
  "utilities & bills": "Utilities",
  "utilities and bills": "Utilities",
  "utilities": "Utilities",
  "bills": "Utilities",

  // Tech/subscriptions
  "subscriptions & digital services": "Technology",
  "subscriptions": "Technology",
  "digital services": "Technology",
  "technology": "Technology",

  // Health
  "personal care": "Healthcare",
  "health & wellness": "Healthcare",
  "healthcare": "Healthcare",
  "medical": "Healthcare",

  // Education
  "education": "Education",

  // Catch-all
  "other expenses": "Other",
  "miscellaneous": "Other",
  "general": "Other",
};

export function mapRawBankCategory(raw: string | null | undefined): string | null {
  if (!raw) return null;
  return RAW_CATEGORY_MAP[raw.toLowerCase().trim()] ?? null;
}

/**
 * Canonical category resolver used by all pages.
 * 1. If rawCategory maps to a known sector via RAW_CATEGORY_MAP → return mapped name.
 * 2. If rawCategory is already a valid sector name → return as-is.
 * 3. If fallbackName is provided → try guessCategory on it.
 * 4. Return rawCategory if non-empty, else "Other".
 */
export function resolveCategory(
  rawCategory: string | null | undefined,
  fallbackName?: string | null
): string {
  // HIGH PRIORITY: ATM Withdrawal in description always wins — stored category is unreliable
  // (bank statements may tag ATM withdrawals as "Food & Dining", "Internal Transfer", etc.)
  if (fallbackName && /\batm\s+withdrawal\b/i.test(fallbackName.trim())) {
    return "Finance & Banking";
  }

  if (rawCategory) {
    const mapped = mapRawBankCategory(rawCategory);
    if (mapped) return mapped;
    // Already a valid sector name? Return as-is.
    const isValid = SECTOR_KEYWORDS.some(s => s.sector === rawCategory);
    if (isValid) return rawCategory;
  }
  if (fallbackName) {
    const guessed = guessCategory(fallbackName);
    if (guessed) return guessed;
  }
  return rawCategory || "Other";
}
