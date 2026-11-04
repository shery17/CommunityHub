import { localTimeChoices } from "../eventFormTiming";

const inputClass = "mt-2 w-full rounded-lg border border-gray-300 px-4 py-3 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 disabled:bg-gray-100 disabled:text-gray-600";
const zones = [...new Set(["Europe/London", "UTC", ...(Intl.supportedValuesOf?.("timeZone") ?? ["America/New_York", "Asia/Tokyo", "Australia/Sydney"])])];

// Keep saved sub-minute times valid when editing older events.
function timeStep(value, compact) {
  return compact && !/:\d{2}:\d{2}/.test(value) ? 60
    : compact && /:00(?:\.0+)?$/.test(value) ? 60
    : value.includes(".") ? 0.001 : 1;
}

function OffsetChoice({ date, time, timezone, name, value, onChange, disabled, label }) {
  const { options, error } = localTimeChoices(date, time, timezone);
  if (error) return <p className="mt-2 text-sm text-red-600" role="alert">{label}: {error}</p>;
  if (options.length < 2) return null;
  return (
    <div className="mt-3">
      <label htmlFor={name} className="block text-sm font-semibold text-gray-900">{label}: which occurrence?</label>
      <p id={`${name}-help`} className="mt-1 text-sm text-gray-600">The clocks go back, so this time occurs twice.</p>
      <select id={name} name={name} value={value} onChange={onChange} required disabled={disabled}
        aria-describedby={`${name}-help`} className={inputClass}>
        <option value="">Choose an occurrence</option>
        {options.map(option => <option key={option.offset} value={option.offset}>{option.label}</option>)}
      </select>
    </div>
  );
}

export default function EventTimingFields({ form, onChange, multiDay, locks = {}, disabled = false, compact = false, differentEndDay = false, onDifferentEndDayChange, registrationOptions }) {
  if (!multiDay) return (
    <fieldset disabled={disabled} className="grid gap-6 sm:grid-cols-2">
      <legend className="sr-only">Event date and time</legend>
      <div><label htmlFor="date" className="block text-sm font-semibold text-gray-900">Date</label>
        <input id="date" name="date" type="date" required value={form.date} onChange={onChange} className={inputClass} /></div>
      <div><label htmlFor="time" className="block text-sm font-semibold text-gray-900">Time</label>
        <input id="time" name="time" type="time" step={timeStep(form.time, compact)} required value={form.time} onChange={onChange} className={inputClass} /></div>
    </fieldset>
  );
  const [deadlineDate, deadlineTime] = form.deadline_local.split("T");
  const timezoneOptions = zones.includes(form.timezone) ? zones : [form.timezone, ...zones];
  const deadline = (
    <div>
      <label htmlFor="deadline_local" className="block text-sm font-semibold text-gray-900">Registration deadline (optional)</label>
      <input id="deadline_local" name="deadline_local" type="datetime-local" step={compact ? timeStep(deadlineTime ?? "", true) : 0.001}
        value={form.deadline_local} onChange={onChange} disabled={locks.deadline}
        aria-describedby="deadline-help" className={inputClass} />
      <p id="deadline-help" className="mt-2 text-sm text-gray-600">Leave blank to close registration at the start.</p>
      <OffsetChoice date={deadlineDate} time={deadlineTime} timezone={form.timezone}
        name="deadline_offset" value={form.deadline_offset} onChange={onChange} disabled={locks.deadline} label="Registration deadline" />
    </div>
  );
  return (
    <fieldset disabled={disabled} className="space-y-6">
      <legend className="text-lg font-semibold text-gray-900">Event timing</legend>
      <div>
        <label htmlFor="timezone" className="block text-sm font-semibold text-gray-900">Event time zone</label>
        <select id="timezone" name="timezone" value={form.timezone} onChange={onChange}
          required disabled={locks.start} aria-describedby="timezone-help" className={inputClass}>
          {timezoneOptions.map(zone => <option key={zone} value={zone}>{zone}</option>)}
        </select>
        <p id="timezone-help" className="mt-2 text-sm text-gray-600">Enter all times, including the registration deadline, in this time zone.</p>
      </div>
      {locks.start && <p className="text-sm text-gray-600" role="status">{locks.past
        ? "This event has ended. Timing and registration settings are locked."
        : "This event has started. Only the end can be extended; start, time zone and deadline are locked."}</p>}
      {["start", "end"].map(kind => (
        <div key={kind}>
          {compact && kind === "end" && <label className="mb-3 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={differentEndDay} disabled={locks.end} onChange={event => onDifferentEndDayChange(event.target.checked)} />
            Ends on a different day
          </label>}
          <div className="grid gap-6 sm:grid-cols-2">
            {(!compact || kind === "start" || differentEndDay) && <div><label htmlFor={`${kind}_date`} className="block text-sm font-semibold text-gray-900">{kind === "start" ? (compact ? "Event date" : "Start date") : "End date"}</label>
              <input id={`${kind}_date`} name={`${kind}_date`} type="date" required disabled={locks[kind]}
                value={form[`${kind}_date`]} onChange={onChange} className={inputClass} /></div>}
            <div><label htmlFor={`${kind}_time`} className="block text-sm font-semibold text-gray-900">{kind === "start" ? "Start time" : "End time"}</label>
              <input id={`${kind}_time`} name={`${kind}_time`} type="time" step={timeStep(form[`${kind}_time`], compact)} required disabled={locks[kind]}
                value={form[`${kind}_time`]} onChange={onChange} className={inputClass} /></div>
          </div>
          <OffsetChoice date={form[`${kind}_date`]} time={form[`${kind}_time`]} timezone={form.timezone}
            name={`${kind}_offset`} value={form[`${kind}_offset`]} onChange={onChange} disabled={locks[kind]}
            label={kind === "start" ? "Start time" : "End time"} />
        </div>
      ))}
      {compact ? <details className="rounded-lg border border-gray-200 p-4" onInvalidCapture={event => { event.currentTarget.open = true; }}>
        <summary className="cursor-pointer font-semibold">Registration options</summary>
        <div className="mt-4 space-y-4">{registrationOptions}{deadline}</div>
      </details> : deadline}
    </fieldset>
  );
}
