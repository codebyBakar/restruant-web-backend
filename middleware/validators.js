const { body, param, query } = require("express-validator");

// ---------- Shared format rules ----------
const MONGO_ID = /^[0-9a-fA-F]{24}$/;
const PHONE = /^\+?[0-9][0-9\s\-()]{6,19}$/;
const COLOR_HEX = /^#[0-9a-fA-F]{6}$/;
const IBAN = /^[A-Za-z0-9]{15,34}$/;
const ORDER_NUMBER = /^[A-Z0-9-]{6,20}$/;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const MAX_LEN = {
  name: 100,
  short: 200,
  medium: 600,
  long: 2000,
  email: 254,
  password: 72,
  phone: 20,
  url: 1000,
};

// Reject any field not present in the allowed list (strict schema, no silent drop)
const rejectUnknownFields = (allowed) => (req, res, next) => {
  const keys = Object.keys(req.body || {});
  const unknown = keys.filter((k) => !allowed.includes(k));
  if (unknown.length > 0) {
    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: unknown.map((k) => ({ field: k, message: `Field "${k}" is not allowed` })),
    });
  }
  next();
};

const objectIdParam = (name) =>
  param(name).matches(MONGO_ID).withMessage(`Invalid ${name} format`);

const slugParam = (name) =>
  param(name)
    .isString()
    .isLength({ min: 1, max: 100 })
    .matches(SLUG)
    .withMessage(`Invalid ${name}`);

const orderNumberParam = (name) =>
  param(name).matches(ORDER_NUMBER).withMessage(`Invalid ${name} format`);

const emailQuery = () =>
  query("email")
    .trim()
    .isEmail()
    .withMessage("Valid email required")
    .isLength({ max: MAX_LEN.email });

const accessTokenQuery = () =>
  query("token")
    .optional()
    .matches(/^[0-9a-f]{32}$/)
    .withMessage("Invalid access token");

const paginationQuery = () => [
  query("page").optional().isInt({ min: 1 }).toInt().withMessage("page must be a positive integer"),
  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .toInt()
    .withMessage("limit must be between 1 and 100"),
];

// ---------- Auth ----------
const register = [
  rejectUnknownFields(["name", "email", "password", "role"]),
  body("name")
    .trim()
    .isString()
    .isLength({ min: 2, max: MAX_LEN.name })
    .withMessage("Name must be 2-100 characters"),
  body("email")
    .trim()
    .isEmail()
    .withMessage("Valid email required")
    .isLength({ max: MAX_LEN.email })
    .normalizeEmail(),
  body("password")
    .isString()
    .isLength({ min: 8, max: MAX_LEN.password })
    .withMessage("Password must be 8-72 characters"),
  body("role").optional().isIn(["admin", "staff"]).withMessage("Role must be admin or staff"),
];

const login = [
  rejectUnknownFields(["email", "password"]),
  body("email").trim().isEmail().withMessage("Valid email required").normalizeEmail(),
  body("password")
    .isString()
    .notEmpty()
    .withMessage("Password is required")
    .isLength({ max: MAX_LEN.password })
    .withMessage("Password too long"),
];

const updateProfile = [
  rejectUnknownFields(["name", "email", "currentPassword", "newPassword"]),
  body("name")
    .optional({ values: "falsy" })
    .trim()
    .isString()
    .isLength({ min: 2, max: MAX_LEN.name })
    .withMessage("Name must be 2-100 characters"),
  body("email").optional({ values: "falsy" }).trim().isEmail().withMessage("Valid email required"),
  body("currentPassword").optional({ values: "falsy" }).isString().isLength({ max: MAX_LEN.password }),
  body("newPassword")
    .optional({ values: "falsy" })
    .isString()
    .isLength({ min: 8, max: MAX_LEN.password })
    .withMessage("New password must be 8-72 characters"),
];

const updatePassword = [
  rejectUnknownFields(["currentPassword", "newPassword"]),
  body("currentPassword").isString().notEmpty().withMessage("Current password is required"),
  body("newPassword")
    .isString()
    .isLength({ min: 8, max: MAX_LEN.password })
    .withMessage("New password must be 8-72 characters"),
];

