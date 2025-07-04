const express = require("express");
const path = require("path");
const sqlite3 = require("sqlite3").verbose();
const session = require("express-session");
const multer = require("multer");
const app = express();
const port = 3000;


app.use(express.urlencoded({ extended: true }));
app.use(express.json());


const db = new sqlite3.Database("movie_rental.db", sqlite3.OPEN_READWRITE, (err) => {
  if (err) console.error("DB error:", err.message);
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "images"),
  filename: (req, file, cb) => {
    const title = req.body.title; 
    const ext = path.extname(file.originalname);
    const safeTitle = title ? title.replace(/[^a-zA-Z0-9-_.]/g, '') : 'untitled'; 
    const safeName = `${safeTitle}${ext}`; 
    cb(null, safeName);
  },
});

const upload = multer({ storage });


app.use(express.json());
app.use(express.static("public"));
app.use("/images", express.static(path.join(__dirname, "images")));
app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    secret: "zzz-login-secret",
    resave: false,
    saveUninitialized: true,
  })
);

app.get("/movies", (req, res) => {
  const query = `
    SELECT m.*, c.name AS categoryName
    FROM Movie m
    JOIN Category c ON m.categoryId = c.id
  `;
  db.all(query, [], (err, rows) => {
    if (err) {
      console.error("DB error:", err.message);
      res.status(500).send("Database error");
    } else {
      res.json(rows);
    }
  });
});


app.post("/login", (req, res) => {
  const { email, password } = req.body;
  const query = "SELECT * FROM User WHERE email = ? AND password = ?";
  db.get(query, [email, password], (err, user) => {
    if (err) return res.status(500).send("Server error");
    if (!user) return res.status(401).send("Invalid credentials");
    if (user.status === "banned") return res.status(403).send("You are banned. Contact the administrator.");
    req.session.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      isAdmin: user.isAdmin,
    };
    res.redirect("/zzz.html");
  });
});

app.get("/profile", (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: "Not logged in" });
  res.json(req.session.user);
});

app.get("/rentals/:userId", (req, res) => {
  const userId = req.params.userId;
  const query = `
    SELECT m.title, m.description, m.releaseYear, m.price, o.date, DATE(o.date, '+14 days') AS expiryDate
    FROM "Order" o
    JOIN OrderItem oi ON o.id = oi.orderId
    JOIN Movie m ON oi.movieId = m.id
    WHERE o.userId = ?
    ORDER BY o.date DESC
  `;
  db.all(query, [userId], (err, rows) => {
    if (err) {
      console.error("Rental fetch error:", err.message);
      res.status(500).json({ error: "Failed to fetch rentals" });
    } else {
      res.json(rows);
    }
  });
});

app.post("/rent", (req, res) => {
  const { movieId, quantity, method } = req.body;
  const userId = req.session.user?.id;
  if (!userId) return res.status(401).json({ error: "Not logged in" });

  db.serialize(() => {
    db.get(
      `SELECT 1 FROM "Order"
       JOIN OrderItem ON "Order".id = OrderItem.orderId
       WHERE "Order".userId = ? AND OrderItem.movieId = ?
       LIMIT 1`,
      [userId, movieId],
      (err, row) => {
        if (err) return res.status(500).json({ error: "Check error" });
        if (row) return res.status(400).json({ error: "Already rented" });

        db.get("SELECT price FROM Movie WHERE id = ?", [movieId], (err2, movie) => {
          if (err2 || !movie) return res.status(500).json({ error: "Movie error" });

          const totalAmount = movie.price * quantity;

          db.run(
            `INSERT INTO "Order" (userId, date, totalAmount) VALUES (?, datetime('now'), ?)`,
            [userId, totalAmount],
            function (err3) {
              if (err3) {
                console.error("Insert order error:", err3.message);
                return res.status(500).json({ error: "Create order error" });
              }

              const orderId = this.lastID;

              db.run(
                `INSERT INTO OrderItem (orderId, movieId, quantity) VALUES (?, ?, ?)`,
                [orderId, movieId, quantity],
                (err4) => {
                  if (err4) {
                    console.error("Insert order item error:", err4.message);
                    return res.status(500).json({ error: "Insert item error" });
                  }

                  db.run(
                    `INSERT INTO Payment (orderId, method, timestamp, status) VALUES (?, ?, datetime('now'), 'Success')`,
                    [orderId, method],
                    (err5) => {
                      if (err5) {
                        console.error("Insert payment error:", err5.message);
                        return res.status(500).json({ error: "Payment error" });
                      }

                      res.json({ message: "Rental completed" });
                    }
                  );
                }
              );
            }
          );
        });
      }
    );
  });
});

