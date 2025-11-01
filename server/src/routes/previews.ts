import { Router } from "express";
import { getLinkPreview } from "link-preview-js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

router.post("/", requireAuth, async (req, res, next) => {
  const { url } = req.body;
  if (!url) {
    return res.status(400).json({ error: "URL is required" });
  }

  try {
    const preview = await getLinkPreview(url);
    if ('title' in preview) {
      res.json(preview);
    } else {
      res.status(404).json({ error: "Could not generate a preview for this link." });
    }
  } catch (error) {
    console.error("Link preview error:", error);
    next(error);
  }
});

export default router;
