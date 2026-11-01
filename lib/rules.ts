// The venue's Code of Conduct, Safety Rules & Tournament Regulations, as shown on the Rules & Regulations page (components/rules/RulesPage.tsx).
// The words are the venue's own. Each rule has an icon key (the page maps it to an icon), its points, and optionally a penalty and a closing note.

export type RuleIcon =
  | "footprints" | "fence" | "alert" | "drink" | "alcohol" | "smoking" | "child" | "jewellery" | "furniture" | "dispute"
  | "timer" | "seating" | "changing" | "parking" | "journey"
  | "agreement" | "schedule" | "extension" | "damage" | "water" | "crowd" | "deck" | "infant"
  | "clock" | "gamepad" | "glass";

export type RulePoint = string | { text: string; sub: string[] };

export type Rule = {
  n: number;
  title: string;
  icon: RuleIcon;
  points: RulePoint[];
  penalty?: string; // a fine that applies (shown as a highlighted line)
  fine?: string; // the short form of the fine, for the badge and the "at a glance" strip
  note?: string; // a closing line, shown as a quote
};

export type Sector = {
  id: string;
  n: string; // "01"
  title: string;
  short: string; // for the jump chips
  intro?: string;
  tone: "blue" | "emerald" | "violet" | "cyan";
  rules: Rule[];
};

export const RULES_INTRO = {
  title: "Code of Conduct, Safety Rules & Tournament Regulations",
  tagline: "Play Fair. Stay Safe. Respect the Game.",
  welcome:
    "Welcome to Unique Futsal! We are committed to providing a safe, disciplined, enjoyable and family-friendly sporting environment for everyone. All players, visitors, tournament organizers and spectators are expected to follow the rules and regulations outlined below.",
};

