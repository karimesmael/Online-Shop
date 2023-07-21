const express = require("express");
const router = express.Router();
const authController = require("../controllers/auth");
const { check, body } = require("express-validator");
const User = require("../models/user");

router.get("/login", authController.getLogin);
router.post("/login", authController.postLogin);

router.get("/signup", authController.getSignup);

router.post(
  "/signup",
  body("username")
    .isLength({ min: 4 })
    .withMessage("username should be at least 4 ch")
    .custom(async (value, { req }) => {
      const user = await User.findOne({ username: value });
      if (user) {
        throw new Error(
          "this username is already used please enter another one"
        );
      }
    })
    .trim(),
  check("email")
    .isEmail()
    .withMessage("please enter a valid email!")
    .custom(async (value, { req }) => {
      const user = await User.findOne({ email: value });
      if (user) {
        throw new Error("this email is already used please enter another one");
      }
    }),
  body(
    "password",
    "password should be at least 8 characters and should have at least 1 uppercase , 1 lowercase and 1 symbol(@,#,$,...)  "
  ).isStrongPassword({
    min: 8,
    minLowercase: 1,
    minUppercase: 1,
  }),
  body("confirmPassword").custom((value, { req }) => {
    if (value !== req.body.password) {
      throw new Error("Passwords have to match!");
    }
    return true;
  }),
  authController.postSignup
);

router.post("/logout", authController.postLogout);

router.get("/reset", authController.getReset);
router.post(
  "/reset",
  body("email").isEmail().withMessage("please enter a valid email!"),
  authController.postReset
);

router.get("/reset/:token", authController.getNewPassword);

router.post(
  "/new-password",
  check("password", "password should be at least 6 ch!").isLength({ min: 6 }),
  check("confirmPassword").custom((value, { req }) => {
    if (value !== req.body.password) {
      throw new Error("Passwords have to match!");
    }
    return true;
  }),
  authController.postNewPassword
);

module.exports = router;