app.delete("/delete-rental", (req, res) => {
  const { userId, title, date } = req.body;
  db.serialize(() => {
    const subQuery = `
      SELECT o.id
      FROM "Order" o
      JOIN OrderItem oi ON o.id = oi.orderId
      JOIN Movie m ON oi.movieId = m.id
      WHERE o.userId = ? AND m.title = ? AND o.date = ?
    `;
    db.all(subQuery, [userId, title, date], (err, orders) => {
      if (err || !orders.length) return res.status(500).json({ success: false });

      const ids = orders.map((o) => o.id);
      const placeholders = ids.map(() => "?").join(",");

      db.run(`DELETE FROM Payment WHERE orderId IN (${placeholders})`, ids, (err1) => {
        if (err1) return res.status(500).json({ success: false });

        db.run(`DELETE FROM OrderItem WHERE orderId IN (${placeholders})`, ids, (err2) => {
          if (err2) return res.status(500).json({ success: false });

          db.run(`DELETE FROM "Order" WHERE id IN (${placeholders})`, ids, (err3) => {
            if (err3) return res.status(500).json({ success: false });
            res.json({ success: true });
          });
        });
      });
    });
  });
});

app.get("/logout", (req, res) => {
  req.session.destroy(() => res.redirect("/index.html"));
});

app.post("/register", (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).send("Missing fields");
  }

  db.get("SELECT * FROM User WHERE email = ?", [email], (err, user) => {
    if (err) return res.status(500).send("Database error");
    if (user) return res.status(400).send("Email already registered");

    db.run(
      "INSERT INTO User (name, email, password, isAdmin, status) VALUES (?, ?, ?, 0, 'active')",
      [name, email, password],
      function (err2) {
        if (err2) return res.status(500).send("Failed to register");
        req.session.user = {
          id: this.lastID,
          name,
          email,
          isAdmin: 0,
          status: "active",
        };
        res.redirect("/zzz.html");
      }
    );
  });
});

app.post("/forgot-password", (req, res) => {
  const email = req.body.email;
  if (!email) return res.status(400).send("Please enter your email");

  db.get("SELECT password FROM User WHERE email = ?", [email], (err, row) => {
    if (err) return res.status(500).send("Server error");
    if (!row) return res.status(404).send("Email not found");

    res.send(`<strong>Your password is:</strong> ${row.password}`);
  });
});

app.get("/all-users", (req, res) => {
  db.all("SELECT id, name, email, isAdmin, status FROM User", (err, rows) => {
    if (err) return res.status(500).json([]);
    res.json(rows);
  });
});

app.post("/user/:id/:action", (req, res) => {
  const { id, action } = req.params;
  const status = action === "ban" ? "banned" : "active";
  db.run("UPDATE User SET status = ? WHERE id = ?", [status, id], (err) => {
    if (err) return res.status(500).json({ success: false });
    res.json({ success: true });
  });
});

app.delete("/user/:id", (req, res) => {
  db.run("DELETE FROM User WHERE id = ?", [req.params.id], (err) => {
    if (err) return res.status(500).json({ success: false });
    res.json({ success: true });
  });
});

app.get("/categories", (req, res) => {
  db.all("SELECT id, name FROM Category", (err, rows) => {
    if (err) return res.status(500).json([]);
    res.json(rows);
  });
});


app.post("/admin/add-movie", upload.single("image"), (req, res) => {
  const { title, description, releaseYear, rating, duration, price, categoryId } = req.body;

  const query = `
    INSERT INTO Movie (title, description, releaseYear, rating, duration, price, categoryId)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `;

  db.run(query, [title, description, releaseYear, rating, duration, price, categoryId], (err) => {
    if (err) {
      console.error("Add movie error:", err.message);
      return res.json({ success: false });
    }
    res.json({ success: true });
  });
});

app.delete("/admin/delete-movie/:id", (req, res) => {
  db.run("DELETE FROM Movie WHERE id = ?", [req.params.id], (err) => {
    if (err) return res.json({ success: false });
    res.json({ success: true });
  });
});


app.post("/admin/edit-movie", (req, res) => {
  const {
    id,
    title,
    description,
    releaseYear,
    rating,
    duration,
    price,
    categoryId
  } = req.body;

  const parsedId = parseInt(id);
  if (isNaN(parsedId)) {
    return res.json({ success: false, error: "Invalid movie ID" });
  }

  const query = `
    UPDATE Movie
    SET title = ?, description = ?, releaseYear = ?, rating = ?, duration = ?, price = ?, categoryId = ?
    WHERE id = ?
  `;

  const params = [
    title,
    description,
    parseInt(releaseYear),
    rating,
    parseInt(duration),
    parseFloat(price),
    parseInt(categoryId),
    parsedId
  ];

  db.run(query, params, function (err) {
    if (err) {
      return res.json({ success: false, error: err.message });
    }
    res.json({ success: true });
  });
});


app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});

