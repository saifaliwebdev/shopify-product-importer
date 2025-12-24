import Bytez from 'bytez.js';

const AI_OPTIMIZER_KEY = "49985c0d0a357b1f57e62275b6305f47";
const AI_MODEL = "google/gemma-3-1b-it";

const optimizer = new Bytez(AI_OPTIMIZER_KEY);
const model = optimizer.model(AI_MODEL);

export async function optimizeProductSEO(productData) {
  try {
    const { error, output } = await model.run([
      {
        role: "system",
        content: "You are an SEO expert. Return ONLY valid JSON with these keys: optimized_title, optimized_description, tags (array). No other text."
      },
      {
        role: "user",
        content: `Optimize this product for SEO: ${productData.title} - ${productData.description.slice(0, 200)}...`
      }
    ]);

    if (error || !output) {
      console.error('AI Optimization failed:', error);
      return {
        ...productData,
        aiError: true
      };
    }

    try {
      // Clean response - remove markdown code blocks
      const cleanedOutput = output.replace(/```json|```/g, '').trim();
      const optimized = JSON.parse(cleanedOutput);
      return {
        ...productData,
        optimized_title: optimized.optimized_title || productData.title,
        optimized_description: optimized.optimized_description || productData.description,
        tags: optimized.tags || productData.tags,
        aiOptimized: true
      };
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError);
      return {
        ...productData,
        aiError: true
      };
    }
  } catch (err) {
    console.error('AI Optimization error:', err);
    return {
      ...productData,
      aiError: true
    };
  }
}
