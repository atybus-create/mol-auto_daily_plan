import { PlanDashboard } from "@/components/plan-dashboard";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function Home() {
  return <PlanDashboard />;
}
