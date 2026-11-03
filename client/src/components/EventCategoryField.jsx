export default function EventCategoryField({ value, categories, onChange, disabled = false }) {
  if (!categories.length) return null;
  return (
    <div>
      <label htmlFor="category" className="block text-sm font-semibold text-gray-900">Category (optional)</label>
      <select id="category" name="category" value={value} onChange={onChange} disabled={disabled}
        className="mt-2 w-full rounded-lg border border-gray-300 px-4 py-3 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100">
        <option value="">Uncategorised</option>
        {categories.map(category => <option key={category} value={category}>{category}</option>)}
      </select>
    </div>
  );
}