export const SECTORS: Sector[] = [
  {
    id: "sector-1",
    n: "01",
    title: "Player Safety, Court Rules & Code of Conduct",
    short: "Player safety",
    tone: "blue",
    rules: [
      {
        n: 1, title: "Appropriate Sports Footwear", icon: "footprints", fine: "NPR 500",
        points: ["Studded football boots or shoes with studs are strictly prohibited.", "Only appropriate non-marking futsal shoes are permitted."],
        penalty: "NPR 500 will be charged immediately if anyone is found playing with prohibited studded footwear.",
      },
      {
        n: 2, title: "Protection of Court Infrastructure", icon: "fence",
        points: [
          "Leaning, hanging or putting pressure on the side fencing is strictly prohibited.",
          "Pulling, hanging on or deliberately damaging goalpost nets is not allowed.",
          "Any damage caused to the court infrastructure or equipment will be chargeable to the responsible individual or team.",
        ],
      },
      {
        n: 3, title: "Restricted & High-Risk Playing Areas", icon: "alert",
        points: [
          "Sitting, standing or gathering behind the goalposts is strictly prohibited.",
          "The area behind the goalposts is considered a high-risk zone due to the aggressive nature and speed of futsal gameplay.",
          "Players and spectators must maintain a safe distance from this area.",
        ],
      },
      {
        n: 4, title: "Food & Beverage Restrictions", icon: "drink",
        points: [
          "Consuming drinks, beverages or other refreshments while actively playing inside the court is prohibited.",
          "Players must use the designated refreshment areas during breaks.",
        ],
      },
      {
        n: 5, title: "Alcohol-Free Playing Environment", icon: "alcohol",
        points: [
          "Playing under the influence of alcohol or any intoxicating substance is strictly prohibited.",
          "Any individual choosing to play while intoxicated may be denied access to the court.",
          "Any accident, injury or incident arising from a violation of this policy may fall outside the protection of our applicable insurance coverage, subject to the insurance policy's terms and conditions.",
        ],
      },
      {
        n: 6, title: "Smoking & Vaping Restrictions", icon: "smoking",
        points: [
          "Smoking, vaping and the use of tobacco products are strictly prohibited inside the futsal court.",
          "A designated smoking zone is available on the 1st Floor of Office Block 1.",
          "Please use the designated area responsibly.",
        ],
      },
      {
        n: 7, title: "Child Safety & Parental Responsibility", icon: "child",
        points: [
          "Children below 15 years of age must have parental or guardian permission to participate.",
          "Parents or guardians are responsible for arranging appropriate drop-off and pick-up.",
          "By permitting their children to participate, parents or guardians acknowledge their responsibility for their children's supervision and safety arrangements.",
          "Unique Futsal shall not be responsible for unsupervised children outside its agreed supervision arrangements.",
        ],
      },
      {
        n: 8, title: "Jewellery & Personal Safety", icon: "jewellery",
        points: [
          "Players are strongly advised to remove earrings, finger rings, necklaces, watches and other ornaments before entering the court.",
          "Wearing jewellery during gameplay may cause injuries to yourself or other players.",
          "Playing with such accessories is discouraged and remains at the player's own risk, subject to applicable safety policies.",
        ],
      },
      {
        n: 9, title: "Prohibited Objects & Court Furniture", icon: "furniture", fine: "NPR 1,000",
        points: [
          "Chairs, tables, sharp objects and other unnecessary equipment are strictly prohibited inside the futsal court.",
          "Tournament organizers must arrange all required chairs, tables and spectator facilities outside the playing area.",
        ],
        penalty: "NPR 1,000 will be charged if unauthorized furniture or prohibited objects are found inside the court.",
      },
      {
        n: 10, title: "Match Disputes, Fighting & Discipline", icon: "dispute",
        points: [
          "Physical fighting, threatening behaviour, harassment or aggressive misconduct following match disputes will not be tolerated.",
          "Unique Futsal reserves the right to contact the Police Administration when necessary to maintain safety and control the situation.",
          "The responsible booking user, team captain or individuals involved may face suspension from future bookings.",
          "Serious misconduct may result in immediate removal from the premises.",
        ],
      },
    ],
  },
  {
    id: "sector-2",
    n: "02",
    title: "Facility Management, Booking & General Guidelines",
    short: "Facility & booking",
    tone: "emerald",
    rules: [
      {
        n: 11, title: "Match Transition & Game Scheduling", icon: "timer",
        points: [
          "A transition interval of 3 minutes is provided between consecutive bookings.",
          "Players from the next booking must enter the court promptly after the bell rings.",
          "Once the 3-minute transition period ends, the next scheduled game will begin.",
          "Players are requested to cooperate with operational staff to avoid unnecessary delays.",
        ],
      },
      {
        n: 12, title: "Spectator & Additional Player Seating", icon: "seating",
        points: [
          "Additional players and spectators must use the designated Elite Deck to watch and enjoy ongoing matches.",
          "Unnecessary gatherings, crowding and spectator movement inside the playing court are strictly prohibited.",
          "Only authorized players and operational personnel may enter the playing area.",
        ],
      },
      {
        n: 13, title: "Changing Rooms & Personal Belongings", icon: "changing",
        points: [
          "Players are requested to use the designated changing rooms to change their sportswear.",
          "Mobile phones, wallets and other valuable belongings may be handed over to the Operational Supervisor or authorized office staff for safekeeping.",
          "Unique Futsal does not accept responsibility for jewellery, gold, diamonds or other high-value ornaments. Players are advised to leave such belongings at home or secure them personally.",
          "Please do not leave valuable belongings unattended.",
        ],
      },
      {
        n: 14, title: "Parking & Accessibility", icon: "parking",
        points: [
          "All two-wheelers and other vehicles must be parked within the designated parking markings.",
          "Please keep the wheelchair-accessible parking and movement area clear at all times.",
          "Avoid blocking entrances, exits and designated access routes.",
        ],
      },
      {
        n: 15, title: "Safe Journey & Responsible Driving", icon: "journey",
        points: [
          "Always wear a helmet while riding a motorcycle or scooter.",
          "Always fasten your seatbelt while travelling in a car.",
          "Follow traffic regulations, avoid speeding and never drive under the influence of alcohol.",
        ],
        note: "Your safety matters beyond the court. Your loved ones are waiting for you at home!",
      },
    ],
  },
  {
    id: "sector-3",
    n: "03",
    title: "Tournament Hosting & Organizational Regulations",
    short: "Tournaments",
    intro: "All tournament managers, organizers, representatives and hosting teams must comply with the following terms before, during and after conducting any tournament at Unique Futsal.",
    tone: "violet",
    rules: [
      {
        n: 16, title: "Prior Agreement & Authorization", icon: "agreement",
        points: [
          "Every tournament organizer or manager must complete and formally agree to the applicable tournament agreement before hosting an event.",
          "Tournament arrangements, pricing, facilities, responsibilities and additional requirements must be mutually agreed upon in advance.",
        ],
      },
      {
        n: 17, title: "Tournament Schedule & Date Changes", icon: "schedule",
        points: [
          "Tournament start and end dates must strictly follow the mutually agreed schedule.",
          "Any proposed changes to the tournament dates or schedule must be communicated to Unique Futsal at least 7 days in advance.",
          "Changes are subject to mutual approval and facility availability.",
        ],
      },
      {
        n: 18, title: "Additional Time & Court Extension", icon: "extension",
        points: [
          "Tournament managers must request additional court time at least 4 hours before the scheduled booking deadline.",
          "Additional time is subject to availability and management approval.",
          "If additional time cannot be accommodated, the remaining tournament activities must be rescheduled to the following day through mutual coordination.",
        ],
      },
      {
        n: 19, title: "Property Damage & Financial Responsibility", icon: "damage",
        points: [
          "Any physical damage to the premises, court infrastructure, equipment, furniture or other facilities caused during the tournament must be compensated for by the responsible tournament organizer or manager.",
          "The organizer is responsible for ensuring that participants, officials and spectators respect the property and facilities of Unique Futsal.",
        ],
      },
      {
        n: 20, title: "Mineral Water & Complimentary Refreshments", icon: "water",
        points: [
          "Mineral water and additional refreshments are not included in the standard tournament quotation unless explicitly mentioned in the agreed package.",
          "Organizers requiring additional refreshments must coordinate with Unique Futsal in advance.",
          {
            text: "Refreshments can be arranged through either:",
            sub: ["Pay-as-you-take policy: Payment according to actual consumption.", "Fixed quantity arrangement: A mutually agreed quantity of mineral water or refreshments for the entire tournament."],
          },
        ],
      },
      {
        n: 21, title: "Tournament Disputes & Crowd Management", icon: "crowd",
        points: [
          "Tournament managers are primarily responsible for coordinating their teams, officials, participants and spectators.",
          "In the event of fights, physical disputes or serious misconduct, the organizer must immediately cooperate with Unique Futsal management to control the situation.",
          "Unique Futsal reserves the right to contact the Police Administration for further intervention whenever necessary.",
          "Any resulting damage, misconduct or violation will be handled according to the applicable tournament agreement and venue policies.",
        ],
      },
      {
        n: 22, title: "Sky Deck & Additional Facilities", icon: "deck",
        points: [
          "Access to the Sky Deck is not included in the standard tournament quotation.",
          "Any requirement for Sky Deck facilities or additional seating arrangements will be charged separately.",
          "Prior coordination and confirmation with management are mandatory.",
        ],
      },
      {
        n: 23, title: "Infant & Child Access Restrictions", icon: "infant",
        points: [
          "Babies and children below 5 years of age are strictly prohibited from entering the futsal playing court.",
          "Tournament organizers and parents must ensure that children remain in designated safe areas outside the playing court.",
        ],
      },
    ],
  },
  {
    id: "sector-4",
    n: "04",
    title: "Game Zone Rules & Entertainment Guidelines",
    short: "Game Zone",
    intro: "Welcome to the Unique Futsal Game Zone! Enjoy your gaming experience responsibly while respecting our gaming equipment, facilities and other customers.",
    tone: "cyan",
    rules: [
      {
        n: 24, title: "Grace Period & Session Timing", icon: "clock",
        points: [
          "A grace period of 5 minutes is provided after your scheduled Game Zone session ends.",
          "Customers are requested to finish their games, save their progress and prepare to leave before the grace period expires.",
          "After the 5-minute grace period, the system will automatically start calculating additional usage charges according to the applicable hourly or session-based rates.",
          "Additional charges will be calculated automatically by our booking and billing system.",
        ],
      },
      {
        n: 25, title: "Gaming Equipment & Console Protection", icon: "gamepad", fine: "NPR 500",
        points: [
          "Please handle all gaming consoles, controllers, accessories, cables and other equipment with care.",
          "Throwing, dropping, mishandling or deliberately damaging gaming equipment is strictly prohibited.",
          "Any damage caused by negligence or misuse will be chargeable to the responsible customer.",
        ],
        penalty: "NPR 500 will be charged for any identified damage, subject to assessment of the actual damage and applicable management policy.",
      },
      {
        n: 26, title: "Alcohol-Free Gaming Environment", icon: "alcohol",
        points: [
          "Alcoholic beverages and drinking alcohol are strictly prohibited inside the Game Zone.",
          "Customers under the influence of alcohol or intoxicating substances may be denied access to the facility.",
          "Please help us maintain a clean, safe and family-friendly entertainment environment.",
        ],
      },
      {
        n: 27, title: "Permitted Packaged Beverages", icon: "glass",
        points: [
          "Sealed and packaged beverages, such as Frooti and similar ready-to-drink products, are permitted inside the Game Zone.",
          "Please avoid spilling beverages near gaming consoles, controllers, electrical connections and other equipment.",
          "Unpackaged drinks and beverages that may create unnecessary mess are discouraged.",
          "Customers are responsible for maintaining cleanliness and taking care of the gaming facilities.",
        ],
      },
    ],
  },
];