// ---------- Category ----------
const createCategory = [
  rejectUnknownFields(["name", "description", "displayOrder", "isActive"]),
  body("name").trim().isString().isLength({ min: 2, max: MAX_LEN.name }).withMessage("Category name must be 2-100 characters"),
  body("description").optional().trim().isString().isLength({ max: MAX_LEN.medium }).withMessage("Description too long"),
  body("displayOrder").optional().isInt({ min: 0, max: 100000 }).toInt().withMessage("displayOrder must be a non-negative integer"),
  body("isActive").optional().isBoolean().withMessage("isActive must be a boolean"),
];

const updateCategory = [
  rejectUnknownFields(["name", "description", "displayOrder", "isActive"]),
  body("name").optional({ values: "falsy" }).trim().isString().isLength({ min: 2, max: MAX_LEN.name }).withMessage("Category name must be 2-100 characters"),
  body("description").optional({ values: "falsy" }).trim().isString().isLength({ max: MAX_LEN.medium }).withMessage("Description too long"),
  body("displayOrder").optional({ values: "falsy" }).isInt({ min: 0, max: 100000 }).toInt().withMessage("displayOrder must be a non-negative integer"),
  body("isActive").optional({ values: "falsy" }).isBoolean().withMessage("isActive must be a boolean"),
];

// ---------- Tag ----------
const createTag = [
  rejectUnknownFields(["name", "colorHex"]),
  body("name").trim().isString().isLength({ min: 2, max: 40 }).withMessage("Tag name must be 2-40 characters"),
  body("colorHex").optional().matches(COLOR_HEX).withMessage("colorHex must be #RRGGBB"),
];

const updateTag = [
  rejectUnknownFields(["name", "colorHex"]),
  body("name").optional({ values: "falsy" }).trim().isString().isLength({ min: 2, max: 40 }).withMessage("Tag name must be 2-40 characters"),
  body("colorHex").optional({ values: "falsy" }).matches(COLOR_HEX).withMessage("colorHex must be #RRGGBB"),
];

// ---------- Product ----------
const productCommon = {
  name: () =>
    body("name")
      .trim()
      .isString()
      .isLength({ min: 2, max: MAX_LEN.name })
      .withMessage("Product name must be 2-100 characters"),
  description: () =>
    body("description")
      .trim()
      .isString()
      .isLength({ min: 2, max: MAX_LEN.long })
      .withMessage("Description must be 2-2000 characters"),
  category: () =>
    body("category")
      .matches(MONGO_ID)
      .withMessage("Category must be a valid ObjectId"),
  basePrice: () =>
    body("basePrice")
      .isFloat({ min: 0, max: 10000000 })
      .toFloat()
      .withMessage("basePrice must be a non-negative number"),
  discountPrice: () =>
    body("discountPrice")
      .optional({ nullable: true })
      .isFloat({ min: 0, max: 10000000 })
      .toFloat()
      .withMessage("discountPrice must be a non-negative number"),
  tags: () =>
    body("tags")
      .optional()
      .custom((val) => {
        const arr = typeof val === "string" ? val.split(",").map((t) => t.trim()).filter(Boolean) : val;
        return Array.isArray(arr) && arr.length <= 20 && arr.every((t) => MONGO_ID.test(t));
      })
      .withMessage("tags must be an array of valid ObjectIds (or comma-separated string)"),
  ingredients: () =>
    body("ingredients")
      .optional()
      .custom((val) => {
        const arr = typeof val === "string" ? val.split(",").map((i) => i.trim()).filter(Boolean) : val;
        return Array.isArray(arr) && arr.length <= 50 && arr.every((i) => typeof i === "string" && i.length <= 100);
      })
      .withMessage("Each ingredient must be a string (max 100 chars)"),
  variants: () =>
    body("variants")
      .optional()
      .custom((val) => {
        let arr = val;
        if (typeof val === "string") {
          try {
            arr = JSON.parse(val);
          } catch {
            return false;
          }
        }
        return (
          Array.isArray(arr) &&
          arr.length <= 20 &&
          arr.every(
            (v) =>
              v &&
              typeof v.label === "string" &&
              v.label.trim().length >= 1 &&
              v.label.trim().length <= 30 &&
              (typeof v.price === "number" || (typeof v.price === "string" && v.price.trim() !== "")) &&
              Number(v.price) >= 0 &&
              Number.isFinite(Number(v.price))
          )
        );
      })
      .withMessage("Each variant needs a label (1-30 chars) and a non-negative price"),
  isVeg: () => body("isVeg").optional().isBoolean().withMessage("isVeg must be a boolean"),
  spiceLevel: () =>
    body("spiceLevel")
      .optional()
      .isIn(["none", "mild", "medium", "hot"])
      .withMessage("spiceLevel must be none/mild/medium/hot"),
  calories: () =>
    body("calories").optional({ nullable: true }).isInt({ min: 0, max: 100000 }).toInt().withMessage("calories must be a non-negative integer"),
  prepTimeMinutes: () =>
    body("prepTimeMinutes")
      .optional()
      .isInt({ min: 1, max: 600 })
      .toInt()
      .withMessage("prepTimeMinutes must be between 1 and 600"),
  isAvailable: () => body("isAvailable").optional().isBoolean().withMessage("isAvailable must be a boolean"),
  unavailableBadge: () =>
    body("unavailableBadge")
      .optional({ values: "falsy" })
      .isIn(["", "coming_soon", "unavailable"])
      .withMessage("unavailableBadge must be coming_soon or unavailable"),
  isFeatured: () => body("isFeatured").optional().isBoolean().withMessage("isFeatured must be a boolean"),
  displayOrder: () =>
    body("displayOrder").optional().isInt({ min: 0, max: 100000 }).toInt().withMessage("displayOrder must be a non-negative integer"),
};

