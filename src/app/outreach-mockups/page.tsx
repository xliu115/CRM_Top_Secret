import { redirect } from "next/navigation";

/**
 * Next.js does not serve public/outreach-mockups/index.html at /outreach-mockups
 * (only at /outreach-mockups/index.html). Redirect so /outreach-mockups works.
 */
export default function OutreachMockupsPage() {
  redirect("/outreach-mockups/index.html");
}
