// One-off database seeder. Run once against a fresh database:
//   npm run db:push   # create tables
//   npm run db:seed   # populate demo data
//
// In serverless the app never seeds on startup (cold starts must stay cheap), so
// this is the single entry point for populating a new Vercel/Neon database.
import "dotenv/config";
import { seed } from "../server/seed";

seed()
  .then(() => {
    console.log("Seed finished.");
    process.exit(0);
  })
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  });