const PRODUCT_ALLOWED = [
  "name",
  "description",
  "category",
  "basePrice",
  "discountPrice",
  "tags",
  "ingredients",
  "variants",
  "isVeg",
  "spiceLevel",
  "calories",
  "prepTimeMinutes",
  "isAvailable",
  "unavailableBadge",
  "isFeatured",
  "displayOrder",
];

const createProduct = [
  rejectUnknownFields(PRODUCT_ALLOWED),
  productCommon.name(),
  productCommon.description(),
  productCommon.category(),
  productCommon.basePrice(),
  productCommon.discountPrice(),
  productCommon.tags(),
  productCommon.ingredients(),
  productCommon.variants(),
  productCommon.isVeg(),
  productCommon.spiceLevel(),
  productCommon.calories(),
  productCommon.prepTimeMinutes(),
  productCommon.isAvailable(),
  productCommon.unavailableBadge(),
  productCommon.isFeatured(),
  productCommon.displayOrder(),
];

const updateProduct = [
  rejectUnknownFields(PRODUCT_ALLOWED),
  productCommon.name().optional({ values: "falsy" }),
  productCommon.description().optional({ values: "falsy" }),
  productCommon.category().optional({ values: "falsy" }),
  productCommon.basePrice().optional({ values: "falsy" }),
  productCommon.discountPrice().optional({ values: "falsy" }),
  productCommon.tags().optional({ values: "falsy" }),
  productCommon.ingredients().optional({ values: "falsy" }),
  productCommon.variants().optional({ values: "falsy" }),
  productCommon.isVeg().optional({ values: "falsy" }),
  productCommon.spiceLevel().optional({ values: "falsy" }),
  productCommon.calories().optional({ values: "falsy" }),
  productCommon.prepTimeMinutes().optional({ values: "falsy" }),
  productCommon.isAvailable().optional({ values: "falsy" }),
  productCommon.unavailableBadge().optional({ values: "falsy" }),
  productCommon.isFeatured().optional({ values: "falsy" }),
  productCommon.displayOrder().optional({ values: "falsy" }),
];

// ---------- Deal ----------
const DEAL_ALLOWED = [
  "title",
  "subtitle",
  "price",
  "items",
  "isForLife",
  "startDate",
  "endDate",
  "isActive",
];

const dealItems = () =>
  body("items")
    .optional()
    .custom((val) => {
      let arr = val;
      if (typeof val === "string") {
        try {
          arr = JSON.parse(val);
        } catch {
          return false;
        }
      }
      return (
        Array.isArray(arr) &&
        arr.length <= 30 &&
        arr.every(
          (it) =>
            it &&
            MONGO_ID.test(it.product || "") &&
            (typeof it.quantity === "number" || (typeof it.quantity === "string" && it.quantity.trim() !== "")) &&
            Number.isInteger(Number(it.quantity)) &&
            Number(it.quantity) >= 1 &&
            Number(it.quantity) <= 100
        )
      );
    })
    .withMessage("Each deal item needs a valid product ObjectId and quantity 1-100");

