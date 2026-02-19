/**
 * Smart keyword-to-sector mapping.
 * Given any name/description string, returns the best matching sector name or null.
 */

const SECTOR_KEYWORDS: { sector: string; keywords: RegExp }[] = [
  {
    sector: "Transportation & Logistics",
    keywords: /transport(?:ation)?|logistics|\b(shipping|freight|delivery|cargo|courier|fleet|vehicle|truck|trucking|bus|rail|railway|airline|airport|aviation|port|harbor|warehouse|warehousing|supply chain|aramex|dhl|fedex|ups|dnata|empost|etihad|flydubai|airblue|movers|relocation|moving|taxi|cab|ride|transit)\b/i,
  },
  {
    sector: "Food & Beverage",
    keywords: /\b(food|foods|beverage|restaurant|restaurants|cafe|cafeteria|coffee|bakery|bakeries|catering|grocery|groceries|supermarket|dining|meals|meat|dairy|fruits|vegetables|juice|water|drink|drinks|snack|snacks|cocoa|sugar|spices|rawabi|carrefour|lulu|choithrams|spinney|starbucks|mcdonalds|kfc|pizza|burger|shawarma|kebab|sushi|halal|kitchen|eatery|diner|grill|buffet|canteen)\b/i,
  },
  {
    sector: "Finance & Banking",
    keywords: /\b(bank|banking|finance|financial|investment|insurance|credit|loan|capital|fund|asset|wealth|forex|exchange|nbd|hsbc|barclays|citi|citibank|jpmorgan|chase|lloyds|bnp|paribas|deutsche|mashreq|adcb|fab|enbd|adib|dib|rakbank|interest|mortgage|leasing|brokerage|securities|dividend|equity)\b/i,
  },
  {
    sector: "Technology",
    keywords: /\b(tech|technology|software|digital|computer|app|application|web|cloud|saas|platform|IT|system|network|cyber|data|analytics|ai|artificial|intelligence|machine|learning|coding|development|developer|programming|microsoft|google|apple|amazon|aws|azure|oracle|sap|salesforce|cisco|dell|hp|lenovo|ibm|intel|nvidia|hardware|server|hosting|database|api|automation)\b/i,
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
    keywords: /\b(retail|retailer|shop|shopping|store|market|trading|trade|goods|merchandise|mall|outlet|ecommerce|e-commerce|wholesale|distributor|distribution|import|export|supplier|suppliers|vendor|procurement|purchase|products)\b/i,
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
  "food & dining": "Food & Beverage",
  "food and dining": "Food & Beverage",
  "dining": "Food & Beverage",
  "restaurants": "Food & Beverage",
  "groceries": "Food & Beverage",
  "transportation": "Transportation & Logistics",
  "transport": "Transportation & Logistics",
  "travel": "Travel & Tourism",
  "shopping & retail": "Retail & Shopping",
  "shopping": "Retail & Shopping",
  "retail": "Retail & Shopping",
  "banking & finance": "Finance & Banking",
  "banking and finance": "Finance & Banking",
  "atm & cash withdrawals": "Finance & Banking",
  "atm": "Finance & Banking",
  "cash withdrawals": "Finance & Banking",
  "finance": "Finance & Banking",
  "entertainment": "Entertainment & Media",
  "utilities & bills": "Utilities",
  "utilities and bills": "Utilities",
  "utilities": "Utilities",
  "bills": "Utilities",
  "subscriptions & digital services": "Technology",
  "subscriptions": "Technology",
  "digital services": "Technology",
  "technology": "Technology",
  "personal care": "Healthcare",
  "health & wellness": "Healthcare",
  "healthcare": "Healthcare",
  "medical": "Healthcare",
  "education": "Education",
  "other expenses": "Other",
  "miscellaneous": "Other",
  "general": "Other",
};

export function mapRawBankCategory(raw: string | null | undefined): string | null {
  if (!raw) return null;
  return RAW_CATEGORY_MAP[raw.toLowerCase().trim()] ?? null;
}
