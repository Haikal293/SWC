import express from "express";
import cors from "cors";
import mysql from "mysql2/promise";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";

dotenv.config();

const app = express();

const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

/*
=========================================================
DATABASE CONNECTION
=========================================================
Uses the same database as Danziq:
exam_management
*/

const dbConfig = {
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "123",
    database: process.env.DB_NAME || "exam_management",
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
};

const pool = mysql.createPool(dbConfig);


/*
=========================================================
HEALTH CHECK
=========================================================
*/

app.get("/", (req, res) => {
    res.json({
        status: "Online",
        message: "ExamSync SWC3633 API Engine Connected to Database"
    });
});

app.get("/api/health", (req, res) => {
    res.json({
        success: true,
        message: "ExamSync API is running"
    });
});


/*
=========================================================
LOGIN
=========================================================
Danziq API style authentication.

Frontend still receives:
user.full_name
user.role
user.student_id

So Haikal frontend does NOT need to be changed.
*/

app.post("/api/login", async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({
            success: false,
            message: "Email and password are required."
        });
    }

    try {
        const [rows] = await pool.query(
            `
            SELECT
                user_id,
                full_name,
                email,
                password,
                role,
                student_id
            FROM users
            WHERE LOWER(email) = LOWER(?)
            `,
            [email]
        );

        if (!rows.length) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password."
            });
        }

        const user = rows[0];

        let passwordCorrect = false;

        /*
        Support both:
        1. bcrypt hashed passwords
        2. existing plain-text passwords
        */

        if (
            user.password &&
            (
                user.password.startsWith("$2a$") ||
                user.password.startsWith("$2b$") ||
                user.password.startsWith("$2y$")
            )
        ) {
            passwordCorrect = await bcrypt.compare(
                password,
                user.password
            );
        } else {
            passwordCorrect = password === user.password;

            /*
            Automatically convert old plain-text password
            into bcrypt hash after successful login.
            */

            if (passwordCorrect) {
                const hashedPassword = await bcrypt.hash(
                    password,
                    10
                );

                await pool.query(
                    `
                    UPDATE users
                    SET password = ?
                    WHERE user_id = ?
                    `,
                    [
                        hashedPassword,
                        user.user_id
                    ]
                );
            }
        }

        if (!passwordCorrect) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password."
            });
        }

        delete user.password;

        res.json({
            success: true,
            message: "Login successful",

            /*
            Keep the same structure expected
            by Haikal's frontend.
            */

            user: {
                user_id: user.user_id,
                full_name: user.full_name,
                email: user.email,
                role: user.role,
                student_id: user.student_id
            }
        });

    } catch (error) {
        console.error("Login error:", error.message);

        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});


/*
=========================================================
USERS
=========================================================
*/