const dateField = (name) =>
  body(name)
    .optional({ values: "falsy", nullable: true })
    .isISO8601()
    .withMessage(`${name} must be a valid date`);

const createDeal = [
  rejectUnknownFields(DEAL_ALLOWED),
  body("title").trim().isString().isLength({ min: 2, max: MAX_LEN.name }).withMessage("Deal title must be 2-100 characters"),
  body("subtitle").optional().trim().isString().isLength({ max: MAX_LEN.short }).withMessage("Subtitle too long"),
  body("price").isFloat({ min: 0, max: 10000000 }).toFloat().withMessage("price must be a non-negative number"),
  dealItems(),
  body("isForLife").optional().isBoolean().withMessage("isForLife must be a boolean"),
  dateField("startDate"),
  dateField("endDate"),
  body("isActive").optional().isBoolean().withMessage("isActive must be a boolean"),
];

const updateDeal = [
  rejectUnknownFields(DEAL_ALLOWED),
  body("title").optional({ values: "falsy" }).trim().isString().isLength({ min: 2, max: MAX_LEN.name }).withMessage("Deal title must be 2-100 characters"),
  body("subtitle").optional({ values: "falsy" }).trim().isString().isLength({ max: MAX_LEN.short }).withMessage("Subtitle too long"),
  body("price").optional({ values: "falsy" }).isFloat({ min: 0, max: 10000000 }).toFloat().withMessage("price must be a non-negative number"),
  dealItems().optional({ values: "falsy" }),
  body("isForLife").optional({ values: "falsy" }).isBoolean().withMessage("isForLife must be a boolean"),
  dateField("startDate"),
  dateField("endDate"),
  body("isActive").optional({ values: "falsy" }).isBoolean().withMessage("isActive must be a boolean"),
];

// ---------- Order ----------
const ORDER_ALLOWED = ["customer", "orderType", "deliveryAddress", "items", "paymentMethod"];

const itemsRule = () =>
  body("items")
    .isArray({ min: 1, max: 50 })
    .withMessage("Cart must contain 1-50 items")
    .custom((arr) =>
      arr.every(
        (it) =>
          it &&
          (MONGO_ID.test(it.productId || "") || MONGO_ID.test(it.dealId || "")) &&
          Number.isInteger(it.quantity) &&
          it.quantity >= 1 &&
          it.quantity <= 100 &&
          (it.variantLabel === undefined || typeof it.variantLabel === "string") &&
          (it.specialInstructions === undefined || (typeof it.specialInstructions === "string" && it.specialInstructions.length <= 300))
      )
    )
    .withMessage("Each item needs a valid productId/dealId and quantity 1-100");

const createOrder = [
  rejectUnknownFields(ORDER_ALLOWED),
  body("customer")
    .isObject()
    .withMessage("customer must be an object"),
  body("customer.name")
    .trim()
    .isString()
    .isLength({ min: 2, max: MAX_LEN.name })
    .withMessage("Customer name must be 2-100 characters"),
  body("customer.email")
    .trim()
    .isEmail()
    .withMessage("Valid customer email required")
    .isLength({ max: MAX_LEN.email }),
  body("customer.phone")
    .trim()
    .matches(PHONE)
    .withMessage("Valid phone required"),
  body("orderType")
    .isIn(["delivery", "pickup"])
    .withMessage("orderType must be delivery or pickup"),
  body("deliveryAddress")
    .optional()
    .isObject()
    .withMessage("deliveryAddress must be an object"),
  body("deliveryAddress.line1")
    .optional()
    .trim()
    .isString()
    .isLength({ min: 3, max: MAX_LEN.short })
    .withMessage("Address line is required"),
  body("deliveryAddress.city")
    .optional()
    .trim()
    .isString()
    .isLength({ min: 2, max: 100 })
    .withMessage("City must be 2-100 characters"),
  body("deliveryAddress.area")
    .optional()
    .trim()
    .isString()
    .isLength({ max: MAX_LEN.short }),
  body("deliveryAddress.instructions")
    .optional()
    .trim()
    .isString()
    .isLength({ max: MAX_LEN.medium }),
  itemsRule(),
  body("paymentMethod").isIn(["cash", "online"]).withMessage("paymentMethod must be cash or online"),
];