export const NOTICE = {
  title: "Important Notice: Monitoring, Enforcement & Management Rights",
  intro: "All the above rules and regulations are actively monitored through security cameras, motion-detection systems and physical supervision by authorized Unique Futsal staff.",
  lead: "Unique Futsal reserves the right to:",
  rights: [
    { icon: "monitor", text: "Monitor activities throughout its premises for safety, security and operational purposes." },
    { icon: "penalty", text: "Enforce applicable penalties for violations." },
    { icon: "deny", text: "Deny court access or discontinue gameplay in case of serious safety violations." },
    { icon: "suspend", text: "Suspend individuals, booking users, team captains or tournament organizers for misconduct." },
    { icon: "police", text: "Contact the Police Administration whenever necessary to protect individuals, property and public safety." },
  ] as const,
  closing: "All players, visitors and organizers are expected to cooperate with the management and operational staff at all times.",
};

export const COMMITMENT = {
  title: "Our Commitment. Your Responsibility.",
  quote: "Players don't violate rules; they follow them.",
  text: "At Unique Futsal, we believe that discipline, respect and sportsmanship make every game memorable. Let's protect our facilities, respect one another and maintain a safe, welcoming and enjoyable sporting environment.",
  thanks: "Thank you for choosing Unique Futsal!",
  by: "Management Team",
  org: "Unique Futsal",
  address: "Tilottama-5, Manigram, Rupandehi, Nepal",
  slogan: "Play with Passion. Respect with Pride. Stay Safe. Feel Like Home.",
};

export const FINES = SECTORS.flatMap((s) => s.rules).filter((r) => r.fine && r.penalty).map((r) => ({ n: r.n, fine: r.fine as string, title: r.title, text: r.penalty as string }));
