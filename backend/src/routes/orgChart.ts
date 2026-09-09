import { Router } from "express";
import { getOrgStructure } from "../controllers/orgChart.js";
import { requireAuth } from "../middlewares/requireAuth.js";

const router = Router();

router.use(requireAuth);
router.get("/", getOrgStructure);

export default router;
