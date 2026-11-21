/* إعدادات واجهة رينو. القيم دي عامّة بطبيعتها ومفيش فيهم أي سر:
   CLIENT_ID = معرّف دخول جوجل (OAuth client ID) · API_URL = رابط سكريبت القراءة · WRITE_URL = رابط سكريبت الكتابة.
   وهما فاضيين التطبيق بيشتغل ببيانات عيّنة من غير دخول. */
window.RENO_CONFIG = {
  CLIENT_ID: '366746380276-d0frdv2s9rhbfgbddjhjgmrho6kr436f.apps.googleusercontent.com',
  WRITE_URL: 'https://script.google.com/macros/s/AKfycbx54GhlgGa6aLpYouhBNXTZw6pAzrHJ3j18vqHwLdb2zzxLiq4iGPGhAfP2ZAHwRL0/exec',   /* رابط سكريبت الكتابة (عام بطبيعته). وهو فاضي شاشات البيع بتتعرض والتأكيد مقفول. */
  API_URL: 'https://script.google.com/macros/s/AKfycbwbg8zPxo-UAJC_EgOy0gWpFsxJOuu_Nypj_2bek--QROd5w0lXWlRHGrI0518_4BCX/exec',
  BUILD: '2026-11-21.7'
};
