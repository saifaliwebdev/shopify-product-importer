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



import Groq from 'groq-sdk';

// ✅ API Key from .env (SAFE - not exposed in code)
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

// ✅ Fast model for SEO optimization
const AI_MODEL = "llama-3.1-8b-instant";  // Fast & Good quality

export async function optimizeProductSEO(productData) {
  try {
    console.log("🤖 Groq AI Starting...");
    const startTime = Date.now();

    // ✅ Non-streaming request (easier for JSON parsing)
    const chatCompletion = await groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content: "You are an SEO expert. Return ONLY valid JSON with no newlines or special characters inside string values. No explanation, no markdown, just pure single-line JSON."
        },
        {
          role: "user",
          content: `Optimize this product for SEO.

Product Title: "${productData.title}"
Product Description: "${(productData.description || "").substring(0, 500)}"

Return ONLY this JSON format (single line, no line breaks in strings):
{
  "optimized_title": "SEO optimized title (max 70 chars, keywords first, no Hot Sale/Free Shipping)",
  "optimized_description": "2-3 sentence compelling description with benefits (no line breaks)",
  "tags": ["tag1", "tag2", "tag3", "tag4", "tag5"]
}`
        }
      ],
      model: AI_MODEL,
      temperature: 0.7,
      max_tokens: 1024,
      stream: false  // ✅ No streaming - get full response
    });

    const endTime = Date.now();
    console.log(`⚡ Groq Response Time: ${endTime - startTime}ms`);

    // ✅ Extract response
    const responseText = chatCompletion.choices[0]?.message?.content || "";
    console.log("📝 AI Response:", responseText.substring(0, 150));

    // ✅ Clean response (remove markdown if any)
    let cleanText = responseText
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    // ✅ Extract JSON
    const jsonMatch = cleanText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No valid JSON in response");
    }

    // ✅ Sanitize JSON - remove control characters that break parsing
    const sanitizedJson = jsonMatch[0]
      .replace(/[\u0000-\u001F\u007F-\u009F]/g, '') // Remove control characters
      .replace(/\n/g, ' ')  // Replace newlines with spaces
      .replace(/\r/g, '')   // Remove carriage returns
      .replace(/\t/g, ' ')  // Replace tabs with spaces
      .replace(/\s+/g, ' '); // Normalize multiple spaces

    const optimized = JSON.parse(sanitizedJson);

    console.log("✅ AI Optimization Done!");
    console.log("📝 New Title:", optimized.optimized_title);

    return {
      ...productData,
      optimized_title: optimized.optimized_title || productData.title,
      optimized_description: optimized.optimized_description || productData.description,
      optimized_tags: Array.isArray(optimized.tags) ? optimized.tags : [],
      aiOptimized: true,
      aiError: false
    };

  } catch (err) {
    console.error('❌ Groq AI Failed:', err.message);

    // ✅ Fallback - return original data (no crash)
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