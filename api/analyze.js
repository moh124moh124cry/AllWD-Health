export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    const { imageBase64, mimeType, manualText, age, gender } = req.body;
    const apiKey = process.env.GEMINI_API_KEY; 

    if (!apiKey) return res.status(500).json({ error: 'مفتاح API غير موجود في Vercel' });

    const promptText = `أنت طبيب مختبرات تعتمد على Larousse Médical. المريض: ${gender === 'male' ? 'ذكر' : 'أنثى'}، العمر: ${age || 'غير محدد'}. تحليل: ${imageBase64 ? 'صورة التقرير' : manualText}. أرجع النتائج حصراً بمصفوفة JSON تحتوي على كائنات بالخصائص التالية: name, value, unit, range, status (طبيعي، مرتفع، منخفض)، explanation. أرجع كود JSON فقط بدون أي نص آخر.`;

    let parts = [{ text: promptText }];
    if (imageBase64) {
        parts.push({ inline_data: { mime_type: mimeType, data: imageBase64 } });
    }

    try {
        // استخدام الإصدار المستقر v1 مع نموذج 1.5 flash
        const response = await fetch(`https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: parts }],
                generationConfig: { response_mime_type: "application/json" }
            })
        });

        const data = await response.json();
        
        if (data.error) {
            return res.status(500).json({ error: data.error.message });
        }

        const textResponse = data.candidates[0].content.parts[0].text;
        const result = JSON.parse(textResponse);

        res.status(200).json(Array.isArray(result) ? result : [result]);

    } catch (error) {
        res.status(500).json({ error: 'حدث خطأ في الاتصال، حاول مجدداً.' });
    }
}
