export type CustomerRecommendation = "Buy" | "Maybe" | "Avoid";
export type SubscriptionPlan = "free_buyer" | "buyer_pro" | "buyer_beta" | "seller_premium" | "seller_beta" | "seller_pro";
export type UserRole = "guest" | "buyer" | "seller" | "admin";
export type AnalysisAudience = "buyer" | "seller" | "both";
export type ReviewPlatform =
  | "amazon"
  | "walmart"
  | "etsy"
  | "ebay"
  | "shopify"
  | "aliexpress"
  | "best_buy"
  | "tiktok_shop"
  | "google_reviews"
  | "app_reviews"
  | "other";

export type QuotaInfo = {
  plan: SubscriptionPlan;
  limit: number | null;
  used: number;
  remaining: number | null;
  resets_at: string;
};

export type SellerActionCard = {
  card_type:
    | "competitor_edge"
    | "your_product_risk"
    | "attack_opportunity"
    | "fix_first"
    | "advertise_this"
    | "next_seller_move";
  title: string;
  finding: string;
  review_evidence_theme: string;
  seller_meaning: string;
  recommended_action: string;
  confidence: number;
};

export type SellerInsights = {
  main_customer_pain_points: string[];
  complaint_clusters: string[];
  product_improvement_recommendations: string[];
  listing_improvement_suggestions: string[];
  packaging_shipping_issues: string[];
  shipping_complaint_detection: string[];
  sentiment_trends: string[];
  refund_risk_issues: string[];
  feature_requests: string[];
  competitor_opportunity_insights: string[];
  seller_recommendations: string[];
  seller_action_cards: SellerActionCard[];
  customer_satisfaction_score: number;
};

export type BuyerRecommendation = {
  verdict: CustomerRecommendation;
  rationale: string;
};

export type KeywordInsight = {
  keyword: string;
  mentions: number;
  sentiment: "positive" | "neutral" | "negative";
  context: string;
};

export type ReviewAnalysis = {
  overall_summary: string;
  positive_points: string[];
  negative_points: string[];
  common_complaints: string[];
  praised_features: string[];
  quality_concerns: string[];
  product_quality_concerns: string[];
  value_for_money_opinion: string;
  buyer_recommendation: BuyerRecommendation;
  customer_recommendation: BuyerRecommendation;
  product_score: number;
  fake_review_risk_score?: number;
  value_score?: number;
  complaint_severity_score?: number;
  sentiment_percentage?: number;
  consistency_warnings?: string[];
  insufficient_data?: boolean;
  score_basis?: string;
  score_alignment_note?: string;
  fake_review_indicators: string[];
  seller_insights: SellerInsights;
  improvement_suggestions: string[];
  feature_requests: string[];
  packaging_issues: string[];
  durability_issues: string[];
  support_issues: string[];
  sentiment_score: number;
  confidence_score: number;
  keywords: string[];
  keyword_analysis: KeywordInsight[];
};

export type UploadedReviewImage = {
  name: string;
  type: "image/jpeg" | "image/png";
  dataUrl: string;
  size: number;
};

export type ReviewTextSection = {
  id: string;
  title: string;
  text: string;
  source?: "paste" | "txt_upload" | "csv_upload";
  size?: number;
};

export type ReviewIngestionMode =
  | "deep_paste"
  | "quick_screenshot"
  | "mixed_upload"
  | "future_url_import"
  | "future_connector";

export type AnalyzeRequest = {
  reviews?: string;
  reviewSections?: ReviewTextSection[];
  productName?: string;
  productUrl?: string;
  platform?: ReviewPlatform;
  audience?: AnalysisAudience;
  locale?: string;
  images?: UploadedReviewImage[];
  ingestionMode?: ReviewIngestionMode;
  imageAggregation?: "individual" | "stitched";
};

export type ComparisonMode = "buyer" | "seller";
export type ComparisonPriority =
  | "lowest_price"
  | "best_quality"
  | "durability"
  | "fast_shipping"
  | "fewest_complaints"
  | "best_reviews"
  | "daily_use"
  | "gift_purchase"
  | "business_use"
  | "custom";

export type ProductComparisonInput = {
  id: string;
  name: string;
  price?: string;
  category?: string;
  url?: string;
  reviews: string;
};

export type AnalyzeResponse = {
  analysis: ReviewAnalysis;
  meta: {
    mode: "openai" | "local-fallback";
    model: string;
    review_count_estimate: number;
    quota: QuotaInfo;
    platform: ReviewPlatform;
    audience: AnalysisAudience;
    image_count: number;
    ingestion_mode?: ReviewIngestionMode;
    review_section_count?: number;
    confidence_label?: "Low" | "Medium" | "High";
    confidence_detail?: string;
    chunk_count?: number;
    model_review_chars?: number;
    rating_breakdown?: Record<"1" | "2" | "3" | "4" | "5", number>;
    analysis_id?: string;
  };
};
