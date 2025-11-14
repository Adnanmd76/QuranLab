// Tajweed Check Function (Hugging Face Integration)
const HfInference = require('@huggingface/inference');

const hf = new HfInference('your-hf-token'); // Free token from HF

async function checkTajweed(audioUrl) {
  const result = await hf.audioClassification({
    model: 'Habib-HF/tarbiyah-ai-v1-1',
    data: audioUrl
  });
  const errors = result.filter(r => r.score < 0.8).map(r => r.label); // e.g., 'madd error'
  return { text: result.text, errors, score: Math.round(result.score * 100) };
}

module.exports = { checkTajweed };
