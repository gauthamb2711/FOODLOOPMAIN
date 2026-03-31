const axios = require('axios');

// @desc    Generate AI insights based on dashboard data
// @route   POST /api/ai/predict
// @access  Private (Canteen only)
const generateInsights = async (req, res) => {
  const { prompt } = req.body;
  const OLLAMA_URL = process.env.OLLAMA_URL || 'http://127.0.0.1:11434/api/generate';
  const MODEL = process.env.OLLAMA_MODEL || 'llama3';

  try {
    const response = await axios.post(OLLAMA_URL, {
      model: MODEL,
      prompt: `You are FoodLoop AI, expert in zero-waste management and canteen operations. Analyze this context and provide a brief, actionable prediction or tip:\n\n${prompt}`,
      stream: false
    }, { timeout: 15000 }); // 15 second timeout to prevent hanging UI

    res.json({ result: response.data.response });
  } catch (error) {
    console.warn('Ollama AI Error:', error.message);
    // Graceful fallback if Ollama isn't running
    res.json({
      result: "AI is currently offline or warming up. Based on standard heuristics: Ensure portion sizes are optimized and monitor high-waste menu items closely."
    });
  }
};

module.exports = { generateInsights };
