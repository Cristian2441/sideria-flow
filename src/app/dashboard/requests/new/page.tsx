import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { db } from "@/prisma/db";
import NewRequestForm from "./NewRequestForm";

export default async function NewRequestPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  if (session.role !== "REQUESTER") {
    redirect("/dashboard/requests");
  }

  let costCenterOptions: string[] = ["CC-TI", "CC-VENTAS", "CC-OPERACIONES", "CC-FINANZAS", "CC-RRHH", "CC-ADMIN"];
  try {
    const fromDb = await db.orm.public.PurchaseRequest
      .where((r) => r.companyId.eq(session.companyId))
      .select("costCenter")
      .all();
    const unique = Array.from(new Set(fromDb.map((r) => r.costCenter).filter(Boolean)));
    if (unique.length > 0) {
      costCenterOptions = Array.from(new Set([...unique, ...costCenterOptions]));
    }
  } catch {

  }

  return <NewRequestForm costCenters={costCenterOptions} />;
}
