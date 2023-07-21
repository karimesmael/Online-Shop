const User = require("../models/user");
const bcrypt = require("bcryptjs");
const nodemailer = require("nodemailer");
const sendgridTransport = require("nodemailer-sendgrid-transport");
const { validationResult } = require("express-validator");
const crypto = require("crypto"); // for making token used in resetting password.

const transporter = nodemailer.createTransport(
  sendgridTransport({
    auth: {
      api_key:
        "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",
    },
  })
);

exports.getLogin = (req, res, next) => {
  if (req.session.isLoggedIn) {
    return res.redirect("/");
  }

  res.render("auth/login", {
    path: "/login",
    pageTitle: "LogIn",
    errMsg: "",
    oldData: { email: "", password: "" },
  });
};

exports.postLogin = async (req, res, next) => {
  const email = req.body.email;
  const password = req.body.password;
  let user = await User.findOne({ email: email });
  if (!user) {
    return res.render("auth/login", {
      path: "/login",
      pageTitle: "LogIn",
      errMsg: "Invalid email or password",
      oldData: { email: email, password: password },
    });
  }
  bcrypt.compare(password, user.password).then((matched) => {
    if (matched) {
      req.session.isLoggedIn = true;
      req.session.user = user;
      return req.session.save((err) => {
        return res.redirect("/");
      });
    }
    return res.render("auth/login", {
      path: "/login",
      pageTitle: "LogIn",
      errMsg: "Invalid email or password",
      oldData: { email: email, password: password },
    });
  });
};

exports.getSignup = (req, res, next) => {
  if (req.session.isLoggedIn) {
    return res.redirect("/");
  }
  res.render("auth/signup", {
    path: "/signup",
    pageTitle: "Sign Up",
    errMsg: "",
    oldData: {
      username: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
    validationErrors: [],
  });
};
exports.postSignup = (req, res, next) => {
  const username = req.body.username.trim();
  const email = req.body.email;
  const password = req.body.password;
  const confirmPassword = req.body.confirmPassword;
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).render("auth/signup", {
      path: "/signup",
      pageTitle: "Sign Up",
      errMsg: errors.array()[0].msg,
      oldData: {
        username: username,
        email: email,
        password: password,
        confirmPassword: confirmPassword,
      },
      validationErrors: errors.array(),
    });
  }

  bcrypt
    .hash(password, 12)
    .then((hashedPassword) => {
      const user = new User({
        username: username,
        email: email,
        password: hashedPassword,
        cart: { items: [] },
      });
      return user.save();
    })
    .then((result) => {
      transporter.sendMail({
        to: email,
        from: "karimesma3el407@gmail.com",
        subject: "Signup succeedded!",
        html: "<h1>you successfully signed up!</h1>",
      });
      res.redirect("/login");
    })
    .catch((err) => {
      console.log(err);
    });
};

exports.postLogout = (req, res, next) => {
  req.session.destroy((err) => {
    console.log(err);
    res.redirect("/login");
  });
};

exports.getReset = (req, res, next) => {
  let msg = req.flash("error");
  if (msg.length > 0) {
    msg = msg[0];
  } else {
    msg = null;
  }
  if (!req.session.isLoggedIn) {
    res.render("auth/reset", {
      path: "/reset",
      pageTitle: "Resetting your Password",
      errMsg: msg,
    });
  } else {
    res.redirect("/");
  }
};
///////////////////////////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////////////////////////
exports.postReset = (req, res, next) => {
  const error = validationResult(req);

  if (!error.isEmpty()) {
    return res.render("auth/reset", {
      path: "/reset",
      pageTitle: "Resetting your Password",
      errMsg: error.array()[0].msg,
    });
  }
  crypto.randomBytes(32, async (err, buffer) => {
    if (err) {
      console.log(err);
      res.redirect("/reset");
    }
    const token = buffer.toString("hex");
    let user = await User.findOne({ email: req.body.email });
    if (!user) {
      req.flash("error", "this email doesn't belong to any user account !");
      return res.redirect("/reset");
    }
    user.resetToken = token;
    user.resetTokenExpiration = Date.now() + 3600000;
    await user.save();

    transporter.sendMail({
      to: req.body.email,
      from: "karimesma3el407@gmail.com",
      subject: "Password reset",
      html: `
          <p>You requested a password reset </p>
          <p>click this <a href="http://localhost:3000/reset/${token}">link</a> to reset your password</p>
          `,
    });
    return res.redirect("/");
  });
};
///////////////////////////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////////////////////////
exports.getNewPassword = (req, res, next) => {
  const token = req.params.token;
  User.findOne({
    resetToken: token,
    resetTokenExpiration: { $gt: Date.now() },
  })
    .then((user) => {
      res.render("auth/new-password", {
        path: "/new-password",
        pageTitle: "New Password",
        errMsg: "",
        userId: user._id.toString(),
        passwordToken: token,
      });
    })
    .catch((err) => {
      console.log(err);
      res.redirect("/");
    });
};
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////
exports.postNewPassword = async (req, res, next) => {
  const newPassword = req.body.password;
  const passwordToken = req.body.passwordToken;
  const userId = req.body.userId;
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return await res.render("auth/new-password", {
      path: "/new-password",
      pageTitle: "New Password",
      errMsg: errors.array()[0].msg,
      userId: userId,
      passwordToken: passwordToken,
    });
  }
  try {
    let user = await User.findOne({
      resetToken: passwordToken,
      resetTokenExpiration: { $gt: Date.now() },
      _id: userId,
    });
    const hashedPassword = await bcrypt.hash(newPassword, 12);
    user.password = hashedPassword;
    user.resetToken = undefined;
    user.resetTokenExpiration = undefined;
    user.save();
    res.redirect("/login");
  } catch {
    const error = new Error("something wrong!");
    error.httpStatusCode = 500;
    next(error);
  }
};
