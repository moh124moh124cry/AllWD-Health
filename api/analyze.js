export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    const { imageBase64, mimeType, manualText, age, gender } = req.body;
    const apiKey = process.env.GEMINI_API_KEY; 

    if (!apiKey) return res.status(500).json({ error: 'مفتاح API غير موجود في إعدادات Vercel.' });

    const patientGender = gender === 'male' ? 'ذكر' : 'أنثى';
    const patientAge = age ? age : 'غير محدد';

    const promptText = `
    أنت طبيب مختبرات تعتمد على "Larousse Médical". المريض: ${patientGender}، العمر: ${patientAge} سنة.
    المطلوب تحليل: ${imageBase64 ? 'صورة التقرير المرفقة.' : 'النتائج المكتوبة: ' + manualText}
    استخرج التحاليل وقم بإرجاعها كمصفوفة (Array) تحتوي على كائنات بالخصائص التالية فقط:
    "name", "value", "unit", "range", "status", "explanation".
    حالة النتيجة (status) يجب أن تكون فقط: "طبيعي"، "مرتفع"، "منخفض"، أو "غير طبيعي".
    `;

    try {
        let requestBody = { 
            contents: [{ parts: [{ text: promptText }] }],
            generationConfig: { response_mime_type: "application/json" }
        };

        if (imageBase64) {
            requestBody.contents[0].parts.push({
                inline_data: { mime_type: mimeType, data: imageBase64 }
            });
        }

        // التعديل هنا: إضافة -latest لاسم النموذج في الرابط
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro-latest:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        });

        const data = await response.json();
        
        if (data.error) return res.status(500).json({ error: 'خطأ من جوجل: ' + data.error.message });

        let extractedValues = JSON.parse(data.candidates[0].content.parts[0].text);
        
        if (!Array.isArray(extractedValues)) {
            extractedValues = [extractedValues];
        }

        res.status(200).json(extractedValues);

    } catch (error) {
        console.error("Server Error:", error);
        res.status(500).json({ error: 'حدث خطأ في معالجة البيانات، حاول كتابتها بشكل أوضح.' });
    }
}
