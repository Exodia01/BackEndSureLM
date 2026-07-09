import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const db = new PrismaClient({ adapter });

const today = new Date();
const daysFromToday = (n: number) => {
  const d = new Date(today);
  d.setDate(d.getDate() + n);
  return d;
};

const birthdayToday = new Date(1988, today.getMonth(), today.getDate());

async function main() {
  console.log("🌱 Seeding database...");

  await db.reminder.deleteMany({});
  await db.message.deleteMany({});
  await db.policyIssuance.deleteMany({});
  await db.policyLead.deleteMany({});
  await db.agentProfile.deleteMany({});
  await db.user.deleteMany({});

  console.log("🗑️  Cleared existing data");

  const agent = await db.user.create({
    data: {
      clerkId: "user_3AGF1eebZ3755pk4y0OWQYcw4rm",
      email: "agent@sureim.com",
      name: "Rajesh Kumar",
      role: "AGENT",
    },
  });

  console.log("👤 Created agent:", agent.name);

  const households = await Promise.all([
    db.policyLead.create({
      data: {
        agentId: agent.id,
        householdName: "Ramesh Kumar",
        phone: "9845012345",
        income: 8000,
        familySize: 5,
        status: "POLICY_ISSUED",
        notes: "Farmer, owns 2 acres of land. Very interested in crop insurance.",
        dateOfBirth: new Date("1985-06-15"),
        followUpAt: daysFromToday(7),
      },
    }),
    db.policyLead.create({
      data: {
        agentId: agent.id,
        householdName: "Sunita Devi",
        phone: "9741023456",
        income: 6000,
        familySize: 4,
        status: "CONTACTED",
        notes: "Interested in health insurance. Has elderly parents.",
        dateOfBirth: birthdayToday, // 🎂 Birthday today!
        followUpAt: daysFromToday(2),
      },
    }),
    db.policyLead.create({
      data: {
        agentId: agent.id,
        householdName: "Mohan Lal",
        phone: "9632034567",
        income: 12000,
        familySize: 3,
        status: "POLICY_ISSUED",
        notes: "Daily wage worker. Wants accident and life coverage.",
        dateOfBirth: new Date("1990-03-22"),
      },
    }),
    db.policyLead.create({
      data: {
        agentId: agent.id,
        householdName: "Geeta Bai",
        phone: "9512045678",
        income: 5000,
        familySize: 6,
        status: "NEW",
        notes: "BPL family. Good candidate for Ayushman Bharat.",
        dateOfBirth: new Date("1978-11-10"),
        followUpAt: daysFromToday(-1),
      },
    }),
    db.policyLead.create({
      data: {
        agentId: agent.id,
        householdName: "Ravi Shankar",
        phone: "9845056789",
        income: 15000,
        familySize: 4,
        status: "CONTACTED",
        notes: "Small business owner. Looking for life and health combo.",
        dateOfBirth: new Date("1982-08-30"),
        followUpAt: daysFromToday(5),
      },
    }),
    db.policyLead.create({
      data: {
        agentId: agent.id,
        householdName: "Nagamma H.",
        phone: "9741067890",
        income: 4500,
        familySize: 5,
        status: "REJECTED",
        notes: "Not interested at this time. Follow up in 3 months.",
        dateOfBirth: new Date("1965-07-18"),
      },
    }),
  ]);

  console.log(`🏡 Created ${households.length} households`);

  // Issuances with nextPremiumDue for monthly collection
  await db.policyIssuance.create({
    data: {
      leadId: households[0].id, // Ramesh Kumar — urgent (3 days)
      policyName: "PM Fasal Bima Yojana",
      policyProvider: "Government of India",
      premiumAmount: 330,
      nextPremiumDue: daysFromToday(3),
      status: "ACTIVE",
    },
  });

  await db.policyIssuance.create({
    data: {
      leadId: households[0].id, // Ramesh Kumar — second policy (soon)
      policyName: "PM Suraksha Bima Yojana",
      policyProvider: "Government of India",
      premiumAmount: 20,
      nextPremiumDue: daysFromToday(15),
      status: "ACTIVE",
    },
  });

  await db.policyIssuance.create({
    data: {
      leadId: households[2].id, // Mohan Lal — urgent (5 days)
      policyName: "PM Jeevan Jyoti Bima Yojana",
      policyProvider: "Government of India",
      premiumAmount: 436,
      nextPremiumDue: daysFromToday(5),
      status: "ACTIVE",
    },
  });

  console.log("📋 Created policy issuances with nextPremiumDue");

  await db.reminder.createMany({
    data: [
      {
        leadId: households[1].id,
        type: "BIRTHDAY",
        scheduledAt: today,
        note: "Wish her and discuss health insurance",
      },
      {
        leadId: households[3].id,
        type: "FOLLOWUP",
        scheduledAt: daysFromToday(-1),
        note: "Discuss Ayushman Bharat eligibility",
      },
      {
        leadId: households[4].id,
        type: "FOLLOWUP",
        scheduledAt: daysFromToday(5),
        note: "Send policy documents",
      },
      {
        leadId: households[0].id,
        type: "FOLLOWUP",
        scheduledAt: daysFromToday(7),
        note: "Collect monthly premium",
      },
    ],
  });

  console.log("🔔 Created reminders");

  await db.message.createMany({
    data: [
      {
        leadId: households[0].id,
        role: "AGENT",
        content: "Family of 5, farmer, earns ₹8000/month, owns 2 acres in Maharashtra",
      },
      {
        leadId: households[0].id,
        role: "AI",
        content: "Ramesh's household is a strong candidate for crop and accident insurance.",
        policies: [
          { name: "PM Fasal Bima Yojana", provider: "Government of India", premium: "₹330/month", coverage: "₹2,00,000", tag: "Crop" },
          { name: "PM Suraksha Bima Yojana", provider: "Government of India", premium: "₹20/month", coverage: "₹2,00,000", tag: "Accident" },
        ],
      },
    ],
  });

  console.log("💬 Created sample messages");
  console.log("\n✅ Seeding complete!");
  console.log("\n⚠️  Replace CLERK_ID_HERE in seed.ts with your Clerk user ID before running!");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await db.$disconnect(); });