const updateOrderStatus = [
  rejectUnknownFields(["orderStatus", "paymentStatus", "pickupPrepMinutes"]),
  body("orderStatus")
    .optional({ values: "falsy" })
    .isIn([
      "pending",
      "confirmed",
      "preparing",
      "out_for_delivery",
      "ready_for_pickup",
      "delivered",
      "pickup_complete",
      "cancelled",
    ])
    .withMessage("Invalid orderStatus"),
  body("paymentStatus")
    .optional({ values: "falsy" })
    .isIn(["pending", "paid", "failed", "refunded"])
    .withMessage("Invalid paymentStatus"),
  body("pickupPrepMinutes")
    .optional({ values: "falsy" })
    .isInt({ min: 1, max: 240 })
    .toInt()
    .withMessage("pickupPrepMinutes must be 1-240"),
];

const trackOrder = [
  orderNumberParam("orderNumber"),
  accessTokenQuery(),
];

const myOrders = [emailQuery()];

const uploadScreenshot = [
  orderNumberParam("orderNumber"),
  query("email").optional().trim().isEmail().withMessage("Valid email required").isLength({ max: MAX_LEN.email }),
  accessTokenQuery(),
];

const orderList = [
  ...paginationQuery(),
  query("status")
    .optional()
    .isString()
    .isLength({ max: 200 })
    .custom((v) => v.split(",").every((s) =>
      ["pending", "confirmed", "preparing", "out_for_delivery", "ready_for_pickup", "delivered", "pickup_complete", "cancelled"].includes(s.trim())
    ))
    .withMessage("Invalid order status filter"),
  query("paymentStatus").optional().isIn(["pending", "paid", "failed", "refunded"]).withMessage("Invalid paymentStatus"),
  query("orderType").optional().isIn(["delivery", "pickup"]).withMessage("Invalid orderType"),
  query("search").optional().isString().isLength({ max: 100 }).withMessage("Search too long"),
];

const productList = [
  ...paginationQuery(),
  query("category").optional().isString().isLength({ max: 100 }),
  query("tag").optional().isString().isLength({ max: 100 }),
  query("search").optional().isString().isLength({ max: 100 }).withMessage("Search too long"),
  query("isVeg").optional().isIn(["true", "false"]).withMessage("isVeg must be true or false"),
  query("featured").optional().isIn(["true", "false"]).withMessage("featured must be true or false"),
  query("availableOnly").optional().isIn(["true", "false"]).withMessage("availableOnly must be true or false"),
  query("sort")
    .optional()
    .isIn(["priceLow", "priceHigh", "newest", "rating", "default"])
    .withMessage("Invalid sort option"),
];

const categoryList = [
  query("all").optional().isIn(["true", "false"]).withMessage("all must be true or false"),
];

const dealList = [
  query("all").optional().isIn(["true", "false"]).withMessage("all must be true or false"),
];

// ---------- Contact ----------
const CONTACT_ALLOWED = ["name", "email", "phone", "subject", "message", "website"];

const createContact = [
  rejectUnknownFields(CONTACT_ALLOWED),
  body("name")
    .trim()
    .isString()
    .isLength({ min: 2, max: MAX_LEN.name })
    .withMessage("Name must be 2-100 characters"),
  body("email")
    .trim()
    .isEmail()
    .withMessage("Valid email required")
    .isLength({ max: MAX_LEN.email })
    .normalizeEmail(),
  body("phone")
    .trim()
    .matches(PHONE)
    .withMessage("Valid phone required"),
  body("subject")
    .optional({ values: "falsy" })
    .trim()
    .isString()
    .isLength({ max: MAX_LEN.short })
    .withMessage("Subject too long"),
  body("message")
    .trim()
    .isString()
    .isLength({ min: 10, max: 5000 })
    .withMessage("Message must be 10-5000 characters"),
  // Honeypot field — real users never see it (hidden field); bots tend to autofill it.
  body("website")
    .optional({ values: "falsy" })
    .custom((v) => v === "")
    .withMessage("Invalid request"),
];

