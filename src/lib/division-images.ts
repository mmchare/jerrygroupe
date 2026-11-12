import medicalMarine from "@/assets/division-medical-marine.jpg";
import energy from "@/assets/division-energy-resources.jpg";
import artHeritage from "@/assets/division-art-heritage.jpg";
import globalCapital from "@/assets/division-global-capital.jpg";
import philanthropy from "@/assets/division-philanthropy.jpg";
import artInvestments from "@/assets/division-art-investments.jpg";

const images: Record<string, string> = {
  "medical-marine-sciences": medicalMarine,
  "energy-natural-resources": energy,
  "art-heritage": artHeritage,
  "global-capital": globalCapital,
  philanthropy,
  "art-investments": artInvestments,
};

export function divisionImage(slug: string): string {
  return images[slug] ?? globalCapital;
}
