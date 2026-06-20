import "dotenv/config";
import { db } from "../lib/db";

async function main() {
  const email = "siddhidhamnaskar64@gmail.com";
  const user = await db.user.upsert({
    where: { email },
    update: {
      role: "superadmin",
    },
    create: {
      email,
      name: "Siddhi Dhamnaskar",
      role: "superadmin",
    },
  });
  console.log("Superadmin user configured successfully:", user);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
