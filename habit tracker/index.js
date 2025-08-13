import express from "express";
import bodyparser from "body-parser";
import pg from "pg";
import env from "dotenv";
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: "http://www.example.com/auth/google/callback",
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const user = await User.findOrCreate({ googleId: profile.id });
        console.log(user);
        return done(null, user);
      } catch (err) {
        return done(err);
      }
    }
  )
);

//constants / main things to use in all the app
const id = 1;
env.config();
const db = new pg.Client({
  user: process.env.POSTGRES_USER,
  host: process.env.POSTGRES_HOST,
  database: process.env.POSTGRES_NAME,
  password: process.env.POSTGRES_PSWD,
  port: process.env.POSTGRES_PORT,
});
function getYesterday() {
  //get yesterdays date
  var date = new Date();
  date.setDate(date.getDate() - 1);
  console.log(date.toDateString());
  return date.toDateString();
}

db.connect();
const app = express();
const port = 3000;
app.use(bodyparser.urlencoded({ extended: true }));

app.get("/", async (req, res) => {
  const yesterday = getYesterday();

  //get users last streak date
  try {
    response = await db.query("SELECT * FROM users WHERE email=$1", ["hello"]);
    console.log(response);
  } catch (err) {
    console.log(err);
  }
  res.send("query sent");
});
app.get("/login", (req, res) => {
  res.send("working");
  passport.authenticate("google", { scope: ["profile", "email"] });
});

//port setup
app.listen(port, (err) => {
  console.log("running on port: " + port);
});