const contactList = [
  ...paginationQuery(),
  query("read")
    .optional()
    .isIn(["true", "false"])
    .withMessage("read must be true or false"),
];

const updateContactRead = [
  body("isRead").isBoolean().withMessage("isRead must be a boolean"),
];

// ---------- Settings ----------
const SETTINGS_ALLOWED = [
  "siteName",
  "tagline",
  "currency",
  "address",
  "phone",
  "email",
  "openingHours",
  "deliveryFee",
  "freeDeliveryThreshold",
  "taxPercent",
  "minOrderAmount",
  "facebook",
  "instagram",
  "tiktok",
  "socialLinks",
  "totalTables",
  "bankName",
  "bankAccountTitle",
  "bankAccountNumber",
  "bankIBAN",
];

const updateSettings = [
  rejectUnknownFields(SETTINGS_ALLOWED),
  body("siteName").optional({ values: "falsy" }).trim().isString().isLength({ max: MAX_LEN.name }),
  body("tagline").optional({ values: "falsy" }).trim().isString().isLength({ max: MAX_LEN.short }),
  body("currency").optional({ values: "falsy" }).trim().isString().isLength({ max: 10 }),
  body("address").optional({ values: "falsy" }).trim().isString().isLength({ max: MAX_LEN.short }),
  body("phone").optional({ values: "falsy" }).trim().isString().isLength({ max: MAX_LEN.phone }),
  body("email").optional({ values: "falsy" }).trim().isEmail().withMessage("Valid email required"),
  body("openingHours").optional({ values: "falsy" }).trim().isString().isLength({ max: MAX_LEN.short }),
  body("deliveryFee").optional({ values: "falsy" }).isFloat({ min: 0, max: 100000 }).toFloat(),
  body("freeDeliveryThreshold").optional({ values: "falsy" }).isFloat({ min: 0, max: 100000000 }).toFloat(),
  body("taxPercent").optional({ values: "falsy" }).isFloat({ min: 0, max: 100 }).toFloat(),
  body("minOrderAmount").optional({ values: "falsy" }).isFloat({ min: 0, max: 100000000 }).toFloat(),
  body("facebook").optional({ values: "falsy" }).trim().isURL({ require_protocol: true }).withMessage("Valid facebook URL required"),
  body("instagram").optional({ values: "falsy" }).trim().isURL({ require_protocol: true }).withMessage("Valid instagram URL required"),
  body("tiktok").optional({ values: "falsy" }).trim().isURL({ require_protocol: true }).withMessage("Valid tiktok URL required"),
  body("socialLinks")
    .optional({ values: "falsy" })
    .custom((val) => {
      let obj = val;
      if (typeof val === "string") {
        try {
          obj = JSON.parse(val);
        } catch {
          return false;
        }
      }
      return (
        typeof obj === "object" &&
        obj !== null &&
        !Array.isArray(obj) &&
        Object.keys(obj).every((k) => ["facebook", "instagram", "tiktok"].includes(k))
      );
    })
    .withMessage("socialLinks must be an object with facebook/instagram/tiktok keys"),
  body("totalTables").optional({ values: "falsy" }).isInt({ min: 1, max: 1000 }).toInt(),
  body("bankName").optional({ values: "falsy" }).trim().isString().isLength({ max: MAX_LEN.name }),
  body("bankAccountTitle").optional({ values: "falsy" }).trim().isString().isLength({ max: MAX_LEN.name }),
  body("bankAccountNumber").optional({ values: "falsy" }).trim().isString().isLength({ max: 50 }),
  body("bankIBAN").optional({ values: "falsy" }).trim().matches(IBAN).withMessage("Invalid IBAN format"),
];

module.exports = {
  register,
  login,
  updateProfile,
  updatePassword,
  createCategory,
  updateCategory,
  createTag,
  updateTag,
  createProduct,
  updateProduct,
  createDeal,
  updateDeal,
  createOrder,
  updateOrderStatus,
  trackOrder,
  myOrders,
  uploadScreenshot,
  orderList,
  productList,
  categoryList,
  dealList,
  updateSettings,
  createContact,
  contactList,
  updateContactRead,
  objectIdParam,
  slugParam,
  orderNumberParam,
  paginationQuery,
};
