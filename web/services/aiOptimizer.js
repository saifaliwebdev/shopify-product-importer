// import Bytez from 'bytez.js';

// const AI_OPTIMIZER_KEY = "49985c0d0a357b1f57e62275b6305f47";
// const AI_MODEL = "google/gemma-3-1b-it";

// const optimizer = new Bytez(AI_OPTIMIZER_KEY);
// const model = optimizer.model(AI_MODEL);

// /**
//  * ✅ FIXED: Extract string from any output format
//  */
// function extractString(output) {
//   // Debug log - dekho kya aa raha hai
//   console.log("🔍 Output type:", typeof output);
//   console.log("🔍 Output value:", JSON.stringify(output).substring(0, 300));

//   if (!output) return "";

//   // Already string
//   if (typeof output === "string") return output;

//   // Array format: [{ content: "..." }] or ["..."]
//   if (Array.isArray(output)) {
//     const first = output[0];
//     if (typeof first === "string") return first;
//     if (first?.content) return first.content;
//     if (first?.text) return first.text;
//     if (first?.message?.content) return first.message.content;
//   }

//   // Object format: { content: "..." } or { text: "..." }
//   if (typeof output === "object") {
//     if (output.content) return output.content;
//     if (output.text) return output.text;
//     if (output.message?.content) return output.message.content;
//     if (output.response) return output.response;
//     if (output.choices?.[0]?.message?.content) {
//       return output.choices[0].message.content;
//     }
//   }

//   // Fallback - stringify
//   return JSON.stringify(output);
// }

// export async function optimizeProductSEO(productData) {
//   try {
//     console.log("🤖 Starting AI optimization for:", productData.title);

//     const { error, output } = await model.run([
//       {
//         role: "system",
//         content: "You are an SEO expert. Return ONLY valid JSON with these keys: optimized_title, optimized_description, tags (array). No other text."
//       },
//       {
//         role: "user",
//         content: `Optimize this product for SEO: ${productData.title} - ${(productData.description || "").slice(0, 200)}...`
//       }
//     ]);

//     if (error) {
//       console.error('❌ AI API Error:', error);
//       return {
//         ...productData,
//         aiError: true
//       };
//     }

//     if (!output) {
//       console.error('❌ AI returned empty output');
//       return {
//         ...productData,
//         aiError: true
//       };
//     }

//     try {
//       // ✅ FIXED: Extract string from output first
//       const outputString = extractString(output);
      
//       if (!outputString) {
//         console.error('❌ Could not extract string from output');
//         return {
//           ...productData,
//           aiError: true
//         };
//       }

//       console.log("📝 Extracted string:", outputString.substring(0, 200));

//       // Clean response - remove markdown code blocks
//       const cleanedOutput = outputString
//         .replace(/```json\n?/g, '')
//         .replace(/```\n?/g, '')
//         .trim();

//       // Extract JSON from response (in case there's extra text)
//       const jsonMatch = cleanedOutput.match(/\{[\s\S]*\}/);
      
//       if (!jsonMatch) {
//         console.error('❌ No JSON found in response:', cleanedOutput);
//         return {
//           ...productData,
//           aiError: true
//         };
//       }

//       const optimized = JSON.parse(jsonMatch[0]);
      
//       console.log("✅ AI Optimization successful!");
//       console.log("📝 New title:", optimized.optimized_title);

//       return {
//         ...productData,
//         title: optimized.optimized_title || productData.title,
//         description: optimized.optimized_description || productData.description,
//         tags: optimized.tags || productData.tags,
//         aiOptimized: true
//       };

//     } catch (parseError) {
//       console.error('❌ Failed to parse AI response:', parseError.message);
//       return {
//         ...productData,
//         aiError: true
//       };
//     }

//   } catch (err) {
//     console.error('❌ AI Optimization error:', err.message);
//     return {
//       ...productData,
//       aiError: true
//     };
//   }
// }



import { GoogleGenerativeAI } from "@google/generative-ai";

// API Key direct yahan rakhein
const API_KEY = "AIzaSyApy59ias2sbEGoStHB7rhPL80Czebh0nI";
const genAI = new GoogleGenerativeAI(API_KEY);

export async function optimizeProductSEO(productData) {
    try {
        console.log("🤖 Gemini AI Starting...");

        // Stable Model
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        const prompt = `
            Task: Optimize Shopify Product SEO.
            Product Title: ${productData.title}
            
            Return ONLY a valid JSON object. No extra text.
            {
                "optimized_title": "SEO Title here",
                "optimized_description": "2-sentence description here",
                "tags": ["tag1", "tag2"]
            }
        `;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        let text = response.text();

        // Safayi: Agar Gemini ```json ... ``` bhej de to use hatayein
        text = text.replace(/```json|```/g, "").trim();
        
        const optimized = JSON.parse(text);

        return {
            ...productData,
            optimized_title: optimized.optimized_title || productData.title,
            optimized_description: optimized.optimized_description || productData.description,
            optimized_tags: Array.isArray(optimized.tags) ? optimized.tags : [],
            aiOptimized: true,
            aiError: false
        };

    } catch (err) {
        console.error('❌ Gemini AI Failed:', err.message);
        // Fallback: Taake screen white na ho
        return {
            ...productData,
            optimized_title: productData.title,
            optimized_description: productData.description,
            optimized_tags: Array.isArray(productData.tags) ? productData.tags : [],
            aiOptimized: false,
            aiError: true
        };
    }
}