const Product = require("../models/product");
const User = require("../models/user");
const Order = require("../models/order");
const fs = require("fs");
const path = require("path");
const PDFDocument = require("pdfkit");
// const stripe = require("stripe")(
//   "sk_test_51NJlWdH712dShb27aahhqFYMMGwNjs6Cesy9auaHAHyxciwqEBnlNHCxerlPwVEL57oenjIUGOfMfNT4cCPbxPr600Gs4dxSBK"
// );

exports.getProducts = async (req, res, next) => {
  const page = +req.query.page || 1;
  const ITEMS_PER_PAGE = 3;
  let totalItems = await Product.find().countDocuments();

  let products = await Product.find()
    .skip((page - 1) * ITEMS_PER_PAGE)
    .limit(ITEMS_PER_PAGE);

  res.render("shop/index", {
    prods: products,
    pageTitle: "All Products",
    path: "/products",
    currentPage: page,
    hasNextPage: ITEMS_PER_PAGE * page < totalItems,
    hasPerviousPage: page > 1,
    nextPage: page + 1,
    previousPage: page - 1,
    lastPage: Math.ceil(totalItems / ITEMS_PER_PAGE),
  });
};

exports.getProduct = async (req, res, next) => {
  try {
    const prodId = req.params.productId;
    let product = await Product.findById(prodId);
    let creator = await User.findOne({ _id: product.userId.toString() });
    res.render("shop/product-detail", {
      product: product,
      pageTitle: product.title,
      path: "/products",
      creator: creator,
      user: req.user,
    });
  } catch {
    const error = new Error("err");
    error.httpStatusCode = 500;
    next(error);
  }
};

exports.getIndex = (req, res, next) => {
  const page = +req.query.page || 1;
  const ITEMS_PER_PAGE = 3;
  let totalItems;
  Product.find()
    .countDocuments()
    .then((numProducts) => {
      totalItems = numProducts;
      return Product.find()
        .skip((page - 1) * ITEMS_PER_PAGE)
        .limit(ITEMS_PER_PAGE);
    })
    .then((products) => {
      res.render("shop/index", {
        prods: products,
        pageTitle: "Shop",
        path: "/",
        currentPage: page,
        hasNextPage: ITEMS_PER_PAGE * page < totalItems,
        hasPerviousPage: page > 1,
        nextPage: page + 1,
        previousPage: page - 1,
        lastPage: Math.ceil(totalItems / ITEMS_PER_PAGE),
      });
    })
    .catch((err) => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      next(error);
    });
};

exports.getCart = (req, res, next) => {
  req.user
    .populate("cart.items.productId")
    .then((user) => {
      let products = user.cart.items;
      res.render("shop/cart", {
        path: "/cart",
        pageTitle: "Your Cart",
        products: products,
      });
    })
    .catch((err) => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      next(error);
    });
};

exports.postCart = (req, res, next) => {
  const prodId = req.body.productId;
  Product.findById(prodId)
    .then((product) => {
      return req.user.addToCart(product);
    })
    .then((result) => {
      res.redirect("/cart");
    })
    .catch((err) => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      next(error);
    });
};

exports.postCartDeleteProduct = (req, res, next) => {
  const prodId = req.body.productId;
  req.user
    .removeFromCart(prodId)
    .then((result) => {
      res.redirect("/cart");
    })
    .catch((err) => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      next(error);
    });
};

exports.postOrder = (req, res, next) => {
  req.user
    .populate("cart.items.productId")
    .then((user) => {
      const products = user.cart.items.map((item) => {
        return { quantity: item.quantity, product: { ...item.productId._doc } };
      });
      const order = new Order({
        user: {
          username: req.user.username,
          userId: req.user,
        },
        products: products,
      });
      return order.save();
    })
    .then((result) => {
      return req.user.clearCart();
    })
    .then(() => {
      res.redirect("/orders");
    })
    .catch((err) => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      next(error);
    });
};

exports.getOrders = (req, res, next) => {
  Order.find({ "user.userId": req.user._id })
    .then((orders) => {
      res.render("shop/orders", {
        path: "/orders",
        pageTitle: "Your Orders",
        orders: orders,
      });
    })
    .catch((err) => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      next(error);
    });
};

exports.getCheckout = async (req, res, next) => {
  let user = await req.user.populate("cart.items.productId");
  let total = 0;
  let products = user.cart.items;
  products.forEach((p) => {
    total += p.quantity * p.productId.price;
  });
  res.render("shop/checkout", {
    path: "/checkout",
    pageTitle: "Checkout",
    products: products,
    totalSum: total,
  });
  req.user.clearCart();
};

exports.getIvoice = (req, res, next) => {
  const orderId = req.params.orderId;

  // we need to chech if i'm the right user to download this file
  Order.findById(orderId)
    .then((order) => {
      if (!order) {
        return next();
      }
      if (order.user.userId.toString() !== req.user._id.toString()) {
        return next();
      }
      const invoiceName = "invoice-" + orderId + ".pdf";
      const invoicePath = path.join("data", "invoices", invoiceName);

      const pdfDoc = new PDFDocument();
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=${invoiceName}`
      );
      pdfDoc.pipe(fs.createWriteStream(invoicePath));
      pdfDoc.pipe(res);
      pdfDoc.fontSize(26).text("Invoice", { underline: true });
      pdfDoc.text("-------------");
      let totalPrice = 0;
      order.products.forEach((prod) => {
        totalPrice += prod.product.price * prod.quantity;
        pdfDoc
          .fontSize(14)
          .text(
            prod.product.title +
              " - " +
              prod.quantity +
              "x " +
              " $" +
              prod.product.price
          );
      });
      pdfDoc.text("--------------------------------------");
      pdfDoc.fontSize(20).text(`Total Price = $${totalPrice}`);
      pdfDoc.end();
    })
    .catch((err) => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      next(error);
    });
};

exports.getCheckoutSuccess = (req, res, next) => {
  req.user
    .populate("cart.items.productId")
    .execPopulate()
    .then((user) => {
      const products = user.cart.items.map((i) => {
        return { quantity: i.quantity, product: { ...i.productId._doc } };
      });
      const order = new Order({
        user: {
          email: req.user.email,
          userId: req.user,
        },
        products: products,
      });
      return order.save();
    })
    .then((result) => {
      return req.user.clearCart();
    })
    .then(() => {
      res.redirect("/orders");
    })
    .catch((err) => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};

exports.search = async (req, res, next) => {
  const searchTerm = req.query.searchTerm;
  try {
    const products = await Product.find({ $text: { $search: searchTerm } });

    res.render("shop/product-list", {
      prods: products,
      pageTitle: "All Products",
      path: "",
    });
  } catch (error) {
    next(error);
  }
};
exports.filter = async (req, res, next) => {
  const { category, minPrice, maxPrice } = req.query;
  console.log(category === "");
  let filters = {};
  if (category !== "") {
    filters.category = category;
  }
  if (minPrice && maxPrice) {
    filters.price = { $gte: minPrice, $lte: maxPrice };
  } else if (minPrice) {
    filters.price = { $gte: minPrice };
  } else if (maxPrice) {
    filters.price = { $lte: maxPrice };
  }
  try {
    const products = await Product.find(filters);
    res.render("shop/product-list", {
      prods: products,
      pageTitle: "All Products",
      path: "",
    });
  } catch (error) {
    next(error);
  }
};
