import type { AnalyzeResponse, ReviewAnalysis } from "@/lib/types";

const DEMO_QUOTA = {
  plan: "buyer_pro" as const,
  limit: null,
  used: 0,
  remaining: null,
  resets_at: "2026-06-02T00:00:00.000Z"
};

const buyerAnalysis: ReviewAnalysis = {
  overall_summary:
    "Most shoppers like the Aurora desk lamp for studying, office work, and evening use. The strongest praise is build quality, warm light, and easy controls. The main risks are occasional flickering, slow support, and packaging damage.",
  positive_points: [
    "Touch controls feel smooth and easy to adjust.",
    "Warm light is comfortable for night study and office work.",
    "Several shoppers describe the product as sturdy or premium.",
    "Good value for students and small desks."
  ],
  negative_points: [
    "A few shoppers mention flickering after several weeks.",
    "Support response can be slow when defects happen.",
    "Packaging can arrive crushed or feel less premium."
  ],
  common_complaints: ["Flickering after short use", "Slow support replies", "Crushed packaging", "Short charging cable"],
  praised_features: ["Warm adjustable light", "Sturdy base", "Premium look", "Easy touch controls"],
  quality_concerns: ["Small but important flickering risk", "Packaging does not always match the premium product feel"],
  product_quality_concerns: ["Small but important flickering risk", "Packaging does not always match the premium product feel"],
  value_for_money_opinion: "Strong value if the shopper wants a compact desk lamp and accepts a small reliability risk.",
  buyer_recommendation: {
    verdict: "Buy",
    rationale: "Worth buying for study or office use because praise is stronger than complaints, but keep an eye on flickering complaints."
  },
  customer_recommendation: {
    verdict: "Buy",
    rationale: "Worth buying for study or office use because praise is stronger than complaints, but keep an eye on flickering complaints."
  },
  product_score: 86,
  fake_review_indicators: ["Review language appears varied.", "No obvious repeated phrase pattern detected in the demo sample."],
  seller_insights: {
    main_customer_pain_points: ["Flickering risk", "Support response time", "Packaging damage"],
    complaint_clusters: ["Durability", "Support", "Packaging"],
    product_improvement_recommendations: ["Stress-test lamp electronics for early flicker failures.", "Improve box protection around the lamp base."],
    listing_improvement_suggestions: ["Show lamp size beside a laptop.", "Add a support/warranty expectation bullet."],
    packaging_shipping_issues: ["Crushed box complaints appear in the review set."],
    shipping_complaint_detection: ["Packaging protection should be monitored."],
    sentiment_trends: ["Mostly positive with isolated reliability concerns."],
    refund_risk_issues: ["Flickering may create refund risk if it becomes common."],
    feature_requests: ["Longer charging cable"],
    competitor_opportunity_insights: ["Position as a student and office lamp if reliability is improved."],
    seller_recommendations: ["Fix flicker risk first, then use premium design language more aggressively in listing copy."],
    customer_satisfaction_score: 86
  },
  improvement_suggestions: ["Improve packaging", "Test for flickering", "Add clearer support policy"],
  feature_requests: ["Longer charging cable"],
  packaging_issues: ["Crushed box complaints"],
  durability_issues: ["Flickering after several weeks"],
  support_issues: ["Support can take several days to reply"],
  sentiment_score: 0.58,
  confidence_score: 0.78,
  keywords: ["lamp", "study", "office", "warm", "flickering", "packaging", "support", "value"],
  keyword_analysis: [
    { keyword: "study", mentions: 11, sentiment: "positive", context: "Frequently linked to night use and desk work." },
    { keyword: "warm light", mentions: 9, sentiment: "positive", context: "Repeated praise for comfort and ambiance." },
    { keyword: "flickering", mentions: 4, sentiment: "negative", context: "Main durability warning." },
    { keyword: "packaging", mentions: 3, sentiment: "negative", context: "Box quality does not match product feel." }
  ]
};

