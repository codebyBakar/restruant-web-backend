require("dotenv").config();
const mongoose = require("mongoose");
const connectDB = require("../config/db");

const User = require("../models/User");
const Category = require("../models/Category");
const Tag = require("../models/Tag");
const Product = require("../models/Product");
const Settings = require("../models/Settings");

const run = async () => {
  await connectDB();

  if (process.argv.includes("--destroy")) {
    await Promise.all([
      Category.deleteMany(),
      Tag.deleteMany(),
      Product.deleteMany(),
      Settings.deleteMany(),
    ]);
    console.log("All catalog data destroyed.");
    process.exit(0);
  }

  // Admin user
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminEmail || !adminPassword) {
    console.error("ADMIN_EMAIL and ADMIN_PASSWORD must be set in .env before seeding.");
    process.exit(1);
  }

  const adminExists = await User.findOne({ email: adminEmail });
  if (!adminExists) {
    await User.create({
      name: process.env.ADMIN_NAME || "Admin",
      email: adminEmail,
      password: adminPassword,
      role: "admin",
    });
    console.log("Admin user created:", adminEmail);
  } else {
    console.log("Admin user already exists.");
  }

  // Settings
  let settings = await Settings.findOne({ key: "site" });
  if (!settings) {
    settings = await Settings.create({
      key: "site",
      siteName: "Pratha",
      tagline: "Authentic Parathas, Made With Love",
      address: "MM Alam Road, Gulberg III, Lahore",
      phone: "+92 300 1234567",
      email: "hello@pratha.com",
      openingHours: "11:00 AM - 12:00 AM, All Days",
      deliveryFee: 100,
      freeDeliveryThreshold: 1500,
      taxPercent: 5,
      minOrderAmount: 300,
      totalTables: 12,
      bankName: "HBL Habib Bank Limited",
      bankAccountTitle: "Pratha Restaurant",
      bankAccountNumber: "1234-5678-9012-3456",
      bankIBAN: "PK36HBLB1234567890123456",
    });
    console.log("Default settings created.");
  }

  // Categories
  const categoryNames = [
    { name: "Paratha Rolls", description: "Stuffed parathas rolled with signature fillings" },
    { name: "Classic Parathas", description: "Traditional plain and stuffed parathas" },
    { name: "Combos & Deals", description: "Value combo meals" },
    { name: "Sides & Starters", description: "Chutneys, raita, fries and more" },
    { name: "Beverages", description: "Lassi, soft drinks, and shakes" },
    { name: "Desserts", description: "Sweet endings to your meal" },
  ];
  const categories = {};
  for (const c of categoryNames) {
    let cat = await Category.findOne({ name: c.name });
    if (!cat) cat = await Category.create(c);
    categories[c.name] = cat;
  }
  console.log("Categories ready.");

  // Tags
  const tagNames = ["Bestseller", "Spicy", "New", "Chef's Special", "Vegetarian", "Family Pack"];
  const tags = {};
  for (const t of tagNames) {
    let tag = await Tag.findOne({ name: t });
    if (!tag) tag = await Tag.create({ name: t });
    tags[t] = tag;
  }
  console.log("Tags ready.");

  const productCount = await Product.countDocuments();
  if (productCount === 0) {
    const sampleImage = {
      url: "https://images.unsplash.com/photo-1600628421055-4d30de868b8f?w=1200",
      publicId: "sample-placeholder",
    };

    const products = [
      {
        name: "Chicken Tikka Paratha Roll",
        description:
          "Juicy chicken tikka pieces wrapped in a crispy, flaky paratha with mint chutney, onions, and a tangy garlic sauce.",
        ingredients: ["Chicken tikka", "Paratha", "Mint chutney", "Onions", "Garlic sauce", "Lettuce"],
        category: categories["Paratha Rolls"]._id,
        tags: [tags["Bestseller"]._id, tags["Spicy"]._id],
        basePrice: 450,
        variants: [
          { label: "Single Roll", price: 450 },
          { label: "Double Roll", price: 800 },
        ],
        images: [sampleImage],
        isVeg: false,
        spiceLevel: "medium",
        prepTimeMinutes: 15,
        isFeatured: true,
      },
      {
        name: "Aloo Paratha",
        description:
          "A classic North-Indian style paratha stuffed with spiced mashed potatoes, served hot with butter, yogurt and pickle.",
        ingredients: ["Wheat flour", "Potatoes", "Spices", "Butter", "Yogurt", "Pickle"],
        category: categories["Classic Parathas"]._id,
        tags: [tags["Vegetarian"]._id, tags["Bestseller"]._id],
        basePrice: 280,
        variants: [
          { label: "Single", price: 280 },
          { label: "Half Plate (2 pcs)", price: 500 },
        ],
        images: [sampleImage],
        isVeg: true,
        spiceLevel: "mild",
        prepTimeMinutes: 12,
        isFeatured: true,
      },
      {
        name: "Beef Seekh Kebab Roll",
        description:
          "Smoky beef seekh kebabs grilled to perfection, rolled in a soft paratha with fresh salad and spicy chutney.",
        ingredients: ["Beef seekh kebab", "Paratha", "Salad", "Chutney", "Onions"],
        category: categories["Paratha Rolls"]._id,
        tags: [tags["Spicy"]._id, tags["Chef's Special"]._id],
        basePrice: 480,
        variants: [
          { label: "Single Roll", price: 480 },
          { label: "Double Roll", price: 850 },
        ],
        images: [sampleImage],
        isVeg: false,
        spiceLevel: "hot",
        prepTimeMinutes: 18,
        isFeatured: true,
      },
      {
        name: "Family Paratha Feast",
        description:
          "A hearty combo with 4 assorted parathas, chicken karahi, raita, salad and soft drinks - perfect for family sharing.",
        ingredients: ["Assorted parathas", "Chicken karahi", "Raita", "Salad", "Soft drinks"],
        category: categories["Combos & Deals"]._id,
        tags: [tags["Family Pack"]._id, tags["Chef's Special"]._id],
        basePrice: 2200,
        variants: [],
        images: [sampleImage],
        isVeg: false,
        spiceLevel: "medium",
        prepTimeMinutes: 30,
        isFeatured: true,
      },
      {
        name: "Masala Fries",
        description: "Crispy golden fries tossed in our signature tangy masala seasoning.",
        ingredients: ["Potatoes", "Masala seasoning", "Ketchup"],
        category: categories["Sides & Starters"]._id,
        tags: [tags["Vegetarian"]._id],
        basePrice: 250,
        variants: [
          { label: "Regular", price: 250 },
          { label: "Large", price: 400 },
        ],
        images: [sampleImage],
        isVeg: true,
        spiceLevel: "mild",
        prepTimeMinutes: 10,
      },
      {
        name: "Mango Lassi",
        description: "A refreshing, creamy yogurt-based drink blended with sweet mango pulp.",
        ingredients: ["Yogurt", "Mango pulp", "Sugar", "Cardamom"],
        category: categories["Beverages"]._id,
        tags: [tags["Bestseller"]._id],
        basePrice: 220,
        variants: [
          { label: "Regular", price: 220 },
          { label: "Large", price: 320 },
        ],
        images: [sampleImage],
        isVeg: true,
        spiceLevel: "none",
        prepTimeMinutes: 5,
      },
      {
        name: "Gulab Jamun (2 pcs)",
        description: "Soft, warm milk-solid dumplings soaked in fragrant rose-cardamom sugar syrup.",
        ingredients: ["Milk solids", "Sugar syrup", "Rose water", "Cardamom"],
        category: categories["Desserts"]._id,
        tags: [tags["New"]._id],
        basePrice: 180,
        variants: [],
        images: [sampleImage],
        isVeg: true,
        spiceLevel: "none",
        prepTimeMinutes: 5,
      },
    ];

    for (const p of products) {
      await Product.create(p);
    }
    console.log(`${products.length} sample products created.`);
  } else {
    console.log("Products already exist, skipping product seed.");
  }

  console.log("Seeding complete.");
  process.exit(0);
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
