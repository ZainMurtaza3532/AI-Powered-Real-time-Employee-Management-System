import { Router } from "express";
import {
  createKudos,
  deleteKudos,
  getKudosFeed,
  getKudosLeaderboard,
  toggleReaction,
} from "../controllers/kudos.js";
import { requireAuth } from "../middlewares/requireAuth.js";

const router = Router();

router.use(requireAuth);

router.get("/", getKudosFeed);
router.get("/leaderboard", getKudosLeaderboard);
router.post("/", createKudos);
router.post("/:id/react", toggleReaction);
router.delete("/:id", deleteKudos);

export default router;
