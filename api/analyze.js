export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    const { imageBase64, mimeType, manualText, age, gender } = req.body;
    // تغيير اسم المتغير ليتوافق مع المفتاح الجديد
    const apiKey = process.env.GROK_API_KEY; 

    if (!apiKey) return res.status(500).json({ error: 'مفتاح GROK_API_KEY غير موجود في إعدادات Vercel.' });

    const patientGender = gender === 'male' ? 'ذكر' : 'أنثى';
    const patientAge = age ? age : 'غير محدد';

    const promptText = `
    أنت طبيب مختبرات تعتمد على "Larousse Médical". المريض: ${patientGender}، العمر: ${patientAge} سنة.
    المطلوب تحليل: ${imageBase64 ? 'صورة التقرير المرفقة.' : 'النتائج المكتوبة: ' + manualText}
    استخرج التحاليل وقم بإرجاعها بصيغة JSON فقط.
    يجب أن يكون الرد عبارة عن مصفوفة (Array) تحتوي على كائنات بالخصائص التالية فقط:
    "name", "value", "unit", "range", "status", "explanation".
    حالة النتيجة (status) يجب أن تكون فقط: "طبيعي"، "مرتفع"، "منخفض"، أو "غير طبيعي".
    مهم جداً: أرجع الكود البرمجي JSON فقط بدون أي نصوص إضافية.
    `;

    // بناء محتوى الطلب المتوافق مع Grok/OpenAI
    let userContent = [{ type: "text", text: promptText }];

    if (imageBase64) {
        userContent.push({
            type: "image_url",
            image_url: { url: `data:${mimeType};base64,${imageBase64}` }
        });
    }

    try {
        const response = await fetch("https://api.xai.com/v1/chat/completions", {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                // استخدام نموذج الرؤية إذا وجدت صورة، أو النموذج النصي
                model: imageBase64 ? "grok-vision-beta" : "grok-beta",
                messages: [{ role: "user", content: userContent }],
                temperature: 0.1
            })
        });

        const data = await response.json();
        
        if (data.error) return res.status(500).json({ error: 'خطأ من Grok: ' + data.error.message });

        // استخراج النص من هيكل استجابة Grok
        let textResponse = data.choices[0].message.content;
        textResponse = textResponse.replace(/```json/g, '').replace(/```/g, '').trim();

        let extractedValues = JSON.parse(textResponse);
        
        if (!Array.isArray(extractedValues)) {
            extractedValues = [extractedValues];
        }

        res.status(200).json(extractedValues);

    } catch (error) {
        console.error("Server Error:", error);
        res.status(500).json({ error: 'حدث خطأ في معالجة البيانات، تأكد من صحة مفتاح Grok API.' });
    }
}
