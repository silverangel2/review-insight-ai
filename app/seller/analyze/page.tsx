import type { Metadata } from "next";
import { withSeo, privatePage } from "@/lib/pageSeo";

export const metadata = privatePage("/seller/analyze", "Seller analysis");
export { default } from "@/app/dashboard/seller/upload/page";
