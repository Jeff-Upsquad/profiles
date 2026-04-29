export default function LanguagePickerPreview() {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-gray-700">
        Languages Spoken
      </label>
      <button
        type="button"
        disabled
        className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-indigo-600 opacity-60"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
        Add Language
      </button>
    </div>
  );
}
