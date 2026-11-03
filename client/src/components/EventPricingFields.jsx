const inputClass = "mt-2 w-full rounded-lg border border-gray-300 px-4 py-3 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100";

export default function EventPricingFields({ form, config, onChange, disabled = false }) {
  if (!config) return null;
  return (
    <fieldset disabled={disabled} className="space-y-4">
      <legend className="text-lg font-semibold text-gray-900">Pricing</legend>
      <div>
        <label htmlFor="pricing_mode" className="block text-sm font-semibold text-gray-900">Event price</label>
        <select id="pricing_mode" name="pricing_mode" value={form.pricing_mode} onChange={onChange} className={inputClass}>
          <option value="unspecified">Not specified</option>
          <option value="free">Free</option>
          <option value="paid">Paid</option>
        </select>
      </div>
      {form.pricing_mode === "paid" && <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <label htmlFor="price" className="block text-sm font-semibold text-gray-900">Price</label>
          <input id="price" name="price" type="number" inputMode="decimal" min="0.01" max="99999999.99" step="0.01"
            value={form.price} onChange={onChange} required className={inputClass} />
        </div>
        <div>
          <label htmlFor="currency" className="block text-sm font-semibold text-gray-900">Currency</label>
          <select id="currency" name="currency" value={form.currency} onChange={onChange} required className={inputClass}>
            {config.currencies.map(currency => <option key={currency} value={currency}>{currency}</option>)}
          </select>
        </div>
      </div>}
    </fieldset>
  );
}
