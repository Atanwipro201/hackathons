import express from "express";
import bodyparser from "body-parser";
import pg from "pg";
import env from "dotenv";
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import ejs from "ejs";
import session from "express-session";
//constants
env.config();
const app = express();
const port = process.env.PORT || 3000;
const id = 1;
app.use(express.static("public"));

app.use(
  session({
    secret: process.env.SECRET_SESSION_PSWD, // use a strong secret in production!
    resave: false,
    saveUninitialized: false,
  })
);

app.use(passport.initialize());
app.use(passport.session());
const User = {
  findOrCreate: async ({ googleId, email, name }) => {
    return {
      id: googleId,
      email,
      name,
    };
  },
};

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL:
        process.env.GOOGLE_CALLBACK_URL ||
        "http://localhost:3000/auth/google/callback",
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails[0].value;
        const user = await User.findOrCreate({
          googleId: profile.id,
          email,
          name: profile.displayName,
        });
        return done(null, user);
      } catch (err) {
        return done(err);
      }
    }
  )
);

//initialize db

const db = new pg.Client({
  user: process.env.POSTGRES_USER,
  host: process.env.POSTGRES_HOST,
  database: process.env.POSTGRES_DATABASE,
  password: process.env.POSTGRES_PASSWORD,
  connectionString: process.env.POSTGRES_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});
db.connect();
function getYesterday(today) {
  //get yesterdays date
  var date = new Date();
  date.setDate(date.getDate() - 1);
  return date.toDateString();
}
async function idExists(id) {
  const response = await db.query("SELECT * FROM streaks WHERE user_id=$1", [
    id,
  ]);
  console.log(response.rows);
  if (response.rows.length > 0) {
    return true;
  } else {
    return false;
  }
}

app.use(bodyparser.urlencoded({ extended: true }));

app.get("/db", async (req, res) => {
  const yesterday = getYesterday();
  console.log(yesterday);
  const id = "108029300227540227630";
  //get users last streak date
  try {
    const response = await db.query(
      "UPDATE streaks SET last_streak_day = $1 WHERE user_id = $2 RETURNING *",
      [yesterday, id]
    );
    console.log(response.rows);
  } catch (err) {
    console.log(err);
  }
  res.send("query sent");
});
app.get("/login", (req, res) => {
  res.render("login.ejs");
});
app.get(
  "/auth/google",
  passport.authenticate("google", {
    scope: ["profile", "email"],
  })
);
app.get(
  "/auth/google/callback",
  passport.authenticate("google", {
    failureRedirect: "/login",
    successRedirect: "/",
  })
);
//main page
app.get("/", async (req, res) => {
  //check if auth
  if (req.isAuthenticated()) {
    //check if logged
    if (await idExists(req.user.id)) {
      console.log("id exists");
      const response = await db.query(
        "SELECT * FROM streaks WHERE user_id = $1",
        [req.user.id]
      );
      console.log(await idExists(req.user.id));
      res.render("index.ejs", { user: response.rows[0] });
    }

    //not logged
    else {
      console.log("id doen't exist");
      const response = await db.query(
        "INSERT INTO streaks(user_id,current_streak,streak_lost,best_streak) VALUES ($1,0,0,0) RETURNING *",
        [req.user.id]
      );
      console.log(await idExists(req.user.id));
      res.render("index.ejs", { user: response.rows[0] });
    }
    console.log(req.user);
  } // not auth
  else {
    res.redirect("/login");
  }
});

//get new streak
app.post("/addstreak", async (req, res) => {
  console.log("/addstreak");
  //get info for the process
  const response = await db.query("SELECT * FROM streaks WHERE user_id = $1", [
    req.body.id,
  ]);

  const yesterday = getYesterday();
  const today = new Date().toDateString();
  var last_streak_day = response.rows[0].last_streak_day;
  var current_streak = response.rows[0].current_streak;

  console.log(today === last_streak_day);

  //check if yesterday they did the streak
  if (yesterday == last_streak_day) {
    var new_streak = current_streak + 1;
    console.log("streak: ", new_streak);
    db.query(
      "UPDATE streaks SET current_streak=$1,last_streak_day=$3 WHERE user_id = $2",
      [new_streak, req.body.id, today]
    );
    //checks if they already checked today
  } else if (today === response.rows[0].last_streak_day) {
    console.log("done already");
    //new streak
  } else {
    var new_streak = 1;
    console.log("streak 1");
    db.query("UPDATE streaks SET current_streak = $1 WHERE user_id = $2", [
      new_streak,
      req.body.id,
    ]);
  }

  //sets best score
  if (new_streak > response.rows[0].best_streak) {
    db.query(
      "UPDATE streaks SET best_streak=$1,last_streak_day=$3 WHERE user_id = $2",
      [new_streak, req.body.id, today]
    );
  }

  res.redirect("/");
});

passport.serializeUser((user, done) => {
  done(null, user.id); // save user ID to session
});

passport.deserializeUser(async (id, done) => {
  // Find user by ID from your DB or dummy User
  // For now, just return the user object directly:
  try {
    // If you had a real DB, fetch user by id here
    // e.g. const user = await db.query(...);
    const user = { id }; // dummy user, expand as needed
    done(null, user);
  } catch (err) {
    done(err);
  }
});

//port setup
app.listen(port, (err) => {
  console.log("running on port: " + port);
});
