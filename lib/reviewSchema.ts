export const reviewAnalysisJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "overall_summary",
    "positive_points",
    "negative_points",
    "common_complaints",
    "praised_features",
    "quality_concerns",
    "product_quality_concerns",
    "value_for_money_opinion",
    "buyer_recommendation",
    "customer_recommendation",
    "product_score",
    "fake_review_indicators",
    "seller_insights",
    "improvement_suggestions",
    "feature_requests",
    "packaging_issues",
    "durability_issues",
    "support_issues",
    "sentiment_score",
    "confidence_score",
    "keywords",
    "keyword_analysis"
  ],
  properties: {
    overall_summary: {
      type: "string",
      description: "Plain-English summary of the product review pattern."
    },
    positive_points: {
      type: "array",
      items: { type: "string" }
    },
    negative_points: {
      type: "array",
      items: { type: "string" }
    },
    common_complaints: {
      type: "array",
      items: { type: "string" }
    },
    praised_features: {
      type: "array",
      items: { type: "string" }
    },
    quality_concerns: {
      type: "array",
      items: { type: "string" }
    },
    product_quality_concerns: {
      type: "array",
      items: { type: "string" }
    },
    value_for_money_opinion: {
      type: "string"
    },
    buyer_recommendation: {
      type: "object",
      additionalProperties: false,
      required: ["verdict", "rationale"],
      properties: {
        verdict: {
          type: "string",
          enum: ["Buy", "Maybe", "Avoid"]
        },
        rationale: {
          type: "string"
        }
      }
    },
    customer_recommendation: {
      type: "object",
      additionalProperties: false,
      required: ["verdict", "rationale"],
      properties: {
        verdict: {
          type: "string",
          enum: ["Buy", "Maybe", "Avoid"]
        },
        rationale: {
          type: "string"
        }
      }
    },
    product_score: {
      type: "number",
      minimum: 0,
      maximum: 100
    },
    fake_review_indicators: {
      type: "array",
      items: { type: "string" }
    },
    seller_insights: {
      type: "object",
      additionalProperties: false,
      required: [
        "main_customer_pain_points",
        "complaint_clusters",
        "product_improvement_recommendations",
        "listing_improvement_suggestions",
        "packaging_shipping_issues",
        "shipping_complaint_detection",
        "sentiment_trends",
        "refund_risk_issues",
        "feature_requests",
        "competitor_opportunity_insights",
        "seller_recommendations",
        "seller_action_cards",
        "customer_satisfaction_score"
      ],
      properties: {
        main_customer_pain_points: {
          type: "array",
          items: { type: "string" }
        },
        complaint_clusters: {
          type: "array",
          items: { type: "string" }
        },
        product_improvement_recommendations: {
          type: "array",
          items: { type: "string" }
        },
        listing_improvement_suggestions: {
          type: "array",
          items: { type: "string" }
        },
        packaging_shipping_issues: {
          type: "array",
          items: { type: "string" }
        },
        shipping_complaint_detection: {
          type: "array",
          items: { type: "string" }
        },
        sentiment_trends: {
          type: "array",
          items: { type: "string" }
        },
        refund_risk_issues: {
          type: "array",
          items: { type: "string" }
        },
        feature_requests: {
          type: "array",
          items: { type: "string" }
        },
        competitor_opportunity_insights: {
          type: "array",
          items: { type: "string" }
        },
        seller_recommendations: {
          type: "array",
          items: { type: "string" }
        },
        seller_action_cards: {
          type: "array",
          minItems: 6,
          maxItems: 6,
          description: "Six seller action cards based only on the supplied review evidence. These cards must not be generic or stored answers.",
          items: {
            type: "object",
            additionalProperties: false,
            required: [
              "card_type",
              "title",
              "finding",
              "review_evidence_theme",
              "seller_meaning",
              "recommended_action",
              "confidence"
            ],
            properties: {
              card_type: {
                type: "string",
                enum: [
                  "competitor_edge",
                  "your_product_risk",
                  "attack_opportunity",
                  "fix_first",
                  "advertise_this",
                  "next_seller_move"
                ]
              },
              title: {
                type: "string",
                description: "Short seller-facing title. Example: What To Fix First, What To Advertise, Competitor Weakness To Attack."
              },
              finding: {
                type: "string",
                description: "What the reviews actually show. Must be specific to the supplied reviews."
              },
              review_evidence_theme: {
                type: "string",
                description: "The customer wording or theme behind the finding, translated into business meaning. Do not paste marketplace metadata."
              },
              seller_meaning: {
                type: "string",
                description: "Why this matters for conversion, trust, refund risk, positioning, or revenue."
              },
              recommended_action: {
                type: "string",
                description: "Specific seller action based on the evidence. If evidence is weak, say Not enough clean review evidence."
              },
              confidence: {
                type: "number",
                minimum: 0,
                maximum: 100,
                description: "Confidence score for this card based on review volume and clarity."
              }
            }
          }
        },
        customer_satisfaction_score: {
          type: "number",
          minimum: 0,
          maximum: 100
        }
      }
    },
    improvement_suggestions: {
      type: "array",
      items: { type: "string" }
    },
    feature_requests: {
      type: "array",
      items: { type: "string" }
    },
    packaging_issues: {
      type: "array",
      items: { type: "string" }
    },
    durability_issues: {
      type: "array",
      items: { type: "string" }
    },
    support_issues: {
      type: "array",
      items: { type: "string" }
    },
    sentiment_score: {
      type: "number",
      minimum: -1,
      maximum: 1,
      description: "-1 is very negative, 0 is mixed, 1 is very positive."
    },
    confidence_score: {
      type: "number",
      minimum: 0,
      maximum: 1
    },
    keywords: {
      type: "array",
      items: { type: "string" }
    },
    keyword_analysis: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["keyword", "mentions", "sentiment", "context"],
        properties: {
          keyword: { type: "string" },
          mentions: { type: "number", minimum: 0 },
          sentiment: { type: "string", enum: ["positive", "neutral", "negative"] },
          context: { type: "string" }
        }
      }
    }
  }
} as const;

export const openAiTextFormat = {
  type: "json_schema",
  name: "review_intelligence_analysis",
  strict: true,
  schema: reviewAnalysisJsonSchema
} as const;
