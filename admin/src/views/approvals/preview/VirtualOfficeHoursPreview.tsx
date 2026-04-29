const DAYS = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];

export default function VirtualOfficeHoursPreview() {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-indigo-700">
            Total per week
          </p>
          <p className="mt-0.5 text-xl font-bold text-indigo-900">
            0 <span className="text-sm font-medium">hrs</span>
          </p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-indigo-700">
            Total per month
          </p>
          <p className="mt-0.5 text-xl font-bold text-indigo-900">
            0 <span className="text-sm font-medium">hrs</span>
          </p>
        </div>
      </div>
      <div className="divide-y divide-gray-100 rounded-lg border border-gray-200">
        {DAYS.map((day) => (
          <div
            key={day}
            className="flex flex-wrap items-center gap-3 px-4 py-3 sm:flex-nowrap"
          >
            <div className="w-24 flex-shrink-0 text-sm font-medium text-gray-700">
              {day}
            </div>
            <div className="flex flex-1 items-center gap-2">
              <input
                type="time"
                disabled
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm shadow-sm disabled:opacity-60"
              />
              <span className="text-xs text-gray-400">to</span>
              <input
                type="time"
                disabled
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm shadow-sm disabled:opacity-60"
              />
            </div>
            <div className="w-20 flex-shrink-0 text-right text-sm text-gray-400">
              — hrs
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
