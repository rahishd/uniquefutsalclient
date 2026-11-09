import Link from "next/link";
import { Building2, Flag, Heart, HeartHandshake, Lightbulb, MapPin, Sparkles, Trophy } from "lucide-react";
import { site } from "@/lib/site";

// About Us: the venue's own write-up (story, milestones, achievements, social commitment, future and philosophy).
const MILESTONES = [
  { year: "2018", title: "Establishment", text: "Founded with a vision to redefine the futsal experience through quality facilities and a welcoming environment." },
  { year: "2019", title: "Player Protection", text: "Introduced health insurance coverage to provide players with additional support against unexpected sports-related injuries." },
  { year: "2021", title: "Membership Programmes", text: "Launched dedicated membership plans for men, women, and corporate groups, encouraging regular participation and stronger sporting connections." },
  { year: "2023", title: "Children's Football Academy", text: "Established a dedicated academy for children aged 10–15, focusing on football development, physical fitness, teamwork, and discipline." },
  { year: "2024", title: "GameZone", text: "Expanded our recreational offerings beyond the futsal court, creating more opportunities for entertainment and engagement." },
  { year: "2025", title: "3% Charity Initiative", text: "Introduced a social responsibility initiative through which 3% of profits generated from games are dedicated to supporting underprivileged children with essential needs, including food, shelter, and education." },
];

const ACHIEVEMENTS = [
  { icon: Trophy, big: "100+", title: "Tournaments Hosted", text: "Successfully hosted more than 100 national, local, and club-level tournaments, contributing to the growth and development of competitive futsal." },
  { icon: Flag, big: "National", title: "Level Representation", text: "Our home team has proudly participated in the National Futsal Team competitions, reflecting our commitment to developing competitive sporting talent." },
  { icon: Building2, big: "200+", title: "Corporate Networks", text: "Built connections with more than 200 corporate organisations and networks, demonstrating the confidence, recognition, and professional relationships we have earned over the years." },
];

function Card({ icon: Icon, title, children }: { icon: React.ElementType; title: string; children: React.ReactNode }) {
  return (
    <section aria-label={title} className="rounded-3xl bg-white p-5">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#dbeafe] text-[#2c3da0]"><Icon size={20} aria-hidden /></span>
        <h2 className="text-lg font-bold text-[#0c0b5d]">{title}</h2>
      </div>
      <div className="mt-3 space-y-3 text-sm leading-relaxed text-slate-600">{children}</div>
    </section>
  );
}

