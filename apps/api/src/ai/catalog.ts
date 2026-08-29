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

/** Nouns used to build product names, keyed by subcategory. */
export const PRODUCT_NOUNS: Record<string, string[]> = {
  Phones: ['Galaxy S24', 'Pixel 9', 'Nord 4', 'iPhone 15'],
  Laptops: ['ThinkPad X1', 'MacBook Air', 'IdeaPad Slim', 'Vivobook 15'],
  Headphones: ['WH-1000XM5', 'AirPods Pro', 'Buds 3 Pro', 'QuietComfort'],
  Tablets: ['Tab S9', 'iPad Air', 'Pad 6', 'Tab P12'],
  Cookware: ['Triply Saucepan', 'Cast Iron Skillet', 'Pressure Cooker 5L'],
  'Small Appliances': ['Air Fryer 4L', 'Mixer Grinder 750W', 'Kettle 1.7L'],
  Storage: ['Airtight Jar Set', 'Vacuum Container', 'Steel Lunch Box'],
  Lighting: ['LED Batten 20W', 'Smart Bulb 9W', 'Table Lamp'],
  Shirts: ['Oxford Shirt', 'Linen Kurta', 'Flannel Overshirt'],
  Footwear: ['Air Zoom Pegasus', 'Ultraboost 22', 'Canvas Sneaker'],
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
