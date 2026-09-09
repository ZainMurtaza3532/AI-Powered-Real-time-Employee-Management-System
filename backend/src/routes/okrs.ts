import { Router } from "express";
import { createOkr, deleteOkr, getOkrs, updateOkr } from "../controllers/okrs.js";
import { requireAuth } from "../middlewares/requireAuth.js";

const router = Router();

router.use(requireAuth);

router.get("/", getOkrs);
router.post("/", createOkr);
router.patch("/:id", updateOkr);
router.delete("/:id", deleteOkr);

export default router;
