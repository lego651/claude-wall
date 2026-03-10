"use client";

import { useParams } from "next/navigation";
import CompanyFeedTab from "@/components/propfirms/company-feed/CompanyFeedTab";

export default function CompanyFeedPage() {
  const params = useParams();
  const firmId = params?.id;

  return <CompanyFeedTab firmId={firmId} />;
}