export default function AboutPage() {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 pb-6">
      <header className="rounded-3xl bg-white px-5 py-7 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-mark-navy.png" alt="" aria-hidden className="mx-auto h-12 w-auto" />
        <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">About us</p>
        <h1 className="mt-1 text-2xl font-extrabold uppercase tracking-wide text-[#0c0b5d]">{site.name}</h1>
        <p className="mt-2 text-base font-semibold text-[#2c3da0]">More Than a Game. A Community. A Vision.</p>
        <p className="mt-2 flex items-center justify-center gap-1.5 text-xs text-slate-600"><MapPin size={13} className="shrink-0" aria-hidden /> {site.address}</p>
        <p className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-[#dbeafe] px-4 py-1.5 text-xs font-semibold text-[#2c3da0]"><Heart size={13} aria-hidden /> Established 2018</p>
      </header>

      <section aria-label="Our story" className="rounded-3xl bg-white p-5 text-sm leading-relaxed text-slate-600">
        <p>Unique Futsal was founded on a vision that began in 2017: to create a futsal facility that offers more than just a place to play. Established in 2018, Unique Futsal was built around four core values: comfort, refreshment, innovation, and a welcoming, family-oriented environment. This vision gave birth to the name Unique and continues to define who we are today.</p>
        <p className="mt-3">Over the years, we have grown into a trusted sporting destination through continuous innovation, community engagement, and a commitment to delivering an exceptional sporting experience.</p>
      </section>

      <section aria-label="Our Journey and Milestones" className="rounded-3xl bg-white p-5">
        <h2 className="text-lg font-bold text-[#0c0b5d]">Our Journey &amp; Milestones</h2>
        <p className="mt-1 text-sm leading-relaxed text-slate-600">Our growth has been shaped by a series of meaningful initiatives designed to enhance the experience of our players and strengthen our community.</p>
        <ol className="mt-4 space-y-4 border-l-2 border-[#dbeafe] pl-4">
          {MILESTONES.map((m) => (
            <li key={m.year} className="relative">
              <span aria-hidden className="absolute -left-[23px] top-1 h-3 w-3 rounded-full bg-[#2c3da0] ring-4 ring-white" />
              <p className="text-xs font-bold uppercase tracking-wide text-[#2c3da0]">{m.year}</p>
              <p className="text-[15px] font-bold text-[#0c0b5d]">{m.title}</p>
              <p className="mt-0.5 text-sm leading-relaxed text-slate-600">{m.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section aria-label="Our Achievements and Recognition" className="rounded-3xl bg-white p-5">
        <h2 className="text-lg font-bold text-[#0c0b5d]">Our Achievements &amp; Recognition</h2>
        <p className="mt-1 text-sm leading-relaxed text-slate-600">Our greatest achievement is the trust we have earned from our players, partners, and the wider sporting community.</p>
        <ul className="mt-4 space-y-3">
          {ACHIEVEMENTS.map(({ icon: Icon, big, title, text }) => (
            <li key={title} className="flex gap-3 rounded-2xl bg-[#f3f7ff] p-3.5">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#dbeafe] text-[#2c3da0]"><Icon size={20} aria-hidden /></span>
              <div>
                <p className="text-[15px] font-bold text-[#0c0b5d]">{big} {title}</p>
                <p className="mt-0.5 text-sm leading-relaxed text-slate-600">{text}</p>
              </div>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-sm leading-relaxed text-slate-600">These milestones represent more than numbers; they reflect years of dedication, meaningful relationships, and the trust placed in the Unique Futsal name.</p>
      </section>

      <Card icon={HeartHandshake} title="Beyond Football – Our Social Commitment">
        <p>At Unique Futsal, we believe sports have the power to create positive change beyond the playing field.</p>
        <p>Our 3% Charity Initiative, launched in 2025, represents a childhood dream transformed into a meaningful commitment. Through this initiative, 3% of profits generated from games are allocated towards supporting underprivileged children with food, shelter, and education.</p>
        <p className="font-semibold text-[#0c0b5d]">We believe every game can create an opportunity to make a difference. Every game you play contributes 3% towards building a better future for children in need.</p>
      </Card>

      <Card icon={Lightbulb} title="Innovation & The Future">
        <p>Looking ahead, our vision is to transform Unique Futsal into a technology-driven sporting destination, where convenience, innovation, and customer experience come together.</p>
        <p>With an academic background in Computing from London Metropolitan University, our founder is personally working towards developing an integrated digital booking system to simplify reservations, improve accessibility, and introduce smarter services for our customers.</p>
        <p>We aim to combine our passion for sports with the possibilities of technology, continuously evolving to meet the expectations of modern players and corporate partners.</p>
      </Card>

      <Card icon={Sparkles} title="Our Philosophy">
        <p>To us, futsal is more than a sport. It is a platform for building teamwork, promoting healthy lifestyles, developing discipline, discovering talent, and bringing people together.</p>
        <p>Our ambition extends beyond providing a sporting facility. We aspire to create an environment where individuals grow, friendships develop, businesses connect, young talents emerge, and communities become stronger.</p>
        <p>Unique Futsal is more than a venue. It is a community built on shared passion, earned trust, meaningful connections, and a vision for a better future.</p>
        <p>Thank you to every player, member, corporate partner, team, and supporter who has been part of our journey. Your continued trust and loyalty inspire us to keep moving forward.</p>
      </Card>

      <section aria-label="Welcome" className="rounded-3xl bg-[#dbeafe] px-5 py-6 text-center">
        <p className="text-base font-bold text-[#0c0b5d]">Play with passion. Connect with purpose. Make a difference.</p>
        <p className="mt-1 text-sm font-semibold text-[#2c3da0]">Welcome to Unique Futsal.</p>
      </section>

      <Link href="/" className="block rounded-full bg-[#dbeafe] py-3 text-center text-sm font-semibold text-[#2c3da0]">Back to Home</Link>
    </div>
  );
}