const sellerAnalysis: ReviewAnalysis = {
  overall_summary:
    "The Solara portable blender has strong early shopper appeal, but the seller should treat durability, lid leakage, parts availability, and support speed as operational priorities before scaling ads.",
  positive_points: ["Compact design is loved by smoothie shoppers.", "Cleanup is fast.", "Motor performance is praised early.", "Price feels attractive."],
  negative_points: ["Several reviews mention lid leakage.", "Replacement parts are hard to find.", "Support response time is slow.", "Motor durability is questioned."],
  common_complaints: ["Lid leaks", "Motor stops early", "Replacement parts unavailable", "Slow support", "Dented packaging"],
  praised_features: ["Compact footprint", "Fast cleanup", "Strong early blending", "Good price"],
  quality_concerns: ["Motor durability", "Blade assembly loosening", "Lid seal reliability"],
  product_quality_concerns: ["Motor durability", "Blade assembly loosening", "Lid seal reliability"],
  value_for_money_opinion: "Value is persuasive at first, but durability complaints reduce long-term trust.",
  buyer_recommendation: {
    verdict: "Maybe",
    rationale: "Good budget appeal, but shoppers should compare durability and warranty before purchasing."
  },
  customer_recommendation: {
    verdict: "Maybe",
    rationale: "Good budget appeal, but shoppers should compare durability and warranty before purchasing."
  },
  product_score: 67,
  fake_review_indicators: ["Language variety looks normal in the demo sample.", "Low evidence of repeated templated praise."],
  seller_insights: {
    main_customer_pain_points: ["Leakage", "Motor durability", "Parts availability", "Support delay"],
    complaint_clusters: ["Lid and seal defects", "Motor/assembly reliability", "Post-purchase support", "Listing size expectation"],
    product_improvement_recommendations: [
      "Redesign or reinforce the lid seal before increasing paid traffic.",
      "Create a replacement-parts path for cups, lids, and blade assemblies.",
      "Run a 30-day durability test focused on motor heat and blade assembly looseness."
    ],
    listing_improvement_suggestions: [
      "Show exact cup capacity beside a common water bottle.",
      "Add realistic smoothie texture examples, not only staged lifestyle shots.",
      "Add support and replacement-parts messaging above the fold."
    ],
    packaging_shipping_issues: ["Dented box complaints appear often enough to monitor.", "Manual quality lowers perceived product value."],
    shipping_complaint_detection: ["Packaging is not the top issue, but it weakens first impression."],
    sentiment_trends: ["Early-use sentiment is positive, then durability complaints create trust decay."],
    refund_risk_issues: ["Motor stopped after short use", "Leakage during normal blending", "Support requested videos and delayed replies"],
    feature_requests: ["Replacement lid availability", "Clear capacity photo", "Better manual", "Longer warranty clarity"],
    competitor_opportunity_insights: [
      "Competitors with visible replacement parts can win trust.",
      "A stronger warranty and leak-proof proof point could reposition this product above budget competitors.",
      "There is a market gap for a compact blender that clearly proves durability."
    ],
    seller_recommendations: [
      "Pause aggressive ad scaling until leakage and motor complaints are reduced.",
      "Build a weekly complaint dashboard for lid, motor, support, and parts mentions.",
      "Use improved packaging and replacement-parts messaging as conversion assets."
    ],
    customer_satisfaction_score: 64
  },
  improvement_suggestions: ["Fix lid leakage", "Improve parts availability", "Speed up support replies", "Clarify product size in listing"],
  feature_requests: ["Replacement parts", "Better manual", "Clearer cup size photo", "Warranty clarity"],
  packaging_issues: ["Dented box", "Cheap manual"],
  durability_issues: ["Motor stops early", "Blade assembly loosens"],
  support_issues: ["Slow replies", "Video proof friction"],
  sentiment_score: 0.08,
  confidence_score: 0.84,
  keywords: ["lid", "leak", "motor", "parts", "support", "compact", "cleanup", "capacity"],
  keyword_analysis: [
    { keyword: "lid", mentions: 18, sentiment: "negative", context: "Leakage and seal reliability dominate complaints." },
    { keyword: "motor", mentions: 14, sentiment: "negative", context: "Durability risk and short-use failure." },
    { keyword: "compact", mentions: 12, sentiment: "positive", context: "Strong positioning advantage." },
    { keyword: "cleanup", mentions: 10, sentiment: "positive", context: "Repeated praise and ad-copy opportunity." },
    { keyword: "support", mentions: 8, sentiment: "negative", context: "Slow response harms trust." }
  ]
};

export const buyerDemoResult: AnalyzeResponse = {
  analysis: buyerAnalysis,
  meta: {
    mode: "local-fallback",
    model: "demo-fixture",
    review_count_estimate: 42,
    quota: DEMO_QUOTA,
    platform: "shopify",
    audience: "buyer",
    image_count: 0,
    ingestion_mode: "deep_paste",
    review_section_count: 1,
    confidence_label: "Medium",
    confidence_detail: "Medium confidence from 42 valid demo reviews.",
    chunk_count: 1,
    model_review_chars: 4200,
    rating_breakdown: { "1": 2, "2": 4, "3": 6, "4": 13, "5": 17 },
    analysis_id: "demo-consumer-aurora-lamp"
  }
};

export const sellerDemoResult: AnalyzeResponse = {
  analysis: sellerAnalysis,
  meta: {
    mode: "local-fallback",
    model: "demo-fixture",
    review_count_estimate: 128,
    quota: { ...DEMO_QUOTA, plan: "seller_pro" },
    platform: "other",
    audience: "seller",
    image_count: 0,
    ingestion_mode: "deep_paste",
    review_section_count: 1,
    confidence_label: "High",
    confidence_detail: "High confidence from 128 valid demo reviews.",
    chunk_count: 2,
    model_review_chars: 9600,
    rating_breakdown: { "1": 16, "2": 24, "3": 31, "4": 28, "5": 29 },
    analysis_id: "demo-seller-solara-blender"
  }
};
