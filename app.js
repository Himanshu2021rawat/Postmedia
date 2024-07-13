const express = require("express");
const app = express();
const cookieParser = require("cookie-parser");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const path = require("path");
const methodOverride = require("method-override");

app.use(methodOverride("_method"));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));
app.use(express.urlencoded({ extended: true }));
app.set("view engine", "ejs");

const userModel = require("./models/user");
const postModel = require("./models/post");
const upload = require("./util/multerconfig");

app.get("/", (req, res) => {
  res.render("index");
});

app.get("/profile/upload", (req, res) => {
  res.render("profileupload");
});

app.post("/upload", isLoggedIn, upload.single("profile"), async (req, res) => {
  let user = await userModel.findOne({ email: req.user.email });

  user.profile = req.file.filename;
  await user.save();
  res.redirect("/profile");
});

app.post("/register", async (req, res) => {
  let { username, name, email, password } = req.body;

  if (username !== "" && name != " " && email !== "" && password !== "") {
    let user = await userModel.findOne({ email });

    if (user) res.status(401).redirect("/Error");

    bcrypt.genSalt(10, (err, salt) => {
      if (err) {
        console.log("Error occurred while creating Salt");
      } else {
        bcrypt.hash(password, salt, async (err, hash) => {
          if (err) {
            console.log("Error occurred while creating hash");
          } else {
            let userCreated = await userModel.create({
              username,
              name,
              email,
              password: hash,
            });

            let token = jwt.sign({ email, username }, "shhhhh");
            res.cookie("token", token);
            console.log(token);
            res.redirect("/login");
          }
        });
      }
    });
  } else {
    res.redirect("/");
  }
});

app.get("/login", (req, res) => {
  res.render("login");
});

app.get("/Error", (req, res) => {
  res.render("Error");
});

app.post("/login", async (req, res) => {
  let { username, email, password } = req.body;

  if (username !== "" && email !== "" && password !== "") {
    try {
      let user = await userModel.findOne({ email });

      if (!user) {
        return res.status(401).redirect("/Error");
      }

      bcrypt.compare(password, user.password, (err, result) => {
        if (err) {
          return res.status(500).redirect("/Error");
        }

        if (result) {
          let token = jwt.sign({ email, username }, "shhhhh");
          res.cookie("token", token);
          res.redirect("/profile");
        } else {
          res.status(401).redirect("/Error");
        }
      });
    } catch (err) {
      res.status(500).redirect("/Error");
    }
  } else {
    res.redirect("/login");
  }
});

app.get("/logout", (req, res) => {
  res.cookie("token", "");
  res.redirect("/");
});

app.get("/profile", isLoggedIn, async (req, res) => {
  let user = await userModel
    .findOne({ email: req.user.email })
    .populate("posts");
  res.render("profile", { user });
});

app.post("/post", isLoggedIn, async (req, res) => {
  let { content } = req.body;
  let user = await userModel.findOne({ email: req.user.email });

  let post = await postModel.create({
    user: user._id,
    content,
  });

  user.posts.push(post._id);
  await user.save();
  res.redirect("/profile");
});

app.post("/delete/:id", isLoggedIn, async (req, res) => {
  try {
    await postModel.findOneAndDelete({ _id: req.params.id });
    res.redirect("/profile");
  } catch (err) {
    res.status(500).send("Error deleting post");
  }
});

app.get("/like/:id", isLoggedIn, async (req, res) => {
  let post = await postModel.findOne({ _id: req.params.id }).populate("user");

  if (post.likes.indexOf(req.user.userid) === -1) {
    post.likes.push(req.user.userid);
  } else {
    post.likes.splice(post.likes.indexOf(req.user.userid), 1);
  }
  await post.save();
  res.redirect("/profile");
});

app.get("/edit/:id", isLoggedIn, async (req, res) => {
  let post = await postModel.findOne({ _id: req.params.id }).populate("user");
  res.render("edit", { post });
});

app.post("/update/:id", isLoggedIn, async (req, res) => {
  let post = await postModel.findOneAndUpdate(
    { _id: req.params.id },
    { content: req.body.content }
  );
  res.redirect("/profile");
});

app.get("/edit/:id", isLoggedIn, (req, res) => {
  res.send(req.params.id);
});

app.get("/read/:id", isLoggedIn, fetchPost, (req, res) => {
  res.render("read", { user: req.user, post: req.post });
});

function isLoggedIn(req, res, next) {
  if (req.cookies.token === "") res.redirect("/login");
  else {
    let data = jwt.verify(req.cookies.token, "shhhhh");
    req.user = data;

    next();
  }
}

async function fetchPost(req, res, next) {
  try {
    let post = await postModel.findOne({ _id: req.params.id }).populate("user");
    if (!post) {
      return res.status(404).send("Post not found");
    }
    req.post = post;
    next();
  } catch (err) {
    console.error(err);
    res.status(500).send("Internal Server Error");
  }
}

app.listen(3000);
