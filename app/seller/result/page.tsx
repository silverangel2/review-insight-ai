import type { Metadata } from "next";
import { withSeo, privatePage } from "@/lib/pageSeo";

export const metadata = privatePage("/seller/result", "Seller result");
export { default } from "@/app/dashboard/seller/result/page";
