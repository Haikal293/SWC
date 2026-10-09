import express from "express";
import { z } from "zod";
import { pool } from "../db/pool.js";
import { authenticate, authorize } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";

const router = express.Router();

router.use(authenticate);

const venueSchema = z.object({
  venue_name: z.string().min(2),
  building: z.string().min(1),
  capacity: z.coerce.number().int().positive()
});

router.get("/", async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      "SELECT * FROM venues ORDER BY venue_name"
    );

    res.json({
      success: true,
      data: rows
    });
  } catch (error) {
    next(error);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      "SELECT * FROM venues WHERE venue_id = ?",
      [req.params.id]
    );

    if (!rows.length) {
      return res.status(404).json({
        success: false,
        message: "Venue not found"
      });
    }

    res.json({
      success: true,
      data: rows[0]
    });
  } catch (error) {
    next(error);
  }
});

router.post(
  "/",
  authorize("Administrator"),
  validate(venueSchema),
  async (req, res, next) => {
    try {
      const { venue_name, building, capacity } = req.body;

      const [result] = await pool.query(
        `INSERT INTO venues
         (venue_name, building, capacity)
         VALUES (?, ?, ?)`,
        [venue_name, building, capacity]
      );

      res.status(201).json({
        success: true,
        message: "Venue created",
        venue_id: result.insertId
      });
    } catch (error) {
      next(error);
    }
  }
);

router.put(
  "/:id",
  authorize("Administrator"),
  validate(venueSchema),
  async (req, res, next) => {
    try {
      const { venue_name, building, capacity } = req.body;

      const [result] = await pool.query(
        `UPDATE venues
         SET venue_name = ?,
             building = ?,
             capacity = ?
         WHERE venue_id = ?`,
        [venue_name, building, capacity, req.params.id]
      );

      if (!result.affectedRows) {
        return res.status(404).json({
          success: false,
          message: "Venue not found"
        });
      }

      res.json({
        success: true,
        message: "Venue updated"
      });
    } catch (error) {
      next(error);
    }
  }
);

router.delete(
  "/:id",
  authorize("Administrator"),
  async (req, res, next) => {
    try {
      const [result] = await pool.query(
        "DELETE FROM venues WHERE venue_id = ?",
        [req.params.id]
      );

      if (!result.affectedRows) {
        return res.status(404).json({
          success: false,
          message: "Venue not found"
        });
      }

      res.json({
        success: true,
        message: "Venue deleted"
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;