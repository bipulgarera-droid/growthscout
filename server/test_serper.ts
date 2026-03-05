import dotenv from 'dotenv';
dotenv.config();
import { findFounderInfo } from './services/serper.js';

async function test() {
  console.log("Testing Serper for Shawn Paul Salon in Cleveland, OH...");
  try {
    const result = await findFounderInfo('Shawn Paul Salon', 'Cleveland, OH');
    console.log("Result:", JSON.stringify(result, null, 2));
  } catch (err) {
    console.error("Error:", err);
  }
}
test();
