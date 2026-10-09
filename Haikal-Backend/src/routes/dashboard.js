import express from "express";
import { pool } from "../db/pool.js";
import { authenticate, authorize } from "../middleware/auth.js";

const router = express.Router();

router.use(authenticate);

router.get(
  "/summary",
  authorize("Administrator", "Lecturer"),
  async (req, res, next) => {
    try {
      const [
        [users],
        [courses],
        [exams],
        [results],
        [venues],
        [registrations]
      ] = await Promise.all([
        pool.query("SELECT COUNT(*) total FROM users"),
        pool.query("SELECT COUNT(*) total FROM courses"),
        pool.query("SELECT COUNT(*) total FROM examinations"),
        pool.query("SELECT COUNT(*) total FROM results"),
        pool.query("SELECT COUNT(*) total FROM venues"),
        pool.query("SELECT COUNT(*) total FROM registrations")
      ]);

      res.json({
        success: true,
        data: {
          users: users[0].total,
          courses: courses[0].total,
          examinations: exams[0].total,
          results: results[0].total,
          venues: venues[0].total,
          registrations: registrations[0].total
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;