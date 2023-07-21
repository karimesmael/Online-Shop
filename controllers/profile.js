const User = require("../models/user");
const Product = require("../models/product");
exports.getProfile = async (req, res, next) => {
  try {
    const userId = req.params.userId;
    const user = await User.findById(userId);
    const products = await Product.find({ userId: userId });
    res.render("user/profile.ejs", {
      pageTitle: user.username,
      prods: products,
      profileUser: user,
      path: "",
    });
  } catch {
    res.redirect("/");
  }
};
