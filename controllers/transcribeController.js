import axios from "axios";
import FormData from "form-data";

export const transcribeAudio = async (req, res) => {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: "OPENAI_API_KEY not configured" });
    }

    const file = req.file;
    if (!file) return res.status(400).json({ error: "No audio file uploaded" });

    const form = new FormData();
    form.append("file", file.buffer, {
      filename: file.originalname || "recording.webm",
      contentType: file.mimetype || "audio/webm",
    });
    form.append("model", "whisper-1");

    const response = await axios.post(
      "https://api.openai.com/v1/audio/transcriptions",
      form,
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          ...form.getHeaders(),
        },
        maxBodyLength: Infinity,
      }
    );

    return res.json({ text: response.data.text });
  } catch (error) {
    console.error("Transcription error:", error?.response?.data || error.message);
    return res.status(500).json({ error: "Transcription failed" });
  }
};
