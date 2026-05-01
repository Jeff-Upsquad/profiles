'use client';

const SUPPORT_PHONE_DIGITS = '919995266342';
const SUPPORT_PHONE_DISPLAY = '+91 99952 66342';

export default function ContactSupportPage() {
  const message = encodeURIComponent('Hi, I need help with my UpSquad profile.');
  const whatsappUrl = `https://wa.me/${SUPPORT_PHONE_DIGITS}?text=${message}`;

  return (
    <div className="font-[family-name:var(--font-inter)]">
      <h1 className="text-[22px] font-semibold text-[#202020] tracking-tight">
        Contact Support
      </h1>
      <p className="mt-1 text-[13px] text-[#646464]">
        Need help? Reach out to our support team on WhatsApp.
      </p>

      <div className="mt-8 flex flex-col items-center rounded-xl border border-[#ECECEF] bg-white p-10 text-center shadow-sm">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#25D366]/10">
          <svg className="h-8 w-8 text-[#25D366]" viewBox="0 0 24 24" fill="currentColor">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
          </svg>
        </div>

        <h2 className="mt-5 text-[17px] font-semibold text-[#202020]">
          WhatsApp Support
        </h2>
        <p className="mt-2 max-w-sm text-[13px] leading-relaxed text-[#646464]">
          Chat with our team for quick assistance with your account, profile, or
          any questions about the UpSquad Partner Program.
        </p>
        <p className="mt-3 text-[12px] font-medium text-[#202020]">
          {SUPPORT_PHONE_DISPLAY}
        </p>

        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-6 inline-flex items-center gap-2.5 rounded-lg bg-[#25D366] px-6 py-2.5 text-[13px] font-semibold text-white shadow-sm transition-all hover:bg-[#1da851] active:scale-[0.98]"
        >
          <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="currentColor">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
          </svg>
          Chat on WhatsApp
        </a>
      </div>
    </div>
  );
}
