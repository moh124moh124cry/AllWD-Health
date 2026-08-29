export default async function handler(req, res) {
    // التأكد من أن الطلب من نوع POST فقط
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { imageBase64, mimeType } = req.body;
    
    // سحب مفتاح API السري من Vercel Environment Variables
    const apiKey = process.env.GEMINI_API_KEY; 

    if (!apiKey) {
        return res.status(500).json({ error: 'مفتاح API غير متوفر في الخادم' });
    }

    const promptText = "Extract the following blood test values from this medical report image and return ONLY a valid JSON object with these exact keys: hb, wbc, plt, glucose. Extract the numerical values accurately. If a value is missing or unreadable, return null for it. Do not include any markdown formatting like ```json, just the raw JSON object.";

    try {
        const response = await fetch(`[https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=$](https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=$){apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    parts: [
                        { text: promptText },
                        { inline_data: { mime_type: mimeType, data: imageBase64 } }
                    ]
                }]
            })
        });

        const data = await response.json();
        
        if (data.error) {
            console.error("Gemini API Error:", data.error);
            return res.status(500).json({ error: 'خطأ في معالجة واجهة Gemini' });
        }

        // استخراج النص من الرد وتنظيفه لضمان صيغة JSON صحيحة
        let textResponse = data.candidates[0].content.parts[0].text;
        textResponse = textResponse.replace(/```json/g, '').replace(/```/g, '').trim();
        
        const extractedValues = JSON.parse(textResponse);

        // إرجاع النتيجة للواجهة الأمامية
        res.status(200).json(extractedValues);

    } catch (error) {
        console.error("Server Error:", error);
        res.status(500).json({ error: 'فشل تحليل الصورة في الخادم' });
    }
}
