const express = require("express");
const adminController = require("../controllers/admin");
const router = express.Router();
const isAuth = require("../middleware/is-auth");

router.get("/add-product", isAuth, adminController.getAddProduct);
router.get("/edit-product/:productId", isAuth, adminController.getEditProduct);
router.get("/products", isAuth, adminController.getProducts);

router.post("/edit-product", isAuth, adminController.postEditProduct);
router.post("/add-product", isAuth, adminController.postAddProduct);
router.delete("/product/:productId", isAuth, adminController.deleteProduct);

module.exports = router;
