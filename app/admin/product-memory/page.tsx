export const dynamic = "force-dynamic";

type ProductMemoryRow = {
  product_key: string;
  store?: string | null;
  brand?: string | null;
  title?: string | null;
  price?: number | null;
  rating?: number | null;
  review_count?: number | null;
  last_verdict?: string | null;
  last_score?: number | null;
  buyer_confidence?: number | null;
  value_for_money?: string | null;
  bottom_line?: string | null;
  updated_at?: string | null;
};

async function getProducts(): Promise<ProductMemoryRow[]> {
  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000";

  try {
    const response = await fetch(`${baseUrl}/api/admin/product-memory`, {
      cache: "no-store",
    });

    const data = await response.json();
    return Array.isArray(data.products) ? data.products : [];
  } catch {
    return [];
  }
}

export default async function ProductMemoryAdminPage() {
  const products = await getProducts();

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-950 dark:bg-gradient-to-r from-sky-600 to-teal-500 dark:text-white">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-slate-900">
          <p className="text-xs font-black uppercase tracking-[0.3em] text-sky-600">ReviewIntel admin</p>
          <h1 className="mt-2 text-3xl font-black">Product Memory</h1>
          <p className="mt-2 text-sm font-bold text-slate-600 dark:text-slate-300">
            Shows stable product keys, merged ratings, review counts, verdicts, and last scanned memory.
          </p>
        </div>

        <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-slate-900">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-100 text-xs uppercase tracking-[0.18em] text-slate-500 dark:bg-slate-800">
                <tr>
                  <th className="p-4">Product</th>
                  <th className="p-4">Store</th>
                  <th className="p-4">Price</th>
                  <th className="p-4">Rating</th>
                  <th className="p-4">Reviews</th>
                  <th className="p-4">Verdict</th>
                  <th className="p-4">Score</th>
                  <th className="p-4">Updated</th>
                </tr>
              </thead>
              <tbody>
                {products.map((product) => (
                  <tr key={product.product_key} className="border-t border-slate-100 dark:border-white/10">
                    <td className="max-w-md p-4">
                      <p className="font-black">{product.title || product.brand || "Unknown product"}</p>
                      <p className="mt-1 text-xs font-bold text-slate-400">{product.product_key}</p>
                      {product.bottom_line ? (
                        <p className="mt-2 text-xs font-bold text-slate-600 dark:text-slate-300">{product.bottom_line}</p>
                      ) : null}
                    </td>
                    <td className="p-4 font-bold">{product.store || "—"}</td>
                    <td className="p-4 font-bold">{product.price ? `$${product.price}` : "—"}</td>
                    <td className="p-4 font-bold">{product.rating ? `${product.rating}/5` : "—"}</td>
                    <td className="p-4 font-bold">{product.review_count || "—"}</td>
                    <td className="p-4 font-black">{product.last_verdict || "—"}</td>
                    <td className="p-4 font-bold">{product.last_score || "—"}</td>
                    <td className="p-4 text-xs font-bold text-slate-500">
                      {product.updated_at ? new Date(product.updated_at).toLocaleString() : "—"}
                    </td>
                  </tr>
                ))}

                {products.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center font-bold text-slate-500">
                      No product memory found yet. Run a few scans first.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>
  );
}
