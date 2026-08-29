export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { imageBase64, mimeType, manualText, age, gender } = req.body;
    const apiKey = process.env.GEMINI_API_KEY; 

    if (!apiKey) {
        return res.status(500).json({ error: 'مفتاح API غير متوفر' });
    }

    const patientGender = gender === 'male' ? 'ذكر' : 'أنثى';
    const patientAge = age ? age : 'غير محدد';

    // الموجه الذكي يدمج العمر والجنس لتحديد النسب بدقة
    const promptText = `
    أنت طبيب مختبرات تعتمد حصرياً على القيم المرجعية من "Larousse Médical".
    بيانات المريض: الجنس (${patientGender})، العمر (${patientAge} سنة). استخدم هذه البيانات لتحديد النسب الطبيعية الدقيقة.
    
    المطلوب تحليل: ${imageBase64 ? 'صورة تقرير التحليل المرفقة.' : 'هذه النتائج التي أدخلها المريض يدوياً: ' + manualText}
    استخرج جميع التحاليل وقيمها.
    
    قم بإرجاع النتيجة حصراً بصيغة مصفوفة JSON (JSON Array) حيث يحتوي كل عنصر على:
    - "name": اسم التحليل بالعربية (مع الاختصار الإنجليزي).
    - "value": القيمة.
    - "unit": وحدة القياس (إن وجدت).
    - "range": المعدل الطبيعي حسب Larousse (مخصص لعمر وجنس المريض المذكور).
    - "status": حالة النتيجة (حصراً: "طبيعي"، "مرتفع"، "منخفض"، "غير طبيعي").
    - "explanation": تفسير طبي مبسط من سطر واحد.

    مهم جداً: الرد يجب أن يكون كود JSON فقط بدون علامات Markdown وبدون أي نص إضافي.
    `;

    try {
        let requestBody = {
            contents: [{ parts: [{ text: promptText }] }]
        };

        // إذا كان هناك صورة، أضفها للطلب
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
        
        if (data.error) return res.status(500).json({ error: 'خطأ في استجابة Gemini' });

        let textResponse = data.candidates[0].content.parts[0].text;
        textResponse = textResponse.replace(/```json/g, '').replace(/```/g, '').trim();
        
        const extractedValues = JSON.parse(textResponse);
        res.status(200).json(extractedValues);

    } catch (error) {
        console.error("Server Error:", error);
        res.status(500).json({ error: 'فشل تحليل البيانات، حاول مجدداً.' });
    }
}
