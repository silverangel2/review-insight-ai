const groups = [
  {
    title: "Support",
    links: [
      ["FAQ", "/faq"],
      ["Contact", "/contact"],
      ["Billing Support", "/billing-support"],
      ["Account Support", "/account-support"],
      ["Delete Account", "/delete-account"],
      ["Manage Subscription", "/manage-subscription"],
    ],
  },
  {
    title: "Trust & Legal",
    links: [
      ["Terms", "/terms"],
      ["Privacy", "/privacy"],
      ["Disclaimer", "/disclaimer"],
      ["Refunds", "/refunds"],
      ["Cookies", "/cookies"],
      ["Acceptable Use", "/acceptable-use"],
    ],
  },
  {
    title: "ReviewIntel Pages",
    links: [
      ["Buyer Review Analyzer", "/buyer-review-analyzer"],
      ["Amazon Review Analyzer", "/amazon-review-analyzer"],
      ["Fake Review Detector", "/fake-review-detector"],
      ["Seller Review Analytics", "/seller-review-analytics"],
    ],
  },
];

export default function MobileMorePage() {
  return (
    <main className="ri-mobile-more-page">
      <section className="ri-mobile-more-hero">
        <p className="ri-mobile-more-kicker">ReviewIntel</p>
        <h1>More</h1>
        <p>Support, legal, account, and product pages.</p>
      </section>

      <div className="ri-mobile-more-groups">
        {groups.map((group) => (
          <section key={group.title} className="ri-mobile-more-card">
            <h2>{group.title}</h2>

            <div className="ri-mobile-more-page-links">
              {group.links.map(([label, href]) => (
                <a key={href} href={href}>
                  <span>{label}</span>
                  <strong>›</strong>
                </a>
              ))}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
