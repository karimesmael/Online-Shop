const express = require("express");
const router = express.Router();
const profController = require("../controllers/profile");

router.get("/profile/:userId", profController.getProfile);

module.exports = router;
