require('dotenv').config();
const mongoose = require('mongoose');
const Product = require('../models/Product');
const PurchaseInvoice = require('../models/PurchaseInvoice');
const User = require('../models/User');
const logger = require('../utils/logger');

/**
 * Seed inventory data with popular mobile phones
 */
const seedInventory = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Get owner for createdBy field
    const owner = await User.findOne({ role: 'owner' });
    if (!owner) {
      console.log('❌ Owner not found. Please run: npm run seed:owner');
      process.exit(1);
    }

    // Clear existing data
    console.log('🗑️  Clearing existing inventory data...');
    await Product.deleteMany({});
    await PurchaseInvoice.deleteMany({});
    console.log('✅ Existing data cleared\n');

    // ============================================
    // 1. CREATE PRODUCT CATALOG (NO PRICING!)
    // ============================================
    console.log('📱 Creating product catalog...\n');

    const products = [
      // Samsung Galaxy Series
      {
        brand: 'SAMSUNG',
        model: 'Galaxy S23 Ultra',
        variant: '256GB Phantom Black',
        specifications: {
          storage: '256GB',
          ram: '12GB',
          color: 'Phantom Black',
          screenSize: '6.8 inches',
          battery: '5000mAh',
          camera: '200MP + 10MP + 10MP + 12MP',
          processor: 'Snapdragon 8 Gen 2',
          os: 'Android 13',
          simType: 'Dual SIM',
          connectivity: ['5G', 'WiFi 6E', 'Bluetooth 5.3'],
        },
        description: 'Flagship Samsung phone with best-in-class camera',
        features: ['S Pen included', '120Hz Display', 'Gorilla Glass Victus 2'],
        boxContents: ['Phone', 'S Pen', 'USB-C Cable', 'SIM Ejector Tool', 'Quick Start Guide'],
        tags: ['flagship', 'camera-phone', 's-pen'],
        createdBy: owner._id,
      },
      {
        brand: 'SAMSUNG',
        model: 'Galaxy A54',
        variant: '128GB Awesome Violet',
        specifications: {
          storage: '128GB',
          ram: '8GB',
          color: 'Awesome Violet',
          screenSize: '6.4 inches',
          battery: '5000mAh',
          camera: '50MP + 12MP + 5MP',
          processor: 'Exynos 1380',
          os: 'Android 13',
          simType: 'Dual SIM',
          connectivity: ['5G', 'WiFi 6', 'Bluetooth 5.3'],
        },
        description: 'Mid-range Samsung with excellent value',
        features: ['IP67 Water Resistance', '120Hz Display', 'Optical Stabilization'],
        boxContents: ['Phone', 'USB-C Cable', '25W Charger', 'SIM Ejector Tool'],
        tags: ['mid-range', 'water-resistant', 'value'],
        createdBy: owner._id,
      },

      // Apple iPhone Series
      {
        brand: 'APPLE',
        model: 'iPhone 15 Pro Max',
        variant: '256GB Natural Titanium',
        specifications: {
          storage: '256GB',
          ram: '8GB',
          color: 'Natural Titanium',
          screenSize: '6.7 inches',
          battery: '4422mAh',
          camera: '48MP + 12MP + 12MP',
          processor: 'A17 Pro',
          os: 'iOS 17',
          simType: 'Dual eSIM + Physical SIM',
          connectivity: ['5G', 'WiFi 6E', 'Bluetooth 5.3'],
        },
        description: 'Latest iPhone with titanium design and A17 Pro chip',
        features: ['Titanium Build', 'Action Button', 'Always-On Display', 'ProMotion 120Hz'],
        boxContents: ['iPhone', 'USB-C Cable', 'SIM Ejector Tool', 'Documentation'],
        tags: ['flagship', 'premium', 'ios'],
        createdBy: owner._id,
      },
      {
        brand: 'APPLE',
        model: 'iPhone 14',
        variant: '128GB Midnight',
        specifications: {
          storage: '128GB',
          ram: '6GB',
          color: 'Midnight',
          screenSize: '6.1 inches',
          battery: '3279mAh',
          camera: '12MP + 12MP',
          processor: 'A15 Bionic',
          os: 'iOS 16',
          simType: 'Dual eSIM + Physical SIM',
          connectivity: ['5G', 'WiFi 6', 'Bluetooth 5.3'],
        },
        description: 'Previous generation iPhone with reliable performance',
        features: ['Ceramic Shield', 'Crash Detection', 'Emergency SOS'],
        boxContents: ['iPhone', 'USB-C to Lightning Cable', 'Documentation'],
        tags: ['previous-gen', 'reliable', 'ios'],
        createdBy: owner._id,
      },

      // Xiaomi Series
      {
        brand: 'XIAOMI',
        model: 'Redmi Note 13 Pro',
        variant: '256GB Midnight Black',
        specifications: {
          storage: '256GB',
          ram: '12GB',
          color: 'Midnight Black',
          screenSize: '6.67 inches',
          battery: '5100mAh',
          camera: '200MP + 8MP + 2MP',
          processor: 'Snapdragon 7s Gen 2',
          os: 'Android 13',
          simType: 'Dual SIM',
          connectivity: ['5G', 'WiFi 6', 'Bluetooth 5.2'],
        },
        description: 'Feature-packed Xiaomi with 200MP camera',
        features: ['120Hz AMOLED', '67W Fast Charging', 'IP54 Rating'],
        boxContents: ['Phone', '67W Charger', 'USB-C Cable', 'Clear Case', 'SIM Ejector Tool'],
        tags: ['budget-flagship', 'camera', 'fast-charging'],
        createdBy: owner._id,
      },

      // OnePlus Series
      {
        brand: 'ONEPLUS',
        model: 'OnePlus 11',
        variant: '256GB Eternal Green',
        specifications: {
          storage: '256GB',
          ram: '16GB',
          color: 'Eternal Green',
          screenSize: '6.7 inches',
          battery: '5000mAh',
          camera: '50MP + 48MP + 32MP',
          processor: 'Snapdragon 8 Gen 2',
          os: 'Android 13',
          simType: 'Dual SIM',
          connectivity: ['5G', 'WiFi 6E', 'Bluetooth 5.3'],
        },
        description: 'OnePlus flagship with Hasselblad camera',
        features: ['Hasselblad Camera', '100W Fast Charging', 'Alert Slider'],
        boxContents: ['Phone', '100W Charger', 'USB-C Cable', 'Case', 'SIM Tool'],
        tags: ['flagship', 'fast-charging', 'oneplus'],
        createdBy: owner._id,
      },

      // Google Pixel Series
      {
        brand: 'GOOGLE',
        model: 'Pixel 8 Pro',
        variant: '256GB Obsidian',
        specifications: {
          storage: '256GB',
          ram: '12GB',
          color: 'Obsidian',
          screenSize: '6.7 inches',
          battery: '5050mAh',
          camera: '50MP + 48MP + 48MP',
          processor: 'Google Tensor G3',
          os: 'Android 14',
          simType: 'Dual eSIM + Physical SIM',
          connectivity: ['5G', 'WiFi 6E', 'Bluetooth 5.3'],
        },
        description: 'Pure Android experience with AI-powered features',
        features: ['Magic Eraser', 'Best Take', 'Night Sight', '7 Years Updates'],
        boxContents: ['Phone', 'USB-C Cable', '1m Cable', 'Quick Switch Adapter', 'SIM Tool'],
        tags: ['pure-android', 'ai-features', 'camera'],
        createdBy: owner._id,
      },
    ];

    const createdProducts = await Product.insertMany(products);
    console.log(`✅ Created ${createdProducts.length} products\n`);

    // Display created products
    createdProducts.forEach((product, index) => {
      console.log(`${index + 1}. ${product.displayName}`);
    });

    // ============================================
    // 2. CREATE PURCHASE INVOICE WITH PRICING
    // ============================================
    console.log('\n\n💰 Creating purchase invoice with stock...\n');

    // Helper function to generate random IMEI
    const generateIMEI = () => {
      return Math.floor(100000000000000 + Math.random() * 900000000000000).toString();
    };

    // Create phones array for invoice
    const phonesForInvoice = [];

    // Add 3 units of Samsung S23 Ultra
    for (let i = 0; i < 3; i++) {
      phonesForInvoice.push({
        product: createdProducts[0]._id,
        imei: generateIMEI(),
        costPrice: 280000,              // ✅ Pricing here!
        sellingPrice: 310000,           // ✅ Pricing here!
        condition: 'New',
        status: 'Available',
        warrantyExpiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      });
    }

    // Add 5 units of Samsung A54
    for (let i = 0; i < 5; i++) {
      phonesForInvoice.push({
        product: createdProducts[1]._id,
        imei: generateIMEI(),
        costPrice: 75000,
        sellingPrice: 85000,
        condition: 'New',
        status: 'Available',
        warrantyExpiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      });
    }

    // Add 2 units of iPhone 15 Pro Max
    for (let i = 0; i < 2; i++) {
      phonesForInvoice.push({
        product: createdProducts[2]._id,
        imei: generateIMEI(),
        costPrice: 420000,
        sellingPrice: 450000,
        condition: 'New',
        status: 'Available',
        warrantyExpiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      });
    }

    // Add 4 units of iPhone 14
    for (let i = 0; i < 4; i++) {
      phonesForInvoice.push({
        product: createdProducts[3]._id,
        imei: generateIMEI(),
        costPrice: 180000,
        sellingPrice: 199000,
        condition: 'New',
        status: 'Available',
        warrantyExpiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      });
    }

    // Add 6 units of Redmi Note 13 Pro
    for (let i = 0; i < 6; i++) {
      phonesForInvoice.push({
        product: createdProducts[4]._id,
        imei: generateIMEI(),
        costPrice: 55000,
        sellingPrice: 62000,
        condition: 'New',
        status: 'Available',
        warrantyExpiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      });
    }

    // Add 3 units of OnePlus 11
    for (let i = 0; i < 3; i++) {
      phonesForInvoice.push({
        product: createdProducts[5]._id,
        imei: generateIMEI(),
        costPrice: 120000,
        sellingPrice: 135000,
        condition: 'New',
        status: 'Available',
        warrantyExpiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      });
    }

    // Add 2 units of Pixel 8 Pro
    for (let i = 0; i < 2; i++) {
      phonesForInvoice.push({
        product: createdProducts[6]._id,
        imei: generateIMEI(),
        costPrice: 240000,
        sellingPrice: 260000,
        condition: 'New',
        status: 'Available',
        warrantyExpiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      });
    }

    // Create purchase invoice
    const invoice = await PurchaseInvoice.create({
      invoiceNumber: 'INV-2025-001',
      invoiceDate: new Date('2025-01-01'),
      invoiceTime: '10:30',
      supplier: {
        name: 'Tech Distributors Lanka (Pvt) Ltd',
        contactPerson: 'Mr. Kasun Perera',
        phone: '0112345678',
        email: 'sales@techdist.lk',
        address: 'No. 123, Galle Road, Colombo 03',
      },
      phones: phonesForInvoice,
      financials: {
        tax: {
          amount: 0,
          percentage: 0,
        },
        discount: {
          amount: 50000,
          percentage: 0,
        },
        shippingCost: 5000,
      },
      payment: {
        method: 'Bank Transfer',
        status: 'Paid',
        paidAmount: 0,
        paymentDate: new Date('2025-01-01'),
        referenceNumber: 'BT-2025-001',
      },
      invoiceStatus: 'Verified',
      notes: 'Initial stock purchase for January 2025',
      tags: ['january', 'opening-stock', '2025'],
      verifiedBy: owner._id,
      verifiedAt: new Date(),
      createdBy: owner._id,
    });

    console.log(`✅ Created purchase invoice: ${invoice.invoiceNumber}`);
    console.log(`   • Total phones: ${invoice.totalPhones}`);
    console.log(`   • Total cost: Rs. ${invoice.financials.totalCost.toLocaleString()}`);
    console.log(`   • Total selling price: Rs. ${invoice.financials.totalSellingPrice.toLocaleString()}`);
    console.log(`   • Expected profit: Rs. ${invoice.expectedProfit.toLocaleString()}\n`);

    // ============================================
    // 3. DISPLAY SUMMARY
    // ============================================
    console.log('\n📊 INVENTORY SUMMARY\n');
    console.log('='.repeat(80));
    
    const summary = await PurchaseInvoice.aggregate([
      { $unwind: '$phones' },
      { $match: { 'phones.status': 'Available' } },
      {
        $group: {
          _id: '$phones.product',
          count: { $sum: 1 },
          totalCost: { $sum: '$phones.costPrice' },
          totalSellingPrice: { $sum: '$phones.sellingPrice' },
        },
      },
      {
        $lookup: {
          from: 'products',
          localField: '_id',
          foreignField: '_id',
          as: 'productDetails',
        },
      },
      { $unwind: '$productDetails' },
      { $sort: { 'productDetails.brand': 1, 'productDetails.model': 1 } },
    ]);

    summary.forEach((item, index) => {
      const profit = item.totalSellingPrice - item.totalCost;
      console.log(
        `${(index + 1).toString().padEnd(3)} ${item.productDetails.displayName.padEnd(50)} ` +
        `Qty: ${item.count.toString().padStart(2)}  ` +
        `Cost: Rs. ${item.totalCost.toLocaleString().padStart(10)}  ` +
        `Sell: Rs. ${item.totalSellingPrice.toLocaleString().padStart(10)}  ` +
        `Profit: Rs. ${profit.toLocaleString().padStart(8)}`
      );
    });

    console.log('='.repeat(80));
    console.log(`\nTotal Available Stock: ${summary.reduce((sum, item) => sum + item.count, 0)} phones`);
    console.log(`Total Inventory Value: Rs. ${summary.reduce((sum, item) => sum + item.totalCost, 0).toLocaleString()}`);
    console.log(`Expected Revenue: Rs. ${summary.reduce((sum, item) => sum + item.totalSellingPrice, 0).toLocaleString()}`);
    console.log(`Expected Profit: Rs. ${summary.reduce((sum, item) => sum + (item.totalSellingPrice - item.totalCost), 0).toLocaleString()}\n`);

    console.log('✅ Inventory seeding completed successfully!\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding inventory:', error.message);
    console.error(error);
    process.exit(1);
  }
};

seedInventory();