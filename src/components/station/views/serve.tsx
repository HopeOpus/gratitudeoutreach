"use client";
import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import type { VolunteerSession } from "@/lib/offline/session";
import { useStations, useVisit } from "@/lib/offline/hooks";
import { recordService, undoService } from "@/lib/offline/mutations";
import { navigate, back } from "../nav";
import { useScan } from "../scan-context";
import { metaLine } from "../bits";
import { Button } from "@/components/ui/button";
import { CodeBadge, EmptyState, Skeleton, AlertBanner } from "@/components/ui/misc";
import { toast } from "@/components/ui/toast";
import { firstName, vibrate, errorMessage } from "@/lib/utils";
import type { ServicePayload } from "../forms/types";
import { FoodForm } from "../forms/food";
import { ClothingForm } from "../forms/clothing";
import { PrayerForm } from "../forms/prayer";
import { CounsellingForm } from "../forms/counselling";
import { MedicalForm } from "../forms/medical";
import { VitalsForm } from "../forms/vitals";
import { OpticianForm } from "../forms/optician";
import { LaboratoryForm } from "../forms/laboratory";
import { GenericForm } from "../forms/generic";

export function ServeView({ visitId, session }: { visitId: string; session: VolunteerSession }) {
  const visit = useVisit(visitId);
  const stations = useStations();
  const { readOnly } = useScan();
  const [saving, setSaving] = useState(false);

  if (visit === undefined) return <div className="p-4"><Skeleton className="h-64" /></div>;
  if (visit === null) return <EmptyState title="Person not found on this phone" />;
  if (readOnly) return <AlertBanner tone="warning" className="m-4">This edition is closed. Forms are disabled.</AlertBanner>;

  const submit = async (p: ServicePayload) => {
    setSaving(true);
    try {
      const id = await recordService({ visit, ...p });
      vibrate(30);
      toast.saved(`Saved · ${session.station.name} for ${firstName(visit.full_name)}`, () => {
        void undoService(id).then(() => toast.info("Undone"), (e) => toast.error(errorMessage(e)));
      });
      navigate("/s", { replace: true });
    } catch (e) {
      toast.error(errorMessage(e));
      setSaving(false);
    }
  };

  const props = { visit, session, stations, saving, onSubmit: (p: ServicePayload) => void submit(p) };
  const kind = session.station.kind;
  return (
    <div className="flex min-h-dvh flex-col">
      <div className="sticky top-14 z-20 flex items-center gap-2 border-b border-neutral-100 bg-white px-2 py-2">
        <Button variant="ghost" size="icon" aria-label="Back" onClick={() => back()}><ArrowLeft className="size-5" /></Button>
        <div className="min-w-0">
          <p className="truncate text-body-lg font-medium text-forest">{visit.full_name}</p>
          <p className="flex items-center gap-2 text-caption text-neutral-500"><CodeBadge code={visit.card_code} />{metaLine(visit)}</p>
        </div>
      </div>
      <div className="flex-1">
        {kind === "food" ? <FoodForm {...props} />
          : kind === "clothing" ? <ClothingForm {...props} />
          : kind === "prayer" ? <PrayerForm {...props} />
          : kind === "counselling" ? <CounsellingForm {...props} />
          : kind === "medical_assistant" ? <VitalsForm {...props} />
          : kind === "optician" ? <OpticianForm {...props} />
          : kind === "laboratory" ? <LaboratoryForm {...props} />
          : kind === "pharmacy" ? <EmptyState title="Use the person's page" body="Pharmacy is recorded from the prescription on the person's page." action={<Button onClick={() => navigate(`/s/p/${visit.id}`, { replace: true })}>Open</Button>} />
          : kind === "medical" ? <MedicalForm {...props} />
          : <GenericForm {...props} />}
      </div>
    </div>
  );
}
