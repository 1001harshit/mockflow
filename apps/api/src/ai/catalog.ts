/**
 * Vocabularies behind locally generated mock data (Phase 6).
 *
 * The point of these tables is coherence: a product in "Phones" should carry a
 * brand that actually sells phones and a price in a believable band, so an
 * inventory response reads like a catalogue instead of a bag of random strings.
 */

export interface CategorySpec {
  name: string;
  subcategories: string[];
  brands: string[];
  /** Plausible price band for this category, in whole currency units. */
  price: [number, number];
}

export const CATEGORIES: CategorySpec[] = [
  {
    name: 'Electronics',
    subcategories: ['Phones', 'Laptops', 'Headphones', 'Tablets'],
    brands: ['Samsung', 'Apple', 'Sony', 'OnePlus', 'Lenovo'],
    price: [4_999, 149_999],
  },
  {
    name: 'Home & Kitchen',
    subcategories: ['Cookware', 'Small Appliances', 'Storage', 'Lighting'],
    brands: ['Prestige', 'Philips', 'Bosch', 'Hawkins', 'Milton'],
    price: [299, 24_999],
  },
  {
    name: 'Apparel',
    subcategories: ['Shirts', 'Footwear', 'Outerwear', 'Accessories'],
    brands: ['Levis', 'Nike', 'Adidas', 'Allen Solly', 'Puma'],
    price: [499, 12_999],
  },
  {
    name: 'Books',
    subcategories: ['Fiction', 'Technology', 'Business', 'History'],
    brands: ['Penguin', "O'Reilly", 'Harper', 'Manning', 'Bloomsbury'],
    price: [199, 2_999],
  },
  {
    name: 'Groceries',
    subcategories: ['Beverages', 'Snacks', 'Staples', 'Dairy'],
    brands: ['Amul', 'Tata', 'Nestle', 'Britannia', 'Fortune'],
    price: [30, 1_499],
  },
];

/**
 * Model names that belong to a specific brand, keyed `"<brand>|<subcategory>"`.
 *
 * Without this the brand and the model are drawn independently and you get
 * "OnePlus iPad Air" — internally consistent by the code's own rules, and
 * obviously wrong to any reader. Real model names have owners.
 */
export const BRAND_PRODUCTS: Record<string, string[]> = {
  'Apple|Phones': ['iPhone 15', 'iPhone 15 Pro'],
  'Samsung|Phones': ['Galaxy S24', 'Galaxy A55'],
  'OnePlus|Phones': ['Nord 4', 'OnePlus 12R'],
  'Sony|Phones': ['Xperia 10 VI'],
  'Apple|Laptops': ['MacBook Air 13', 'MacBook Pro 14'],
  'Lenovo|Laptops': ['ThinkPad X1 Carbon', 'IdeaPad Slim 5'],
  'Samsung|Laptops': ['Galaxy Book4'],
  'Sony|Headphones': ['WH-1000XM5', 'WF-C710N'],
  'Apple|Headphones': ['AirPods Pro 2', 'AirPods Max'],
  'Samsung|Headphones': ['Galaxy Buds3 Pro'],
  'OnePlus|Headphones': ['Nord Buds 3'],
  'Apple|Tablets': ['iPad Air 11', 'iPad Pro 13'],
  'Samsung|Tablets': ['Galaxy Tab S9'],
  'Lenovo|Tablets': ['Tab P12'],
  'OnePlus|Tablets': ['Pad 2'],
  'Nike|Footwear': ['Air Zoom Pegasus 41', 'Air Force 1'],
  'Adidas|Footwear': ['Ultraboost 22', 'Samba OG'],
  'Puma|Footwear': ['Suede Classic', 'RS-X'],
};

/**
 * Brand-neutral nouns, keyed by subcategory. Used when a brand has no model of
 * its own listed above, so any brand can front them without reading oddly.
 */
export const PRODUCT_NOUNS: Record<string, string[]> = {
  Phones: ['5G Smartphone 128GB', 'Smartphone 256GB'],
  Laptops: ['Ultrabook 14', 'Notebook 15 i5'],
  Headphones: ['Wireless Headphones', 'Noise-Cancelling Earbuds'],
  Tablets: ['Tablet 11 WiFi', 'Tablet 10 LTE'],
  Cookware: ['Triply Saucepan', 'Cast Iron Skillet', 'Pressure Cooker 5L'],
  'Small Appliances': ['Air Fryer 4L', 'Mixer Grinder 750W', 'Kettle 1.7L'],
  Storage: ['Airtight Jar Set', 'Vacuum Container', 'Steel Lunch Box'],
  Lighting: ['LED Batten 20W', 'Smart Bulb 9W', 'Table Lamp'],
  Shirts: ['Oxford Shirt', 'Linen Kurta', 'Flannel Overshirt'],
  Footwear: ['Canvas Sneaker', 'Running Shoe', 'Leather Derby'],
  Outerwear: ['Puffer Jacket', 'Denim Trucker', 'Windcheater'],
  Accessories: ['Leather Belt', 'Canvas Tote', 'Aviator Sunglasses'],
  Fiction: ['The Silent Harbour', 'Midnight in Delhi', 'Paper Boats'],
  Technology: ['Designing Data-Intensive Applications', 'The Pragmatic Programmer'],
  Business: ['The Lean Startup', 'Good to Great', 'Zero to One'],
  History: ['India After Gandhi', 'The Silk Roads', 'Sapiens'],
  Beverages: ['Filter Coffee 500g', 'Green Tea 100 bags', 'Cold Brew Concentrate'],
  Snacks: ['Masala Peanuts 200g', 'Dark Chocolate 70%', 'Baked Chips'],
  Staples: ['Basmati Rice 5kg', 'Sunflower Oil 1L', 'Toor Dal 1kg'],
  Dairy: ['Paneer 200g', 'Greek Yoghurt 400g', 'Salted Butter 500g'],
};

export const FIRST_NAMES = [
  'Aarav', 'Priya', 'Rahul', 'Ananya', 'Vikram', 'Meera', 'Arjun', 'Divya',
  'Karthik', 'Sneha', 'Rohan', 'Ishita', 'Nikhil', 'Farah', 'Dev', 'Tanvi',
];

export const LAST_NAMES = [
  'Sharma', 'Iyer', 'Nair', 'Reddy', 'Kapoor', 'Bose', 'Mehta', 'Gupta',
  'Chowdhury', 'Menon', 'Rao', 'Bhat', 'Sinha', 'Joshi', 'Verma', 'Pillai',
];

export const EMAIL_DOMAINS = [
  'example.com', 'mailbox.dev', 'inbox.test', 'corp.example',
];

export const CITIES = [
  ['Bengaluru', 'Karnataka', '560001'],
  ['Mumbai', 'Maharashtra', '400001'],
  ['Chennai', 'Tamil Nadu', '600001'],
  ['Hyderabad', 'Telangana', '500001'],
  ['Pune', 'Maharashtra', '411001'],
  ['Kochi', 'Kerala', '682001'],
];

export const STREETS = [
  'MG Road', 'Church Street', 'Residency Road', 'Anna Salai', 'Linking Road',
  'Brigade Road', 'Park Street', 'Jubilee Hills Road No. 5',
];

export const STATUSES = ['active', 'pending', 'completed', 'cancelled', 'failed'];

export const LOREM = [
  'Built for everyday use and tested against the things that actually go wrong.',
  'A straightforward option that covers the basics without much ceremony.',
  'Designed to last, with replaceable parts and a two-year warranty.',
  'Compact enough for a desk, sturdy enough for daily handling.',
  'Sourced responsibly and packed in recyclable materials.',
];
