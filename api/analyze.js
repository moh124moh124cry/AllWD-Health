export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { imageBase64, mimeType, manualText, age, gender } = req.body;
    const apiKey = process.env.GEMINI_API_KEY; 

    if (!apiKey) {
        return res.status(500).json({ error: 'مفتاح API غير موجود في إعدادات Vercel لهذا المشروع.' });
    }

    const patientGender = gender === 'male' ? 'ذكر' : 'أنثى';
    const patientAge = age ? age : 'غير محدد';

    const promptText = `
    أنت طبيب مختبرات تعتمد حصرياً على القيم المرجعية من "Larousse Médical".
    بيانات المريض: الجنس (${patientGender})، العمر (${patientAge} سنة).
    
    المطلوب تحليل: ${imageBase64 ? 'صورة التقرير المرفقة.' : 'هذه النتائج: ' + manualText}
    
    استخرج جميع التحاليل وقيمها، وقم بإرجاع النتيجة حصراً بصيغة JSON Array. يجب أن يحتوي كل عنصر على:
    "name", "value", "unit", "range", "status", "explanation".
    حالة النتيجة (status) يجب أن تكون فقط: "طبيعي"، "مرتفع"، "منخفض"، "غير طبيعي".
    مهم جداً: أرجع مصفوفة JSON فقط تبدأ بـ [ وتنتهي بـ ] بدون أي كلمات أخرى.
    `;

    try {
        let requestBody = { contents: [{ parts: [{ text: promptText }] }] };

        if (imageBase64) {
            requestBody.contents[0].parts.push({
                inline_data: { mime_type: mimeType, data: imageBase64 }
            });
        }

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        });

        const data = await response.json();
        
        if (data.error) {
            return res.status(500).json({ error: 'خطأ من جوجل: ' + data.error.message });
        }

        let textResponse = data.candidates[0].content.parts[0].text;
        
        // نظام فلترة ذكي لالتقاط الـ JSON فقط حتى لو أخطأ الذكاء الاصطناعي في التنسيق
        const match = textResponse.match(/\[([\s\S]*?)\]/);
        if (!match) {
            return res.status(500).json({ error: 'الذكاء الاصطناعي لم يرسل البيانات بالتنسيق المطلوب.' });
        }
        
        const extractedValues = JSON.parse("[" + match[1] + "]");
        res.status(200).json(extractedValues);

    } catch (error) {
        console.error("Server Error:", error);
        res.status(500).json({ error: 'تأكد من كتابة التحاليل بشكل واضح والمحاولة مجدداً.' });
    }
}
