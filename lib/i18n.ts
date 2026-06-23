export type ReviewIntelLocale = "en" | "fr" | "es" | "zh" | "de" | "hi";

export const DEFAULT_LOCALE: ReviewIntelLocale = "en";
export const LOCALE_STORAGE_KEY = "reviewintel:locale";
export const LOCALE_COOKIE_NAME = "reviewintel_locale";

export const SUPPORTED_LOCALES: Array<{
  code: ReviewIntelLocale;
  label: string;
  nativeLabel: string;
  status: "default" | "prepared";
}> = [
  { code: "en", label: "English", nativeLabel: "English", status: "default" },
  { code: "fr", label: "French", nativeLabel: "Français", status: "prepared" },
  { code: "es", label: "Spanish", nativeLabel: "Español", status: "prepared" },
  { code: "zh", label: "Chinese", nativeLabel: "简体中文", status: "prepared" },
  { code: "de", label: "German", nativeLabel: "Deutsch", status: "prepared" },
  { code: "hi", label: "Hindi", nativeLabel: "हिन्दी", status: "prepared" }
];

export type Dictionary = {
  language: string;
  chooseLanguage: string;
  productName: string;
  runAnalysis: string;
  shopperScore: string;
  sellerDashboard: string;
  manageSubscription: string;
};

export const dictionaries: Record<ReviewIntelLocale, Dictionary> = {
  en: {
    language: "Language",
    chooseLanguage: "Choose language",
    productName: "Product name",
    runAnalysis: "Run AI Analysis",
    shopperScore: "Shopper Score",
    sellerDashboard: "Seller Dashboard",
    manageSubscription: "Manage Subscription"
  },
  fr: {
    language: "Langue",
    chooseLanguage: "Choisir la langue",
    productName: "Nom du produit",
    runAnalysis: "Lancer l’analyse IA",
    shopperScore: "Score acheteur",
    sellerDashboard: "Tableau de bord vendeur",
    manageSubscription: "Gérer l’abonnement"
  },
  es: {
    language: "Idioma",
    chooseLanguage: "Elegir idioma",
    productName: "Nombre del producto",
    runAnalysis: "Ejecutar análisis con IA",
    shopperScore: "Puntuación del comprador",
    sellerDashboard: "Panel del vendedor",
    manageSubscription: "Administrar suscripción"
  },
  zh: {
    language: "语言",
    chooseLanguage: "选择语言",
    productName: "产品名称",
    runAnalysis: "运行 AI 分析",
    shopperScore: "购物者评分",
    sellerDashboard: "卖家控制面板",
    manageSubscription: "管理订阅"
  },
  de: {
    language: "Sprache",
    chooseLanguage: "Sprache auswählen",
    productName: "Produktname",
    runAnalysis: "KI-Analyse starten",
    shopperScore: "Käuferbewertung",
    sellerDashboard: "Verkäufer-Dashboard",
    manageSubscription: "Abonnement verwalten"
  },
  hi: {
    language: "भाषा",
    chooseLanguage: "भाषा चुनें",
    productName: "उत्पाद का नाम",
    runAnalysis: "AI विश्लेषण चलाएँ",
    shopperScore: "शॉपर स्कोर",
    sellerDashboard: "विक्रेता डैशबोर्ड",
    manageSubscription: "सदस्यता प्रबंधित करें"
  }
};

const uiSourcePhrases = [
  "Analyzer",
  "Compare",
  "Dashboard",
  "Pricing",
  "Advertise",
  "Reviews",
  "About",
  "Analyze",
  "Log in",
  "Log out",
  "Sign up",
  "Reset",
  "Continue",
  "Continue with Google",
  "Email",
  "Password",
  "New password",
  "Confirm new password",
  "Shopper Mode",
  "SHOPPER MODE",
  "Seller Mode",
  "SELLER MODE",
  "Shopper",
  "Seller",
  "Shopper Free",
  "Shopper Premium",
  "Seller Premium",
  "Seller Pro",
  "Owner access",
  "Admin",
  "Product name",
  "Product URL",
  "Category",
  "Optional",
  "Paste reviews",
  "Upload screenshots",
  "Run AI Analysis",
  "Reading reviews...",
  "Detecting fake review patterns...",
  "Finding complaints...",
  "Measuring sentiment...",
  "Preparing results...",
  "Buyer Verdict",
  "Shopper Score",
  "Buyer Confidence",
  "BUY",
  "MAYBE",
  "AVOID",
  "Fake Review Risk",
  "Value",
  "Value for Money",
  "Main Warning",
  "Best For",
  "Trust",
  "Product Reality",
  "Risk",
  "See why",
  "Back",
  "Low",
  "Medium",
  "High",
  "Great",
  "Fair",
  "Poor",
  "Worth it",
  "Be careful",
  "Looks risky",
  "Good value",
  "Too many complaints",
  "Reviews look natural",
  "Check durability",
  "Seller support risk",
  "Can I trust these reviews?",
  "Does it match the promise?",
  "What could go wrong?",
  "Seller Pro Trust Criteria",
  "Overall Trust Score",
  "Authenticity",
  "Reliability",
  "Customer Care",
  "Conversion Blocker",
  "Revenue Opportunity",
  "Buyer Trust Gap",
  "Top Complaint Share",
  "Repeat Praise Signal",
  "Support Risk",
  "Listing Priority",
  "Seller Action",
  "Business impact",
  "Money Opportunity",
  "Buyer Psychology",
  "Top 3 Actions Next",
  "Listing Improvements",
  "Customer Satisfaction",
  "Complaint Pressure",
  "Product Strengths",
  "Complaint Clusters",
  "Feature Requests",
  "Product Positioning",
  "What to fix",
  "What to advertise",
  "What to stop promising",
  "Terms",
  "Privacy",
  "Disclaimer",
  "Refunds",
  "Cookies",
  "FAQ",
  "Contact",
  "Manage Subscription",
  "Billing Support",
  "Account Support",
  "Delete Account",
  "Customer Service",
  "Email Us",
  "Product",
  "Support",
  "SEO Pages",
  "Language",
  "Choose language",
  "Account Profile",
  "Identity, address, and account details",
  "Password and access",
  "Display name",
  "Profile ID",
  "Company / store",
  "Phone",
  "Address line 1",
  "Address line 2",
  "City",
  "State / Province",
  "Country",
  "Save profile",
  "Saved analysis history",
  "Run a real analysis to see ReviewIntel results.",
  "Test another product",
  "Compare products",
  "Unlock unlimited scans",
  "Not enough review data",
  "Small sample size",
  "Directional signal only",
  "More reviews needed for higher confidence"
] as const;

type UiPhrase = (typeof uiSourcePhrases)[number];

type UiTranslationMap = Partial<Record<UiPhrase, string>>;

const phraseTranslations: Partial<Record<ReviewIntelLocale, UiTranslationMap>> = {
  fr: {
    Analyzer: "Analyseur",
    Compare: "Comparer",
    Dashboard: "Tableau de bord",
    Pricing: "Tarifs",
    Advertise: "Publicité",
    Reviews: "Avis",
    About: "À propos",
    Analyze: "Analyser",
    "Log in": "Connexion",
    "Log out": "Déconnexion",
    "Sign up": "Inscription",
    Reset: "Réinitialiser",
    Continue: "Continuer",
    "Continue with Google": "Continuer avec Google",
    Email: "E-mail",
    Password: "Mot de passe",
    "New password": "Nouveau mot de passe",
    "Confirm new password": "Confirmer le mot de passe",
    "Shopper Mode": "Mode acheteur",
    "SHOPPER MODE": "MODE ACHETEUR",
    "Seller Mode": "Mode vendeur",
    "SELLER MODE": "MODE VENDEUR",
    Shopper: "Acheteur",
    Seller: "Vendeur",
    "Shopper Free": "Acheteur gratuit",
    "Shopper Premium": "Acheteur Premium",
    "Seller Premium": "Vendeur Premium",
    "Seller Pro": "Vendeur Pro",
    "Owner access": "Accès propriétaire",
    Product: "Produit",
    Support: "Assistance",
    "SEO Pages": "Pages SEO",
    Admin: "Admin",
    "Product name": "Nom du produit",
    "Product URL": "URL du produit",
    Category: "Catégorie",
    Optional: "Facultatif",
    "Paste reviews": "Coller les avis",
    "Upload screenshots": "Téléverser des captures",
    "Run AI Analysis": "Lancer l’analyse IA",
    "Reading reviews...": "Lecture des avis...",
    "Detecting fake review patterns...": "Détection des faux avis...",
    "Finding complaints...": "Recherche des plaintes...",
    "Measuring sentiment...": "Mesure du sentiment...",
    "Preparing results...": "Préparation des résultats...",
    "Buyer Verdict": "Verdict acheteur",
    "Shopper Score": "Score acheteur",
    "Buyer Confidence": "Confiance acheteur",
    BUY: "ACHETER",
    MAYBE: "PEUT-ÊTRE",
    AVOID: "ÉVITER",
    "Fake Review Risk": "Risque de faux avis",
    Value: "Valeur",
    "Value for Money": "Rapport qualité-prix",
    "Main Warning": "Alerte principale",
    "Best For": "Idéal pour",
    Trust: "Confiance",
    "Product Reality": "Réalité du produit",
    Risk: "Risque",
    "See why": "Voir pourquoi",
    Back: "Retour",
    Low: "Faible",
    Medium: "Moyen",
    High: "Élevé",
    Great: "Excellent",
    Fair: "Correct",
    Poor: "Faible",
    "Worth it": "Ça vaut le coup",
    "Be careful": "Soyez prudent",
    "Looks risky": "Semble risqué",
    "Good value": "Bon rapport qualité-prix",
    "Too many complaints": "Trop de plaintes",
    "Reviews look natural": "Les avis semblent naturels",
    "Check durability": "Vérifiez la durabilité",
    "Seller support risk": "Risque d’assistance vendeur",
    "Can I trust these reviews?": "Puis-je faire confiance à ces avis ?",
    "Does it match the promise?": "Le produit tient-il sa promesse ?",
    "What could go wrong?": "Qu’est-ce qui peut mal tourner ?",
    "Seller Pro Trust Criteria": "Critères de confiance Vendeur Pro",
    "Overall Trust Score": "Score global de confiance",
    Authenticity: "Authenticité",
    Reliability: "Fiabilité",
    "Customer Care": "Service client",
    "Conversion Blocker": "Frein à la conversion",
    "Revenue Opportunity": "Opportunité de revenus",
    "Buyer Trust Gap": "Écart de confiance acheteur",
    "Top Complaint Share": "Part de la plainte principale",
    "Repeat Praise Signal": "Signal d’éloges répétés",
    "Support Risk": "Risque d’assistance",
    "Listing Priority": "Priorité de fiche produit",
    "Seller Action": "Action vendeur",
    "Business impact": "Impact commercial",
    "Money Opportunity": "Opportunité commerciale",
    "Buyer Psychology": "Psychologie acheteur",
    "Top 3 Actions Next": "3 prochaines actions",
    "Listing Improvements": "Améliorations de fiche",
    "Customer Satisfaction": "Satisfaction client",
    "Complaint Pressure": "Pression des plaintes",
    "Product Strengths": "Forces du produit",
    "Complaint Clusters": "Groupes de plaintes",
    "Feature Requests": "Demandes de fonctionnalités",
    "Product Positioning": "Positionnement produit",
    "What to fix": "À corriger",
    "What to advertise": "À mettre en avant",
    "What to stop promising": "À ne plus promettre",
    Terms: "Conditions",
    Privacy: "Confidentialité",
    Disclaimer: "Avertissement",
    Refunds: "Remboursements",
    Cookies: "Cookies",
    FAQ: "FAQ",
    Contact: "Contact",
    "Manage Subscription": "Gérer l’abonnement",
    "Billing Support": "Assistance facturation",
    "Account Support": "Assistance compte",
    "Delete Account": "Supprimer le compte",
    "Customer Service": "Service client",
    "Email Us": "Nous écrire",
    Language: "Langue",
    "Choose language": "Choisir la langue",
    "Account Profile": "Profil du compte",
    "Identity, address, and account details": "Identité, adresse et détails du compte",
    "Password and access": "Mot de passe et accès",
    "Display name": "Nom affiché",
    "Profile ID": "ID de profil",
    "Company / store": "Entreprise / boutique",
    Phone: "Téléphone",
    "Address line 1": "Adresse ligne 1",
    "Address line 2": "Adresse ligne 2",
    City: "Ville",
    "State / Province": "État / Province",
    Country: "Pays",
    "Save profile": "Enregistrer le profil",
    "Saved analysis history": "Historique des analyses",
    "Run a real analysis to see ReviewIntel results.": "Lancez une vraie analyse pour voir les résultats ReviewIntel.",
    "Test another product": "Tester un autre produit",
    "Compare products": "Comparer les produits",
    "Unlock unlimited scans": "Débloquer les analyses illimitées",
    "Not enough review data": "Pas assez de données d’avis",
    "Small sample size": "Petit échantillon",
    "Directional signal only": "Signal indicatif seulement",
    "More reviews needed for higher confidence": "Plus d’avis sont nécessaires pour une meilleure confiance"
  },
  es: {
    Analyzer: "Analizador",
    Compare: "Comparar",
    Dashboard: "Panel",
    Pricing: "Precios",
    Advertise: "Anunciar",
    Reviews: "Reseñas",
    About: "Acerca de",
    Analyze: "Analizar",
    "Log in": "Iniciar sesión",
    "Log out": "Cerrar sesión",
    "Sign up": "Registrarse",
    Reset: "Restablecer",
    Continue: "Continuar",
    "Continue with Google": "Continuar con Google",
    Email: "Correo",
    Password: "Contraseña",
    "New password": "Nueva contraseña",
    "Confirm new password": "Confirmar contraseña",
    "Shopper Mode": "Modo comprador",
    "SHOPPER MODE": "MODO COMPRADOR",
    "Seller Mode": "Modo vendedor",
    "SELLER MODE": "MODO VENDEDOR",
    Shopper: "Comprador",
    Seller: "Vendedor",
    "Shopper Free": "Comprador gratis",
    "Shopper Premium": "Comprador Premium",
    "Seller Premium": "Vendedor Premium",
    "Seller Pro": "Vendedor Pro",
    Product: "Producto",
    Support: "Soporte",
    "SEO Pages": "Páginas SEO",
    Admin: "Admin",
    "Product name": "Nombre del producto",
    "Product URL": "URL del producto",
    Category: "Categoría",
    Optional: "Opcional",
    "Paste reviews": "Pegar reseñas",
    "Upload screenshots": "Subir capturas",
    "Run AI Analysis": "Ejecutar análisis IA",
    "Reading reviews...": "Leyendo reseñas...",
    "Detecting fake review patterns...": "Detectando patrones falsos...",
    "Finding complaints...": "Buscando quejas...",
    "Measuring sentiment...": "Midiendo sentimiento...",
    "Preparing results...": "Preparando resultados...",
    "Buyer Verdict": "Veredicto de compra",
    "Shopper Score": "Puntuación del comprador",
    "Buyer Confidence": "Confianza del comprador",
    BUY: "COMPRAR",
    MAYBE: "TAL VEZ",
    AVOID: "EVITAR",
    "Fake Review Risk": "Riesgo de reseñas falsas",
    Value: "Valor",
    "Value for Money": "Relación calidad-precio",
    "Main Warning": "Advertencia principal",
    "Best For": "Ideal para",
    Trust: "Confianza",
    "Product Reality": "Realidad del producto",
    Risk: "Riesgo",
    "See why": "Ver por qué",
    Back: "Atrás",
    Low: "Bajo",
    Medium: "Medio",
    High: "Alto",
    Great: "Excelente",
    Fair: "Aceptable",
    Poor: "Débil",
    "Worth it": "Vale la pena",
    "Be careful": "Ten cuidado",
    "Looks risky": "Parece arriesgado",
    "Good value": "Buen valor",
    "Too many complaints": "Demasiadas quejas",
    "Reviews look natural": "Las reseñas parecen naturales",
    "Check durability": "Revisa durabilidad",
    "Seller support risk": "Riesgo de soporte del vendedor",
    "Can I trust these reviews?": "¿Puedo confiar en estas reseñas?",
    "Does it match the promise?": "¿Cumple lo prometido?",
    "What could go wrong?": "¿Qué podría salir mal?",
    "Overall Trust Score": "Puntuación de confianza",
    Authenticity: "Autenticidad",
    Reliability: "Fiabilidad",
    "Customer Care": "Atención al cliente",
    "Conversion Blocker": "Bloqueo de conversión",
    "Revenue Opportunity": "Oportunidad de ingresos",
    "Buyer Trust Gap": "Brecha de confianza",
    "Seller Action": "Acción del vendedor",
    "Business impact": "Impacto comercial",
    Terms: "Términos",
    Privacy: "Privacidad",
    Disclaimer: "Aviso legal",
    Refunds: "Reembolsos",
    FAQ: "FAQ",
    Contact: "Contacto",
    "Manage Subscription": "Gestionar suscripción",
    "Customer Service": "Atención al cliente",
    "Email Us": "Escríbenos",
    Language: "Idioma",
    "Choose language": "Elegir idioma",
    "Run a real analysis to see ReviewIntel results.": "Ejecuta un análisis real para ver los resultados de ReviewIntel.",
    "Test another product": "Probar otro producto",
    "Compare products": "Comparar productos",
    "Unlock unlimited scans": "Desbloquear análisis ilimitados"
  },
  zh: {
    Analyzer: "分析器",
    Compare: "比较",
    Dashboard: "仪表板",
    Pricing: "价格",
    Advertise: "广告",
    Reviews: "评价",
    About: "关于",
    Analyze: "分析",
    "Log in": "登录",
    "Log out": "退出",
    "Sign up": "注册",
    Reset: "重置",
    Continue: "继续",
    "Continue with Google": "使用 Google 继续",
    Email: "电子邮件",
    Password: "密码",
    "Shopper Mode": "购物者模式",
    "SHOPPER MODE": "购物者模式",
    "Seller Mode": "卖家模式",
    "SELLER MODE": "卖家模式",
    Shopper: "购物者",
    Seller: "卖家",
    "Shopper Free": "免费购物者",
    "Shopper Premium": "高级购物者",
    "Seller Premium": "高级卖家",
    "Seller Pro": "专业卖家",
    Product: "产品",
    Support: "支持",
    Admin: "管理员",
    "Product name": "产品名称",
    "Product URL": "产品链接",
    Category: "类别",
    Optional: "可选",
    "Paste reviews": "粘贴评价",
    "Upload screenshots": "上传截图",
    "Run AI Analysis": "运行 AI 分析",
    "Reading reviews...": "正在读取评价...",
    "Detecting fake review patterns...": "正在检测虚假评价模式...",
    "Finding complaints...": "正在查找投诉...",
    "Measuring sentiment...": "正在衡量情绪...",
    "Preparing results...": "正在准备结果...",
    "Buyer Verdict": "购买结论",
    "Shopper Score": "购物者评分",
    BUY: "购买",
    MAYBE: "再比较",
    AVOID: "避免",
    "Fake Review Risk": "虚假评价风险",
    Value: "价值",
    "Main Warning": "主要提醒",
    "Best For": "最适合",
    Trust: "信任",
    "Product Reality": "产品真实度",
    Risk: "风险",
    "See why": "查看原因",
    Back: "返回",
    Low: "低",
    Medium: "中",
    High: "高",
    Great: "很好",
    Fair: "一般",
    Poor: "较差",
    "Can I trust these reviews?": "这些评价可信吗？",
    "Does it match the promise?": "产品是否符合承诺？",
    "What could go wrong?": "可能出现什么问题？",
    "Overall Trust Score": "总体信任分",
    Authenticity: "真实性",
    Reliability: "可靠性",
    "Customer Care": "客户服务",
    "Seller Action": "卖家行动",
    "Business impact": "业务影响",
    Terms: "条款",
    Privacy: "隐私",
    Disclaimer: "免责声明",
    Refunds: "退款",
    FAQ: "常见问题",
    Contact: "联系",
    "Manage Subscription": "管理订阅",
    "Customer Service": "客户服务",
    "Email Us": "发送邮件",
    Language: "语言",
    "Choose language": "选择语言"
  },
  de: {
    Analyzer: "Analysator",
    Compare: "Vergleichen",
    Dashboard: "Dashboard",
    Pricing: "Preise",
    Advertise: "Werben",
    Reviews: "Bewertungen",
    About: "Über uns",
    Analyze: "Analysieren",
    "Log in": "Anmelden",
    "Log out": "Abmelden",
    "Sign up": "Registrieren",
    Reset: "Zurücksetzen",
    Continue: "Weiter",
    "Continue with Google": "Mit Google fortfahren",
    Email: "E-Mail",
    Password: "Passwort",
    "Shopper Mode": "Shopper-Modus",
    "SHOPPER MODE": "SHOPPER-MODUS",
    "Seller Mode": "Verkäufermodus",
    "SELLER MODE": "VERKÄUFERMODUS",
    Shopper: "Shopper",
    Seller: "Verkäufer",
    "Shopper Free": "Shopper Kostenlos",
    "Shopper Premium": "Shopper Premium",
    "Seller Premium": "Verkäufer Premium",
    "Seller Pro": "Verkäufer Pro",
    Product: "Produkt",
    Support: "Support",
    Admin: "Admin",
    "Product name": "Produktname",
    "Product URL": "Produkt-URL",
    Category: "Kategorie",
    Optional: "Optional",
    "Paste reviews": "Bewertungen einfügen",
    "Upload screenshots": "Screenshots hochladen",
    "Run AI Analysis": "KI-Analyse starten",
    "Buyer Verdict": "Kaufurteil",
    "Shopper Score": "Shopper-Score",
    BUY: "KAUFEN",
    MAYBE: "VIELLEICHT",
    AVOID: "MEIDEN",
    "Fake Review Risk": "Risiko falscher Bewertungen",
    Value: "Wert",
    "Main Warning": "Hauptwarnung",
    "Best For": "Am besten für",
    Trust: "Vertrauen",
    "Product Reality": "Produktrealität",
    Risk: "Risiko",
    "See why": "Warum ansehen",
    Back: "Zurück",
    Low: "Niedrig",
    Medium: "Mittel",
    High: "Hoch",
    Great: "Sehr gut",
    Fair: "Okay",
    Poor: "Schwach",
    "Can I trust these reviews?": "Kann ich diesen Bewertungen vertrauen?",
    "Does it match the promise?": "Hält das Produkt sein Versprechen?",
    "What could go wrong?": "Was könnte schiefgehen?",
    "Overall Trust Score": "Gesamt-Vertrauenswert",
    Authenticity: "Authentizität",
    Reliability: "Zuverlässigkeit",
    "Customer Care": "Kundenservice",
    "Seller Action": "Verkäuferaktion",
    "Business impact": "Geschäftsauswirkung",
    Terms: "Bedingungen",
    Privacy: "Datenschutz",
    Disclaimer: "Haftungsausschluss",
    Refunds: "Rückerstattungen",
    FAQ: "FAQ",
    Contact: "Kontakt",
    "Manage Subscription": "Abo verwalten",
    "Customer Service": "Kundenservice",
    "Email Us": "E-Mail senden",
    Language: "Sprache",
    "Choose language": "Sprache auswählen"
  },
  hi: {
    Analyzer: "विश्लेषक",
    Compare: "तुलना",
    Dashboard: "डैशबोर्ड",
    Pricing: "मूल्य",
    Advertise: "विज्ञापन",
    Reviews: "समीक्षाएँ",
    About: "परिचय",
    Analyze: "विश्लेषण",
    "Log in": "लॉग इन",
    "Log out": "लॉग आउट",
    "Sign up": "साइन अप",
    Reset: "रीसेट",
    Continue: "जारी रखें",
    "Continue with Google": "Google से जारी रखें",
    Email: "ईमेल",
    Password: "पासवर्ड",
    "Shopper Mode": "शॉपर मोड",
    "SHOPPER MODE": "शॉपर मोड",
    "Seller Mode": "विक्रेता मोड",
    "SELLER MODE": "विक्रेता मोड",
    Shopper: "शॉपर",
    Seller: "विक्रेता",
    "Shopper Free": "शॉपर फ्री",
    "Shopper Premium": "शॉपर प्रीमियम",
    "Seller Premium": "विक्रेता प्रीमियम",
    "Seller Pro": "विक्रेता प्रो",
    Product: "उत्पाद",
    Support: "सहायता",
    Admin: "एडमिन",
    "Product name": "उत्पाद का नाम",
    "Product URL": "उत्पाद URL",
    Category: "श्रेणी",
    Optional: "वैकल्पिक",
    "Paste reviews": "समीक्षाएँ पेस्ट करें",
    "Upload screenshots": "स्क्रीनशॉट अपलोड करें",
    "Run AI Analysis": "AI विश्लेषण चलाएँ",
    "Buyer Verdict": "खरीद निर्णय",
    "Shopper Score": "शॉपर स्कोर",
    BUY: "खरीदें",
    MAYBE: "शायद",
    AVOID: "बचें",
    "Fake Review Risk": "फर्जी समीक्षा जोखिम",
    Value: "मूल्य",
    "Main Warning": "मुख्य चेतावनी",
    "Best For": "सबसे अच्छा",
    Trust: "भरोसा",
    "Product Reality": "उत्पाद वास्तविकता",
    Risk: "जोखिम",
    "See why": "कारण देखें",
    Back: "वापस",
    Low: "कम",
    Medium: "मध्यम",
    High: "उच्च",
    Great: "बेहतरीन",
    Fair: "ठीक",
    Poor: "कमज़ोर",
    "Can I trust these reviews?": "क्या इन समीक्षाओं पर भरोसा कर सकता हूँ?",
    "Does it match the promise?": "क्या यह वादा पूरा करता है?",
    "What could go wrong?": "क्या गलत हो सकता है?",
    "Overall Trust Score": "कुल भरोसा स्कोर",
    Authenticity: "प्रामाणिकता",
    Reliability: "विश्वसनीयता",
    "Customer Care": "ग्राहक सेवा",
    "Seller Action": "विक्रेता कार्रवाई",
    "Business impact": "व्यावसायिक प्रभाव",
    Terms: "शर्तें",
    Privacy: "गोपनीयता",
    Disclaimer: "अस्वीकरण",
    Refunds: "रिफंड",
    FAQ: "FAQ",
    Contact: "संपर्क",
    "Manage Subscription": "सदस्यता प्रबंधित करें",
    "Customer Service": "ग्राहक सेवा",
    "Email Us": "हमें ईमेल करें",
    Language: "भाषा",
    "Choose language": "भाषा चुनें"
  }
};

const extraPhraseTranslations = {
  fr: {
    Login: "Connexion",
    Results: "Résultats",
    Account: "Compte",
    Scan: "Analyser",
    Avoid: "Éviter",
    "← Back": "← Retour",
    "Seller Dashboard": "Tableau de bord vendeur",
    "Shopper Dashboard": "Tableau de bord acheteur",
    Name: "Nom",
    "Profile type": "Type de profil",
    "Seller / business": "Vendeur / entreprise",
    "Create account": "Créer un compte",
    "Send reset email": "Envoyer l’e-mail de réinitialisation",
    "Email verification": "Vérification de l’e-mail",
    "Password reset": "Réinitialisation du mot de passe",
    "Secure account": "Compte sécurisé",
    "Create your ReviewIntel account": "Créer votre compte ReviewIntel",
    "Reset your password": "Réinitialiser votre mot de passe",
    "Log in to ReviewIntel": "Connectez-vous à ReviewIntel",
    "Log in with your ReviewIntel account, or create a new Shopper or Seller account to start scanning reviews.":
      "Connectez-vous à votre compte ReviewIntel, ou créez un nouveau compte acheteur ou vendeur pour commencer à analyser les avis.",
    "Enter a valid email to continue.": "Entrez une adresse e-mail valide pour continuer.",
    "Use at least 8 characters for production-ready password rules.":
      "Utilisez au moins 8 caractères pour un mot de passe prêt pour la production.",
    "Authentication request failed.": "La demande d’authentification a échoué.",
    "Password reset request accepted. Check your email when Supabase Auth is connected.":
      "Demande de réinitialisation acceptée. Vérifiez votre e-mail lorsque Supabase Auth est connecté.",
    "Login did not return an account. Please sign up first or check your email/password.":
      "La connexion n’a pas retourné de compte. Inscrivez-vous d’abord ou vérifiez votre e-mail et votre mot de passe.",
    "Google login failed.": "La connexion Google a échoué.",
    "Google login is ready once Supabase Auth environment variables are configured.":
      "La connexion Google sera prête lorsque les variables d’environnement Supabase Auth seront configurées.",
    "Marketplace intelligence": "Intelligence marketplace",
    "All reviews. One AI scan. Clear buying answers.": "Tous les avis. Une analyse IA. Des réponses d’achat claires.",
    "Scan Reviews Now": "Analyser les avis maintenant",
    "See Example Result": "Voir un exemple de résultat",
    "Live AI scan": "Analyse IA en direct",
    "Review score": "Score des avis",
    "Worth buying with durability caution": "Vaut l’achat avec prudence sur la durabilité",
    "AI verdict": "Verdict IA",
    "Good product. Check repeated risks first.": "Bon produit. Vérifiez d’abord les risques répétés.",
    "Buyers like speed and cleanup. Watch lid leaks and motor life.":
      "Les acheteurs aiment la rapidité et le nettoyage. Surveillez les fuites de couvercle et la durée du moteur.",
    "Shopper answer": "Réponse acheteur",
    "Best for casual use — not heavy daily use.": "Idéal pour un usage occasionnel — pas pour un usage intensif quotidien.",
    "Complaint heat": "Intensité des plaintes",
    "Moderate risk": "Risque modéré",
    "Seller insight": "Info vendeur",
    "Seller insight: clarify warranty and replacement support.": "Info vendeur : clarifier la garantie et l’aide au remplacement.",
    "Review signal": "Signal des avis",
    "AI extracts risk + buyer signal": "L’IA extrait le risque et le signal acheteur",
    "AI scan core": "Noyau d’analyse IA",
    Marketplace: "Marketplace",
    Retail: "Commerce de détail",
    "Social commerce": "Commerce social",
    Storefront: "Boutique en ligne",
    Handmade: "Fait main",
    Resale: "Revente",
    Electronics: "Électronique",
    "Screenshot-worthy payoff": "Résultat digne d’une capture",
    "The result should feel like opening a prize box.": "Le résultat doit donner l’impression d’ouvrir une boîte surprise.",
    "Shoppers get the answer without reading a report. Sellers get a separate command view built for decisions, not shopping.":
      "Les acheteurs obtiennent la réponse sans lire un rapport. Les vendeurs obtiennent une vue de pilotage séparée pour décider, pas pour acheter.",
    "Try Shopper Scan": "Essayer l’analyse acheteur",
    "See Seller Plans": "Voir les forfaits vendeur",
    "Free account required": "Compte gratuit requis",
    "Create a free account before scanning reviews.": "Créez un compte gratuit avant d’analyser les avis.",
    "ReviewIntel keeps free scans attached to an account so usage, results, and saved history stay private and separated.":
      "ReviewIntel rattache les analyses gratuites à un compte afin que l’utilisation, les résultats et l’historique restent privés et séparés.",
    "Create free account": "Créer un compte gratuit",
    "How scanning works": "Comment fonctionne l’analyse",
    "Paste reviews inside Analyzer": "Collez les avis dans l’analyseur",
    "Run AI scan": "Lancer l’analyse IA",
    "Save result to your account": "Enregistrer le résultat dans votre compte",
    "AI review scanner": "Analyseur d’avis IA",
    "Paste reviews. Get the buying answer.": "Collez les avis. Obtenez la réponse d’achat.",
    "ReviewIntel turns messy customer reviews into a score, verdict, fake-risk read, value call, and top complaint.":
      "ReviewIntel transforme des avis clients désordonnés en score, verdict, lecture du risque de faux avis, évaluation de valeur et plainte principale.",
    "Overall score": "Score global",
    "Shared score": "Score partagé",
    Buy: "Acheter",
    "Worth buying": "Vaut l’achat",
    "Fast verdict": "Verdict rapide",
    "Fake risk": "Risque de faux avis",
    "Pattern check": "Vérification des tendances",
    "Money call": "Décision de valeur",
    "Shopper quick answer": "Réponse rapide acheteur",
    "Best for: students, office work, travel. Top complaint: battery life.":
      "Idéal pour : étudiants, bureau, voyages. Principale plainte : autonomie de la batterie.",
    "Shopper recommendation": "Recommandation acheteur",
    "Seller analytics": "Analyses vendeur",
    "Shopper + seller intelligence": "Intelligence acheteur + vendeur",
    "Open reviews": "Ouvrir les avis",
    "Go to Amazon, Walmart, Temu, TikTok Shop, Etsy, or any product page.":
      "Allez sur Amazon, Walmart, Temu, TikTok Shop, Etsy ou toute page produit.",
    "Copy review text": "Copier le texte des avis",
    "Copy the customer reviews, good and bad. More reviews means stronger confidence.":
      "Copiez les avis clients, positifs et négatifs. Plus il y a d’avis, plus la confiance est forte.",
    "Paste here": "Coller ici",
    "Drop the text into Deep Analysis, or upload screenshots for Quick Scan.":
      "Déposez le texte dans l’analyse approfondie, ou téléversez des captures pour l’analyse rapide.",
    "Instant shopper answer": "Réponse acheteur instantanée",
    "Fast verdict, product score, fake-risk read, pros, cons, and value call.":
      "Verdict rapide, score produit, risque de faux avis, avantages, inconvénients et décision de valeur.",
    "Deep customer intelligence": "Intelligence client approfondie",
    "Complaint mining, keyword signals, product gaps, and operational next moves.":
      "Extraction des plaintes, signaux de mots-clés, lacunes produit et prochaines actions opérationnelles.",
    "Dual Mode": "Mode double",
    "Dual output preview": "Aperçu de sortie double",
    "Preview shopper verdict and seller intelligence from the same review set.":
      "Prévisualisez le verdict acheteur et l’intelligence vendeur à partir du même lot d’avis.",
    Verdict: "Verdict",
    Strategy: "Stratégie",
    Report: "Rapport",
    "Seller Pro intelligence": "Intelligence Vendeur Pro",
    "Shopper + Seller report": "Rapport acheteur + vendeur",
    "Shopper verdict": "Verdict acheteur",
    "Create a free account to scan.": "Créez un compte gratuit pour analyser.",
    "Ready to scan this review set.": "Prêt à analyser ce lot d’avis.",
    "Sign up or log in to scan": "Inscrivez-vous ou connectez-vous pour analyser",
    "Scanning...": "Analyse en cours...",
    "Free scans are saved to your account so your usage and results stay private.":
      "Les analyses gratuites sont enregistrées dans votre compte afin que votre utilisation et vos résultats restent privés.",
    "ReviewIntel scan": "Analyse ReviewIntel",
    "Analyzing review intelligence": "Analyse de l’intelligence des avis",
    "Preparing a clean result page. Please keep this tab open.":
      "Préparation d’une page de résultats claire. Gardez cet onglet ouvert.",
    "Free scan requires account": "L’analyse gratuite exige un compte",
    "Create a free account before you paste reviews.": "Créez un compte gratuit avant de coller des avis.",
    "This keeps usage, saved results, and privacy attached to your own workspace before analysis starts.":
      "Cela garde l’utilisation, les résultats enregistrés et la confidentialité liés à votre propre espace avant le début de l’analyse.",
    "Choose the result you want": "Choisissez le résultat souhaité",
    "Shopper answer or seller intelligence.": "Réponse acheteur ou intelligence vendeur.",
    "Analysis mode switcher": "Sélecteur de mode d’analyse",
    "Test Shopper, Seller, or Dual output.": "Testez la sortie Acheteur, Vendeur ou Double.",
    "Locked workspace": "Espace verrouillé",
    "Product or business name": "Nom du produit ou de l’entreprise",
    "Review platform": "Plateforme d’avis",
    "Optional reference": "Référence facultative",
    "Deep Analysis": "Analyse approfondie",
    "Paste reviews for the strongest shopper verdict.": "Collez les avis pour obtenir le verdict acheteur le plus fiable.",
    "Load review batches for seller intelligence.": "Chargez des lots d’avis pour l’intelligence vendeur.",
    "Paste a compact review batch here.": "Collez ici un lot d’avis compact.",
    "Paste seller review exports here, or upload CSV/TXT.": "Collez ici les exports d’avis vendeur, ou téléversez un CSV/TXT.",
    "Quick Scan Beta": "Analyse rapide bêta",
    "Drop screenshots for a fast check.": "Déposez des captures pour une vérification rapide.",
    "Use this for a few mobile screenshots. Use Deep Analysis for real volume.":
      "Utilisez ceci pour quelques captures mobiles. Utilisez l’analyse approfondie pour un vrai volume.",
    "Stitch multiple screenshots into one OCR batch.": "Assembler plusieurs captures en un lot OCR.",
    "Run Screenshot Analysis": "Analyser les captures",
    "Product Health Tracker": "Suivi de santé produit",
    "Attach this Seller scan.": "Associer cette analyse vendeur.",
    "Do not attach": "Ne pas associer",
    "Upgrade unlock": "Déblocage avec mise à niveau",
    "Free scans are used.": "Les analyses gratuites sont utilisées.",
    "You are almost at the free limit.": "Vous approchez de la limite gratuite.",
    "Unlimited product analyses": "Analyses produit illimitées",
    "Saved history and comparisons": "Historique et comparaisons enregistrés",
    "Seller intelligence and exports": "Intelligence vendeur et exports",
    "Concrete steps": "Étapes concrètes",
    "Copy, paste, scan.": "Copiez, collez, analysez.",
    Screenshots: "Captures d’écran",
    "Fast shopper verdict": "Verdict acheteur rapide",
    "Mobile friendly": "Adapté au mobile",
    "Use Quick Scan": "Utiliser l’analyse rapide",
    "Paste reviews or upload CSV/TXT": "Coller des avis ou téléverser CSV/TXT",
    "Strongest confidence": "Confiance maximale",
    "Cleaner verdict": "Verdict plus clair",
    "CSV/TXT batches": "Lots CSV/TXT",
    "Valid unique reviews": "Avis uniques valides",
    "Use Deep Analysis": "Utiliser l’analyse approfondie",
    "Analysis readiness": "Préparation de l’analyse",
    "No scan loaded": "Aucune analyse chargée",
    "Public sample results have been removed from the customer experience. Paste reviews or upload a CSV/TXT file to generate a fresh result.":
      "Les exemples publics ont été retirés de l’expérience client. Collez des avis ou téléversez un fichier CSV/TXT pour générer un nouveau résultat.",
    "Your latest scan": "Votre dernière analyse",
    "Run another scan": "Lancer une autre analyse",
    "Seller Premium intelligence": "Intelligence Vendeur Premium",
    "Rating breakdown": "Répartition des notes",
    "No rating metadata detected in the pasted sample.": "Aucune donnée de note détectée dans l’échantillon collé.",
    Excellent: "Excellent",
    Strong: "Fort",
    Watch: "À surveiller",
    Concern: "Préoccupation",
    Critical: "Critique",
    "Immediate fix": "Correction immédiate",
    "High priority": "Haute priorité",
    "Monitor closely": "Surveiller de près",
    Maintain: "Maintenir",
    "Seller Pro magic moment": "Moment clé Vendeur Pro",
    "Seller Premium insight": "Info Vendeur Premium",
    "Turn review pain into product revenue moves.": "Transformez les irritants d’avis en actions de revenus produit.",
    "Most expensive complaint": "Plainte la plus coûteuse",
    "Fix first": "Corriger d’abord",
    "Product move": "Action produit",
    Operations: "Opérations",
    "Listing move": "Action fiche produit",
    Conversion: "Conversion",
    Weak: "Faible",
    "Risk level": "Niveau de risque",
    "Why this score": "Pourquoi ce score",
    "Check before buying:": "À vérifier avant l’achat :",
    "Avoid if:": "Éviter si :",
    "Before you buy": "Avant d’acheter",
    "What to check before checkout": "À vérifier avant le paiement",
    "Seller growth diagnosis": "Diagnostic de croissance vendeur",
    "Turn buyer feedback into the next product, listing, and trust move.":
      "Transformez les retours acheteurs en prochaine action produit, fiche et confiance.",
    "Reviews mined": "Avis analysés",
    Satisfaction: "Satisfaction",
    Opportunity: "Opportunité",
    "Customer satisfaction": "Satisfaction client",
    "Complaint load": "Charge des plaintes",
    "Improvement upside": "Potentiel d’amélioration",
    "Evidence quality": "Qualité des preuves",
    "Seller growth moves": "Actions de croissance vendeur",
    "Fix first, advertise better, and stop overpromising.": "Corrigez d’abord, annoncez mieux et cessez de trop promettre.",
    "Advertise this": "Mettre ceci en avant",
    "Stop promising this": "Ne plus promettre ceci",
    "Seller intelligence map": "Carte d’intelligence vendeur",
    "Buyer confidence graph": "Graphique de confiance acheteur",
    "See the strongest risks and growth signals in one place": "Voir les principaux risques et signaux de croissance au même endroit",
    "Refund safety": "Sécurité des remboursements",
    "Packaging confidence": "Confiance emballage",
    "Support confidence": "Confiance support",
    "Feature demand": "Demande de fonctionnalités",
    "Positive positioning": "Positionnement positif",
    "Review evidence quality": "Qualité des preuves d’avis",
    "What this means": "Ce que cela signifie",
    "Words buyers keep using": "Mots souvent utilisés par les acheteurs",
    "Rating background": "Contexte des notes",
    Workspace: "Espace de travail",
    "Shopper Workspace": "Espace acheteur",
    "Seller Workspace": "Espace vendeur",
    "Shopper Home": "Accueil acheteur",
    "Seller Home": "Accueil vendeur",
    "Paste Reviews": "Coller les avis",
    "Compare Products": "Comparer les produits",
    "Competitor Compare": "Comparer les concurrents",
    Billing: "Facturation",
    "Business intelligence": "Intelligence commerciale",
    "Shopping assistant": "Assistant d’achat",
    "Seller tools stay separate from shopper purchase decisions.": "Les outils vendeur restent séparés des décisions d’achat.",
    "Shopper tools stay simple and recommendation-focused.": "Les outils acheteur restent simples et centrés sur la recommandation.",
    "Manage subscription": "Gérer l’abonnement",
    "Billing support": "Assistance facturation",
    "Trend snapshot": "Aperçu de tendance",
    "Shopper dashboard": "Tableau de bord acheteur",
    "Your saved product checks, buying verdicts, fake-review warnings, and best finds in one clean view.":
      "Vos vérifications produit, verdicts d’achat, alertes de faux avis et meilleures trouvailles dans une vue claire.",
    "Shopping intelligence": "Intelligence d’achat",
    "Know what to buy, compare, or avoid.": "Sachez quoi acheter, comparer ou éviter.",
    "This dashboard keeps your scanned products organized so you do not have to reread reviews again before checkout.":
      "Ce tableau garde vos produits analysés organisés afin d’éviter de relire les avis avant le paiement.",
    "Total scans": "Analyses totales",
    "All shopper scans counted unless you clear them.": "Toutes les analyses acheteur sont comptées sauf si vous les effacez.",
    "Scan a product to start your tally.": "Analysez un produit pour démarrer votre compteur.",
    "Products with the strongest buying signal.": "Produits avec le signal d’achat le plus fort.",
    "Compare first": "Comparer d’abord",
    "Products that need caution or comparison.": "Produits qui demandent prudence ou comparaison.",
    "Avoid / fake risk": "Éviter / risque de faux avis",
    "Products with avoid signals or suspicious reviews.": "Produits avec signaux d’évitement ou avis suspects.",
    "Recent scans": "Analyses récentes",
    "Latest product checks": "Dernières vérifications produit",
    "Scan product": "Analyser un produit",
    "Clear all": "Tout effacer",
    Preview: "Aperçu",
    "Full result": "Résultat complet",
    Delete: "Supprimer",
    "Best finds": "Meilleures trouvailles",
    "Products worth buying will appear here.": "Les produits qui valent l’achat apparaîtront ici.",
    "Products worth buying will appear here": "Les produits qui valent l’achat apparaîtront ici",
    "Fake-review alerts": "Alertes de faux avis",
    "No high fake-review risk alerts saved yet.": "Aucune alerte de risque élevé de faux avis enregistrée.",
    "No high fake-review risk alerts saved yet": "Aucune alerte de risque élevé de faux avis enregistrée",
    "No strong pattern detected.": "Aucune tendance forte détectée.",
    "You get 3 free scans per day.": "Vous obtenez 3 analyses gratuites par jour.",
    "Upgrade to Shopper Premium for more scans, deeper fake-review reasoning, and a fuller buying-confidence history.":
      "Passez à Acheteur Premium pour plus d’analyses, un raisonnement plus profond sur les faux avis et un historique de confiance plus complet.",
    "View Shopper Premium": "Voir Acheteur Premium",
    "Avoid list": "Liste à éviter",
    "Avoid decisions will appear here.": "Les décisions d’évitement apparaîtront ici.",
    "Compare before buying": "Comparer avant d’acheter",
    "Risky or uncertain products will appear here.": "Les produits risqués ou incertains apparaîtront ici.",
    "Buying confidence": "Confiance d’achat",
    "Average buying score will appear after saved scans.": "Le score d’achat moyen apparaîtra après des analyses enregistrées.",
    "Use this history before checkout so you do not buy based on reviews you no longer remember.":
      "Utilisez cet historique avant le paiement pour ne pas acheter à partir d’avis oubliés.",
    "Scan preview": "Aperçu de l’analyse",
    Close: "Fermer",
    "Complete scan notes": "Notes complètes de l’analyse",
    "No detailed summary was saved for this scan.": "Aucun résumé détaillé n’a été enregistré pour cette analyse.",
    "Open full result": "Ouvrir le résultat complet",
    "Delete scan": "Supprimer l’analyse",
    "Close preview": "Fermer l’aperçu",
    "Seller dashboard": "Tableau de bord vendeur",
    "This dashboard is for Seller Premium and Seller Pro accounts only.":
      "Ce tableau de bord est réservé aux comptes Vendeur Premium et Vendeur Pro.",
    "Seller dashboard is not available on shopper accounts.": "Le tableau de bord vendeur n’est pas disponible pour les comptes acheteur.",
    "Shopper accounts are for buying decisions. Seller dashboards are for product review intelligence, complaint tracking, and listing improvement.":
      "Les comptes acheteur servent aux décisions d’achat. Les tableaux vendeur servent à l’intelligence des avis, au suivi des plaintes et à l’amélioration des fiches.",
    "Go to Shopper Analysis": "Aller à l’analyse acheteur",
    "Your Seller Pro workspace for product health, review signals, and improvement tracking.":
      "Votre espace Vendeur Pro pour la santé produit, les signaux d’avis et le suivi des améliorations.",
    "A clean view of your saved seller scans, product scores, buyer concerns, and next improvement moves.":
      "Une vue claire de vos analyses vendeur, scores produit, préoccupations acheteurs et prochaines améliorations.",
    "Run a seller analysis to start building your seller intelligence dashboard.":
      "Lancez une analyse vendeur pour commencer à bâtir votre tableau d’intelligence vendeur.",
    "Run more seller scans to build a clearer product improvement map. The dashboard becomes more useful as your saved scan history grows.":
      "Lancez plus d’analyses vendeur pour bâtir une carte d’amélioration produit plus claire. Le tableau devient plus utile à mesure que l’historique enregistré grandit.",
    "Seller Pro summary": "Résumé Vendeur Pro",
    "Your product improvement command center.": "Votre centre de commande d’amélioration produit.",
    "Products tracked": "Produits suivis",
    "Products with saved seller scan history.": "Produits avec historique d’analyses vendeur enregistré.",
    "Run seller scans to start tracking products.": "Lancez des analyses vendeur pour commencer le suivi.",
    "Scans this month": "Analyses ce mois-ci",
    "Normal saved seller scans used for product improvement.": "Analyses vendeur enregistrées utilisées pour l’amélioration produit.",
    "Avg product score": "Score produit moyen",
    "Average score from saved seller product scans.": "Score moyen des analyses produit vendeur enregistrées.",
    "Improvement focus": "Priorité d’amélioration",
    "No product focus yet.": "Aucune priorité produit pour l’instant.",
    "Product health ranking": "Classement de santé produit",
    "See which product needs attention first.": "Voyez quel produit demande d’abord de l’attention.",
    "Priority order": "Ordre de priorité",
    "Avg score": "Score moyen",
    "Main buyer concern": "Préoccupation principale acheteur",
    Priority: "Priorité",
    "Focus first": "Priorité absolue",
    "No product selected yet": "Aucun produit sélectionné",
    "Run seller scans to identify the product that needs the most improvement.":
      "Lancez des analyses vendeur pour trouver le produit à améliorer en priorité.",
    "Best performer": "Meilleur produit",
    "No strong product signal yet": "Aucun signal produit fort pour l’instant",
    "Your strongest product will appear once seller scans are saved.":
      "Votre produit le plus fort apparaîtra une fois les analyses vendeur enregistrées.",
    "Buyer concerns": "Préoccupations acheteurs",
    "Buyer concerns will appear after saved seller scans.": "Les préoccupations acheteurs apparaîtront après des analyses vendeur enregistrées.",
    "Buyer concerns will appear after saved seller scans": "Les préoccupations acheteurs apparaîtront après des analyses vendeur enregistrées",
    "Next moves": "Prochaines actions",
    "Seller actions will appear after saved seller scans.": "Les actions vendeur apparaîtront après des analyses vendeur enregistrées.",
    "Seller actions will appear after saved seller scans": "Les actions vendeur apparaîtront après des analyses vendeur enregistrées",
    "Winning signals": "Signaux gagnants",
    "Positive buyer signals will appear after saved seller scans.": "Les signaux acheteurs positifs apparaîtront après des analyses vendeur enregistrées.",
    "Positive buyer signals will appear after saved seller scans": "Les signaux acheteurs positifs apparaîtront après des analyses vendeur enregistrées",
    "Compare intelligence": "Intelligence comparative",
    "Compare results guide strategy, but do not affect product health averages.":
      "Les résultats de comparaison guident la stratégie, mais n’affectent pas les moyennes de santé produit.",
    "Use compare scans to find positioning opportunities, competitor weaknesses, and product advantages. They should guide strategy but not change normal product health averages.":
      "Utilisez les comparaisons pour trouver des opportunités de positionnement, faiblesses concurrentes et avantages produit. Elles guident la stratégie sans modifier les moyennes de santé produit.",
    "Report center": "Centre de rapports",
    "Export-ready seller insights.": "Infos vendeur prêtes à exporter.",
    "Health report": "Rapport de santé",
    "Concern summary": "Résumé des préoccupations",
    "Action plan": "Plan d’action",
    "Seller Pro workspace": "Espace Vendeur Pro",
    "Seller Pro feature": "Fonction Vendeur Pro",
    "Improvement calendar": "Calendrier d’amélioration",
    "Daily product improvement journal": "Journal quotidien d’amélioration produit",
    "Track scan history, product score movement, buyer concerns, and notes in one clean calendar view.":
      "Suivez l’historique, l’évolution du score produit, les préoccupations acheteurs et les notes dans un calendrier clair.",
    "The saved scan calendar is reserved for Seller Pro. Seller Premium keeps product tracking, while Seller Pro adds scan history, dated notes, and improvement journaling.":
      "Le calendrier des analyses enregistrées est réservé à Vendeur Pro. Vendeur Premium conserve le suivi produit, tandis que Vendeur Pro ajoute l’historique, les notes datées et le journal d’amélioration.",
    "Start your seller data": "Démarrer vos données vendeur",
    "Run a seller analysis to populate this dashboard with saved product health, complaint, and improvement data.":
      "Lancez une analyse vendeur pour remplir ce tableau avec la santé produit, les plaintes et les données d’amélioration enregistrées.",
    "Run Seller Analysis": "Lancer l’analyse vendeur",
    "Latest saved seller scans": "Dernières analyses vendeur enregistrées",
    "Seller Pro unlocks the improvement calendar.": "Vendeur Pro débloque le calendrier d’amélioration.",
    "Seller Premium gets the seller intelligence dashboard. Seller Pro adds the saved improvement calendar, notes, scan momentum, and deeper tracking tools.":
      "Vendeur Premium donne accès au tableau d’intelligence vendeur. Vendeur Pro ajoute le calendrier d’amélioration, les notes, la dynamique d’analyse et des outils de suivi plus poussés.",
    "Tracked products": "Produits suivis",
    "This product manager is available for seller accounts.": "Ce gestionnaire de produits est disponible pour les comptes vendeur.",
    "Seller product tracking is not available on shopper accounts.": "Le suivi des produits vendeur n’est pas disponible pour les comptes acheteur.",
    "Shopper accounts are for buying decisions. Seller accounts track product health, complaints, actions, and improvement history.":
      "Les comptes acheteur servent aux décisions d’achat. Les comptes vendeur suivent la santé produit, les plaintes, les actions et l’historique d’amélioration.",
    "Go to Analyze": "Aller à l’analyse",
    "All saved seller products, grouped by product name and sorted by improvement priority.":
      "Tous les produits vendeur enregistrés, groupés par nom et triés par priorité d’amélioration.",
    "Product manager": "Gestionnaire de produits",
    "See every product you are tracking.": "Voyez chaque produit que vous suivez.",
    "Use this page when you have many products. The main dashboard stays clean, while this page shows the full product list.":
      "Utilisez cette page lorsque vous avez beaucoup de produits. Le tableau principal reste clair, et cette page affiche la liste complète.",
    "Back to Seller Dashboard": "Retour au tableau vendeur",
    "Search products...": "Rechercher des produits...",
    "All priorities": "Toutes les priorités",
    Improve: "Améliorer",
    "All products": "Tous les produits",
    "Sorted by lowest score first": "Trié par score le plus faible",
    "Main concern:": "Préoccupation principale :",
    "Winning signal:": "Signal gagnant :",
    "Next move:": "Prochaine action :",
    "Open latest": "Ouvrir la dernière analyse",
    "Delete product history": "Supprimer l’historique produit",
    Scans: "Analyses",
    Latest: "Dernier",
    "No tracked products yet.": "Aucun produit suivi pour l’instant.",
    "Run a seller analysis and attach it to a product. Your products will appear here automatically.":
      "Lancez une analyse vendeur et associez-la à un produit. Vos produits apparaîtront ici automatiquement.",
    "Run Seller Scan": "Lancer une analyse vendeur",
    "AI review intelligence": "Intelligence IA des avis",
    "AI shopping intelligence for shoppers and ecommerce sellers, with clear support, billing, privacy, and subscription controls.":
      "Intelligence d’achat IA pour acheteurs et vendeurs e-commerce, avec assistance, facturation, confidentialité et contrôles d’abonnement clairs.",
    "Market-ready review analysis for shoppers and ecommerce sellers, with clear support, billing, privacy, and subscription controls.":
      "Analyse d’avis prête pour le marché, pour acheteurs et vendeurs e-commerce, avec assistance, facturation, confidentialité et contrôles d’abonnement clairs.",
    "Support:": "Assistance :",
    "Billing:": "Facturation :",
    "AI guidance for review decisions. Always verify critical product claims.":
      "Conseils IA pour les décisions liées aux avis. Vérifiez toujours les affirmations produit importantes."
  },
  es: {
    Login: "Iniciar sesión",
    Results: "Resultados",
    Account: "Cuenta",
    Scan: "Analizar",
    Avoid: "Evitar",
    "← Back": "← Atrás",
    "Seller Dashboard": "Panel del vendedor",
    "Shopper Dashboard": "Panel del comprador",
    Name: "Nombre",
    "Profile type": "Tipo de perfil",
    "Seller / business": "Vendedor / negocio",
    "Create account": "Crear cuenta",
    "Send reset email": "Enviar correo de restablecimiento",
    "Email verification": "Verificación de correo",
    "Password reset": "Restablecer contraseña",
    "Secure account": "Cuenta segura",
    "Create your ReviewIntel account": "Crea tu cuenta de ReviewIntel",
    "Reset your password": "Restablece tu contraseña",
    "Log in to ReviewIntel": "Inicia sesión en ReviewIntel",
    "Log in with your ReviewIntel account, or create a new Shopper or Seller account to start scanning reviews.":
      "Inicia sesión con tu cuenta de ReviewIntel o crea una cuenta de comprador o vendedor para empezar a analizar reseñas.",
    "Marketplace intelligence": "Inteligencia de marketplace",
    "All reviews. One AI scan. Clear buying answers.": "Todas las reseñas. Un análisis con IA. Respuestas claras de compra.",
    "Scan Reviews Now": "Analizar reseñas ahora",
    "See Example Result": "Ver resultado de ejemplo",
    "Live AI scan": "Análisis IA en vivo",
    "Review score": "Puntuación de reseñas",
    "Worth buying with durability caution": "Vale la pena con cautela sobre durabilidad",
    "AI verdict": "Veredicto IA",
    "Good product. Check repeated risks first.": "Buen producto. Revisa primero los riesgos repetidos.",
    "Buyers like speed and cleanup. Watch lid leaks and motor life.":
      "A los compradores les gusta la rapidez y la limpieza. Revisa fugas de tapa y vida del motor.",
    "Shopper answer": "Respuesta del comprador",
    "Best for casual use — not heavy daily use.": "Ideal para uso ocasional, no para uso diario intenso.",
    "Complaint heat": "Intensidad de quejas",
    "Moderate risk": "Riesgo moderado",
    "Seller insight": "Información del vendedor",
    "Seller insight: clarify warranty and replacement support.": "Información del vendedor: aclara garantía y soporte de reemplazo.",
    "Review signal": "Señal de reseñas",
    "AI extracts risk + buyer signal": "La IA extrae riesgo y señal del comprador",
    "AI scan core": "Núcleo de análisis IA",
    Marketplace: "Marketplace",
    Retail: "Retail",
    "Social commerce": "Comercio social",
    Storefront: "Tienda online",
    Handmade: "Hecho a mano",
    Resale: "Reventa",
    Electronics: "Electrónica",
    "Screenshot-worthy payoff": "Resultado digno de captura",
    "The result should feel like opening a prize box.": "El resultado debe sentirse como abrir una caja sorpresa.",
    "Shoppers get the answer without reading a report. Sellers get a separate command view built for decisions, not shopping.":
      "Los compradores obtienen la respuesta sin leer un informe. Los vendedores tienen una vista separada para decidir, no para comprar.",
    "Try Shopper Scan": "Probar análisis de comprador",
    "See Seller Plans": "Ver planes de vendedor",
    "Free account required": "Cuenta gratuita requerida",
    "Create a free account before scanning reviews.": "Crea una cuenta gratuita antes de analizar reseñas.",
    "ReviewIntel keeps free scans attached to an account so usage, results, and saved history stay private and separated.":
      "ReviewIntel vincula los análisis gratuitos a una cuenta para que uso, resultados e historial permanezcan privados y separados.",
    "Create free account": "Crear cuenta gratuita",
    "How scanning works": "Cómo funciona el análisis",
    "Paste reviews inside Analyzer": "Pega reseñas en el analizador",
    "Run AI scan": "Ejecutar análisis IA",
    "Save result to your account": "Guardar resultado en tu cuenta",
    "AI review scanner": "Analizador de reseñas IA",
    "Paste reviews. Get the buying answer.": "Pega reseñas. Obtén la respuesta de compra.",
    "ReviewIntel turns messy customer reviews into a score, verdict, fake-risk read, value call, and top complaint.":
      "ReviewIntel convierte reseñas desordenadas en puntuación, veredicto, riesgo de reseñas falsas, valoración y queja principal.",
    "Overall score": "Puntuación general",
    "Shared score": "Puntuación compartida",
    Buy: "Comprar",
    "Worth buying": "Vale la pena comprar",
    "Fast verdict": "Veredicto rápido",
    "Fake risk": "Riesgo falso",
    "Pattern check": "Revisión de patrones",
    "Money call": "Decisión de valor",
    "Shopper quick answer": "Respuesta rápida del comprador",
    "Best for: students, office work, travel. Top complaint: battery life.":
      "Ideal para: estudiantes, oficina y viajes. Principal queja: batería.",
    "Shopper recommendation": "Recomendación de comprador",
    "Seller analytics": "Analítica de vendedor",
    "Shopper + seller intelligence": "Inteligencia comprador + vendedor",
    "Instant shopper answer": "Respuesta instantánea del comprador",
    "Deep customer intelligence": "Inteligencia profunda del cliente",
    "Dual Mode": "Modo dual",
    "Dual output preview": "Vista previa dual",
    Verdict: "Veredicto",
    Strategy: "Estrategia",
    Report: "Informe",
    "Seller Pro intelligence": "Inteligencia Vendedor Pro",
    "Shopper + Seller report": "Informe comprador + vendedor",
    "Shopper verdict": "Veredicto del comprador",
    "Create a free account to scan.": "Crea una cuenta gratuita para analizar.",
    "Ready to scan this review set.": "Listo para analizar este lote de reseñas.",
    "Sign up or log in to scan": "Regístrate o inicia sesión para analizar",
    "Scanning...": "Analizando...",
    "ReviewIntel scan": "Análisis ReviewIntel",
    "Analyzing review intelligence": "Analizando inteligencia de reseñas",
    "Choose the result you want": "Elige el resultado que quieres",
    "Shopper answer or seller intelligence.": "Respuesta de comprador o inteligencia de vendedor.",
    "Analysis mode switcher": "Selector de modo de análisis",
    "Test Shopper, Seller, or Dual output.": "Prueba salida de comprador, vendedor o dual.",
    "Product or business name": "Producto o negocio",
    "Review platform": "Plataforma de reseñas",
    "Optional reference": "Referencia opcional",
    "Deep Analysis": "Análisis profundo",
    "Quick Scan Beta": "Análisis rápido beta",
    "Drop screenshots for a fast check.": "Suelta capturas para una revisión rápida.",
    "Run Screenshot Analysis": "Analizar capturas",
    "Upgrade unlock": "Desbloqueo con mejora",
    "Unlimited product analyses": "Análisis de productos ilimitados",
    "Saved history and comparisons": "Historial y comparaciones guardados",
    "Seller intelligence and exports": "Inteligencia de vendedor y exportaciones",
    "Concrete steps": "Pasos concretos",
    "Copy, paste, scan.": "Copia, pega y analiza.",
    Screenshots: "Capturas",
    "Fast shopper verdict": "Veredicto rápido del comprador",
    "Use Quick Scan": "Usar análisis rápido",
    "Use Deep Analysis": "Usar análisis profundo",
    "No scan loaded": "Ningún análisis cargado",
    "Your latest scan": "Tu último análisis",
    "Run another scan": "Ejecutar otro análisis",
    "Seller Premium intelligence": "Inteligencia Vendedor Premium",
    "Rating breakdown": "Desglose de calificaciones",
    Excellent: "Excelente",
    Strong: "Fuerte",
    Watch: "Vigilar",
    Concern: "Preocupación",
    Critical: "Crítico",
    "Immediate fix": "Corrección inmediata",
    "High priority": "Alta prioridad",
    "Monitor closely": "Vigilar de cerca",
    Maintain: "Mantener",
    "Seller Pro magic moment": "Momento clave Vendedor Pro",
    "Seller Premium insight": "Información Vendedor Premium",
    "Turn review pain into product revenue moves.": "Convierte problemas de reseñas en acciones de ingresos.",
    "Most expensive complaint": "Queja más costosa",
    "Fix first": "Corregir primero",
    "Product move": "Acción de producto",
    Operations: "Operaciones",
    "Listing move": "Acción de ficha",
    Conversion: "Conversión",
    Weak: "Débil",
    "Risk level": "Nivel de riesgo",
    "Why this score": "Por qué esta puntuación",
    "Check before buying:": "Revisar antes de comprar:",
    "Avoid if:": "Evitar si:",
    "Before you buy": "Antes de comprar",
    "What to check before checkout": "Qué revisar antes de pagar",
    "Seller growth diagnosis": "Diagnóstico de crecimiento del vendedor",
    "Reviews mined": "Reseñas analizadas",
    Satisfaction: "Satisfacción",
    Opportunity: "Oportunidad",
    "Customer satisfaction": "Satisfacción del cliente",
    "Complaint load": "Carga de quejas",
    "Improvement upside": "Potencial de mejora",
    "Evidence quality": "Calidad de evidencia",
    "Seller growth moves": "Acciones de crecimiento",
    "Advertise this": "Anunciar esto",
    "Stop promising this": "Dejar de prometer esto",
    "Seller intelligence map": "Mapa de inteligencia del vendedor",
    "Buyer confidence graph": "Gráfico de confianza del comprador",
    "Refund safety": "Seguridad de reembolso",
    "Packaging confidence": "Confianza en empaque",
    "Support confidence": "Confianza en soporte",
    "Feature demand": "Demanda de funciones",
    "Positive positioning": "Posicionamiento positivo",
    "Review evidence quality": "Calidad de evidencia de reseñas",
    "What this means": "Qué significa",
    "Words buyers keep using": "Palabras que repiten los compradores",
    "Rating background": "Contexto de calificaciones",
    Workspace: "Espacio de trabajo",
    "Shopper Workspace": "Espacio del comprador",
    "Seller Workspace": "Espacio del vendedor",
    "Shopper Home": "Inicio comprador",
    "Seller Home": "Inicio vendedor",
    "Paste Reviews": "Pegar reseñas",
    "Compare Products": "Comparar productos",
    "Competitor Compare": "Comparar competidores",
    Billing: "Facturación",
    "Business intelligence": "Inteligencia empresarial",
    "Shopping assistant": "Asistente de compra",
    "Manage subscription": "Administrar suscripción",
    "Billing support": "Soporte de facturación",
    "Trend snapshot": "Resumen de tendencia",
    "Shopper dashboard": "Panel del comprador",
    "Shopping intelligence": "Inteligencia de compra",
    "Know what to buy, compare, or avoid.": "Sabe qué comprar, comparar o evitar.",
    "Total scans": "Análisis totales",
    "Compare first": "Comparar primero",
    "Avoid / fake risk": "Evitar / riesgo falso",
    "Recent scans": "Análisis recientes",
    "Latest product checks": "Últimas revisiones de productos",
    "Scan product": "Analizar producto",
    "Clear all": "Borrar todo",
    Preview: "Vista previa",
    "Full result": "Resultado completo",
    Delete: "Eliminar",
    "Best finds": "Mejores hallazgos",
    "Products worth buying will appear here": "Aquí aparecerán los productos que valen la pena",
    "Fake-review alerts": "Alertas de reseñas falsas",
    "No high fake-review risk alerts saved yet": "Aún no hay alertas de alto riesgo de reseñas falsas",
    "No strong pattern detected.": "No se detectó un patrón fuerte.",
    "You get 3 free scans per day.": "Tienes 3 análisis gratuitos al día.",
    "View Shopper Premium": "Ver Comprador Premium",
    "Avoid list": "Lista de evitar",
    "Compare before buying": "Comparar antes de comprar",
    "Buying confidence": "Confianza de compra",
    "Scan preview": "Vista previa del análisis",
    Close: "Cerrar",
    "Complete scan notes": "Notas completas del análisis",
    "Open full result": "Abrir resultado completo",
    "Delete scan": "Eliminar análisis",
    "Close preview": "Cerrar vista previa",
    "Seller dashboard": "Panel del vendedor",
    "Go to Shopper Analysis": "Ir al análisis de comprador",
    "Seller Pro summary": "Resumen Vendedor Pro",
    "Run more seller scans to build a clearer product improvement map. The dashboard becomes more useful as your saved scan history grows.":
      "Ejecuta más análisis de vendedor para crear un mapa de mejora de producto más claro. El panel mejora a medida que crece el historial guardado.",
    "Your product improvement command center.": "Tu centro de mejora de producto.",
    "Products tracked": "Productos seguidos",
    "Scans this month": "Análisis este mes",
    "Avg product score": "Puntuación media del producto",
    "Improvement focus": "Foco de mejora",
    "Product health ranking": "Ranking de salud del producto",
    "Priority order": "Orden de prioridad",
    "Avg score": "Puntuación media",
    "Main buyer concern": "Principal preocupación del comprador",
    Priority: "Prioridad",
    "Focus first": "Enfocar primero",
    "Best performer": "Mejor rendimiento",
    "Buyer concerns": "Preocupaciones del comprador",
    "Buyer concerns will appear after saved seller scans": "Las preocupaciones del comprador aparecerán después de guardar análisis de vendedor",
    "Next moves": "Próximas acciones",
    "Seller actions will appear after saved seller scans": "Las acciones del vendedor aparecerán después de guardar análisis de vendedor",
    "Winning signals": "Señales ganadoras",
    "Positive buyer signals will appear after saved seller scans": "Las señales positivas del comprador aparecerán después de guardar análisis de vendedor",
    "Compare intelligence": "Inteligencia comparativa",
    "Report center": "Centro de informes",
    "Export-ready seller insights.": "Información del vendedor lista para exportar.",
    "Health report": "Informe de salud",
    "Concern summary": "Resumen de preocupaciones",
    "Action plan": "Plan de acción",
    "Seller Pro workspace": "Espacio Vendedor Pro",
    "Seller Pro feature": "Función Vendedor Pro",
    "Improvement calendar": "Calendario de mejora",
    "Daily product improvement journal": "Diario diario de mejora del producto",
    "The saved scan calendar is reserved for Seller Pro. Seller Premium keeps product tracking, while Seller Pro adds scan history, dated notes, and improvement journaling.":
      "El calendario de análisis guardados está reservado para Vendedor Pro. Vendedor Premium mantiene el seguimiento de productos; Vendedor Pro añade historial, notas fechadas y diario de mejoras.",
    "Start your seller data": "Inicia tus datos de vendedor",
    "Run Seller Analysis": "Ejecutar análisis de vendedor",
    "Latest saved seller scans": "Últimos análisis de vendedor guardados",
    "Tracked products": "Productos seguidos",
    "Product manager": "Gestor de productos",
    "Back to Seller Dashboard": "Volver al panel del vendedor",
    "Search products...": "Buscar productos...",
    "All priorities": "Todas las prioridades",
    Improve: "Mejorar",
    "All products": "Todos los productos",
    "Sorted by lowest score first": "Ordenado por menor puntuación",
    "Main concern:": "Preocupación principal:",
    "Winning signal:": "Señal ganadora:",
    "Next move:": "Próxima acción:",
    "Open latest": "Abrir último",
    "Delete product history": "Eliminar historial del producto",
    Scans: "Análisis",
    Latest: "Último",
    "No tracked products yet.": "Aún no hay productos seguidos.",
    "Run Seller Scan": "Ejecutar análisis de vendedor",
    "AI review intelligence": "Inteligencia IA de reseñas",
    "AI shopping intelligence for shoppers and ecommerce sellers, with clear support, billing, privacy, and subscription controls.":
      "Inteligencia de compra con IA para compradores y vendedores ecommerce, con soporte, facturación, privacidad y controles de suscripción claros.",
    "Support:": "Soporte:",
    "Billing:": "Facturación:",
    "AI guidance for review decisions. Always verify critical product claims.":
      "Orientación IA para decisiones con reseñas. Verifica siempre las afirmaciones críticas del producto."
  },
  zh: {
    Login: "登录",
    Results: "结果",
    Account: "账户",
    Scan: "分析",
    Avoid: "避免",
    "← Back": "← 返回",
    "Seller Dashboard": "卖家仪表板",
    "Shopper Dashboard": "购物者仪表板",
    Name: "姓名",
    "Profile type": "资料类型",
    "Seller / business": "卖家 / 企业",
    "Create account": "创建账户",
    "Send reset email": "发送重置邮件",
    "Email verification": "邮箱验证",
    "Password reset": "密码重置",
    "Secure account": "安全账户",
    "Create your ReviewIntel account": "创建你的 ReviewIntel 账户",
    "Reset your password": "重置密码",
    "Log in to ReviewIntel": "登录 ReviewIntel",
    "Log in with your ReviewIntel account, or create a new Shopper or Seller account to start scanning reviews.":
      "使用你的 ReviewIntel 账户登录，或创建新的购物者或卖家账户来开始分析评价。",
    "Marketplace intelligence": "市场智能",
    "All reviews. One AI scan. Clear buying answers.": "所有评价。一次 AI 分析。清晰购买答案。",
    "Scan Reviews Now": "立即分析评价",
    "See Example Result": "查看示例结果",
    "Live AI scan": "实时 AI 分析",
    "Review score": "评价评分",
    "Worth buying with durability caution": "值得购买，但需注意耐用性",
    "AI verdict": "AI 结论",
    "Good product. Check repeated risks first.": "产品不错。先检查重复风险。",
    "Shopper answer": "购物者答案",
    "Best for casual use — not heavy daily use.": "适合偶尔使用，不适合高强度日常使用。",
    "Complaint heat": "投诉热度",
    "Moderate risk": "中等风险",
    "Seller insight": "卖家洞察",
    "Review signal": "评价信号",
    "AI extracts risk + buyer signal": "AI 提取风险和买家信号",
    "Screenshot-worthy payoff": "值得截图的结果",
    "The result should feel like opening a prize box.": "结果应该像打开惊喜盒一样清楚。",
    "Try Shopper Scan": "试用购物者分析",
    "See Seller Plans": "查看卖家方案",
    "Free account required": "需要免费账户",
    "Create a free account before scanning reviews.": "分析评价前请先创建免费账户。",
    "Create free account": "创建免费账户",
    "How scanning works": "分析如何运作",
    "Paste reviews inside Analyzer": "在分析器中粘贴评价",
    "Run AI scan": "运行 AI 分析",
    "Save result to your account": "将结果保存到你的账户",
    "AI review scanner": "AI 评价分析器",
    "Paste reviews. Get the buying answer.": "粘贴评价，得到购买答案。",
    "Overall score": "总评分",
    "Shared score": "共享评分",
    Buy: "购买",
    "Worth buying": "值得购买",
    "Fast verdict": "快速结论",
    "Fake risk": "虚假风险",
    "Pattern check": "模式检查",
    "Money call": "价值判断",
    "Shopper quick answer": "购物者快速答案",
    "Shopper recommendation": "购物者建议",
    "Seller analytics": "卖家分析",
    "Shopper + seller intelligence": "购物者 + 卖家智能",
    "Instant shopper answer": "即时购物答案",
    "Deep customer intelligence": "深度客户智能",
    "Dual Mode": "双模式",
    Verdict: "结论",
    Strategy: "策略",
    Report: "报告",
    "Seller Pro intelligence": "卖家专业智能",
    "Shopper + Seller report": "购物者 + 卖家报告",
    "Shopper verdict": "购物者结论",
    "Create a free account to scan.": "创建免费账户即可分析。",
    "Ready to scan this review set.": "已准备分析这组评价。",
    "Sign up or log in to scan": "注册或登录以分析",
    "Scanning...": "分析中...",
    "ReviewIntel scan": "ReviewIntel 分析",
    "Analyzing review intelligence": "正在分析评价智能",
    "Choose the result you want": "选择你想要的结果",
    "Deep Analysis": "深度分析",
    "Quick Scan Beta": "快速分析测试版",
    "Run Screenshot Analysis": "分析截图",
    "Upgrade unlock": "升级解锁",
    "Concrete steps": "具体步骤",
    "Copy, paste, scan.": "复制、粘贴、分析。",
    Screenshots: "截图",
    "Use Quick Scan": "使用快速分析",
    "Use Deep Analysis": "使用深度分析",
    "No scan loaded": "未加载分析",
    "Your latest scan": "你的最新分析",
    "Run another scan": "再次分析",
    "Rating breakdown": "评分分布",
    Excellent: "优秀",
    Strong: "强",
    Watch: "关注",
    Concern: "担忧",
    Critical: "严重",
    "Fix first": "优先修复",
    "Risk level": "风险等级",
    "Why this score": "为什么是这个分数",
    "Before you buy": "购买前",
    Workspace: "工作区",
    "Shopper Workspace": "购物者工作区",
    "Seller Workspace": "卖家工作区",
    "Shopper Home": "购物者首页",
    "Seller Home": "卖家首页",
    "Paste Reviews": "粘贴评价",
    "Compare Products": "比较产品",
    Billing: "账单",
    "Business intelligence": "商业智能",
    "Shopping assistant": "购物助手",
    "Trend snapshot": "趋势快照",
    "Shopper dashboard": "购物者仪表板",
    "Shopping intelligence": "购物智能",
    "Total scans": "总分析数",
    "Compare first": "先比较",
    "Avoid / fake risk": "避免 / 虚假风险",
    "Recent scans": "最近分析",
    "Latest product checks": "最新产品检查",
    "Scan product": "分析产品",
    "Clear all": "全部清除",
    Preview: "预览",
    "Full result": "完整结果",
    Delete: "删除",
    "Best finds": "最佳发现",
    "Products worth buying will appear here": "值得购买的产品会显示在这里",
    "No high fake-review risk alerts saved yet": "还没有保存高虚假评价风险提醒",
    "No strong pattern detected.": "未检测到明显模式。",
    "Buying confidence": "购买信心",
    Close: "关闭",
    "Seller dashboard": "卖家仪表板",
    "Seller Pro summary": "卖家专业摘要",
    "Run more seller scans to build a clearer product improvement map. The dashboard becomes more useful as your saved scan history grows.":
      "运行更多卖家分析，以建立更清晰的产品改进地图。保存的分析历史越多，仪表板越有用。",
    "Products tracked": "已跟踪产品",
    "Scans this month": "本月分析",
    "Avg product score": "平均产品评分",
    "Improvement focus": "改进重点",
    Priority: "优先级",
    "Buyer concerns": "买家担忧",
    "Buyer concerns will appear after saved seller scans": "保存卖家分析后会显示买家担忧",
    "Next moves": "下一步",
    "Seller actions will appear after saved seller scans": "保存卖家分析后会显示卖家行动",
    "Winning signals": "优势信号",
    "Positive buyer signals will appear after saved seller scans": "保存卖家分析后会显示积极买家信号",
    "Report center": "报告中心",
    "Seller Pro feature": "卖家专业功能",
    "Daily product improvement journal": "每日产品改进日志",
    "The saved scan calendar is reserved for Seller Pro. Seller Premium keeps product tracking, while Seller Pro adds scan history, dated notes, and improvement journaling.":
      "保存的分析日历仅限卖家专业版。卖家高级版保留产品跟踪，卖家专业版增加分析历史、日期备注和改进日志。",
    "Tracked products": "已跟踪产品",
    "Product manager": "产品管理",
    "Search products...": "搜索产品...",
    "All priorities": "所有优先级",
    Improve: "改进",
    "All products": "所有产品",
    Scans: "分析",
    Latest: "最新",
    "AI review intelligence": "AI 评价智能",
    "AI shopping intelligence for shoppers and ecommerce sellers, with clear support, billing, privacy, and subscription controls.":
      "面向购物者和电商卖家的 AI 购物智能，提供清晰的支持、账单、隐私和订阅控制。",
    "Support:": "支持：",
    "Billing:": "账单："
  },
  de: {
    Login: "Anmelden",
    Results: "Ergebnisse",
    Account: "Konto",
    Scan: "Analysieren",
    Avoid: "Meiden",
    "← Back": "← Zurück",
    "Seller Dashboard": "Verkäufer-Dashboard",
    "Shopper Dashboard": "Käufer-Dashboard",
    Name: "Name",
    "Profile type": "Profiltyp",
    "Seller / business": "Verkäufer / Geschäft",
    "Create account": "Konto erstellen",
    "Send reset email": "Reset-E-Mail senden",
    "Email verification": "E-Mail-Verifizierung",
    "Password reset": "Passwort zurücksetzen",
    "Secure account": "Sicheres Konto",
    "Create your ReviewIntel account": "Erstelle dein ReviewIntel-Konto",
    "Reset your password": "Setze dein Passwort zurück",
    "Log in to ReviewIntel": "Bei ReviewIntel anmelden",
    "Log in with your ReviewIntel account, or create a new Shopper or Seller account to start scanning reviews.":
      "Melde dich mit deinem ReviewIntel-Konto an oder erstelle ein neues Käufer- oder Verkäuferkonto, um Bewertungen zu analysieren.",
    "Marketplace intelligence": "Marketplace-Intelligenz",
    "All reviews. One AI scan. Clear buying answers.": "Alle Bewertungen. Ein KI-Scan. Klare Kaufantworten.",
    "Scan Reviews Now": "Bewertungen jetzt analysieren",
    "See Example Result": "Beispielergebnis ansehen",
    "Live AI scan": "Live-KI-Analyse",
    "Review score": "Bewertungsscore",
    "Worth buying with durability caution": "Kaufenswert, aber Haltbarkeit prüfen",
    "AI verdict": "KI-Urteil",
    "Good product. Check repeated risks first.": "Gutes Produkt. Wiederholte Risiken zuerst prüfen.",
    "Shopper answer": "Käuferantwort",
    "Complaint heat": "Beschwerdedruck",
    "Moderate risk": "Mittleres Risiko",
    "Seller insight": "Verkäuferhinweis",
    "Review signal": "Bewertungssignal",
    "Screenshot-worthy payoff": "Screenshot-würdiges Ergebnis",
    "The result should feel like opening a prize box.": "Das Ergebnis soll sich wie das Öffnen einer Überraschungsbox anfühlen.",
    "Try Shopper Scan": "Käuferanalyse testen",
    "See Seller Plans": "Verkäuferpläne ansehen",
    "Free account required": "Kostenloses Konto erforderlich",
    "Create a free account before scanning reviews.": "Erstelle vor dem Analysieren ein kostenloses Konto.",
    "Create free account": "Kostenloses Konto erstellen",
    "How scanning works": "So funktioniert die Analyse",
    "Paste reviews inside Analyzer": "Bewertungen im Analysator einfügen",
    "Run AI scan": "KI-Analyse starten",
    "Save result to your account": "Ergebnis im Konto speichern",
    "AI review scanner": "KI-Bewertungsanalysator",
    "Paste reviews. Get the buying answer.": "Bewertungen einfügen. Kaufantwort erhalten.",
    "Overall score": "Gesamtscore",
    "Shared score": "Gemeinsamer Score",
    Buy: "Kaufen",
    "Worth buying": "Kaufenswert",
    "Fast verdict": "Schnelles Urteil",
    "Fake risk": "Fälschungsrisiko",
    "Pattern check": "Musterprüfung",
    "Money call": "Wertentscheidung",
    "Shopper quick answer": "Schnelle Käuferantwort",
    "Shopper recommendation": "Käuferempfehlung",
    "Seller analytics": "Verkäuferanalyse",
    "Shopper + seller intelligence": "Käufer- und Verkäuferintelligenz",
    "Instant shopper answer": "Sofortige Käuferantwort",
    "Deep customer intelligence": "Tiefe Kundenintelligenz",
    "Dual Mode": "Doppelmodus",
    Verdict: "Urteil",
    Strategy: "Strategie",
    Report: "Bericht",
    "Seller Pro intelligence": "Verkäufer-Pro-Intelligenz",
    "Shopper + Seller report": "Käufer- und Verkäuferbericht",
    "Shopper verdict": "Käuferurteil",
    "Create a free account to scan.": "Erstelle ein kostenloses Konto zum Analysieren.",
    "Ready to scan this review set.": "Bereit, dieses Bewertungsset zu analysieren.",
    "Sign up or log in to scan": "Registrieren oder anmelden zum Analysieren",
    "Scanning...": "Analyse läuft...",
    "ReviewIntel scan": "ReviewIntel-Analyse",
    "Analyzing review intelligence": "Bewertungsintelligenz wird analysiert",
    "Choose the result you want": "Wähle das gewünschte Ergebnis",
    "Deep Analysis": "Tiefenanalyse",
    "Quick Scan Beta": "Schnellanalyse Beta",
    "Run Screenshot Analysis": "Screenshots analysieren",
    "Upgrade unlock": "Upgrade-Freischaltung",
    "Concrete steps": "Konkrete Schritte",
    "Copy, paste, scan.": "Kopieren, einfügen, analysieren.",
    Screenshots: "Screenshots",
    "Use Quick Scan": "Schnellanalyse nutzen",
    "Use Deep Analysis": "Tiefenanalyse nutzen",
    "No scan loaded": "Keine Analyse geladen",
    "Your latest scan": "Deine letzte Analyse",
    "Run another scan": "Weitere Analyse starten",
    "Rating breakdown": "Bewertungsverteilung",
    Excellent: "Ausgezeichnet",
    Strong: "Stark",
    Watch: "Beobachten",
    Concern: "Bedenken",
    Critical: "Kritisch",
    "Fix first": "Zuerst beheben",
    "Risk level": "Risikostufe",
    "Why this score": "Warum dieser Score",
    "Before you buy": "Vor dem Kauf",
    Workspace: "Arbeitsbereich",
    "Shopper Workspace": "Käufer-Arbeitsbereich",
    "Seller Workspace": "Verkäufer-Arbeitsbereich",
    "Shopper Home": "Käufer-Start",
    "Seller Home": "Verkäufer-Start",
    "Paste Reviews": "Bewertungen einfügen",
    "Compare Products": "Produkte vergleichen",
    Billing: "Abrechnung",
    "Business intelligence": "Geschäftsintelligenz",
    "Shopping assistant": "Kaufassistent",
    "Trend snapshot": "Trendübersicht",
    "Shopper dashboard": "Käufer-Dashboard",
    "Shopping intelligence": "Kaufintelligenz",
    "Total scans": "Analysen gesamt",
    "Compare first": "Zuerst vergleichen",
    "Avoid / fake risk": "Meiden / Fälschungsrisiko",
    "Recent scans": "Letzte Analysen",
    "Latest product checks": "Neueste Produktprüfungen",
    "Scan product": "Produkt analysieren",
    "Clear all": "Alles löschen",
    Preview: "Vorschau",
    "Full result": "Vollständiges Ergebnis",
    Delete: "Löschen",
    "Best finds": "Beste Funde",
    "Products worth buying will appear here": "Kaufenswerte Produkte erscheinen hier",
    "No high fake-review risk alerts saved yet": "Noch keine Warnungen mit hohem Fälschungsrisiko gespeichert",
    "No strong pattern detected.": "Kein starkes Muster erkannt.",
    "Buying confidence": "Kaufvertrauen",
    Close: "Schließen",
    "Seller dashboard": "Verkäufer-Dashboard",
    "Seller Pro summary": "Verkäufer-Pro-Zusammenfassung",
    "Run more seller scans to build a clearer product improvement map. The dashboard becomes more useful as your saved scan history grows.":
      "Starte mehr Verkäuferanalysen, um eine klarere Produktverbesserungskarte aufzubauen. Das Dashboard wird nützlicher, wenn der gespeicherte Verlauf wächst.",
    "Products tracked": "Verfolgte Produkte",
    "Scans this month": "Analysen diesen Monat",
    "Avg product score": "Durchschnittlicher Produktscore",
    "Improvement focus": "Verbesserungsfokus",
    Priority: "Priorität",
    "Buyer concerns": "Käuferbedenken",
    "Buyer concerns will appear after saved seller scans": "Käuferbedenken erscheinen nach gespeicherten Verkäuferanalysen",
    "Next moves": "Nächste Schritte",
    "Seller actions will appear after saved seller scans": "Verkäuferaktionen erscheinen nach gespeicherten Verkäuferanalysen",
    "Winning signals": "Gewinnersignale",
    "Positive buyer signals will appear after saved seller scans": "Positive Käufersignale erscheinen nach gespeicherten Verkäuferanalysen",
    "Report center": "Berichtszentrum",
    "Seller Pro feature": "Verkäufer-Pro-Funktion",
    "Daily product improvement journal": "Tägliches Produktverbesserungsjournal",
    "The saved scan calendar is reserved for Seller Pro. Seller Premium keeps product tracking, while Seller Pro adds scan history, dated notes, and improvement journaling.":
      "Der gespeicherte Analysekalender ist Verkäufer Pro vorbehalten. Verkäufer Premium behält Produkttracking; Verkäufer Pro ergänzt Verlauf, datierte Notizen und Verbesserungsjournal.",
    "Tracked products": "Verfolgte Produkte",
    "Product manager": "Produktmanager",
    "Search products...": "Produkte suchen...",
    "All priorities": "Alle Prioritäten",
    Improve: "Verbessern",
    "All products": "Alle Produkte",
    Scans: "Analysen",
    Latest: "Neueste",
    "AI review intelligence": "KI-Bewertungsintelligenz",
    "AI shopping intelligence for shoppers and ecommerce sellers, with clear support, billing, privacy, and subscription controls.":
      "KI-Shopping-Intelligenz für Käufer und E-Commerce-Verkäufer mit klaren Support-, Abrechnungs-, Datenschutz- und Abo-Kontrollen.",
    "Support:": "Support:",
    "Billing:": "Abrechnung:"
  },
  hi: {
    Login: "लॉग इन",
    Results: "परिणाम",
    Account: "खाता",
    Scan: "स्कैन",
    Avoid: "बचें",
    "← Back": "← वापस",
    "Seller Dashboard": "विक्रेता डैशबोर्ड",
    "Shopper Dashboard": "शॉपर डैशबोर्ड",
    Name: "नाम",
    "Profile type": "प्रोफाइल प्रकार",
    "Seller / business": "विक्रेता / व्यवसाय",
    "Create account": "खाता बनाएँ",
    "Send reset email": "रीसेट ईमेल भेजें",
    "Email verification": "ईमेल सत्यापन",
    "Password reset": "पासवर्ड रीसेट",
    "Secure account": "सुरक्षित खाता",
    "Create your ReviewIntel account": "अपना ReviewIntel खाता बनाएँ",
    "Reset your password": "अपना पासवर्ड रीसेट करें",
    "Log in to ReviewIntel": "ReviewIntel में लॉग इन करें",
    "Log in with your ReviewIntel account, or create a new Shopper or Seller account to start scanning reviews.":
      "अपने ReviewIntel खाते से लॉग इन करें, या समीक्षाएँ स्कैन शुरू करने के लिए नया शॉपर या विक्रेता खाता बनाएँ।",
    "Marketplace intelligence": "मार्केटप्लेस इंटेलिजेंस",
    "All reviews. One AI scan. Clear buying answers.": "सभी समीक्षाएँ। एक AI स्कैन। साफ़ खरीद जवाब।",
    "Scan Reviews Now": "अभी समीक्षाएँ स्कैन करें",
    "See Example Result": "उदाहरण परिणाम देखें",
    "Live AI scan": "लाइव AI स्कैन",
    "Review score": "समीक्षा स्कोर",
    "Worth buying with durability caution": "खरीदने योग्य, पर टिकाऊपन जाँचें",
    "AI verdict": "AI निर्णय",
    "Good product. Check repeated risks first.": "अच्छा उत्पाद। पहले दोहराए जोखिम जाँचें।",
    "Shopper answer": "शॉपर जवाब",
    "Complaint heat": "शिकायत तीव्रता",
    "Moderate risk": "मध्यम जोखिम",
    "Seller insight": "विक्रेता जानकारी",
    "Review signal": "समीक्षा संकेत",
    "Screenshot-worthy payoff": "स्क्रीनशॉट योग्य परिणाम",
    "The result should feel like opening a prize box.": "परिणाम ऐसा लगे जैसे इनाम बॉक्स खोला हो।",
    "Try Shopper Scan": "शॉपर स्कैन आज़माएँ",
    "See Seller Plans": "विक्रेता प्लान देखें",
    "Free account required": "मुफ्त खाता आवश्यक",
    "Create a free account before scanning reviews.": "समीक्षाएँ स्कैन करने से पहले मुफ्त खाता बनाएँ।",
    "Create free account": "मुफ्त खाता बनाएँ",
    "How scanning works": "स्कैन कैसे काम करता है",
    "Paste reviews inside Analyzer": "विश्लेषक में समीक्षाएँ पेस्ट करें",
    "Run AI scan": "AI स्कैन चलाएँ",
    "Save result to your account": "परिणाम अपने खाते में सेव करें",
    "AI review scanner": "AI समीक्षा स्कैनर",
    "Paste reviews. Get the buying answer.": "समीक्षाएँ पेस्ट करें। खरीद जवाब पाएँ।",
    "Overall score": "कुल स्कोर",
    "Shared score": "साझा स्कोर",
    Buy: "खरीदें",
    "Worth buying": "खरीदने योग्य",
    "Fast verdict": "तेज़ निर्णय",
    "Fake risk": "फर्जी जोखिम",
    "Pattern check": "पैटर्न जाँच",
    "Money call": "मूल्य निर्णय",
    "Shopper quick answer": "तेज़ शॉपर जवाब",
    "Shopper recommendation": "शॉपर सुझाव",
    "Seller analytics": "विक्रेता विश्लेषण",
    "Shopper + seller intelligence": "शॉपर + विक्रेता इंटेलिजेंस",
    "Instant shopper answer": "तुरंत शॉपर जवाब",
    "Deep customer intelligence": "गहरी ग्राहक जानकारी",
    "Dual Mode": "डुअल मोड",
    Verdict: "निर्णय",
    Strategy: "रणनीति",
    Report: "रिपोर्ट",
    "Seller Pro intelligence": "विक्रेता प्रो इंटेलिजेंस",
    "Shopper + Seller report": "शॉपर + विक्रेता रिपोर्ट",
    "Shopper verdict": "शॉपर निर्णय",
    "Create a free account to scan.": "स्कैन करने के लिए मुफ्त खाता बनाएँ।",
    "Ready to scan this review set.": "यह समीक्षा सेट स्कैन करने के लिए तैयार है।",
    "Sign up or log in to scan": "स्कैन के लिए साइन अप या लॉग इन करें",
    "Scanning...": "स्कैन हो रहा है...",
    "ReviewIntel scan": "ReviewIntel स्कैन",
    "Analyzing review intelligence": "समीक्षा इंटेलिजेंस विश्लेषित हो रही है",
    "Choose the result you want": "अपना परिणाम चुनें",
    "Deep Analysis": "गहरा विश्लेषण",
    "Quick Scan Beta": "क्विक स्कैन बीटा",
    "Run Screenshot Analysis": "स्क्रीनशॉट विश्लेषण चलाएँ",
    "Upgrade unlock": "अपग्रेड अनलॉक",
    "Concrete steps": "ठोस कदम",
    "Copy, paste, scan.": "कॉपी करें, पेस्ट करें, स्कैन करें।",
    Screenshots: "स्क्रीनशॉट",
    "Use Quick Scan": "क्विक स्कैन उपयोग करें",
    "Use Deep Analysis": "गहरा विश्लेषण उपयोग करें",
    "No scan loaded": "कोई स्कैन लोड नहीं",
    "Your latest scan": "आपका नवीनतम स्कैन",
    "Run another scan": "दूसरा स्कैन चलाएँ",
    "Rating breakdown": "रेटिंग विवरण",
    Excellent: "उत्कृष्ट",
    Strong: "मजबूत",
    Watch: "नज़र रखें",
    Concern: "चिंता",
    Critical: "गंभीर",
    "Fix first": "पहले ठीक करें",
    "Risk level": "जोखिम स्तर",
    "Why this score": "यह स्कोर क्यों",
    "Before you buy": "खरीदने से पहले",
    Workspace: "वर्कस्पेस",
    "Shopper Workspace": "शॉपर वर्कस्पेस",
    "Seller Workspace": "विक्रेता वर्कस्पेस",
    "Shopper Home": "शॉपर होम",
    "Seller Home": "विक्रेता होम",
    "Paste Reviews": "समीक्षाएँ पेस्ट करें",
    "Compare Products": "उत्पाद तुलना करें",
    Billing: "बिलिंग",
    "Business intelligence": "व्यावसायिक इंटेलिजेंस",
    "Shopping assistant": "खरीदारी सहायक",
    "Trend snapshot": "ट्रेंड झलक",
    "Shopper dashboard": "शॉपर डैशबोर्ड",
    "Shopping intelligence": "खरीदारी इंटेलिजेंस",
    "Total scans": "कुल स्कैन",
    "Compare first": "पहले तुलना करें",
    "Avoid / fake risk": "बचें / फर्जी जोखिम",
    "Recent scans": "हाल के स्कैन",
    "Latest product checks": "नवीनतम उत्पाद जाँच",
    "Scan product": "उत्पाद स्कैन करें",
    "Clear all": "सब मिटाएँ",
    Preview: "पूर्वावलोकन",
    "Full result": "पूरा परिणाम",
    Delete: "हटाएँ",
    "Best finds": "सर्वश्रेष्ठ खोजें",
    "Products worth buying will appear here": "खरीदने योग्य उत्पाद यहाँ दिखेंगे",
    "No high fake-review risk alerts saved yet": "अभी तक कोई उच्च फर्जी-समीक्षा जोखिम अलर्ट सेव नहीं है",
    "No strong pattern detected.": "कोई मजबूत पैटर्न नहीं मिला।",
    "Buying confidence": "खरीद भरोसा",
    Close: "बंद करें",
    "Seller dashboard": "विक्रेता डैशबोर्ड",
    "Seller Pro summary": "विक्रेता प्रो सारांश",
    "Run more seller scans to build a clearer product improvement map. The dashboard becomes more useful as your saved scan history grows.":
      "स्पष्ट उत्पाद सुधार मैप बनाने के लिए और विक्रेता स्कैन चलाएँ। सेव किया गया स्कैन इतिहास बढ़ने पर डैशबोर्ड अधिक उपयोगी होगा।",
    "Products tracked": "ट्रैक किए उत्पाद",
    "Scans this month": "इस महीने स्कैन",
    "Avg product score": "औसत उत्पाद स्कोर",
    "Improvement focus": "सुधार फोकस",
    Priority: "प्राथमिकता",
    "Buyer concerns": "खरीदार चिंताएँ",
    "Buyer concerns will appear after saved seller scans": "सेव किए गए विक्रेता स्कैन के बाद खरीदार चिंताएँ दिखेंगी",
    "Next moves": "अगले कदम",
    "Seller actions will appear after saved seller scans": "सेव किए गए विक्रेता स्कैन के बाद विक्रेता कार्रवाइयाँ दिखेंगी",
    "Winning signals": "मजबूत संकेत",
    "Positive buyer signals will appear after saved seller scans": "सेव किए गए विक्रेता स्कैन के बाद सकारात्मक खरीदार संकेत दिखेंगे",
    "Report center": "रिपोर्ट केंद्र",
    "Seller Pro feature": "विक्रेता प्रो सुविधा",
    "Daily product improvement journal": "दैनिक उत्पाद सुधार जर्नल",
    "The saved scan calendar is reserved for Seller Pro. Seller Premium keeps product tracking, while Seller Pro adds scan history, dated notes, and improvement journaling.":
      "सेव किया गया स्कैन कैलेंडर विक्रेता प्रो के लिए आरक्षित है। विक्रेता प्रीमियम उत्पाद ट्रैकिंग रखता है, जबकि विक्रेता प्रो स्कैन इतिहास, तारीख वाली नोट्स और सुधार जर्नल जोड़ता है।",
    "Tracked products": "ट्रैक किए उत्पाद",
    "Product manager": "उत्पाद प्रबंधक",
    "Search products...": "उत्पाद खोजें...",
    "All priorities": "सभी प्राथमिकताएँ",
    Improve: "सुधारें",
    "All products": "सभी उत्पाद",
    Scans: "स्कैन",
    Latest: "नवीनतम",
    "AI review intelligence": "AI समीक्षा इंटेलिजेंस",
    "AI shopping intelligence for shoppers and ecommerce sellers, with clear support, billing, privacy, and subscription controls.":
      "शॉपर्स और ecommerce sellers के लिए AI shopping intelligence, साफ support, billing, privacy और subscription controls के साथ।",
    "Support:": "सहायता:",
    "Billing:": "बिलिंग:"
  }
} satisfies Partial<Record<ReviewIntelLocale, Record<string, string>>>;

const dynamicPhraseParts = {
  fr: {
    "valid reviews": "avis valides",
    chars: "caractères",
    sections: "sections",
    screens: "captures",
    ratings: "notes",
    score: "Score",
    sentiment: "Sentiment",
    productFound: (count: string) => `${count} produit${count === "1" ? "" : "s"} trouvé${count === "1" ? "" : "s"}`,
    scanCount: (count: string) => `${count} analyse${count === "1" ? "" : "s"}`,
    averageBuyingScore: (score: string) => `Score d’achat moyen : ${score}%`
  },
  es: {
    "valid reviews": "reseñas válidas",
    chars: "caracteres",
    sections: "secciones",
    screens: "capturas",
    ratings: "calificaciones",
    score: "Puntuación",
    sentiment: "Sentimiento",
    productFound: (count: string) => `${count} producto${count === "1" ? "" : "s"} encontrado${count === "1" ? "" : "s"}`,
    scanCount: (count: string) => `${count} análisis`,
    averageBuyingScore: (score: string) => `Puntuación media de compra: ${score}%`
  },
  zh: {
    "valid reviews": "条有效评价",
    chars: "个字符",
    sections: "个部分",
    screens: "张截图",
    ratings: "个评分",
    score: "评分",
    sentiment: "情绪",
    productFound: (count: string) => `找到 ${count} 个产品`,
    scanCount: (count: string) => `${count} 次分析`,
    averageBuyingScore: (score: string) => `平均购买评分：${score}%`
  },
  de: {
    "valid reviews": "gültige Bewertungen",
    chars: "Zeichen",
    sections: "Abschnitte",
    screens: "Screenshots",
    ratings: "Bewertungen",
    score: "Score",
    sentiment: "Stimmung",
    productFound: (count: string) => `${count} Produkt${count === "1" ? "" : "e"} gefunden`,
    scanCount: (count: string) => `${count} Analyse${count === "1" ? "" : "n"}`,
    averageBuyingScore: (score: string) => `Durchschnittlicher Kaufscore: ${score}%`
  },
  hi: {
    "valid reviews": "मान्य समीक्षाएँ",
    chars: "अक्षर",
    sections: "सेक्शन",
    screens: "स्क्रीन",
    ratings: "रेटिंग",
    score: "स्कोर",
    sentiment: "भावना",
    productFound: (count: string) => `${count} उत्पाद मिले`,
    scanCount: (count: string) => `${count} स्कैन`,
    averageBuyingScore: (score: string) => `औसत खरीद स्कोर: ${score}%`
  }
} satisfies Record<Exclude<ReviewIntelLocale, "en">, Record<string, string | ((value: string) => string)>>;

const siteWidePhraseTranslations = {
  fr: {
    Trust: "Confiance",
    "SEO pages": "Pages SEO",
    "User Reviews": "Avis utilisateurs",
    "Acceptable Use": "Utilisation acceptable",
    "Shopper Review Analyzer": "Analyseur d’avis acheteur",
    "Amazon Review Analyzer": "Analyseur d’avis Amazon",
    "Fake Review Detector": "Détecteur de faux avis",
    "Seller Review Analytics": "Analyse des avis vendeur",
    "Refund Policy": "Politique de remboursement",
    "Contact customer service": "Contacter le service client",
    "Read Acceptable Use": "Lire l’utilisation acceptable",
    "Request data deletion": "Demander la suppression des données",
    "Open Billing Support": "Ouvrir l’assistance facturation",
    "Contact Privacy Support": "Contacter l’assistance confidentialité",
    "Last updated": "Dernière mise à jour",
    "June 1, 2026": "1 juin 2026",
    "Need help with this page?": "Besoin d’aide avec cette page ?",
    "Email support@getreviewintel.com or open the support form.": "Écrivez à support@getreviewintel.com ou ouvrez le formulaire d’assistance.",
    "Open FAQ": "Ouvrir la FAQ",
    "Terms of Use": "Conditions d’utilisation",
    "Simple rules for using ReviewIntel": "Règles simples pour utiliser ReviewIntel",
    "These terms explain how ReviewIntel can be used, what accounts are responsible for, and where the product boundaries are.":
      "Ces conditions expliquent comment utiliser ReviewIntel, ce dont les comptes sont responsables et les limites du produit.",
    "Using the service": "Utilisation du service",
    "You may use ReviewIntel to analyze review text, uploaded review files, and screenshots that you have the right to submit. You are responsible for the content you upload and how you use the results.":
      "Vous pouvez utiliser ReviewIntel pour analyser des avis, fichiers et captures que vous avez le droit de soumettre. Vous êtes responsable du contenu envoyé et de l’usage des résultats.",
    "Accounts and subscriptions": "Comptes et abonnements",
    "Shopper Free usage may be limited. Shopper Premium and Seller subscriptions unlock additional usage and features. You must keep your login information secure and use accurate billing information.":
      "L’usage d’Acheteur gratuit peut être limité. Les abonnements Acheteur Premium et Vendeur débloquent plus d’usage et de fonctionnalités. Gardez vos identifiants sécurisés et vos informations de facturation exactes.",
    "Prohibited use": "Utilisation interdite",
    "You may not use ReviewIntel to upload unlawful content, personal data you are not allowed to process, malware, spam, deceptive material, or content intended to abuse marketplaces or reviewers.":
      "Vous ne pouvez pas utiliser ReviewIntel pour téléverser du contenu illégal, des données personnelles non autorisées, des logiciels malveillants, du spam, du contenu trompeur ou visant à abuser des marketplaces ou des auteurs d’avis.",
    "Do not upload private customer data unless you have permission and a lawful reason.": "Ne téléversez pas de données client privées sans permission ni base légale.",
    "Do not use the product to create fake reviews or manipulate marketplace trust systems.": "N’utilisez pas le produit pour créer de faux avis ou manipuler les systèmes de confiance.",
    "Do not attempt to reverse engineer, overload, or bypass usage limits.": "N’essayez pas de rétroconcevoir, surcharger ou contourner les limites d’usage.",
    Availability: "Disponibilité",
    "ReviewIntel may change features, limits, pricing, or integrations as the service improves. We aim for reliable access, but uptime is not guaranteed.":
      "ReviewIntel peut modifier ses fonctionnalités, limites, tarifs ou intégrations. Nous visons un accès fiable, mais la disponibilité n’est pas garantie.",
    "Privacy Policy": "Politique de confidentialité",
    "How ReviewIntel handles customer data": "Comment ReviewIntel traite les données client",
    "ReviewIntel collects account, billing, and review-analysis data needed to run the product. We keep the policy readable so customers know what is happening.":
      "ReviewIntel collecte les données de compte, facturation et analyse nécessaires au fonctionnement du produit. La politique reste lisible pour que les clients comprennent ce qui se passe.",
    "Information we process": "Informations traitées",
    "We may process account email, plan type, login metadata, uploaded review text, uploaded screenshots, analysis results, usage counts, and billing identifiers from payment providers.":
      "Nous pouvons traiter l’e-mail du compte, le type de forfait, les métadonnées de connexion, les avis et captures envoyés, les résultats d’analyse, les compteurs d’usage et les identifiants de facturation.",
    "Review text and screenshots are used to produce analysis results.": "Les avis et captures servent à produire les résultats d’analyse.",
    "Billing data is handled through payment providers such as Stripe when configured.": "Les données de facturation sont traitées par des prestataires comme Stripe lorsqu’ils sont configurés.",
    "Admin and support actions may record operational notes for troubleshooting.": "Les actions d’administration et de support peuvent enregistrer des notes opérationnelles de dépannage.",
    "How we use information": "Utilisation des informations",
    "We use information to provide analysis, enforce usage limits, manage subscriptions, improve product quality, detect abuse, and respond to support requests.":
      "Nous utilisons les informations pour fournir l’analyse, appliquer les limites, gérer les abonnements, améliorer le produit, détecter les abus et répondre au support.",
    "Data requests": "Demandes de données",
    "For deletion, access, export, or correction requests, email privacy@reviewintel.ai or use the Delete Account / Data Request page.":
      "Pour supprimer, consulter, exporter ou corriger vos données, écrivez à privacy@reviewintel.ai ou utilisez la page Supprimer le compte / demande de données.",
    Retention: "Conservation",
    "We keep information only as long as needed for product operation, legal obligations, billing records, security, and customer support.":
      "Nous conservons les informations seulement le temps nécessaire au produit, aux obligations légales, à la facturation, à la sécurité et au support.",
    Disclaimer: "Avertissement",
    "Product guidance, not guaranteed truth": "Conseil produit, pas vérité garantie",
    "ReviewIntel summarizes review signals and likely patterns. It is designed to help shoppers and sellers think faster, not replace personal judgment, professional advice, or platform policy review.":
      "ReviewIntel résume les signaux et tendances probables des avis. Il aide acheteurs et vendeurs à réfléchir plus vite, sans remplacer le jugement personnel, un avis professionnel ou les règles d’une plateforme.",
    "AI analysis boundaries": "Limites de l’analyse IA",
    "ReviewIntel may use AI and local analysis to estimate sentiment, fake-review risk, common complaints, value, and recommendations. AI output can be incomplete or wrong, especially when users paste limited, biased, or low-quality review samples.":
      "ReviewIntel peut utiliser l’IA et l’analyse locale pour estimer le sentiment, le risque de faux avis, les plaintes, la valeur et les recommandations. Les sorties IA peuvent être incomplètes ou fausses, surtout avec peu d’avis ou des avis biaisés.",
    "ReviewIntel does not guarantee a product is good, bad, safe, authentic, or compliant.": "ReviewIntel ne garantit pas qu’un produit soit bon, mauvais, sûr, authentique ou conforme.",
    "ReviewIntel does not verify every reviewer, transaction, order, seller, or marketplace listing.": "ReviewIntel ne vérifie pas chaque auteur d’avis, transaction, commande, vendeur ou fiche marketplace.",
    "You should confirm important product, safety, refund, medical, legal, financial, or warranty details from authoritative sources.":
      "Confirmez les détails importants sur le produit, la sécurité, les remboursements, la médecine, le droit, la finance ou la garantie auprès de sources fiables.",
    "No scraping or marketplace endorsement": "Pas de scraping ni d’approbation marketplace",
    "Users manually paste review text or upload screenshots. ReviewIntel is not affiliated with Amazon, Walmart, TikTok Shop, Etsy, eBay, Shopify, or other marketplaces unless expressly stated.":
      "Les utilisateurs collent les avis ou téléversent des captures manuellement. ReviewIntel n’est pas affilié à Amazon, Walmart, TikTok Shop, Etsy, eBay, Shopify ou autres marketplaces sauf mention contraire.",
    "Seller use": "Usage vendeur",
    "Seller analytics are intended to identify product improvement themes, not to manipulate reviews, pressure customers, or bypass platform rules.":
      "Les analyses vendeur servent à trouver des thèmes d’amélioration produit, pas à manipuler les avis, faire pression sur les clients ou contourner les règles.",
    "Clear billing expectations": "Attentes de facturation claires",
    "ReviewIntel subscriptions are built for self-service cancellation and transparent billing support. This page explains how refund reviews work.":
      "Les abonnements ReviewIntel sont conçus pour l’annulation en libre-service et une assistance facturation claire. Cette page explique l’examen des remboursements.",
    "Subscription cancellation": "Annulation d’abonnement",
    "You can cancel future renewals from Manage Subscription or by contacting billing support. Cancellation stops future billing but does not automatically refund previous charges.":
      "Vous pouvez annuler les renouvellements futurs depuis Gérer l’abonnement ou via l’assistance facturation. L’annulation arrête les futures factures mais ne rembourse pas automatiquement les paiements passés.",
    "Refund review": "Examen du remboursement",
    "Refund requests are reviewed case by case. Include the account email, plan, charge date, and reason so support can locate the subscription quickly.":
      "Les demandes de remboursement sont examinées au cas par cas. Indiquez l’e-mail du compte, le forfait, la date du paiement et la raison pour aider le support.",
    "Duplicate charges and accidental upgrades are prioritized.": "Les paiements en double et mises à niveau accidentelles sont prioritaires.",
    "Refunds may be limited when the service was heavily used during the billing period.": "Les remboursements peuvent être limités si le service a beaucoup été utilisé pendant la période facturée.",
    "Payment processor timing can affect how quickly funds appear back on a card.": "Les délais du processeur de paiement peuvent influencer le retour des fonds sur la carte.",
    "How to request help": "Comment demander de l’aide",
    "Email support@getreviewintel.com or open the Billing Support page for the fastest path.": "Écrivez à support@getreviewintel.com ou ouvrez l’assistance facturation pour aller plus vite.",
    "FAQ": "FAQ",
    "Fast answers for shoppers and sellers": "Réponses rapides pour acheteurs et vendeurs",
    "Common questions about ReviewIntel analysis, screenshots, subscriptions, fake-review risk, seller reports, and account support.":
      "Questions fréquentes sur l’analyse ReviewIntel, les captures, les abonnements, le risque de faux avis, les rapports vendeur et le support compte.",
    "What does ReviewIntel analyze?": "Qu’analyse ReviewIntel ?",
    "It analyzes pasted review text, TXT or CSV batches, and screenshot uploads. It estimates review volume, sentiment, complaints, fake-review risk, value for money, and recommendation signals.":
      "Il analyse les avis collés, lots TXT/CSV et captures. Il estime le volume d’avis, le sentiment, les plaintes, le risque de faux avis, le rapport qualité-prix et les signaux de recommandation.",
    "Is Shopper Mode different from Seller Mode?": "Le mode acheteur diffère-t-il du mode vendeur ?",
    "Yes. Shopper Mode gives a fast buying verdict. Seller Mode produces deeper business intelligence with complaint clusters, feature requests, positioning ideas, and improvement actions.":
      "Oui. Le mode acheteur donne un verdict rapide. Le mode vendeur produit une intelligence commerciale plus profonde avec groupes de plaintes, demandes de fonctionnalités, idées de positionnement et actions.",
    "Can ReviewIntel prove a review is fake?": "ReviewIntel peut-il prouver qu’un avis est faux ?",
    "No. It estimates fake-review risk using language patterns, repetition, review quality, and evidence strength. Treat the score as a risk signal, not a legal finding.":
      "Non. Il estime le risque de faux avis via les motifs de langage, la répétition, la qualité des avis et la force des preuves. Traitez le score comme un signal de risque, pas une conclusion juridique.",
    "How many reviews should I paste?": "Combien d’avis dois-je coller ?",
    "More review text usually improves confidence. For quick shopping decisions, a few dozen reviews can help. For Seller Pro decisions, larger CSV or TXT batches are better.":
      "Plus de texte améliore souvent la confiance. Pour acheter vite, quelques dizaines d’avis aident. Pour Vendeur Pro, de grands lots CSV ou TXT sont préférables.",
    "How do I cancel?": "Comment annuler ?",
    "Open Manage Subscription from the footer or account page. If the billing portal is unavailable, contact Billing Support and include your account email.":
      "Ouvrez Gérer l’abonnement depuis le pied de page ou le compte. Si le portail est indisponible, contactez l’assistance facturation avec votre e-mail.",
    "Contact / Customer Service": "Contact / service client",
    "We are here to help": "Nous sommes là pour aider",
    "For product help, billing questions, account access, or data requests, email support@getreviewintel.com. Use the form below to prepare a clear support message.":
      "Pour l’aide produit, la facturation, l’accès au compte ou les demandes de données, écrivez à support@getreviewintel.com. Utilisez le formulaire pour préparer un message clair.",
    "Customer service": "Service client",
    "Use support@getreviewintel.com for general support. Include your account email, plan, page URL, and a short description of what happened.":
      "Utilisez support@getreviewintel.com pour l’assistance générale. Incluez l’e-mail du compte, le forfait, l’URL de la page et une courte description.",
    Billing: "Facturation",
    "For charges, cancellations, or invoices, contact support@getreviewintel.com or open Billing Support.":
      "Pour les paiements, annulations ou factures, contactez support@getreviewintel.com ou ouvrez l’assistance facturation.",
    "Privacy and data": "Confidentialité et données",
    "For access, deletion, or export requests, contact privacy@reviewintel.ai or open Delete Account / Data Request.":
      "Pour l’accès, la suppression ou l’exportation, contactez privacy@reviewintel.ai ou ouvrez Supprimer le compte / demande de données.",
    "Unsubscribe / Manage Product Subscription": "Se désabonner / gérer l’abonnement produit",
    "Control your plan clearly": "Contrôlez clairement votre forfait",
    "Manage billing, cancel renewal, downgrade, or contact support if you cannot access the billing portal.":
      "Gérez la facturation, annulez le renouvellement, rétrogradez ou contactez le support si le portail est inaccessible.",
    "Self-service billing portal": "Portail de facturation en libre-service",
    "Logged-in paid users can open the billing portal from this page or the Account page. Admin and local development accounts may see a simulated portal during development.":
      "Les utilisateurs payants connectés peuvent ouvrir le portail ici ou depuis le compte. Les comptes admin et de développement local peuvent voir un portail simulé.",
    "Cancel or downgrade": "Annuler ou rétrograder",
    "Canceling stops future renewals. Downgrading changes future access according to the selected plan. If a portal link fails, email billing support with your account email.":
      "L’annulation arrête les renouvellements futurs. La rétrogradation change l’accès futur selon le forfait. Si le lien échoue, écrivez au support facturation avec votre e-mail.",
    "Need help?": "Besoin d’aide ?",
    "Email support@getreviewintel.com and include your account email, plan, and what you want changed.":
      "Écrivez à support@getreviewintel.com avec l’e-mail du compte, le forfait et le changement souhaité.",
    "Billing Support": "Assistance facturation",
    "Charges, invoices, cancellations": "Paiements, factures, annulations",
    "Billing support helps with subscriptions, failed checkout, duplicate charges, cancellation questions, and invoice requests.":
      "L’assistance facturation aide pour les abonnements, paiements échoués, paiements en double, annulations et demandes de facture.",
    "What to include": "À inclure",
    "Include your account email, plan, charge date, last four digits of the card if available, and what you need changed.":
      "Incluez l’e-mail du compte, le forfait, la date du paiement, les quatre derniers chiffres de la carte si disponibles et le changement demandé.",
    "Fastest path": "Chemin le plus rapide",
    "Use Manage Subscription first for cancellation and card updates. Contact billing support if the portal cannot find your subscription.":
      "Utilisez d’abord Gérer l’abonnement pour annuler ou modifier la carte. Contactez la facturation si le portail ne trouve pas votre abonnement.",
    "Account Support": "Assistance compte",
    "Login, plan, workspace, access": "Connexion, forfait, espace, accès",
    "Get help with login issues, email verification, password reset, wrong workspace mode, or plan access.":
      "Obtenez de l’aide pour la connexion, la vérification e-mail, le mot de passe, le mauvais espace ou l’accès au forfait.",
    "Login and access": "Connexion et accès",
    "Use password reset if you cannot sign in. If your paid plan is missing, include your account email and payment email when contacting support.":
      "Utilisez la réinitialisation si vous ne pouvez pas vous connecter. Si un forfait payé manque, incluez l’e-mail du compte et de paiement.",
    "Shopper, Seller, and Admin modes": "Modes acheteur, vendeur et admin",
    "Shopper tools are designed for buying decisions. Seller tools are designed for business intelligence. Admin controls are private developer and operations tools.":
      "Les outils acheteur servent aux décisions d’achat. Les outils vendeur servent à l’intelligence commerciale. Les contrôles admin sont privés pour le développement et les opérations.",
    "Delete Account / Data Request": "Supprimer le compte / demande de données",
    "Control your data": "Contrôlez vos données",
    "Request account deletion, review-data deletion, access, correction, or export. We will use your account email to verify the request.":
      "Demandez la suppression du compte ou des analyses, l’accès, la correction ou l’exportation. Nous utiliserons l’e-mail du compte pour vérifier la demande.",
    "Request types": "Types de demandes",
    "You can request account deletion, analysis deletion, data export, correction, or privacy questions.":
      "Vous pouvez demander la suppression du compte, la suppression d’analyses, l’export, la correction ou poser des questions de confidentialité.",
    "Use the same email address as your ReviewIntel account.": "Utilisez la même adresse e-mail que votre compte ReviewIntel.",
    "Tell us whether you want account deletion or only specific analysis data removed.": "Indiquez si vous voulez supprimer le compte ou seulement certaines analyses.",
    "Billing records may need to be retained where required by law or payment processors.": "Les dossiers de facturation peuvent être conservés si la loi ou les processeurs l’exigent.",
    "Where to send requests": "Où envoyer les demandes",
    "Email privacy@reviewintel.ai or use the customer service form.": "Écrivez à privacy@reviewintel.ai ou utilisez le formulaire de service client.",
    "Cookie Policy": "Politique relative aux cookies",
    "Cookies and local storage": "Cookies et stockage local",
    "ReviewIntel uses cookies and browser storage for login state, account role, plan mode, quotas, preferences, and product operation.":
      "ReviewIntel utilise des cookies et le stockage du navigateur pour la connexion, le rôle, le forfait, les quotas, les préférences et le fonctionnement du produit.",
    "Essential storage": "Stockage essentiel",
    "The app may store account role, plan, active mode, quota state, guest ID, and theme preference so the product works between page loads.":
      "L’app peut stocker le rôle, le forfait, le mode actif, le quota, l’ID invité et le thème pour fonctionner entre les chargements.",
    "Analytics and marketing": "Analytique et marketing",
    "If analytics, ads, or marketing tools are added, ReviewIntel should clearly disclose the provider and purpose before relying on non-essential tracking.":
      "Si des outils d’analytique, publicité ou marketing sont ajoutés, ReviewIntel doit indiquer clairement le fournisseur et le but avant tout suivi non essentiel.",
    "Managing storage": "Gestion du stockage",
    "You can clear cookies or local storage from your browser settings. Doing so may log you out, reset local workspace mode, or reset local quota display.":
      "Vous pouvez effacer les cookies ou le stockage local dans le navigateur. Cela peut vous déconnecter, réinitialiser l’espace local ou l’affichage du quota.",
    "Acceptable Use Policy": "Politique d’utilisation acceptable",
    "Keep review intelligence honest": "Gardez l’intelligence des avis honnête",
    "ReviewIntel should be used to understand customer feedback, not to abuse marketplaces, customers, or AI systems.":
      "ReviewIntel doit servir à comprendre les retours clients, pas à abuser des marketplaces, clients ou systèmes IA.",
    "Allowed use": "Usage autorisé",
    "Analyze product reviews, compare product feedback, identify complaints, improve listings, and understand customer satisfaction.":
      "Analyser les avis produit, comparer les retours, identifier les plaintes, améliorer les fiches et comprendre la satisfaction client.",
    "Not allowed": "Non autorisé",
    "Do not use ReviewIntel to generate fake reviews, harass reviewers, upload stolen private data, bypass platform terms, or misrepresent AI output as verified fact.":
      "N’utilisez pas ReviewIntel pour générer de faux avis, harceler des auteurs, téléverser des données volées, contourner des règles ou présenter l’IA comme un fait vérifié.",
    "No fake-review creation or review manipulation.": "Pas de création de faux avis ni de manipulation.",
    "No illegal, hateful, abusive, or privacy-invasive uploads.": "Pas de téléversements illégaux, haineux, abusifs ou intrusifs.",
    "No attempts to overload, probe, or bypass the app's security and quota systems.": "Aucune tentative de surcharge, sondage ou contournement de la sécurité et des quotas.",
    Enforcement: "Application",
    "Accounts may be limited, suspended, or terminated if they abuse the service or create risk for customers, marketplaces, or ReviewIntel.":
      "Les comptes peuvent être limités, suspendus ou fermés en cas d’abus ou de risque pour les clients, marketplaces ou ReviewIntel.",
    About: "À propos",
    "ReviewIntel is built for clearer review-driven decisions.": "ReviewIntel aide à prendre des décisions plus claires à partir des avis.",
    "Customer goal": "Objectif client",
    "Shoppers get a fast read on quality, complaints, praised features, value, and buying risk without reading pages of reviews.":
      "Les acheteurs obtiennent rapidement la qualité, les plaintes, les points appréciés, la valeur et le risque sans lire des pages d’avis.",
    "Seller goal": "Objectif vendeur",
    "Sellers get product improvement signals, listing fixes, packaging issues, refund-risk themes, and competitor openings.":
      "Les vendeurs obtiennent des signaux d’amélioration, corrections de fiche, problèmes d’emballage, thèmes de remboursement et opportunités concurrentielles.",
    "Product boundary": "Limite produit",
    "ReviewIntel does not scrape ecommerce or review websites. Users manually paste review text or upload screenshots from any supported source so the workflow stays platform-neutral and scalable.":
      "ReviewIntel ne scrape pas les sites e-commerce ou d’avis. Les utilisateurs collent les avis ou téléversent des captures afin de garder un flux neutre et évolutif.",
    "Open Analyzer": "Ouvrir l’analyseur",
    Advertisement: "Publicité",
    "Advertise with ReviewIntel": "Faire de la publicité avec ReviewIntel",
    "Reach shoppers, sellers, and product researchers directly inside an AI review intelligence platform.":
      "Touchez directement les acheteurs, vendeurs et chercheurs produit dans une plateforme d’intelligence d’avis IA.",
    "Partner with ReviewIntel": "Partenaire de ReviewIntel",
    "Clean sponsored placements for brands, tools, and services that help online shoppers and sellers.":
      "Placements sponsorisés clairs pour les marques, outils et services qui aident les acheteurs et vendeurs en ligne.",
    "Apply now": "Postuler maintenant",
    "Feature your ecommerce tool, product service, or seller resource.": "Mettez en avant votre outil e-commerce, service produit ou ressource vendeur.",
    "Advertisers pay, upload a banner or short video, and ReviewIntel verifies payment plus creative quality before any campaign goes live.":
      "Les annonceurs paient, téléversent une bannière ou une courte vidéo, puis ReviewIntel vérifie le paiement et la qualité créative avant toute diffusion.",
    Featured: "En vedette",
    Sponsored: "Sponsorisé",
    "Sponsored Resource Placement": "Placement de ressource sponsorisée",
    "Featured Sponsored Resource": "Ressource sponsorisée en vedette",
    "What happens after payment?": "Que se passe-t-il après le paiement ?",
    "We manually review each sponsored resource before publishing. We may reject irrelevant, unsafe, misleading, or low-quality placements and issue a refund when appropriate.":
      "Nous examinons chaque ressource avant publication. Nous pouvons refuser les placements non pertinents, dangereux, trompeurs ou de faible qualité et rembourser si approprié.",
    "Contact before paying": "Contacter avant de payer",
    "Stripe-ready subscriptions": "Abonnements prêts pour Stripe",
    "Shopper Free users can analyze 3 products per day. Premium plans use live Stripe payment links during beta. Access is manually activated after payment until full automation is connected.":
      "Les utilisateurs Acheteur gratuit peuvent analyser 3 produits par jour. Les forfaits Premium utilisent des liens Stripe actifs pendant la bêta. L’accès est activé manuellement après paiement jusqu’à l’automatisation complète."
  },
  es: {
    Trust: "Confianza",
    "SEO pages": "Páginas SEO",
    "User Reviews": "Reseñas de usuarios",
    "Acceptable Use": "Uso aceptable",
    "Shopper Review Analyzer": "Analizador de reseñas para compradores",
    "Amazon Review Analyzer": "Analizador de reseñas de Amazon",
    "Fake Review Detector": "Detector de reseñas falsas",
    "Seller Review Analytics": "Analítica de reseñas para vendedores",
    "Last updated": "Última actualización",
    "June 1, 2026": "1 de junio de 2026",
    "Need help with this page?": "¿Necesitas ayuda con esta página?",
    "Email support@getreviewintel.com or open the support form.": "Escribe a support@getreviewintel.com o abre el formulario de soporte.",
    "Open FAQ": "Abrir FAQ",
    "Terms of Use": "Términos de uso",
    "Simple rules for using ReviewIntel": "Reglas simples para usar ReviewIntel",
    "These terms explain how ReviewIntel can be used, what accounts are responsible for, and where the product boundaries are.":
      "Estos términos explican cómo se puede usar ReviewIntel, qué responsabilidades tienen las cuentas y cuáles son los límites del producto.",
    "Using the service": "Uso del servicio",
    "You may use ReviewIntel to analyze review text, uploaded review files, and screenshots that you have the right to submit. You are responsible for the content you upload and how you use the results.":
      "Puedes usar ReviewIntel para analizar reseñas, archivos y capturas que tengas derecho a enviar. Eres responsable del contenido que subes y de cómo usas los resultados.",
    "Accounts and subscriptions": "Cuentas y suscripciones",
    "Prohibited use": "Uso prohibido",
    Availability: "Disponibilidad",
    "Privacy Policy": "Política de privacidad",
    "How ReviewIntel handles customer data": "Cómo ReviewIntel maneja los datos del cliente",
    "Information we process": "Información que procesamos",
    "How we use information": "Cómo usamos la información",
    "Data requests": "Solicitudes de datos",
    Retention: "Retención",
    Disclaimer: "Aviso legal",
    "Product guidance, not guaranteed truth": "Orientación de producto, no verdad garantizada",
    "AI analysis boundaries": "Límites del análisis IA",
    "No scraping or marketplace endorsement": "Sin scraping ni respaldo de marketplaces",
    "Seller use": "Uso del vendedor",
    "Refund Policy": "Política de reembolso",
    "Clear billing expectations": "Expectativas claras de facturación",
    "Subscription cancellation": "Cancelación de suscripción",
    "Refund review": "Revisión de reembolso",
    "How to request help": "Cómo pedir ayuda",
    "Fast answers for shoppers and sellers": "Respuestas rápidas para compradores y vendedores",
    "Common questions about ReviewIntel analysis, screenshots, subscriptions, fake-review risk, seller reports, and account support.":
      "Preguntas comunes sobre análisis, capturas, suscripciones, riesgo de reseñas falsas, informes de vendedor y soporte de cuenta.",
    "What does ReviewIntel analyze?": "¿Qué analiza ReviewIntel?",
    "Is Shopper Mode different from Seller Mode?": "¿El modo comprador es diferente del modo vendedor?",
    "Can ReviewIntel prove a review is fake?": "¿ReviewIntel puede probar que una reseña es falsa?",
    "How many reviews should I paste?": "¿Cuántas reseñas debo pegar?",
    "How do I cancel?": "¿Cómo cancelo?",
    "Contact / Customer Service": "Contacto / servicio al cliente",
    "We are here to help": "Estamos aquí para ayudar",
    "Customer service": "Servicio al cliente",
    "Privacy and data": "Privacidad y datos",
    "Unsubscribe / Manage Product Subscription": "Cancelar / administrar suscripción del producto",
    "Control your plan clearly": "Controla tu plan claramente",
    "Self-service billing portal": "Portal de facturación de autoservicio",
    "Cancel or downgrade": "Cancelar o bajar de plan",
    "Need help?": "¿Necesitas ayuda?",
    "Billing Support": "Soporte de facturación",
    "Charges, invoices, cancellations": "Cargos, facturas, cancelaciones",
    "What to include": "Qué incluir",
    "Fastest path": "Ruta más rápida",
    "Account Support": "Soporte de cuenta",
    "Login, plan, workspace, access": "Inicio de sesión, plan, espacio, acceso",
    "Login and access": "Inicio de sesión y acceso",
    "Shopper, Seller, and Admin modes": "Modos comprador, vendedor y admin",
    "Delete Account / Data Request": "Eliminar cuenta / solicitud de datos",
    "Control your data": "Controla tus datos",
    "Request types": "Tipos de solicitud",
    "Where to send requests": "Dónde enviar solicitudes",
    "Cookie Policy": "Política de cookies",
    "Cookies and local storage": "Cookies y almacenamiento local",
    "Essential storage": "Almacenamiento esencial",
    "Analytics and marketing": "Analítica y marketing",
    "Managing storage": "Gestión del almacenamiento",
    "Acceptable Use Policy": "Política de uso aceptable",
    "Keep review intelligence honest": "Mantén honesta la inteligencia de reseñas",
    "Allowed use": "Uso permitido",
    "Not allowed": "No permitido",
    Enforcement: "Aplicación",
    "ReviewIntel is built for clearer review-driven decisions.": "ReviewIntel está creado para decisiones más claras basadas en reseñas.",
    "Customer goal": "Objetivo del cliente",
    "Seller goal": "Objetivo del vendedor",
    "Product boundary": "Límite del producto",
    "Open Analyzer": "Abrir analizador",
    Advertisement: "Anuncio",
    "Advertise with ReviewIntel": "Anúnciate con ReviewIntel",
    "Reach shoppers, sellers, and product researchers directly inside an AI review intelligence platform.":
      "Llega directamente a compradores, vendedores e investigadores de productos dentro de una plataforma de inteligencia de reseñas con IA.",
    "Partner with ReviewIntel": "Asóciate con ReviewIntel",
    "Clean sponsored placements for brands, tools, and services that help online shoppers and sellers.":
      "Espacios patrocinados claros para marcas, herramientas y servicios que ayudan a compradores y vendedores online.",
    "Apply now": "Solicitar ahora",
    "Feature your ecommerce tool, product service, or seller resource.": "Destaca tu herramienta ecommerce, servicio de producto o recurso para vendedores.",
    Featured: "Destacado",
    Sponsored: "Patrocinado",
    "Sponsored Resource Placement": "Ubicación de recurso patrocinado",
    "Featured Sponsored Resource": "Recurso patrocinado destacado",
    "What happens after payment?": "¿Qué pasa después del pago?",
    "Contact before paying": "Contactar antes de pagar",
    "Stripe-ready subscriptions": "Suscripciones listas para Stripe"
  },
  de: {
    Trust: "Vertrauen",
    "SEO pages": "SEO-Seiten",
    "User Reviews": "Nutzerbewertungen",
    "Acceptable Use": "Akzeptable Nutzung",
    "Shopper Review Analyzer": "Käufer-Bewertungsanalysator",
    "Amazon Review Analyzer": "Amazon-Bewertungsanalysator",
    "Fake Review Detector": "Detektor für Fake-Bewertungen",
    "Seller Review Analytics": "Verkäufer-Bewertungsanalyse",
    "Last updated": "Zuletzt aktualisiert",
    "June 1, 2026": "1. Juni 2026",
    "Need help with this page?": "Brauchst du Hilfe mit dieser Seite?",
    "Email support@getreviewintel.com or open the support form.": "Schreibe an support@getreviewintel.com oder öffne das Supportformular.",
    "Open FAQ": "FAQ öffnen",
    "Terms of Use": "Nutzungsbedingungen",
    "Simple rules for using ReviewIntel": "Einfache Regeln für ReviewIntel",
    "Using the service": "Nutzung des Dienstes",
    "Accounts and subscriptions": "Konten und Abonnements",
    "Prohibited use": "Verbotene Nutzung",
    Availability: "Verfügbarkeit",
    "Privacy Policy": "Datenschutzerklärung",
    "How ReviewIntel handles customer data": "Wie ReviewIntel Kundendaten verarbeitet",
    "Information we process": "Informationen, die wir verarbeiten",
    "How we use information": "Wie wir Informationen nutzen",
    "Data requests": "Datenanfragen",
    Retention: "Aufbewahrung",
    Disclaimer: "Haftungsausschluss",
    "Product guidance, not guaranteed truth": "Produkthinweise, keine garantierte Wahrheit",
    "AI analysis boundaries": "Grenzen der KI-Analyse",
    "No scraping or marketplace endorsement": "Kein Scraping und keine Marketplace-Bestätigung",
    "Seller use": "Verkäufernutzung",
    "Refund Policy": "Rückerstattungsrichtlinie",
    "Clear billing expectations": "Klare Abrechnungserwartungen",
    "Subscription cancellation": "Abonnement kündigen",
    "Refund review": "Rückerstattungsprüfung",
    "How to request help": "So bittest du um Hilfe",
    "Fast answers for shoppers and sellers": "Schnelle Antworten für Käufer und Verkäufer",
    "What does ReviewIntel analyze?": "Was analysiert ReviewIntel?",
    "Is Shopper Mode different from Seller Mode?": "Unterscheidet sich der Käufermodus vom Verkäufermodus?",
    "Can ReviewIntel prove a review is fake?": "Kann ReviewIntel eine Fake-Bewertung beweisen?",
    "How many reviews should I paste?": "Wie viele Bewertungen soll ich einfügen?",
    "How do I cancel?": "Wie kündige ich?",
    "Contact / Customer Service": "Kontakt / Kundenservice",
    "We are here to help": "Wir helfen dir gern",
    "Customer service": "Kundenservice",
    "Privacy and data": "Datenschutz und Daten",
    "Unsubscribe / Manage Product Subscription": "Abmelden / Produktabo verwalten",
    "Control your plan clearly": "Verwalte deinen Tarif klar",
    "Self-service billing portal": "Self-Service-Abrechnungsportal",
    "Cancel or downgrade": "Kündigen oder herabstufen",
    "Need help?": "Brauchst du Hilfe?",
    "Billing Support": "Abrechnungssupport",
    "Charges, invoices, cancellations": "Zahlungen, Rechnungen, Kündigungen",
    "What to include": "Was du angeben solltest",
    "Fastest path": "Schnellster Weg",
    "Account Support": "Kontosupport",
    "Login, plan, workspace, access": "Login, Tarif, Arbeitsbereich, Zugriff",
    "Login and access": "Login und Zugriff",
    "Shopper, Seller, and Admin modes": "Käufer-, Verkäufer- und Admin-Modi",
    "Delete Account / Data Request": "Konto löschen / Datenanfrage",
    "Control your data": "Kontrolliere deine Daten",
    "Request types": "Anfragetypen",
    "Where to send requests": "Wohin Anfragen gesendet werden",
    "Cookie Policy": "Cookie-Richtlinie",
    "Cookies and local storage": "Cookies und lokaler Speicher",
    "Essential storage": "Notwendiger Speicher",
    "Analytics and marketing": "Analyse und Marketing",
    "Managing storage": "Speicher verwalten",
    "Acceptable Use Policy": "Richtlinie zur akzeptablen Nutzung",
    "Keep review intelligence honest": "Bewertungsintelligenz ehrlich nutzen",
    "Allowed use": "Erlaubte Nutzung",
    "Not allowed": "Nicht erlaubt",
    Enforcement: "Durchsetzung",
    "ReviewIntel is built for clearer review-driven decisions.": "ReviewIntel hilft bei klareren Entscheidungen auf Basis von Bewertungen.",
    "Customer goal": "Kundenziel",
    "Seller goal": "Verkäuferziel",
    "Product boundary": "Produktgrenze",
    "Open Analyzer": "Analysator öffnen",
    Advertisement: "Anzeige",
    "Advertise with ReviewIntel": "Mit ReviewIntel werben",
    "Reach shoppers, sellers, and product researchers directly inside an AI review intelligence platform.":
      "Erreiche Käufer, Verkäufer und Produktrecherche direkt in einer KI-Plattform für Bewertungsintelligenz.",
    "Partner with ReviewIntel": "Partner von ReviewIntel werden",
    "Clean sponsored placements for brands, tools, and services that help online shoppers and sellers.":
      "Saubere gesponserte Platzierungen für Marken, Tools und Services, die Online-Käufern und Verkäufern helfen.",
    "Apply now": "Jetzt bewerben",
    "Feature your ecommerce tool, product service, or seller resource.": "Präsentiere dein E-Commerce-Tool, deinen Produktservice oder deine Verkäuferressource.",
    Featured: "Hervorgehoben",
    Sponsored: "Gesponsert",
    "Sponsored Resource Placement": "Gesponserte Ressourcenplatzierung",
    "Featured Sponsored Resource": "Hervorgehobene gesponserte Ressource",
    "What happens after payment?": "Was passiert nach der Zahlung?",
    "Contact before paying": "Vor dem Bezahlen kontaktieren",
    "Stripe-ready subscriptions": "Stripe-fähige Abonnements"
  },
  zh: {
    Trust: "信任",
    "SEO pages": "SEO 页面",
    "User Reviews": "用户评价",
    "Acceptable Use": "可接受使用",
    "Shopper Review Analyzer": "购物者评价分析器",
    "Amazon Review Analyzer": "Amazon 评价分析器",
    "Fake Review Detector": "虚假评价检测器",
    "Seller Review Analytics": "卖家评价分析",
    "Last updated": "最后更新",
    "June 1, 2026": "2026年6月1日",
    "Need help with this page?": "需要此页面的帮助吗？",
    "Email support@getreviewintel.com or open the support form.": "发送邮件到 support@getreviewintel.com 或打开支持表单。",
    "Open FAQ": "打开 FAQ",
    "Terms of Use": "使用条款",
    "Simple rules for using ReviewIntel": "使用 ReviewIntel 的简单规则",
    "Using the service": "使用服务",
    "Accounts and subscriptions": "账户和订阅",
    "Prohibited use": "禁止使用",
    Availability: "可用性",
    "Privacy Policy": "隐私政策",
    "How ReviewIntel handles customer data": "ReviewIntel 如何处理客户数据",
    "Information we process": "我们处理的信息",
    "How we use information": "我们如何使用信息",
    "Data requests": "数据请求",
    Retention: "保留",
    Disclaimer: "免责声明",
    "Product guidance, not guaranteed truth": "产品建议，不保证绝对真实",
    "AI analysis boundaries": "AI 分析边界",
    "No scraping or marketplace endorsement": "不抓取，也不代表平台背书",
    "Seller use": "卖家使用",
    "Refund Policy": "退款政策",
    "Clear billing expectations": "清晰的账单预期",
    "Subscription cancellation": "取消订阅",
    "Refund review": "退款审核",
    "How to request help": "如何请求帮助",
    "Fast answers for shoppers and sellers": "面向购物者和卖家的快速答案",
    "What does ReviewIntel analyze?": "ReviewIntel 分析什么？",
    "Is Shopper Mode different from Seller Mode?": "购物者模式和卖家模式不同吗？",
    "Can ReviewIntel prove a review is fake?": "ReviewIntel 能证明评价是假的吗？",
    "How many reviews should I paste?": "我应该粘贴多少评价？",
    "How do I cancel?": "如何取消？",
    "Contact / Customer Service": "联系 / 客户服务",
    "We are here to help": "我们随时提供帮助",
    "Customer service": "客户服务",
    "Privacy and data": "隐私和数据",
    "Unsubscribe / Manage Product Subscription": "退订 / 管理产品订阅",
    "Control your plan clearly": "清楚管理你的方案",
    "Self-service billing portal": "自助账单门户",
    "Cancel or downgrade": "取消或降级",
    "Need help?": "需要帮助？",
    "Billing Support": "账单支持",
    "Charges, invoices, cancellations": "扣费、发票、取消",
    "What to include": "需要包含什么",
    "Fastest path": "最快路径",
    "Account Support": "账户支持",
    "Login, plan, workspace, access": "登录、方案、工作区、访问",
    "Login and access": "登录和访问",
    "Shopper, Seller, and Admin modes": "购物者、卖家和管理员模式",
    "Delete Account / Data Request": "删除账户 / 数据请求",
    "Control your data": "控制你的数据",
    "Request types": "请求类型",
    "Where to send requests": "请求发送位置",
    "Cookie Policy": "Cookie 政策",
    "Cookies and local storage": "Cookie 和本地存储",
    "Essential storage": "必要存储",
    "Analytics and marketing": "分析和营销",
    "Managing storage": "管理存储",
    "Acceptable Use Policy": "可接受使用政策",
    "Keep review intelligence honest": "诚实使用评价智能",
    "Allowed use": "允许使用",
    "Not allowed": "不允许",
    Enforcement: "执行",
    "ReviewIntel is built for clearer review-driven decisions.": "ReviewIntel 用于更清晰地根据评价做决定。",
    "Customer goal": "客户目标",
    "Seller goal": "卖家目标",
    "Product boundary": "产品边界",
    "Open Analyzer": "打开分析器",
    Advertisement: "广告",
    "Advertise with ReviewIntel": "在 ReviewIntel 投放广告",
    "Reach shoppers, sellers, and product researchers directly inside an AI review intelligence platform.":
      "在 AI 评价智能平台中直接触达购物者、卖家和产品研究者。",
    "Partner with ReviewIntel": "与 ReviewIntel 合作",
    "Clean sponsored placements for brands, tools, and services that help online shoppers and sellers.":
      "为帮助线上购物者和卖家的品牌、工具与服务提供清晰的赞助展示位。",
    "Apply now": "立即申请",
    "Feature your ecommerce tool, product service, or seller resource.": "展示你的电商工具、产品服务或卖家资源。",
    Featured: "精选",
    Sponsored: "赞助",
    "Sponsored Resource Placement": "赞助资源展示",
    "Featured Sponsored Resource": "精选赞助资源",
    "What happens after payment?": "付款后会发生什么？",
    "Contact before paying": "付款前联系",
    "Stripe-ready subscriptions": "支持 Stripe 的订阅"
  },
  hi: {
    Trust: "भरोसा",
    "SEO pages": "SEO पेज",
    "User Reviews": "यूज़र समीक्षाएँ",
    "Acceptable Use": "स्वीकार्य उपयोग",
    "Shopper Review Analyzer": "शॉपर समीक्षा विश्लेषक",
    "Amazon Review Analyzer": "Amazon समीक्षा विश्लेषक",
    "Fake Review Detector": "फर्जी समीक्षा डिटेक्टर",
    "Seller Review Analytics": "विक्रेता समीक्षा विश्लेषण",
    "Last updated": "अंतिम अपडेट",
    "June 1, 2026": "1 जून 2026",
    "Need help with this page?": "इस पेज में मदद चाहिए?",
    "Email support@getreviewintel.com or open the support form.": "support@getreviewintel.com पर ईमेल करें या सपोर्ट फॉर्म खोलें।",
    "Open FAQ": "FAQ खोलें",
    "Terms of Use": "उपयोग की शर्तें",
    "Simple rules for using ReviewIntel": "ReviewIntel उपयोग के सरल नियम",
    "Using the service": "सेवा का उपयोग",
    "Accounts and subscriptions": "खाते और सदस्यताएँ",
    "Prohibited use": "निषिद्ध उपयोग",
    Availability: "उपलब्धता",
    "Privacy Policy": "गोपनीयता नीति",
    "How ReviewIntel handles customer data": "ReviewIntel ग्राहक डेटा कैसे संभालता है",
    "Information we process": "हम जो जानकारी प्रोसेस करते हैं",
    "How we use information": "हम जानकारी कैसे उपयोग करते हैं",
    "Data requests": "डेटा अनुरोध",
    Retention: "रिटेंशन",
    Disclaimer: "अस्वीकरण",
    "Product guidance, not guaranteed truth": "उत्पाद मार्गदर्शन, गारंटी नहीं",
    "AI analysis boundaries": "AI विश्लेषण सीमाएँ",
    "No scraping or marketplace endorsement": "कोई स्क्रैपिंग या marketplace समर्थन नहीं",
    "Seller use": "विक्रेता उपयोग",
    "Refund Policy": "रिफंड नीति",
    "Clear billing expectations": "स्पष्ट बिलिंग अपेक्षाएँ",
    "Subscription cancellation": "सदस्यता रद्द करना",
    "Refund review": "रिफंड समीक्षा",
    "How to request help": "मदद कैसे माँगें",
    "Fast answers for shoppers and sellers": "शॉपर और विक्रेताओं के लिए तेज़ जवाब",
    "What does ReviewIntel analyze?": "ReviewIntel क्या विश्लेषण करता है?",
    "Is Shopper Mode different from Seller Mode?": "क्या शॉपर मोड विक्रेता मोड से अलग है?",
    "Can ReviewIntel prove a review is fake?": "क्या ReviewIntel साबित कर सकता है कि समीक्षा फर्जी है?",
    "How many reviews should I paste?": "मुझे कितनी समीक्षाएँ पेस्ट करनी चाहिए?",
    "How do I cancel?": "मैं कैसे रद्द करूँ?",
    "Contact / Customer Service": "संपर्क / ग्राहक सेवा",
    "We are here to help": "हम मदद के लिए हैं",
    "Customer service": "ग्राहक सेवा",
    "Privacy and data": "गोपनीयता और डेटा",
    "Unsubscribe / Manage Product Subscription": "अनसब्सक्राइब / उत्पाद सदस्यता प्रबंधित करें",
    "Control your plan clearly": "अपना प्लान स्पष्ट रूप से नियंत्रित करें",
    "Self-service billing portal": "सेल्फ-सर्विस बिलिंग पोर्टल",
    "Cancel or downgrade": "रद्द या डाउनग्रेड करें",
    "Need help?": "मदद चाहिए?",
    "Billing Support": "बिलिंग सहायता",
    "Charges, invoices, cancellations": "चार्ज, इनवॉइस, रद्दीकरण",
    "What to include": "क्या शामिल करें",
    "Fastest path": "सबसे तेज़ रास्ता",
    "Account Support": "खाता सहायता",
    "Login, plan, workspace, access": "लॉगिन, प्लान, वर्कस्पेस, एक्सेस",
    "Login and access": "लॉगिन और एक्सेस",
    "Shopper, Seller, and Admin modes": "शॉपर, विक्रेता और एडमिन मोड",
    "Delete Account / Data Request": "खाता हटाएँ / डेटा अनुरोध",
    "Control your data": "अपना डेटा नियंत्रित करें",
    "Request types": "अनुरोध प्रकार",
    "Where to send requests": "अनुरोध कहाँ भेजें",
    "Cookie Policy": "कुकी नीति",
    "Cookies and local storage": "कुकी और लोकल स्टोरेज",
    "Essential storage": "आवश्यक स्टोरेज",
    "Analytics and marketing": "एनालिटिक्स और मार्केटिंग",
    "Managing storage": "स्टोरेज प्रबंधन",
    "Acceptable Use Policy": "स्वीकार्य उपयोग नीति",
    "Keep review intelligence honest": "समीक्षा इंटेलिजेंस ईमानदार रखें",
    "Allowed use": "अनुमत उपयोग",
    "Not allowed": "अनुमति नहीं",
    Enforcement: "लागू करना",
    "ReviewIntel is built for clearer review-driven decisions.": "ReviewIntel स्पष्ट समीक्षा-आधारित निर्णयों के लिए बनाया गया है।",
    "Customer goal": "ग्राहक लक्ष्य",
    "Seller goal": "विक्रेता लक्ष्य",
    "Product boundary": "उत्पाद सीमा",
    "Open Analyzer": "विश्लेषक खोलें",
    Advertisement: "विज्ञापन",
    "Advertise with ReviewIntel": "ReviewIntel पर विज्ञापन दें",
    "Reach shoppers, sellers, and product researchers directly inside an AI review intelligence platform.":
      "AI review intelligence platform के अंदर shoppers, sellers और product researchers तक सीधे पहुँचें।",
    "Partner with ReviewIntel": "ReviewIntel के साथ साझेदारी करें",
    "Clean sponsored placements for brands, tools, and services that help online shoppers and sellers.":
      "ऐसे brands, tools और services के लिए साफ sponsored placements जो online shoppers और sellers की मदद करते हैं।",
    "Apply now": "अभी आवेदन करें",
    "Feature your ecommerce tool, product service, or seller resource.": "अपना ecommerce टूल, उत्पाद सेवा या विक्रेता संसाधन दिखाएँ।",
    Featured: "फ़ीचर्ड",
    Sponsored: "स्पॉन्सर्ड",
    "Sponsored Resource Placement": "स्पॉन्सर्ड संसाधन प्लेसमेंट",
    "Featured Sponsored Resource": "फ़ीचर्ड स्पॉन्सर्ड संसाधन",
    "What happens after payment?": "भुगतान के बाद क्या होता है?",
    "Contact before paying": "भुगतान से पहले संपर्क करें",
    "Stripe-ready subscriptions": "Stripe-ready सदस्यताएँ"
  }
} satisfies Partial<Record<ReviewIntelLocale, Record<string, string>>>;

const sanityCheckPhraseTranslations = {
  fr: {
    Marketplace: "Marketplace",
    Retail: "Vente au détail",
    "Social commerce": "Commerce social",
    Storefront: "Boutique en ligne",
    Handmade: "Fait main",
    Resale: "Revente",
    Electronics: "Électronique",
    "Marketplace intelligence": "Intelligence marketplace",
    "Review signal": "Signal d’avis",
    "AI extracts risk + buyer signal": "L’IA extrait le risque + le signal acheteur",
    "AI scan core": "noyau d’analyse IA",
    "AI review intelligence": "Intelligence d’avis par IA",
    "Portable blender: works fast, but several buyers mention leaking lids after two weeks.":
      "Blender portable : fonctionne vite, mais plusieurs acheteurs signalent des couvercles qui fuient après deux semaines.",
    "Air fryer: easy cleanup and crispy food, but basket coating scratches faster than expected.":
      "Friteuse à air : nettoyage facile et aliments croustillants, mais le revêtement du panier se raye plus vite que prévu.",
    "LED mirror: looks beautiful on video, but buyers complain the stand feels unstable.":
      "Miroir LED : superbe en vidéo, mais des acheteurs trouvent le support instable.",
    "Premium backpack: strong zippers and clean design, but laptop padding could be thicker.":
      "Sac à dos premium : fermetures solides et design épuré, mais le rembourrage ordinateur pourrait être plus épais.",
    "Handmade candle: scent is cozy and elegant, but some orders arrived with cracked glass.":
      "Bougie faite main : parfum chaleureux et élégant, mais certaines commandes arrivent avec un verre fissuré.",
    "Refurbished headphones: sound quality is solid, but battery life varies by seller.":
      "Écouteurs reconditionnés : son solide, mais l’autonomie varie selon le vendeur.",
    "Gaming monitor: smooth refresh rate and bright color, but the stand takes too much desk space.":
      "Écran gaming : rafraîchissement fluide et couleurs vives, mais le pied prend trop de place.",
    "Robot vacuum: great on hardwood floors, but pet hair clogs the brush more often than expected.":
      "Robot aspirateur : excellent sur parquet, mais les poils d’animaux bouchent la brosse plus souvent que prévu.",
    "Coffee maker: affordable and simple, but reviews mention the plastic smell during first uses.":
      "Cafetière : abordable et simple, mais les avis mentionnent une odeur de plastique aux premières utilisations.",
    "Mini projector: fun for bedrooms, but buyers say daytime brightness is weaker than ads suggest.":
      "Mini projecteur : amusant pour une chambre, mais la luminosité de jour est plus faible que les publicités le suggèrent.",
    "Skincare set: packaging feels premium, but sensitive-skin buyers report mild irritation.":
      "Coffret soins : emballage premium, mais des peaux sensibles signalent une légère irritation.",
    "Custom mug: print quality looks sharp, but delivery time depends heavily on the seller.":
      "Mug personnalisé : impression nette, mais le délai dépend beaucoup du vendeur.",
    "Used tablet: screen condition was better than expected, but charger quality was inconsistent.":
      "Tablette d’occasion : écran en meilleur état que prévu, mais chargeur de qualité variable.",
    "Bluetooth speaker: strong bass for the size, but app pairing confused several buyers.":
      "Enceinte Bluetooth : basses fortes pour la taille, mais l’appairage de l’app a dérouté plusieurs acheteurs.",
    "Market-ready review analysis for shoppers and ecommerce sellers, with clear support, billing, privacy, and subscription controls.":
      "Analyse d’avis prête pour le marché pour acheteurs et vendeurs e-commerce, avec support, facturation, confidentialité et abonnements clairs.",
    "AI guidance for review decisions. Always verify critical product claims.":
      "Conseils IA pour les décisions basées sur les avis. Vérifiez toujours les affirmations produit importantes.",
    "Support:": "Assistance :",
    "Billing:": "Facturation :",
    Cookies: "Politique sur les cookies",
    "Delete Account": "Supprimer le compte",
    "Your email": "Votre e-mail",
    "Support topic": "Sujet d’assistance",
    "How can we help?": "Comment pouvons-nous aider ?",
    "Direct email:": "E-mail direct :",
    "Tell us what happened, your plan, and what you need.": "Dites-nous ce qui s’est passé, votre forfait et ce dont vous avez besoin.",
    "Product question": "Question produit",
    "Billing or cancellation": "Facturation ou annulation",
    "Account access": "Accès au compte",
    "Seller Pro report": "Rapport Vendeur Pro",
    "Data or privacy request": "Demande de données ou confidentialité",
    "Bug report": "Rapport de bogue",
    "Sending...": "Envoi...",
    "Message Sent": "Message envoyé",
    "Send Message": "Envoyer le message",
    "Saved. Admin inbox will show this message.": "Enregistré. La boîte admin affichera ce message.",
    "Message failed.": "Échec de l’envoi.",
    "Subscription controls": "Contrôles d’abonnement",
    "Manage billing or upgrade your plan.": "Gérez la facturation ou améliorez votre forfait.",
    "Use the billing portal for payment cards, invoices, cancellation, and subscription status. Free Shopper accounts can upgrade anytime from the pricing page.":
      "Utilisez le portail de facturation pour les cartes, factures, annulations et statut d’abonnement. Les comptes acheteur gratuits peuvent passer à Premium depuis la page tarifs.",
    "Open Billing Portal": "Ouvrir le portail de facturation",
    "Upgrade to Premium": "Passer à Premium",
    "Need a person?": "Besoin d’une personne ?",
    "Billing support": "Assistance facturation",
    "Include your account email, plan name, charge date, and what you want changed.": "Incluez l’e-mail du compte, le forfait, la date du paiement et le changement souhaité.",
    "Email Billing Support": "Écrire à l’assistance facturation",
    "Read Refund Policy": "Lire la politique de remboursement",
    "Opening billing portal...": "Ouverture du portail de facturation...",
    "Log in first so ReviewIntel can locate your subscription.": "Connectez-vous d’abord pour que ReviewIntel retrouve votre abonnement.",
    "Billing portal is unavailable. Email billing support and include your account email.": "Le portail de facturation est indisponible. Écrivez au support facturation avec l’e-mail du compte.",
    "Billing portal failed. Email billing support and include your account email.": "Le portail de facturation a échoué. Écrivez au support facturation avec l’e-mail du compte."
  },
  es: {
    Marketplace: "Mercado",
    Retail: "Minorista",
    "Social commerce": "Comercio social",
    Storefront: "Tienda online",
    Handmade: "Hecho a mano",
    Resale: "Reventa",
    Electronics: "Electrónica",
    "Marketplace intelligence": "Inteligencia de mercado",
    "Review signal": "Señal de reseñas",
    "AI extracts risk + buyer signal": "La IA extrae riesgo + señal del comprador",
    "AI scan core": "núcleo de escaneo IA",
    "AI review intelligence": "Inteligencia de reseñas con IA",
    "Portable blender: works fast, but several buyers mention leaking lids after two weeks.":
      "Licuadora portátil: funciona rápido, pero varios compradores mencionan tapas con fugas después de dos semanas.",
    "Air fryer: easy cleanup and crispy food, but basket coating scratches faster than expected.":
      "Freidora de aire: limpieza fácil y comida crujiente, pero el recubrimiento de la canasta se raya antes de lo esperado.",
    "LED mirror: looks beautiful on video, but buyers complain the stand feels unstable.":
      "Espejo LED: se ve hermoso en video, pero compradores dicen que el soporte se siente inestable.",
    "Premium backpack: strong zippers and clean design, but laptop padding could be thicker.":
      "Mochila premium: cierres fuertes y diseño limpio, pero el acolchado para laptop podría ser más grueso.",
    "Handmade candle: scent is cozy and elegant, but some orders arrived with cracked glass.":
      "Vela artesanal: aroma acogedor y elegante, pero algunos pedidos llegaron con vidrio agrietado.",
    "Refurbished headphones: sound quality is solid, but battery life varies by seller.":
      "Auriculares reacondicionados: el sonido es sólido, pero la batería varía según el vendedor.",
    "Gaming monitor: smooth refresh rate and bright color, but the stand takes too much desk space.":
      "Monitor gaming: actualización fluida y color brillante, pero la base ocupa demasiado espacio.",
    "Robot vacuum: great on hardwood floors, but pet hair clogs the brush more often than expected.":
      "Robot aspirador: excelente en pisos de madera, pero el pelo de mascotas obstruye el cepillo más de lo esperado.",
    "Coffee maker: affordable and simple, but reviews mention the plastic smell during first uses.":
      "Cafetera: económica y simple, pero las reseñas mencionan olor a plástico en los primeros usos.",
    "Mini projector: fun for bedrooms, but buyers say daytime brightness is weaker than ads suggest.":
      "Mini proyector: divertido para dormitorios, pero compradores dicen que el brillo diurno es menor que en los anuncios.",
    "Skincare set: packaging feels premium, but sensitive-skin buyers report mild irritation.":
      "Set de cuidado facial: empaque premium, pero compradores con piel sensible reportan irritación leve.",
    "Custom mug: print quality looks sharp, but delivery time depends heavily on the seller.":
      "Taza personalizada: impresión nítida, pero el tiempo de entrega depende mucho del vendedor.",
    "Used tablet: screen condition was better than expected, but charger quality was inconsistent.":
      "Tableta usada: la pantalla estaba mejor de lo esperado, pero la calidad del cargador fue irregular.",
    "Bluetooth speaker: strong bass for the size, but app pairing confused several buyers.":
      "Altavoz Bluetooth: bajos fuertes para su tamaño, pero el emparejamiento de la app confundió a varios compradores.",
    "Market-ready review analysis for shoppers and ecommerce sellers, with clear support, billing, privacy, and subscription controls.":
      "Análisis de reseñas listo para el mercado para compradores y vendedores ecommerce, con soporte, facturación, privacidad y controles de suscripción claros.",
    "AI guidance for review decisions. Always verify critical product claims.":
      "Guía de IA para decisiones basadas en reseñas. Verifica siempre las afirmaciones importantes del producto.",
    "Support:": "Soporte:",
    "Billing:": "Facturación:",
    Cookies: "Política de cookies",
    "Delete Account": "Eliminar cuenta",
    "Read Acceptable Use": "Leer uso aceptable",
    "Contact customer service": "Contactar atención al cliente",
    "Open Billing Support": "Abrir soporte de facturación",
    "Contact Privacy Support": "Contactar soporte de privacidad",
    "Shopper Free usage may be limited. Shopper Premium and Seller subscriptions unlock additional usage and features. You must keep your login information secure and use accurate billing information.":
      "El uso gratuito para compradores puede estar limitado. Las suscripciones Comprador Premium y Vendedor desbloquean más uso y funciones. Mantén segura tu información de acceso y usa datos de facturación correctos.",
    "Do not upload private customer data unless you have permission and a lawful reason.": "No subas datos privados de clientes salvo que tengas permiso y una base legal.",
    "Do not use the product to create fake reviews or manipulate marketplace trust systems.": "No uses el producto para crear reseñas falsas ni manipular sistemas de confianza de marketplaces.",
    "Do not attempt to reverse engineer, overload, or bypass usage limits.": "No intentes aplicar ingeniería inversa, sobrecargar ni saltarte los límites de uso.",
    "We may process account email, plan type, login metadata, uploaded review text, uploaded screenshots, analysis results, usage counts, and billing identifiers from payment providers.":
      "Podemos procesar el e-mail de la cuenta, tipo de plan, metadatos de inicio de sesión, reseñas subidas, capturas, resultados de análisis, conteos de uso e identificadores de facturación de proveedores de pago.",
    "Review text and screenshots are used to produce analysis results.": "El texto de reseñas y las capturas se usan para producir resultados de análisis.",
    "Admin and support actions may record operational notes for troubleshooting.": "Las acciones de administración y soporte pueden registrar notas operativas para resolver problemas.",
    "We use information to provide analysis, enforce usage limits, manage subscriptions, improve product quality, detect abuse, and respond to support requests.":
      "Usamos la información para ofrecer análisis, aplicar límites, gestionar suscripciones, mejorar la calidad, detectar abuso y responder solicitudes de soporte.",
    "We keep information only as long as needed for product operation, legal obligations, billing records, security, and customer support.":
      "Conservamos la información solo el tiempo necesario para operar el producto, cumplir obligaciones legales, mantener registros de facturación, seguridad y soporte.",
    "You can cancel future renewals from Manage Subscription or by contacting billing support. Cancellation stops future billing but does not automatically refund previous charges.":
      "Puedes cancelar renovaciones futuras desde Gestionar suscripción o contactando soporte de facturación. La cancelación detiene cobros futuros, pero no reembolsa automáticamente cargos anteriores.",
    "Refund requests are reviewed case by case. Include the account email, plan, charge date, and reason so support can locate the subscription quickly.":
      "Las solicitudes de reembolso se revisan caso por caso. Incluye e-mail de cuenta, plan, fecha del cargo y motivo para que soporte encuentre la suscripción rápido.",
    "Duplicate charges and accidental upgrades are prioritized.": "Los cargos duplicados y las mejoras accidentales tienen prioridad.",
    "Refunds may be limited when the service was heavily used during the billing period.": "Los reembolsos pueden limitarse si el servicio se usó mucho durante el periodo facturado.",
    "Payment processor timing can affect how quickly funds appear back on a card.": "Los plazos del procesador de pago pueden afectar cuándo vuelven los fondos a la tarjeta.",
    "You should confirm important product, safety, refund, medical, legal, financial, or warranty details from authoritative sources.":
      "Debes confirmar detalles importantes del producto, seguridad, reembolsos, salud, legales, financieros o garantía con fuentes autorizadas.",
    "Seller analytics are intended to identify product improvement themes, not to manipulate reviews, pressure customers, or bypass platform rules.":
      "La analítica para vendedores busca identificar mejoras del producto, no manipular reseñas, presionar clientes ni saltarse reglas de plataformas.",
    "It analyzes pasted review text, TXT or CSV batches, and screenshot uploads. It estimates review volume, sentiment, complaints, fake-review risk, value for money, and recommendation signals.":
      "Analiza texto de reseñas pegado, lotes TXT o CSV y capturas subidas. Estima volumen de reseñas, sentimiento, quejas, riesgo de reseñas falsas, valor por dinero y señales de recomendación.",
    "Yes. Shopper Mode gives a fast buying verdict. Seller Mode produces deeper business intelligence with complaint clusters, feature requests, positioning ideas, and improvement actions.":
      "Sí. El modo comprador da un veredicto rápido de compra. El modo vendedor ofrece inteligencia más profunda con grupos de quejas, solicitudes de funciones, ideas de posicionamiento y acciones de mejora.",
    "No. It estimates fake-review risk using language patterns, repetition, review quality, and evidence strength. Treat the score as a risk signal, not a legal finding.":
      "No. Estima el riesgo de reseñas falsas con patrones de lenguaje, repetición, calidad de reseñas y fuerza de evidencia. Trata la puntuación como señal de riesgo, no como conclusión legal.",
    "More review text usually improves confidence. For quick shopping decisions, a few dozen reviews can help. For Seller Pro decisions, larger CSV or TXT batches are better.":
      "Más texto de reseñas suele mejorar la confianza. Para compras rápidas, unas decenas de reseñas ayudan. Para decisiones de Vendedor Pro, convienen lotes CSV o TXT más grandes.",
    "Open Manage Subscription from the footer or account page. If the billing portal is unavailable, contact Billing Support and include your account email.":
      "Abre Gestionar suscripción desde el pie de página o la cuenta. Si el portal de facturación no está disponible, contacta soporte de facturación e incluye tu e-mail.",
    "Billing support helps with subscriptions, failed checkout, duplicate charges, cancellation questions, and invoice requests.":
      "El soporte de facturación ayuda con suscripciones, pagos fallidos, cargos duplicados, preguntas de cancelación y solicitudes de factura.",
    "Include your account email, plan, charge date, last four digits of the card if available, and what you need changed.":
      "Incluye e-mail de cuenta, plan, fecha del cargo, últimos cuatro dígitos de la tarjeta si los tienes y lo que necesitas cambiar.",
    "Use Manage Subscription first for cancellation and card updates. Contact billing support if the portal cannot find your subscription.":
      "Usa primero Gestionar suscripción para cancelar o actualizar tarjetas. Contacta soporte de facturación si el portal no encuentra tu suscripción.",
    "Get help with login issues, email verification, password reset, wrong workspace mode, or plan access.":
      "Obtén ayuda con inicio de sesión, verificación de e-mail, restablecimiento de contraseña, modo de espacio incorrecto o acceso al plan.",
    "Use password reset if you cannot sign in. If your paid plan is missing, include your account email and payment email when contacting support.":
      "Usa restablecer contraseña si no puedes entrar. Si falta tu plan pagado, incluye tu e-mail de cuenta y e-mail de pago al contactar soporte.",
    "Shopper tools are designed for buying decisions. Seller tools are designed for business intelligence. Admin controls are private developer and operations tools.":
      "Las herramientas de comprador son para decisiones de compra. Las de vendedor son para inteligencia de negocio. Los controles admin son herramientas privadas de desarrollo y operaciones.",
    "Your email": "Tu e-mail",
    "Support topic": "Tema de soporte",
    "How can we help?": "¿Cómo podemos ayudar?",
    "Direct email:": "E-mail directo:",
    "Tell us what happened, your plan, and what you need.": "Cuéntanos qué pasó, tu plan y qué necesitas.",
    "Product question": "Pregunta de producto",
    "Billing or cancellation": "Facturación o cancelación",
    "Account access": "Acceso a la cuenta",
    "Seller Pro report": "Informe Vendedor Pro",
    "Data or privacy request": "Solicitud de datos o privacidad",
    "Bug report": "Reporte de error",
    "Sending...": "Enviando...",
    "Message Sent": "Mensaje enviado",
    "Send Message": "Enviar mensaje",
    "Saved. Admin inbox will show this message.": "Guardado. La bandeja admin mostrará este mensaje.",
    "Message failed.": "Error al enviar.",
    "Manage billing, cancel renewal, downgrade, or contact support if you cannot access the billing portal.":
      "Gestiona facturación, cancela renovaciones, baja de plan o contacta soporte si no puedes acceder al portal de facturación.",
    "Logged-in paid users can open the billing portal from this page or the Account page. Admin and local development accounts may see a simulated portal during development.":
      "Los usuarios pagos conectados pueden abrir el portal de facturación desde esta página o desde Cuenta. Las cuentas admin y de desarrollo local pueden ver un portal simulado.",
    "Canceling stops future renewals. Downgrading changes future access according to the selected plan. If a portal link fails, email billing support with your account email.":
      "Cancelar detiene renovaciones futuras. Bajar de plan cambia el acceso futuro según el plan elegido. Si falla el enlace del portal, escribe a facturación con tu e-mail de cuenta.",
    "Subscription controls": "Controles de suscripción",
    "Manage billing or upgrade your plan.": "Gestiona la facturación o mejora tu plan.",
    "Use the billing portal for payment cards, invoices, cancellation, and subscription status. Free Shopper accounts can upgrade anytime from the pricing page.":
      "Usa el portal de facturación para tarjetas, facturas, cancelación y estado de suscripción. Las cuentas gratuitas de comprador pueden mejorar el plan desde la página de precios.",
    "Open Billing Portal": "Abrir portal de facturación",
    "Upgrade to Premium": "Mejorar a Premium",
    "Need a person?": "¿Necesitas una persona?",
    "Billing support": "Soporte de facturación",
    "Include your account email, plan name, charge date, and what you want changed.": "Incluye e-mail de cuenta, nombre del plan, fecha del cargo y lo que quieres cambiar.",
    "Email Billing Support": "Enviar e-mail a facturación",
    "Read Refund Policy": "Leer política de reembolsos",
    "Opening billing portal...": "Abriendo portal de facturación...",
    "Log in first so ReviewIntel can locate your subscription.": "Inicia sesión primero para que ReviewIntel localice tu suscripción.",
    "Billing portal is unavailable. Email billing support and include your account email.": "El portal de facturación no está disponible. Escribe a soporte de facturación e incluye tu e-mail de cuenta.",
    "Billing portal failed. Email billing support and include your account email.": "Falló el portal de facturación. Escribe a soporte de facturación e incluye tu e-mail de cuenta.",
    "Request account deletion, review-data deletion, access, correction, or export. We will use your account email to verify the request.":
      "Solicita eliminación de cuenta, eliminación de datos de reseñas, acceso, corrección o exportación. Usaremos tu e-mail de cuenta para verificar la solicitud.",
    "You can request account deletion, analysis deletion, data export, correction, or privacy questions.":
      "Puedes solicitar eliminación de cuenta, eliminación de análisis, exportación de datos, corrección o hacer preguntas de privacidad.",
    "Tell us whether you want account deletion or only specific analysis data removed.": "Indica si quieres eliminar la cuenta o solo datos de análisis específicos.",
    "Billing records may need to be retained where required by law or payment processors.": "Es posible que debamos conservar registros de facturación cuando la ley o los procesadores de pago lo exijan.",
    "The app may store account role, plan, active mode, quota state, guest ID, and theme preference so the product works between page loads.":
      "La app puede guardar rol de cuenta, plan, modo activo, estado de cuota, ID de invitado y preferencia de tema para funcionar entre cargas.",
    "You can clear cookies or local storage from your browser settings. Doing so may log you out, reset local workspace mode, or reset local quota display.":
      "Puedes borrar cookies o almacenamiento local desde el navegador. Esto puede cerrar sesión, reiniciar el modo local o restablecer la cuota mostrada.",
    "Analyze product reviews, compare product feedback, identify complaints, improve listings, and understand customer satisfaction.":
      "Analiza reseñas de productos, compara comentarios, identifica quejas, mejora listados y entiende la satisfacción del cliente.",
    "No fake-review creation or review manipulation.": "No crear reseñas falsas ni manipular reseñas.",
    "No illegal, hateful, abusive, or privacy-invasive uploads.": "No subir contenido ilegal, de odio, abusivo o invasivo de la privacidad.",
    "No attempts to overload, probe, or bypass the app's security and quota systems.": "No intentar sobrecargar, sondear ni saltarse los sistemas de seguridad y cuota de la app."
  },
  de: {
    Dashboard: "Übersicht",
    Support: "Hilfe",
    "Seller Dashboard": "Verkäufer-Übersicht",
    "Shopper Dashboard": "Käufer-Übersicht",
    "Shopper dashboard": "Käufer-Übersicht",
    "Seller dashboard": "Verkäufer-Übersicht",
    "All reviews. One AI scan. Clear buying answers.": "Alle Bewertungen. Eine KI-Prüfung. Klare Kaufantworten.",
    "Login, plan, workspace, access": "Anmeldung, Tarif, Arbeitsbereich, Zugriff",
    "Login and access": "Anmeldung und Zugriff",
    "Cookie Policy": "Richtlinie zu Browserdaten",
    "Cookies and local storage": "Browserdaten und lokaler Speicher",
    Marketplace: "Marktplatz",
    Retail: "Einzelhandel",
    "Social commerce": "Sozialer Handel",
    Storefront: "Schaufenster",
    Handmade: "Handgemacht",
    Resale: "Wiederverkauf",
    Electronics: "Elektronik",
    "Marketplace intelligence": "Marktplatz-Intelligenz",
    "Review signal": "Bewertungssignal",
    "AI extracts risk + buyer signal": "KI erkennt Risiko + Käufersignal",
    "AI scan core": "Kern der KI-Prüfung",
    "AI review intelligence": "KI-Bewertungsintelligenz",
    "Buyers like speed and cleanup. Watch lid leaks and motor life.":
      "Käufer mögen Tempo und leichte Reinigung. Achte auf undichte Deckel und Motorlebensdauer.",
    "Best for casual use — not heavy daily use.": "Am besten für gelegentliche Nutzung, nicht für harten täglichen Einsatz.",
    "Seller insight: clarify warranty and replacement support.": "Verkäuferhinweis: Garantie und Ersatzsupport klar erklären.",
    "Shoppers get the answer without reading a report. Sellers get a separate command view built for decisions, not shopping.":
      "Käufer erhalten die Antwort ohne Berichtlektüre. Verkäufer bekommen eine separate Steuerungsansicht für Entscheidungen, nicht fürs Einkaufen.",
    "Portable blender: works fast, but several buyers mention leaking lids after two weeks.":
      "Tragbarer Mixer: arbeitet schnell, aber mehrere Käufer erwähnen undichte Deckel nach zwei Wochen.",
    "Air fryer: easy cleanup and crispy food, but basket coating scratches faster than expected.":
      "Heißluftfritteuse: leicht zu reinigen und knuspriges Essen, aber die Korbbeschichtung zerkratzt schneller als erwartet.",
    "LED mirror: looks beautiful on video, but buyers complain the stand feels unstable.":
      "LED-Spiegel: sieht im Video schön aus, aber Käufer bemängeln einen instabilen Ständer.",
    "Premium backpack: strong zippers and clean design, but laptop padding could be thicker.":
      "Premium-Rucksack: starke Reißverschlüsse und klares Design, aber die Laptop-Polsterung könnte dicker sein.",
    "Handmade candle: scent is cozy and elegant, but some orders arrived with cracked glass.":
      "Handgemachte Kerze: gemütlicher, eleganter Duft, aber einige Bestellungen kamen mit gerissenem Glas an.",
    "Refurbished headphones: sound quality is solid, but battery life varies by seller.":
      "Generalüberholte Kopfhörer: solide Klangqualität, aber die Akkulaufzeit variiert je nach Verkäufer.",
    "Gaming monitor: smooth refresh rate and bright color, but the stand takes too much desk space.":
      "Gaming-Monitor: flüssige Bildrate und kräftige Farben, aber der Standfuß braucht zu viel Platz.",
    "Robot vacuum: great on hardwood floors, but pet hair clogs the brush more often than expected.":
      "Saugroboter: sehr gut auf Holzböden, aber Tierhaare verstopfen die Bürste häufiger als erwartet.",
    "Coffee maker: affordable and simple, but reviews mention the plastic smell during first uses.":
      "Kaffeemaschine: günstig und einfach, aber Bewertungen erwähnen Plastikgeruch bei den ersten Nutzungen.",
    "Mini projector: fun for bedrooms, but buyers say daytime brightness is weaker than ads suggest.":
      "Mini-Projektor: gut fürs Schlafzimmer, aber Käufer sagen, die Tageshelligkeit sei schwächer als beworben.",
    "Skincare set: packaging feels premium, but sensitive-skin buyers report mild irritation.":
      "Hautpflege-Set: Verpackung wirkt hochwertig, aber Käufer mit empfindlicher Haut berichten leichte Reizung.",
    "Custom mug: print quality looks sharp, but delivery time depends heavily on the seller.":
      "Personalisierte Tasse: Druckqualität wirkt scharf, aber die Lieferzeit hängt stark vom Verkäufer ab.",
    "Used tablet: screen condition was better than expected, but charger quality was inconsistent.":
      "Gebrauchtes Tablet: Bildschirmzustand war besser als erwartet, aber die Ladegerätqualität schwankte.",
    "Bluetooth speaker: strong bass for the size, but app pairing confused several buyers.":
      "Bluetooth-Lautsprecher: kräftiger Bass für die Größe, aber die App-Kopplung verwirrte mehrere Käufer.",
    "Market-ready review analysis for shoppers and ecommerce sellers, with clear support, billing, privacy, and subscription controls.":
      "Marktreife Bewertungsanalyse für Käufer und E-Commerce-Verkäufer, mit klarer Hilfe, Abrechnung, Datenschutz und Abo-Kontrollen.",
    "AI guidance for review decisions. Always verify critical product claims.":
      "KI-Hinweise für Bewertungsentscheidungen. Prüfe wichtige Produktaussagen immer selbst.",
    "Support:": "Hilfe:",
    "Billing:": "Abrechnung:",
    Cookies: "Browserdaten",
    "Delete Account": "Konto löschen",
    "Read Acceptable Use": "Akzeptable Nutzung lesen",
    "Contact customer service": "Kundenservice kontaktieren",
    "Open Billing Support": "Abrechnungssupport öffnen",
    "Contact Privacy Support": "Datenschutzsupport kontaktieren",
    "Your email": "Deine E-Mail",
    "Support topic": "Hilfethema",
    "How can we help?": "Wie können wir helfen?",
    "Direct email:": "Direkte E-Mail:",
    "Tell us what happened, your plan, and what you need.": "Beschreibe, was passiert ist, deinen Tarif und was du brauchst.",
    "Product question": "Produktfrage",
    "Billing or cancellation": "Abrechnung oder Kündigung",
    "Account access": "Kontozugriff",
    "Seller Pro report": "Verkäufer-Pro-Bericht",
    "Data or privacy request": "Daten- oder Datenschutzanfrage",
    "Bug report": "Fehlerbericht",
    "Sending...": "Wird gesendet...",
    "Message Sent": "Nachricht gesendet",
    "Send Message": "Nachricht senden",
    "Saved. Admin inbox will show this message.": "Gespeichert. Der Admin-Posteingang zeigt diese Nachricht.",
    "Message failed.": "Nachricht fehlgeschlagen.",
    "Subscription controls": "Abo-Kontrollen",
    "Manage billing or upgrade your plan.": "Abrechnung verwalten oder Tarif upgraden.",
    "Open Billing Portal": "Abrechnungsportal öffnen",
    "Upgrade to Premium": "Auf Premium upgraden",
    "Need a person?": "Brauchst du eine Person?",
    "Billing support": "Abrechnungssupport",
    "Email Billing Support": "Abrechnungssupport per E-Mail",
    "Read Refund Policy": "Rückerstattungsrichtlinie lesen",
    "Opening billing portal...": "Abrechnungsportal wird geöffnet...",
    "Log in first so ReviewIntel can locate your subscription.": "Melde dich zuerst an, damit ReviewIntel dein Abo finden kann.",
    "Shopper Free usage may be limited. Shopper Premium and Seller subscriptions unlock additional usage and features. You must keep your login information secure and use accurate billing information.":
      "Die kostenlose Käufernutzung kann begrenzt sein. Käufer-Premium- und Verkäufer-Abos schalten mehr Nutzung und Funktionen frei. Halte deine Anmeldedaten sicher und nutze korrekte Abrechnungsdaten.",
    "Do not upload private customer data unless you have permission and a lawful reason.": "Lade keine privaten Kundendaten hoch, wenn du keine Erlaubnis und rechtliche Grundlage hast.",
    "Do not use the product to create fake reviews or manipulate marketplace trust systems.": "Nutze das Produkt nicht, um Fake-Bewertungen zu erstellen oder Marktplatz-Vertrauenssysteme zu manipulieren.",
    "Do not attempt to reverse engineer, overload, or bypass usage limits.": "Versuche nicht, Nutzungsgrenzen zu umgehen, das Produkt zu überlasten oder zurückzuentwickeln.",
    "We may process account email, plan type, login metadata, uploaded review text, uploaded screenshots, analysis results, usage counts, and billing identifiers from payment providers.":
      "Wir können Konto-E-Mail, Tariftyp, Anmeldemetadaten, hochgeladenen Bewertungstext, Bildschirmfotos, Analyseergebnisse, Nutzungszahlen und Abrechnungskennungen von Zahlungsanbietern verarbeiten.",
    "Review text and screenshots are used to produce analysis results.": "Bewertungstexte und Screenshots werden für Analyseergebnisse genutzt.",
    "Admin and support actions may record operational notes for troubleshooting.": "Admin- und Supportaktionen können Betriebsnotizen zur Fehlerbehebung speichern.",
    "We use information to provide analysis, enforce usage limits, manage subscriptions, improve product quality, detect abuse, and respond to support requests.":
      "Wir nutzen Informationen, um Analysen bereitzustellen, Nutzungsgrenzen durchzusetzen, Abos zu verwalten, Produktqualität zu verbessern, Missbrauch zu erkennen und Supportanfragen zu beantworten.",
    "We keep information only as long as needed for product operation, legal obligations, billing records, security, and customer support.":
      "Wir behalten Informationen nur so lange, wie es für Produktbetrieb, rechtliche Pflichten, Abrechnungsunterlagen, Sicherheit und Kundensupport nötig ist.",
    "You can cancel future renewals from Manage Subscription or by contacting billing support. Cancellation stops future billing but does not automatically refund previous charges.":
      "Du kannst künftige Verlängerungen über Abo verwalten oder den Abrechnungssupport kündigen. Die Kündigung stoppt künftige Abbuchungen, erstattet frühere Zahlungen aber nicht automatisch.",
    "Refund requests are reviewed case by case. Include the account email, plan, charge date, and reason so support can locate the subscription quickly.":
      "Rückerstattungsanfragen werden einzeln geprüft. Gib Konto-E-Mail, Tarif, Zahlungsdatum und Grund an, damit die Hilfe das Abo schnell findet.",
    "Duplicate charges and accidental upgrades are prioritized.": "Doppelte Abbuchungen und versehentliche Upgrades werden priorisiert.",
    "Refunds may be limited when the service was heavily used during the billing period.": "Rückerstattungen können begrenzt sein, wenn der Dienst im Abrechnungszeitraum stark genutzt wurde.",
    "Payment processor timing can affect how quickly funds appear back on a card.": "Fristen des Zahlungsanbieters können beeinflussen, wie schnell Geld auf der Karte erscheint.",
    "You should confirm important product, safety, refund, medical, legal, financial, or warranty details from authoritative sources.":
      "Bestätige wichtige Produkt-, Sicherheits-, Rückerstattungs-, medizinische, rechtliche, finanzielle oder Garantiedetails bei maßgeblichen Quellen.",
    "Seller analytics are intended to identify product improvement themes, not to manipulate reviews, pressure customers, or bypass platform rules.":
      "Verkäuferanalysen sollen Verbesserungsbereiche erkennen, nicht Bewertungen manipulieren, Kunden unter Druck setzen oder Plattformregeln umgehen.",
    "It analyzes pasted review text, TXT or CSV batches, and screenshot uploads. It estimates review volume, sentiment, complaints, fake-review risk, value for money, and recommendation signals.":
      "Es analysiert eingefügten Bewertungstext, TXT- oder CSV-Stapel und Screenshots. Es schätzt Bewertungsvolumen, Stimmung, Beschwerden, Fake-Risiko, Preis-Leistung und Empfehlungssignale.",
    "Yes. Shopper Mode gives a fast buying verdict. Seller Mode produces deeper business intelligence with complaint clusters, feature requests, positioning ideas, and improvement actions.":
      "Ja. Der Käufermodus gibt ein schnelles Kaufurteil. Der Verkäufermodus liefert tiefere Geschäftseinblicke mit Beschwerdegruppen, Funktionswünschen, Positionierungsideen und Verbesserungsaktionen.",
    "No. It estimates fake-review risk using language patterns, repetition, review quality, and evidence strength. Treat the score as a risk signal, not a legal finding.":
      "Nein. Es schätzt Fake-Risiko anhand von Sprachmustern, Wiederholung, Bewertungsqualität und Evidenzstärke. Behandle den Wert als Risikosignal, nicht als rechtliche Feststellung.",
    "More review text usually improves confidence. For quick shopping decisions, a few dozen reviews can help. For Seller Pro decisions, larger CSV or TXT batches are better.":
      "Mehr Bewertungstext erhöht meist die Sicherheit. Für schnelle Kaufentscheidungen helfen einige Dutzend Bewertungen. Für Verkäufer-Pro-Entscheidungen sind größere CSV- oder TXT-Stapel besser.",
    "Open Manage Subscription from the footer or account page. If the billing portal is unavailable, contact Billing Support and include your account email.":
      "Öffne Abo verwalten im Footer oder auf der Kontoseite. Wenn das Abrechnungsportal nicht verfügbar ist, kontaktiere den Abrechnungssupport mit deiner Konto-E-Mail.",
    "Billing support helps with subscriptions, failed checkout, duplicate charges, cancellation questions, and invoice requests.":
      "Der Abrechnungssupport hilft bei Abos, fehlgeschlagenem Checkout, doppelten Abbuchungen, Kündigungsfragen und Rechnungsanfragen.",
    "Include your account email, plan, charge date, last four digits of the card if available, and what you need changed.":
      "Gib Konto-E-Mail, Tarif, Zahlungsdatum, falls vorhanden die letzten vier Kartenziffern und die gewünschte Änderung an.",
    "Use Manage Subscription first for cancellation and card updates. Contact billing support if the portal cannot find your subscription.":
      "Nutze zuerst Abo verwalten für Kündigungen und Kartenänderungen. Kontaktiere den Abrechnungssupport, wenn das Portal dein Abo nicht findet.",
    "Get help with login issues, email verification, password reset, wrong workspace mode, or plan access.":
      "Erhalte Hilfe bei Loginproblemen, E-Mail-Verifizierung, Passwortzurücksetzung, falschem Arbeitsbereichsmodus oder Tarifzugriff.",
    "Use password reset if you cannot sign in. If your paid plan is missing, include your account email and payment email when contacting support.":
      "Nutze die Passwortzurücksetzung, wenn du dich nicht anmelden kannst. Wenn dein bezahlter Tarif fehlt, gib der Hilfe Konto-E-Mail und Zahlungs-E-Mail an.",
    "Shopper tools are designed for buying decisions. Seller tools are designed for business intelligence. Admin controls are private developer and operations tools.":
      "Käuferwerkzeuge sind für Kaufentscheidungen gedacht. Verkäuferwerkzeuge dienen Geschäftseinblicken. Admin-Kontrollen sind private Entwicklungs- und Betriebswerkzeuge.",
    "Manage billing, cancel renewal, downgrade, or contact support if you cannot access the billing portal.":
      "Verwalte Abrechnung, kündige Verlängerung, stuft herunter oder kontaktiere die Hilfe, wenn du das Abrechnungsportal nicht erreichst.",
    "Logged-in paid users can open the billing portal from this page or the Account page. Admin and local development accounts may see a simulated portal during development.":
      "Angemeldete zahlende Nutzer können das Abrechnungsportal hier oder auf der Kontoseite öffnen. Admin- und lokale Entwicklungskonten können ein simuliertes Portal sehen.",
    "Canceling stops future renewals. Downgrading changes future access according to the selected plan. If a portal link fails, email billing support with your account email.":
      "Kündigen stoppt künftige Verlängerungen. Herabstufen ändert den künftigen Zugriff gemäß Tarif. Wenn ein Portallink fehlschlägt, sende dem Abrechnungssupport deine Konto-E-Mail.",
    "Use the billing portal for payment cards, invoices, cancellation, and subscription status. Free Shopper accounts can upgrade anytime from the pricing page.":
      "Nutze das Abrechnungsportal für Zahlungskarten, Rechnungen, Kündigung und Abo-Status. Kostenlose Käuferkonten können jederzeit auf der Preisseite upgraden.",
    "Include your account email, plan name, charge date, and what you want changed.": "Gib Konto-E-Mail, Tarifname, Zahlungsdatum und die gewünschte Änderung an.",
    "Billing portal is unavailable. Email billing support and include your account email.": "Das Abrechnungsportal ist nicht verfügbar. Sende dem Abrechnungssupport deine Konto-E-Mail.",
    "Billing portal failed. Email billing support and include your account email.": "Das Abrechnungsportal ist fehlgeschlagen. Sende dem Abrechnungssupport deine Konto-E-Mail.",
    "Request account deletion, review-data deletion, access, correction, or export. We will use your account email to verify the request.":
      "Fordere Kontolöschung, Löschung von Bewertungsdaten, Zugriff, Korrektur oder Export an. Wir nutzen deine Konto-E-Mail zur Verifizierung.",
    "You can request account deletion, analysis deletion, data export, correction, or privacy questions.":
      "Du kannst Kontolöschung, Analyselöschung, Datenexport, Korrektur oder Datenschutzfragen anfordern.",
    "Tell us whether you want account deletion or only specific analysis data removed.": "Sag uns, ob du das Konto löschen oder nur bestimmte Analysedaten entfernen möchtest.",
    "Billing records may need to be retained where required by law or payment processors.": "Abrechnungsunterlagen müssen ggf. aufbewahrt werden, wenn Gesetze oder Zahlungsanbieter es verlangen.",
    "The app may store account role, plan, active mode, quota state, guest ID, and theme preference so the product works between page loads.":
      "Die App kann Kontorolle, Tarif, aktiven Modus, Kontingentstatus, Gast-ID und Theme-Präferenz speichern, damit das Produkt zwischen Seitenaufrufen funktioniert.",
    "You can clear cookies or local storage from your browser settings. Doing so may log you out, reset local workspace mode, or reset local quota display.":
      "Du kannst Browserdaten oder lokalen Speicher in den Browsereinstellungen löschen. Dadurch wirst du ggf. abgemeldet oder lokale Modi und Kontingente werden zurückgesetzt.",
    "Analyze product reviews, compare product feedback, identify complaints, improve listings, and understand customer satisfaction.":
      "Analysiere Produktbewertungen, vergleiche Feedback, erkenne Beschwerden, verbessere Listings und verstehe Kundenzufriedenheit.",
    "No fake-review creation or review manipulation.": "Keine Erstellung von Fake-Bewertungen oder Bewertungsmanipulation.",
    "No illegal, hateful, abusive, or privacy-invasive uploads.": "Keine illegalen, hasserfüllten, missbräuchlichen oder datenschutzverletzenden Uploads.",
    "No attempts to overload, probe, or bypass the app's security and quota systems.": "Keine Versuche, Sicherheits- und Kontingentsysteme zu überlasten, zu testen oder zu umgehen."
  },
  zh: {
    Marketplace: "市场平台",
    Retail: "零售",
    "Social commerce": "社交电商",
    Storefront: "店铺",
    Handmade: "手作",
    Resale: "转售",
    Electronics: "电子产品",
    "Marketplace intelligence": "平台洞察",
    "Review signal": "评价信号",
    "AI extracts risk + buyer signal": "AI 提取风险 + 买家信号",
    "AI scan core": "AI 扫描核心",
    "AI review intelligence": "AI 评价智能",
    "Buyers like speed and cleanup. Watch lid leaks and motor life.": "买家喜欢速度和易清洁。注意盖子漏水和电机寿命。",
    "Best for casual use — not heavy daily use.": "适合偶尔使用，不适合高强度日常使用。",
    "Seller insight: clarify warranty and replacement support.": "卖家洞察：说明保修和更换支持。",
    "Shoppers get the answer without reading a report. Sellers get a separate command view built for decisions, not shopping.":
      "购物者无需阅读报告即可得到答案。卖家获得专为决策而非购物设计的独立指挥视图。",
    "Portable blender: works fast, but several buyers mention leaking lids after two weeks.": "便携搅拌机：运行很快，但多位买家提到两周后盖子漏水。",
    "Air fryer: easy cleanup and crispy food, but basket coating scratches faster than expected.": "空气炸锅：清洁方便、食物酥脆，但炸篮涂层比预期更快刮花。",
    "LED mirror: looks beautiful on video, but buyers complain the stand feels unstable.": "LED 镜子：视频里很好看，但买家抱怨支架不够稳。",
    "Premium backpack: strong zippers and clean design, but laptop padding could be thicker.": "高端背包：拉链结实、设计简洁，但电脑夹层可以更厚。",
    "Handmade candle: scent is cozy and elegant, but some orders arrived with cracked glass.": "手工蜡烛：香味温暖优雅，但有些订单到货时玻璃破裂。",
    "Refurbished headphones: sound quality is solid, but battery life varies by seller.": "翻新耳机：音质不错，但续航因卖家而异。",
    "Gaming monitor: smooth refresh rate and bright color, but the stand takes too much desk space.": "游戏显示器：刷新顺滑、色彩明亮，但底座占桌面太多。",
    "Robot vacuum: great on hardwood floors, but pet hair clogs the brush more often than expected.": "扫地机器人：在木地板上很好用，但宠物毛比预期更常堵住刷子。",
    "Coffee maker: affordable and simple, but reviews mention the plastic smell during first uses.": "咖啡机：便宜简单，但评价提到初次使用有塑料味。",
    "Mini projector: fun for bedrooms, but buyers say daytime brightness is weaker than ads suggest.": "迷你投影仪：卧室使用很有趣，但买家说白天亮度低于广告暗示。",
    "Skincare set: packaging feels premium, but sensitive-skin buyers report mild irritation.": "护肤套装：包装有高级感，但敏感肌买家反馈轻微刺激。",
    "Custom mug: print quality looks sharp, but delivery time depends heavily on the seller.": "定制马克杯：印刷清晰，但配送时间很依赖卖家。",
    "Used tablet: screen condition was better than expected, but charger quality was inconsistent.": "二手平板：屏幕状况比预期好，但充电器质量不稳定。",
    "Bluetooth speaker: strong bass for the size, but app pairing confused several buyers.": "蓝牙音箱：体积虽小低音强，但应用配对让几位买家困惑。",
    "Market-ready review analysis for shoppers and ecommerce sellers, with clear support, billing, privacy, and subscription controls.":
      "面向购物者和电商卖家的可上线评价分析，并提供清晰的支持、账单、隐私和订阅控制。",
    "AI guidance for review decisions. Always verify critical product claims.": "用于评价决策的 AI 指引。重要产品声明请务必自行核实。",
    "Support:": "支持：",
    "Billing:": "账单：",
    Cookies: "Cookie 政策",
    "Delete Account": "删除账户",
    "Read Acceptable Use": "阅读可接受使用",
    "Contact customer service": "联系客户服务",
    "Open Billing Support": "打开账单支持",
    "Contact Privacy Support": "联系隐私支持",
    "Your email": "你的邮箱",
    "Support topic": "支持主题",
    "How can we help?": "我们可以怎样帮你？",
    "Direct email:": "直接邮箱：",
    "Tell us what happened, your plan, and what you need.": "告诉我们发生了什么、你的方案以及你需要什么。",
    "Product question": "产品问题",
    "Billing or cancellation": "账单或取消",
    "Account access": "账户访问",
    "Seller Pro report": "卖家 Pro 报告",
    "Data or privacy request": "数据或隐私请求",
    "Bug report": "错误报告",
    "Sending...": "正在发送...",
    "Message Sent": "消息已发送",
    "Send Message": "发送消息",
    "Saved. Admin inbox will show this message.": "已保存。管理员收件箱会显示此消息。",
    "Message failed.": "消息发送失败。",
    "Subscription controls": "订阅控制",
    "Manage billing or upgrade your plan.": "管理账单或升级方案。",
    "Open Billing Portal": "打开账单门户",
    "Upgrade to Premium": "升级到 Premium",
    "Need a person?": "需要人工帮助？",
    "Billing support": "账单支持",
    "Email Billing Support": "发送邮件给账单支持",
    "Read Refund Policy": "阅读退款政策",
    "Opening billing portal...": "正在打开账单门户...",
    "Log in first so ReviewIntel can locate your subscription.": "请先登录，以便 ReviewIntel 找到你的订阅。",
    "Shopper Free usage may be limited. Shopper Premium and Seller subscriptions unlock additional usage and features. You must keep your login information secure and use accurate billing information.":
      "免费购物者用量可能受限。购物者 Premium 和卖家订阅可解锁更多用量和功能。请保护登录信息并使用准确账单信息。",
    "Do not upload private customer data unless you have permission and a lawful reason.": "除非有许可和合法理由，请勿上传客户私人数据。",
    "Do not use the product to create fake reviews or manipulate marketplace trust systems.": "请勿用本产品创建虚假评价或操纵平台信任系统。",
    "Do not attempt to reverse engineer, overload, or bypass usage limits.": "请勿尝试逆向工程、过载或绕过用量限制。",
    "We may process account email, plan type, login metadata, uploaded review text, uploaded screenshots, analysis results, usage counts, and billing identifiers from payment providers.":
      "我们可能处理账户邮箱、方案类型、登录元数据、上传的评价文本和截图、分析结果、用量计数以及支付提供商的账单标识。",
    "Review text and screenshots are used to produce analysis results.": "评价文本和截图用于生成分析结果。",
    "Admin and support actions may record operational notes for troubleshooting.": "管理员和支持操作可能记录用于排错的操作备注。",
    "We use information to provide analysis, enforce usage limits, manage subscriptions, improve product quality, detect abuse, and respond to support requests.":
      "我们使用信息来提供分析、执行用量限制、管理订阅、提升产品质量、检测滥用并回应支持请求。",
    "We keep information only as long as needed for product operation, legal obligations, billing records, security, and customer support.":
      "我们仅在产品运行、法律义务、账单记录、安全和客户支持需要的期限内保留信息。",
    "You can cancel future renewals from Manage Subscription or by contacting billing support. Cancellation stops future billing but does not automatically refund previous charges.":
      "你可以在管理订阅中取消未来续费，或联系账单支持。取消会停止未来扣费，但不会自动退还之前费用。",
    "Refund requests are reviewed case by case. Include the account email, plan, charge date, and reason so support can locate the subscription quickly.":
      "退款请求会逐案审核。请提供账户邮箱、方案、扣费日期和原因，以便支持快速找到订阅。",
    "Duplicate charges and accidental upgrades are prioritized.": "重复扣费和误升级会优先处理。",
    "Refunds may be limited when the service was heavily used during the billing period.": "如果账期内大量使用服务，退款可能受限。",
    "Payment processor timing can affect how quickly funds appear back on a card.": "支付处理方的时间会影响款项回到银行卡的速度。",
    "You should confirm important product, safety, refund, medical, legal, financial, or warranty details from authoritative sources.":
      "重要的产品、安全、退款、医疗、法律、财务或保修信息应向权威来源确认。",
    "Seller analytics are intended to identify product improvement themes, not to manipulate reviews, pressure customers, or bypass platform rules.":
      "卖家分析用于识别产品改进主题，而不是操纵评价、施压客户或绕过平台规则。",
    "It analyzes pasted review text, TXT or CSV batches, and screenshot uploads. It estimates review volume, sentiment, complaints, fake-review risk, value for money, and recommendation signals.":
      "它分析粘贴的评价文本、TXT 或 CSV 批量文件以及上传截图，并估算评价量、情绪、投诉、虚假评价风险、性价比和推荐信号。",
    "Yes. Shopper Mode gives a fast buying verdict. Seller Mode produces deeper business intelligence with complaint clusters, feature requests, positioning ideas, and improvement actions.":
      "是的。购物者模式提供快速购买结论。卖家模式提供更深入的业务洞察，包括投诉聚类、功能请求、定位想法和改进行动。",
    "No. It estimates fake-review risk using language patterns, repetition, review quality, and evidence strength. Treat the score as a risk signal, not a legal finding.":
      "不能。它通过语言模式、重复度、评价质量和证据强度估算虚假评价风险。请把分数视为风险信号，而非法律结论。",
    "More review text usually improves confidence. For quick shopping decisions, a few dozen reviews can help. For Seller Pro decisions, larger CSV or TXT batches are better.":
      "更多评价文本通常会提高置信度。快速购买决策中，几十条评价会有帮助。卖家 Pro 决策更适合更大的 CSV 或 TXT 批量数据。",
    "Open Manage Subscription from the footer or account page. If the billing portal is unavailable, contact Billing Support and include your account email.":
      "从页脚或账户页打开管理订阅。如果账单门户不可用，请联系账单支持并附上账户邮箱。",
    "Billing support helps with subscriptions, failed checkout, duplicate charges, cancellation questions, and invoice requests.":
      "账单支持可帮助处理订阅、结账失败、重复扣费、取消问题和发票请求。",
    "Include your account email, plan, charge date, last four digits of the card if available, and what you need changed.":
      "请提供账户邮箱、方案、扣费日期、可用时提供卡片末四位，以及需要更改的内容。",
    "Use Manage Subscription first for cancellation and card updates. Contact billing support if the portal cannot find your subscription.":
      "请先使用管理订阅取消或更新卡片。如果门户找不到你的订阅，请联系账单支持。",
    "Get help with login issues, email verification, password reset, wrong workspace mode, or plan access.":
      "获取登录问题、邮箱验证、密码重置、工作区模式错误或方案访问方面的帮助。",
    "Use password reset if you cannot sign in. If your paid plan is missing, include your account email and payment email when contacting support.":
      "如果无法登录，请使用密码重置。如果付费方案缺失，联系支持时请提供账户邮箱和付款邮箱。",
    "Shopper tools are designed for buying decisions. Seller tools are designed for business intelligence. Admin controls are private developer and operations tools.":
      "购物者工具用于购买决策。卖家工具用于业务洞察。管理员控制是私有的开发和运营工具。",
    "Manage billing, cancel renewal, downgrade, or contact support if you cannot access the billing portal.":
      "管理账单、取消续费、降级，或在无法访问账单门户时联系支持。",
    "Logged-in paid users can open the billing portal from this page or the Account page. Admin and local development accounts may see a simulated portal during development.":
      "已登录的付费用户可以从此页或账户页打开账单门户。管理员和本地开发账户在开发期间可能看到模拟门户。",
    "Canceling stops future renewals. Downgrading changes future access according to the selected plan. If a portal link fails, email billing support with your account email.":
      "取消会停止未来续费。降级会按所选方案改变未来访问权限。如果门户链接失败，请发送账户邮箱给账单支持。",
    "Use the billing portal for payment cards, invoices, cancellation, and subscription status. Free Shopper accounts can upgrade anytime from the pricing page.":
      "使用账单门户管理支付卡、发票、取消和订阅状态。免费购物者账户可随时从价格页升级。",
    "Include your account email, plan name, charge date, and what you want changed.": "请提供账户邮箱、方案名称、扣费日期和你想更改的内容。",
    "Billing portal is unavailable. Email billing support and include your account email.": "账单门户不可用。请发送邮件给账单支持并附上账户邮箱。",
    "Billing portal failed. Email billing support and include your account email.": "账单门户打开失败。请发送邮件给账单支持并附上账户邮箱。",
    "Request account deletion, review-data deletion, access, correction, or export. We will use your account email to verify the request.":
      "请求删除账户、删除评价数据、访问、更正或导出。我们会使用账户邮箱验证请求。",
    "You can request account deletion, analysis deletion, data export, correction, or privacy questions.":
      "你可以请求删除账户、删除分析、导出数据、更正，或提出隐私问题。",
    "Tell us whether you want account deletion or only specific analysis data removed.": "请说明你要删除账户，还是只删除特定分析数据。",
    "Billing records may need to be retained where required by law or payment processors.": "法律或支付处理方要求时，账单记录可能需要保留。",
    "The app may store account role, plan, active mode, quota state, guest ID, and theme preference so the product works between page loads.":
      "应用可能存储账户角色、方案、当前模式、配额状态、访客 ID 和主题偏好，以便页面加载之间保持正常工作。",
    "You can clear cookies or local storage from your browser settings. Doing so may log you out, reset local workspace mode, or reset local quota display.":
      "你可以在浏览器设置中清除 Cookie 或本地存储。这可能让你退出登录、重置本地工作区模式或重置配额显示。",
    "Analyze product reviews, compare product feedback, identify complaints, improve listings, and understand customer satisfaction.":
      "分析产品评价、比较产品反馈、识别投诉、改进商品页并了解客户满意度。",
    "No fake-review creation or review manipulation.": "不得创建虚假评价或操纵评价。",
    "No illegal, hateful, abusive, or privacy-invasive uploads.": "不得上传非法、仇恨、辱骂或侵犯隐私的内容。",
    "No attempts to overload, probe, or bypass the app's security and quota systems.": "不得尝试过载、探测或绕过应用的安全和配额系统。"
  },
  hi: {
    Marketplace: "मार्केटप्लेस",
    Retail: "रिटेल",
    "Social commerce": "सोशल कॉमर्स",
    Storefront: "स्टोरफ्रंट",
    Handmade: "हैंडमेड",
    Resale: "रीसेल",
    Electronics: "इलेक्ट्रॉनिक्स",
    "Marketplace intelligence": "मार्केटप्लेस इंटेलिजेंस",
    "Review signal": "समीक्षा संकेत",
    "AI extracts risk + buyer signal": "AI जोखिम + खरीदार संकेत निकालता है",
    "AI scan core": "AI स्कैन कोर",
    "AI review intelligence": "AI समीक्षा इंटेलिजेंस",
    "Buyers like speed and cleanup. Watch lid leaks and motor life.": "खरीदार गति और आसान सफाई पसंद करते हैं। ढक्कन लीक और मोटर उम्र पर ध्यान दें।",
    "Best for casual use — not heavy daily use.": "हल्के उपयोग के लिए सबसे अच्छा, भारी दैनिक उपयोग के लिए नहीं।",
    "Seller insight: clarify warranty and replacement support.": "विक्रेता जानकारी: वारंटी और रिप्लेसमेंट सहायता साफ करें।",
    "Shoppers get the answer without reading a report. Sellers get a separate command view built for decisions, not shopping.":
      "शॉपर रिपोर्ट पढ़े बिना जवाब पाते हैं। विक्रेताओं को खरीदारी नहीं, निर्णयों के लिए अलग कमांड दृश्य मिलता है।",
    "Portable blender: works fast, but several buyers mention leaking lids after two weeks.": "पोर्टेबल ब्लेंडर: तेज़ काम करता है, लेकिन कई खरीदार दो हफ्ते बाद ढक्कन लीक होने की बात कहते हैं।",
    "Air fryer: easy cleanup and crispy food, but basket coating scratches faster than expected.": "एयर फ्रायर: सफाई आसान और खाना कुरकुरा, लेकिन बास्केट कोटिंग उम्मीद से जल्दी खरोंचती है।",
    "LED mirror: looks beautiful on video, but buyers complain the stand feels unstable.": "LED मिरर: वीडियो में सुंदर दिखता है, लेकिन खरीदार स्टैंड को अस्थिर बताते हैं।",
    "Premium backpack: strong zippers and clean design, but laptop padding could be thicker.": "प्रीमियम बैकपैक: मजबूत ज़िप और साफ डिज़ाइन, लेकिन लैपटॉप पैडिंग और मोटी हो सकती है।",
    "Handmade candle: scent is cozy and elegant, but some orders arrived with cracked glass.": "हैंडमेड कैंडल: खुशबू आरामदायक और सुंदर, लेकिन कुछ ऑर्डर टूटे काँच के साथ आए।",
    "Refurbished headphones: sound quality is solid, but battery life varies by seller.": "रीफर्बिश्ड हेडफ़ोन: आवाज़ अच्छी है, लेकिन बैटरी लाइफ विक्रेता के हिसाब से बदलती है।",
    "Gaming monitor: smooth refresh rate and bright color, but the stand takes too much desk space.": "गेमिंग मॉनिटर: रिफ्रेश रेट स्मूद और रंग चमकीले, लेकिन स्टैंड बहुत जगह लेता है।",
    "Robot vacuum: great on hardwood floors, but pet hair clogs the brush more often than expected.": "रोबोट वैक्यूम: हार्डवुड फर्श पर बढ़िया, लेकिन पालतू बाल ब्रश को उम्मीद से अधिक बार जाम करते हैं।",
    "Coffee maker: affordable and simple, but reviews mention the plastic smell during first uses.": "कॉफी मेकर: किफायती और सरल, लेकिन शुरुआती उपयोग में प्लास्टिक गंध का उल्लेख है।",
    "Mini projector: fun for bedrooms, but buyers say daytime brightness is weaker than ads suggest.": "मिनी प्रोजेक्टर: बेडरूम के लिए मज़ेदार, लेकिन खरीदार कहते हैं कि दिन की ब्राइटनेस विज्ञापन से कम है।",
    "Skincare set: packaging feels premium, but sensitive-skin buyers report mild irritation.": "स्किनकेयर सेट: पैकेजिंग प्रीमियम लगती है, लेकिन संवेदनशील त्वचा वाले खरीदार हल्की जलन बताते हैं।",
    "Custom mug: print quality looks sharp, but delivery time depends heavily on the seller.": "कस्टम मग: प्रिंट साफ दिखता है, लेकिन डिलीवरी समय विक्रेता पर बहुत निर्भर है।",
    "Used tablet: screen condition was better than expected, but charger quality was inconsistent.": "यूज़्ड टैबलेट: स्क्रीन उम्मीद से बेहतर थी, लेकिन चार्जर की गुणवत्ता असमान रही।",
    "Bluetooth speaker: strong bass for the size, but app pairing confused several buyers.": "ब्लूटूथ स्पीकर: आकार के हिसाब से बास मजबूत, लेकिन ऐप पेयरिंग ने कई खरीदारों को उलझाया।",
    "Market-ready review analysis for shoppers and ecommerce sellers, with clear support, billing, privacy, and subscription controls.":
      "शॉपर और ईकॉमर्स विक्रेताओं के लिए तैयार समीक्षा विश्लेषण, साफ सपोर्ट, बिलिंग, गोपनीयता और सदस्यता नियंत्रणों के साथ।",
    "AI guidance for review decisions. Always verify critical product claims.": "समीक्षा निर्णयों के लिए AI मार्गदर्शन। महत्वपूर्ण उत्पाद दावों की हमेशा पुष्टि करें।",
    "Support:": "सहायता:",
    "Billing:": "बिलिंग:",
    Cookies: "कुकी नीति",
    "Delete Account": "खाता हटाएँ",
    "Read Acceptable Use": "स्वीकार्य उपयोग पढ़ें",
    "Contact customer service": "ग्राहक सेवा से संपर्क करें",
    "Open Billing Support": "बिलिंग सहायता खोलें",
    "Contact Privacy Support": "गोपनीयता सहायता से संपर्क करें",
    "Your email": "आपका ईमेल",
    "Support topic": "सहायता विषय",
    "How can we help?": "हम कैसे मदद कर सकते हैं?",
    "Direct email:": "सीधा ईमेल:",
    "Tell us what happened, your plan, and what you need.": "बताएँ क्या हुआ, आपका प्लान और आपको क्या चाहिए।",
    "Product question": "उत्पाद प्रश्न",
    "Billing or cancellation": "बिलिंग या रद्दीकरण",
    "Account access": "खाता पहुँच",
    "Seller Pro report": "विक्रेता Pro रिपोर्ट",
    "Data or privacy request": "डेटा या गोपनीयता अनुरोध",
    "Bug report": "बग रिपोर्ट",
    "Sending...": "भेजा जा रहा है...",
    "Message Sent": "संदेश भेजा गया",
    "Send Message": "संदेश भेजें",
    "Saved. Admin inbox will show this message.": "सहेजा गया। एडमिन इनबॉक्स यह संदेश दिखाएगा।",
    "Message failed.": "संदेश विफल रहा।",
    "Subscription controls": "सदस्यता नियंत्रण",
    "Manage billing or upgrade your plan.": "बिलिंग प्रबंधित करें या प्लान अपग्रेड करें।",
    "Open Billing Portal": "बिलिंग पोर्टल खोलें",
    "Upgrade to Premium": "Premium में अपग्रेड करें",
    "Need a person?": "किसी व्यक्ति से मदद चाहिए?",
    "Billing support": "बिलिंग सहायता",
    "Email Billing Support": "बिलिंग सहायता को ईमेल करें",
    "Read Refund Policy": "रिफंड नीति पढ़ें",
    "Opening billing portal...": "बिलिंग पोर्टल खुल रहा है...",
    "Log in first so ReviewIntel can locate your subscription.": "पहले लॉगिन करें ताकि ReviewIntel आपकी सदस्यता ढूँढ सके।",
    "Shopper Free usage may be limited. Shopper Premium and Seller subscriptions unlock additional usage and features. You must keep your login information secure and use accurate billing information.":
      "शॉपर Free उपयोग सीमित हो सकता है। शॉपर Premium और विक्रेता सदस्यताएँ अतिरिक्त उपयोग और सुविधाएँ खोलती हैं। लॉगिन जानकारी सुरक्षित रखें और सही बिलिंग जानकारी उपयोग करें।",
    "Do not upload private customer data unless you have permission and a lawful reason.": "अनुमति और वैध कारण के बिना निजी ग्राहक डेटा अपलोड न करें।",
    "Do not use the product to create fake reviews or manipulate marketplace trust systems.": "नकली समीक्षाएँ बनाने या मार्केटप्लेस भरोसा प्रणाली से छेड़छाड़ के लिए उत्पाद का उपयोग न करें।",
    "Do not attempt to reverse engineer, overload, or bypass usage limits.": "रिवर्स इंजीनियरिंग, ओवरलोड या उपयोग सीमाएँ बायपास करने का प्रयास न करें।",
    "We may process account email, plan type, login metadata, uploaded review text, uploaded screenshots, analysis results, usage counts, and billing identifiers from payment providers.":
      "हम खाता ईमेल, प्लान प्रकार, लॉगिन मेटाडेटा, अपलोड समीक्षा टेक्स्ट, स्क्रीनशॉट, विश्लेषण परिणाम, उपयोग गिनती और भुगतान प्रदाताओं के बिलिंग पहचानकर्ता प्रोसेस कर सकते हैं।",
    "Review text and screenshots are used to produce analysis results.": "समीक्षा टेक्स्ट और स्क्रीनशॉट विश्लेषण परिणाम बनाने के लिए उपयोग होते हैं।",
    "Admin and support actions may record operational notes for troubleshooting.": "एडमिन और सपोर्ट कार्रवाइयाँ समस्या समाधान के लिए ऑपरेशनल नोट्स दर्ज कर सकती हैं।",
    "We use information to provide analysis, enforce usage limits, manage subscriptions, improve product quality, detect abuse, and respond to support requests.":
      "हम जानकारी का उपयोग विश्लेषण देने, उपयोग सीमा लागू करने, सदस्यता प्रबंधित करने, उत्पाद गुणवत्ता सुधारने, दुरुपयोग पहचानने और सहायता अनुरोधों का जवाब देने में करते हैं।",
    "We keep information only as long as needed for product operation, legal obligations, billing records, security, and customer support.":
      "हम जानकारी केवल उत्पाद संचालन, कानूनी दायित्व, बिलिंग रिकॉर्ड, सुरक्षा और ग्राहक सहायता के लिए आवश्यक समय तक रखते हैं।",
    "You can cancel future renewals from Manage Subscription or by contacting billing support. Cancellation stops future billing but does not automatically refund previous charges.":
      "आप सदस्यता प्रबंधन से या बिलिंग सहायता से संपर्क कर भविष्य के नवीनीकरण रद्द कर सकते हैं। रद्दीकरण भविष्य की बिलिंग रोकता है, पर पिछले शुल्क अपने-आप वापस नहीं करता।",
    "Refund requests are reviewed case by case. Include the account email, plan, charge date, and reason so support can locate the subscription quickly.":
      "रिफंड अनुरोध मामले-दर-मामला देखे जाते हैं। खाता ईमेल, प्लान, शुल्क तिथि और कारण शामिल करें ताकि सहायता सदस्यता जल्दी ढूँढ सके।",
    "Duplicate charges and accidental upgrades are prioritized.": "डुप्लिकेट शुल्क और गलती से हुए अपग्रेड को प्राथमिकता मिलती है।",
    "Refunds may be limited when the service was heavily used during the billing period.": "बिलिंग अवधि में सेवा का भारी उपयोग होने पर रिफंड सीमित हो सकता है।",
    "Payment processor timing can affect how quickly funds appear back on a card.": "भुगतान प्रोसेसर का समय कार्ड पर धन लौटने की गति को प्रभावित कर सकता है।",
    "You should confirm important product, safety, refund, medical, legal, financial, or warranty details from authoritative sources.":
      "महत्वपूर्ण उत्पाद, सुरक्षा, रिफंड, चिकित्सा, कानूनी, वित्तीय या वारंटी विवरण विश्वसनीय स्रोतों से पुष्टि करें।",
    "Seller analytics are intended to identify product improvement themes, not to manipulate reviews, pressure customers, or bypass platform rules.":
      "विक्रेता विश्लेषण उत्पाद सुधार विषय पहचानने के लिए है, समीक्षाओं में हेरफेर, ग्राहकों पर दबाव या प्लेटफॉर्म नियम बायपास करने के लिए नहीं।",
    "It analyzes pasted review text, TXT or CSV batches, and screenshot uploads. It estimates review volume, sentiment, complaints, fake-review risk, value for money, and recommendation signals.":
      "यह पेस्ट किए गए समीक्षा टेक्स्ट, TXT या CSV बैच और स्क्रीनशॉट अपलोड का विश्लेषण करता है। यह समीक्षा मात्रा, भावना, शिकायतें, नकली समीक्षा जोखिम, पैसे का मूल्य और सिफारिश संकेत अनुमानित करता है।",
    "Yes. Shopper Mode gives a fast buying verdict. Seller Mode produces deeper business intelligence with complaint clusters, feature requests, positioning ideas, and improvement actions.":
      "हाँ। शॉपर मोड तेज खरीद निर्णय देता है। विक्रेता मोड शिकायत समूह, फीचर अनुरोध, पोजिशनिंग विचार और सुधार कार्रवाइयों के साथ गहरी व्यावसायिक समझ देता है।",
    "No. It estimates fake-review risk using language patterns, repetition, review quality, and evidence strength. Treat the score as a risk signal, not a legal finding.":
      "नहीं। यह भाषा पैटर्न, दोहराव, समीक्षा गुणवत्ता और प्रमाण ताकत से नकली समीक्षा जोखिम अनुमानित करता है। स्कोर को जोखिम संकेत मानें, कानूनी निष्कर्ष नहीं।",
    "More review text usually improves confidence. For quick shopping decisions, a few dozen reviews can help. For Seller Pro decisions, larger CSV or TXT batches are better.":
      "अधिक समीक्षा टेक्स्ट आमतौर पर भरोसा बढ़ाता है। तेज खरीद निर्णयों में कुछ दर्जन समीक्षाएँ मदद करती हैं। विक्रेता Pro निर्णयों के लिए बड़े CSV या TXT बैच बेहतर हैं।",
    "Open Manage Subscription from the footer or account page. If the billing portal is unavailable, contact Billing Support and include your account email.":
      "फुटर या खाता पेज से सदस्यता प्रबंधन खोलें। यदि बिलिंग पोर्टल उपलब्ध नहीं है, तो बिलिंग सहायता से संपर्क करें और खाता ईमेल शामिल करें।",
    "Billing support helps with subscriptions, failed checkout, duplicate charges, cancellation questions, and invoice requests.":
      "बिलिंग सहायता सदस्यता, विफल checkout, डुप्लिकेट शुल्क, रद्दीकरण प्रश्न और invoice अनुरोधों में मदद करती है।",
    "Include your account email, plan, charge date, last four digits of the card if available, and what you need changed.":
      "खाता ईमेल, प्लान, शुल्क तिथि, उपलब्ध हो तो कार्ड के अंतिम चार अंक, और क्या बदलना है शामिल करें।",
    "Use Manage Subscription first for cancellation and card updates. Contact billing support if the portal cannot find your subscription.":
      "रद्दीकरण और कार्ड अपडेट के लिए पहले सदस्यता प्रबंधन उपयोग करें। पोर्टल सदस्यता न ढूँढ पाए तो बिलिंग सहायता से संपर्क करें।",
    "Get help with login issues, email verification, password reset, wrong workspace mode, or plan access.":
      "लॉगिन समस्या, ईमेल सत्यापन, पासवर्ड reset, गलत workspace मोड या प्लान पहुँच में मदद पाएँ।",
    "Use password reset if you cannot sign in. If your paid plan is missing, include your account email and payment email when contacting support.":
      "साइन इन न हो तो पासवर्ड रीसेट उपयोग करें। भुगतान प्लान गायब हो तो सहायता से संपर्क करते समय खाता ईमेल और भुगतान ईमेल शामिल करें।",
    "Shopper tools are designed for buying decisions. Seller tools are designed for business intelligence. Admin controls are private developer and operations tools.":
      "शॉपर टूल खरीद निर्णयों के लिए हैं। विक्रेता टूल बिजनेस इंटेलिजेंस के लिए हैं। एडमिन नियंत्रण निजी developer और operations टूल हैं।",
    "Manage billing, cancel renewal, downgrade, or contact support if you cannot access the billing portal.":
      "बिलिंग प्रबंधित करें, नवीनीकरण रद्द करें, डाउनग्रेड करें, या बिलिंग पोर्टल न खुलने पर सहायता से संपर्क करें।",
    "Logged-in paid users can open the billing portal from this page or the Account page. Admin and local development accounts may see a simulated portal during development.":
      "लॉगिन किए हुए भुगतान उपयोगकर्ता इस पेज या अकाउंट पेज से बिलिंग पोर्टल खोल सकते हैं। एडमिन और लोकल डेवलपमेंट खातों को विकास के दौरान सिम्युलेटेड पोर्टल दिख सकता है।",
    "Canceling stops future renewals. Downgrading changes future access according to the selected plan. If a portal link fails, email billing support with your account email.":
      "रद्द करने से भविष्य के नवीनीकरण रुकते हैं। डाउनग्रेड चुने गए प्लान के अनुसार भविष्य की पहुँच बदलता है। पोर्टल लिंक विफल हो तो खाता ईमेल के साथ बिलिंग सहायता को ईमेल करें।",
    "Use the billing portal for payment cards, invoices, cancellation, and subscription status. Free Shopper accounts can upgrade anytime from the pricing page.":
      "भुगतान कार्ड, इनवॉइस, रद्दीकरण और सदस्यता स्थिति के लिए बिलिंग पोर्टल उपयोग करें। मुफ्त शॉपर खाते मूल्य पेज से कभी भी अपग्रेड कर सकते हैं।",
    "Include your account email, plan name, charge date, and what you want changed.": "खाता ईमेल, प्लान नाम, शुल्क तिथि और आप क्या बदलना चाहते हैं शामिल करें।",
    "Billing portal is unavailable. Email billing support and include your account email.": "बिलिंग पोर्टल उपलब्ध नहीं है। खाता ईमेल के साथ बिलिंग सहायता को ईमेल करें।",
    "Billing portal failed. Email billing support and include your account email.": "बिलिंग पोर्टल विफल रहा। खाता ईमेल के साथ बिलिंग सहायता को ईमेल करें।",
    "Request account deletion, review-data deletion, access, correction, or export. We will use your account email to verify the request.":
      "खाता हटाने, समीक्षा डेटा हटाने, पहुँच, सुधार या निर्यात का अनुरोध करें। अनुरोध सत्यापित करने के लिए हम आपका खाता ईमेल उपयोग करेंगे।",
    "You can request account deletion, analysis deletion, data export, correction, or privacy questions.":
      "आप खाता हटाने, विश्लेषण हटाने, डेटा निर्यात, सुधार या गोपनीयता प्रश्नों का अनुरोध कर सकते हैं।",
    "Tell us whether you want account deletion or only specific analysis data removed.": "बताएँ कि आप खाता हटाना चाहते हैं या केवल विशिष्ट विश्लेषण डेटा हटाना चाहते हैं।",
    "Billing records may need to be retained where required by law or payment processors.": "जहाँ कानून या भुगतान प्रोसेसर मांगें, बिलिंग रिकॉर्ड रखना पड़ सकता है।",
    "The app may store account role, plan, active mode, quota state, guest ID, and theme preference so the product works between page loads.":
      "ऐप खाता भूमिका, प्लान, सक्रिय मोड, कोटा स्थिति, गेस्ट ID और थीम पसंद सहेज सकता है ताकि पेज लोड के बीच उत्पाद काम करे।",
    "You can clear cookies or local storage from your browser settings. Doing so may log you out, reset local workspace mode, or reset local quota display.":
      "आप ब्राउज़र सेटिंग्स से कुकी या लोकल स्टोरेज साफ कर सकते हैं। इससे आप लॉग आउट हो सकते हैं, लोकल वर्कस्पेस मोड या कोटा डिस्प्ले रीसेट हो सकता है।",
    "Analyze product reviews, compare product feedback, identify complaints, improve listings, and understand customer satisfaction.":
      "उत्पाद समीक्षाएँ विश्लेषित करें, प्रतिक्रिया की तुलना करें, शिकायतें पहचानें, लिस्टिंग सुधारें और ग्राहक संतुष्टि समझें।",
    "No fake-review creation or review manipulation.": "नकली समीक्षा बनाना या समीक्षा में हेरफेर नहीं।",
    "No illegal, hateful, abusive, or privacy-invasive uploads.": "गैरकानूनी, घृणास्पद, अपमानजनक या गोपनीयता-भंग अपलोड नहीं।",
    "No attempts to overload, probe, or bypass the app's security and quota systems.": "ऐप की सुरक्षा और कोटा प्रणाली को ओवरलोड, जांचने या बायपास करने का प्रयास नहीं।"
  }
} satisfies Partial<Record<ReviewIntelLocale, Record<string, string>>>;

const coreRouteAuditPhraseTranslations: Partial<Record<ReviewIntelLocale, Record<string, string>>> = {
  fr: {
    "Public sample results have been removed from the customer experience. Paste reviews or upload a CSV/TXT file to generate a fresh result.":
      "Les exemples publics de résultats ont été retirés de l’expérience client. Collez des avis ou téléversez un fichier CSV/TXT pour générer un nouveau résultat.",
    "Shopper tools stay simple and recommendation-focused.": "Les outils acheteur restent simples et centrés sur la recommandation.",
    "Manage subscription": "Gérer l’abonnement",
    "Your saved product checks, buying verdicts, fake-review warnings, and best finds in one clean view.":
      "Vos analyses produits, verdicts d’achat, alertes de faux avis et meilleures trouvailles dans une vue claire.",
    "Know what to buy, compare, or avoid.": "Sachez quoi acheter, comparer ou éviter.",
    "This dashboard keeps your scanned products organized so you do not have to reread reviews again before checkout.":
      "Ce tableau garde vos produits analysés organisés pour éviter de relire les avis avant l’achat.",
    "Scan a product to start your tally.": "Analysez un produit pour commencer le suivi.",
    "Products with the strongest buying signal.": "Produits avec le meilleur signal d’achat.",
    "Products that need caution or comparison.": "Produits qui demandent prudence ou comparaison.",
    "Products with avoid signals or suspicious reviews.": "Produits avec signaux d’évitement ou avis suspects.",
    "No shopper scans saved yet. Scan a product to start your buying history.": "Aucune analyse acheteur enregistrée. Analysez un produit pour commencer l’historique.",
    "Fake-review alerts": "Alertes de faux avis",
    "You get 3 free scans per day.": "Vous obtenez 3 analyses gratuites par jour.",
    "Upgrade to Shopper Premium for more scans, deeper fake-review reasoning, and a fuller buying-confidence history.":
      "Passez à Acheteur Premium pour plus d’analyses, un raisonnement plus profond sur les faux avis et un historique de confiance plus complet.",
    "Login required": "Connexion requise",
    "Please log in to open the seller dashboard.": "Connectez-vous pour ouvrir le tableau vendeur.",
    "Seller dashboards are tied to a real account so scans, usage, and product history stay separated by user.":
      "Les tableaux vendeur sont liés à un vrai compte afin de séparer analyses, usage et historique produit par utilisateur.",
    "Seller tools stay separate from shopper purchase decisions.": "Les outils vendeur restent séparés des décisions d’achat acheteur.",
    "Your Seller Pro workspace for product health, review signals, and improvement tracking.":
      "Votre espace Vendeur Pro pour la santé produit, les signaux d’avis et le suivi des améliorations.",
    "Run seller scans to start tracking products.": "Lancez des analyses vendeur pour commencer le suivi des produits.",
    "Normal saved seller scans used for product improvement.": "Analyses vendeur normales enregistrées pour l’amélioration produit.",
    "Average score from saved seller product scans.": "Score moyen des analyses produit vendeur enregistrées.",
    "No product focus yet.": "Aucun produit prioritaire pour l’instant.",
    "No product selected yet": "Aucun produit sélectionné",
    "Run seller scans to identify the product that needs the most improvement.": "Lancez des analyses vendeur pour trouver le produit qui demande le plus d’amélioration.",
    "No strong product signal yet": "Aucun signal produit fort pour l’instant",
    "Your strongest product will appear once seller scans are saved.": "Votre meilleur produit apparaîtra quand des analyses vendeur seront enregistrées.",
    "Compare results guide strategy, but do not affect product health averages.": "Les comparaisons guident la stratégie sans modifier les moyennes de santé produit.",
    "Use compare scans to find positioning opportunities, competitor weaknesses, and product advantages. They should guide strategy but not change normal product health averages.":
      "Utilisez les comparaisons pour trouver opportunités de positionnement, faiblesses concurrentes et avantages produit. Elles guident la stratégie sans changer les moyennes normales.",
    "All saved seller products, grouped by product name and sorted by improvement priority.":
      "Tous les produits vendeur enregistrés, groupés par nom et triés par priorité d’amélioration.",
    "See every product you are tracking.": "Voyez chaque produit suivi.",
    "Use this page when you have many products. The main dashboard stays clean, while this page shows the full product list.":
      "Utilisez cette page avec beaucoup de produits. Le tableau principal reste clair, cette page affiche la liste complète.",
    "Back to Seller Dashboard": "Retour au tableau vendeur",
    "Run a seller analysis and attach it to a product. Your products will appear here automatically.":
      "Lancez une analyse vendeur et associez-la à un produit. Vos produits apparaîtront ici automatiquement.",
    "Run Seller Scan": "Lancer une analyse vendeur",
    "Localized pricing display": "Affichage de prix localisé",
    "USD prices are shown by default.": "Les prix USD sont affichés par défaut.",
    "For shoppers testing products before buying.": "Pour les acheteurs qui testent des produits avant l’achat.",
    "3 product analyses per day": "3 analyses produit par jour",
    "Use Shopper Free": "Utiliser Acheteur gratuit",
    Subscription: "Abonnement",
    "For frequent shoppers comparing multiple products.": "Pour les acheteurs fréquents qui comparent plusieurs produits.",
    "Unlimited shopper analyses": "Analyses acheteur illimitées",
    "Product history": "Historique produit",
    "Upgrade Shopper Premium": "Passer à Acheteur Premium",
    "For small ecommerce sellers diagnosing reviews.": "Pour petits vendeurs e-commerce qui diagnostiquent les avis.",
    "Seller trust snapshot": "Instantané de confiance vendeur",
    "View Shopper Premium": "Voir Acheteur Premium",
    "Upgrade Seller Premium": "Passer à Vendeur Premium",
    "For sellers comparing competitors and finding market gaps.": "Pour les vendeurs qui comparent les concurrents et trouvent des écarts de marché.",
    "Product improvement calendar tracker": "Calendrier de suivi des améliorations produit",
    "Advanced seller recommendations": "Recommandations vendeur avancées",
    "Upgrade Seller Pro": "Passer à Vendeur Pro",
    "Need subscription help before checkout?": "Besoin d’aide abonnement avant le paiement ?",
    "Review refund terms, billing support, and cancellation controls before upgrading.":
      "Consultez les conditions de remboursement, l’assistance facturation et les contrôles d’annulation avant la mise à niveau.",
    "Real customer feedback, approved before publishing.": "Vrais retours clients, approuvés avant publication.",
    "Users can submit feedback here. Reviews do not appear publicly until they are approved from the Admin dashboard.":
      "Les utilisateurs peuvent envoyer un avis ici. Les avis ne sont publics qu’après approbation depuis le tableau admin.",
    "No public reviews yet": "Aucun avis public pour l’instant",
    "We do not publish fake testimonials. Approved user reviews will appear here after moderation.":
      "Nous ne publions pas de faux témoignages. Les avis approuvés apparaîtront ici après modération.",
    "Email optional": "E-mail facultatif",
    "Short review": "Avis court",
    "Submit Review": "Envoyer l’avis",
    "Shoppers get a fast read on quality, complaints, praised features, value, and buying risk without reading pages of reviews.":
      "Les acheteurs voient vite la qualité, les plaintes, les points appréciés, la valeur et le risque d’achat sans lire des pages d’avis.",
    "Sellers get product improvement signals, listing fixes, packaging issues, refund-risk themes, and competitor openings.":
      "Les vendeurs obtiennent des signaux d’amélioration, corrections de fiche, problèmes d’emballage, thèmes de risque de remboursement et ouvertures concurrentes.",
    "Advertisers pay, upload a banner or short video, and ReviewIntel verifies payment plus creative quality before any campaign goes live.":
      "Les annonceurs paient, téléversent une bannière ou une courte vidéo, puis ReviewIntel vérifie le paiement et la qualité créative avant toute diffusion.",
    "Manual review before publishing": "Vérification manuelle avant publication",
    "Good for early visibility": "Bon pour une visibilité initiale",
    "Best for smaller campaigns": "Idéal pour les petites campagnes",
    "Pay for Sponsored Resource Placement": "Payer le placement de ressource sponsorisée",
    "Best for premium campaigns": "Idéal pour les campagnes premium",
    "Pay for Featured Sponsored Resource": "Payer la ressource sponsorisée en vedette",
    "We manually review each sponsored resource before publishing. We may reject irrelevant, unsafe, misleading, or low-quality placements and issue a refund when appropriate.":
      "Nous vérifions chaque ressource sponsorisée avant publication. Nous pouvons refuser les placements non pertinents, risqués, trompeurs ou faibles et rembourser si nécessaire.",
    "Refund policy": "Politique de remboursement",
    "Product comparison": "Comparaison de produits",
    "Compare two products by review evidence": "Comparez deux produits selon les preuves des avis",
    "Shopper mode: which product should I buy?": "Mode acheteur : quel produit acheter ?",
    "Built for shoppers. It weighs review quality, complaints, value, durability, shipping, and your buying priorities.":
      "Conçu pour les acheteurs. Il évalue qualité des avis, plaintes, valeur, durabilité, livraison et priorités d’achat.",
    "Shopper mode": "Mode acheteur",
    "Seller mode": "Mode vendeur",
    "What matters most to you?": "Qu’est-ce qui compte le plus pour vous ?",
    "Best reviews": "Meilleurs avis",
    "Daily use": "Usage quotidien",
    "Business use": "Usage professionnel",
    "Product 1": "Produit 1",
    "Product 2": "Produit 2",
    "Create a free account before comparing products.": "Créez un compte gratuit avant de comparer des produits.",
    "Free users get 3 total AI actions across Analyze and Compare combined. Sign up first so your usage and results stay attached to your account.":
      "Les utilisateurs gratuits obtiennent 3 actions IA au total entre Analyser et Comparer. Inscrivez-vous d’abord pour garder usage et résultats liés au compte.",
    "Analyze one product = 1 AI action": "Analyser un produit = 1 action IA",
    "Free account total = 3 AI actions": "Total compte gratuit = 3 actions IA"
  },
  es: {
    "Public sample results have been removed from the customer experience. Paste reviews or upload a CSV/TXT file to generate a fresh result.":
      "Los resultados públicos de muestra se retiraron de la experiencia del cliente. Pega reseñas o sube un archivo CSV/TXT para generar un resultado nuevo.",
    "Shopper tools stay simple and recommendation-focused.": "Las herramientas de comprador se mantienen simples y enfocadas en recomendaciones.",
    "Manage subscription": "Gestionar suscripción",
    "Your saved product checks, buying verdicts, fake-review warnings, and best finds in one clean view.":
      "Tus revisiones guardadas, veredictos de compra, alertas de reseñas falsas y mejores hallazgos en una vista clara.",
    "Know what to buy, compare, or avoid.": "Sabe qué comprar, comparar o evitar.",
    "This dashboard keeps your scanned products organized so you do not have to reread reviews again before checkout.":
      "Este panel organiza tus productos analizados para no releer reseñas antes de pagar.",
    "Scan a product to start your tally.": "Analiza un producto para iniciar tu conteo.",
    "Products with the strongest buying signal.": "Productos con la señal de compra más fuerte.",
    "Products that need caution or comparison.": "Productos que necesitan cautela o comparación.",
    "Products with avoid signals or suspicious reviews.": "Productos con señales de evitar o reseñas sospechosas.",
    "No shopper scans saved yet. Scan a product to start your buying history.": "Aún no hay análisis de comprador guardados. Analiza un producto para iniciar tu historial.",
    "Fake-review alerts": "Alertas de reseñas falsas",
    "You get 3 free scans per day.": "Tienes 3 análisis gratis por día.",
    "Upgrade to Shopper Premium for more scans, deeper fake-review reasoning, and a fuller buying-confidence history.":
      "Mejora a Comprador Premium para más análisis, razonamiento más profundo sobre reseñas falsas y un historial de confianza más completo.",
    "Login required": "Inicio de sesión requerido",
    "Please log in to open the seller dashboard.": "Inicia sesión para abrir el panel del vendedor.",
    "Seller dashboards are tied to a real account so scans, usage, and product history stay separated by user.":
      "Los paneles de vendedor se vinculan a una cuenta real para separar análisis, uso e historial por usuario.",
    "Seller tools stay separate from shopper purchase decisions.": "Las herramientas de vendedor quedan separadas de las decisiones de compra.",
    "Your Seller Pro workspace for product health, review signals, and improvement tracking.":
      "Tu espacio Vendedor Pro para salud del producto, señales de reseñas y seguimiento de mejoras.",
    "Run seller scans to start tracking products.": "Ejecuta análisis de vendedor para empezar a seguir productos.",
    "Normal saved seller scans used for product improvement.": "Análisis de vendedor normales guardados para mejora de producto.",
    "Average score from saved seller product scans.": "Puntuación promedio de análisis de producto vendedor guardados.",
    "No product focus yet.": "Aún no hay producto prioritario.",
    "No product selected yet": "Aún no hay producto seleccionado",
    "Run seller scans to identify the product that needs the most improvement.": "Ejecuta análisis de vendedor para identificar el producto que más mejora necesita.",
    "No strong product signal yet": "Aún no hay señal fuerte de producto",
    "Your strongest product will appear once seller scans are saved.": "Tu producto más fuerte aparecerá cuando se guarden análisis de vendedor.",
    "Compare results guide strategy, but do not affect product health averages.": "Los resultados comparativos guían la estrategia, pero no afectan promedios de salud del producto.",
    "Use compare scans to find positioning opportunities, competitor weaknesses, and product advantages. They should guide strategy but not change normal product health averages.":
      "Usa comparaciones para encontrar oportunidades de posicionamiento, debilidades de competidores y ventajas del producto. Deben guiar estrategia sin cambiar promedios normales.",
    "All saved seller products, grouped by product name and sorted by improvement priority.":
      "Todos los productos de vendedor guardados, agrupados por nombre y ordenados por prioridad de mejora.",
    "See every product you are tracking.": "Ve todos los productos que sigues.",
    "Use this page when you have many products. The main dashboard stays clean, while this page shows the full product list.":
      "Usa esta página cuando tengas muchos productos. El panel principal queda limpio y esta página muestra la lista completa.",
    "Back to Seller Dashboard": "Volver al panel del vendedor",
    "Run a seller analysis and attach it to a product. Your products will appear here automatically.":
      "Ejecuta un análisis de vendedor y adjúntalo a un producto. Tus productos aparecerán aquí automáticamente.",
    "Run Seller Scan": "Ejecutar análisis de vendedor",
    "Localized pricing display": "Visualización de precios localizada",
    "USD prices are shown by default.": "Los precios en USD se muestran por defecto.",
    "For shoppers testing products before buying.": "Para compradores que prueban productos antes de comprar.",
    "3 product analyses per day": "3 análisis de producto al día",
    "Use Shopper Free": "Usar Comprador gratis",
    Subscription: "Suscripción",
    "For frequent shoppers comparing multiple products.": "Para compradores frecuentes que comparan varios productos.",
    "Unlimited shopper analyses": "Análisis de comprador ilimitados",
    "Product history": "Historial de productos",
    "Upgrade Shopper Premium": "Mejorar a Comprador Premium",
    "For small ecommerce sellers diagnosing reviews.": "Para pequeños vendedores ecommerce que diagnostican reseñas.",
    "Seller trust snapshot": "Instantánea de confianza del vendedor",
    "View Shopper Premium": "Ver Comprador Premium",
    "Upgrade Seller Premium": "Mejorar a Vendedor Premium",
    "For sellers comparing competitors and finding market gaps.": "Para vendedores que comparan competidores y encuentran brechas de mercado.",
    "Product improvement calendar tracker": "Calendario de mejoras del producto",
    "Advanced seller recommendations": "Recomendaciones avanzadas para vendedores",
    "Upgrade Seller Pro": "Mejorar a Vendedor Pro",
    "Need subscription help before checkout?": "¿Necesitas ayuda con la suscripción antes de pagar?",
    "Review refund terms, billing support, and cancellation controls before upgrading.":
      "Revisa condiciones de reembolso, soporte de facturación y controles de cancelación antes de mejorar el plan.",
    "Real customer feedback, approved before publishing.": "Comentarios reales de clientes, aprobados antes de publicarse.",
    "Users can submit feedback here. Reviews do not appear publicly until they are approved from the Admin dashboard.":
      "Los usuarios pueden enviar comentarios aquí. Las reseñas no aparecen públicamente hasta aprobarse desde el panel admin.",
    "No public reviews yet": "Aún no hay reseñas públicas",
    "We do not publish fake testimonials. Approved user reviews will appear here after moderation.":
      "No publicamos testimonios falsos. Las reseñas aprobadas aparecerán aquí después de moderación.",
    "Email optional": "E-mail opcional",
    "Short review": "Reseña breve",
    "Submit Review": "Enviar reseña",
    "Shoppers get a fast read on quality, complaints, praised features, value, and buying risk without reading pages of reviews.":
      "Los compradores ven rápido calidad, quejas, funciones elogiadas, valor y riesgo de compra sin leer páginas de reseñas.",
    "Sellers get product improvement signals, listing fixes, packaging issues, refund-risk themes, and competitor openings.":
      "Los vendedores obtienen señales de mejora, arreglos de ficha, problemas de empaque, temas de riesgo de reembolso y oportunidades frente a competidores.",
    "Advertisers pay, upload a banner or short video, and ReviewIntel verifies payment plus creative quality before any campaign goes live.":
      "Los anunciantes pagan, suben un banner o video corto, y ReviewIntel verifica el pago y la calidad creativa antes de publicar la campaña.",
    "Manual review before publishing": "Revisión manual antes de publicar",
    "Good for early visibility": "Bueno para visibilidad inicial",
    "Best for smaller campaigns": "Ideal para campañas pequeñas",
    "Pay for Sponsored Resource Placement": "Pagar espacio de recurso patrocinado",
    "Best for premium campaigns": "Ideal para campañas premium",
    "Pay for Featured Sponsored Resource": "Pagar recurso patrocinado destacado",
    "We manually review each sponsored resource before publishing. We may reject irrelevant, unsafe, misleading, or low-quality placements and issue a refund when appropriate.":
      "Revisamos manualmente cada recurso patrocinado antes de publicarlo. Podemos rechazar espacios irrelevantes, inseguros, engañosos o de baja calidad y reembolsar cuando corresponda.",
    "Refund policy": "Política de reembolsos",
    "Product comparison": "Comparación de productos",
    "Compare two products by review evidence": "Compara dos productos por evidencia de reseñas",
    "Shopper mode: which product should I buy?": "Modo comprador: ¿qué producto debo comprar?",
    "Built for shoppers. It weighs review quality, complaints, value, durability, shipping, and your buying priorities.":
      "Creado para compradores. Sopesa calidad de reseñas, quejas, valor, durabilidad, envío y prioridades de compra.",
    "Shopper mode": "Modo comprador",
    "Seller mode": "Modo vendedor",
    "What matters most to you?": "¿Qué es lo más importante para ti?",
    "Best reviews": "Mejores reseñas",
    "Daily use": "Uso diario",
    "Business use": "Uso comercial",
    "Product 1": "Producto 1",
    "Product 2": "Producto 2",
    "Create a free account before comparing products.": "Crea una cuenta gratuita antes de comparar productos.",
    "Free users get 3 total AI actions across Analyze and Compare combined. Sign up first so your usage and results stay attached to your account.":
      "Los usuarios gratis tienen 3 acciones de IA en total entre Analizar y Comparar. Regístrate primero para vincular uso y resultados a tu cuenta.",
    "Analyze one product = 1 AI action": "Analizar un producto = 1 acción de IA",
    "Free account total = 3 AI actions": "Total cuenta gratis = 3 acciones de IA"
  }
};

const coreRouteAuditPhraseTranslationsMore: Partial<Record<ReviewIntelLocale, Record<string, string>>> = {
  de: {
    "Public sample results have been removed from the customer experience. Paste reviews or upload a CSV/TXT file to generate a fresh result.":
      "Öffentliche Beispielergebnisse wurden aus der Kundenerfahrung entfernt. Füge Bewertungen ein oder lade eine CSV/TXT-Datei hoch, um ein neues Ergebnis zu erzeugen.",
    "Shopper": "Käufer",
    "Shopper tools stay simple and recommendation-focused.": "Käuferwerkzeuge bleiben einfach und empfehlungsorientiert.",
    "Manage subscription": "Abo verwalten",
    "Your saved product checks, buying verdicts, fake-review warnings, and best finds in one clean view.":
      "Gespeicherte Produktprüfungen, Kaufurteile, Warnungen vor gefälschten Bewertungen und beste Funde in einer klaren Ansicht.",
    "Know what to buy, compare, or avoid.": "Wisse, was du kaufen, vergleichen oder meiden solltest.",
    "This dashboard keeps your scanned products organized so you do not have to reread reviews again before checkout.":
      "Diese Übersicht ordnet geprüfte Produkte, damit du Bewertungen vor dem Bezahlen nicht erneut lesen musst.",
    "Scan a product to start your tally.": "Prüfe ein Produkt, um deine Zählung zu starten.",
    "Products with the strongest buying signal.": "Produkte mit dem stärksten Kaufsignal.",
    "Products that need caution or comparison.": "Produkte, die Vorsicht oder Vergleich brauchen.",
    "Products with avoid signals or suspicious reviews.": "Produkte mit Meidensignalen oder verdächtigen Bewertungen.",
    "No shopper scans saved yet. Scan a product to start your buying history.": "Noch keine Käuferprüfungen gespeichert. Prüfe ein Produkt, um deinen Kaufverlauf zu starten.",
    "Fake-review alerts": "Warnungen vor gefälschten Bewertungen",
    "You get 3 free scans per day.": "Du erhältst 3 kostenlose Prüfungen pro Tag.",
    "Upgrade to Shopper Premium for more scans, deeper fake-review reasoning, and a fuller buying-confidence history.":
      "Wechsle zu Käufer-Premium für mehr Prüfungen, tiefere Begründung zu gefälschten Bewertungen und einen vollständigeren Vertrauensverlauf.",
    "Login required": "Anmeldung erforderlich",
    "Please log in to open the seller dashboard.": "Melde dich an, um die Verkäuferübersicht zu öffnen.",
    "Seller dashboards are tied to a real account so scans, usage, and product history stay separated by user.":
      "Verkäuferübersichten sind mit echten Konten verbunden, damit Prüfungen, Nutzung und Produktverlauf pro Nutzer getrennt bleiben.",
    "Seller tools stay separate from shopper purchase decisions.": "Verkäuferwerkzeuge bleiben von Käuferentscheidungen getrennt.",
    "Your Seller Pro workspace for product health, review signals, and improvement tracking.":
      "Dein Verkäufer-Pro-Arbeitsbereich für Produktzustand, Bewertungssignale und Verbesserungsverfolgung.",
    "Run seller scans to start tracking products.": "Starte Verkäuferprüfungen, um Produkte zu verfolgen.",
    "Normal saved seller scans used for product improvement.": "Normale gespeicherte Verkäuferprüfungen zur Produktverbesserung.",
    "Average score from saved seller product scans.": "Durchschnittswert aus gespeicherten Verkäufer-Produktprüfungen.",
    "No product focus yet.": "Noch kein Produktfokus.",
    "No product selected yet": "Noch kein Produkt ausgewählt",
    "Run seller scans to identify the product that needs the most improvement.": "Starte Verkäuferprüfungen, um das Produkt mit dem größten Verbesserungsbedarf zu finden.",
    "No strong product signal yet": "Noch kein starkes Produktsignal",
    "Your strongest product will appear once seller scans are saved.": "Dein stärkstes Produkt erscheint, sobald Verkäuferprüfungen gespeichert sind.",
    "Compare results guide strategy, but do not affect product health averages.": "Vergleichsergebnisse leiten die Strategie, verändern aber keine Produktzustandsdurchschnitte.",
    "Use compare scans to find positioning opportunities, competitor weaknesses, and product advantages. They should guide strategy but not change normal product health averages.":
      "Nutze Vergleichsprüfungen, um Positionierungschancen, Schwächen der Konkurrenz und Produktvorteile zu finden. Sie sollen Strategie leiten, aber normale Produktdurchschnitte nicht ändern.",
    "All saved seller products, grouped by product name and sorted by improvement priority.":
      "Alle gespeicherten Verkäuferprodukte, nach Produktname gruppiert und nach Verbesserungspriorität sortiert.",
    "See every product you are tracking.": "Sieh jedes Produkt, das du verfolgst.",
    "Use this page when you have many products. The main dashboard stays clean, while this page shows the full product list.":
      "Nutze diese Seite bei vielen Produkten. Die Hauptübersicht bleibt sauber, während diese Seite die vollständige Produktliste zeigt.",
    "Back to Seller Dashboard": "Zurück zur Verkäuferübersicht",
    "Run a seller analysis and attach it to a product. Your products will appear here automatically.":
      "Starte eine Verkäuferanalyse und verknüpfe sie mit einem Produkt. Deine Produkte erscheinen hier automatisch.",
    "Run Seller Scan": "Verkäuferprüfung starten",
    "Localized pricing display": "Lokalisierte Preisanzeige",
    "USD prices are shown by default.": "USD-Preise werden standardmäßig angezeigt.",
    "Shopper Free": "Käufer kostenlos",
    "For shoppers testing products before buying.": "Für Käufer, die Produkte vor dem Kauf prüfen.",
    "3 product analyses per day": "3 Produktanalysen pro Tag",
    "Use Shopper Free": "Käufer kostenlos nutzen",
    Subscription: "Abo",
    "Shopper Premium": "Käufer-Premium",
    "For frequent shoppers comparing multiple products.": "Für häufige Käufer, die mehrere Produkte vergleichen.",
    "Unlimited shopper analyses": "Unbegrenzte Käuferanalysen",
    "Product history": "Produktverlauf",
    "Upgrade Shopper Premium": "Käufer-Premium aktivieren",
    "For small ecommerce sellers diagnosing reviews.": "Für kleine E-Commerce-Verkäufer, die Bewertungen auswerten.",
    "Seller trust snapshot": "Vertrauensmomentaufnahme für Verkäufer",
    "View Shopper Premium": "Käufer-Premium ansehen",
    "Upgrade Seller Premium": "Verkäufer-Premium aktivieren",
    "For sellers comparing competitors and finding market gaps.": "Für Verkäufer, die Wettbewerber vergleichen und Marktlücken finden.",
    "Product improvement calendar tracker": "Kalender zur Produktverbesserung",
    "Advanced seller recommendations": "Erweiterte Verkäuferempfehlungen",
    "Upgrade Seller Pro": "Verkäufer-Pro aktivieren",
    "Need subscription help before checkout?": "Brauchst du Abo-Hilfe vor dem Bezahlen?",
    "Review refund terms, billing support, and cancellation controls before upgrading.":
      "Prüfe Rückerstattungsbedingungen, Abrechnungshilfe und Kündigungsoptionen vor dem Upgrade.",
    "Real customer feedback, approved before publishing.": "Echtes Kundenfeedback, vor Veröffentlichung genehmigt.",
    "Users can submit feedback here. Reviews do not appear publicly until they are approved from the Admin dashboard.":
      "Nutzer können hier Feedback senden. Bewertungen erscheinen erst öffentlich, wenn sie in der Admin-Übersicht genehmigt wurden.",
    "No public reviews yet": "Noch keine öffentlichen Bewertungen",
    "We do not publish fake testimonials. Approved user reviews will appear here after moderation.":
      "Wir veröffentlichen keine gefälschten Stimmen. Genehmigte Nutzerbewertungen erscheinen nach der Moderation.",
    "Email optional": "E-Mail optional",
    "Short review": "Kurze Bewertung",
    "Submit Review": "Bewertung senden",
    "Shoppers get a fast read on quality, complaints, praised features, value, and buying risk without reading pages of reviews.":
      "Käufer erhalten schnell Einblick in Qualität, Beschwerden, gelobte Merkmale, Wert und Kaufrisiko, ohne Seiten voller Bewertungen zu lesen.",
    "Sellers get product improvement signals, listing fixes, packaging issues, refund-risk themes, and competitor openings.":
      "Verkäufer erhalten Verbesserungssignale, Listing-Korrekturen, Verpackungsprobleme, Rückerstattungsrisiken und Chancen gegenüber Wettbewerbern.",
    "Advertisers pay, upload a banner or short video, and ReviewIntel verifies payment plus creative quality before any campaign goes live.":
      "Werbetreibende zahlen, laden ein Banner oder Kurzvideo hoch, und ReviewIntel prüft Zahlung sowie Kreativqualität vor der Veröffentlichung.",
    "Manual review before publishing": "Manuelle Prüfung vor Veröffentlichung",
    "Good for early visibility": "Gut für frühe Sichtbarkeit",
    "Best for smaller campaigns": "Am besten für kleinere Kampagnen",
    "Pay for Sponsored Resource Placement": "Gesponserte Ressourcenplatzierung bezahlen",
    "Best for premium campaigns": "Am besten für Premium-Kampagnen",
    "Pay for Featured Sponsored Resource": "Hervorgehobene gesponserte Ressource bezahlen",
    "We manually review each sponsored resource before publishing. We may reject irrelevant, unsafe, misleading, or low-quality placements and issue a refund when appropriate.":
      "Wir prüfen jede gesponserte Ressource vor Veröffentlichung manuell. Irrelevante, unsichere, irreführende oder schwache Platzierungen können abgelehnt und gegebenenfalls erstattet werden.",
    "Refund policy": "Rückerstattungsrichtlinie",
    "Product comparison": "Produktvergleich",
    "Compare two products by review evidence": "Zwei Produkte anhand von Bewertungsbelegen vergleichen",
    "Create a free account before comparing products.": "Erstelle ein kostenloses Konto, bevor du Produkte vergleichst.",
    "Free users get 3 total AI actions across Analyze and Compare combined. Sign up first so your usage and results stay attached to your account.":
      "Kostenlose Nutzer erhalten insgesamt 3 KI-Aktionen für Analyse und Vergleich zusammen. Melde dich zuerst an, damit Nutzung und Ergebnisse mit deinem Konto verbunden bleiben.",
    "Analyze one product = 1 AI action": "Ein Produkt analysieren = 1 KI-Aktion",
    "Free account total = 3 AI actions": "Kostenloses Konto gesamt = 3 KI-Aktionen",
    "Shopper mode: which product should I buy?": "Käufermodus: Welches Produkt soll ich kaufen?",
    "Built for shoppers. It weighs review quality, complaints, value, durability, shipping, and your buying priorities.":
      "Für Käufer gebaut. Es gewichtet Bewertungsqualität, Beschwerden, Wert, Haltbarkeit, Versand und deine Kaufprioritäten.",
    "Shopper mode": "Käufermodus",
    "Seller mode": "Verkäufermodus",
    "What matters most to you?": "Was ist dir am wichtigsten?",
    "Best reviews": "Beste Bewertungen",
    "Daily use": "Tägliche Nutzung",
    "Business use": "Geschäftliche Nutzung",
    "Product 1": "Produkt 1",
    "Product 2": "Produkt 2"
  },
  zh: {
    "Public sample results have been removed from the customer experience. Paste reviews or upload a CSV/TXT file to generate a fresh result.":
      "公开示例结果已从客户体验中移除。请粘贴评价或上传 CSV/TXT 文件生成新结果。",
    "Shopper tools stay simple and recommendation-focused.": "购物者工具保持简单，并专注于推荐。",
    "Manage subscription": "管理订阅",
    "Your saved product checks, buying verdicts, fake-review warnings, and best finds in one clean view.":
      "你保存的产品检查、购买结论、虚假评价警告和最佳发现集中在清晰视图中。",
    "Know what to buy, compare, or avoid.": "知道该买、该比较或该避开什么。",
    "This dashboard keeps your scanned products organized so you do not have to reread reviews again before checkout.":
      "此仪表板整理已扫描产品，让你结账前无需重新阅读评价。",
    "Scan a product to start your tally.": "扫描一个产品来开始统计。",
    "Products with the strongest buying signal.": "购买信号最强的产品。",
    "Products that need caution or comparison.": "需要谨慎或比较的产品。",
    "Products with avoid signals or suspicious reviews.": "带有避开信号或可疑评价的产品。",
    "No shopper scans saved yet. Scan a product to start your buying history.": "尚无购物者扫描记录。扫描产品以开始购买历史。",
    "Fake-review alerts": "虚假评价提醒",
    "You get 3 free scans per day.": "你每天有 3 次免费扫描。",
    "Upgrade to Shopper Premium for more scans, deeper fake-review reasoning, and a fuller buying-confidence history.":
      "升级到购物者 Premium，获得更多扫描、更深入的虚假评价推理和更完整的购买信心历史。",
    "Login required": "需要登录",
    "Please log in to open the seller dashboard.": "请登录以打开卖家仪表板。",
    "Seller dashboards are tied to a real account so scans, usage, and product history stay separated by user.":
      "卖家仪表板绑定真实账户，让扫描、用量和产品历史按用户分开。",
    "Seller tools stay separate from shopper purchase decisions.": "卖家工具与购物者购买决策保持分离。",
    "Your Seller Pro workspace for product health, review signals, and improvement tracking.":
      "你的卖家 Pro 工作区，用于产品健康、评价信号和改进追踪。",
    "Run seller scans to start tracking products.": "运行卖家扫描以开始追踪产品。",
    "Normal saved seller scans used for product improvement.": "用于产品改进的普通已保存卖家扫描。",
    "Average score from saved seller product scans.": "已保存卖家产品扫描的平均分。",
    "No product focus yet.": "尚无重点产品。",
    "No product selected yet": "尚未选择产品",
    "Run seller scans to identify the product that needs the most improvement.": "运行卖家扫描，找出最需要改进的产品。",
    "No strong product signal yet": "尚无强产品信号",
    "Your strongest product will appear once seller scans are saved.": "保存卖家扫描后，你最强的产品会显示在这里。",
    "Compare results guide strategy, but do not affect product health averages.": "比较结果指导策略，但不影响产品健康平均值。",
    "Use compare scans to find positioning opportunities, competitor weaknesses, and product advantages. They should guide strategy but not change normal product health averages.":
      "使用比较扫描发现定位机会、竞品弱点和产品优势。它们应指导策略，但不改变正常产品健康平均值。",
    "All saved seller products, grouped by product name and sorted by improvement priority.":
      "所有已保存卖家产品，按产品名称分组并按改进优先级排序。",
    "See every product you are tracking.": "查看你正在追踪的每个产品。",
    "Use this page when you have many products. The main dashboard stays clean, while this page shows the full product list.":
      "产品较多时使用此页面。主仪表板保持简洁，此页显示完整产品列表。",
    "Back to Seller Dashboard": "返回卖家仪表板",
    "Run a seller analysis and attach it to a product. Your products will appear here automatically.":
      "运行卖家分析并关联到产品。你的产品会自动出现在这里。",
    "Run Seller Scan": "运行卖家扫描",
    "Localized pricing display": "本地化价格显示",
    "USD prices are shown by default.": "默认显示美元价格。",
    "For shoppers testing products before buying.": "适合购买前测试产品的购物者。",
    "3 product analyses per day": "每天 3 次产品分析",
    "Use Shopper Free": "使用免费购物者",
    Subscription: "订阅",
    "For frequent shoppers comparing multiple products.": "适合经常比较多个产品的购物者。",
    "Unlimited shopper analyses": "不限量购物者分析",
    "Product history": "产品历史",
    "Upgrade Shopper Premium": "升级购物者 Premium",
    "For small ecommerce sellers diagnosing reviews.": "适合诊断评价的小型电商卖家。",
    "Seller trust snapshot": "卖家信任快照",
    "View Shopper Premium": "查看购物者 Premium",
    "Upgrade Seller Premium": "升级卖家 Premium",
    "For sellers comparing competitors and finding market gaps.": "适合比较竞争对手并寻找市场空白的卖家。",
    "Product improvement calendar tracker": "产品改进日历追踪",
    "Advanced seller recommendations": "高级卖家建议",
    "Upgrade Seller Pro": "升级卖家 Pro",
    "Need subscription help before checkout?": "结账前需要订阅帮助吗？",
    "Review refund terms, billing support, and cancellation controls before upgrading.":
      "升级前请查看退款条款、账单支持和取消控制。",
    "Real customer feedback, approved before publishing.": "真实客户反馈，发布前审核。",
    "Users can submit feedback here. Reviews do not appear publicly until they are approved from the Admin dashboard.":
      "用户可在这里提交反馈。评价需在管理员仪表板审核后才会公开显示。",
    "No public reviews yet": "暂无公开评价",
    "We do not publish fake testimonials. Approved user reviews will appear here after moderation.":
      "我们不发布虚假推荐。审核通过的用户评价会在 moderation 后显示。",
    "Email optional": "邮箱可选",
    "Short review": "简短评价",
    "Submit Review": "提交评价",
    "Shoppers get a fast read on quality, complaints, praised features, value, and buying risk without reading pages of reviews.":
      "购物者无需阅读大量评价，即可快速了解质量、投诉、好评点、价值和购买风险。",
    "Sellers get product improvement signals, listing fixes, packaging issues, refund-risk themes, and competitor openings.":
      "卖家获得产品改进信号、商品页修复、包装问题、退款风险主题和竞争机会。",
    "Advertisers pay, upload a banner or short video, and ReviewIntel verifies payment plus creative quality before any campaign goes live.":
      "广告主付款并上传横幅或短视频，ReviewIntel 会先验证付款和素材质量，然后广告才会上线。",
    "Manual review before publishing": "发布前人工审核",
    "Good for early visibility": "适合早期曝光",
    "Best for smaller campaigns": "最适合小型活动",
    "Pay for Sponsored Resource Placement": "支付赞助资源展示",
    "Best for premium campaigns": "最适合高级活动",
    "Pay for Featured Sponsored Resource": "支付精选赞助资源",
    "We manually review each sponsored resource before publishing. We may reject irrelevant, unsafe, misleading, or low-quality placements and issue a refund when appropriate.":
      "每个赞助资源发布前都会人工审核。我们可能拒绝不相关、不安全、误导性或低质量展示，并在适当时退款。",
    "Refund policy": "退款政策",
    "Product comparison": "产品比较",
    "Compare two products by review evidence": "根据评价证据比较两个产品",
    "Create a free account before comparing products.": "比较产品前请创建免费账户。",
    "Free users get 3 total AI actions across Analyze and Compare combined. Sign up first so your usage and results stay attached to your account.":
      "免费用户在分析和比较中总共有 3 次 AI 操作。请先注册，让用量和结果绑定到账户。",
    "Analyze one product = 1 AI action": "分析一个产品 = 1 次 AI 操作",
    "Free account total = 3 AI actions": "免费账户总计 = 3 次 AI 操作",
    "Shopper mode: which product should I buy?": "购物者模式：我该买哪个产品？",
    "Built for shoppers. It weighs review quality, complaints, value, durability, shipping, and your buying priorities.":
      "为购物者设计。它衡量评价质量、投诉、价值、耐用性、配送和你的购买优先级。",
    "Shopper mode": "购物者模式",
    "Seller mode": "卖家模式",
    "What matters most to you?": "你最看重什么？",
    "Best reviews": "最佳评价",
    "Daily use": "日常使用",
    "Business use": "商业使用",
    "Product 1": "产品 1",
    "Product 2": "产品 2"
  },
  hi: {
    "Public sample results have been removed from the customer experience. Paste reviews or upload a CSV/TXT file to generate a fresh result.":
      "सार्वजनिक नमूना परिणाम ग्राहक अनुभव से हटा दिए गए हैं। नया परिणाम बनाने के लिए समीक्षाएँ पेस्ट करें या CSV/TXT फ़ाइल अपलोड करें।",
    "Shopper tools stay simple and recommendation-focused.": "शॉपर टूल सरल और सुझाव-केंद्रित रहते हैं।",
    "Manage subscription": "सदस्यता प्रबंधित करें",
    "Your saved product checks, buying verdicts, fake-review warnings, and best finds in one clean view.":
      "आपकी सहेजी उत्पाद जाँच, खरीद निर्णय, नकली समीक्षा चेतावनी और अच्छे उत्पाद एक साफ दृश्य में।",
    "Know what to buy, compare, or avoid.": "जानें क्या खरीदना, तुलना करना या बचना है।",
    "This dashboard keeps your scanned products organized so you do not have to reread reviews again before checkout.":
      "यह डैशबोर्ड स्कैन किए उत्पादों को व्यवस्थित रखता है ताकि checkout से पहले समीक्षाएँ फिर न पढ़नी पड़ें।",
    "Scan a product to start your tally.": "गिनती शुरू करने के लिए उत्पाद स्कैन करें।",
    "Products with the strongest buying signal.": "सबसे मजबूत खरीद संकेत वाले उत्पाद।",
    "Products that need caution or comparison.": "जिन उत्पादों में सावधानी या तुलना चाहिए।",
    "Products with avoid signals or suspicious reviews.": "बचने के संकेत या संदिग्ध समीक्षाओं वाले उत्पाद।",
    "No shopper scans saved yet. Scan a product to start your buying history.": "अभी कोई शॉपर स्कैन सहेजा नहीं गया। खरीद इतिहास शुरू करने के लिए उत्पाद स्कैन करें।",
    "Fake-review alerts": "नकली समीक्षा चेतावनी",
    "You get 3 free scans per day.": "आपको हर दिन 3 मुफ्त स्कैन मिलते हैं।",
    "Upgrade to Shopper Premium for more scans, deeper fake-review reasoning, and a fuller buying-confidence history.":
      "अधिक स्कैन, गहरा नकली समीक्षा तर्क और बेहतर खरीद भरोसा इतिहास के लिए शॉपर Premium अपग्रेड करें।",
    "Login required": "लॉगिन आवश्यक",
    "Please log in to open the seller dashboard.": "विक्रेता डैशबोर्ड खोलने के लिए लॉगिन करें।",
    "Seller dashboards are tied to a real account so scans, usage, and product history stay separated by user.":
      "विक्रेता डैशबोर्ड वास्तविक खाते से जुड़े हैं ताकि स्कैन, उपयोग और उत्पाद इतिहास उपयोगकर्ता के अनुसार अलग रहें।",
    "Seller tools stay separate from shopper purchase decisions.": "विक्रेता टूल शॉपर खरीद निर्णयों से अलग रहते हैं।",
    "Your Seller Pro workspace for product health, review signals, and improvement tracking.":
      "उत्पाद स्वास्थ्य, समीक्षा संकेत और सुधार ट्रैकिंग के लिए आपका विक्रेता Pro कार्यक्षेत्र।",
    "Run seller scans to start tracking products.": "उत्पाद ट्रैकिंग शुरू करने के लिए विक्रेता स्कैन चलाएँ।",
    "Normal saved seller scans used for product improvement.": "उत्पाद सुधार के लिए सामान्य सहेजे विक्रेता स्कैन।",
    "Average score from saved seller product scans.": "सहेजे विक्रेता उत्पाद स्कैन से औसत स्कोर।",
    "No product focus yet.": "अभी कोई उत्पाद फोकस नहीं।",
    "No product selected yet": "अभी कोई उत्पाद चयनित नहीं",
    "Run seller scans to identify the product that needs the most improvement.": "सबसे अधिक सुधार वाले उत्पाद को पहचानने के लिए विक्रेता स्कैन चलाएँ।",
    "No strong product signal yet": "अभी कोई मजबूत उत्पाद संकेत नहीं",
    "Your strongest product will appear once seller scans are saved.": "विक्रेता स्कैन सहेजे जाने पर आपका सबसे मजबूत उत्पाद दिखेगा।",
    "Compare results guide strategy, but do not affect product health averages.": "तुलना परिणाम रणनीति बताते हैं, पर उत्पाद स्वास्थ्य औसत नहीं बदलते।",
    "Use compare scans to find positioning opportunities, competitor weaknesses, and product advantages. They should guide strategy but not change normal product health averages.":
      "स्थिति अवसर, competitor कमजोरियाँ और उत्पाद लाभ खोजने के लिए तुलना स्कैन उपयोग करें। वे रणनीति बताएँ, सामान्य उत्पाद स्वास्थ्य औसत न बदलें।",
    "All saved seller products, grouped by product name and sorted by improvement priority.":
      "सभी सहेजे विक्रेता उत्पाद, उत्पाद नाम से समूहित और सुधार प्राथमिकता से क्रमबद्ध।",
    "See every product you are tracking.": "आप जिन उत्पादों को ट्रैक कर रहे हैं, वे सभी देखें।",
    "Use this page when you have many products. The main dashboard stays clean, while this page shows the full product list.":
      "कई उत्पाद होने पर यह पेज उपयोग करें। मुख्य डैशबोर्ड साफ रहता है और यह पेज पूरी सूची दिखाता है।",
    "Back to Seller Dashboard": "विक्रेता डैशबोर्ड पर वापस",
    "Run a seller analysis and attach it to a product. Your products will appear here automatically.":
      "विक्रेता विश्लेषण चलाएँ और उत्पाद से जोड़ें। आपके उत्पाद यहाँ अपने-आप दिखेंगे।",
    "Run Seller Scan": "विक्रेता स्कैन चलाएँ",
    "Localized pricing display": "स्थानीय मूल्य प्रदर्शन",
    "USD prices are shown by default.": "USD कीमतें डिफ़ॉल्ट रूप से दिखती हैं।",
    "For shoppers testing products before buying.": "खरीदने से पहले उत्पाद जाँचने वाले शॉपर के लिए।",
    "3 product analyses per day": "हर दिन 3 उत्पाद विश्लेषण",
    "Use Shopper Free": "शॉपर Free उपयोग करें",
    Subscription: "सदस्यता",
    "For frequent shoppers comparing multiple products.": "कई उत्पादों की तुलना करने वाले नियमित शॉपर के लिए।",
    "Unlimited shopper analyses": "असीमित शॉपर विश्लेषण",
    "Product history": "उत्पाद इतिहास",
    "Upgrade Shopper Premium": "शॉपर Premium अपग्रेड करें",
    "For small ecommerce sellers diagnosing reviews.": "समीक्षाएँ समझने वाले छोटे ecommerce विक्रेताओं के लिए।",
    "Seller trust snapshot": "विक्रेता भरोसा स्नैपशॉट",
    "View Shopper Premium": "शॉपर Premium देखें",
    "Upgrade Seller Premium": "विक्रेता Premium अपग्रेड करें",
    "For sellers comparing competitors and finding market gaps.": "प्रतिस्पर्धियों की तुलना और बाजार अंतर खोजने वाले विक्रेताओं के लिए।",
    "Product improvement calendar tracker": "उत्पाद सुधार कैलेंडर ट्रैकर",
    "Advanced seller recommendations": "उन्नत विक्रेता सुझाव",
    "Upgrade Seller Pro": "विक्रेता Pro अपग्रेड करें",
    "Need subscription help before checkout?": "भुगतान से पहले सदस्यता सहायता चाहिए?",
    "Review refund terms, billing support, and cancellation controls before upgrading.":
      "अपग्रेड से पहले रिफंड शर्तें, बिलिंग सहायता और रद्दीकरण नियंत्रण देखें।",
    "Real customer feedback, approved before publishing.": "प्रकाशन से पहले स्वीकृत वास्तविक ग्राहक प्रतिक्रिया।",
    "Users can submit feedback here. Reviews do not appear publicly until they are approved from the Admin dashboard.":
      "उपयोगकर्ता यहाँ प्रतिक्रिया भेज सकते हैं। समीक्षाएँ Admin डैशबोर्ड से स्वीकृत होने तक सार्वजनिक नहीं दिखतीं।",
    "No public reviews yet": "अभी कोई सार्वजनिक समीक्षा नहीं",
    "We do not publish fake testimonials. Approved user reviews will appear here after moderation.":
      "हम नकली प्रशंसापत्र प्रकाशित नहीं करते। स्वीकृत उपयोगकर्ता समीक्षाएँ moderation के बाद यहाँ दिखेंगी।",
    "Email optional": "ईमेल वैकल्पिक",
    "Short review": "छोटी समीक्षा",
    "Submit Review": "समीक्षा भेजें",
    "Shoppers get a fast read on quality, complaints, praised features, value, and buying risk without reading pages of reviews.":
      "शॉपर कई पेज समीक्षाएँ पढ़े बिना गुणवत्ता, शिकायतें, पसंदीदा फीचर, मूल्य और खरीद जोखिम जल्दी समझते हैं।",
    "Sellers get product improvement signals, listing fixes, packaging issues, refund-risk themes, and competitor openings.":
      "विक्रेताओं को उत्पाद सुधार संकेत, सूची सुधार, पैकेजिंग समस्याएँ, रिफंड जोखिम विषय और प्रतिस्पर्धी अवसर मिलते हैं।",
    "Advertisers pay, upload a banner or short video, and ReviewIntel verifies payment plus creative quality before any campaign goes live.":
      "विज्ञापनदाता भुगतान करते हैं, banner या short video अपलोड करते हैं, और campaign live होने से पहले ReviewIntel भुगतान और creative quality सत्यापित करता है।",
    "Manual review before publishing": "प्रकाशन से पहले मैन्युअल समीक्षा",
    "Good for early visibility": "शुरुआती दृश्यता के लिए अच्छा",
    "Best for smaller campaigns": "छोटी campaigns के लिए बेहतर",
    "Pay for Sponsored Resource Placement": "Sponsored Resource Placement के लिए भुगतान करें",
    "Best for premium campaigns": "Premium campaigns के लिए बेहतर",
    "Pay for Featured Sponsored Resource": "Featured Sponsored Resource के लिए भुगतान करें",
    "We manually review each sponsored resource before publishing. We may reject irrelevant, unsafe, misleading, or low-quality placements and issue a refund when appropriate.":
      "हम हर प्रायोजित संसाधन को प्रकाशन से पहले मैन्युअल रूप से देखते हैं। अप्रासंगिक, असुरक्षित, भ्रामक या कम गुणवत्ता स्थान अस्वीकार कर उचित होने पर रिफंड दे सकते हैं।",
    "Refund policy": "रिफंड नीति",
    "Product comparison": "उत्पाद तुलना",
    "Compare two products by review evidence": "समीक्षा प्रमाण से दो उत्पादों की तुलना करें",
    "Create a free account before comparing products.": "उत्पाद तुलना से पहले मुफ्त खाता बनाएँ।",
    "Free users get 3 total AI actions across Analyze and Compare combined. Sign up first so your usage and results stay attached to your account.":
      "मुफ्त उपयोगकर्ताओं को Analyze और Compare मिलाकर कुल 3 AI actions मिलते हैं। पहले sign up करें ताकि उपयोग और परिणाम खाते से जुड़े रहें।",
    "Analyze one product = 1 AI action": "एक उत्पाद विश्लेषण = 1 AI action",
    "Free account total = 3 AI actions": "मुफ्त खाते का कुल = 3 AI actions",
    "Shopper mode: which product should I buy?": "शॉपर मोड: कौन सा उत्पाद खरीदूँ?",
    "Built for shoppers. It weighs review quality, complaints, value, durability, shipping, and your buying priorities.":
      "शॉपर के लिए बनाया गया। यह समीक्षा गुणवत्ता, शिकायतें, मूल्य, टिकाऊपन, shipping और खरीद प्राथमिकताएँ तौलता है।",
    "Shopper mode": "शॉपर मोड",
    "Seller mode": "विक्रेता मोड",
    "What matters most to you?": "आपके लिए सबसे महत्वपूर्ण क्या है?",
    "Best reviews": "सर्वश्रेष्ठ समीक्षाएँ",
    "Daily use": "दैनिक उपयोग",
    "Business use": "व्यावसायिक उपयोग",
    "Product 1": "उत्पाद 1",
    "Product 2": "उत्पाद 2"
  }
};

export function normalizeLocale(value: unknown): ReviewIntelLocale {
  const raw = String(value ?? "").trim().toLowerCase();
  const short = raw.split("-")[0];

  return SUPPORTED_LOCALES.some((item) => item.code === short)
    ? (short as ReviewIntelLocale)
    : DEFAULT_LOCALE;
}

export function getDictionary(locale: string | undefined): Dictionary {
  return dictionaries[normalizeLocale(locale)];
}

export function localeLabel(locale: string | undefined) {
  const safeLocale = normalizeLocale(locale);
  return SUPPORTED_LOCALES.find((item) => item.code === safeLocale)?.label ?? "English";
}

export function localeCodeForIntl(locale: string | undefined) {
  const safeLocale = normalizeLocale(locale);
  if (safeLocale === "zh") return "zh-CN";
  if (safeLocale === "hi") return "hi-IN";
  return safeLocale;
}

export function formatLocaleNumber(locale: string | undefined, value: number, options?: Intl.NumberFormatOptions) {
  return new Intl.NumberFormat(localeCodeForIntl(locale), options).format(value);
}

export function formatLocalePercent(locale: string | undefined, value: number) {
  return new Intl.NumberFormat(localeCodeForIntl(locale), {
    maximumFractionDigits: value % 1 === 0 ? 0 : 1
  }).format(value) + "%";
}

export function formatLocaleCurrency(locale: string | undefined, value: number, currency = "USD") {
  return new Intl.NumberFormat(localeCodeForIntl(locale), {
    style: "currency",
    currency,
    maximumFractionDigits: 2
  }).format(value);
}

function readCookie(name: string) {
  if (typeof document === "undefined") return "";
  return document.cookie
    .split("; ")
    .find((entry) => entry.startsWith(`${name}=`))
    ?.split("=")[1] ?? "";
}

export function readStoredLocale(): ReviewIntelLocale {
  if (typeof window === "undefined") return DEFAULT_LOCALE;
  return normalizeLocale(
    decodeURIComponent(readCookie(LOCALE_COOKIE_NAME) || "") ||
      window.localStorage.getItem(LOCALE_STORAGE_KEY) ||
      DEFAULT_LOCALE
  );
}

export function persistLocale(locale: ReviewIntelLocale) {
  if (typeof document !== "undefined") {
    document.documentElement.lang = locale;
    document.documentElement.dir = "ltr";
    document.cookie = `${LOCALE_COOKIE_NAME}=${encodeURIComponent(locale)}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
  }

  if (typeof window !== "undefined") {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  }
}

type NonDefaultLocale = Exclude<ReviewIntelLocale, "en">;
type WorkflowPhraseEntry = readonly [string, Record<NonDefaultLocale, string>];

const workflowPhraseTranslationEntries: WorkflowPhraseEntry[] = [
  [
    "Apply for ads",
    {
      fr: "Postuler pour une publicité",
      es: "Solicitar anuncios",
      zh: "申请广告",
      de: "Anzeigen beantragen",
      hi: "Ads के लिए apply करें"
    }
  ],
  [
    "Learn more",
    {
      fr: "En savoir plus",
      es: "Más información",
      zh: "了解更多",
      de: "Mehr erfahren",
      hi: "और जानें"
    }
  ],
  [
    "ReviewIntel ad spot",
    {
      fr: "Emplacement publicitaire ReviewIntel",
      es: "Espacio publicitario de ReviewIntel",
      zh: "ReviewIntel 广告位",
      de: "ReviewIntel-Anzeigenplatz",
      hi: "ReviewIntel ad spot"
    }
  ],
  [
    "Try ReviewIntel or advertise here",
    {
      fr: "Essayez ReviewIntel ou annoncez ici",
      es: "Prueba ReviewIntel o anúnciate aquí",
      zh: "试用 ReviewIntel 或在这里投放广告",
      de: "Teste ReviewIntel oder wirb hier",
      hi: "ReviewIntel आज़माएँ या यहाँ advertise करें"
    }
  ],
  [
    "No paid campaign is live in this slot yet. Apply for ads to place your banner or video in this exact space.",
    {
      fr: "Aucune campagne payée n’est active dans cet emplacement. Postulez pour placer votre bannière ou vidéo ici.",
      es: "Aún no hay una campaña pagada activa en este espacio. Solicita anuncios para colocar aquí tu banner o video.",
      zh: "此广告位还没有正在投放的付费广告。申请广告即可把你的横幅或视频放在这里。",
      de: "In diesem Platz ist noch keine bezahlte Kampagne live. Beantrage Anzeigen, um dein Banner oder Video genau hier zu platzieren.",
      hi: "इस slot में अभी कोई paid campaign live नहीं है। इसी जगह अपना banner या video लगाने के लिए ads apply करें।"
    }
  ],
  [
    "Advertise beside AI product scans",
    {
      fr: "Annoncez à côté des analyses produit IA",
      es: "Anúnciate junto a análisis de productos con IA",
      zh: "在 AI 产品扫描旁投放广告",
      de: "Wirb neben KI-Produktscans",
      hi: "AI product scans के पास advertise करें"
    }
  ],
  [
    "This ReviewIntel banner holds the slot until an approved paid campaign is ready. Apply to run your ad here.",
    {
      fr: "Cette bannière ReviewIntel occupe l’emplacement jusqu’à ce qu’une campagne payée approuvée soit prête. Postulez pour diffuser votre publicité ici.",
      es: "Este banner de ReviewIntel ocupa el espacio hasta que haya una campaña pagada aprobada. Solicita publicar tu anuncio aquí.",
      zh: "在获批的付费广告准备好之前，此 ReviewIntel 横幅会占位。申请即可在这里投放广告。",
      de: "Dieses ReviewIntel-Banner hält den Platz, bis eine genehmigte bezahlte Kampagne bereit ist. Beantrage deine Anzeige hier.",
      hi: "Approved paid campaign ready होने तक यह ReviewIntel banner slot संभालता है। यहाँ अपना ad चलाने के लिए apply करें।"
    }
  ],
  [
    "Premium ad space is available",
    {
      fr: "Un emplacement publicitaire premium est disponible",
      es: "Hay espacio publicitario premium disponible",
      zh: "高级广告位可用",
      de: "Premium-Anzeigenplatz ist verfügbar",
      hi: "Premium ad space उपलब्ध है"
    }
  ],
  [
    "Paid and approved campaigns rotate into this slot automatically. Apply with a banner or short video.",
    {
      fr: "Les campagnes payées et approuvées tournent automatiquement dans cet emplacement. Postulez avec une bannière ou une courte vidéo.",
      es: "Las campañas pagadas y aprobadas rotan automáticamente en este espacio. Solicita con un banner o video corto.",
      zh: "已付款并获批的广告会自动轮播到此位置。请用横幅或短视频申请。",
      de: "Bezahlte und genehmigte Kampagnen rotieren automatisch in diesen Platz. Bewirb dich mit Banner oder Kurzvideo.",
      hi: "Paid और approved campaigns इस slot में अपने आप rotate होते हैं। Banner या short video के साथ apply करें।"
    }
  ],
  [
    "Reach buyers at decision time",
    {
      fr: "Touchez les acheteurs au moment de décision",
      es: "Llega a compradores en el momento de decisión",
      zh: "在买家决策时触达他们",
      de: "Erreiche Käufer im Entscheidungs Moment",
      hi: "Decision time पर buyers तक पहुँचें"
    }
  ],
  [
    "Promote your product, store, or service while shoppers check reviews, complaints, and buying confidence.",
    {
      fr: "Promouvez votre produit, boutique ou service pendant que les acheteurs vérifient avis, plaintes et confiance d’achat.",
      es: "Promociona tu producto, tienda o servicio mientras los compradores revisan reseñas, quejas y confianza de compra.",
      zh: "在购物者查看评论、投诉和购买信心时推广你的产品、店铺或服务。",
      de: "Bewirb Produkt, Shop oder Service, während Käufer Bewertungen, Beschwerden und Kaufvertrauen prüfen.",
      hi: "जब shoppers reviews, complaints और buying confidence देखते हैं, तब अपना product, store, या service promote करें।"
    }
  ],
  [
    "When no paid advertiser is active, ReviewIntel shows this banner. Approved campaigns replace it in the same slot.",
    {
      fr: "Quand aucun annonceur payé n’est actif, ReviewIntel affiche cette bannière. Les campagnes approuvées la remplacent dans le même emplacement.",
      es: "Cuando no hay anunciante pagado activo, ReviewIntel muestra este banner. Las campañas aprobadas lo reemplazan en el mismo espacio.",
      zh: "没有活跃付费广告主时，ReviewIntel 会显示此横幅。获批广告会在同一位置替换它。",
      de: "Wenn kein bezahlter Werbetreibender aktiv ist, zeigt ReviewIntel dieses Banner. Genehmigte Kampagnen ersetzen es im selben Platz.",
      hi: "जब कोई paid advertiser active नहीं होता, ReviewIntel यह banner दिखाता है। Approved campaigns इसी slot में इसे replace करते हैं।"
    }
  ],
  [
    "Apply for ReviewIntel ads",
    {
      fr: "Postuler pour les publicités ReviewIntel",
      es: "Solicitar anuncios en ReviewIntel",
      zh: "申请 ReviewIntel 广告",
      de: "ReviewIntel-Anzeigen beantragen",
      hi: "ReviewIntel ads के लिए apply करें"
    }
  ],
  [
    "Pay for a package, upload your creative, and ReviewIntel will review it before your campaign goes live.",
    {
      fr: "Payez un forfait, téléversez votre création, et ReviewIntel l’examinera avant la mise en ligne de votre campagne.",
      es: "Paga un paquete, sube tu creatividad y ReviewIntel la revisará antes de que tu campaña se publique.",
      zh: "购买套餐并上传素材，ReviewIntel 会在广告活动上线前进行审核。",
      de: "Bezahle ein Paket, lade dein Creative hoch, und ReviewIntel prüft es vor der Live-Schaltung.",
      hi: "Package pay करें, creative upload करें, और campaign live होने से पहले ReviewIntel उसे review करेगा।"
    }
  ],
  [
    "Sponsored placement",
    {
      fr: "Emplacement sponsorisé",
      es: "Ubicación patrocinada",
      zh: "赞助广告位",
      de: "Gesponserte Platzierung",
      hi: "Sponsored placement"
    }
  ],
  [
    "Run clean sponsored campaigns inside ReviewIntel.",
    {
      fr: "Diffusez des campagnes sponsorisées claires dans ReviewIntel.",
      es: "Publica campañas patrocinadas limpias dentro de ReviewIntel.",
      zh: "在 ReviewIntel 内投放清晰的赞助广告活动。",
      de: "Schalte saubere gesponserte Kampagnen in ReviewIntel.",
      hi: "ReviewIntel में साफ sponsored campaigns चलाएँ।"
    }
  ],
  [
    "Advertisers pay for a package, upload a banner or short muted video, and submit the campaign for approval.",
    {
      fr: "Les annonceurs paient un forfait, téléversent une bannière ou une courte vidéo muette, puis soumettent la campagne à validation.",
      es: "Los anunciantes pagan un paquete, suben un banner o video corto silenciado y envían la campaña para aprobación.",
      zh: "广告主购买套餐，上传横幅或短静音视频，然后提交广告活动审核。",
      de: "Werbetreibende zahlen ein Paket, laden ein Banner oder kurzes stummes Video hoch und reichen die Kampagne zur Freigabe ein.",
      hi: "विज्ञापनदाता package का भुगतान करते हैं, banner या short muted video अपलोड करते हैं, और campaign approval के लिए भेजते हैं।"
    }
  ],
  [
    "ReviewIntel verifies payment and reviews every creative before it rotates on the selected placement.",
    {
      fr: "ReviewIntel vérifie le paiement et examine chaque création avant sa rotation sur l’emplacement choisi.",
      es: "ReviewIntel verifica el pago y revisa cada creatividad antes de rotarla en la ubicación elegida.",
      zh: "ReviewIntel 会验证付款并审核每个素材，然后才会在所选位置轮播。",
      de: "ReviewIntel prüft Zahlung und jedes Creative, bevor es auf der gewählten Platzierung rotiert.",
      hi: "चयनित placement पर rotate होने से पहले ReviewIntel payment और हर creative की समीक्षा करता है।"
    }
  ],
  [
    "Standard rotating sponsor placement for relevant ecommerce tools, services, and offers.",
    {
      fr: "Placement sponsorisé rotatif standard pour outils, services et offres e-commerce pertinents.",
      es: "Ubicación patrocinada rotativa estándar para herramientas, servicios y ofertas ecommerce relevantes.",
      zh: "适用于相关电商工具、服务和优惠的标准轮播赞助位。",
      de: "Standardmäßige rotierende Sponsorplatzierung für relevante E-Commerce-Tools, Services und Angebote.",
      hi: "Relevant ecommerce tools, services और offers के लिए standard rotating sponsor placement।"
    }
  ],
  [
    "Higher-priority rotating campaign with a larger daily impression allowance.",
    {
      fr: "Campagne rotative prioritaire avec un quota quotidien d’impressions plus élevé.",
      es: "Campaña rotativa de mayor prioridad con más impresiones diarias permitidas.",
      zh: "更高优先级的轮播广告活动，带更大的每日展示额度。",
      de: "Rotierende Kampagne mit höherer Priorität und größerem täglichem Impression-Kontingent.",
      hi: "बड़े daily impression allowance के साथ higher-priority rotating campaign।"
    }
  ],
  [
    "Image or short muted video creative",
    {
      fr: "Image ou courte vidéo muette",
      es: "Imagen o video corto silenciado",
      zh: "图片或短静音视频素材",
      de: "Bild oder kurzes stummes Video-Creative",
      hi: "Image या short muted video creative"
    }
  ],
  [
    "Manual payment verification and creative approval",
    {
      fr: "Vérification manuelle du paiement et approbation créative",
      es: "Verificación manual de pago y aprobación creativa",
      zh: "人工付款验证和素材审核",
      de: "Manuelle Zahlungsprüfung und Creative-Freigabe",
      hi: "Manual payment verification और creative approval"
    }
  ],
  [
    "How campaign approval works",
    {
      fr: "Fonctionnement de l’approbation des campagnes",
      es: "Cómo funciona la aprobación de campañas",
      zh: "广告活动如何获批",
      de: "So funktioniert die Kampagnenfreigabe",
      hi: "Campaign approval कैसे काम करता है"
    }
  ],
  [
    "Pay for a package",
    {
      fr: "Payer un forfait",
      es: "Pagar un paquete",
      zh: "购买套餐",
      de: "Paket bezahlen",
      hi: "Package का भुगतान करें"
    }
  ],
  [
    "Upload banner or video",
    {
      fr: "Téléverser bannière ou vidéo",
      es: "Subir banner o video",
      zh: "上传横幅或视频",
      de: "Banner oder Video hochladen",
      hi: "Banner या video अपलोड करें"
    }
  ],
  [
    "ReviewIntel verifies payment",
    {
      fr: "ReviewIntel vérifie le paiement",
      es: "ReviewIntel verifica el pago",
      zh: "ReviewIntel 验证付款",
      de: "ReviewIntel prüft die Zahlung",
      hi: "ReviewIntel payment सत्यापित करता है"
    }
  ],
  [
    "Approved ads rotate automatically",
    {
      fr: "Les publicités approuvées tournent automatiquement",
      es: "Los anuncios aprobados rotan automáticamente",
      zh: "已批准广告自动轮播",
      de: "Freigegebene Anzeigen rotieren automatisch",
      hi: "Approved ads अपने आप rotate होते हैं"
    }
  ],
  [
    "Upload campaign",
    {
      fr: "Téléverser la campagne",
      es: "Subir campaña",
      zh: "上传广告活动",
      de: "Kampagne hochladen",
      hi: "Campaign अपलोड करें"
    }
  ],
  [
    "Advertiser Application",
    {
      fr: "Demande annonceur",
      es: "Solicitud de anunciante",
      zh: "广告主申请",
      de: "Werbeantrag",
      hi: "Advertiser application"
    }
  ],
  [
    "Advertise on ReviewIntel",
    {
      fr: "Faire de la publicité sur ReviewIntel",
      es: "Anunciarse en ReviewIntel",
      zh: "在 ReviewIntel 投放广告",
      de: "Auf ReviewIntel werben",
      hi: "ReviewIntel पर advertise करें"
    }
  ],
  [
    "Upload your campaign creative and submit it for review. Ads go live only after ReviewIntel verifies payment and approves the creative.",
    {
      fr: "Téléversez votre création de campagne et soumettez-la à l’examen. Les publicités ne sont diffusées qu’après vérification du paiement et approbation par ReviewIntel.",
      es: "Sube la creatividad de tu campaña y envíala a revisión. Los anuncios se publican solo después de que ReviewIntel verifique el pago y apruebe la creatividad.",
      zh: "上传广告活动素材并提交审核。只有 ReviewIntel 验证付款并批准素材后，广告才会上线。",
      de: "Lade dein Kampagnen-Creative hoch und reiche es zur Prüfung ein. Anzeigen gehen erst live, nachdem ReviewIntel Zahlung und Creative freigegeben hat.",
      hi: "अपना campaign creative अपलोड करें और review के लिए भेजें। ReviewIntel payment सत्यापित करके creative approve करे तभी ad live होगा।"
    }
  ],
  [
    "1. Apply",
    {
      fr: "1. Postuler",
      es: "1. Solicitar",
      zh: "1. 申请",
      de: "1. Bewerben",
      hi: "1. Apply करें"
    }
  ],
  [
    "Choose a package, add brand details, and upload a banner or short video.",
    {
      fr: "Choisissez un forfait, ajoutez les informations de marque et téléversez une bannière ou une courte vidéo.",
      es: "Elige un paquete, agrega datos de marca y sube un banner o video corto.",
      zh: "选择套餐，填写品牌信息，并上传横幅或短视频。",
      de: "Wähle ein Paket, ergänze Markendaten und lade ein Banner oder Kurzvideo hoch.",
      hi: "Package चुनें, brand details जोड़ें, और banner या short video अपलोड करें।"
    }
  ],
  [
    "2. Get approved",
    {
      fr: "2. Obtenir l’approbation",
      es: "2. Obtener aprobación",
      zh: "2. 获得批准",
      de: "2. Freigabe erhalten",
      hi: "2. Approval पाएँ"
    }
  ],
  [
    "ReviewIntel verifies payment and checks every creative before activation.",
    {
      fr: "ReviewIntel vérifie le paiement et contrôle chaque création avant activation.",
      es: "ReviewIntel verifica el pago y revisa cada creatividad antes de activarla.",
      zh: "ReviewIntel 会在激活前验证付款并检查每个素材。",
      de: "ReviewIntel prüft Zahlung und jedes Creative vor der Aktivierung.",
      hi: "Activation से पहले ReviewIntel payment और हर creative की जाँच करता है।"
    }
  ],
  [
    "3. Start advertising",
    {
      fr: "3. Commencer à diffuser",
      es: "3. Empezar a anunciar",
      zh: "3. 开始投放",
      de: "3. Werbung starten",
      hi: "3. Advertising शुरू करें"
    }
  ],
  [
    "Paid and approved ads rotate automatically in selected placements.",
    {
      fr: "Les publicités payées et approuvées tournent automatiquement dans les emplacements choisis.",
      es: "Los anuncios pagados y aprobados rotan automáticamente en ubicaciones seleccionadas.",
      zh: "已付款并获批的广告会在所选位置自动轮播。",
      de: "Bezahlte und freigegebene Anzeigen rotieren automatisch in ausgewählten Platzierungen.",
      hi: "Paid और approved ads selected placements में अपने आप rotate होते हैं।"
    }
  ],
  [
    "Advertising Pricing",
    {
      fr: "Tarifs publicitaires",
      es: "Precios de publicidad",
      zh: "广告价格",
      de: "Werbepreise",
      hi: "Advertising pricing"
    }
  ],
  [
    "Review current ad packages before applying",
    {
      fr: "Consultez les forfaits publicitaires avant de postuler",
      es: "Revisa los paquetes publicitarios antes de solicitar",
      zh: "申请前查看当前广告套餐",
      de: "Prüfe aktuelle Anzeigenpakete vor der Bewerbung",
      hi: "Apply करने से पहले current ad packages देखें"
    }
  ],
  [
    "Pay first or submit your payment reference with the campaign. Applications are reviewed before any campaign goes live.",
    {
      fr: "Payez d’abord ou envoyez votre référence de paiement avec la campagne. Les demandes sont examinées avant toute diffusion.",
      es: "Paga primero o envía tu referencia de pago con la campaña. Las solicitudes se revisan antes de publicar cualquier campaña.",
      zh: "请先付款，或随广告活动提交付款凭证。所有申请都会在上线前审核。",
      de: "Zahle zuerst oder sende deine Zahlungsreferenz mit der Kampagne. Anträge werden vor jeder Live-Schaltung geprüft.",
      hi: "पहले भुगतान करें या campaign के साथ payment reference भेजें। कोई campaign live होने से पहले applications review होती हैं।"
    }
  ],
  [
    "View advertising prices",
    {
      fr: "Voir les tarifs publicitaires",
      es: "Ver precios de publicidad",
      zh: "查看广告价格",
      de: "Werbepreise ansehen",
      hi: "Advertising prices देखें"
    }
  ],
  [
    "How ReviewIntel ads go live",
    {
      fr: "Comment les publicités ReviewIntel sont diffusées",
      es: "Cómo se publican los anuncios en ReviewIntel",
      zh: "ReviewIntel 广告如何上线",
      de: "Wie ReviewIntel-Anzeigen live gehen",
      hi: "ReviewIntel ads कैसे live होते हैं"
    }
  ],
  [
    "Pay for a package, upload your banner or short video, submit your campaign, then ReviewIntel verifies payment and approves the creative before the ad rotates on the selected placement.",
    {
      fr: "Payez un forfait, téléversez votre bannière ou courte vidéo, soumettez la campagne, puis ReviewIntel vérifie le paiement et approuve la création avant rotation.",
      es: "Paga un paquete, sube tu banner o video corto, envía la campaña y ReviewIntel verificará el pago y aprobará la creatividad antes de rotarla.",
      zh: "购买套餐，上传横幅或短视频，提交广告活动；ReviewIntel 验证付款并批准素材后才会轮播。",
      de: "Bezahle ein Paket, lade Banner oder Kurzvideo hoch, reiche die Kampagne ein, dann prüft ReviewIntel Zahlung und Creative vor der Rotation.",
      hi: "Package pay करें, banner या short video upload करें, campaign submit करें; फिर ReviewIntel payment verify और creative approve करके ad rotate करता है।"
    }
  ],
  [
    "Choose package",
    {
      fr: "Choisir un forfait",
      es: "Elegir paquete",
      zh: "选择套餐",
      de: "Paket wählen",
      hi: "Package चुनें"
    }
  ],
  [
    "Brand name",
    {
      fr: "Nom de marque",
      es: "Nombre de marca",
      zh: "品牌名称",
      de: "Markenname",
      hi: "Brand name"
    }
  ],
  [
    "Contact name",
    {
      fr: "Nom du contact",
      es: "Nombre de contacto",
      zh: "联系人姓名",
      de: "Kontaktname",
      hi: "Contact name"
    }
  ],
  [
    "Contact email",
    {
      fr: "E-mail du contact",
      es: "Correo de contacto",
      zh: "联系邮箱",
      de: "Kontakt-E-Mail",
      hi: "Contact email"
    }
  ],
  [
    "Website URL",
    {
      fr: "URL du site",
      es: "URL del sitio web",
      zh: "网站 URL",
      de: "Website-URL",
      hi: "Website URL"
    }
  ],
  [
    "Campaign headline",
    {
      fr: "Titre de campagne",
      es: "Titular de campaña",
      zh: "广告活动标题",
      de: "Kampagnenüberschrift",
      hi: "Campaign headline"
    }
  ],
  [
    "Destination URL",
    {
      fr: "URL de destination",
      es: "URL de destino",
      zh: "目标网址",
      de: "Ziel-URL",
      hi: "Destination URL"
    }
  ],
  [
    "Upload banner or short video",
    {
      fr: "Téléverser une bannière ou courte vidéo",
      es: "Subir banner o video corto",
      zh: "上传横幅或短视频",
      de: "Banner oder Kurzvideo hochladen",
      hi: "Banner या short video अपलोड करें"
    }
  ],
  [
    "Images up to 4 MB. MP4/WEBM video up to 20 MB, muted autoplay.",
    {
      fr: "Images jusqu’à 4 Mo. Vidéo MP4/WEBM jusqu’à 20 Mo, lecture auto muette.",
      es: "Imágenes hasta 4 MB. Video MP4/WEBM hasta 20 MB, autoplay silenciado.",
      zh: "图片最高 4 MB。MP4/WEBM 视频最高 20 MB，静音自动播放。",
      de: "Bilder bis 4 MB. MP4/WEBM-Video bis 20 MB, stummes Autoplay.",
      hi: "Images 4 MB तक। MP4/WEBM video 20 MB तक, muted autoplay."
    }
  ],
  [
    "Payment reference or Stripe email",
    {
      fr: "Référence de paiement ou e-mail Stripe",
      es: "Referencia de pago o email de Stripe",
      zh: "付款凭证或 Stripe 邮箱",
      de: "Zahlungsreferenz oder Stripe-E-Mail",
      hi: "Payment reference या Stripe email"
    }
  ],
  [
    "Leave blank if you want ReviewIntel to contact you before payment.",
    {
      fr: "Laissez vide si vous voulez que ReviewIntel vous contacte avant paiement.",
      es: "Déjalo en blanco si quieres que ReviewIntel te contacte antes del pago.",
      zh: "如果希望 ReviewIntel 在付款前联系你，请留空。",
      de: "Leer lassen, wenn ReviewIntel dich vor der Zahlung kontaktieren soll.",
      hi: "अगर payment से पहले ReviewIntel से contact चाहिए तो खाली छोड़ें।"
    }
  ],
  [
    "Preferred placement",
    {
      fr: "Emplacement préféré",
      es: "Ubicación preferida",
      zh: "首选位置",
      de: "Bevorzugte Platzierung",
      hi: "Preferred placement"
    }
  ],
  [
    "Homepage middle",
    {
      fr: "Milieu de la page d’accueil",
      es: "Mitad de la página principal",
      zh: "首页中部",
      de: "Startseite Mitte",
      hi: "Homepage middle"
    }
  ],
  [
    "Analyze page",
    {
      fr: "Page d’analyse",
      es: "Página de análisis",
      zh: "分析页面",
      de: "Analyse-Seite",
      hi: "Analyze page"
    }
  ],
  [
    "Results page",
    {
      fr: "Page de résultats",
      es: "Página de resultados",
      zh: "结果页面",
      de: "Ergebnisseite",
      hi: "Results page"
    }
  ],
  [
    "Footer",
    {
      fr: "Pied de page",
      es: "Pie de página",
      zh: "页脚",
      de: "Footer",
      hi: "Footer"
    }
  ],
  [
    "What do you want to advertise?",
    {
      fr: "Que souhaitez-vous promouvoir ?",
      es: "¿Qué quieres anunciar?",
      zh: "你想推广什么？",
      de: "Was möchtest du bewerben?",
      hi: "आप क्या advertise करना चाहते हैं?"
    }
  ],
  [
    "Submit campaign for review",
    {
      fr: "Soumettre la campagne à l’examen",
      es: "Enviar campaña para revisión",
      zh: "提交广告活动审核",
      de: "Kampagne zur Prüfung senden",
      hi: "Campaign review के लिए submit करें"
    }
  ],
  [
    "Submitting...",
    {
      fr: "Envoi...",
      es: "Enviando...",
      zh: "正在提交...",
      de: "Wird gesendet...",
      hi: "Submit हो रहा है..."
    }
  ],
  [
    "Application submitted. ReviewIntel will verify payment and review your creative before it goes live.",
    {
      fr: "Demande envoyée. ReviewIntel vérifiera le paiement et examinera votre création avant diffusion.",
      es: "Solicitud enviada. ReviewIntel verificará el pago y revisará tu creatividad antes de publicarla.",
      zh: "申请已提交。ReviewIntel 会在上线前验证付款并审核你的素材。",
      de: "Antrag gesendet. ReviewIntel prüft Zahlung und Creative vor der Live-Schaltung.",
      hi: "Application submit हो गई। Live होने से पहले ReviewIntel payment verify और creative review करेगा।"
    }
  ],
  [
    "Could not submit application.",
    {
      fr: "Impossible d’envoyer la demande.",
      es: "No se pudo enviar la solicitud.",
      zh: "无法提交申请。",
      de: "Antrag konnte nicht gesendet werden.",
      hi: "Application submit नहीं हो सकी।"
    }
  ],
  [
    "Application submitted. ReviewIntel will verify payment and review the creative before activation.",
    {
      fr: "Demande envoyée. ReviewIntel vérifiera le paiement et examinera la création avant activation.",
      es: "Solicitud enviada. ReviewIntel verificará el pago y revisará la creatividad antes de activarla.",
      zh: "申请已提交。ReviewIntel 会在激活前验证付款并审核素材。",
      de: "Antrag gesendet. ReviewIntel prüft Zahlung und Creative vor der Aktivierung.",
      hi: "Application submit हो गई। Activation से पहले ReviewIntel payment verify और creative review करेगा।"
    }
  ],
  [
    "Application submitted. Pay for the selected package, then send the payment reference for activation.",
    {
      fr: "Demande envoyée. Payez le forfait choisi, puis envoyez la référence de paiement pour activation.",
      es: "Solicitud enviada. Paga el paquete seleccionado y luego envía la referencia de pago para activación.",
      zh: "申请已提交。请支付所选套餐，然后发送付款凭证以便激活。",
      de: "Antrag gesendet. Bezahle das gewählte Paket und sende dann die Zahlungsreferenz zur Aktivierung.",
      hi: "Application submit हो गई। Selected package pay करें, फिर activation के लिए payment reference भेजें।"
    }
  ],
  [
    "Could not submit advertiser application.",
    {
      fr: "Impossible d’envoyer la demande annonceur.",
      es: "No se pudo enviar la solicitud de anunciante.",
      zh: "无法提交广告主申请。",
      de: "Werbeantrag konnte nicht gesendet werden.",
      hi: "Advertiser application submit नहीं हो सकी।"
    }
  ],
  [
    "Advertiser application failed.",
    {
      fr: "La demande annonceur a échoué.",
      es: "Falló la solicitud de anunciante.",
      zh: "广告主申请失败。",
      de: "Werbeantrag fehlgeschlagen.",
      hi: "Advertiser application failed."
    }
  ],
  [
    "Brand name, contact email, website URL, and campaign goal are required.",
    {
      fr: "Nom de marque, e-mail de contact, URL du site et objectif de campagne sont requis.",
      es: "Se requieren nombre de marca, email de contacto, URL del sitio y objetivo de campaña.",
      zh: "必须填写品牌名称、联系邮箱、网站 URL 和广告活动目标。",
      de: "Markenname, Kontakt-E-Mail, Website-URL und Kampagnenziel sind erforderlich.",
      hi: "Brand name, contact email, website URL और campaign goal आवश्यक हैं।"
    }
  ],
  [
    "Enter a valid advertiser email.",
    {
      fr: "Saisissez un e-mail annonceur valide.",
      es: "Ingresa un email de anunciante válido.",
      zh: "请输入有效的广告主邮箱。",
      de: "Gib eine gültige Werbetreibenden-E-Mail ein.",
      hi: "Valid advertiser email दर्ज करें।"
    }
  ],
  [
    "Creative URL must be a valid URL or an uploaded ReviewIntel file.",
    {
      fr: "L’URL de création doit être une URL valide ou un fichier téléversé sur ReviewIntel.",
      es: "La URL creativa debe ser una URL válida o un archivo subido a ReviewIntel.",
      zh: "素材 URL 必须是有效网址或已上传到 ReviewIntel 的文件。",
      de: "Creative-URL muss eine gültige URL oder eine hochgeladene ReviewIntel-Datei sein.",
      hi: "Creative URL valid URL या uploaded ReviewIntel file होना चाहिए।"
    }
  ],
  [
    "Upload PNG, JPG, WEBP, GIF, MP4, or WEBM creative.",
    {
      fr: "Téléversez une création PNG, JPG, WEBP, GIF, MP4 ou WEBM.",
      es: "Sube creatividad PNG, JPG, WEBP, GIF, MP4 o WEBM.",
      zh: "请上传 PNG、JPG、WEBP、GIF、MP4 或 WEBM 素材。",
      de: "Lade ein PNG-, JPG-, WEBP-, GIF-, MP4- oder WEBM-Creative hoch.",
      hi: "PNG, JPG, WEBP, GIF, MP4, या WEBM creative अपलोड करें।"
    }
  ],
  [
    "Video ads must stay under 20 MB.",
    {
      fr: "Les publicités vidéo doivent rester sous 20 Mo.",
      es: "Los anuncios de video deben ser menores de 20 MB.",
      zh: "视频广告必须小于 20 MB。",
      de: "Videoanzeigen müssen unter 20 MB bleiben.",
      hi: "Video ads 20 MB से कम होने चाहिए।"
    }
  ],
  [
    "Image ads must stay under 4 MB.",
    {
      fr: "Les publicités image doivent rester sous 4 Mo.",
      es: "Los anuncios de imagen deben ser menores de 4 MB.",
      zh: "图片广告必须小于 4 MB。",
      de: "Bildanzeigen müssen unter 4 MB bleiben.",
      hi: "Image ads 4 MB से कम होने चाहिए।"
    }
  ],
  [
    "Your brand",
    {
      fr: "Votre marque",
      es: "Tu marca",
      zh: "你的品牌",
      de: "Deine Marke",
      hi: "आपका brand"
    }
  ],
  [
    "Your offer in one short line",
    {
      fr: "Votre offre en une courte phrase",
      es: "Tu oferta en una frase breve",
      zh: "用一句短话描述你的优惠",
      de: "Dein Angebot in einer kurzen Zeile",
      hi: "आपका offer एक छोटी line में"
    }
  ],
  [
    "Stripe receipt email, transaction ID, or note",
    {
      fr: "E-mail du reçu Stripe, ID de transaction ou note",
      es: "Email del recibo Stripe, ID de transacción o nota",
      zh: "Stripe 收据邮箱、交易 ID 或备注",
      de: "Stripe-Beleg-E-Mail, Transaktions-ID oder Notiz",
      hi: "Stripe receipt email, transaction ID, या note"
    }
  ],
  [
    "Tell us about your product, offer, or campaign.",
    {
      fr: "Parlez-nous de votre produit, offre ou campagne.",
      es: "Cuéntanos sobre tu producto, oferta o campaña.",
      zh: "告诉我们你的产品、优惠或广告活动。",
      de: "Erzähl uns von deinem Produkt, Angebot oder deiner Kampagne.",
      hi: "अपने product, offer, या campaign के बारे में बताएँ।"
    }
  ],
  [
    "Analyze Product",
    {
      fr: "Analyser le produit",
      es: "Analizar producto",
      zh: "分析产品",
      de: "Produkt analysieren",
      hi: "उत्पाद का विश्लेषण करें"
    }
  ],
  [
    "⚡ Analyze Product",
    {
      fr: "⚡ Analyser le produit",
      es: "⚡ Analizar producto",
      zh: "⚡ 分析产品",
      de: "⚡ Produkt analysieren",
      hi: "⚡ उत्पाद का विश्लेषण करें"
    }
  ],
  [
    "Know the Truth Before You Buy",
    {
      fr: "Connaissez la vérité avant d'acheter",
      es: "Conoce la verdad antes de comprar",
      zh: "购买前先了解真相",
      de: "Kenne die Wahrheit vor dem Kauf",
      hi: "खरीदने से पहले सच जानें"
    }
  ],
  [
    "🛍️ Should You Buy It?",
    {
      fr: "🛍️ Faut-il l'acheter ?",
      es: "🛍️ ¿Deberías comprarlo?",
      zh: "🛍️ 你应该买吗？",
      de: "🛍️ Solltest du es kaufen?",
      hi: "🛍️ क्या आपको इसे खरीदना चाहिए?"
    }
  ],
  [
    "Thinking about buying something? Upload a screenshot and get an instant AI buying verdict.",
    {
      fr: "Vous pensez acheter quelque chose ? Importez une capture et obtenez instantanément un verdict d'achat par IA.",
      es: "¿Piensas comprar algo? Sube una captura y recibe al instante un veredicto de compra con IA.",
      zh: "想买某个商品？上传截图，立即获得 AI 购买判断。",
      de: "Du überlegst, etwas zu kaufen? Lade einen Screenshot hoch und erhalte sofort ein KI-Kaufurteil.",
      hi: "कुछ खरीदने की सोच रहे हैं? स्क्रीनशॉट अपलोड करें और तुरंत AI खरीद निर्णय पाएं।"
    }
  ],
  [
    "You have used all 3 free scans for today. Your scans reset tomorrow.",
    {
      fr: "Vous avez utilisé vos 3 analyses gratuites aujourd'hui. Elles seront réinitialisées demain.",
      es: "Ya usaste tus 3 análisis gratis de hoy. Se reiniciarán mañana.",
      zh: "你今天的 3 次免费扫描已用完。扫描次数明天重置。",
      de: "Du hast heute alle 3 kostenlosen Scans genutzt. Deine Scans werden morgen zurückgesetzt.",
      hi: "आपने आज के सभी 3 मुफ्त स्कैन उपयोग कर लिए हैं। आपके स्कैन कल रीसेट होंगे।"
    }
  ],
  [
    "Upload Product Screenshot",
    {
      fr: "Importer une capture du produit",
      es: "Subir captura del producto",
      zh: "上传产品截图",
      de: "Produktscreenshot hochladen",
      hi: "उत्पाद स्क्रीनशॉट अपलोड करें"
    }
  ],
  [
    "Product screenshot preview",
    {
      fr: "Aperçu de la capture du produit",
      es: "Vista previa de la captura del producto",
      zh: "产品截图预览",
      de: "Vorschau des Produktscreenshots",
      hi: "उत्पाद स्क्रीनशॉट पूर्वावलोकन"
    }
  ],
  [
    "Screenshot the product page, price, rating, or reviews.",
    {
      fr: "Capturez la page produit, le prix, la note ou les avis.",
      es: "Captura la página del producto, precio, calificación o reseñas.",
      zh: "截取产品页面、价格、评分或评论。",
      de: "Erstelle einen Screenshot der Produktseite, des Preises, der Bewertung oder der Rezensionen.",
      hi: "उत्पाद पेज, कीमत, रेटिंग या समीक्षाओं का स्क्रीनशॉट लें।"
    }
  ],
  [
    "Optional: paste product link",
    {
      fr: "Facultatif : collez le lien du produit",
      es: "Opcional: pega el enlace del producto",
      zh: "可选：粘贴产品链接",
      de: "Optional: Produktlink einfügen",
      hi: "वैकल्पिक: उत्पाद लिंक पेस्ट करें"
    }
  ],
  [
    "We need a clearer screenshot or product link to analyze this properly.",
    {
      fr: "Il faut une capture plus claire ou un lien produit pour analyser correctement.",
      es: "Necesitamos una captura más clara o un enlace del producto para analizarlo bien.",
      zh: "需要更清晰的截图或产品链接，才能正确分析。",
      de: "Wir brauchen einen klareren Screenshot oder Produktlink, um dies richtig zu analysieren.",
      hi: "इसे ठीक से विश्लेषित करने के लिए स्पष्ट स्क्रीनशॉट या उत्पाद लिंक चाहिए।"
    }
  ],
  [
    "We could not analyze this screenshot.",
    {
      fr: "Nous n'avons pas pu analyser cette capture.",
      es: "No pudimos analizar esta captura.",
      zh: "无法分析此截图。",
      de: "Dieser Screenshot konnte nicht analysiert werden.",
      hi: "हम इस स्क्रीनशॉट का विश्लेषण नहीं कर सके।"
    }
  ],
  [
    "Analyzing...",
    {
      fr: "Analyse en cours...",
      es: "Analizando...",
      zh: "正在分析...",
      de: "Analyse läuft...",
      hi: "विश्लेषण हो रहा है..."
    }
  ],
  [
    "CONSIDER",
    {
      fr: "À CONSIDÉRER",
      es: "CONSIDERAR",
      zh: "考虑",
      de: "PRÜFEN",
      hi: "विचार करें"
    }
  ],
  [
    "This looks worth buying.",
    {
      fr: "Ce produit semble valoir l'achat.",
      es: "Parece que vale la pena comprarlo.",
      zh: "这个商品看起来值得购买。",
      de: "Das wirkt kaufenswert.",
      hi: "यह खरीदने लायक लगता है।"
    }
  ],
  [
    "The available buying signals are strong enough for a positive decision.",
    {
      fr: "Les signaux d'achat disponibles sont assez solides pour une décision positive.",
      es: "Las señales de compra disponibles son suficientemente fuertes para una decisión positiva.",
      zh: "现有购买信号足够强，支持积极决定。",
      de: "Die verfügbaren Kaufsignale sind stark genug für eine positive Entscheidung.",
      hi: "उपलब्ध खरीद संकेत सकारात्मक निर्णय के लिए पर्याप्त मजबूत हैं।"
    }
  ],
  [
    "Compare first before buying.",
    {
      fr: "Comparez avant d'acheter.",
      es: "Compara antes de comprar.",
      zh: "购买前先比较。",
      de: "Vor dem Kauf vergleichen.",
      hi: "खरीदने से पहले तुलना करें।"
    }
  ],
  [
    "There are mixed signals. Check alternatives, reviews, and return terms first.",
    {
      fr: "Les signaux sont mitigés. Vérifiez d'abord les alternatives, les avis et les conditions de retour.",
      es: "Hay señales mixtas. Revisa alternativas, reseñas y condiciones de devolución primero.",
      zh: "信号喜忧参半。先检查替代品、评论和退货条款。",
      de: "Die Signale sind gemischt. Prüfe zuerst Alternativen, Rezensionen und Rückgabebedingungen.",
      hi: "संकेत मिले-जुले हैं। पहले विकल्प, समीक्षाएँ और वापसी शर्तें देखें।"
    }
  ],
  [
    "Better to skip this one.",
    {
      fr: "Mieux vaut passer votre tour.",
      es: "Mejor omitir este producto.",
      zh: "最好跳过这个。",
      de: "Dieses Produkt besser überspringen.",
      hi: "इसे छोड़ना बेहतर है।"
    }
  ],
  [
    "The risk or complaint signals are too weak for a confident buy.",
    {
      fr: "Les signaux de risque ou de plainte sont trop faibles pour recommander un achat confiant.",
      es: "Las señales de riesgo o quejas son demasiado débiles para una compra confiada.",
      zh: "风险或投诉信号不足，无法支持有把握的购买。",
      de: "Die Risiko- oder Beschwerdesignale sind zu schwach für einen sicheren Kauf.",
      hi: "जोखिम या शिकायत संकेत भरोसेमंद खरीद के लिए पर्याप्त मजबूत नहीं हैं।"
    }
  ],
  [
    "Product identified",
    {
      fr: "Produit identifié",
      es: "Producto identificado",
      zh: "已识别产品",
      de: "Produkt erkannt",
      hi: "उत्पाद पहचाना गया"
    }
  ],
  [
    "Screenshot preview is not available for this saved scan.",
    {
      fr: "L'aperçu de la capture n'est pas disponible pour cette analyse enregistrée.",
      es: "La vista previa de la captura no está disponible para este análisis guardado.",
      zh: "此保存扫描没有截图预览。",
      de: "Für diesen gespeicherten Scan ist keine Screenshot-Vorschau verfügbar.",
      hi: "इस सहेजे गए स्कैन के लिए स्क्रीनशॉट पूर्वावलोकन उपलब्ध नहीं है।"
    }
  ],
  [
    "Not shown",
    {
      fr: "Non affiché",
      es: "No mostrado",
      zh: "未显示",
      de: "Nicht angezeigt",
      hi: "नहीं दिखाया गया"
    }
  ],
  [
    "Review count not shown",
    {
      fr: "Nombre d'avis non affiché",
      es: "Número de reseñas no mostrado",
      zh: "未显示评论数量",
      de: "Bewertungsanzahl nicht angezeigt",
      hi: "समीक्षा संख्या नहीं दिखाई गई"
    }
  ],
  [
    "Public evidence was limited at analysis time.",
    {
      fr: "Les preuves publiques étaient limitées au moment de l'analyse.",
      es: "La evidencia pública era limitada al momento del análisis.",
      zh: "分析时公开证据有限。",
      de: "Zum Analysezeitpunkt waren öffentliche Belege begrenzt.",
      hi: "विश्लेषण के समय सार्वजनिक प्रमाण सीमित थे।"
    }
  ],
  [
    "Buyer confidence",
    {
      fr: "Confiance acheteur",
      es: "Confianza del comprador",
      zh: "买家信心",
      de: "Käufervertrauen",
      hi: "खरीदार भरोसा"
    }
  ],
  [
    "Buy score",
    {
      fr: "Score d'achat",
      es: "Puntuación de compra",
      zh: "购买评分",
      de: "Kaufscore",
      hi: "खरीद स्कोर"
    }
  ],
  [
    "AI-like reviews",
    {
      fr: "Avis de type IA",
      es: "Reseñas tipo IA",
      zh: "类似 AI 的评论",
      de: "KI-ähnliche Bewertungen",
      hi: "AI जैसी समीक्षाएँ"
    }
  ],
  [
    "Top Strengths",
    {
      fr: "Principaux points forts",
      es: "Principales fortalezas",
      zh: "主要优势",
      de: "Top-Stärken",
      hi: "मुख्य खूबियाँ"
    }
  ],
  [
    "Top Complaints",
    {
      fr: "Principales plaintes",
      es: "Principales quejas",
      zh: "主要投诉",
      de: "Hauptbeschwerden",
      hi: "मुख्य शिकायतें"
    }
  ],
  [
    "Bottom Line",
    {
      fr: "Conclusion",
      es: "Conclusión",
      zh: "结论",
      de: "Fazit",
      hi: "निष्कर्ष"
    }
  ],
  [
    "Not Ideal For",
    {
      fr: "Pas idéal pour",
      es: "No ideal para",
      zh: "不适合",
      de: "Nicht ideal für",
      hi: "इनके लिए आदर्श नहीं"
    }
  ],
  [
    "No clear strengths found.",
    {
      fr: "Aucun point fort clair trouvé.",
      es: "No se encontraron fortalezas claras.",
      zh: "未发现明确优势。",
      de: "Keine klaren Stärken gefunden.",
      hi: "कोई स्पष्ट खूबी नहीं मिली।"
    }
  ],
  [
    "No repeated complaints found.",
    {
      fr: "Aucune plainte répétée trouvée.",
      es: "No se encontraron quejas repetidas.",
      zh: "未发现重复投诉。",
      de: "Keine wiederholten Beschwerden gefunden.",
      hi: "कोई दोहराई गई शिकायत नहीं मिली।"
    }
  ],
  [
    "Good for shoppers who match the product strengths.",
    {
      fr: "Adapté aux acheteurs qui correspondent aux points forts du produit.",
      es: "Bueno para compradores que coinciden con las fortalezas del producto.",
      zh: "适合需求与产品优势匹配的购物者。",
      de: "Gut für Käufer, zu denen die Produktstärken passen.",
      hi: "उन खरीदारों के लिए अच्छा जिनकी जरूरतें उत्पाद की खूबियों से मेल खाती हैं।"
    }
  ],
  [
    "Not enough evidence to say.",
    {
      fr: "Pas assez de preuves pour le dire.",
      es: "No hay suficiente evidencia para decirlo.",
      zh: "证据不足，无法判断。",
      de: "Nicht genug Belege für eine Aussage.",
      hi: "कहने के लिए पर्याप्त प्रमाण नहीं है।"
    }
  ],
  [
    "Price not shown",
    {
      fr: "Prix non affiché",
      es: "Precio no mostrado",
      zh: "未显示价格",
      de: "Preis nicht angezeigt",
      hi: "कीमत नहीं दिखाई गई"
    }
  ],
  [
    "Latest scan loaded.",
    {
      fr: "Dernière analyse chargée.",
      es: "Último análisis cargado.",
      zh: "已加载最新扫描。",
      de: "Neuester Scan geladen.",
      hi: "नवीनतम स्कैन लोड हुआ।"
    }
  ],
  [
    "Analyzed product",
    {
      fr: "Produit analysé",
      es: "Producto analizado",
      zh: "已分析产品",
      de: "Analysiertes Produkt",
      hi: "विश्लेषित उत्पाद"
    }
  ],
  [
    "Analyzed product screenshot",
    {
      fr: "Capture du produit analysé",
      es: "Captura del producto analizado",
      zh: "已分析产品截图",
      de: "Screenshot des analysierten Produkts",
      hi: "विश्लेषित उत्पाद स्क्रीनशॉट"
    }
  ],
  [
    "Medium Trust",
    {
      fr: "Confiance moyenne",
      es: "Confianza media",
      zh: "中等信任",
      de: "Mittleres Vertrauen",
      hi: "मध्यम भरोसा"
    }
  ],
  [
    "Results page failed to load latest scan",
    {
      fr: "La page de résultats n'a pas chargé la dernière analyse",
      es: "La página de resultados no pudo cargar el último análisis",
      zh: "结果页未能加载最新扫描",
      de: "Die Ergebnisseite konnte den neuesten Scan nicht laden",
      hi: "परिणाम पेज नवीनतम स्कैन लोड नहीं कर सका"
    }
  ],
  [
    "Product detail verdict",
    {
      fr: "Verdict détaillé du produit",
      es: "Veredicto detallado del producto",
      zh: "产品详情判断",
      de: "Produktdetail-Urteil",
      hi: "उत्पाद विवरण निर्णय"
    }
  ],
  [
    "Buyer verdict",
    {
      fr: "Verdict acheteur",
      es: "Veredicto del comprador",
      zh: "买家判断",
      de: "Käuferurteil",
      hi: "खरीदार निर्णय"
    }
  ],
  [
    "reviews scanned",
    {
      fr: "avis analysés",
      es: "reseñas analizadas",
      zh: "条评论已扫描",
      de: "Rezensionen gescannt",
      hi: "समीक्षाएँ स्कैन हुईं"
    }
  ],
  [
    "Buying Notes",
    {
      fr: "Notes d'achat",
      es: "Notas de compra",
      zh: "购买备注",
      de: "Kaufhinweise",
      hi: "खरीद नोट्स"
    }
  ],
  [
    "Product scan",
    {
      fr: "Analyse produit",
      es: "Análisis de producto",
      zh: "产品扫描",
      de: "Produktscan",
      hi: "उत्पाद स्कैन"
    }
  ],
  [
    "Shopper Free",
    {
      fr: "Acheteur gratuit",
      es: "Comprador gratis",
      zh: "免费购物者",
      de: "Shopper Free",
      hi: "शॉपर Free"
    }
  ],
  [
    "Shopper Premium",
    {
      fr: "Acheteur Premium",
      es: "Comprador Premium",
      zh: "高级购物者",
      de: "Shopper Premium",
      hi: "शॉपर Premium"
    }
  ],
  [
    "Dashboard is premium-only.",
    {
      fr: "Le tableau de bord est réservé au Premium.",
      es: "El panel es solo para Premium.",
      zh: "控制面板仅限高级版。",
      de: "Das Dashboard ist nur für Premium.",
      hi: "डैशबोर्ड केवल Premium के लिए है।"
    }
  ],
  [
    "Free shoppers can analyze products and view the current scan result, but saved dashboards are not enabled.",
    {
      fr: "Les acheteurs gratuits peuvent analyser des produits et voir le résultat actuel, mais les tableaux de bord enregistrés ne sont pas activés.",
      es: "Los compradores gratis pueden analizar productos y ver el resultado actual, pero los paneles guardados no están habilitados.",
      zh: "免费购物者可以分析产品并查看当前扫描结果，但不能使用保存的控制面板。",
      de: "Kostenlose Shopper können Produkte analysieren und das aktuelle Ergebnis sehen, aber gespeicherte Dashboards sind nicht aktiviert.",
      hi: "मुफ्त शॉपर उत्पादों का विश्लेषण और वर्तमान स्कैन परिणाम देख सकते हैं, लेकिन सहेजे डैशबोर्ड सक्षम नहीं हैं।"
    }
  ],
  [
    "Go to Analyze",
    {
      fr: "Aller à l'analyse",
      es: "Ir a Analizar",
      zh: "前往分析",
      de: "Zur Analyse",
      hi: "विश्लेषण पर जाएँ"
    }
  ],
  [
    "3/day",
    {
      fr: "3/jour",
      es: "3/día",
      zh: "3/天",
      de: "3/Tag",
      hi: "3/दिन"
    }
  ],
  [
    "30 days",
    {
      fr: "30 jours",
      es: "30 días",
      zh: "30 天",
      de: "30 Tage",
      hi: "30 दिन"
    }
  ],
  [
    "Premium keeps 10 scans per week",
    {
      fr: "Premium garde 10 analyses par semaine",
      es: "Premium conserva 10 análisis por semana",
      zh: "高级版每周保留 10 次扫描",
      de: "Premium speichert 10 Scans pro Woche",
      hi: "Premium प्रति सप्ताह 10 स्कैन रखता है"
    }
  ],
  [
    "Free does not save scan history",
    {
      fr: "La version gratuite n'enregistre pas l'historique",
      es: "Gratis no guarda historial de análisis",
      zh: "免费版不保存扫描历史",
      de: "Free speichert keinen Scanverlauf",
      hi: "Free स्कैन इतिहास नहीं सहेजता"
    }
  ],
  [
    "Shopping Hub",
    {
      fr: "Centre d'achat",
      es: "Centro de compras",
      zh: "购物中心",
      de: "Shopping-Zentrale",
      hi: "शॉपिंग केंद्र"
    }
  ],
  [
    "What are you buying today?",
    {
      fr: "Qu'achetez-vous aujourd'hui ?",
      es: "¿Qué vas a comprar hoy?",
      zh: "你今天想买什么？",
      de: "Was kaufst du heute?",
      hi: "आज आप क्या खरीद रहे हैं?"
    }
  ],
  [
    "Pick one button. ReviewIntel will help you buy, compare, or avoid.",
    {
      fr: "Choisissez un bouton. ReviewIntel vous aide à acheter, comparer ou éviter.",
      es: "Elige un botón. ReviewIntel te ayudará a comprar, comparar o evitar.",
      zh: "选择一个按钮。ReviewIntel 会帮你购买、比较或避开。",
      de: "Wähle eine Schaltfläche. ReviewIntel hilft dir beim Kaufen, Vergleichen oder Vermeiden.",
      hi: "एक बटन चुनें। ReviewIntel खरीदने, तुलना करने या बचने में मदद करेगा।"
    }
  ],
  [
    "Upload one screenshot or paste one link.",
    {
      fr: "Importez une capture ou collez un lien.",
      es: "Sube una captura o pega un enlace.",
      zh: "上传一张截图或粘贴一个链接。",
      de: "Lade einen Screenshot hoch oder füge einen Link ein.",
      hi: "एक स्क्रीनशॉट अपलोड करें या एक लिंक पेस्ट करें।"
    }
  ],
  [
    "Check two products side by side.",
    {
      fr: "Comparez deux produits côte à côte.",
      es: "Compara dos productos lado a lado.",
      zh: "并排检查两个产品。",
      de: "Vergleiche zwei Produkte nebeneinander.",
      hi: "दो उत्पादों की साथ-साथ तुलना करें।"
    }
  ],
  [
    "Recent Scans",
    {
      fr: "Analyses récentes",
      es: "Análisis recientes",
      zh: "最近扫描",
      de: "Neueste Scans",
      hi: "हाल के स्कैन"
    }
  ],
  [
    "See what you checked recently.",
    {
      fr: "Voyez ce que vous avez vérifié récemment.",
      es: "Mira lo que revisaste recientemente.",
      zh: "查看你最近检查过的内容。",
      de: "Sieh, was du zuletzt geprüft hast.",
      hi: "देखें आपने हाल में क्या जाँचा।"
    }
  ],
  [
    "Saved history is premium-only.",
    {
      fr: "L'historique enregistré est réservé au Premium.",
      es: "El historial guardado es solo Premium.",
      zh: "保存历史仅限高级版。",
      de: "Gespeicherter Verlauf ist nur Premium.",
      hi: "सहेजा इतिहास केवल Premium में है।"
    }
  ],
  [
    "Avoid List",
    {
      fr: "Liste à éviter",
      es: "Lista de evitar",
      zh: "避坑清单",
      de: "Vermeiden-Liste",
      hi: "बचने की सूची"
    }
  ],
  [
    "Products with warning signs.",
    {
      fr: "Produits avec signaux d'alerte.",
      es: "Productos con señales de alerta.",
      zh: "带有警示信号的产品。",
      de: "Produkte mit Warnsignalen.",
      hi: "चेतावनी संकेतों वाले उत्पाद।"
    }
  ],
  [
    "Avoid history is premium-only.",
    {
      fr: "L'historique à éviter est réservé au Premium.",
      es: "El historial de evitar es solo Premium.",
      zh: "避坑历史仅限高级版。",
      de: "Vermeiden-Verlauf ist nur Premium.",
      hi: "बचाव इतिहास केवल Premium में है।"
    }
  ],
  [
    "Saved scans auto-clear",
    {
      fr: "Les analyses enregistrées s'effacent automatiquement",
      es: "Los análisis guardados se borran automáticamente",
      zh: "保存的扫描会自动清除",
      de: "Gespeicherte Scans löschen sich automatisch",
      hi: "सहेजे स्कैन अपने-आप हटते हैं"
    }
  ],
  [
    "Current scan only",
    {
      fr: "Analyse actuelle seulement",
      es: "Solo el análisis actual",
      zh: "仅当前扫描",
      de: "Nur aktueller Scan",
      hi: "केवल वर्तमान स्कैन"
    }
  ],
  [
    "Today",
    {
      fr: "Aujourd'hui",
      es: "Hoy",
      zh: "今天",
      de: "Heute",
      hi: "आज"
    }
  ],
  [
    "History",
    {
      fr: "Historique",
      es: "Historial",
      zh: "历史",
      de: "Verlauf",
      hi: "इतिहास"
    }
  ],
  [
    "Warnings",
    {
      fr: "Avertissements",
      es: "Advertencias",
      zh: "警告",
      de: "Warnungen",
      hi: "चेतावनियाँ"
    }
  ],
  [
    "Products to think twice about",
    {
      fr: "Produits à examiner avec prudence",
      es: "Productos para pensarlo dos veces",
      zh: "需要三思的产品",
      de: "Produkte, bei denen du zweimal nachdenken solltest",
      hi: "जिन उत्पादों पर दोबारा सोचना चाहिए"
    }
  ],
  [
    "Last products checked",
    {
      fr: "Derniers produits vérifiés",
      es: "Últimos productos revisados",
      zh: "最近检查的产品",
      de: "Zuletzt geprüfte Produkte",
      hi: "अंतिम जाँचे गए उत्पाद"
    }
  ],
  [
    "History is premium-only.",
    {
      fr: "L'historique est réservé au Premium.",
      es: "El historial es solo Premium.",
      zh: "历史记录仅限高级版。",
      de: "Verlauf ist nur Premium.",
      hi: "इतिहास केवल Premium में है।"
    }
  ],
  [
    "Shopper Free shows only the current scan result after analysis.",
    {
      fr: "Acheteur gratuit affiche seulement le résultat actuel après l'analyse.",
      es: "Comprador gratis solo muestra el resultado actual después del análisis.",
      zh: "免费购物者分析后只显示当前扫描结果。",
      de: "Shopper Free zeigt nach der Analyse nur das aktuelle Ergebnis.",
      hi: "Shopper Free विश्लेषण के बाद केवल वर्तमान स्कैन परिणाम दिखाता है।"
    }
  ],
  [
    "No scans yet.",
    {
      fr: "Aucune analyse pour l'instant.",
      es: "Aún no hay análisis.",
      zh: "还没有扫描。",
      de: "Noch keine Scans.",
      hi: "अभी कोई स्कैन नहीं।"
    }
  ],
  [
    "Analyze a product to start your saved history.",
    {
      fr: "Analysez un produit pour démarrer votre historique enregistré.",
      es: "Analiza un producto para iniciar tu historial guardado.",
      zh: "分析一个产品以开始保存历史。",
      de: "Analysiere ein Produkt, um deinen gespeicherten Verlauf zu starten.",
      hi: "सहेजा इतिहास शुरू करने के लिए उत्पाद का विश्लेषण करें।"
    }
  ],
  [
    "ReviewIntel marked this as AVOID.",
    {
      fr: "ReviewIntel l'a marqué comme À ÉVITER.",
      es: "ReviewIntel lo marcó como EVITAR.",
      zh: "ReviewIntel 将其标记为避免。",
      de: "ReviewIntel hat dies als VERMEIDEN markiert.",
      hi: "ReviewIntel ने इसे बचें के रूप में चिह्नित किया।"
    }
  ],
  [
    "Upload a CSV file first.",
    {
      fr: "Importez d'abord un fichier CSV.",
      es: "Sube primero un archivo CSV.",
      zh: "请先上传 CSV 文件。",
      de: "Lade zuerst eine CSV-Datei hoch.",
      hi: "पहले CSV फ़ाइल अपलोड करें।"
    }
  ],
  [
    "Seller CSV analysis failed.",
    {
      fr: "L'analyse CSV vendeur a échoué.",
      es: "Falló el análisis CSV del vendedor.",
      zh: "卖家 CSV 分析失败。",
      de: "Seller-CSV-Analyse fehlgeschlagen.",
      hi: "विक्रेता CSV विश्लेषण विफल हुआ।"
    }
  ],
  [
    "Seller CSV Intelligence",
    {
      fr: "Intelligence CSV vendeur",
      es: "Inteligencia CSV del vendedor",
      zh: "卖家 CSV 智能分析",
      de: "Seller-CSV-Intelligence",
      hi: "विक्रेता CSV इंटेलिजेंस"
    }
  ],
  [
    "ReviewIntel Seller",
    {
      fr: "ReviewIntel vendeur",
      es: "ReviewIntel vendedor",
      zh: "ReviewIntel 卖家",
      de: "ReviewIntel Seller",
      hi: "ReviewIntel विक्रेता"
    }
  ],
  [
    "Upload Seller Reviews.",
    {
      fr: "Importez les avis vendeur.",
      es: "Sube reseñas del vendedor.",
      zh: "上传卖家评论。",
      de: "Seller-Bewertungen hochladen.",
      hi: "विक्रेता समीक्षाएँ अपलोड करें।"
    }
  ],
  [
    "Upload your product review CSV. ReviewIntel will build a seller intelligence report with product health, buyer satisfaction, refund risk, complaints, product fixes, listing fixes, and ad angles.",
    {
      fr: "Importez le CSV d'avis produit. ReviewIntel créera un rapport vendeur avec santé produit, satisfaction acheteur, risque de remboursement, plaintes, corrections produit, corrections de fiche et angles publicitaires.",
      es: "Sube el CSV de reseñas del producto. ReviewIntel creará un informe del vendedor con salud del producto, satisfacción, riesgo de reembolso, quejas, mejoras del producto, mejoras del listado y ángulos de anuncios.",
      zh: "上传产品评论 CSV。ReviewIntel 会生成卖家智能报告，包含产品健康度、买家满意度、退款风险、投诉、产品修复、Listing 修复和广告角度。",
      de: "Lade deine Produktbewertungs-CSV hoch. ReviewIntel erstellt einen Seller-Intelligence-Bericht mit Produktgesundheit, Käuferzufriedenheit, Rückerstattungsrisiko, Beschwerden, Produktfixes, Listing-Fixes und Werbeansätzen.",
      hi: "अपनी उत्पाद समीक्षा CSV अपलोड करें। ReviewIntel उत्पाद स्वास्थ्य, खरीदार संतुष्टि, रिफंड जोखिम, शिकायतें, उत्पाद सुधार, लिस्टिंग सुधार और विज्ञापन कोणों वाली विक्रेता रिपोर्ट बनाएगा।"
    }
  ],
  [
    "Upload product review CSV",
    {
      fr: "Importer le CSV d'avis produit",
      es: "Subir CSV de reseñas del producto",
      zh: "上传产品评论 CSV",
      de: "Produktbewertungs-CSV hochladen",
      hi: "उत्पाद समीक्षा CSV अपलोड करें"
    }
  ],
  [
    "CSV only. Include review text, rating, date, product name, customer comments, or order feedback if available.",
    {
      fr: "CSV uniquement. Incluez le texte des avis, la note, la date, le nom du produit, les commentaires clients ou les retours de commande si disponibles.",
      es: "Solo CSV. Incluye texto de reseña, calificación, fecha, nombre del producto, comentarios de clientes o feedback de pedidos si está disponible.",
      zh: "仅限 CSV。尽量包含评论文本、评分、日期、产品名称、客户评论或订单反馈。",
      de: "Nur CSV. Füge falls vorhanden Bewertungstext, Bewertung, Datum, Produktname, Kundenkommentare oder Bestellfeedback hinzu.",
      hi: "केवल CSV। उपलब्ध हो तो समीक्षा टेक्स्ट, रेटिंग, तारीख, उत्पाद नाम, ग्राहक टिप्पणियाँ या ऑर्डर फीडबैक शामिल करें।"
    }
  ],
  [
    "Building seller intelligence report...",
    {
      fr: "Création du rapport vendeur...",
      es: "Creando informe del vendedor...",
      zh: "正在生成卖家智能报告...",
      de: "Seller-Intelligence-Bericht wird erstellt...",
      hi: "विक्रेता इंटेलिजेंस रिपोर्ट बन रही है..."
    }
  ],
  [
    "⚡ Analyze Seller Reviews",
    {
      fr: "⚡ Analyser les avis vendeur",
      es: "⚡ Analizar reseñas del vendedor",
      zh: "⚡ 分析卖家评论",
      de: "⚡ Seller-Bewertungen analysieren",
      hi: "⚡ विक्रेता समीक्षाओं का विश्लेषण करें"
    }
  ],
  [
    "Strong Product",
    {
      fr: "Produit solide",
      es: "Producto fuerte",
      zh: "强势产品",
      de: "Starkes Produkt",
      hi: "मजबूत उत्पाद"
    }
  ],
  [
    "Good, But Needs Work",
    {
      fr: "Bon, mais à améliorer",
      es: "Bueno, pero necesita trabajo",
      zh: "不错，但需要改进",
      de: "Gut, aber verbesserungsbedürftig",
      hi: "अच्छा, लेकिन सुधार चाहिए"
    }
  ],
  [
    "Needs Attention",
    {
      fr: "Nécessite une attention",
      es: "Necesita atención",
      zh: "需要关注",
      de: "Braucht Aufmerksamkeit",
      hi: "ध्यान चाहिए"
    }
  ],
  [
    "This product has strong buyer signals. Focus on polishing friction points and turning praise into better listing copy.",
    {
      fr: "Ce produit montre de forts signaux acheteurs. Corrigez les frictions et transformez les éloges en meilleure fiche produit.",
      es: "Este producto tiene señales fuertes de compradores. Pule los puntos de fricción y convierte los elogios en mejor texto de listado.",
      zh: "该产品有强烈买家信号。重点打磨阻力点，并把好评转化为更好的 Listing 文案。",
      de: "Dieses Produkt hat starke Käufersignale. Glätte Reibungspunkte und verwandle Lob in bessere Listing-Texte.",
      hi: "इस उत्पाद में मजबूत खरीदार संकेत हैं। रुकावटों को सुधारें और प्रशंसा को बेहतर लिस्टिंग कॉपी में बदलें।"
    }
  ],
  [
    "This product has potential, but repeated buyer objections should be fixed before scaling ads or inventory.",
    {
      fr: "Ce produit a du potentiel, mais les objections répétées doivent être corrigées avant d'augmenter publicité ou stock.",
      es: "Este producto tiene potencial, pero las objeciones repetidas deben corregirse antes de escalar anuncios o inventario.",
      zh: "该产品有潜力，但在扩大广告或库存前应修复重复的买家异议。",
      de: "Dieses Produkt hat Potenzial, aber wiederholte Käuferbedenken sollten vor mehr Werbung oder Bestand behoben werden.",
      hi: "इस उत्पाद में संभावना है, पर विज्ञापन या इन्वेंटरी बढ़ाने से पहले दोहराई गई खरीदार आपत्तियाँ ठीक करें।"
    }
  ],
  [
    "The review signals show meaningful risk. Fix the biggest product and listing issues before pushing more traffic.",
    {
      fr: "Les signaux d'avis montrent un risque réel. Corrigez les plus gros problèmes produit et fiche avant d'envoyer plus de trafic.",
      es: "Las señales de reseñas muestran riesgo importante. Corrige los mayores problemas del producto y listado antes de enviar más tráfico.",
      zh: "评论信号显示明显风险。增加流量前先修复最大的产品和 Listing 问题。",
      de: "Die Bewertungssignale zeigen relevantes Risiko. Behebe die größten Produkt- und Listing-Probleme, bevor du mehr Traffic sendest.",
      hi: "समीक्षा संकेत महत्वपूर्ण जोखिम दिखाते हैं। अधिक ट्रैफिक भेजने से पहले सबसे बड़े उत्पाद और लिस्टिंग मुद्दे ठीक करें।"
    }
  ],
  [
    "No clear signal found yet.",
    {
      fr: "Aucun signal clair pour l'instant.",
      es: "Aún no se encontró una señal clara.",
      zh: "尚未发现明确信号。",
      de: "Noch kein klares Signal gefunden.",
      hi: "अभी कोई स्पष्ट संकेत नहीं मिला।"
    }
  ],
  [
    "Review the top complaint themes and improve the product listing before scaling sales.",
    {
      fr: "Examinez les principales plaintes et améliorez la fiche produit avant d'accélérer les ventes.",
      es: "Revisa los principales temas de quejas y mejora el listado antes de escalar ventas.",
      zh: "先查看主要投诉主题并改进产品 Listing，再扩大销售。",
      de: "Prüfe die wichtigsten Beschwerdethemen und verbessere das Listing, bevor du Verkäufe skalierst.",
      hi: "बिक्री बढ़ाने से पहले मुख्य शिकायत विषय देखें और उत्पाद लिस्टिंग सुधारें।"
    }
  ],
  [
    "Seller scan",
    {
      fr: "Analyse vendeur",
      es: "Análisis del vendedor",
      zh: "卖家扫描",
      de: "Seller-Scan",
      hi: "विक्रेता स्कैन"
    }
  ],
  [
    "No major repeated issue found yet.",
    {
      fr: "Aucun problème majeur répété trouvé pour l'instant.",
      es: "Aún no se encontró un problema repetido importante.",
      zh: "尚未发现重大重复问题。",
      de: "Noch kein großes wiederholtes Problem gefunden.",
      hi: "अभी कोई बड़ा दोहराया मुद्दा नहीं मिला।"
    }
  ],
  [
    "Use positive buyer language to improve listing and ads.",
    {
      fr: "Utilisez le langage positif des acheteurs pour améliorer fiche et publicités.",
      es: "Usa lenguaje positivo de compradores para mejorar el listado y los anuncios.",
      zh: "使用买家的正面语言改进 Listing 和广告。",
      de: "Nutze positive Käuferformulierungen für Listing und Anzeigen.",
      hi: "लिस्टिंग और विज्ञापनों को सुधारने के लिए सकारात्मक खरीदार भाषा उपयोग करें।"
    }
  ],
  [
    "Improve the clearest buyer friction point first.",
    {
      fr: "Améliorez d'abord le point de friction acheteur le plus clair.",
      es: "Mejora primero el punto de fricción más claro del comprador.",
      zh: "优先改进最明确的买家阻力点。",
      de: "Verbessere zuerst den klarsten Käufer-Reibungspunkt.",
      hi: "सबसे स्पष्ट खरीदार रुकावट को पहले सुधारें।"
    }
  ],
  [
    "Seller Intelligence Report",
    {
      fr: "Rapport d'intelligence vendeur",
      es: "Informe de inteligencia del vendedor",
      zh: "卖家智能报告",
      de: "Seller-Intelligence-Bericht",
      hi: "विक्रेता इंटेलिजेंस रिपोर्ट"
    }
  ],
  [
    "ReviewIntel Seller Result",
    {
      fr: "Résultat vendeur ReviewIntel",
      es: "Resultado del vendedor ReviewIntel",
      zh: "ReviewIntel 卖家结果",
      de: "ReviewIntel Seller-Ergebnis",
      hi: "ReviewIntel विक्रेता परिणाम"
    }
  ],
  [
    "Uploaded file",
    {
      fr: "Fichier importé",
      es: "Archivo subido",
      zh: "已上传文件",
      de: "Hochgeladene Datei",
      hi: "अपलोड की गई फ़ाइल"
    }
  ],
  [
    "Executive Summary",
    {
      fr: "Résumé exécutif",
      es: "Resumen ejecutivo",
      zh: "执行摘要",
      de: "Zusammenfassung",
      hi: "कार्यकारी सारांश"
    }
  ],
  [
    "Biggest Problem",
    {
      fr: "Plus gros problème",
      es: "Mayor problema",
      zh: "最大问题",
      de: "Größtes Problem",
      hi: "सबसे बड़ी समस्या"
    }
  ],
  [
    "Best Opportunity",
    {
      fr: "Meilleure opportunité",
      es: "Mejor oportunidad",
      zh: "最佳机会",
      de: "Beste Chance",
      hi: "सबसे अच्छा अवसर"
    }
  ],
  [
    "Fix First",
    {
      fr: "Corriger d'abord",
      es: "Corregir primero",
      zh: "优先修复",
      de: "Zuerst beheben",
      hi: "पहले ठीक करें"
    }
  ],
  [
    "Priority Action Plan",
    {
      fr: "Plan d'action prioritaire",
      es: "Plan de acción prioritario",
      zh: "优先行动计划",
      de: "Priorisierter Aktionsplan",
      hi: "प्राथमिक कार्य योजना"
    }
  ],
  [
    "What to fix next",
    {
      fr: "Que corriger ensuite",
      es: "Qué corregir después",
      zh: "下一步修复什么",
      de: "Was als Nächstes zu beheben ist",
      hi: "आगे क्या ठीक करें"
    }
  ],
  [
    "No seller result found.",
    {
      fr: "Aucun résultat vendeur trouvé.",
      es: "No se encontró resultado del vendedor.",
      zh: "未找到卖家结果。",
      de: "Kein Seller-Ergebnis gefunden.",
      hi: "कोई विक्रेता परिणाम नहीं मिला।"
    }
  ],
  [
    "Upload a CSV first to generate a seller intelligence report.",
    {
      fr: "Importez d'abord un CSV pour générer un rapport vendeur.",
      es: "Sube primero un CSV para generar un informe del vendedor.",
      zh: "请先上传 CSV 以生成卖家智能报告。",
      de: "Lade zuerst eine CSV hoch, um einen Seller-Intelligence-Bericht zu erstellen.",
      hi: "विक्रेता रिपोर्ट बनाने के लिए पहले CSV अपलोड करें।"
    }
  ],
  [
    "What buyers are unhappy about.",
    {
      fr: "Ce qui déplaît aux acheteurs.",
      es: "Lo que molesta a los compradores.",
      zh: "买家不满意的地方。",
      de: "Womit Käufer unzufrieden sind.",
      hi: "खरीदार किससे खुश नहीं हैं।"
    }
  ],
  [
    "Top Praise",
    {
      fr: "Principaux éloges",
      es: "Principales elogios",
      zh: "主要好评",
      de: "Top-Lob",
      hi: "मुख्य प्रशंसा"
    }
  ],
  [
    "What buyers already love.",
    {
      fr: "Ce que les acheteurs aiment déjà.",
      es: "Lo que los compradores ya aman.",
      zh: "买家已经喜欢的地方。",
      de: "Was Käufer bereits mögen.",
      hi: "खरीदार पहले से क्या पसंद करते हैं।"
    }
  ],
  [
    "Buyer Objections",
    {
      fr: "Objections acheteurs",
      es: "Objeciones de compradores",
      zh: "买家异议",
      de: "Käufereinwände",
      hi: "खरीदार आपत्तियाँ"
    }
  ],
  [
    "What may stop shoppers from buying.",
    {
      fr: "Ce qui peut empêcher les acheteurs d'acheter.",
      es: "Lo que puede impedir que compren.",
      zh: "可能阻止购物者购买的因素。",
      de: "Was Shopper vom Kauf abhalten kann.",
      hi: "जो शॉपर को खरीदने से रोक सकता है।"
    }
  ],
  [
    "Product Fixes",
    {
      fr: "Corrections produit",
      es: "Mejoras del producto",
      zh: "产品修复",
      de: "Produktfixes",
      hi: "उत्पाद सुधार"
    }
  ],
  [
    "Improvements that can reduce complaints.",
    {
      fr: "Améliorations qui peuvent réduire les plaintes.",
      es: "Mejoras que pueden reducir quejas.",
      zh: "可减少投诉的改进。",
      de: "Verbesserungen, die Beschwerden reduzieren können.",
      hi: "शिकायतें कम करने वाले सुधार।"
    }
  ],
  [
    "Listing Fixes",
    {
      fr: "Corrections de fiche",
      es: "Mejoras del listado",
      zh: "Listing 修复",
      de: "Listing-Fixes",
      hi: "लिस्टिंग सुधार"
    }
  ],
  [
    "Copy, image, and detail improvements.",
    {
      fr: "Améliorations du texte, des images et des détails.",
      es: "Mejoras de texto, imágenes y detalles.",
      zh: "文案、图片和细节改进。",
      de: "Verbesserungen an Text, Bildern und Details.",
      hi: "कॉपी, इमेज और विवरण सुधार।"
    }
  ],
  [
    "Ad Angles",
    {
      fr: "Angles publicitaires",
      es: "Ángulos de anuncios",
      zh: "广告角度",
      de: "Werbeansätze",
      hi: "विज्ञापन कोण"
    }
  ],
  [
    "Positive review themes you can use in marketing.",
    {
      fr: "Thèmes positifs des avis à utiliser en marketing.",
      es: "Temas positivos de reseñas que puedes usar en marketing.",
      zh: "可用于营销的正面评论主题。",
      de: "Positive Bewertungsthemen, die du im Marketing nutzen kannst.",
      hi: "मार्केटिंग में उपयोग किए जा सकने वाले सकारात्मक समीक्षा विषय।"
    }
  ],
  [
    "ReviewIntel Seller Compare",
    {
      fr: "Comparaison vendeur ReviewIntel",
      es: "Comparación de vendedor ReviewIntel",
      zh: "ReviewIntel 卖家对比",
      de: "ReviewIntel Seller-Vergleich",
      hi: "ReviewIntel विक्रेता तुलना"
    }
  ],
  [
    "Your Product vs Competitor.",
    {
      fr: "Votre produit contre le concurrent.",
      es: "Tu producto contra el competidor.",
      zh: "你的产品对比竞争对手。",
      de: "Dein Produkt gegen den Wettbewerber.",
      hi: "आपका उत्पाद बनाम प्रतिस्पर्धी।"
    }
  ],
  [
    "Find out why buyers may choose your competitor instead of you. Compare complaints, refund risk, buyer objections, product weaknesses, listing problems, and ad angles.",
    {
      fr: "Découvrez pourquoi les acheteurs peuvent choisir votre concurrent. Comparez plaintes, risque de remboursement, objections, faiblesses produit, problèmes de fiche et angles publicitaires.",
      es: "Descubre por qué los compradores pueden elegir a tu competidor. Compara quejas, riesgo de reembolso, objeciones, debilidades, problemas del listado y ángulos de anuncios.",
      zh: "了解买家为何可能选择竞争对手。对比投诉、退款风险、买家异议、产品弱点、Listing 问题和广告角度。",
      de: "Finde heraus, warum Käufer den Wettbewerber wählen könnten. Vergleiche Beschwerden, Rückerstattungsrisiko, Einwände, Produktschwächen, Listing-Probleme und Werbeansätze.",
      hi: "जानें खरीदार आपको छोड़कर प्रतिस्पर्धी क्यों चुन सकते हैं। शिकायतें, रिफंड जोखिम, आपत्तियाँ, उत्पाद कमजोरियाँ, लिस्टिंग समस्याएँ और विज्ञापन कोण तुलना करें।"
    }
  ],
  [
    "Upload both CSV files to compare.",
    {
      fr: "Importez les deux fichiers CSV pour comparer.",
      es: "Sube ambos archivos CSV para comparar.",
      zh: "上传两个 CSV 文件进行比较。",
      de: "Lade beide CSV-Dateien hoch, um zu vergleichen.",
      hi: "तुलना के लिए दोनों CSV फ़ाइलें अपलोड करें।"
    }
  ],
  [
    "Tie. Both products need a deeper complaint and advantage review.",
    {
      fr: "Égalité. Les deux produits nécessitent une analyse plus profonde des plaintes et avantages.",
      es: "Empate. Ambos productos necesitan una revisión más profunda de quejas y ventajas.",
      zh: "平局。两个产品都需要更深入地审查投诉和优势。",
      de: "Gleichstand. Beide Produkte brauchen eine tiefere Beschwerde- und Vorteilsprüfung.",
      hi: "बराबरी। दोनों उत्पादों को शिकायत और लाभ की गहरी समीक्षा चाहिए।"
    }
  ],
  [
    "Your product is stronger based on review evidence.",
    {
      fr: "Votre produit est plus fort selon les preuves des avis.",
      es: "Tu producto es más fuerte según la evidencia de reseñas.",
      zh: "根据评论证据，你的产品更强。",
      de: "Dein Produkt ist laut Bewertungsbelegen stärker.",
      hi: "समीक्षा प्रमाण के आधार पर आपका उत्पाद मजबूत है।"
    }
  ],
  [
    "The competitor is stronger based on review evidence.",
    {
      fr: "Le concurrent est plus fort selon les preuves des avis.",
      es: "El competidor es más fuerte según la evidencia de reseñas.",
      zh: "根据评论证据，竞争对手更强。",
      de: "Der Wettbewerber ist laut Bewertungsbelegen stärker.",
      hi: "समीक्षा प्रमाण के आधार पर प्रतिस्पर्धी मजबूत है।"
    }
  ],
  [
    "Same refund risk",
    {
      fr: "Même risque de remboursement",
      es: "Mismo riesgo de reembolso",
      zh: "退款风险相同",
      de: "Gleiches Rückerstattungsrisiko",
      hi: "समान रिफंड जोखिम"
    }
  ],
  [
    "Your product has lower refund risk",
    {
      fr: "Votre produit a un risque de remboursement plus faible",
      es: "Tu producto tiene menor riesgo de reembolso",
      zh: "你的产品退款风险更低",
      de: "Dein Produkt hat ein geringeres Rückerstattungsrisiko",
      hi: "आपके उत्पाद में रिफंड जोखिम कम है"
    }
  ],
  [
    "Competitor has lower refund risk",
    {
      fr: "Le concurrent a un risque de remboursement plus faible",
      es: "El competidor tiene menor riesgo de reembolso",
      zh: "竞争对手退款风险更低",
      de: "Der Wettbewerber hat ein geringeres Rückerstattungsrisiko",
      hi: "प्रतिस्पर्धी में रिफंड जोखिम कम है"
    }
  ],
  [
    "Seller analysis failed.",
    {
      fr: "L'analyse vendeur a échoué.",
      es: "Falló el análisis del vendedor.",
      zh: "卖家分析失败。",
      de: "Seller-Analyse fehlgeschlagen.",
      hi: "विक्रेता विश्लेषण विफल हुआ।"
    }
  ],
  [
    "Upload CSV files for both your product and the competitor.",
    {
      fr: "Importez les CSV de votre produit et du concurrent.",
      es: "Sube archivos CSV para tu producto y el competidor.",
      zh: "上传你的产品和竞争对手的 CSV 文件。",
      de: "Lade CSV-Dateien für dein Produkt und den Wettbewerber hoch.",
      hi: "अपने उत्पाद और प्रतिस्पर्धी दोनों के लिए CSV फ़ाइलें अपलोड करें।"
    }
  ],
  [
    "Seller compare failed.",
    {
      fr: "La comparaison vendeur a échoué.",
      es: "Falló la comparación del vendedor.",
      zh: "卖家对比失败。",
      de: "Seller-Vergleich fehlgeschlagen.",
      hi: "विक्रेता तुलना विफल हुई।"
    }
  ],
  [
    "Your Product CSV",
    {
      fr: "CSV de votre produit",
      es: "CSV de tu producto",
      zh: "你的产品 CSV",
      de: "CSV deines Produkts",
      hi: "आपके उत्पाद की CSV"
    }
  ],
  [
    "Upload your product reviews",
    {
      fr: "Importez vos avis produit",
      es: "Sube tus reseñas del producto",
      zh: "上传你的产品评论",
      de: "Lade deine Produktbewertungen hoch",
      hi: "अपनी उत्पाद समीक्षाएँ अपलोड करें"
    }
  ],
  [
    "Competitor CSV",
    {
      fr: "CSV concurrent",
      es: "CSV del competidor",
      zh: "竞争对手 CSV",
      de: "Wettbewerber-CSV",
      hi: "प्रतिस्पर्धी CSV"
    }
  ],
  [
    "Upload competitor reviews",
    {
      fr: "Importez les avis du concurrent",
      es: "Sube reseñas del competidor",
      zh: "上传竞争对手评论",
      de: "Wettbewerberbewertungen hochladen",
      hi: "प्रतिस्पर्धी समीक्षाएँ अपलोड करें"
    }
  ],
  [
    "Comparing your product vs competitor...",
    {
      fr: "Comparaison de votre produit au concurrent...",
      es: "Comparando tu producto con el competidor...",
      zh: "正在比较你的产品与竞争对手...",
      de: "Dein Produkt wird mit dem Wettbewerber verglichen...",
      hi: "आपके उत्पाद और प्रतिस्पर्धी की तुलना हो रही है..."
    }
  ],
  [
    "Compare Your Product vs Competitor",
    {
      fr: "Comparer votre produit au concurrent",
      es: "Comparar tu producto con el competidor",
      zh: "比较你的产品与竞争对手",
      de: "Dein Produkt mit Wettbewerber vergleichen",
      hi: "अपने उत्पाद और प्रतिस्पर्धी की तुलना करें"
    }
  ],
  [
    "Seller Battle Verdict",
    {
      fr: "Verdict de bataille vendeur",
      es: "Veredicto de batalla del vendedor",
      zh: "卖家对战判断",
      de: "Seller-Duell-Urteil",
      hi: "विक्रेता मुकाबला निर्णय"
    }
  ],
  [
    "Refund risk comparison:",
    {
      fr: "Comparaison du risque de remboursement :",
      es: "Comparación de riesgo de reembolso:",
      zh: "退款风险对比：",
      de: "Vergleich des Rückerstattungsrisikos:",
      hi: "रिफंड जोखिम तुलना:"
    }
  ],
  [
    "Your Product",
    {
      fr: "Votre produit",
      es: "Tu producto",
      zh: "你的产品",
      de: "Dein Produkt",
      hi: "आपका उत्पाद"
    }
  ],
  [
    "Competitor",
    {
      fr: "Concurrent",
      es: "Competidor",
      zh: "竞争对手",
      de: "Wettbewerber",
      hi: "प्रतिस्पर्धी"
    }
  ],
  [
    "Where you are losing",
    {
      fr: "Où vous perdez",
      es: "Dónde estás perdiendo",
      zh: "你的劣势在哪里",
      de: "Wo du verlierst",
      hi: "आप कहाँ पीछे हैं"
    }
  ],
  [
    "Your biggest repeated complaints will appear here.",
    {
      fr: "Vos plus grandes plaintes répétées apparaîtront ici.",
      es: "Tus mayores quejas repetidas aparecerán aquí.",
      zh: "你最大的重复投诉会显示在这里。",
      de: "Deine größten wiederholten Beschwerden erscheinen hier.",
      hi: "आपकी सबसे बड़ी दोहराई गई शिकायतें यहाँ दिखेंगी।"
    }
  ],
  [
    "Why the competitor may win",
    {
      fr: "Pourquoi le concurrent peut gagner",
      es: "Por qué puede ganar el competidor",
      zh: "竞争对手为何可能胜出",
      de: "Warum der Wettbewerber gewinnen kann",
      hi: "प्रतिस्पर्धी क्यों जीत सकता है"
    }
  ],
  [
    "Competitor strengths from review evidence will appear here.",
    {
      fr: "Les forces du concurrent issues des avis apparaîtront ici.",
      es: "Las fortalezas del competidor según reseñas aparecerán aquí.",
      zh: "来自评论证据的竞争对手优势会显示在这里。",
      de: "Wettbewerberstärken aus Bewertungsbelegen erscheinen hier.",
      hi: "समीक्षा प्रमाण से प्रतिस्पर्धी की खूबियाँ यहाँ दिखेंगी।"
    }
  ],
  [
    "What to fix first",
    {
      fr: "Que corriger d'abord",
      es: "Qué corregir primero",
      zh: "优先修复什么",
      de: "Was zuerst beheben",
      hi: "पहले क्या ठीक करें"
    }
  ],
  [
    "Highest-priority fixes will appear here.",
    {
      fr: "Les corrections prioritaires apparaîtront ici.",
      es: "Las correcciones de mayor prioridad aparecerán aquí.",
      zh: "最高优先级修复会显示在这里。",
      de: "Die wichtigsten Fixes erscheinen hier.",
      hi: "सबसे प्राथमिक सुधार यहाँ दिखेंगे।"
    }
  ],
  [
    "Product fixes",
    {
      fr: "Corrections produit",
      es: "Mejoras del producto",
      zh: "产品修复",
      de: "Produktfixes",
      hi: "उत्पाद सुधार"
    }
  ],
  [
    "Actual product improvement ideas will appear here.",
    {
      fr: "Les vraies idées d'amélioration produit apparaîtront ici.",
      es: "Aquí aparecerán ideas reales de mejora del producto.",
      zh: "实际产品改进想法会显示在这里。",
      de: "Konkrete Produktverbesserungsideen erscheinen hier.",
      hi: "वास्तविक उत्पाद सुधार विचार यहाँ दिखेंगे।"
    }
  ],
  [
    "Listing fixes",
    {
      fr: "Corrections de fiche",
      es: "Mejoras del listado",
      zh: "Listing 修复",
      de: "Listing-Fixes",
      hi: "लिस्टिंग सुधार"
    }
  ],
  [
    "Listing changes to reduce buyer confusion will appear here.",
    {
      fr: "Les changements de fiche pour réduire la confusion acheteur apparaîtront ici.",
      es: "Los cambios del listado para reducir confusión aparecerán aquí.",
      zh: "减少买家困惑的 Listing 更改会显示在这里。",
      de: "Listing-Änderungen gegen Käuferverwirrung erscheinen hier.",
      hi: "खरीदार भ्रम कम करने वाले लिस्टिंग बदलाव यहाँ दिखेंगे।"
    }
  ],
  [
    "Ad angles based on your product strengths will appear here.",
    {
      fr: "Les angles publicitaires basés sur vos forces produit apparaîtront ici.",
      es: "Aquí aparecerán ángulos de anuncios basados en fortalezas del producto.",
      zh: "基于产品优势的广告角度会显示在这里。",
      de: "Werbeansätze auf Basis deiner Produktstärken erscheinen hier.",
      hi: "आपके उत्पाद की खूबियों पर आधारित विज्ञापन कोण यहाँ दिखेंगे।"
    }
  ],
  [
    "No file selected",
    {
      fr: "Aucun fichier sélectionné",
      es: "Ningún archivo seleccionado",
      zh: "未选择文件",
      de: "Keine Datei ausgewählt",
      hi: "कोई फ़ाइल चयनित नहीं"
    }
  ],
  [
    "Health",
    {
      fr: "Santé",
      es: "Salud",
      zh: "健康度",
      de: "Gesundheit",
      hi: "स्वास्थ्य"
    }
  ],
  [
    "Satisfaction",
    {
      fr: "Satisfaction",
      es: "Satisfacción",
      zh: "满意度",
      de: "Zufriedenheit",
      hi: "संतुष्टि"
    }
  ],
  [
    "Refund Risk",
    {
      fr: "Risque de remboursement",
      es: "Riesgo de reembolso",
      zh: "退款风险",
      de: "Rückerstattungsrisiko",
      hi: "रिफंड जोखिम"
    }
  ],
  [
    "Upload CSV to generate seller review analysis.",
    {
      fr: "Importez un CSV pour générer l'analyse vendeur.",
      es: "Sube un CSV para generar el análisis del vendedor.",
      zh: "上传 CSV 以生成卖家评论分析。",
      de: "Lade eine CSV hoch, um die Seller-Analyse zu erstellen.",
      hi: "विक्रेता समीक्षा विश्लेषण बनाने के लिए CSV अपलोड करें।"
    }
  ],
  [
    "Seller dashboard",
    {
      fr: "Tableau de bord vendeur",
      es: "Panel del vendedor",
      zh: "卖家控制面板",
      de: "Seller-Dashboard",
      hi: "विक्रेता डैशबोर्ड"
    }
  ],
  [
    "Seller Pro tools include competitor compare and advanced improvement tracking.",
    {
      fr: "Les outils Seller Pro incluent la comparaison concurrentielle et le suivi avancé des améliorations.",
      es: "Las herramientas Seller Pro incluyen comparación con competidores y seguimiento avanzado de mejoras.",
      zh: "Seller Pro 工具包含竞争对手对比和高级改进跟踪。",
      de: "Seller-Pro-Tools enthalten Wettbewerbervergleich und erweitertes Verbesserungs-Tracking.",
      hi: "Seller Pro टूल में प्रतिस्पर्धी तुलना और उन्नत सुधार ट्रैकिंग शामिल है।"
    }
  ],
  [
    "Seller Premium includes seller analysis, reports, and improvement planning.",
    {
      fr: "Seller Premium inclut l'analyse vendeur, les rapports et la planification des améliorations.",
      es: "Seller Premium incluye análisis del vendedor, informes y planificación de mejoras.",
      zh: "Seller Premium 包含卖家分析、报告和改进计划。",
      de: "Seller Premium umfasst Seller-Analyse, Berichte und Verbesserungsplanung.",
      hi: "Seller Premium में विक्रेता विश्लेषण, रिपोर्ट और सुधार योजना शामिल हैं।"
    }
  ],
  [
    "Unnamed product",
    {
      fr: "Produit sans nom",
      es: "Producto sin nombre",
      zh: "未命名产品",
      de: "Unbenanntes Produkt",
      hi: "बिना नाम वाला उत्पाद"
    }
  ],
  [
    "No clear concern detected",
    {
      fr: "Aucune préoccupation claire détectée",
      es: "No se detectó una preocupación clara",
      zh: "未检测到明确问题",
      de: "Kein klares Problem erkannt",
      hi: "कोई स्पष्ट चिंता नहीं मिली"
    }
  ],
  [
    "No strong positive signal yet",
    {
      fr: "Aucun signal positif fort pour l'instant",
      es: "Aún no hay una señal positiva fuerte",
      zh: "尚无强烈正面信号",
      de: "Noch kein starkes positives Signal",
      hi: "अभी कोई मजबूत सकारात्मक संकेत नहीं"
    }
  ],
  [
    "Run another scan to confirm the next improvement",
    {
      fr: "Lancez une autre analyse pour confirmer la prochaine amélioration",
      es: "Ejecuta otro análisis para confirmar la próxima mejora",
      zh: "再运行一次扫描以确认下一项改进",
      de: "Führe einen weiteren Scan aus, um die nächste Verbesserung zu bestätigen",
      hi: "अगला सुधार पुष्टि करने के लिए दूसरा स्कैन चलाएँ"
    }
  ],
  [
    "A clean view of your saved seller scans, product scores, buyer concerns, and next improvement moves.",
    {
      fr: "Une vue claire de vos analyses vendeur enregistrées, scores produit, préoccupations acheteurs et prochaines améliorations.",
      es: "Una vista clara de análisis guardados, puntuaciones, preocupaciones de compradores y próximos pasos de mejora.",
      zh: "清晰查看保存的卖家扫描、产品评分、买家担忧和下一步改进动作。",
      de: "Eine klare Ansicht gespeicherter Seller-Scans, Produktwerte, Käuferbedenken und nächster Verbesserungen.",
      hi: "सहेजे विक्रेता स्कैन, उत्पाद स्कोर, खरीदार चिंताओं और अगले सुधार कदमों का साफ दृश्य।"
    }
  ],
  [
    "Run a seller analysis to start building your seller intelligence dashboard.",
    {
      fr: "Lancez une analyse vendeur pour commencer à créer votre tableau d'intelligence vendeur.",
      es: "Ejecuta un análisis del vendedor para empezar a construir tu panel de inteligencia.",
      zh: "运行卖家分析，开始构建卖家智能控制面板。",
      de: "Starte eine Seller-Analyse, um dein Seller-Intelligence-Dashboard aufzubauen.",
      hi: "विक्रेता इंटेलिजेंस डैशबोर्ड बनाने के लिए विक्रेता विश्लेषण चलाएँ।"
    }
  ],
  [
    "Products tracked",
    {
      fr: "Produits suivis",
      es: "Productos seguidos",
      zh: "跟踪的产品",
      de: "Verfolgte Produkte",
      hi: "ट्रैक किए गए उत्पाद"
    }
  ],
  [
    "Scans this month",
    {
      fr: "Analyses ce mois-ci",
      es: "Análisis este mes",
      zh: "本月扫描",
      de: "Scans diesen Monat",
      hi: "इस महीने के स्कैन"
    }
  ],
  [
    "Avg product score",
    {
      fr: "Score produit moyen",
      es: "Puntuación promedio del producto",
      zh: "平均产品评分",
      de: "Durchschnittlicher Produktwert",
      hi: "औसत उत्पाद स्कोर"
    }
  ],
  [
    "Improvement focus",
    {
      fr: "Priorité d'amélioration",
      es: "Enfoque de mejora",
      zh: "改进重点",
      de: "Verbesserungsfokus",
      hi: "सुधार फोकस"
    }
  ],
  [
    "Pain points",
    {
      fr: "Points de douleur",
      es: "Puntos de dolor",
      zh: "痛点",
      de: "Schmerzpunkte",
      hi: "दर्द बिंदु"
    }
  ],
  [
    "Feature requests",
    {
      fr: "Demandes de fonctionnalités",
      es: "Solicitudes de funciones",
      zh: "功能需求",
      de: "Funktionswünsche",
      hi: "फीचर अनुरोध"
    }
  ],
  [
    "Reviews tracked",
    {
      fr: "Avis suivis",
      es: "Reseñas seguidas",
      zh: "跟踪的评论",
      de: "Verfolgte Bewertungen",
      hi: "ट्रैक की गई समीक्षाएँ"
    }
  ],
  [
    "Seller recommendations",
    {
      fr: "Recommandations vendeur",
      es: "Recomendaciones del vendedor",
      zh: "卖家建议",
      de: "Seller-Empfehlungen",
      hi: "विक्रेता सुझाव"
    }
  ],
  [
    "No seller scan data yet.",
    {
      fr: "Aucune donnée d'analyse vendeur pour l'instant.",
      es: "Aún no hay datos de análisis del vendedor.",
      zh: "尚无卖家扫描数据。",
      de: "Noch keine Seller-Scandaten.",
      hi: "अभी कोई विक्रेता स्कैन डेटा नहीं।"
    }
  ],
  [
    "Run a seller analysis to generate complaint clusters, feature requests, keyword intelligence, and improvement priorities.",
    {
      fr: "Lancez une analyse vendeur pour générer groupes de plaintes, demandes de fonctionnalités, intelligence mots-clés et priorités.",
      es: "Ejecuta un análisis para generar grupos de quejas, solicitudes de funciones, inteligencia de palabras clave y prioridades.",
      zh: "运行卖家分析以生成投诉集群、功能需求、关键词智能和改进优先级。",
      de: "Starte eine Seller-Analyse für Beschwerdecluster, Funktionswünsche, Keyword-Intelligence und Prioritäten.",
      hi: "शिकायत समूह, फीचर अनुरोध, कीवर्ड इंटेलिजेंस और सुधार प्राथमिकताएँ बनाने के लिए विक्रेता विश्लेषण चलाएँ।"
    }
  ],
  [
    "Positive signals",
    {
      fr: "Signaux positifs",
      es: "Señales positivas",
      zh: "正面信号",
      de: "Positive Signale",
      hi: "सकारात्मक संकेत"
    }
  ],
  [
    "Product score",
    {
      fr: "Score produit",
      es: "Puntuación del producto",
      zh: "产品评分",
      de: "Produktwert",
      hi: "उत्पाद स्कोर"
    }
  ],
  [
    "Top pain points",
    {
      fr: "Principaux points de douleur",
      es: "Principales puntos de dolor",
      zh: "主要痛点",
      de: "Wichtigste Schmerzpunkte",
      hi: "मुख्य दर्द बिंदु"
    }
  ],
  [
    "Positive buyer signals",
    {
      fr: "Signaux positifs des acheteurs",
      es: "Señales positivas de compradores",
      zh: "正面买家信号",
      de: "Positive Käufersignale",
      hi: "सकारात्मक खरीदार संकेत"
    }
  ],
  [
    "Feature and listing opportunities",
    {
      fr: "Opportunités produit et fiche",
      es: "Oportunidades de funciones y listado",
      zh: "功能和 Listing 机会",
      de: "Funktions- und Listing-Chancen",
      hi: "फीचर और लिस्टिंग अवसर"
    }
  ],
  [
    "No main complaint recorded",
    {
      fr: "Aucune plainte principale enregistrée",
      es: "No hay queja principal registrada",
      zh: "未记录主要投诉",
      de: "Keine Hauptbeschwerde erfasst",
      hi: "कोई मुख्य शिकायत दर्ज नहीं"
    }
  ],
  [
    "Tracked Products",
    {
      fr: "Produits suivis",
      es: "Productos seguidos",
      zh: "跟踪产品",
      de: "Verfolgte Produkte",
      hi: "ट्रैक किए उत्पाद"
    }
  ],
  [
    "Simple product tracking. See what needs fixing first.",
    {
      fr: "Suivi produit simple. Voyez quoi corriger en premier.",
      es: "Seguimiento simple de productos. Mira qué corregir primero.",
      zh: "简单产品跟踪。查看应优先修复什么。",
      de: "Einfaches Produkttracking. Sieh, was zuerst behoben werden muss.",
      hi: "सरल उत्पाद ट्रैकिंग। देखें पहले क्या ठीक करना है।"
    }
  ],
  [
    "Your Tracked Products.",
    {
      fr: "Vos produits suivis.",
      es: "Tus productos seguidos.",
      zh: "你跟踪的产品。",
      de: "Deine verfolgten Produkte.",
      hi: "आपके ट्रैक किए उत्पाद।"
    }
  ],
  [
    "Fix-first products appear first",
    {
      fr: "Les produits à corriger d'abord apparaissent en premier",
      es: "Los productos a corregir primero aparecen primero",
      zh: "优先修复的产品会排在前面",
      de: "Fix-first-Produkte erscheinen zuerst",
      hi: "पहले ठीक करने वाले उत्पाद पहले दिखेंगे"
    }
  ],
  [
    "Problem:",
    {
      fr: "Problème :",
      es: "Problema:",
      zh: "问题：",
      de: "Problem:",
      hi: "समस्या:"
    }
  ],
  [
    "Good sign:",
    {
      fr: "Bon signe :",
      es: "Buena señal:",
      zh: "好信号：",
      de: "Gutes Signal:",
      hi: "अच्छा संकेत:"
    }
  ],
  [
    "Do this:",
    {
      fr: "À faire :",
      es: "Haz esto:",
      zh: "这样做：",
      de: "Das tun:",
      hi: "यह करें:"
    }
  ],
  [
    "No products yet.",
    {
      fr: "Aucun produit pour l'instant.",
      es: "Aún no hay productos.",
      zh: "还没有产品。",
      de: "Noch keine Produkte.",
      hi: "अभी कोई उत्पाद नहीं।"
    }
  ],
  [
    "Small sample",
    {
      fr: "Petit échantillon",
      es: "Muestra pequeña",
      zh: "样本较小",
      de: "Kleine Stichprobe",
      hi: "छोटा नमूना"
    }
  ],
  [
    "Low signal",
    {
      fr: "Signal faible",
      es: "Señal baja",
      zh: "信号较弱",
      de: "Schwaches Signal",
      hi: "कम संकेत"
    }
  ],
  [
    "Business proof",
    {
      fr: "Preuve commerciale",
      es: "Prueba comercial",
      zh: "业务证明",
      de: "Geschäftsbeleg",
      hi: "व्यावसायिक प्रमाण"
    }
  ],
  [
    "Meaning:",
    {
      fr: "Sens :",
      es: "Significado:",
      zh: "含义：",
      de: "Bedeutung:",
      hi: "अर्थ:"
    }
  ],
  [
    "Action:",
    {
      fr: "Action :",
      es: "Acción:",
      zh: "行动：",
      de: "Aktion:",
      hi: "कार्य:"
    }
  ],
  [
    "Impact:",
    {
      fr: "Impact :",
      es: "Impacto:",
      zh: "影响：",
      de: "Auswirkung:",
      hi: "प्रभाव:"
    }
  ],
  [
    "Seller money intelligence",
    {
      fr: "Intelligence revenu vendeur",
      es: "Inteligencia de ingresos del vendedor",
      zh: "卖家收益智能",
      de: "Seller-Umsatzintelligenz",
      hi: "विक्रेता राजस्व इंटेलिजेंस"
    }
  ],
  [
    "What review patterns mean for sales",
    {
      fr: "Ce que les tendances d'avis signifient pour les ventes",
      es: "Qué significan los patrones de reseñas para ventas",
      zh: "评论模式对销售的含义",
      de: "Was Bewertungsmuster für Verkäufe bedeuten",
      hi: "समीक्षा पैटर्न बिक्री के लिए क्या मतलब रखते हैं"
    }
  ],
  [
    "What may be costing sales:",
    {
      fr: "Ce qui peut coûter des ventes :",
      es: "Lo que puede estar costando ventas:",
      zh: "可能影响销售的因素：",
      de: "Was Verkäufe kosten könnte:",
      hi: "जो बिक्री घटा सकता है:"
    }
  ],
  [
    "What to highlight more:",
    {
      fr: "À mettre davantage en avant :",
      es: "Qué destacar más:",
      zh: "需要更多强调的内容：",
      de: "Was stärker hervorheben:",
      hi: "क्या अधिक दिखाएँ:"
    }
  ],
  [
    "What to answer before checkout:",
    {
      fr: "À clarifier avant le paiement :",
      es: "Qué responder antes del pago:",
      zh: "结账前需要回答的问题：",
      de: "Was vor dem Checkout zu beantworten ist:",
      hi: "चेकआउट से पहले क्या जवाब दें:"
    }
  ],
  [
    "Can I trust this?",
    {
      fr: "Puis-je faire confiance ?",
      es: "¿Puedo confiar en esto?",
      zh: "我可以信任它吗？",
      de: "Kann ich dem vertrauen?",
      hi: "क्या मैं इस पर भरोसा कर सकता हूँ?"
    }
  ],
  [
    "Will it last?",
    {
      fr: "Est-ce durable ?",
      es: "¿Durará?",
      zh: "它耐用吗？",
      de: "Hält es lange?",
      hi: "क्या यह टिकेगा?"
    }
  ],
  [
    "Is it worth the price?",
    {
      fr: "Est-ce que le prix vaut le coup ?",
      es: "¿Vale el precio?",
      zh: "值这个价吗？",
      de: "Ist es den Preis wert?",
      hi: "क्या यह कीमत के लायक है?"
    }
  ],
  [
    "Will the seller help me?",
    {
      fr: "Le vendeur m'aidera-t-il ?",
      es: "¿Me ayudará el vendedor?",
      zh: "卖家会帮助我吗？",
      de: "Wird der Verkäufer helfen?",
      hi: "क्या विक्रेता मेरी मदद करेगा?"
    }
  ],
  [
    "Seller Pro calendar",
    {
      fr: "Calendrier Seller Pro",
      es: "Calendario Seller Pro",
      zh: "Seller Pro 日历",
      de: "Seller-Pro-Kalender",
      hi: "Seller Pro कैलेंडर"
    }
  ],
  [
    "Open planning day",
    {
      fr: "Ouvrir le jour de planification",
      es: "Abrir día de planificación",
      zh: "打开计划日期",
      de: "Planungstag öffnen",
      hi: "योजना दिन खोलें"
    }
  ],
  [
    "A clean daily view of product scores, buyer concerns, and the next seller move.",
    {
      fr: "Une vue quotidienne claire des scores produit, préoccupations acheteurs et prochaine action vendeur.",
      es: "Una vista diaria clara de puntuaciones, preocupaciones y próximo movimiento del vendedor.",
      zh: "按日清晰查看产品评分、买家担忧和下一步卖家动作。",
      de: "Eine klare Tagesansicht von Produktwerten, Käuferbedenken und nächstem Seller-Schritt.",
      hi: "उत्पाद स्कोर, खरीदार चिंताओं और अगले विक्रेता कदम का साफ दैनिक दृश्य।"
    }
  ],
  [
    "Run a scan",
    {
      fr: "Lancer une analyse",
      es: "Ejecutar análisis",
      zh: "运行扫描",
      de: "Scan starten",
      hi: "स्कैन चलाएँ"
    }
  ],
  [
    "Buyer hesitation points",
    {
      fr: "Points d'hésitation acheteur",
      es: "Puntos de duda del comprador",
      zh: "买家犹豫点",
      de: "Käufer-Zögerpunkte",
      hi: "खरीदार झिझक बिंदु"
    }
  ],
  [
    "What buyers liked",
    {
      fr: "Ce que les acheteurs ont aimé",
      es: "Lo que gustó a los compradores",
      zh: "买家喜欢的地方",
      de: "Was Käufer mochten",
      hi: "खरीदारों को क्या पसंद आया"
    }
  ],
  [
    "No clear signal saved yet.",
    {
      fr: "Aucun signal clair enregistré pour l'instant.",
      es: "Aún no hay señal clara guardada.",
      zh: "尚未保存明确信号。",
      de: "Noch kein klares Signal gespeichert.",
      hi: "अभी कोई स्पष्ट संकेत सहेजा नहीं गया।"
    }
  ],
  [
    "Rating overview",
    {
      fr: "Aperçu des notes",
      es: "Resumen de calificaciones",
      zh: "评分概览",
      de: "Bewertungsübersicht",
      hi: "रेटिंग अवलोकन"
    }
  ],
  [
    "Main complaint",
    {
      fr: "Plainte principale",
      es: "Queja principal",
      zh: "主要投诉",
      de: "Hauptbeschwerde",
      hi: "मुख्य शिकायत"
    }
  ],
  [
    "Before/after",
    {
      fr: "Avant/après",
      es: "Antes/después",
      zh: "前后对比",
      de: "Vorher/nachher",
      hi: "पहले/बाद"
    }
  ],
  [
    "Products reviewed today",
    {
      fr: "Produits analysés aujourd'hui",
      es: "Productos revisados hoy",
      zh: "今天查看的产品",
      de: "Heute geprüfte Produkte",
      hi: "आज समीक्षा किए उत्पाद"
    }
  ],
  [
    "Product score by item",
    {
      fr: "Score produit par article",
      es: "Puntuación por producto",
      zh: "按项目的产品评分",
      de: "Produktwert pro Artikel",
      hi: "आइटम अनुसार उत्पाद स्कोर"
    }
  ],
  [
    "No products scanned on this date.",
    {
      fr: "Aucun produit analysé à cette date.",
      es: "No se analizaron productos en esta fecha.",
      zh: "此日期没有扫描产品。",
      de: "An diesem Datum wurden keine Produkte gescannt.",
      hi: "इस तारीख पर कोई उत्पाद स्कैन नहीं हुआ।"
    }
  ],
  [
    "Next best seller moves",
    {
      fr: "Meilleures prochaines actions vendeur",
      es: "Próximos mejores movimientos del vendedor",
      zh: "下一步最佳卖家动作",
      de: "Nächste beste Seller-Schritte",
      hi: "अगले सर्वोत्तम विक्रेता कदम"
    }
  ],
  [
    "Progress note/comment for this day",
    {
      fr: "Note/commentaire de progression pour ce jour",
      es: "Nota/comentario de progreso para este día",
      zh: "当天进度备注/评论",
      de: "Fortschrittsnotiz/Kommentar für diesen Tag",
      hi: "इस दिन के लिए प्रगति नोट/टिप्पणी"
    }
  ],
  [
    "Seller Pro Product Health Tracker",
    {
      fr: "Suivi santé produit Seller Pro",
      es: "Seguimiento de salud de producto Seller Pro",
      zh: "Seller Pro 产品健康追踪器",
      de: "Seller-Pro-Produktgesundheits-Tracker",
      hi: "Seller Pro उत्पाद स्वास्थ्य ट्रैकर"
    }
  ],
  [
    "Products, scans, and progress in one command view.",
    {
      fr: "Produits, analyses et progrès dans une seule vue de commande.",
      es: "Productos, análisis y progreso en una sola vista de control.",
      zh: "在一个控制视图中查看产品、扫描和进度。",
      de: "Produkte, Scans und Fortschritt in einer Steueransicht.",
      hi: "उत्पाद, स्कैन और प्रगति एक नियंत्रण दृश्य में।"
    }
  ],
  [
    "Add product",
    {
      fr: "Ajouter un produit",
      es: "Agregar producto",
      zh: "添加产品",
      de: "Produkt hinzufügen",
      hi: "उत्पाद जोड़ें"
    }
  ],
  [
    "No products yet. Add your first product, then attach the next Seller analysis to it.",
    {
      fr: "Aucun produit pour l'instant. Ajoutez votre premier produit, puis attachez-y la prochaine analyse vendeur.",
      es: "Aún no hay productos. Agrega el primero y adjunta el próximo análisis del vendedor.",
      zh: "还没有产品。添加第一个产品，然后把下一次卖家分析附加到它。",
      de: "Noch keine Produkte. Füge dein erstes Produkt hinzu und hänge die nächste Seller-Analyse daran.",
      hi: "अभी कोई उत्पाद नहीं। पहला उत्पाद जोड़ें, फिर अगला विक्रेता विश्लेषण उससे जोड़ें।"
    }
  ],
  [
    "Product Health Score",
    {
      fr: "Score santé produit",
      es: "Puntuación de salud del producto",
      zh: "产品健康评分",
      de: "Produktgesundheitswert",
      hi: "उत्पाद स्वास्थ्य स्कोर"
    }
  ],
  [
    "Complaint Severity",
    {
      fr: "Gravité des plaintes",
      es: "Severidad de quejas",
      zh: "投诉严重度",
      de: "Beschwerdeschwere",
      hi: "शिकायत गंभीरता"
    }
  ],
  [
    "Review trend",
    {
      fr: "Tendance des avis",
      es: "Tendencia de reseñas",
      zh: "评论趋势",
      de: "Bewertungstrend",
      hi: "समीक्षा रुझान"
    }
  ],
  [
    "Positive Review Trend",
    {
      fr: "Tendance positive des avis",
      es: "Tendencia positiva de reseñas",
      zh: "正面评论趋势",
      de: "Positiver Bewertungstrend",
      hi: "सकारात्मक समीक्षा रुझान"
    }
  ],
  [
    "Negative Review Trend",
    {
      fr: "Tendance négative des avis",
      es: "Tendencia negativa de reseñas",
      zh: "负面评论趋势",
      de: "Negativer Bewertungstrend",
      hi: "नकारात्मक समीक्षा रुझान"
    }
  ],
  [
    "Product notes",
    {
      fr: "Notes produit",
      es: "Notas del producto",
      zh: "产品备注",
      de: "Produktnotizen",
      hi: "उत्पाद नोट्स"
    }
  ],
  [
    "Calendar Progress Tracker",
    {
      fr: "Suivi de progression calendrier",
      es: "Seguimiento de progreso del calendario",
      zh: "日历进度追踪器",
      de: "Kalender-Fortschrittstracker",
      hi: "कैलेंडर प्रगति ट्रैकर"
    }
  ],
  [
    "Review Scan History",
    {
      fr: "Historique des analyses d'avis",
      es: "Historial de análisis de reseñas",
      zh: "评论扫描历史",
      de: "Bewertungsscan-Verlauf",
      hi: "समीक्षा स्कैन इतिहास"
    }
  ],
  [
    "No scan history yet. Select this product on the Analyze page before running a Seller scan.",
    {
      fr: "Aucun historique pour l'instant. Sélectionnez ce produit sur la page Analyse avant de lancer une analyse vendeur.",
      es: "Aún no hay historial. Selecciona este producto en Analizar antes de ejecutar un análisis del vendedor.",
      zh: "尚无扫描历史。运行卖家扫描前，请在分析页选择此产品。",
      de: "Noch kein Scanverlauf. Wähle dieses Produkt auf der Analyse-Seite aus, bevor du einen Seller-Scan startest.",
      hi: "अभी कोई स्कैन इतिहास नहीं। Seller स्कैन चलाने से पहले Analyze पेज पर यह उत्पाद चुनें।"
    }
  ],
  [
    "Keeps 10 tests per week. Older than 30 days auto-clears.",
    {
      fr: "Garde 10 tests par semaine. Les éléments de plus de 30 jours s'effacent automatiquement.",
      es: "Guarda 10 pruebas por semana. Las de más de 30 días se borran automáticamente.",
      zh: "每周保留 10 次测试。超过 30 天自动清除。",
      de: "Speichert 10 Tests pro Woche. Älter als 30 Tage wird automatisch gelöscht.",
      hi: "हर सप्ताह 10 टेस्ट रखता है। 30 दिन से पुराने अपने-आप हटते हैं।"
    }
  ],
  [
    "Avoid product",
    {
      fr: "Produit à éviter",
      es: "Producto a evitar",
      zh: "应避免的产品",
      de: "Produkt vermeiden",
      hi: "बचने वाला उत्पाद"
    }
  ],
  [
    "Products with warning signs",
    {
      fr: "Produits avec signaux d'alerte",
      es: "Productos con señales de alerta",
      zh: "带警示信号的产品",
      de: "Produkte mit Warnsignalen",
      hi: "चेतावनी संकेतों वाले उत्पाद"
    }
  ],
  [
    "No date",
    {
      fr: "Aucune date",
      es: "Sin fecha",
      zh: "无日期",
      de: "Kein Datum",
      hi: "कोई तारीख नहीं"
    }
  ],
  [
    "Clear all seller scan history from this browser? This cannot be undone.",
    {
      fr: "Effacer tout l'historique des analyses vendeur de ce navigateur ? Cette action est irréversible.",
      es: "¿Borrar todo el historial de análisis del vendedor de este navegador? No se puede deshacer.",
      zh: "清除此浏览器中的所有卖家扫描历史？此操作无法撤销。",
      de: "Alle Seller-Scanverläufe aus diesem Browser löschen? Dies kann nicht rückgängig gemacht werden.",
      hi: "इस ब्राउज़र से सभी विक्रेता स्कैन इतिहास साफ़ करें? इसे वापस नहीं किया जा सकता।"
    }
  ],
  [
    "Unique complaint themes found from saved scans.",
    {
      fr: "Thèmes de plaintes uniques trouvés dans les analyses enregistrées.",
      es: "Temas únicos de quejas encontrados en análisis guardados.",
      zh: "从保存的扫描中发现的独立投诉主题。",
      de: "Einzigartige Beschwerdethemen aus gespeicherten Scans.",
      hi: "सहेजे स्कैन से मिले अनोखे शिकायत विषय।"
    }
  ],
  [
    "Real complaint clusters will appear here.",
    {
      fr: "Les vrais groupes de plaintes apparaîtront ici.",
      es: "Aquí aparecerán grupos reales de quejas.",
      zh: "真实投诉集群会显示在这里。",
      de: "Echte Beschwerdecluster erscheinen hier.",
      hi: "वास्तविक शिकायत समूह यहाँ दिखेंगे।"
    }
  ],
  [
    "Improvement opportunities detected from reviews.",
    {
      fr: "Opportunités d'amélioration détectées dans les avis.",
      es: "Oportunidades de mejora detectadas en reseñas.",
      zh: "从评论中检测到的改进机会。",
      de: "Aus Bewertungen erkannte Verbesserungsmöglichkeiten.",
      hi: "समीक्षाओं से मिले सुधार अवसर।"
    }
  ],
  [
    "Customer-requested improvements appear after scans.",
    {
      fr: "Les améliorations demandées par les clients apparaissent après les analyses.",
      es: "Las mejoras pedidas por clientes aparecen después de los análisis.",
      zh: "客户要求的改进会在扫描后显示。",
      de: "Von Kunden gewünschte Verbesserungen erscheinen nach Scans.",
      hi: "ग्राहक द्वारा मांगे सुधार स्कैन के बाद दिखेंगे।"
    }
  ],
  [
    "Average sentiment from saved seller scans.",
    {
      fr: "Sentiment moyen des analyses vendeur enregistrées.",
      es: "Sentimiento promedio de análisis guardados del vendedor.",
      zh: "保存的卖家扫描平均情绪。",
      de: "Durchschnittliche Stimmung aus gespeicherten Seller-Scans.",
      hi: "सहेजे विक्रेता स्कैन से औसत भावना।"
    }
  ],
  [
    "Calculated after real seller scans.",
    {
      fr: "Calculé après de vraies analyses vendeur.",
      es: "Calculado después de análisis reales del vendedor.",
      zh: "真实卖家扫描后计算。",
      de: "Nach echten Seller-Scans berechnet.",
      hi: "वास्तविक विक्रेता स्कैन के बाद गणना।"
    }
  ],
  [
    "Estimated reviews included across saved scans.",
    {
      fr: "Avis estimés inclus dans les analyses enregistrées.",
      es: "Reseñas estimadas incluidas en análisis guardados.",
      zh: "保存扫描中包含的估算评论数。",
      de: "Geschätzte Bewertungen in gespeicherten Scans.",
      hi: "सहेजे स्कैन में शामिल अनुमानित समीक्षाएँ।"
    }
  ],
  [
    "Review volume appears after scans.",
    {
      fr: "Le volume d'avis apparaît après les analyses.",
      es: "El volumen de reseñas aparece después de análisis.",
      zh: "评论量会在扫描后显示。",
      de: "Bewertungsvolumen erscheint nach Scans.",
      hi: "समीक्षा मात्रा स्कैन के बाद दिखती है।"
    }
  ],
  [
    "Saved scans exist, but no strong action cluster was detected yet.",
    {
      fr: "Des analyses sont enregistrées, mais aucun groupe d'action fort n'a encore été détecté.",
      es: "Hay análisis guardados, pero aún no se detectó un grupo de acción fuerte.",
      zh: "已有保存扫描，但尚未检测到强行动集群。",
      de: "Gespeicherte Scans sind vorhanden, aber noch kein starkes Aktionscluster erkannt.",
      hi: "सहेजे स्कैन मौजूद हैं, पर अभी मजबूत कार्रवाई समूह नहीं मिला।"
    }
  ],
  [
    "Seller Pro calendar entries should come from saved real scan summaries.",
    {
      fr: "Les entrées du calendrier Seller Pro doivent venir de vrais résumés d'analyses enregistrées.",
      es: "Las entradas del calendario Seller Pro deben venir de resúmenes reales guardados.",
      zh: "Seller Pro 日历条目应来自保存的真实扫描摘要。",
      de: "Seller-Pro-Kalendereinträge sollten aus gespeicherten echten Scan-Zusammenfassungen stammen.",
      hi: "Seller Pro कैलेंडर प्रविष्टियाँ सहेजे वास्तविक स्कैन सारांश से आनी चाहिए।"
    }
  ],
  [
    "Saved scan",
    {
      fr: "Analyse enregistrée",
      es: "Análisis guardado",
      zh: "已保存扫描",
      de: "Gespeicherter Scan",
      hi: "सहेजा स्कैन"
    }
  ],
  [
    "Saved product scan",
    {
      fr: "Analyse produit enregistrée",
      es: "Análisis de producto guardado",
      zh: "已保存产品扫描",
      de: "Gespeicherter Produktscan",
      hi: "सहेजा उत्पाद स्कैन"
    }
  ],
  [
    "No major buying concern stood out in this scan.",
    {
      fr: "Aucune préoccupation d'achat majeure ne s'est démarquée dans cette analyse.",
      es: "No destacó ninguna preocupación importante de compra en este análisis.",
      zh: "本次扫描未发现突出的重大购买担忧。",
      de: "In diesem Scan fiel kein großes Kaufproblem auf.",
      hi: "इस स्कैन में कोई बड़ी खरीद चिंता अलग से नहीं दिखी।"
    }
  ],
  [
    "No major buying concern stood out in this scan",
    {
      fr: "Aucune préoccupation d'achat majeure ne s'est démarquée dans cette analyse",
      es: "No destacó ninguna preocupación importante de compra en este análisis",
      zh: "本次扫描未发现突出的重大购买担忧",
      de: "In diesem Scan fiel kein großes Kaufproblem auf",
      hi: "इस स्कैन में कोई बड़ी खरीद चिंता अलग से नहीं दिखी"
    }
  ],
  [
    "No repeated complaint stood out.",
    {
      fr: "Aucune plainte répétée ne s'est démarquée.",
      es: "No destacó ninguna queja repetida.",
      zh: "未发现突出的重复投诉。",
      de: "Keine wiederholte Beschwerde fiel auf.",
      hi: "कोई दोहराई गई शिकायत अलग से नहीं दिखी।"
    }
  ],
  [
    "no strong repeated complaint",
    {
      fr: "aucune plainte répétée forte",
      es: "ninguna queja repetida fuerte",
      zh: "没有强烈重复投诉",
      de: "keine starke wiederholte Beschwerde",
      hi: "कोई मजबूत दोहराई गई शिकायत नहीं"
    }
  ],
  [
    "no repeated complaint",
    {
      fr: "aucune plainte répétée",
      es: "ninguna queja repetida",
      zh: "没有重复投诉",
      de: "keine wiederholte Beschwerde",
      hi: "कोई दोहराई गई शिकायत नहीं"
    }
  ],
  [
    "No repeated complaint",
    {
      fr: "Aucune plainte répétée",
      es: "Ninguna queja repetida",
      zh: "无重复投诉",
      de: "Keine wiederholte Beschwerde",
      hi: "कोई दोहराई गई शिकायत नहीं"
    }
  ],
  [
    "Packaging concern",
    {
      fr: "Préoccupation d'emballage",
      es: "Preocupación de empaque",
      zh: "包装担忧",
      de: "Verpackungsproblem",
      hi: "पैकेजिंग चिंता"
    }
  ],
  [
    "Fit or sizing concern",
    {
      fr: "Préoccupation de taille ou compatibilité",
      es: "Preocupación de ajuste o tamaño",
      zh: "适配或尺寸担忧",
      de: "Passform- oder Größenproblem",
      hi: "फिट या आकार चिंता"
    }
  ],
  [
    "Durability concern",
    {
      fr: "Préoccupation de durabilité",
      es: "Preocupación de durabilidad",
      zh: "耐用性担忧",
      de: "Haltbarkeitsproblem",
      hi: "टिकाऊपन चिंता"
    }
  ],
  [
    "Support risk",
    {
      fr: "Risque de support",
      es: "Riesgo de soporte",
      zh: "支持风险",
      de: "Support-Risiko",
      hi: "सहायता जोखिम"
    }
  ],
  [
    "Price-value signal",
    {
      fr: "Signal prix-valeur",
      es: "Señal precio-valor",
      zh: "价格价值信号",
      de: "Preis-Wert-Signal",
      hi: "कीमत-मूल्य संकेत"
    }
  ],
  [
    "Buy only after checking the warning.",
    {
      fr: "Achetez seulement après avoir vérifié l'avertissement.",
      es: "Compra solo después de revisar la advertencia.",
      zh: "先检查警告再购买。",
      de: "Kaufe erst nach Prüfung der Warnung.",
      hi: "चेतावनी जाँचने के बाद ही खरीदें।"
    }
  ],
  [
    "Worth it for the right buyer.",
    {
      fr: "Vaut le coup pour le bon acheteur.",
      es: "Vale la pena para el comprador adecuado.",
      zh: "适合合适买家，值得购买。",
      de: "Für den passenden Käufer lohnenswert.",
      hi: "सही खरीदार के लिए सही है।"
    }
  ],
  [
    "Skip unless the issue is fixed.",
    {
      fr: "Évitez sauf si le problème est corrigé.",
      es: "Omítelo salvo que el problema esté corregido.",
      zh: "除非问题已解决，否则跳过。",
      de: "Überspringen, sofern das Problem nicht behoben ist.",
      hi: "मुद्दा ठीक न हो तो छोड़ें।"
    }
  ],
  [
    "Not enough review data for a confident read.",
    {
      fr: "Pas assez de données d'avis pour une lecture fiable.",
      es: "No hay suficientes datos de reseñas para una lectura confiada.",
      zh: "评论数据不足，无法有信心判断。",
      de: "Nicht genug Bewertungsdaten für eine sichere Einschätzung.",
      hi: "भरोसेमंद पढ़ाई के लिए पर्याप्त समीक्षा डेटा नहीं।"
    }
  ],
  [
    "Review wording needs authenticity checking before sellers use it as proof.",
    {
      fr: "Le texte des avis doit être vérifié avant que les vendeurs l'utilisent comme preuve.",
      es: "La redacción de reseñas debe verificarse antes de usarla como prueba.",
      zh: "卖家将评论文字用作证据前需要检查真实性。",
      de: "Bewertungsformulierungen müssen auf Echtheit geprüft werden, bevor Verkäufer sie als Beleg nutzen.",
      hi: "विक्रेताओं द्वारा प्रमाण के रूप में उपयोग से पहले समीक्षा शब्दों की प्रामाणिकता जाँचें।"
    }
  ],
  [
    "Specific usage details make the review set easier for buyers to trust.",
    {
      fr: "Des détails d'usage précis rendent les avis plus fiables pour les acheteurs.",
      es: "Detalles específicos de uso hacen que las reseñas sean más confiables.",
      zh: "具体使用细节让买家更容易信任评论集。",
      de: "Konkrete Nutzungsdetails machen Bewertungen vertrauenswürdiger.",
      hi: "विशिष्ट उपयोग विवरण समीक्षा सेट को खरीदारों के लिए भरोसेमंद बनाते हैं।"
    }
  ],
  [
    "Evidence quality depends on review volume, specific use cases, and balanced pros and cons.",
    {
      fr: "La qualité des preuves dépend du volume d'avis, des cas d'usage précis et d'avantages/inconvénients équilibrés.",
      es: "La calidad de evidencia depende del volumen, casos de uso específicos y pros/contras equilibrados.",
      zh: "证据质量取决于评论量、具体使用场景以及平衡的优缺点。",
      de: "Belegqualität hängt von Bewertungsmenge, konkreten Nutzungsfällen und ausgewogenen Vor- und Nachteilen ab.",
      hi: "प्रमाण गुणवत्ता समीक्षा मात्रा, विशिष्ट उपयोग और संतुलित फायदे-नुकसान पर निर्भर करती है।"
    }
  ],
  [
    "Reliability risk is expectation match: buyers need exact model, size, and compatibility proof.",
    {
      fr: "Le risque de fiabilité vient de l'adéquation aux attentes : modèle, taille et compatibilité doivent être prouvés.",
      es: "El riesgo de fiabilidad es ajuste de expectativas: se necesita prueba de modelo, tamaño y compatibilidad.",
      zh: "可靠性风险在于预期匹配：买家需要准确型号、尺寸和兼容性证明。",
      de: "Zuverlässigkeitsrisiko ist Erwartungsabgleich: Käufer brauchen Modell-, Größen- und Kompatibilitätsbelege.",
      hi: "विश्वसनीयता जोखिम अपेक्षा मेल है: खरीदारों को सही मॉडल, आकार और संगतता प्रमाण चाहिए।"
    }
  ],
  [
    "Long-term reliability should be proven with durability, defect, and after-use evidence.",
    {
      fr: "La fiabilité long terme doit être prouvée par durabilité, défauts et preuves après usage.",
      es: "La fiabilidad a largo plazo debe probarse con durabilidad, defectos y evidencia tras uso.",
      zh: "长期可靠性应通过耐用性、缺陷和使用后证据证明。",
      de: "Langfristige Zuverlässigkeit sollte mit Haltbarkeit, Defekten und Nachnutzungsbelegen bewiesen werden.",
      hi: "दीर्घकालिक भरोसा टिकाऊपन, दोष और उपयोग के बाद के प्रमाण से साबित करें।"
    }
  ],
  [
    "Buyers need stronger proof that the product performs well after delivery, not just in the listing photos.",
    {
      fr: "Les acheteurs ont besoin de preuves plus fortes que le produit fonctionne bien après livraison, pas seulement sur les photos.",
      es: "Los compradores necesitan pruebas de que funciona bien tras la entrega, no solo en fotos del listado.",
      zh: "买家需要更强证据证明产品到货后表现良好，而不只是 Listing 图片好看。",
      de: "Käufer brauchen stärkere Belege, dass das Produkt nach Lieferung gut funktioniert, nicht nur in Listing-Fotos.",
      hi: "खरीदारों को चाहिए कि उत्पाद डिलीवरी के बाद अच्छा चले, सिर्फ लिस्टिंग फोटो में नहीं।"
    }
  ],
  [
    "Support, returns, replacement, and warranty promises should be visible before checkout.",
    {
      fr: "Support, retours, remplacement et garantie doivent être visibles avant le paiement.",
      es: "Soporte, devoluciones, reemplazo y garantía deben verse antes del pago.",
      zh: "支持、退货、更换和保修承诺应在结账前可见。",
      de: "Support, Rückgabe, Ersatz und Garantie sollten vor dem Checkout sichtbar sein.",
      hi: "सहायता, रिटर्न, रिप्लेसमेंट और वारंटी वादे चेकआउट से पहले दिखें।"
    }
  ],
  [
    "Verification and real-review confidence",
    {
      fr: "Vérification et confiance dans les vrais avis",
      es: "Verificación y confianza en reseñas reales",
      zh: "验证与真实评论信心",
      de: "Verifizierung und Vertrauen in echte Bewertungen",
      hi: "सत्यापन और वास्तविक समीक्षा भरोसा"
    }
  ],
  [
    "Performance, durability, and product promise",
    {
      fr: "Performance, durabilité et promesse produit",
      es: "Rendimiento, durabilidad y promesa del producto",
      zh: "性能、耐用性和产品承诺",
      de: "Leistung, Haltbarkeit und Produktversprechen",
      hi: "प्रदर्शन, टिकाऊपन और उत्पाद वादा"
    }
  ],
  [
    "Price fairness and buyer payoff",
    {
      fr: "Prix juste et bénéfice acheteur",
      es: "Precio justo y beneficio del comprador",
      zh: "价格公平性与买家回报",
      de: "Preisfairness und Käufernutzen",
      hi: "कीमत न्याय और खरीदार लाभ"
    }
  ],
  [
    "Shipping, support, refunds, and recovery trust",
    {
      fr: "Livraison, support, remboursements et confiance en résolution",
      es: "Envío, soporte, reembolsos y confianza de recuperación",
      zh: "配送、支持、退款和售后信任",
      de: "Versand, Support, Rückerstattungen und Wiederherstellungsvertrauen",
      hi: "शिपिंग, सहायता, रिफंड और सुधार भरोसा"
    }
  ],
  [
    "Fix the weakest trust criterion before scaling traffic.",
    {
      fr: "Corrigez le critère de confiance le plus faible avant d'augmenter le trafic.",
      es: "Corrige el criterio de confianza más débil antes de escalar tráfico.",
      zh: "扩大流量前先修复最弱的信任标准。",
      de: "Behebe das schwächste Vertrauenskriterium, bevor du Traffic skalierst.",
      hi: "ट्रैफिक बढ़ाने से पहले सबसे कमजोर भरोसा मानदंड ठीक करें।"
    }
  ],
  [
    "Turn the strongest proof point into clearer listing copy.",
    {
      fr: "Transformez le meilleur point de preuve en texte de fiche plus clair.",
      es: "Convierte la prueba más fuerte en texto de listado más claro.",
      zh: "把最强证据点转化为更清晰的 Listing 文案。",
      de: "Verwandle den stärksten Beleg in klareren Listing-Text.",
      hi: "सबसे मजबूत प्रमाण बिंदु को स्पष्ट लिस्टिंग कॉपी में बदलें।"
    }
  ],
  [
    "Check the most recent low-star reviews before buying.",
    {
      fr: "Vérifiez les avis récents à faible note avant d'acheter.",
      es: "Revisa las reseñas recientes de baja puntuación antes de comprar.",
      zh: "购买前查看最近的低星评论。",
      de: "Prüfe vor dem Kauf die neuesten Niedrig-Sterne-Bewertungen.",
      hi: "खरीदने से पहले हाल की कम-रेटिंग समीक्षाएँ देखें।"
    }
  ],
  [
    "Review the wording pattern and avoid relying only on perfect 5-star reviews.",
    {
      fr: "Examinez le style des avis et évitez de vous fier uniquement aux 5 étoiles parfaits.",
      es: "Revisa el patrón de redacción y evita depender solo de reseñas perfectas de 5 estrellas.",
      zh: "检查评论措辞模式，不要只依赖完美 5 星评论。",
      de: "Prüfe das Formulierungsmuster und verlasse dich nicht nur auf perfekte 5-Sterne-Bewertungen.",
      hi: "शब्द पैटर्न देखें और केवल परफेक्ट 5-स्टार समीक्षाओं पर निर्भर न रहें।"
    }
  ],
  [
    "Compare the price against similar products before checkout.",
    {
      fr: "Comparez le prix avec des produits similaires avant le paiement.",
      es: "Compara el precio con productos similares antes del pago.",
      zh: "结账前与类似产品比较价格。",
      de: "Vergleiche den Preis vor dem Checkout mit ähnlichen Produkten.",
      hi: "चेकआउट से पहले समान उत्पादों से कीमत तुलना करें।"
    }
  ],
  [
    "Confirm return policy, warranty, size, compatibility, and included items before buying.",
    {
      fr: "Confirmez retours, garantie, taille, compatibilité et éléments inclus avant d'acheter.",
      es: "Confirma devoluciones, garantía, tamaño, compatibilidad e incluidos antes de comprar.",
      zh: "购买前确认退货政策、保修、尺寸、兼容性和包含物品。",
      de: "Bestätige Rückgabe, Garantie, Größe, Kompatibilität und Lieferumfang vor dem Kauf.",
      hi: "खरीदने से पहले रिटर्न नीति, वारंटी, आकार, संगतता और शामिल चीजें पुष्टि करें।"
    }
  ],
  [
    "Find the repeated buyer concern and make it visible in the listing or product improvement plan.",
    {
      fr: "Trouvez la préoccupation répétée et rendez-la visible dans la fiche ou le plan d'amélioration.",
      es: "Encuentra la preocupación repetida y hazla visible en el listado o plan de mejora.",
      zh: "找出重复买家担忧，并在 Listing 或产品改进计划中体现。",
      de: "Finde das wiederholte Käuferbedenken und mache es im Listing oder Verbesserungsplan sichtbar.",
      hi: "दोहराई खरीदार चिंता खोजें और उसे लिस्टिंग या सुधार योजना में दिखाएँ।"
    }
  ],
  [
    "Use the strongest positive buyer signal as proof in the headline, images, or first bullet.",
    {
      fr: "Utilisez le signal positif le plus fort comme preuve dans le titre, les images ou le premier point.",
      es: "Usa la señal positiva más fuerte como prueba en título, imágenes o primer punto.",
      zh: "将最强正面买家信号用作标题、图片或首条要点中的证明。",
      de: "Nutze das stärkste positive Käufersignal als Beleg in Titel, Bildern oder erstem Bullet.",
      hi: "सबसे मजबूत सकारात्मक खरीदार संकेत को शीर्षक, इमेज या पहले बुलेट में प्रमाण बनाएँ।"
    }
  ],
  [
    "Avoid making claims that the reviews do not strongly support.",
    {
      fr: "Évitez les affirmations que les avis ne soutiennent pas fortement.",
      es: "Evita afirmaciones que las reseñas no respalden con fuerza.",
      zh: "避免提出评论没有强力支持的主张。",
      de: "Vermeide Aussagen, die Bewertungen nicht stark stützen.",
      hi: "ऐसे दावे न करें जिन्हें समीक्षाएँ मजबूत समर्थन नहीं देतीं।"
    }
  ],
  [
    "Review positives and complaints before buying.",
    {
      fr: "Examinez les points positifs et les plaintes avant d'acheter.",
      es: "Revisa puntos positivos y quejas antes de comprar.",
      zh: "购买前查看优点和投诉。",
      de: "Prüfe positive Punkte und Beschwerden vor dem Kauf.",
      hi: "खरीदने से पहले सकारात्मक बातें और शिकायतें देखें।"
    }
  ],
  [
    "Positive scan",
    {
      fr: "Analyse positive",
      es: "Análisis positivo",
      zh: "正面扫描",
      de: "Positiver Scan",
      hi: "सकारात्मक स्कैन"
    }
  ],
  [
    "Mixed scan",
    {
      fr: "Analyse mitigée",
      es: "Análisis mixto",
      zh: "混合扫描",
      de: "Gemischter Scan",
      hi: "मिश्रित स्कैन"
    }
  ],
  [
    "Negative scan",
    {
      fr: "Analyse négative",
      es: "Análisis negativo",
      zh: "负面扫描",
      de: "Negativer Scan",
      hi: "नकारात्मक स्कैन"
    }
  ],
  [
    "Improvement detected",
    {
      fr: "Amélioration détectée",
      es: "Mejora detectada",
      zh: "检测到改进",
      de: "Verbesserung erkannt",
      hi: "सुधार मिला"
    }
  ],
  [
    "Could not add product.",
    {
      fr: "Impossible d'ajouter le produit.",
      es: "No se pudo agregar el producto.",
      zh: "无法添加产品。",
      de: "Produkt konnte nicht hinzugefügt werden.",
      hi: "उत्पाद जोड़ा नहीं जा सका।"
    }
  ],
  [
    "Product removed.",
    {
      fr: "Produit supprimé.",
      es: "Producto eliminado.",
      zh: "产品已移除。",
      de: "Produkt entfernt.",
      hi: "उत्पाद हटाया गया।"
    }
  ],
  [
    "Product image URL",
    {
      fr: "URL de l'image produit",
      es: "URL de imagen del producto",
      zh: "产品图片 URL",
      de: "Produktbild-URL",
      hi: "उत्पाद छवि URL"
    }
  ],
  [
    "Internal product notes",
    {
      fr: "Notes produit internes",
      es: "Notas internas del producto",
      zh: "内部产品备注",
      de: "Interne Produktnotizen",
      hi: "आंतरिक उत्पाद नोट्स"
    }
  ],
  [
    "Seller Action Plan",
    {
      fr: "Plan d'action vendeur",
      es: "Plan de acción del vendedor",
      zh: "卖家行动计划",
      de: "Seller-Aktionsplan",
      hi: "विक्रेता कार्य योजना"
    }
  ],
  [
    "No product scan",
    {
      fr: "Aucune analyse produit",
      es: "Sin análisis de producto",
      zh: "无产品扫描",
      de: "Kein Produktscan",
      hi: "कोई उत्पाद स्कैन नहीं"
    }
  ],
  [
    "No products",
    {
      fr: "Aucun produit",
      es: "Sin productos",
      zh: "无产品",
      de: "Keine Produkte",
      hi: "कोई उत्पाद नहीं"
    }
  ],
  [
    "Start with one product.",
    {
      fr: "Commencez avec un produit.",
      es: "Empieza con un producto.",
      zh: "从一个产品开始。",
      de: "Beginne mit einem Produkt.",
      hi: "एक उत्पाद से शुरू करें।"
    }
  ],
  [
    "Public sample results have been removed from the customer experience. Upload a product screenshot or paste a product link to generate a fresh buying verdict.",
    {
      fr: "Les exemples publics ont été retirés de l'expérience client. Importez une capture produit ou collez un lien pour générer un nouveau verdict d'achat.",
      es: "Los resultados públicos de muestra se quitaron de la experiencia del cliente. Sube una captura del producto o pega un enlace para generar un nuevo veredicto de compra.",
      zh: "公开示例结果已从客户体验中移除。上传产品截图或粘贴产品链接，以生成新的购买判断。",
      de: "Öffentliche Beispielergebnisse wurden aus der Kundenerfahrung entfernt. Lade einen Produktscreenshot hoch oder füge einen Produktlink ein, um ein neues Kaufurteil zu erstellen.",
      hi: "सार्वजनिक नमूना परिणाम ग्राहक अनुभव से हटा दिए गए हैं। नया खरीद निर्णय बनाने के लिए उत्पाद स्क्रीनशॉट अपलोड करें या उत्पाद लिंक पेस्ट करें।"
    }
  ],
  [
    "← Seller Dashboard",
    {
      fr: "← Tableau de bord vendeur",
      es: "← Panel del vendedor",
      zh: "← 卖家控制面板",
      de: "← Seller-Dashboard",
      hi: "← विक्रेता डैशबोर्ड"
    }
  ],
  [
    "Upload CSV",
    {
      fr: "Importer un CSV",
      es: "Subir CSV",
      zh: "上传 CSV",
      de: "CSV hochladen",
      hi: "CSV अपलोड करें"
    }
  ]
];

const workflowPhraseTranslations = workflowPhraseTranslationEntries.reduce<
  Partial<Record<ReviewIntelLocale, Record<string, string>>>
>((acc, [source, translations]) => {
  for (const locale of Object.keys(translations) as NonDefaultLocale[]) {
    acc[locale] ??= {};
    acc[locale]![source] = translations[locale];
  }

  return acc;
}, {});

export function getUiTextTranslations(locale: string | undefined): Record<string, string> {
  const safeLocale = normalizeLocale(locale);
  if (safeLocale === "en") return {};

  const source = phraseTranslations[safeLocale] ?? {};
  const coreTranslations = Object.fromEntries(
    uiSourcePhrases
      .map((phrase) => [phrase, source[phrase] ?? phrase] as const)
      .filter(([phrase, translated]) => translated !== phrase)
  );

  return {
    ...coreTranslations,
    ...(extraPhraseTranslations[safeLocale] ?? {}),
    ...(siteWidePhraseTranslations[safeLocale] ?? {}),
    ...(sanityCheckPhraseTranslations[safeLocale] ?? {}),
    ...(coreRouteAuditPhraseTranslations[safeLocale] ?? {}),
    ...(coreRouteAuditPhraseTranslationsMore[safeLocale] ?? {}),
    ...(workflowPhraseTranslations[safeLocale] ?? {})
  };
}

let uiTextSourceLookup: Map<string, string> | undefined;

function normalizeUiText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function buildUiTextSourceLookup() {
  const lookup = new Map<string, string>();

  for (const { code } of SUPPORTED_LOCALES) {
    if (code === "en") continue;

    for (const [source, translated] of Object.entries(getUiTextTranslations(code))) {
      const normalizedSource = normalizeUiText(source);
      const normalizedTranslation = normalizeUiText(translated);
      if (normalizedSource && !lookup.has(normalizedSource)) lookup.set(normalizedSource, normalizedSource);
      if (normalizedSource && normalizedTranslation && !lookup.has(normalizedTranslation)) {
        lookup.set(normalizedTranslation, normalizedSource);
      }
    }
  }

  return lookup;
}

export function resolveUiTextTranslationSource(value: string) {
  const normalizedValue = normalizeUiText(value);
  if (!normalizedValue) return "";

  uiTextSourceLookup ??= buildUiTextSourceLookup();
  return uiTextSourceLookup.get(normalizedValue) ?? "";
}

type DynamicCounterKey = "valid reviews" | "chars" | "sections" | "screens" | "ratings";

const dynamicResultParts = {
  fr: {
    fakeRisk: "Risque de faux avis",
    strength: "Point fort",
    complaint: "Plainte",
    biggestIssue: "Principal problème",
    buyerWorry: "L’acheteur doit-il s’inquiéter ?",
    concernAcceptable: "Confirmez que cette préoccupation est acceptable",
    aiLikeSigns: "Vérifiez les signes d’avis de type IA",
    valueScore: "Score de valeur",
    safety: (score: string) => `${score} % de sécurité`,
    fakeRiskLevel: (risk: string) => `${risk} risque de faux avis`,
    validReviewsAnalyzed: (count: string) => `${count} avis valides analysés.`,
    concernRatio: (count: string) => `Environ ${count} signal${count === "1" ? "" : "aux"} sur 10 mentionne${count === "1" ? "" : "nt"} une préoccupation.`
  },
  es: {
    fakeRisk: "Riesgo de reseñas falsas",
    strength: "Fortaleza",
    complaint: "Queja",
    biggestIssue: "Mayor problema",
    buyerWorry: "¿Debe preocuparse el comprador?",
    concernAcceptable: "Confirma que esta preocupación es aceptable",
    aiLikeSigns: "Revisa señales de reseñas tipo IA",
    valueScore: "Puntuación de valor",
    safety: (score: string) => `${score}% de seguridad`,
    fakeRiskLevel: (risk: string) => `${risk} riesgo de reseñas falsas`,
    validReviewsAnalyzed: (count: string) => `${count} reseñas válidas analizadas.`,
    concernRatio: (count: string) => `Aproximadamente ${count} de cada 10 señales mencionan una preocupación.`
  },
  zh: {
    fakeRisk: "虚假评论风险",
    strength: "优点",
    complaint: "投诉",
    biggestIssue: "最大问题",
    buyerWorry: "买家需要担心吗？",
    concernAcceptable: "确认这个问题可以接受",
    aiLikeSigns: "检查类似 AI 评论的迹象",
    valueScore: "价值评分",
    safety: (score: string) => `${score}% 安全度`,
    fakeRiskLevel: (risk: string) => `${risk}虚假评论风险`,
    validReviewsAnalyzed: (count: string) => `已分析 ${count} 条有效评论。`,
    concernRatio: (count: string) => `约每 10 个信号中有 ${count} 个提到问题。`
  },
  de: {
    fakeRisk: "Fake-Review-Risiko",
    strength: "Stärke",
    complaint: "Beschwerde",
    biggestIssue: "Größtes Problem",
    buyerWorry: "Sollte sich der Käufer Sorgen machen?",
    concernAcceptable: "Bestätige, dass dieses Problem akzeptabel ist",
    aiLikeSigns: "Prüfe Anzeichen für KI-ähnliche Bewertungen",
    valueScore: "Wertscore",
    safety: (score: string) => `${score}% Sicherheit`,
    fakeRiskLevel: (risk: string) => `${risk} Fake-Review-Risiko`,
    validReviewsAnalyzed: (count: string) => `${count} gültige Bewertungen analysiert.`,
    concernRatio: (count: string) => `Etwa ${count} von 10 Signalen erwähnen ein Problem.`
  },
  hi: {
    fakeRisk: "फर्जी समीक्षा जोखिम",
    strength: "खूबी",
    complaint: "शिकायत",
    biggestIssue: "सबसे बड़ा मुद्दा",
    buyerWorry: "क्या खरीदार को चिंता करनी चाहिए?",
    concernAcceptable: "पुष्टि करें कि यह चिंता स्वीकार्य है",
    aiLikeSigns: "AI जैसी समीक्षा संकेत जांचें",
    valueScore: "मूल्य स्कोर",
    safety: (score: string) => `${score}% सुरक्षा`,
    fakeRiskLevel: (risk: string) => `${risk} फर्जी समीक्षा जोखिम`,
    validReviewsAnalyzed: (count: string) => `${count} मान्य समीक्षाएँ विश्लेषित।`,
    concernRatio: (count: string) => `लगभग 10 में से ${count} संकेत चिंता बताते हैं।`
  }
} satisfies Record<
  Exclude<ReviewIntelLocale, "en">,
  Record<string, string | ((value: string) => string)>
>;

const dynamicAdParts = {
  fr: {
    dailyImpressionCap: (count: string) => `${count} impressions quotidiennes maximum`,
    campaignWindow: (days: string) => `Fenêtre de campagne de ${days} jours`,
    packageAllowance: (count: string, days: string) => `${count} impressions quotidiennes · ${days} jours`
  },
  es: {
    dailyImpressionCap: (count: string) => `${count} impresiones diarias máximas`,
    campaignWindow: (days: string) => `Periodo de campaña de ${days} días`,
    packageAllowance: (count: string, days: string) => `${count} impresiones diarias · ${days} días`
  },
  zh: {
    dailyImpressionCap: (count: string) => `${count} 次每日展示上限`,
    campaignWindow: (days: string) => `${days} 天广告活动周期`,
    packageAllowance: (count: string, days: string) => `${count} 次每日展示 · ${days} 天`
  },
  de: {
    dailyImpressionCap: (count: string) => `${count} tägliches Impression-Limit`,
    campaignWindow: (days: string) => `${days}-Tage-Kampagnenfenster`,
    packageAllowance: (count: string, days: string) => `${count} tägliche Impressions · ${days} Tage`
  },
  hi: {
    dailyImpressionCap: (count: string) => `${count} daily impression cap`,
    campaignWindow: (days: string) => `${days}-day campaign window`,
    packageAllowance: (count: string, days: string) => `${count} daily impressions · ${days} days`
  }
} satisfies Record<
  Exclude<ReviewIntelLocale, "en">,
  {
    dailyImpressionCap: (count: string) => string;
    campaignWindow: (days: string) => string;
    packageAllowance: (count: string, days: string) => string;
  }
>;

function translateDynamicUiText(locale: ReviewIntelLocale, source: string) {
  if (locale === "en") return undefined;

  const parts = dynamicPhraseParts[locale];
  const resultParts = dynamicResultParts[locale];
  const adParts = dynamicAdParts[locale];
  const translateSegment = (value: string) => getUiTextTranslation(locale, value) || value;
  const withTranslatedSegment = (label: string, value: string) => `${label}: ${translateSegment(value)}`;

  const counter = source.match(/^([\d,.]+) (valid reviews|chars|sections|screens|ratings)$/);
  if (counter) {
    const label = parts[counter[2] as DynamicCounterKey];
    return `${counter[1]} ${label}`;
  }

  const dailyImpressionCap = source.match(/^([\d,.]+) daily impression cap$/);
  if (dailyImpressionCap) return adParts.dailyImpressionCap(dailyImpressionCap[1]);

  const campaignWindow = source.match(/^(\d+)-day campaign window$/);
  if (campaignWindow) return adParts.campaignWindow(campaignWindow[1]);

  const packageAllowance = source.match(/^([\d,.]+) daily impressions · (\d+) days$/);
  if (packageAllowance) return adParts.packageAllowance(packageAllowance[1], packageAllowance[2]);

  const score = source.match(/^Score (.+)$/);
  if (score && typeof parts.score === "string") return `${parts.score} ${score[1]}`;

  const sentiment = source.match(/^Sentiment (.+)$/);
  if (sentiment && typeof parts.sentiment === "string") return `${parts.sentiment} ${sentiment[1]}`;

  const productsFound = source.match(/^(\d+) products? found$/);
  if (productsFound && typeof parts.productFound === "function") return parts.productFound(productsFound[1]);

  const scanCount = source.match(/^(\d+) scans?$/);
  if (scanCount && typeof parts.scanCount === "function") return parts.scanCount(scanCount[1]);

  const averageBuyingScore = source.match(/^Average buying score: (\d+)%$/);
  if (averageBuyingScore && typeof parts.averageBuyingScore === "function") {
    return parts.averageBuyingScore(averageBuyingScore[1]);
  }

  const validReviewsAnalyzed = source.match(/^([\d,.]+) valid reviews analyzed\.$/);
  if (validReviewsAnalyzed && typeof resultParts.validReviewsAnalyzed === "function") {
    return resultParts.validReviewsAnalyzed(validReviewsAnalyzed[1]);
  }

  const fakeRiskLevel = source.match(/^(Low|Medium|High) fake risk$/);
  if (fakeRiskLevel && typeof resultParts.fakeRiskLevel === "function") {
    return resultParts.fakeRiskLevel(translateSegment(fakeRiskLevel[1]));
  }

  const fakeRiskLine = source.match(/^Fake risk: (.+)$/);
  if (fakeRiskLine && typeof resultParts.fakeRisk === "string") {
    return withTranslatedSegment(resultParts.fakeRisk, fakeRiskLine[1]);
  }

  const strengthLine = source.match(/^Strength: (.+)$/);
  if (strengthLine && typeof resultParts.strength === "string") {
    return withTranslatedSegment(resultParts.strength, strengthLine[1]);
  }

  const complaintLine = source.match(/^Complaint: (.+)$/);
  if (complaintLine && typeof resultParts.complaint === "string") {
    return withTranslatedSegment(resultParts.complaint, complaintLine[1]);
  }

  const biggestIssueLine = source.match(/^Biggest issue: (.+)$/);
  if (biggestIssueLine && typeof resultParts.biggestIssue === "string") {
    return withTranslatedSegment(resultParts.biggestIssue, biggestIssueLine[1]);
  }

  const buyerWorryLine = source.match(/^Should buyer worry\? (.+)$/);
  if (buyerWorryLine && typeof resultParts.buyerWorry === "string") {
    return `${resultParts.buyerWorry} ${translateSegment(buyerWorryLine[1])}`;
  }

  const concernLine = source.match(/^Confirm this concern is acceptable: (.+)$/);
  if (concernLine && typeof resultParts.concernAcceptable === "string") {
    return `${resultParts.concernAcceptable} : ${translateSegment(concernLine[1])}`;
  }

  const aiLikeLine = source.match(/^Check AI-like review signs: (.+)$/);
  if (aiLikeLine && typeof resultParts.aiLikeSigns === "string") {
    return `${resultParts.aiLikeSigns} : ${translateSegment(aiLikeLine[1])}`;
  }

  const valueScore = source.match(/^Value score: (.+)$/);
  if (valueScore && typeof resultParts.valueScore === "string") {
    return `${resultParts.valueScore} : ${valueScore[1]}`;
  }

  const concernRatio = source.match(/^Roughly (\d+) out of 10 signals mention a concern\.$/);
  if (concernRatio && typeof resultParts.concernRatio === "function") {
    return resultParts.concernRatio(concernRatio[1]);
  }

  const safety = source.match(/^(\d+)% safety$/);
  if (safety && typeof resultParts.safety === "function") {
    return resultParts.safety(safety[1]);
  }

  return undefined;
}

export function getUiTextTranslation(
  locale: string | undefined,
  source: string,
  translations = getUiTextTranslations(locale)
): string | undefined {
  const safeLocale = normalizeLocale(locale);
  if (safeLocale === "en") return undefined;

  const normalizedSource = normalizeUiText(source);
  if (!normalizedSource) return undefined;

  const resolvedSource = resolveUiTextTranslationSource(normalizedSource) || normalizedSource;
  return translations[resolvedSource] ?? translateDynamicUiText(safeLocale, resolvedSource);
}
