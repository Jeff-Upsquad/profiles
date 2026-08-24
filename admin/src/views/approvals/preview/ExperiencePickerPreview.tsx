export default function ExperiencePickerPreview() {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="mb-1 text-xs font-medium text-gray-500">From</p>
            <div className="grid grid-cols-2 gap-2">
              <select disabled className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm opacity-60">
                <option>Year</option>
              </select>
              <select disabled className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm opacity-60">
                <option>Month</option>
              </select>
            </div>
          </div>
          <div>
            <p className="mb-1 text-xs font-medium text-gray-500">To</p>
            <div className="grid grid-cols-2 gap-2">
              <select disabled className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm opacity-60">
                <option>Year</option>
              </select>
              <select disabled className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm opacity-60">
                <option>Month</option>
              </select>
            </div>
          </div>
        </div>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Company Name</label>
            <input disabled placeholder="e.g. Acme Corp, Infosys, Freelancer" className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm opacity-60 placeholder:text-gray-400" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Designation</label>
            <input disabled placeholder="e.g. Senior Accountant" className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm opacity-60 placeholder:text-gray-400" />
          </div>
        </div>
      </div>
      <button
        type="button"
        disabled
        className="inline-flex items-center gap-1 text-sm font-medium text-indigo-600 opacity-60"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
        Add Experience
      </button>
    </div>
  );
}
