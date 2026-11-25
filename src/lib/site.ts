// Content for the public Cause a Smile pages. Anything null is not shown.
export const SITE_URL = "https://www.causeasmile.org";
export const SITE_NAME = "Cause a Smile Initiative";
export const OUTREACH_PATH = "/gratitudeoutreach";

interface Contact { email: string | null; phone: string | null; whatsapp: string | null; address: string | null }
interface OutreachEvent { date: string | null; venue: string | null }

/** `phone` and `whatsapp` in E.164 (+234…). */
export const CONTACT: Contact = { email: null, phone: null, whatsapp: null, address: null };
/** Display text, e.g. "Saturday 12 December 2026". Set once the team confirms. */
export const NEXT_OUTREACH: OutreachEvent = { date: null, venue: null };

export interface Photo { src: string; alt: string; position?: string }
export const PHOTOS: Record<"home" | "outreach", Photo> = {
  home: { src: "/site/outreach-day.webp", alt: "Volunteers and visitors at the clothing tables during the last outreach", position: "object-[18%_50%]" },
  outreach: { src: "/site/outreach-day.webp", alt: "A woman choosing clothes at the last outreach", position: "object-[92%_50%]" },
};

const BY_SA = { license: "CC BY-SA 4.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/" };
/** Wikimedia Commons photos, cropped and resized. The licence requires this credit: keep it while they are used. */
export const PHOTO_CREDITS = [
  { subject: "Food", title: "Bags and wheels of rice and beans", by: "Daniel Paullll", url: "https://commons.wikimedia.org/wiki/File:Bags_and_wheels_of_rice_and_beans.jpg", ...BY_SA },
  { subject: "Medical", title: "Blood pressure in an hospital", by: "Heismadboy", url: "https://commons.wikimedia.org/wiki/File:Blood_pressure_in_an_hospital.jpg", ...BY_SA },
  { subject: "Counselling", title: "Family Planning Talk at Umunogodo Community", by: "Lovecharles2004", url: "https://commons.wikimedia.org/wiki/File:Family_Planning_Talk_at_Umunogodo_Community.jpg", ...BY_SA },
  { subject: "Prayer", title: "Prayer Session", by: "Theindigochxld", url: "https://commons.wikimedia.org/wiki/File:Prayer_Session.jpg", ...BY_SA },
];

/** Donation page at the NGO's payment provider. Donate buttons appear once set. */
export const DONATE_URL: string | null = null;

export const hasContact = Object.values(CONTACT).some(Boolean);
