// One-off database seeder. Run once against a fresh database:
//   npm run db:push   # create tables
//   npm run db:seed   # populate demo data + the 5 MVP role accounts
//
// In serverless the app never seeds on startup (cold starts must be cheap), so
// this is the single entry point for populating a new Netlify/Neon database.
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
