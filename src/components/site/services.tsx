import { HandHeart, MessagesSquare, Shirt, Stethoscope, UtensilsCrossed, Users, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { IconTile } from "./bits";
import { OUTREACH_PATH } from "@/lib/site";

const SERVICES: { name: string; img: string; alt: string; icon: LucideIcon; text: string; tile: string }[] = [
  { name: "Food", img: "food", alt: "Bags and barrows of rice and beans", icon: UtensilsCrossed, text: "Food packs to take home.", tile: "bg-leaf-600 text-white" },
  { name: "Clothing", img: "clothing", alt: "Piles of colourful clothes at the last outreach", icon: Shirt, text: "Clothes for adults and children, picked by size.", tile: "bg-fresh text-forest" },
  { name: "Free medical checks", img: "medical", alt: "A nurse checking a patient's blood pressure", icon: Stethoscope, text: "Health checks, a doctor if you need one, and medicines from the pharmacy on site.", tile: "bg-forest text-white" },
  { name: "Counselling", img: "counselling", alt: "A health worker talking with a group of women", icon: MessagesSquare, text: "Someone to talk to about what you are going through.", tile: "bg-teal-700 text-white" },
  { name: "Prayer", img: "prayer", alt: "A man bowing his head in prayer", icon: HandHeart, text: "A volunteer to pray with you, and follow-up afterwards if you want it.", tile: "bg-leaf-600 text-white" },
];

export function ServiceGrid() {
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {SERVICES.map((s) => (
        <li key={s.name} className="overflow-hidden rounded-xl bg-white shadow-sm">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/site/${s.img}.webp`} alt={s.alt} width={800} height={600} loading="lazy" className="aspect-4/3 w-full object-cover" />
          <div className="px-6 pb-7">
            <IconTile icon={s.icon} className={`relative -mt-6 ring-4 ring-white ${s.tile}`} />
            <h3 className="mt-4 text-h2 font-medium text-forest">{s.name}</h3>
            <p className="mt-2 text-body-lg text-neutral-700">{s.text}</p>
          </div>
        </li>
      ))}
      <li className="flex flex-col items-start justify-end rounded-xl bg-leaf-50 p-6 md:p-8">
        <IconTile icon={Users} className="bg-white text-leaf-700" />
        <h3 className="mt-6 text-h2 font-medium text-forest">Volunteer</h3>
        <p className="mt-2 text-body-lg text-neutral-700">Volunteers run every station on the day.</p>
        <Link href={`${OUTREACH_PATH}#volunteer`} className="mt-2 inline-flex min-h-12 items-center font-medium text-leaf-700 underline underline-offset-4">How to join in</Link>
      </li>
    </ul>
  );
}