app.get("/api/users", async (req, res) => {
    try {
        const [rows] = await pool.query(
            `
            SELECT
                user_id,
                full_name,
                email,
                role,
                student_id
            FROM users
            ORDER BY user_id ASC
            `
        );

        res.json({
            success: true,
            data: rows
        });

    } catch (error) {
        console.error("Users error:", error.message);

        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});


app.post("/api/users", async (req, res) => {
    const {
        full_name,
        email,
        password,
        role,
        student_id
    } = req.body;

    if (!full_name || !email || !password || !role) {
        return res.status(400).json({
            success: false,
            message: "Full name, email, password and role are required."
        });
    }

    try {
        const hashedPassword = await bcrypt.hash(
            password,
            10
        );

        const [result] = await pool.query(
            `
            INSERT INTO users
            (
                full_name,
                email,
                password,
                role,
                student_id
            )
            VALUES (?, ?, ?, ?, ?)
            `,
            [
                full_name,
                email,
                hashedPassword,
                role,
                student_id || null
            ]
        );

        res.status(201).json({
            success: true,
            message: "User created successfully",
            user_id: result.insertId
        });

    } catch (error) {
        if (error.code === "ER_DUP_ENTRY") {
            return res.status(400).json({
                success: false,
                message: "Email address is already registered."
            });
        }

        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});


app.delete("/api/users/:id", async (req, res) => {
    try {
        const [result] = await pool.query(
            `
            DELETE FROM users
            WHERE user_id = ?
            `,
            [req.params.id]
        );

        if (!result.affectedRows) {
            return res.status(404).json({
                success: false,
                message: "User not found."
            });
        }

        res.json({
            success: true,
            message: "User deleted successfully."
        });

    } catch (error) {
        if (
            error.code === "ER_ROW_IS_REFERENCED" ||
            error.code === "ER_ROW_IS_REFERENCED_2"
        ) {
            return res.status(409).json({
                success: false,
                message:
                    "Cannot delete user because related records exist."
            });
        }

        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});


/*
=========================================================
COURSES
=========================================================
*/

app.get("/api/courses", async (req, res) => {
    try {
        const [rows] = await pool.query(
            `
            SELECT
                course_id,
                course_code,
                course_name,
                credit_hour,
                faculty
            FROM courses
            ORDER BY course_id ASC
            `
        );

        res.json({
            success: true,
            data: rows
        });

    } catch (error) {
        console.error("Courses error:", error.message);

        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});


app.post("/api/courses", async (req, res) => {
    const {
        course_code,
        course_name,
        credit_hour,
        faculty
    } = req.body;

    try {
        const [result] = await pool.query(
            `
            INSERT INTO courses
            (
                course_code,
                course_name,
                credit_hour,
                faculty
            )
            VALUES (?, ?, ?, ?)
            `,
            [
                course_code,
                course_name,
                credit_hour || 3,
                faculty || "Faculty of Computing"
            ]
        );

        res.status(201).json({
            success: true,
            message: "Course created",
            course_id: result.insertId
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});


app.delete("/api/courses/:id", async (req, res) => {
    try {
        const [result] = await pool.query(
            `
            DELETE FROM courses
            WHERE course_id = ?
            `,
            [req.params.id]
        );

        if (!result.affectedRows) {
            return res.status(404).json({
                success: false,
                message: "Course not found."
            });
        }

        res.json({
            success: true,
            message: "Course deleted successfully."
        });

    } catch (error) {
        if (
            error.code === "ER_ROW_IS_REFERENCED" ||
            error.code === "ER_ROW_IS_REFERENCED_2"
        ) {
            return res.status(409).json({
                success: false,
                message:
                    "Cannot delete course because related records exist."
            });
        }

        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});


/*
=========================================================
VENUES
=========================================================
*/

app.get("/api/venues", async (req, res) => {
    try {
        const [rows] = await pool.query(
            `
            SELECT
                venue_id,
                venue_name,
                building,
                capacity
            FROM venues
            ORDER BY venue_id ASC
            `
        );

        res.json({
            success: true,
            data: rows
        });

    } catch (error) {
        console.error("Venues error:", error.message);

        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});


app.post("/api/venues", async (req, res) => {
    const {
        venue_name,
        building,
        capacity
    } = req.body;

    try {
        const [result] = await pool.query(
            `
            INSERT INTO venues
            (
                venue_name,
                building,
                capacity
            )
            VALUES (?, ?, ?)
            `,
            [
                venue_name,
                building,
                capacity
            ]
        );

        res.status(201).json({
            success: true,
            message: "Venue created",
            venue_id: result.insertId
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});


app.delete("/api/venues/:id", async (req, res) => {
    try {
        const [result] = await pool.query(
            `
            DELETE FROM venues
            WHERE venue_id = ?
            `,
            [req.params.id]
        );

        if (!result.affectedRows) {
            return res.status(404).json({
                success: false,
                message: "Venue not found."
            });
        }

        res.json({
            success: true,
            message: "Venue deleted successfully."
        });

    } catch (error) {
        if (
            error.code === "ER_ROW_IS_REFERENCED" ||
            error.code === "ER_ROW_IS_REFERENCED_2"
        ) {
            return res.status(409).json({
                success: false,
                message:
                    "Cannot delete venue because related examination records exist."
            });
        }

        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});


/*
=========================================================
EXAMINATIONS
=========================================================
*/

app.get("/api/examinations", async (req, res) => {
    try {
        const [rows] = await pool.query(
            `
            SELECT
                e.examination_id,
                e.course_id,
                c.course_code,
                c.course_name,
                e.venue_id,
                v.venue_name,
                v.building,
                DATE_FORMAT(
                    e.exam_date,
                    '%Y-%m-%d'
                ) AS exam_date,
                e.start_time,
                e.end_time,
                e.exam_type
            FROM examinations e
            LEFT JOIN courses c
                ON e.course_id = c.course_id
            LEFT JOIN venues v
                ON e.venue_id = v.venue_id
            ORDER BY e.exam_date ASC,
                     e.start_time ASC
            `
        );

        res.json({
            success: true,
            data: rows
        });

    } catch (error) {
        console.error("Examinations error:", error.message);

        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});


app.post("/api/examinations", async (req, res) => {
    /*
    Accept Haikal frontend field names.
    */

    const {
        course_id,
        venue_id,
        exam_date,
        start_time,
        end_time,
        exam_type
    } = req.body;

    if (
        !course_id ||
        !venue_id ||
        !exam_date ||
        !start_time ||
        !end_time ||
        !exam_type
    ) {
        return res.status(400).json({
            success: false,
            message: "All examination fields are required."
        });
    }

    if (start_time >= end_time) {
        return res.status(400).json({
            success: false,
            message: "End time must be after start time."
        });
    }

    try {
        /*
        Danziq API's venue conflict checking.
        */

        const [conflict] = await pool.query(
            `
            SELECT examination_id
            FROM examinations
            WHERE venue_id = ?
              AND exam_date = ?
              AND start_time < ?
              AND end_time > ?
            `,
            [
                venue_id,
                exam_date,
                end_time,
                start_time
            ]
        );

        if (conflict.length) {
            return res.status(409).json({
                success: false,
                message:
                    "Venue already has an examination during this time."
            });
        }

        const [result] = await pool.query(
            `
            INSERT INTO examinations
            (
                course_id,
                venue_id,
                exam_date,
                start_time,
                end_time,
                exam_type
            )
            VALUES (?, ?, ?, ?, ?, ?)
            `,
            [
                course_id,
                venue_id,
                exam_date,
                start_time,
                end_time,
                exam_type
            ]
        );

        res.status(201).json({
            success: true,
            message: "Examination created",
            examination_id: result.insertId
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});


app.delete("/api/examinations/:id", async (req, res) => {
    try {
        const [result] = await pool.query(
            `
            DELETE FROM examinations
            WHERE examination_id = ?
            `,
            [req.params.id]
        );

        if (!result.affectedRows) {
            return res.status(404).json({
                success: false,
                message: "Examination not found."
            });
        }

        res.json({
            success: true,
            message: "Examination deleted successfully."
        });

    } catch (error) {
        if (
            error.code === "ER_ROW_IS_REFERENCED" ||
            error.code === "ER_ROW_IS_REFERENCED_2"
        ) {
            return res.status(409).json({
                success: false,
                message:
                    "Cannot delete examination because related result records exist."
            });
        }

        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});


/*
=========================================================
RESULTS
=========================================================
*/

app.get("/api/results", async (req, res) => {
    try {
        const [rows] = await pool.query(
            `
            SELECT
                r.result_id,
                r.student_id,
                u.student_id AS student_code,
                u.full_name,
                r.examination_id,
                c.course_code,
                c.course_name,
                r.marks,
                r.grade,
                r.status
            FROM results r
            LEFT JOIN users u
                ON r.student_id = u.user_id
            LEFT JOIN examinations e
                ON r.examination_id = e.examination_id
            LEFT JOIN courses c
                ON e.course_id = c.course_id
            ORDER BY u.full_name,
                     c.course_code
            `
        );

        /*
        The frontend expects:
        student_id
        full_name
        course_code
        marks
        grade
        status

        Those fields are already returned above.
        */

        res.json({
            success: true,
            data: rows
        });

    } catch (error) {
        console.error("Results error:", error.message);

        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});


/*
Student result endpoint.

The existing Haikal frontend calls:
GET /api/results/my-results

For compatibility, return results for the logged-in
student using the email/user information sent by login.

Because Danziq API does not use JWT, we use the
student_id query/header information when available.
*/

app.get("/api/results/my-results", async (req, res) => {
    try {
        const studentId =
            req.query.student_id ||
            req.headers["x-student-id"];

        if (!studentId) {
            /*
            If no student ID is supplied, return an empty
            result instead of breaking the frontend.
            */

            return res.json({
                success: true,
                data: []
            });
        }

        const [rows] = await pool.query(
            `
            SELECT
                r.result_id,
                r.student_id,
                u.full_name,
                c.course_code,
                c.course_name,
                r.marks,
                r.grade,
                r.status
            FROM results r
            JOIN users u
                ON r.student_id = u.user_id
            JOIN examinations e
                ON r.examination_id = e.examination_id
            JOIN courses c
                ON e.course_id = c.course_id
            WHERE r.student_id = ?
            ORDER BY c.course_code
            `,
            [studentId]
        );

        res.json({
            success: true,
            data: rows
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});


app.post("/api/results", async (req, res) => {
    /*
    Accept the exact fields sent by Haikal frontend.
    */

    const {
        student_id,
        examination_id,
        marks,
        grade,
        status
    } = req.body;

    if (
        !student_id ||
        !examination_id ||
        marks === undefined ||
        !grade ||
        !status
    ) {
        return res.status(400).json({
            success: false,
            message: "All result fields are required."
        });
    }

    try {
        const [result] = await pool.query(
            `
            INSERT INTO results
            (
                student_id,
                examination_id,
                marks,
                grade,
                status
            )
            VALUES (?, ?, ?, ?, ?)
            `,
            [
                student_id,
                examination_id,
                marks,
                grade,
                status.toUpperCase()
            ]
        );

        res.status(201).json({
            success: true,
            message: "Result created",
            result_id: result.insertId
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});


app.delete("/api/results/:id", async (req, res) => {
    try {
        const [result] = await pool.query(
            `
            DELETE FROM results
            WHERE result_id = ?
            `,
            [req.params.id]
        );

        if (!result.affectedRows) {
            return res.status(404).json({
                success: false,
                message: "Result not found."
            });
        }

        res.json({
            success: true,
            message: "Result deleted successfully."
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});


/*
=========================================================
REGISTRATIONS
=========================================================
*/

app.get("/api/registrations", async (req, res) => {
    try {
        const [rows] = await pool.query(
            `
            SELECT
                r.registration_id,
                r.student_id,
                u.student_id AS student_code,
                u.full_name,
                r.course_id,
                c.course_code,
                c.course_name,
                r.semester,
                DATE_FORMAT(
                    r.registration_date,
                    '%Y-%m-%d'
                ) AS registration_date
            FROM registrations r
            LEFT JOIN users u
                ON r.student_id = u.user_id
            LEFT JOIN courses c
                ON r.course_id = c.course_id
            ORDER BY r.registration_id
            `
        );

        res.json({
            success: true,
            data: rows
        });

    } catch (error) {
        console.error("Registrations error:", error.message);

        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});


app.post("/api/registrations", async (req, res) => {
    const {
        student_id,
        course_id,
        semester,
        registration_date
    } = req.body;

    try {
        const [result] = await pool.query(
            `
            INSERT INTO registrations
            (
                student_id,
                course_id,
                semester,
                registration_date
            )
            VALUES (?, ?, ?, ?)
            `,
            [
                student_id,
                course_id,
                semester,
                registration_date || new Date()
            ]
        );

        res.status(201).json({
            success: true,
            message: "Registration created",
            registration_id: result.insertId
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});


app.delete("/api/registrations/:id", async (req, res) => {
    try {
        const [result] = await pool.query(
            `
            DELETE FROM registrations
            WHERE registration_id = ?
            `,
            [req.params.id]
        );

        if (!result.affectedRows) {
            return res.status(404).json({
                success: false,
                message: "Registration not found."
            });
        }

        res.json({
            success: true,
            message: "Registration deleted successfully."
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});


/*
=========================================================
START SERVER
=========================================================
*/

app.listen(PORT, async () => {
    console.log(
        `ExamSync API running at http://localhost:${PORT}`
    );

    try {
        const connection = await pool.getConnection();

        console.log(
            `Successfully connected to MySQL database: "${dbConfig.database}"`
        );

        const [users] = await connection.query(
            "SELECT COUNT(*) AS count FROM users"
        );

        console.log(
            `Connected! Found ${users[0].count} existing user records in "users" table.`
        );

        connection.release();

    } catch (error) {
        console.error(
            "Database Connection Error:",
            error.message
        );
        console.error(
            "Please check DB_HOST, DB_USER, DB_PASSWORD and DB_NAME in .env"
        );
    }
});
